#!/usr/bin/env node
/**
 * produce-burger-stack.mjs — pipeline de CENA UNICA para a Cena 2.
 *
 * Substitui o produce-layers.mjs, que gerava sete imagens em sete chamadas
 * separadas. A pesquisa de 2026-08-25 mostrou que essa era a causa raiz dos
 * defeitos que nenhum ajuste de CSS resolvia:
 *
 * - Toda a industria de food photography e CGI produz exploded view a partir de
 *   UMA cena, com uma camera e uma luz so, separando as camadas depois. Nao ha
 *   contraexemplo na literatura.
 * - Os exploded burgers que funcionam na web (CodePen ikbenivo, salamandr) usam
 *   3-4 fatias de largura IDENTICA vindas de uma origem unica.
 * - O Gemini e documentadamente ruim em manter proporcao e escala entre chamadas
 *   separadas. Sete chamadas sao, na pratica, sete sessoes de fotos diferentes.
 *
 * Aqui a luz, a perspectiva e a escala sao identicas por CONSTRUCAO: existe uma
 * imagem so. O que antes era combatido no CSS deixa de existir na origem.
 *
 * DUAS MUDANCAS TECNICAS EM RELACAO AO SCRIPT ANTIGO
 *
 * 1. Chroma VERDE, nao magenta. Magenta e R+B em saturacao maxima, e carne,
 *    bacon e tomate sao dominados por R — o despill calibrado para magenta
 *    ataca o vermelho do proprio ingrediente. E a causa provavel do "carne
 *    parece transparente" relatado pelo cliente. Verde nao compete com nenhum
 *    ingrediente aqui exceto a alface, e para isso existe o contorno branco.
 *
 * 2. Key em HSV, nao por distancia RGB. Matiz separa cor de brilho, entao
 *    sombra sobre o fundo continua sendo fundo — o que corte por distancia RGB
 *    erra sistematicamente.
 *
 * Uso:
 *   node produce-burger-stack.mjs            # gera a mae e fatia
 *   node produce-burger-stack.mjs --demo     # compoe a mae com as camadas
 *                                            # atuais, sem gastar geracao
 *   node produce-burger-stack.mjs --fatias 5
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import sharp from 'sharp';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const API = 'https://generativelanguage.googleapis.com/v1beta/models';
const MODELO_PADRAO = 'gemini-3-pro-image';

const dirSaida = join(raiz, 'public', 'assets', 'stack');
const dirRaw = join(raiz, '.aiox', 'raw');

/**
 * Chroma verde puro. O contorno branco em volta do sujeito e a peca critica:
 * sem ele o anti-aliasing mistura a borda do ingrediente com o verde e deixa
 * uma franja que nenhum pos-processamento remove — a cor do fundo fica
 * literalmente assada nos pixels de borda.
 */
/**
 * CALIBRAGEM — nao alargar a tolerancia sem medir.
 *
 * Testado em 2026-08-25: subir toleranciaMatiz de 40 para 62 comeu a ALFACE.
 * Ela e o unico ingrediente que compete com o verde, e e a demonstracao pratica
 * do principio que a pesquisa registra — nao se remove limpo um fundo que
 * divide espaco de cor com o sujeito.
 *
 * Por isso o contorno branco de 3px no prompt e a peca critica, e nao um
 * detalhe: ele e a zona-tampao que faz o anti-aliasing da borda misturar com
 * BRANCO em vez de verde. Sem ele, nenhuma tolerancia funciona para a alface —
 * apertada deixa franja, larga come a folha.
 */
const CHROMA_HSV = { matiz: 120, toleranciaMatiz: 40, satMin: 0.25, valMin: 0.2 };

/**
 * Prompt da imagem-mae, na anatomia de 7 blocos do CLAUDE.md.
 *
 * A diferenca essencial para o script antigo: aqui se pede a CENA INTEIRA, com
 * as camadas ja afastadas. O modelo resolve luz, escala e perspectiva de uma vez
 * — que e precisamente o que ele nao consegue fazer em chamadas separadas.
 *
 * O afastamento e pequeno de proposito. Fatias que se sobrepoem um pouco no
 * repouso nunca revelam a faixa oculta, que e como os exploded burgers reais da
 * web evitam ter que inventar o que esta atras de cada camada.
 */
