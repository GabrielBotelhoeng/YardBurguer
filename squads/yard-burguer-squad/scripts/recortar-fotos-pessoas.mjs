#!/usr/bin/env node
/**
 * Devolve o canal alpha às fotos dos rapazes e alinha as duas PELO CONTEÚDO —
 * mesma altura de cabeça, mesmo eixo, mesmo quadro.
 *
 * POR QUE ESTE SCRIPT PASSOU A EXISTIR (03/09). O material anterior era estúdio
 * de fundo PRETO, e o CSS da seção `.diferenciais` foi construído em cima disso:
 * o preto do estúdio é o mesmo carvão da marca, então a foto entrava inteira,
 * sem recorte, aquecida por `filter: sepia()` e dissolvida no areia por
 * `mask-image`. O material novo é o oposto — já vem recortado, mas achatado
 * sobre CINZA CLARO. Medido nos dois arquivos: os quatro cantos e a mediana das
 * bordas em `rgb(247,247,247)`, canal alpha inexistente (jpeg, 3 canais). Ou
 * seja: era PNG com alpha e o WhatsApp achatou.
 *
 * Sobre fundo claro, `sepia` + `mask-image` não dissolvem nada — desenham um
 * retângulo cinza-bege chapado sobre o areia da seção. O tratamento tinha de
 * virar recorte de verdade.
 *
 * POR QUE FLOOD FILL A PARTIR DAS BORDAS, E NÃO LIMIAR DE LUMINÂNCIA. Os dois
 * rapazes vestem thobe BRANCO, e o branco da roupa chega a 254–255 de
 * luminância nos vincos — um limiar global que apagasse o fundo de 247 comeria a
 * roupa junto. É o espelho exato do problema que impedia recortar o par antigo
 * (manto preto sobre fundo preto). Flood fill não olha só a cor: olha a cor E a
 * conexão com a borda do quadro, e a roupa não está conectada ao fundo.
 *
 * ── A ARMADILHA DO FLOOD ÚNICO, E COMO ELA FOI MEDIDA ────────────────────────
 *
 * A primeira versão deste script propagava o flood por qualquer pixel com
 * `dist < 22` e dava alpha proporcional a todos eles. Parecia certo no contorno
 * e estava errado por dentro: medido no mapa de alpha, a `coca` saiu com 8,00%
 * do quadro em MEIA transparência contra 1,38% da `placa`. Diferença grande
 * demais para ser antialias de contorno — e não era. Classificando cada pixel
 * parcial por vizinhança (tem algum alpha 0 numa janela 5x5?), 96.242 dos
 * 125.897 pixels parciais da `coca` estavam LONGE de qualquer transparência,
 * isto é, no MIOLO da figura.
 *
 * O mapa mostrou onde: o keffiyeh. O xadrez é branco-e-vermelho, e os quadrados
 * brancos batem em 240–250 — dentro da janela de propagação. O flood entrava
 * pelos vãos entre as franjas, alcançava o branco do tecido e escorria por todo
 * o pano do ombro e do peito. O resultado seria um véu: metade do keffiyeh
 * translúcida deixando o areia da seção passar por dentro da roupa, e ainda
 * cobrando bytes de gradiente ao webp.
 *
 * A CORREÇÃO É SEPARAR AS DUAS PERGUNTAS. "Isto é fundo?" e "isto é a borda
 * suave do assunto?" não têm a mesma resposta e não podem usar a mesma
 * tolerância:
 *
 *   1. FLOOD ESTRITO (`dist <= 6`) — o fundo de verdade. Nessa tolerância o
 *      branco do keffiyeh (240–250, dist 3–15) já não é caminho: a propagação
 *      morre no vão da franja em vez de entrar no tecido.
 *   2. BANDA DE CONTORNO — só os pixels a até 3 px do fundo estrito recebem a
 *      rampa de alpha. A queda do fundo (247) para o tecido acontece em 1–2 px
 *      (medido varrendo linhas horizontais nas duas fotos), então 3 px cobre o
 *      antialias inteiro com folga e não alcança miolo nenhum.
 *
 * Dentro da banda, `dist` decide o alpha:
 *
 *   dist <= 6    → fundo puro          (alpha 0)
 *   6 < dist < 22 → borda misturada    (alpha proporcional — é o antialias)
 *   dist >= 22   → assunto             (alpha 255)
 *
 * `dist` é a maior diferença por canal contra `rgb(247,247,247)`. A rampa não é
 * um blur: ela LÊ a mistura que o achatamento já gravou no pixel, então a borda
 * sai com a suavidade original em vez de uma serrilha borrada por cima.
 *
 * Medido depois da correção: alpha parcial caiu de 8,00% para 0,35% na `coca` e
 * de 1,38% para 0,31% na `placa`. Os dois números agora são o que o contorno de
 * uma silhueta desse tamanho custa — e são quase iguais, que é o sinal de que
 * sobrou contorno e nada mais.
 *
 * ── ALINHAMENTO PELA CABEÇA, NÃO PELA MOLDURA ────────────────────────────────
 *
 * As duas fotos chegaram com proporções e ENQUADRAMENTOS diferentes: a `placa`
 * é 1024x1536 (2:3) e vai do alto da cabeça até a coxa; a `coca` é 1147x1372
 * (~5:6) e para no quadril. Medido, o assunto ocupa quase o quadro inteiro nas
 * duas (bbox 1022x1533 e 1122x1372) — o cliente já entregou apertado.
 *
 * Encaixar as duas por `contain` num quadro comum, como a primeira versão fazia,
 * alinha as MOLDURAS e desalinha as PESSOAS: a `coca`, mais larga em proporção
 * por causa do braço erguido, encaixava pela largura e o rapaz saía menor e mais
 * baixo que o da `placa`. Lado a lado na seção isso lê como foto errada.
 *
 * O alinhamento certo é por conteúdo, e a régua é a CABEÇA — a única medida que
 * as duas fotos compartilham e que o olho confere sozinho. Medido na régua de
 * 10 px sobre cada original (ver `alturaCabeca` abaixo): topo do agal ao queixo
 * dá 330 px na `placa` e 370 px na `coca`. A `coca` foi shot mais perto.
 *
 * Daí sai tudo, sem nenhum número arbitrário:
 *
 *   · o corpo visível de cada um, medido EM CABEÇAS: 4,65 na `placa`, 3,71 na
 *     `coca`;
 *   · a `placa` é cortada por baixo até as mesmas 3,71 cabeças — 309 px de
 *     thobe liso que não têm produto, gesto nem borda de placa (o cartaz acaba
 *     em y≈866, o corte cai em y≈1227);
 *   · as duas escalam para a mesma altura de saída, o que iguala a cabeça por
 *     construção, e ancoram no PÉ, como o par antigo ancorava.
 *
 * ── E É ISSO QUE DEFINE O QUADRO DE SAÍDA EM 5:6 ─────────────────────────────
 *
 * Depois de igualar as cabeças, o conteúdo das duas mede 1022x1224 e 1122x1372
 * — razões 0,835 e 0,818. O quadro que serve às duas sem cortar nem sobrar é
 * ~5:6, e não é coincidência: é a proporção nativa da `coca`, a foto que já
 * vinha no enquadramento mais apertado. 2:3 (0,667) era a proporção da `placa`
 * sozinha; mantê-lo agora custaria 20% do quadro em transparência morta no topo
 * das DUAS, e no celular — onde a caixa tem a proporção do arquivo — isso vira
 * pessoa 16% menor por nada.
 *
 * Trocar 2:3 por 5:6 obriga a mexer em quatro lugares do CSS que citam a
 * proporção (`width`/`height` do `<img>`, degraus de `sizes`, `aspect-ratio` do
 * par no celular e o termo de proporção de `--gente-larg-desejada`). Está feito
 * e comentado lá.
 *
 * Uso: node squads/yard-burguer-squad/scripts/recortar-fotos-pessoas.mjs
 */

