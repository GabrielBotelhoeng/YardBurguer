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

export async function initExplodeScene({ secao, ehMobile }) {
  /**
   * Handoff do Lenis para o ticker do GSAP.
   *
   * Antes daqui o Lenis roda no próprio requestAnimationFrame. A partir do
   * momento em que o GSAP existe, ele passa a ser o único relógio: o loop
   * provisório é cancelado e o Lenis é avançado pelo ticker. Manter os dois
   * significaria dois rAF independentes empurrando o mesmo scroll, saindo de
   * fase a cada quadro — é assim que scrub vira tremida.
   *
   * lagSmoothing(0) desliga a compensação de travada do GSAP. Ela existe para
   * animação baseada em tempo; em animação dirigida por scroll ela inventa um
   * salto de posição depois de qualquer engasgo da thread.
   */
  const lenis = await (window.__yardLenisPronto ?? Promise.resolve(window.__yardLenis ?? null));

  if (lenis) {
    window.__yardPararLoopLenis?.();
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((tempo) => lenis.raf(tempo * 1000));
    gsap.ticker.lagSmoothing(0);
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

  /**
   * Fase 2 — separação por scroll.
   *
   * Distância maior que a original (era +=100% no desktop). A cena tem sete
   * camadas percorrendo até 300px cada; em uma tela de rolagem a separação
   * acontecia rápido demais e o movimento lia como solavanco. Esticar o trilho
   * não muda o quanto as camadas andam — muda quanto scroll é preciso para
   * chegar lá, e é isso que faz a cena parecer suave.
   */
  const separacao = gsap.timeline({
    scrollTrigger: {
      trigger: secao,
      start: 'top top',
      end: ehMobile ? '+=110%' : '+=180%',
      scrub: 1,
      pin: true,
      anticipatePin: 1,
      // Os deslocamentos são px fixos, mas a altura da cena e o ponto de pin
      // mudam com o viewport. Sem invalidar, girar o celular deixa o trilho
      // calculado para a orientação antiga.
      invalidateOnRefresh: true,
    },
  });

  /**
   * As camadas não partem juntas: cada uma entra um pouco depois da anterior,
   * de fora para dentro. A abertura simultânea parece um zoom; escalonada,
   * parece o hambúrguer se desmontando. O atraso é pequeno de propósito — o
   * suficiente para criar ritmo, não para virar espera.
   *
   * explodeY já é o deslocamento final em px. O antigo `speed` multiplicava
   * esse valor e mascarava o resultado real no código.
   */
  const centro = (camadas.length - 1) / 2;

  camadas.forEach((camada, i) => {
    const deslocamento = Number(camada.dataset.explodeY ?? 0);
    const distanciaDoCentro = Math.abs(i - centro) / centro;
    const atraso = (1 - distanciaDoCentro) * 0.12;

    separacao.to(camada, { y: deslocamento, ease: 'none', duration: 1 }, atraso);
  });

  /**
   * O texto sai de cena quando a separação começa.
   *
   * O título fica no topo da cena pinada e o pão de cima sobe em direção a ele
   * — por z-index o texto vence e continua legível, mas fica cruzado por cima
   * do pão, o que é feio. Em vez de encurtar a explosão para caber, o texto
   * cede o lugar: ele já foi lido quando o burger começa a abrir, e a partir
   * daí a cena é sobre a imagem.
   *
   * Some no primeiro terço e volta ao rolar de volta, porque o scrub é
   * reversível. Sob prefers-reduced-motion nada disso roda e o texto fica.
   */
  const conteudo = secao.querySelector('.explode__conteudo');
  if (conteudo) {
    separacao.to(conteudo, { opacity: 0, y: -40, ease: 'none', duration: 0.35 }, 0);
  }

  // Texto de fundo: mais lento que qualquer ingrediente. É a diferença de
  // velocidade contra as camadas que cria a profundidade.
  if (fundo) {
    const fator = Number(fundo.dataset.parallax ?? 0.15);
    separacao.to(fundo, { y: -220 * fator, ease: 'none', duration: 1 }, 0);
  }

  ScrollTrigger.refresh();

  /**
   * Segundo refresh depois que as camadas terminam de carregar.
   *
   * As sete imagens são lazy e podem chegar depois deste ponto. Os atributos
   * width/height já reservam o espaço, então não há salto de layout — mas o
   * ScrollTrigger mediu o trilho de pin antes, e a doc recomenda remedir
   * quando imagem entra depois. Sem isso, o fim da cena cai no lugar errado
   * numa conexão lenta, que é justamente o cenário do 4G do interior.
   */
  const imagens = Array.from(secao.querySelectorAll('img'));
  const pendentes = imagens.filter((img) => !img.complete);

  if (pendentes.length) {
    await Promise.all(
      pendentes.map(
        (img) =>
          new Promise((resolve) => {
            img.addEventListener('load', resolve, { once: true });
            img.addEventListener('error', resolve, { once: true });
          })
      )
    );
    ScrollTrigger.refresh();
  }
}
