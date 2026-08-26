/**
 * Qual variante da Cena 2 renderiza.
 *
 * A cena existe em duas versões e as duas são código vivo:
 *
 *   'video'   — o take do cliente, com o scroll dirigindo currentTime.
 *   'camadas' — os 7 PNGs animados por GSAP (ExplodeScene.astro).
 *
 * Só uma renderiza por vez, e isso importa por dois motivos: o orçamento de
 * movimento permite no MÁXIMO um pin por página, e cada variante carrega o
 * próprio conjunto de assets. Renderizar as duas dobraria o peso e criaria dois
 * pins concorrentes — o segundo herdaria um trilho medido dentro do espaçamento
 * reservado pelo primeiro, e ninguém ligaria o defeito à causa.
 *
 * Trocar sem editar código:
 *
 *   CENA2=camadas npm run dev
 *   CENA2=camadas npm run build
 *
 * Este módulo é lido SÓ no frontmatter (roda em Node, no build). Não importar de
 * script de cliente: `process` não existe lá.
 */

/** @typedef {'video' | 'camadas'} VarianteCena2 */

const PADRAO = 'video';

/** @type {VarianteCena2} */
export const CENA2 = process.env.CENA2 === 'camadas' ? 'camadas' : PADRAO;
