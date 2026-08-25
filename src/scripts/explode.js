/**
 * Cena 2 — o burger explodido. Chunk carregado sob demanda por motion.js.
 *
 * Só este arquivo importa GSAP + ScrollTrigger, e é o único lugar da página
 * que justifica esse peso: pin com scrub em 7 camadas não se faz com CSS.
 *
 * Duas fases: as camadas montam o burger ao entrar, depois se separam em
 * parallax conforme o scroll avança. O texto de fundo corre mais devagar que
 * qualquer ingrediente — é isso que cria a profundidade.
 */

import { gsap } from 'gsap/gsap-core';
import { CSSPlugin } from 'gsap/CSSPlugin';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(CSSPlugin, ScrollTrigger);

export function initExplodeScene({ secao, ehMobile }) {
  // Se o Lenis está ativo, o ScrollTrigger precisa ouvir o scroll dele.
  const lenis = window.__yardLenis;
  if (lenis) {
    lenis.on('scroll', ScrollTrigger.update);
  }

  // Mobile roda a versão reduzida do storyboard: 4 camadas.
  const camadas = Array.from(secao.querySelectorAll('.explode__camada')).filter(
    (camada) => !ehMobile || camada.dataset.mobile === 'true'
  );
  if (!camadas.length) return;

  const fundo = secao.querySelector('[data-parallax]');

  // Fase 1 — montagem: cada camada chega de uma direção diferente.
  gsap.from(camadas, {
    scrollTrigger: { trigger: secao, start: 'top 75%', once: true },
    y: (i) => (i % 2 === 0 ? -60 : 60),
    x: (i) => (i % 2 === 0 ? -80 : 80),
    opacity: 0,
    duration: 0.7,
    ease: 'power3.out',
    stagger: 0.08,
  });

  // Fase 2 — separação por scroll, cada camada na sua velocidade.
  const separacao = gsap.timeline({
    scrollTrigger: {
      trigger: secao,
      start: 'top top',
      end: ehMobile ? '+=60%' : '+=100%',
      scrub: 1,
      pin: true,
      anticipatePin: 1,
    },
  });

  camadas.forEach((camada) => {
    const deslocamento = Number(camada.dataset.explodeY ?? 0);
    const velocidade = Number(camada.dataset.speed ?? 1);
    separacao.to(camada, { y: deslocamento * velocidade, ease: 'none' }, 0);
  });

  // Texto de fundo: mais lento que qualquer ingrediente.
  if (fundo) {
    const fator = Number(fundo.dataset.parallax ?? 0.15);
    separacao.to(fundo, { y: -120 * fator, ease: 'none' }, 0);
  }

  ScrollTrigger.refresh();
}
