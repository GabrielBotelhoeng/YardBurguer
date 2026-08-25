#!/usr/bin/env node
/**
 * produce-hero.mjs — foto de fundo do hero (cena 1).
 *
 * Diferente de produce-layers.mjs em tudo que importa:
 *
 * - Sem chroma. A foto do hero TEM fundo; ela e o fundo. Nada a recortar.
 * - Composicao pensada para receber texto por cima. O hero coloca o titulo
 *   centralizado sobre a imagem com overlay carvao a 45%, entao a foto precisa
 *   ter o centro escuro e o interesse nas bordas. Foto bonita com o burger no
 *   meio brigaria com a headline e perderia as duas coisas.
 * - Formato largo. E fundo de viewport, nao produto em card.
 *
 * A direcao visual segue as fotos reais do cardapio do Brendi — bandeja de
 * cobre, madeira escura, luz quente lateral — para a pagina inteira parecer o
 * mesmo estabelecimento, e nao um banco de imagens colado numa marca.
 *
 * Uso:
 *   node .../produce-hero.mjs                 # 3 variantes em assets/hero/
 *   node .../produce-hero.mjs --escolher 2    # promove a variante 2 para public/assets/hero.webp
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import sharp from 'sharp';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const API = 'https://generativelanguage.googleapis.com/v1beta/models';
const MODELO_PADRAO = 'gemini-3.1-flash-image';

/** Largura final. Cobre viewport de desktop em 1x e celular com folga. */
const LARGURA_FINAL = 1920;

const BASE = [
  'Cinematic wide landscape food photograph, 16:9, for a premium burger restaurant hero banner.',
  'Deep dark moody scene: charcoal-brown background, warm amber key light raking from the side,',
  'rustic dark wood surface and a hammered copper serving tray.',
  'Rich terracotta and ember tones, no cool blue tones, no bright white.',
  'IMPORTANT COMPOSITION: the centre of the frame is empty, dark and uncluttered, because large',
  'headline text will be placed there. Keep the food off-centre, toward the lower left or lower right.',
  'Plenty of negative space and deep shadow in the middle of the image.',
  'No text, no logos, no watermarks, no people looking at camera, no hands in the centre.',
].join(' ');

/**
 * Tres direcoes de composicao, nao tres sorteios do mesmo prompt. Variar a
 * cena de proposito da escolha real: uma aposta no produto, uma no ambiente,
 * uma no processo.
 */
const VARIANTES = [
  {
    id: 1,
    nome: 'produto',
    prompt:
      'A single tall artisanal burger with melted cheddar and crispy bacon sits on the copper tray in the lower right corner, glowing under warm light, steam rising softly.',
  },
  {
    id: 2,
    nome: 'ambiente',
    prompt:
      'A rustic countryside burger joint table in the lower third: dark wood, copper tray, a burger slightly out of focus, scattered embers of warm light, evoking a backyard grill at dusk in the Brazilian cerrado.',
  },
  {
    id: 3,
    nome: 'processo',
    prompt:
      'Burger patties searing on a hot cast iron grill in the lower left, glowing embers beneath, smoke curling upward into the dark empty space above.',
  },
];

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 2) {
    const chave = argv[i]?.replace(/^--/, '');
    if (chave) args[chave] = argv[i + 1];
  }
  return args;
}

async function carregarChave() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  const env = await readFile(resolve(raiz, '.env'), 'utf-8').catch(() => '');
  const achado = env.match(/^GEMINI_API_KEY=(.+)$/m);
  if (achado) return achado[1].trim();
  throw new Error('GEMINI_API_KEY ausente no ambiente e no .env da raiz.');
}

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

async function gerar({ prompt, modelo, chave, tentativas = 4 }) {
  for (let tentativa = 1; ; tentativa++) {
    const resposta = await fetch(`${API}/${modelo}:generateContent`, {
      method: 'POST',
      headers: { 'x-goog-api-key': chave, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${BASE} ${prompt}` }] }],
        generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
      }),
    });

    const payload = await resposta.json();
    const codigo = payload.error?.code;

    if (codigo && [429, 500, 503].includes(codigo) && tentativa < tentativas) {
      const espera = 2000 * 2 ** tentativa;
      console.log(`       ${codigo} — nova tentativa em ${espera / 1000}s`);
      await dormir(espera);
      continue;
    }

    if (payload.error) {
      throw new Error(`${payload.error.code} ${payload.error.status}: ${payload.error.message}`);
    }

    const partes = payload.candidates?.[0]?.content?.parts ?? [];
    const imagem = partes.find((p) => p.inlineData?.data);
    if (!imagem) throw new Error('resposta sem imagem');

    return Buffer.from(imagem.inlineData.data, 'base64');
  }
}

/**
 * O hero e a maior imagem da pagina e cai direto no LCP, entao vale mais
 * qualidade 72 em 1920px do que 90 em 1200px: em tela cheia o usuario percebe
 * resolucao, nao artefato de compressao — ainda mais sob overlay de 45%.
 */
async function otimizar(bufferJpeg) {
  const saida = await sharp(bufferJpeg)
    .resize({ width: LARGURA_FINAL, withoutEnlargement: true })
    .webp({ quality: 72, effort: 6 })
    .toBuffer({ resolveWithObject: true });

  return { buffer: saida.data, largura: saida.info.width, altura: saida.info.height };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const modelo = args.model || MODELO_PADRAO;
  const dirHero = join(raiz, 'assets', 'hero');

  // Promove uma variante ja gerada para a posicao que o build le.
  if (args.escolher) {
    const origem = join(dirHero, `hero-${args.escolher}.webp`);
    const destino = join(raiz, 'public', 'assets', 'hero.webp');
    await mkdir(join(raiz, 'public', 'assets'), { recursive: true });
    await writeFile(destino, await readFile(origem));
    console.log(`public/assets/hero.webp <- variante ${args.escolher}`);
    return;
  }

  const chave = await carregarChave();
  await mkdir(dirHero, { recursive: true });

  console.log(`modelo: ${modelo} · ${VARIANTES.length} variantes\n`);

  for (const variante of VARIANTES) {
    try {
      const raw = await gerar({ prompt: variante.prompt, modelo, chave });
      const { buffer, largura, altura } = await otimizar(raw);
      await writeFile(join(dirHero, `hero-${variante.id}.webp`), buffer);
      console.log(
        `  ok   ${variante.id} ${variante.nome.padEnd(10)} ${largura}x${altura}  ${(buffer.length / 1024).toFixed(0)}kb`
      );
    } catch (erro) {
      console.error(`  FALHA ${variante.id} ${variante.nome}: ${erro.message}`);
      process.exitCode = 1;
    }
  }

  console.log('\nEscolha com: node .../produce-hero.mjs --escolher <n>');
}

main().catch((erro) => {
  console.error(`Falha: ${erro.message}`);
  process.exitCode = 1;
});
