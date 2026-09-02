#!/usr/bin/env node
/**
 * Recorta o material próprio do cliente para os cards do carrossel.
 *
 * As fotos entregues em 31/08 vêm em retrato (~1023x1537 ou 1086x1448) e o card
 * é 4/5. O corte é decisão de composição, não do `object-fit`: cada `top` aqui
 * foi escolhido olhando a foto, para o hambúrguer ficar centrado no quadro sem
 * o `cover` ter mais nada a tirar.
 *
 * 800x1000 E NÃO 640x800, desde 2026-09-02. Medido: o card chega a 318px de
 * largura num iPhone Pro Max, que em DPR3 pede 954px físicos — com fonte de 640
 * isso era ampliação de 1,49x, e aparecia como suavização nas bordas do pão.
 * Com 800 a ampliação cai para 1,19x. A qualidade desce de 76 para 58 no mesmo
 * movimento: mais pixels com menos qualidade lê melhor que menos pixels com
 * mais, e o custo fica em ~+9 kB por foto em vez de ~+20 kB.
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

const LARGURA = 800;
const ALTURA = 1000;
const QUALIDADE = 58;

/** id do cardápio → [arquivo de origem, deslocamento vertical do corte]. */
const RECORTES = {
  'tapera-do-sertao': ['ChatGPT Image 31 de ago. de 2026, 14_51_11.png', 258],
  supremo: ['ChatGPT Image 31 de ago. de 2026, 14_51_33.png', 218],
  'yard-king': ['ChatGPT Image 31 de ago. de 2026, 15_01_47.png', 90],
  'open-crysp': ['ChatGPT Image 31 de ago. de 2026, 14_51_28.png', 258],
};

async function recortar([id, [arquivo, topPedido]]) {
  const src = join(origem, arquivo);
  const meta = await sharp(src).metadata();

  // A altura do corte sai da largura da foto, para o quadro nascer em 4/5.
  const alturaCorte = Math.round((meta.width * 5) / 4);
  // `top` nunca pode passar do que a foto tem — se passar, encosta no fundo.
  const top = Math.max(0, Math.min(topPedido, meta.height - alturaCorte));

  const buffer = await sharp(src)
    .extract({ left: 0, top, width: meta.width, height: alturaCorte })
    .resize(LARGURA, ALTURA, { kernel: 'lanczos3' })
    .webp({ quality: QUALIDADE, effort: 6 })
    .toBuffer();

  await writeFile(join(destino, `${id}.webp`), buffer);
  return { id, kb: +(buffer.length / 1024).toFixed(1), corte: `${meta.width}x${alturaCorte}+0+${top}` };
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