import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import sharp from 'sharp';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const origem = join(raiz, 'referencia', 'fotos');
const destino = join(raiz, 'referencia', 'pessoas');

/** A cor do fundo achatado, medida nos quatro cantos das duas fotos. */
const FUNDO = [247, 247, 247];
/** Abaixo disto é fundo puro — e é a ÚNICA tolerância que o flood propaga. */
const TOL_FUNDO = 6;
/** Acima disto é assunto. Entre os dois, é a borda misturada (o antialias). */
const TOL_ASSUNTO = 22;
/**
 * Alcance da banda de contorno, em pixels a partir do fundo estrito. A queda de
 * 247 para o tecido acontece em 1–2 px; 3 px cobre isso com folga e é curto o
 * bastante para nunca alcançar o miolo do keffiyeh. Ver o cabeçalho.
 */
const RAIO_BANDA = 3;
/**
 * Raio da erosão que decide a CAIXA DO ASSUNTO (não o alpha de saída).
 *
 * O jpeg deixa blocos de fundo levemente fora de 247 espalhados pela borda do
 * quadro — filetes de 1 a 3 px que a banda não alcança e que ficam opacos. Sem
 * isto eles esticam a caixa até os cantos do arquivo e o encaixe sai errado.
 * A caixa é medida sobre a máscara EROADA (só sobrevive quem tem 3 px de
 * opacidade em volta, ou seja, corpo de verdade) e depois devolvida com o mesmo
 * raio. O alpha entregue não é eroado — a erosão só serve de régua.
 */
