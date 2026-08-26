/**
 * Coreografia de scroll — @motion-director (Trilho)
 * Contrato: squads/yard-burguer-squad/data/scroll-storyboard.md
 *
 * ARQUITETURA DE PESO (decidida no gate do @mobile-performance-guardian):
 * este bundle inicial é deliberadamente minúsculo — só IntersectionObserver e
 * CSS. GSAP + ScrollTrigger pesam ~45kb gzip sozinhos e são necessários apenas
 * para a cena 2 (pin + scrub das camadas), então entram por import dinâmico
 * quando essa cena se aproxima. Quando isso acontece o usuário já está rolando,
 * logo o custo não cai sobre o LCP.
 *
 * Regras respeitadas: só transform/opacity, no máximo 1 pin, toda cena tem
 * estado final estático sob prefers-reduced-motion.
 */

const prefereMenosMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const ehMobile = window.matchMedia('(max-width: 767px)').matches;

/**
 * Navbar ganha fundo sólido ao sair do topo.
 * Sem backdrop-filter em mobile: custa caro em GPU fraca.
 */
function initNavbar() {
  const nav = document.querySelector('[data-nav]');
  if (!nav) return;

  const aplicar = () => {
    nav.toggleAttribute('data-scrolled', window.scrollY > 80);
  };

  aplicar();
  window.addEventListener('scroll', aplicar, { passive: true });
}

/**
 * Scroll reveal em cascata — IntersectionObserver + CSS, sem biblioteca.
 * O atraso por filho vira uma custom property que o CSS consome.
 */
function initScrollReveal() {
  const grupos = document.querySelectorAll('[data-reveal]');
  if (!grupos.length) return;

  // Sob reduced-motion tudo já nasce visível: o CSS só esconde quando
  // .reveal-armado está presente, e aqui nunca chegamos a armar.
  if (prefereMenosMovimento) return;

  grupos.forEach((grupo) => {
    const filhos = grupo.children.length ? Array.from(grupo.children) : [grupo];
    filhos.forEach((filho, i) => {
      filho.style.setProperty('--reveal-delay', `${i * 90}ms`);
      filho.classList.add('reveal-armado');
    });
  });

  const observador = new IntersectionObserver(
    (entradas) => {
      entradas.forEach((entrada) => {
        if (!entrada.isIntersecting) return;
        const filhos = entrada.target.children.length
          ? Array.from(entrada.target.children)
          : [entrada.target];
        filhos.forEach((filho) => filho.classList.add('reveal-visivel'));
        observador.unobserve(entrada.target);
      });
    },
    { rootMargin: '0px 0px -15% 0px' }
  );

  grupos.forEach((grupo) => observador.observe(grupo));
}

/**
 * Cena 2 — a montagem do burger. Único ponto que justifica o peso do GSAP,
 * então ele só é buscado quando a cena está a uma tela de distância.
 *
 * A cena tem duas variantes (ver src/config/cena2.js) e só uma renderiza por
 * build. Qual delas está no DOM se lê pelo data-cena da própria seção, não por
 * uma segunda flag no cliente: assim o HTML é a única fonte da verdade e não há
 * como o script achar que carrega uma coisa enquanto a página traz outra.
 *
 * Os dois chunks são dinâmicos e mutuamente exclusivos — o browser baixa
 * exatamente um.
 */
function initExplodeQuandoPerto() {
  const secao = document.querySelector('#explode');
  if (!secao) return;

  // Estado final estático. Vale para as duas variantes: em camadas o
  // hambúrguer já nasce empilhado no HTML; em vídeo o que fica é o <picture>
  // do último quadro, e nenhum byte de vídeo chega a ser pedido.
  if (prefereMenosMovimento) return;

  const observador = new IntersectionObserver(
    async (entradas) => {
      if (!entradas.some((e) => e.isIntersecting)) return;
      observador.disconnect();

      if (secao.dataset.cena === 'video') {
        const { initVideoScrubScene } = await import('./video-scrub.js');
        initVideoScrubScene({ secao, ehMobile });
      } else {
        const { initExplodeScene } = await import('./explode.js');
        initExplodeScene({ secao, ehMobile });
      }
    },
    { rootMargin: '100% 0px' }
  );

  observador.observe(secao);
}

/**
 * Scroll suave — só desktop, e só se o usuário aceita movimento.
 *
 * O loop de rAF daqui é PROVISÓRIO. Se o GSAP entrar depois (cena 2), ele
 * assume o Lenis pelo próprio ticker e cancela este loop. Dois laços dirigindo
 * o mesmo scroll saem de fase e o scrub treme — a doc do ScrollTrigger é
 * explícita sobre haver um único relógio.
 *
 * Retorna a instância para que o explode.js possa esperar por ela em vez de
 * torcer para que já exista: os dois chunks carregam de forma assíncrona e a
 * ordem entre eles não é garantida.
 */
async function initSmoothScroll() {
  if (prefereMenosMovimento || ehMobile) return null;

  const { default: Lenis } = await import('lenis');
  const lenis = new Lenis({ duration: 1.1, smoothWheel: true });

  let quadro = requestAnimationFrame(function loop(tempo) {
    lenis.raf(tempo);
    quadro = requestAnimationFrame(loop);
  });

  window.__yardLenis = lenis;
  window.__yardPararLoopLenis = () => cancelAnimationFrame(quadro);

  return lenis;
}

function init() {
  initNavbar();
  initScrollReveal();
  initExplodeQuandoPerto();

  // Publicado como promessa, não como valor: o explode.js pode chegar antes do
  // Lenis terminar de carregar e precisa de algo em que esperar.
  window.__yardLenisPronto = initSmoothScroll();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
