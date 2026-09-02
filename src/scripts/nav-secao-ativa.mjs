/**
 * Qual seção está sendo lida agora — e por que a resposta não sai de scrollY.
 *
 * A navbar tem três links e nenhum deles diz onde a pessoa está. Numa página
 * que é uma coluna só de rolagem, isso é a diferença entre um menu e uma lista
 * de palavras: sem marca de posição, o link "Onde estamos" parece igualmente
 * distante estando a três telas ou a três dedos dele.
 *
 * A CONTA NÃO PODE SER FEITA COM `scrollY`. A Cena 2 é PINADA: enquanto ela
 * roda, a página continua rolando mas o palco fica parado na tela. Somar
 * alturas de seção daria uma resposta que só bate fora do trecho pinado — e o
 * trecho pinado é justamente onde a pessoa passa mais tempo. `IntersectionObserver`
 * pergunta ao navegador o que está de fato na tela, o que já inclui o pin, o
 * scroll suave do Lenis e qualquer coisa que venha a mexer no layout depois.
 *
 * A LINHA DE LEITURA, e não a seção inteira. `rootMargin` recorta a viewport
 * numa faixa fina logo abaixo da navbar: some-se a altura da barra em cima e
 * corta-se 55% embaixo. Quem cruzar essa faixa é a seção "atual". Sem isso,
 * duas seções ficam visíveis ao mesmo tempo na maior parte da rolagem e o
 * indicador pisca entre elas — que é pior que indicador nenhum.
 *
 * O ESTADO É `aria-current="true"`, não uma classe. É o atributo que os
 * leitores de tela anunciam ("item atual"), e o CSS estiliza a partir dele. Uma
 * classe daria o mesmo visual e não diria nada a quem navega por áudio.
 */

/** A navbar mede 76px nos dois breakpoints — o mesmo número que VideoScene usa. */
const ALTURA_NAVBAR = 76;

/** Quanto da viewport, do fundo para cima, é ignorado. */
const CORTE_INFERIOR = '55%';

export function initNavSecaoAtiva() {
  const lista = document.querySelector('[data-nav-lista]');
  if (!lista) return;

  // `IntersectionObserver` existe em tudo que este projeto atende, mas o custo
  // de não presumir é uma linha, e o preço de presumir errado é um erro de JS
  // que derruba o menu junto — os dois módulos vivem no mesmo bloco de script.
  if (!('IntersectionObserver' in window)) return;

  const porSecao = new Map();

  for (const link of lista.querySelectorAll('a[href^="#"]')) {
    const secao = document.querySelector(link.getAttribute('href'));
    if (secao) porSecao.set(secao, link);
  }

  if (porSecao.size === 0) return;

  /** Quantas seções estão cruzando a linha de leitura, na ordem do documento. */
  const naLinha = new Set();

  function repintar() {
    // A ÚLTIMA na ordem do documento ganha. Nas emendas entre duas seções as
    // duas cruzam a faixa por alguns pixels; escolher sempre a de baixo faz o
    // indicador andar para a frente junto com a rolagem, em vez de hesitar.
    let atual = null;
    for (const secao of porSecao.keys()) {
      if (naLinha.has(secao)) atual = secao;
    }

    for (const [secao, link] of porSecao) {
      if (secao === atual) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    }
  }

  const observador = new IntersectionObserver(
    (entradas) => {
      for (const entrada of entradas) {
        if (entrada.isIntersecting) naLinha.add(entrada.target);
        else naLinha.delete(entrada.target);
      }
      repintar();
    },
    { rootMargin: `-${ALTURA_NAVBAR}px 0px -${CORTE_INFERIOR} 0px` },
  );

  for (const secao of porSecao.keys()) observador.observe(secao);
}
