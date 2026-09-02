#!/usr/bin/env node
/**
 * Recorta o material próprio do cliente para os cards do carrossel.
 *
 * As fotos entregues em 31/08 vêm em retrato (~1023x1537 ou 1086x1448) e o card
 * é 4/5. O corte é decisão de composição, não do `object-fit`: cada `top` aqui
 * foi escolhido olhando a foto, para o hambúrguer ficar centrado no quadro sem
 * o `cover` ter mais nada a tirar.
 *
 * 760x950 E NÃO 640x800, desde 2026-09-02. Medido: o card chega a 318px de
 * largura num iPhone Pro Max, que em DPR3 pede 954px físicos — com fonte de 640
 * isso era ampliação de 1,49x, e aparecia como suavização nas bordas do pão.
 * Com 760 a ampliação cai para 1,13x no card central. A qualidade desce de 76
 * para 58 no mesmo movimento: mais pixels com menos qualidade lê melhor que
 * menos pixels com mais, e o custo fica em ~+9 kB por foto em vez de ~+20 kB.
 *
 * O NÚMERO É 760 E NÃO 800 POR CAUSA DO ORÇAMENTO, não da tela. O take vertical
 * nativo do hero entrou no mesmo dia custando 48 kB contra os 23,8 kB do
 * recorte que ele substituiu, e os ~24 kB da diferença saíram daqui. Trocar
 * 1,07x por 1,13x nos cards para trocar 2,7x por 1,46x no hero é o melhor uso
 * desses bytes: no hero a ampliação era visível, aqui não.
 *
 * Estas NÃO ganham versão AVIF. Medido nas mesmas imagens: avif ficou em 101%
 * a 104% do webp, porque são fotos grandes e detalhadas. O AVIF só ganha nas
 * reamostragens de 240px do CDN — ver `fetch-menu-images.mjs`.
 *
 * Uso: node squads/yard-burguer-squad/scripts/recortar-fotos-cliente.mjs
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import sharp from 'sharp';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const origem = join(raiz, 'referencia', 'hambugueres');
const destino = join(raiz, 'public', 'assets', 'produtos');

const LARGURA = 760;
const ALTURA = 950;
const QUALIDADE = 58;

/**
 * id do cardápio → recorte.
 *
 * `top` é o deslocamento vertical. `left` e `largura` são opcionais: sem eles a
 * janela usa a foto inteira na horizontal, que é o caso da maioria.
 *
 * O SUPREMO PRECISOU DE JANELA FECHADA, e o motivo é a foto, não o código. Ela
 * é um take de bastidor: mão de luva preta segurando o pão, bancada e coifa de
 * aço inox ao fundo. Com a largura inteira, o cinza frio do aço tomava metade
 * do card e brigava com a paleta da casa — carvão, terracota e brasa — enquanto
 * o hambúrguer ficava pequeno no meio. Fechando em 680px de largura a partir de
 * x=190, o aço sai de quadro, a madeira quente da tábua vira o fundo, o produto
 * cresce e a luva deixa de ser o assunto para virar um detalhe de cozinha.
 *
 * Isto é enquadramento, não conserto: a foto continua sendo a que é. Trocá-la
 * por uma de produto depende do cliente.
 */
const RECORTES = {
  'tapera-do-sertao': { arquivo: 'ChatGPT Image 31 de ago. de 2026, 14_51_11.png', top: 258 },
  supremo: {
    arquivo: 'ChatGPT Image 31 de ago. de 2026, 14_51_33.png',
    top: 620,
    left: 190,
    largura: 680,
  },
  'yard-king': { arquivo: 'ChatGPT Image 31 de ago. de 2026, 15_01_47.png', top: 90 },
  'open-crysp': { arquivo: 'ChatGPT Image 31 de ago. de 2026, 14_51_28.png', top: 258 },
};

async function recortar([id, recorte]) {
  const src = join(origem, recorte.arquivo);
  const meta = await sharp(src).metadata();

  // Sem `largura` declarada, a janela usa a foto inteira na horizontal.
  const largura = Math.min(recorte.largura ?? meta.width, meta.width);
  // A altura do corte sai da largura da JANELA, para o quadro nascer em 4/5.
  const alturaCorte = Math.round((largura * 5) / 4);
  // Nem `top` nem `left` podem passar do que a foto tem — se passarem, encostam
  // na borda. Sem isto, mexer num número aqui quebra com erro do sharp em vez
  // de degradar para o corte possível.
  const top = Math.max(0, Math.min(recorte.top, meta.height - alturaCorte));
  const left = Math.max(0, Math.min(recorte.left ?? 0, meta.width - largura));

  const buffer = await sharp(src)
    .extract({ left, top, width: largura, height: alturaCorte })
    .resize(LARGURA, ALTURA, { kernel: 'lanczos3' })
    .webp({ quality: QUALIDADE, effort: 6 })
    .toBuffer();

  await writeFile(join(destino, `${id}.webp`), buffer);
  return { id, kb: +(buffer.length / 1024).toFixed(1), corte: `${largura}x${alturaCorte}+${left}+${top}` };
}

async function main() {
  await mkdir(destino, { recursive: true });
  const resultados = await Promise.all(Object.entries(RECORTES).map(recortar));

  let total = 0;
  for (const r of resultados) {
    total += r.kb;
    console.log(`  ok   ${r.id.padEnd(20)} ${r.kb} kb   corte ${r.corte}`);
  }
  console.log(`\n${resultados.length} fotos · ${total.toFixed(1)} kb · ${LARGURA}x${ALTURA} q${QUALIDADE}`);
}

main().catch((erro) => {
  console.error(`Falha ao recortar: ${erro.message}`);
  process.exitCode = 1;
});
