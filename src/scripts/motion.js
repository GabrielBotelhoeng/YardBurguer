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

/**
 * "Isto é um aparelho pequeno?" — perguntado pelo LADO CURTO, não pela largura.
 *
 * Era `(max-width: 767px)`, e a largura muda quando o aparelho gira: um iPhone
 * 14 deitado tem 844px e passava por desktop. A consequência que mais doía
 * estava logo abaixo, no Lenis — celular aberto na horizontal ligava o smooth
 * scroll, que a arquitetura de peso exclui de propósito em mobile. Medido:
 * `lenisNaCarga: true` em 844x390 e em 915x412.
 *
 * O lado curto de um aparelho não muda ao girar, então esta resposta é estável
 * na rotação. É a MESMA pergunta que `CONSULTA_CELULAR` faz em VideoScene.astro
 * para escolher o arquivo de vídeo — e ela precisa continuar sendo a mesma. Toda
 * vez que estas duas divergiram, alguma coisa quebrou em silêncio: o arquivo
 * errado baixado, o véu errado aplicado, o trilho com 64% a mais de comprimento.
 */
const ehMobile = window.matchMedia('(max-width: 900px), (max-height: 500px)').matches;

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
 * Barra fixa de pedido — aparece quando o hero sai da tela.
 *
 * IntersectionObserver e um atributo. Nada mais entra aqui: o GSAP desta página
 * é buscado por import dinâmico só quando a Cena 2 se aproxima, e trazê-lo para
 * cá derrubaria 45kb gzip em cima do LCP para animar uma barra que um
 * `transform` de CSS resolve de graça.
 *
 * O SCRIPT NÃO PERGUNTA SE É CELULAR. Quem responde isso é a media query de
 * `.barra-pedido` — a mesma consulta deste arquivo, escrita uma vez, no lugar
 * onde ela se reavalia sozinha quando o aparelho gira. `ehMobile` aqui em cima
 * é resolvido na carga e envelhece na rotação; para Lenis e Cena 2 isso é
 * aceitável (as duas decidem uma vez e seguem), para um elemento que precisa
 * aparecer e sumir com a orientação, não é.
 *
 * As zonas mortas vêm do HTML (`data-esconde-barra`) e não de uma lista de
 * seletores aqui: quem decide que o hero e o CTA final não querem a barra é a
 * composição da página, e ela mora no markup.
 */
function initBarraPedido() {
  const barra = document.querySelector('[data-barra-pedido]');
  if (!barra) return;

  const zonas = document.querySelectorAll('[data-esconde-barra]');
  if (!zonas.length) return;

  // Duas zonas podem estar na tela ao mesmo tempo em telas altas; um booleano
  // só faria a última entrada mandar em tudo. O conjunto guarda quem está
  // dentro, e a barra aparece quando ele esvazia.
  const naTela = new Set();

  const observador = new IntersectionObserver((entradas) => {
    for (const entrada of entradas) {
      if (entrada.isIntersecting) naTela.add(entrada.target);
      else naTela.delete(entrada.target);
    }
    barra.toggleAttribute('data-visivel', naTela.size === 0);
  });

  zonas.forEach((zona) => observador.observe(zona));
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
  initBarraPedido();
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
