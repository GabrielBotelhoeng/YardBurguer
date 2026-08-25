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
/** Modelo de take final. Rascunho usa gemini-3.1-flash-image. */
const MODELO_PADRAO = 'gemini-3-pro-image';

/** Largura final. Cobre viewport de desktop em 1x e celular com folga. */
const LARGURA_FINAL = 1920;

/**
 * O prompt e montado em blocos nomeados, na ordem da anatomia obrigatoria
 * definida em CLAUDE.md. Isso e de proposito: enquanto o prompt era uma string
 * unica, era facil escrever sujeito + composicao + paleta e achar que estava
 * completo. Foi exatamente o que aconteceu — as tres primeiras variantes sairam
 * sem LENTE, sem EMULSAO e sem ATMOSFERA, e voltaram com superficie plastica.
 *
 * Com os blocos separados, a falta de um e visivel no codigo.
 *
 * Fonte da identidade: assets/LOOK.md. Nada aqui pode contradizer aquele
 * arquivo — se a direcao mudar, muda la primeiro.
 */
const BLOCOS = {
  // 1. Sujeito — concreto, sem adjetivo vago.
  //    O burger montado saiu de proposito: era o elemento que denunciava
  //    geracao nas tres variantes anteriores. Carne na grelha, fumaca e brasa
  //    sao texturas irregulares, e o modelo acerta bagunca com muito mais
  //    facilidade do que superficie lisa.
  sujeito:
    'Beef patties searing on a battered cast iron grill grate in the lower left of the frame, fat rendering and spitting, char marks forming. No assembled burger anywhere in the shot.',

  // 2. Lente e distancia
  lente:
    'Shot on 50mm at f/2.8, camera at chest height, slight low angle looking across the grill. Focus on the nearest patty, natural falloff toward the background.',

  // 3. Luz — o bloco que mais decide o resultado. A fonte precisa estar no
  //    quadro ou logo fora dele: luz vinda de lugar nenhum e a assinatura mais
  //    obvia de imagem gerada.
  luz:
    'Last light of dusk raking in from the left, low sun behind silhouetted cerrado trees on the horizon. The glowing embers under the grate are the second light source and are visible in frame. Long warm shadows, no frontal fill.',

  // 4. Emulsao — o bloco ausente nas tres primeiras tentativas.
  emulsao:
    'Kodak Portra 400 pushed half a stop. Visible grain in the shadows, soft orange halation bleeding from the embers and highlights, slight sharpness falloff in the corners. Natural surface imperfection: visible fibre and irregular sear on the meat, no smooth or plastic surfaces.',

  // 5. Paleta — hex vindos de LOOK.md. --yard-fogo nao entra em imagem: e cor
  //    exclusiva de CTA e competiria com o botao.
  paleta:
    'Charcoal brown #140C06 dominant, terracotta #8B4A2B in the wood and copper, ember amber #C87A2E as accent on less than 10% of the frame. No cool blue, no blown-out white.',

  // 6. Atmosfera — cena real tem bagunca.
  atmosfera:
    'Smoke curling upward into the dark empty space above. Suspended dust and ash catching the side light. Grease spatter, char crumbs and a stained cloth on the worn wood — the mess of a grill actually in use.',

  // 7. Movimento: nao se aplica a imagem estatica.

  // Requisito de layout + anti-slop. Fica por ultimo porque instrucao no fim do
  // prompt e obedecida com mais frequencia — aprendido quando a exigencia de
  // fundo das camadas abria o texto e era ignorada.
  composicao:
    '16:9 landscape. The centre and upper right of the frame stay dark, empty and uncluttered for large headline text. Asymmetric composition, subject off-centre. No centred symmetry, no HDR, no lens flare, no text, no logos, no hands.',
};

const PROMPT = Object.values(BLOCOS).join(' ');

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

async function gerar({ modelo, chave, seed, tentativas = 4 }) {
  for (let tentativa = 1; ; tentativa++) {
    const resposta = await fetch(`${API}/${modelo}:generateContent`, {
      method: 'POST',
      headers: { 'x-goog-api-key': chave, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: PROMPT }] }],
        generationConfig: {
          responseModalities: ['TEXT', 'IMAGE'],
          // Seed e enviada para descobrir se a API aceita. O log registra que o
          // suporte nao estava confirmado; sem seed nao da para iterar dentro
          // do mesmo enquadramento, que e o mecanismo do sistema de prompts.
          ...(seed !== undefined ? { seed } : {}),
        },
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

  // Promove um take ja gerado para a posicao que o build le.
  if (args.escolher) {
    const origem = join(dirHero, `${args.escolher}.webp`);
    const destino = join(raiz, 'public', 'assets', 'hero.webp');
    await mkdir(join(raiz, 'public', 'assets'), { recursive: true });
    await writeFile(destino, await readFile(origem));
    console.log(`public/assets/hero.webp <- ${args.escolher}`);
    return;
  }

  const chave = await carregarChave();
  await mkdir(dirHero, { recursive: true });

  const seed = args.seed !== undefined ? Number(args.seed) : undefined;
  const nome = args.nome || 'hero-fusao';

  console.log(`modelo: ${modelo}${seed !== undefined ? ` · seed ${seed}` : ''}\n`);

  /**
   * Uma geracao por vez. Take final nao se faz em lote — o portao de custo do
   * projeto proibe, e gerar cinco variacoes de uma vez e o oposto de iterar:
   * sem correcao isolada, nao se aprende qual bloco resolveu o quê.
   */
  const raw = await gerar({ modelo, chave, seed });
  const { buffer, largura, altura } = await otimizar(raw);
  await writeFile(join(dirHero, `${nome}.webp`), buffer);

  console.log(`  ok   ${nome}  ${largura}x${altura}  ${(buffer.length / 1024).toFixed(0)}kb`);
  console.log(`\nSe aprovado: node .../produce-hero.mjs --escolher ${nome}`);
}

main().catch((erro) => {
  console.error(`Falha: ${erro.message}`);
  process.exitCode = 1;
});
