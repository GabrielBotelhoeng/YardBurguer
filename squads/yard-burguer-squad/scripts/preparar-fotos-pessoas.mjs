#!/usr/bin/env node
/**
 * Prepara as duas fotos de estúdio que ladeiam a seção de diferenciais.
 *
 * O cliente entrega em ~1023x1537 (2:3). Este script só reamostra e comprime —
 * NÃO recorta. A proporção nativa é 2:3 e o CSS do celular usa exatamente essa,
 * então o `object-fit: cover` não tem o que cortar e as pessoas aparecem
 * inteiras. Recortar aqui reintroduziria o defeito que a rodada de 02/09
 * consertou (lata e hambúrguer decepados na borda).
 *
 * TRÊS LARGURAS, porque o `<img>` usa `srcset` com
 * `sizes="(max-width: 900px) 50vw, 30vw"`:
 *   - 420: celular em DPR2
 *   - 620: celular em DPR3 (o aparelho mais comum do público desta página)
 *   - 840: desktop em DPR2
 *
 * QUALIDADE 68 E NÃO 80, e o número saiu do orçamento, não do gosto. A folga da
 * rota é de ~1 kB contra o teto de 1,5 MB, então o par novo precisava caber no
 * peso do par que ele substitui. Medido: q80 daria 103.576 bytes no par de 620
 * contra os 86.806 do material anterior — estouraria. q68 dá 81.330, ou seja,
 * 5,4 kB DEVOLVIDOS ao orçamento. Foto de estúdio com fundo preto liso é o caso
 * em que webp mais rende: quase metade do quadro é uma cor só.
 *
 * Uso: node squads/yard-burguer-squad/scripts/preparar-fotos-pessoas.mjs
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import sharp from 'sharp';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const origem = join(raiz, 'referencia', 'pessoas');
const destino = join(raiz, 'public', 'assets', 'pessoas');

const LARGURAS = [420, 620, 840];
const QUALIDADE = 68;

/**
 * id de saída → arquivo de origem.
 *
 * O LADO DE CADA UMA É DECISÃO DE COMPOSIÇÃO, e está no copy.json. Resumo do
 * porquê: as duas fotos têm direção. Na `placa`, o cartaz fica à direita do
 * homem; na `convite`, a mão estendida aponta para a esquerda dele. Colocando a
 * `placa` na coluna ESQUERDA e a `convite` na DIREITA, os dois gestos apontam
 * para o miolo da seção — para o texto. Invertidas, apontariam para fora da
 * tela, e a composição empurraria o olho para longe da leitura.
 */
const FOTOS = {
  'pessoa-placa': 'placa.png',
  'pessoa-convite': 'convite.png',
};

async function preparar([id, arquivo]) {
  const src = join(origem, arquivo);
  const meta = await sharp(src).metadata();
  const saidas = [];

  for (const largura of LARGURAS) {
    const buffer = await sharp(src)
      .resize({ width: largura, kernel: 'lanczos3' })
      .webp({ quality: QUALIDADE, effort: 6 })
      .toBuffer();
    await writeFile(join(destino, `${id}-${largura}.webp`), buffer);
    saidas.push(`${largura}=${(buffer.length / 1024).toFixed(1)}kb`);
  }

  return { id, origem: `${meta.width}x${meta.height}`, saidas: saidas.join('  ') };
}

async function main() {
  await mkdir(destino, { recursive: true });
  const resultados = await Promise.all(Object.entries(FOTOS).map(preparar));
  for (const r of resultados) {
    console.log(`  ok   ${r.id.padEnd(16)} de ${r.origem}   ${r.saidas}`);
  }
  console.log(`\n${resultados.length} fotos x ${LARGURAS.length} larguras · qualidade ${QUALIDADE}`);
}

main().catch((erro) => {
  console.error(`Falha ao preparar: ${erro.message}`);
  process.exitCode = 1;
});