const PROMPT_MAE = [
  // 1. Sujeito
  'A single artisanal cheeseburger photographed in a gentle EXPLODED VIEW: the layers are',
  'separated vertically by a small gap, floating in the order bottom bun, bacon, beef patty,',
  'melted cheddar, tomato slice with a purple onion ring, green lettuce, domed top bun.',
  'The gaps are small — each layer still slightly overlaps the one below it.',
  // 2. Lente e distancia
  'Shot on a 100mm macro lens with the camera at exactly the same height as the burger,',
  'looking straight at it from the side at table height. Every layer is seen edge-on,',
  'showing its thickness. No top-down view, no tilt above the burger.',
  // 3. Luz
  'Soft warm key light from the upper left with gentle fill, one single consistent light',
  'source for the whole stack, no harsh specular blowout.',
  // 4. Emulsao
  'Real food texture with natural imperfection — visible pores, fibre, crumb and irregularity.',
  'Nothing smooth, nothing glossy, nothing computer-generated. Matte surfaces.',
  // 5. Paleta
  'Each ingredient keeps its own natural colour: the lettuce is vivid fresh green, the onion',
  'is purple, the tomato is red, the cheddar is deep orange. Warm lighting, never a warm',
  'colour cast that turns vegetables brown.',
  // 6. Composicao — excecao registrada no LOOK.md para camadas
  'The whole burger is centred in frame, fully visible, not cropped, with clear empty margin',
  'on all four sides. Each layer is horizontally centred over the one below it.',
].join(' ');

/**
 * Exigencia de fundo, repetida DEPOIS da descricao.
 *
 * Instrucao concreta vence instrucao distante — foi a licao que este pipeline
 * aprendeu tres vezes (fundo, perspectiva, enquadramento). Entao o requisito
 * fecha o prompt, curto e literal.
 */
const EXIGENCIA_FUNDO = [
  'CRITICAL REQUIREMENT: the entire background is one flat solid colour, pure green,',
  'hex #00FF00, RGB(0,255,0), edge to edge, perfectly uniform, touching all four edges.',
  'Draw a thin 3px pure white outline around the whole burger, separating it from the green.',
  'No studio backdrop, no gradient, no plate, no surface, no props, no hands, no text,',
  'no shadow cast on the background. The background is a flat digital chroma key, NOT part',
  'of the photograph: no film grain, no halation, no colour bleed, no vignette on it.',
  'FINAL CHECK before rendering: background = solid #00FF00 green, flat, edge to edge.',
].join(' ');

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith('--')) continue;
    const chave = argv[i].replace(/^--/, '');
    const proximo = argv[i + 1];
    args[chave] = proximo && !proximo.startsWith('--') ? proximo : true;
  }
  return args;
}

