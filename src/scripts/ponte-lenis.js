/**
 * Ponte Lenis ↔ ticker do GSAP — o único relógio.
 *
 * Extraído de explode.js quando a Cena 2 ganhou uma segunda variante
 * (video-scrub.js). A ponte não podia existir em dois arquivos: ela implementa
 * um princípio que não admite divergência — Lenis e GSAP não podem rodar dois
 * rAF sobre o mesmo scroll. Dois laços independentes empurrando a mesma posição
 * saem de fase a cada quadro, e é exatamente assim que scrub vira tremida.
 *
 * Quem chama isto é sempre um chunk que já importou e registrou o ScrollTrigger.
 * Por isso o ScrollTrigger entra por parâmetro em vez de import: o módulo não
 * decide o peso de ninguém, só liga os fios.
 *
 * Idempotente: chamada duas vezes não empilha dois tickers. Hoje só uma variante
 * da cena renderiza por vez, mas a garantia é barata e o defeito seria invisível.
 */

let jaLigada = false;

export async function ligarPonteLenis(ScrollTrigger, gsap) {
  if (jaLigada) return window.__yardLenis ?? null;

  // O Lenis carrega de forma assíncrona e a ordem entre os chunks não é
  // garantida — por isso motion.js publica a PROMESSA, não o valor.
  const lenis = await (window.__yardLenisPronto ?? Promise.resolve(window.__yardLenis ?? null));
  if (!lenis) return null;

  jaLigada = true;

  // O loop provisório de motion.js morre aqui: a partir de agora quem avança o
  // Lenis é o ticker do GSAP.
  window.__yardPararLoopLenis?.();
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((tempo) => lenis.raf(tempo * 1000));

  // lagSmoothing existe para animação baseada em TEMPO. Em animação dirigida por
  // scroll ela inventa um salto de posição depois de qualquer engasgo da thread.
  gsap.ticker.lagSmoothing(0);

  return lenis;
}
