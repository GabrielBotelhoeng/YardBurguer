#!/usr/bin/env node
/**
 * Reamostra e comprime as duas fotos que ladeiam a seção de diferenciais.
 *
 * A ENTRADA MUDOU DE NATUREZA EM 03/09 E O RACIOCÍNIO DE PESO MORREU JUNTO.
 * Até aqui a entrada era foto de estúdio de FUNDO PRETO, opaca, entregue em
 * ~1023x1537 (2:3) — e o comentário antigo deste arquivo dizia, com razão para
 * aquele material, que "fundo preto liso é o caso em que webp mais rende: quase
 * metade do quadro é uma cor só". Esse par não existe mais. O material novo é
 * RECORTE COM ALPHA em 1020x1224 (5:6), sem fundo nenhum — o quadro inteiro é
 * assunto, e boa parte dele é o xadrez do keffiyeh, que é o pior caso possível
 * para compressão: alta frequência, vermelho saturado, sem área chapada.
 *
 * Medido nos arquivos novos, par de 620w:
 *
 *   qualidade   68        76        80
 *   par 620w    121,4 kB  128,7 kB  142,9 kB
 *
 * Contra os 86,8 kB do par de 620w que este material substitui. Ou seja: na
 * MESMA largura, nenhuma qualidade utilizável cabe no orçamento. Baixar
 * qualidade até caber pediria q≈30, e aí o xadrez vira mingau.
 *
 * A SAÍDA NÃO ERA QUALIDADE, ERA LARGURA — E O `sizes` ESTAVA MENTINDO.
 * O `sizes` antigo declarava `190px` no celular, mas a figura media 133 CSS px
 * num aparelho de 390. Em DPR 2,75 (o Pixel 5 do medidor) isso pedia 522 px de
 * device e o navegador buscava a variante de 620w para desenhar 366. Corrigido
 * o `sizes` para acompanhar a largura de verdade (ver o comentário do `srcset`
 * em index.astro), o celular passa a buscar a variante de 420w — 400 px de
 * device para 400 px de necessidade.
 *
 * QUALIDADE 76, E ELA SUBIU EM VEZ DE CAIR. Com o par certo sendo o de 420w, o
 * orçamento deixou de ser o freio:
 *
 *   qualidade   68        72        76        80        84
 *   par 420w    67,3 kB   69,4 kB   72,4 kB   79,9 kB   88,7 kB
 *
 * 76 é o último degrau antes de o ganho por kB desabar (de 76 para 80 são
 * 7,5 kB por quase nada visível) e devolve 14,4 kB ao orçamento contra o par
 * anterior. Foi conferido a 1:1 no keffiyeh, que é onde o artefato apareceria
 * primeiro.
 *
 * O canal alpha vai LOSSLESS (o padrão do sharp, `alphaQuality: 100`). Medido,
 * alpha lossy devolvia ~12% do peso e sujava o contorno com halo — recorte com
 * borda suja é exatamente o defeito que o script de recorte existe para evitar.
 *
 * SEIS LARGURAS, porque o `<img>` usa `srcset`:
 *   - 420: celular em DPR baixo/médio, largura estreita (o degrau original)
 *   - 480: celular em DPR3 real e largura estreita (iPhone 12 em diante,
 *     390/414 CSS px, ANTES do teto de 44vw). Sob DPR3 o `sizes` de 220px
 *     pede até 660px de device conforme a largura da janela — 480w cobre a
 *     ponta estreita (iPhone em pé, ~390-414 CSS px ⇒ ~430-460px de device).
 *   - 620: celular grande / tablet em DPR baixo, e desktop em DPR1 acima de
 *     1600px.
 *   - 660: celular no TETO de 44vw (a partir de ~591 CSS px de janela a
 *     figura para de crescer e trava em 216,66px — ver `.diferenciais` no
 *     CSS) sob DPR3 real. Faltava este degrau: 216,66 × 3 = 650px de device,
 *     e sem um candidato entre 620 e 840 o `srcset` pulava direto para 840w
 *     (o par custa 196,9 kB) para desenhar uma figura de 217px — pior do que
 *     o defeito que este script existe para evitar. Medido em 844×390 (a
 *     paisagem do próprio celular) sob DPR3: sem este degrau, `currentSrc`
 *     resolvia para a variante de 840w.
 *   - 760 — ADICIONADO em 04/09 quando a figura do celular passou a
 *     acompanhar a largura do CARTÃO (`--pilar-larg`) em vez de travar pela
 *     altura: pedido do dono, "do tamanho do card". A figura quase dobrou
 *     (de ~133 para até 320 CSS px) e o gate de peso mede no Pixel 5
 *     emulado (393 CSS px, DPR 2,75) — ali a figura passou a pedir 393 × 0,78
 *     − ajustes ≈ 269 CSS px × 2,75 ≈ 740px de device. Sem este degrau
 *     entre 660 e 840, o `srcset` pulava para 840w NOS DOIS lados — mesmo
 *     defeito do item anterior, só que maior: +122 kB no par (de 71,5 kB em
 *     420w para 193,5 kB em 840w) contra uma folga de orçamento de ~13,5 kB.
 *     760w é o menor múltiplo de 20 acima dos ~740,5px medidos (com folga de
 *     ~20px), e ainda assim CUSTA MAIS DO QUE A FOLGA TEM — ver o número
 *     exato no commit que introduziu este degrau. Reduz o estouro, não o
 *     zera; zerar pediria desenhar a figura menor do que o cartão, que era
 *     o pedido oposto.
 *   - 840: desktop em DPR2
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

const LARGURAS = [420, 480, 620, 660, 760, 840];
const QUALIDADE = 76;

/**
 * id de saída → arquivo de origem, já recortado por
 * `recortar-fotos-pessoas.mjs`.
 *
 * O LADO DE CADA UMA É DECISÃO DE COMPOSIÇÃO, e está no copy.json
 * (`_gentePosicao`). Resumo do porquê: as duas fotos têm direção. Na `placa`, o
 * cartaz fica à direita do homem; na `coca`, a lata está erguida à esquerda
 * dele. Colocando a `placa` na coluna ESQUERDA e a `coca` na DIREITA, os dois
 * objetos apontam para o miolo da seção — para o texto. Invertidas, apontariam
 * para fora da tela, e a composição empurraria o olho para longe da leitura.
 */