async function gerarMae(modelo, chave) {
  // Chave por HEADER, nunca na query: URL vaza em log de proxy, em historico de
  // shell e na mensagem de erro que este proprio script imprime abaixo. E o
  // mesmo padrao que produce-layers.mjs ja usa.
  const resposta = await fetch(`${API}/${modelo}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': chave },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `${PROMPT_MAE} ${EXIGENCIA_FUNDO}` }] }],
    }),
  });

  if (!resposta.ok) {
    const corpo = await resposta.text();
    throw new Error(`${resposta.status} ${corpo.slice(0, 200)}`);
  }

  const dados = await resposta.json();
  const parte = dados.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
  if (!parte) throw new Error('resposta sem imagem');
  return Buffer.from(parte.inlineData.data, 'base64');
}

/**
 * Modo demo: compoe a mae a partir das camadas que ja existem.
 *
 * Serve para exercitar o fatiador sem gastar geracao. Nao substitui a mae real
 * — as camadas atuais continuam tendo luz e perspectiva divergentes, que e
 * justamente o defeito que a cena unica resolve. O que isto prova e que a
 * deteccao de faixas e o corte funcionam.
 */
async function comporMaeDeDemo() {
  const manifest = JSON.parse(
    await readFile(join(raiz, 'public', 'assets', 'layers', 'manifest.json'), 'utf8')
  );

  const LARGURA = 1200;
  const GAP = 26;
  const camadas = [...manifest.camadas].sort((a, b) => a.order - b.order);

  const preparadas = [];
  for (const camada of camadas) {
    const largura = Math.round(LARGURA * 0.78 * (camada.larguraRelativa ?? 1));
    const buffer = await sharp(join(raiz, 'public', camada.src))
      .resize({ width: largura })
      .toBuffer({ resolveWithObject: true });
    preparadas.push({ buffer: buffer.data, w: buffer.info.width, h: buffer.info.height });
  }

  const alturaTotal = preparadas.reduce((t, p) => t + p.h + GAP, GAP);
  const composicao = [];
  let y = GAP;
  for (const p of preparadas) {
    composicao.push({ input: p.buffer, left: Math.round((LARGURA - p.w) / 2), top: y });
    y += p.h + GAP;
  }

  return sharp({
    create: {
      width: LARGURA,
      height: alturaTotal,
      channels: 4,
      background: { r: 0, g: 255, b: 0, alpha: 1 },
    },
  })
    .composite(composicao)
    .png()
    .toBuffer();
}

/** Converte RGB para matiz/saturacao/valor. Matiz em graus, resto em 0..1. */
function paraHsv(r, g, b) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;

  let matiz = 0;
  if (delta !== 0) {
    if (max === rn) matiz = 60 * (((gn - bn) / delta) % 6);
    else if (max === gn) matiz = 60 * ((bn - rn) / delta + 2);
    else matiz = 60 * ((rn - gn) / delta + 4);
  }
  if (matiz < 0) matiz += 360;

  return { matiz, sat: max === 0 ? 0 : delta / max, val: max };
}

/**
 * Recorta o chroma em HSV.
 *
 * Matiz separa COR de BRILHO: uma area de fundo em sombra continua tendo matiz
 * verde, mesmo escura. Corte por distancia RGB trata essa area como sujeito, que
 * e um dos jeitos classicos de sobrar franja.
 */
async function recortarChroma(buffer) {
  const img = sharp(buffer).ensureAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const saida = Buffer.from(data);

  const { matiz: alvo, toleranciaMatiz, satMin, valMin } = CHROMA_HSV;
  let removidos = 0;

  for (let i = 0; i < data.length; i += info.channels) {
    const { matiz, sat, val } = paraHsv(data[i], data[i + 1], data[i + 2]);
    const distancia = Math.min(Math.abs(matiz - alvo), 360 - Math.abs(matiz - alvo));

    if (distancia <= toleranciaMatiz && sat >= satMin && val >= valMin) {
      saida[i + 3] = 0;
      removidos += 1;
    } else if (distancia <= toleranciaMatiz * 1.6 && sat >= satMin * 0.6) {
      // Rampa de borda: alfa proporcional, o que da anti-aliasing em vez de
      // serrilhado. Despill so aqui, na borda — nunca no miolo do ingrediente,
      // que e o erro que lava a cor da carne.
      const fator = (distancia - toleranciaMatiz) / (toleranciaMatiz * 0.6);
      saida[i + 3] = Math.round(255 * Math.min(1, Math.max(0, fator)));
      const verde = saida[i + 1];
      const teto = Math.max(saida[i], saida[i + 2]);
      if (verde > teto) saida[i + 1] = teto;
    }
  }

  return {
    buffer: await sharp(saida, { raw: info }).png().toBuffer(),
    proporcaoFundo: removidos / (data.length / info.channels),
  };
}

/**
 * Encontra os vales horizontais que separam as camadas.
 *
 * Content-aware, nunca divisao uniforme: o modelo nao espaca as camadas por
 * igual mesmo quando o prompt pede. Percorre a densidade de pixels opacos por
 * linha e corta nos minimos locais entre os picos.
 */
async function detectarFaixas(buffer, fatiasDesejadas) {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  const densidade = new Array(info.height).fill(0);
  for (let y = 0; y < info.height; y += 1) {
    let conta = 0;
    for (let x = 0; x < info.width; x += 1) {
      if (data[(y * info.width + x) * info.channels + 3] > 24) conta += 1;
    }
    densidade[y] = conta;
  }

  const pico = Math.max(...densidade);
  const limiar = pico * 0.06;

  // Blocos contiguos de conteudo, separados por linhas praticamente vazias.
  const blocos = [];
  let inicio = null;
  for (let y = 0; y < info.height; y += 1) {
    const temConteudo = densidade[y] > limiar;
    if (temConteudo && inicio === null) inicio = y;
    if (!temConteudo && inicio !== null) {
      if (y - inicio > info.height * 0.015) blocos.push({ topo: inicio, base: y });
      inicio = null;
    }
  }
  if (inicio !== null) blocos.push({ topo: inicio, base: info.height });

  // Se o modelo encostou camadas e sobraram blocos demais ou de menos, junta os
  // menores ate chegar no numero desejado.
  while (blocos.length > fatiasDesejadas) {
    let menor = 0;
    for (let i = 1; i < blocos.length; i += 1) {
      const alturaAtual = blocos[i].base - blocos[i].topo;
      const alturaMenor = blocos[menor].base - blocos[menor].topo;
      if (alturaAtual < alturaMenor) menor = i;
    }
    const vizinho = menor === 0 ? 1 : menor - 1;
    const a = Math.min(menor, vizinho);
    const b = Math.max(menor, vizinho);
    blocos.splice(a, 2, { topo: blocos[a].topo, base: blocos[b].base });
  }

  return { blocos, largura: info.width, altura: info.height };
}

/**
 * Fatia a mae. Cada camada sai no MESMO canvas de largura total.
 *
 * E a assinatura dos exploded burgers que funcionam: largura identica em todas
 * as fatias, so a altura varia. Como o transbordo lateral ja esta desenhado na
 * imagem-mae — a alface ja e mais larga que o pao ali —, o CSS nao precisa mais
 * de larguraRelativa nenhuma.
 */
async function fatiar(buffer, faixas, nomes) {
  await mkdir(dirSaida, { recursive: true });
  const { blocos, largura } = faixas;
  const camadas = [];

  // Uma margem de seguranca em cada corte: fatias que se sobrepoem um pouco
  // nunca revelam a faixa oculta quando a animacao as separa.
  const MARGEM = 8;

  for (let i = 0; i < blocos.length; i += 1) {
    const bloco = blocos[i];
    const topo = Math.max(0, bloco.topo - MARGEM);
    const base = Math.min(faixas.altura, bloco.base + MARGEM);
    const id = nomes[i] ?? `camada-${i + 1}`;

    /**
     * Sem trim, de proposito.
     *
     * Aparar cada fatia devolveria larguras diferentes — exatamente o que este
     * pipeline existe para evitar. As fatias que funcionam nos exploded burgers
     * reais tem largura IDENTICA; e o canvas comum que mantem cada camada
     * alinhada no mesmo eixo, sem o CSS precisar recentralizar nada.
     */
    const recorte = await sharp(buffer)
      .extract({ left: 0, top: topo, width: largura, height: base - topo })
      .webp({ quality: 90 })
      .toBuffer({ resolveWithObject: true });

    await writeFile(join(dirSaida, `${id}.webp`), recorte.data);

    camadas.push({
      id,
      src: `/assets/stack/${id}.webp`,
      order: i + 1,
      largura: recorte.info.width,
      altura: recorte.info.height,
      // Posicao vertical do centro da fatia na mae, em fracao da altura total.
      // E o que preserva o espacamento original sem inventar assentamento.
      centro: Number((((topo + base) / 2 / faixas.altura)).toFixed(5)),
      mobile: true,
    });

    console.log(`  ok   ${id.padEnd(16)} ${recorte.info.width}x${recorte.info.height}`);
  }

  return camadas;
}

/** Nomes na ordem visual, de cima para baixo. */
const NOMES = ['pao-superior', 'alface', 'tomate-cebola', 'queijo', 'blend', 'bacon', 'pao-inferior'];

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const fatias = Number(args.fatias ?? 7);
  const modelo = typeof args.model === 'string' ? args.model : MODELO_PADRAO;

  await mkdir(dirRaw, { recursive: true });
  const caminhoMae = join(dirRaw, 'burger-mae.png');

  let mae;
  if (args.demo) {
    console.log('modo demo: compondo a mae com as camadas atuais (sem gerar)\n');
    mae = await comporMaeDeDemo();
  } else if (args.reuse && existsSync(caminhoMae)) {
    console.log('reaproveitando a mae ja gerada\n');
    mae = await readFile(caminhoMae);
  } else {
    const env = await readFile(join(raiz, '.env'), 'utf8');
    const chave = env.match(/GEMINI_API_KEY\s*=\s*(.+)/)?.[1]?.trim();
    if (!chave) throw new Error('GEMINI_API_KEY ausente no .env');
    console.log(`gerando a imagem-mae em ${modelo}\n`);
    mae = await gerarMae(modelo, chave);
  }

  /**
   * O demo NUNCA escreve por cima da mae paga.
   *
   * Antes o writeFile era um so, no fim dos tres caminhos: uma rodada com
   * --demo trocava burger-mae.png pela composicao local, e o --reuse seguinte
   * reaproveitava essa composicao achando que era a imagem do modelo. O
   * conjunto saia de uma origem que ninguem pediu, sem nenhum aviso.
   */
  await writeFile(args.demo ? join(dirRaw, 'burger-mae-demo.png') : caminhoMae, mae);

  const { buffer: recortada, proporcaoFundo } = await recortarChroma(mae);
  console.log(`fundo removido: ${(proporcaoFundo * 100).toFixed(0)}%`);

  const faixas = await detectarFaixas(recortada, fatias);
  console.log(`faixas detectadas: ${faixas.blocos.length} (canvas ${faixas.largura}x${faixas.altura})`);

  /**
   * Contagem errada REPROVA a execucao — mesma regra que produce-layers.mjs ja
   * aplica ao recorte.
   *
   * Os nomes sao atribuidos por POSICAO: NOMES[i] para o bloco i. Se a deteccao
   * devolver 6 faixas onde deviam existir 7, tudo abaixo da faixa perdida anda
   * uma casa — o queijo publicado como blend, o bacon como pao-inferior. O
   * manifest sai completo, valido e errado, e nada na cena denuncia a troca.
   * Meio conjunto vira colagem; conjunto trocado e pior, porque parece certo.
   */
  if (faixas.blocos.length !== fatias) {
    throw new Error(
      `faixas detectadas: ${faixas.blocos.length}, esperado ${fatias}. Os nomes sairiam ` +
        'deslocados por posicao — manifest NAO escrito. Confira a separacao entre as ' +
        'camadas na imagem-mae antes de repetir.'
    );
  }

  faixas.blocos.forEach((b, i) =>
    console.log(`       ${i + 1}: y ${b.topo}-${b.base}  altura ${b.base - b.topo}`)
  );
  console.log('');

  const camadas = await fatiar(recortada, faixas, NOMES);

  const manifest = {
    _gerado: new Date().toISOString(),
    _origem: args.demo ? 'demo (composicao das camadas antigas)' : modelo,
    _nota:
      'Fatias de uma UNICA imagem-mae. Largura identica em todas; o transbordo ' +
      'lateral ja esta desenhado na mae, entao o CSS nao usa larguraRelativa.',
    camadas,
  };

  await writeFile(join(dirSaida, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`\nmanifest.json escrito com ${camadas.length} camadas.`);
}

main().catch((erro) => {
  console.error(`\nFALHA: ${erro.message}`);
  process.exitCode = 1;
});