const EROSAO = 3;

/**
 * O QUADRO COMUM DE SAÍDA — 5:6, tirado do conteúdo, não escolhido.
 * 1020x1224 fecha 5:6 exato e divide certo nas três larguras servidas
 * (420x504, 620x744, 840x1008).
 */
const QUADRO = { largura: 1020, altura: 1224 };

/**
 * id de saída → arquivo entregue pelo cliente, mais a régua de escala.
 *
 * `alturaCabeca` é a distância em pixels DE ORIGEM entre o topo do agal (a
 * corda preta) e a ponta do queixo, medida à mão sobre um render da foto com
 * linhas horizontais a cada 10 px (`.tmp-cabeca-*.png`, descartado). É a única
 * constante deste script que não sai de medição automática, e é assim de
 * propósito: nenhum detector de cor separa cabeça de keffiyeh nessas duas
 * fotos, e a pose difere — o da `coca` está com o queixo erguido, então largura
 * de agal e linha dos olhos mentem sobre escala. Topo-do-agal a queixo é o par
 * de pontos que sobrevive à diferença de pose.
 *
 * Conferido depois no render de prova: com estes dois números as duas cabeças
 * saem do mesmo tamanho lado a lado.
 *
 * O LADO DE CADA UMA É DECISÃO DE COMPOSIÇÃO — está no `_gentePosicao` do
 * copy.json e foi confirmado pelo cliente nesta entrega. Resumo: na `placa` o
 * cartaz fica à direita do homem; na `coca` a lata está erguida à esquerda
 * dele. Com a `placa` à ESQUERDA e a `coca` à DIREITA, os dois objetos apontam
 * para o miolo da seção. Invertidas, apontariam para fora da tela.
 */
const FOTOS = {
  placa: { arquivo: 'WhatsApp Image 2026-09-03 at 09.26.30.jpeg', alturaCabeca: 330 },
  coca: { arquivo: 'WhatsApp Image 2026-09-03 at 09.31.19.jpeg', alturaCabeca: 370 },
};

const dist = (d, i) =>
  Math.max(Math.abs(d[i] - FUNDO[0]), Math.abs(d[i + 1] - FUNDO[1]), Math.abs(d[i + 2] - FUNDO[2]));

/**
 * Marca como fundo todo pixel PRATICAMENTE IGUAL ao fundo e alcançável a partir
 * da borda do quadro.
 *
 * Busca em largura com pilha explícita (recursão estoura em 1,5 milhão de
 * pixels) e vizinhança de 4 — vizinhança de 8 atravessa diagonais de um pixel e
 * é justamente por onde um recorte vaza para dentro da roupa.
 */
function flood(data, W, H, C) {
  const fundo = new Uint8Array(W * H);
  const pilha = [];

  const semear = (x, y) => {
    const p = y * W + x;
    if (fundo[p]) return;
    if (dist(data, p * C) > TOL_FUNDO) return;
    fundo[p] = 1;
    pilha.push(p);
  };

  for (let x = 0; x < W; x++) { semear(x, 0); semear(x, H - 1); }
  for (let y = 0; y < H; y++) { semear(0, y); semear(W - 1, y); }

  while (pilha.length) {
    const p = pilha.pop();
    const x = p % W;
    const y = (p - x) / W;
    if (x > 0) semear(x - 1, y);
    if (x < W - 1) semear(x + 1, y);
    if (y > 0) semear(x, y - 1);
    if (y < H - 1) semear(x, y + 1);
  }

  return fundo;
}