const FOTOS = {
  'pessoa-placa': 'placa.png',
  'pessoa-coca': 'coca.png',
};

async function preparar([id, arquivo]) {
  const src = join(origem, arquivo);
  const meta = await sharp(src).metadata();
  if (!meta.hasAlpha) {
    throw new Error(`${arquivo} veio sem canal alpha — rode recortar-fotos-pessoas.mjs antes`);
  }
  const saidas = [];
  const pesos = {};

  for (const largura of LARGURAS) {
    const buffer = await sharp(src)
      .resize({ width: largura, kernel: 'lanczos3' })
      .webp({ quality: QUALIDADE, effort: 6 })
      .toBuffer();
    await writeFile(join(destino, `${id}-${largura}.webp`), buffer);
    saidas.push(`${largura}=${(buffer.length / 1024).toFixed(1)}kb`);
    pesos[largura] = buffer.length;
  }

  return { id, origem: `${meta.width}x${meta.height}`, saidas: saidas.join('  '), pesos };
}

async function main() {
  await mkdir(destino, { recursive: true });
  const resultados = [];
  for (const entrada of Object.entries(FOTOS)) resultados.push(await preparar(entrada));
  for (const r of resultados) {
    console.log(`  ok   ${r.id.padEnd(14)} de ${r.origem}   ${r.saidas}`);
  }
  const par = (largura) =>
    resultados.reduce((s, r) => s + r.pesos[largura], 0) / 1024;
  console.log(`\n${resultados.length} fotos x ${LARGURAS.length} larguras · qualidade ${QUALIDADE}`);
  console.log(
    `par de 420w: ${par(420).toFixed(1)} kB · par de 480w (DPR3, largura estreita): ${par(480).toFixed(1)} kB · ` +
    `par de 620w: ${par(620).toFixed(1)} kB · par de 660w (DPR3, teto de 44vw): ${par(660).toFixed(1)} kB · ` +
    `par de 760w (Pixel 5, figura do tamanho do card): ${par(760).toFixed(1)} kB · ` +
    `par de 840w: ${par(840).toFixed(1)} kB`,
  );
}

main().catch((erro) => {
  console.error(`Falha ao preparar: ${erro.message}`);
  process.exitCode = 1;
});
