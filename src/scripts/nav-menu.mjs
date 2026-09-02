/**
 * O menu do celular — e por que ele não é só um botão que mostra uma lista.
 *
 * Até aqui, abaixo de 640px a navegação inteira era removida por
 * `display: none`. A justificativa escrita no CSS era honesta — em 390px os
 * três links empilhavam por cima do CTA e o logo quebrava em duas linhas — mas
 * a conclusão estava errada: o remédio virou esconder da maioria. O celular é o
 * cliente principal desta página, e a regra do projeto é que o que existe no
 * desktop precisa existir no celular. Não em outro lugar, não numa versão
 * reduzida: o MESMO `<nav>`, com os MESMOS links, vindos do MESMO array do
 * copy.json.
 *
 * É por isso que este módulo não cria link nenhum. Ele só muda o COMPORTAMENTO
 * de uma lista que já está no HTML — se aqui algo falhar, o que sobra na tela
 * continua sendo a navegação completa.
 *
 * O BOTÃO NASCE `hidden` E O SCRIPT O REVELA, mesmo contrato do "copiar
 * endereço" e do selo de aberto/fechado. A diferença é o que acontece quando o
 * script não roda, e essa diferença é o ponto do arquivo:
 *
 *   - sem JS: `.nav` está em `flex-wrap` e os links caem numa segunda linha,
 *     abaixo do logo e do CTA. Ocupa mais altura do que se gostaria e é o
 *     visual que motivou o `display: none` original — mas TUDO é alcançável.
 *   - com JS: o header ganha `data-menu`, o CSS tira os links do fluxo e os
 *     transforma em painel, o botão aparece. A navbar volta a ter uma linha só.
 *
 * O CSS de painel está inteiro atrás de `.nav[data-menu]`, que só este arquivo
 * escreve. Sem isso, um erro de JS deixaria o painel escondido para sempre e
 * ninguém veria a navegação — que é exatamente o defeito que viemos consertar.
 */

/**
 * Quanto o dedo pode arrastar a página antes de o painel se considerar
 * abandonado. Zero fecharia no repique de scroll que o iOS dá ao focar um
 * elemento; um valor alto deixa o painel pairando sobre a Cena 2, que é
 * pinada e ocupa a tela inteira.
 */
const TOLERANCIA_SCROLL = 40;

export function initNavMenu() {
  const header = document.querySelector('[data-nav]');
  const botao = header?.querySelector('[data-nav-botao]');
  const lista = header?.querySelector('[data-nav-lista]');

  // Sem qualquer uma das três peças não há o que aprimorar, e sair aqui deixa
  // a navegação em fluxo — visível, que é o estado seguro.
  if (!header || !botao || !lista) return;

  header.dataset.menu = '';
  botao.hidden = false;

  let scrollDaAbertura = 0;

  const estaAberto = () => header.hasAttribute('data-menu-aberto');

  function abrir() {
    header.setAttribute('data-menu-aberto', '');
    botao.setAttribute('aria-expanded', 'true');
    botao.setAttribute('aria-label', 'Fechar menu');
    scrollDaAbertura = window.scrollY;

    // O primeiro link recebe o foco: quem abriu pelo teclado já está dentro do
    // painel, e o leitor de tela anuncia o conteúdo em vez de ficar no botão.
    lista.querySelector('a')?.focus();
  }

  function fechar({ devolverFoco = false } = {}) {
    if (!estaAberto()) return;
    header.removeAttribute('data-menu-aberto');
    botao.setAttribute('aria-expanded', 'false');
    botao.setAttribute('aria-label', 'Abrir menu');

    // Só quando o fechamento foi uma decisão do teclado (Esc). Roubar o foco de
    // volta depois de um clique num link jogaria o leitor de tela para o topo
    // no exato momento em que a página está rolando para a seção pedida.
    if (devolverFoco) botao.focus();
  }

  botao.addEventListener('click', () => {
    if (estaAberto()) fechar();
    else abrir();
  });

  // Clicar num link fecha antes da rolagem começar: o painel cobre o topo da
  // seção de destino, e chegar lá com ele aberto é chegar olhando para o menu.
  lista.addEventListener('click', (evento) => {
    if (evento.target.closest('a')) fechar();
  });

  document.addEventListener('keydown', (evento) => {
    if (evento.key === 'Escape') fechar({ devolverFoco: true });
  });

  // Clique fora — no resto da página ou na própria navbar. O `contains` cobre
  // o botão de propósito: o toque nele já é tratado no listener acima e sem
  // esta guarda o painel abriria e fecharia no mesmo gesto.
  document.addEventListener('click', (evento) => {
    if (!estaAberto()) return;
    if (header.contains(evento.target)) return;
    fechar();
  });

  window.addEventListener(
    'scroll',
    () => {
      if (!estaAberto()) return;
      if (Math.abs(window.scrollY - scrollDaAbertura) > TOLERANCIA_SCROLL) fechar();
    },
    { passive: true },
  );

  /**
   * Girar o aparelho para paisagem pode cruzar os 640px e devolver os links à
   * navbar. O atributo `data-menu-aberto` sobreviveria à travessia e, na volta
   * ao retrato, o painel reapareceria sozinho, sem ninguém ter tocado nele.
   *
   * A pergunta é feita com a MESMA media query do CSS. Duplicar o número em
   * dois lugares é o tipo de divergência que quebra em silêncio neste projeto.
   */
  const ehCelular = window.matchMedia('(max-width: 639px)');
  const aoTrocarDeFaixa = () => {
    if (!ehCelular.matches) fechar();
  };

  if (ehCelular.addEventListener) ehCelular.addEventListener('change', aoTrocarDeFaixa);
  else ehCelular.addListener(aoTrocarDeFaixa); // Safari < 14
}