/** Alpha de saída: 0 no fundo, rampa na banda de contorno, 255 no resto. */
function montarAlpha(data, fundo, W, H, C) {
  const banda = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!fundo[y * W + x]) continue;
      for (let dy = -RAIO_BANDA; dy <= RAIO_BANDA; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= H) continue;
        for (let dx = -RAIO_BANDA; dx <= RAIO_BANDA; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= W) continue;
          banda[yy * W + xx] = 1;
        }
      }
    }
  }

  const alpha = Buffer.alloc(W * H, 255);
  let parciais = 0;
  for (let p = 0; p < W * H; p++) {
    if (fundo[p]) { alpha[p] = 0; continue; }
    if (!banda[p]) continue;
    const d = dist(data, p * C);
    if (d >= TOL_ASSUNTO) continue;
    alpha[p] = Math.max(0, Math.round(((d - TOL_FUNDO) / (TOL_ASSUNTO - TOL_FUNDO)) * 255));
    if (alpha[p] > 0 && alpha[p] < 255) parciais++;
  }
  return { alpha, parciais };
}

/**
 * A caixa do assunto, medida sobre a máscara eroada e depois devolvida com o
 * mesmo raio — ver o comentário de `EROSAO`.
 */
function caixaDoAssunto(alpha, W, H) {
  const solido = new Uint8Array(W * H);
  for (let y = EROSAO; y < H - EROSAO; y++) {
    for (let x = EROSAO; x < W - EROSAO; x++) {
      if (alpha[y * W + x] < 128) continue;
      let ok = 1;
      for (let dy = -EROSAO; dy <= EROSAO && ok; dy++) {
        for (let dx = -EROSAO; dx <= EROSAO; dx++) {
          if (alpha[(y + dy) * W + x + dx] < 128) { ok = 0; break; }
        }
      }
      solido[y * W + x] = ok;
    }
  }

  // O maior componente conexo do sólido é a pessoa; o resto é sujeira de jpeg.
  const visto = new Int32Array(W * H).fill(-1);
  let melhor = -1, melhorN = 0, comp = 0;
  for (let s = 0; s < W * H; s++) {
    if (!solido[s] || visto[s] >= 0) continue;
    let n = 0;
    const pilha = [s];
    visto[s] = comp;
    while (pilha.length) {
      const p = pilha.pop();
      n++;
      const x = p % W;
      const y = (p - x) / W;
      const viz = [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, y > 0 ? p - W : -1, y < H - 1 ? p + W : -1];
      for (const q of viz) if (q >= 0 && visto[q] < 0 && solido[q]) { visto[q] = comp; pilha.push(q); }
    }
    if (n > melhorN) { melhorN = n; melhor = comp; }
    comp++;
  }

  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let p = 0; p < W * H; p++) {
    if (visto[p] !== melhor) continue;
    const x = p % W;
    const y = (p - x) / W;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  return {
    x0: Math.max(0, x0 - EROSAO),
    y0: Math.max(0, y0 - EROSAO),
    x1: Math.min(W - 1, x1 + EROSAO),
    y1: Math.min(H - 1, y1 + EROSAO),
  };
}

async function medir(id) {
  const { arquivo, alturaCabeca } = FOTOS[id];
  const { data, info } = await sharp(join(origem, arquivo)).raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;

  const fundo = flood(data, W, H, C);
  const { alpha, parciais } = montarAlpha(data, fundo, W, H, C);
  const caixa = caixaDoAssunto(alpha, W, H);

  // O RGB entra sem alteração; só o quarto canal é novo.
  const rgb = Buffer.alloc(W * H * 3);
  for (let p = 0; p < W * H; p++) {
    const i = p * C;
    rgb[p * 3] = data[i];
    rgb[p * 3 + 1] = data[i + 1];
    rgb[p * 3 + 2] = data[i + 2];
  }

  const alturaAssunto = caixa.y1 - caixa.y0 + 1;
  return {
    id, W, H, C, rgb, alpha, caixa, alturaCabeca, parciais,
    larguraAssunto: caixa.x1 - caixa.x0 + 1,
    alturaAssunto,
    /** O corpo visível medido EM CABEÇAS — a régua comum às duas fotos. */
    cabecas: alturaAssunto / alturaCabeca,
  };
}

async function escrever(m, cabecasComuns) {
  const { W, H, rgb, alpha, caixa } = m;

  // 1. Corta por baixo até o comprimento comum de corpo, em cabeças.
  const alturaCorte = Math.min(m.alturaAssunto, Math.round(cabecasComuns * m.alturaCabeca));
  const largura = m.larguraAssunto;

  /**
   * O RECORTE É FEITO NO BUFFER, À MÃO, E ISSO NÃO É PREFERÊNCIA — É DEFEITO
   * CONHECIDO DO PIPELINE.
   *
   * `sharp(raw).joinChannel(alphaRaw).extract(...)` IGNORA o extract em
   * silêncio: medido com um padrão de teste, a saída volta com os 1024x1536
   * inteiros e nenhum erro. O `resize` seguinte, com `fit: cover` (o padrão),
   * então reenquadrava a foto toda em vez de escalar o recorte — era daí que
   * vinha a `coca` menor e mais baixa que a `placa`, e o topo da cabeça comido
   * na `placa`. Montar o RGBA aqui, quatro canais interleaved já cortados,
   * tira o sharp da decisão.
   */
  const cortado = Buffer.alloc(largura * alturaCorte * 4);
  for (let y = 0; y < alturaCorte; y++) {
    for (let x = 0; x < largura; x++) {
      const o = (y * largura + x) * 4;
      const p = (caixa.y0 + y) * W + (caixa.x0 + x);
      cortado[o] = rgb[p * 3];
      cortado[o + 1] = rgb[p * 3 + 1];
      cortado[o + 2] = rgb[p * 3 + 2];
      cortado[o + 3] = alpha[p];
    }
  }

  // 2. Escala para o quadro. A altura manda (é ela que iguala as cabeças); a
  //    largura só entra como trava de segurança para nunca cortar mão, lata ou
  //    placa. Medido, ela sobra por 0,2% na `placa` e por 2% na `coca`.
  const escala = Math.min(QUADRO.altura / alturaCorte, QUADRO.largura / largura);
  const destLarg = Math.round(largura * escala);
  const destAlt = Math.round(alturaCorte * escala);
  const esquerda = Math.round((QUADRO.largura - destLarg) / 2);
  const topo = QUADRO.altura - destAlt;

  const redimensionado = await sharp(cortado, {
    raw: { width: largura, height: alturaCorte, channels: 4 },
  })
    .resize(destLarg, destAlt, { kernel: 'lanczos3' })
    .png()
    .toBuffer();

  const saida = await sharp({
    create: {
      width: QUADRO.largura,
      height: QUADRO.altura,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: redimensionado, left: esquerda, top: topo }])
    .png({ compressionLevel: 9 })
    .toBuffer();

  await writeFile(join(destino, `${m.id}.png`), saida);

  return {
    id: m.id,
    fonte: `${W}x${H}`,
    assunto: `${largura}x${m.alturaAssunto}`,
    cabeca: `${m.alturaCabeca}px = ${m.cabecas.toFixed(2)} cabeças`,
    corte: `${largura}x${alturaCorte}`,
    cabecaSaida: Math.round(m.alturaCabeca * escala),
    encaixe: `${destLarg}x${destAlt} em +${esquerda}+${topo}`,
    parcial: `${((m.parciais / (W * H)) * 100).toFixed(2)}%`,
    peso: `${(saida.length / 1024).toFixed(0)}kb`,
  };
}

async function main() {
  const medidas = [];
  for (const id of Object.keys(FOTOS)) medidas.push(await medir(id));

  // O comprimento comum de corpo é o do enquadramento MAIS APERTADO — o outro
  // é cortado até ele. Esticar o apertado inventaria corpo que não existe.
  const cabecasComuns = Math.min(...medidas.map((m) => m.cabecas));

  for (const m of medidas) {
    const r = await escrever(m, cabecasComuns);
    console.log(
      `  ok   ${r.id.padEnd(6)} fonte ${r.fonte.padEnd(10)} assunto ${r.assunto.padEnd(10)}` +
      ` ${r.cabeca.padEnd(22)} corte ${r.corte.padEnd(10)} cabeça saída ${String(r.cabecaSaida).padEnd(4)}` +
      ` alpha parcial ${r.parcial.padEnd(6)} ${r.peso}`,
    );
  }
  console.log(
    `\nquadro comum ${QUADRO.largura}x${QUADRO.altura} (5:6) · corpo comum ` +
    `${cabecasComuns.toFixed(2)} cabeças · alpha por flood estrito + banda de ${RAIO_BANDA}px`,
  );
}

main().catch((erro) => {
  console.error(`Falha ao recortar: ${erro.message}`);
  process.exitCode = 1;
});
