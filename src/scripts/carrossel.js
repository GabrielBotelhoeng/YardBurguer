/**
 * O comportamento do carrossel coverflow. Vanilla, ~2 kB.
 *
 * O CSS já sabe desenhar cada posição (`data-pos` de -2 a 2); daqui sai só qual
 * card está em qual posição. Essa divisão é o que mantém o script pequeno e
 * deixa o visual inteiro inspecionável no devtools.
 */

const REDUZIDO = matchMedia('(prefers-reduced-motion: reduce)');

/**
 * Distância ASSINADA de `i` até o centro, no anel de `total` itens.
 *
 * É a correção do defeito da referência, que usava distância só positiva e
 * testava `offset === 2` antes de `offset === total - 1`. Com três itens os dois
 * são o mesmo número, o primeiro teste ganhava, e o terceiro card ia para a
 * direita em vez da esquerda — dois de um lado, nenhum do outro.
 *
 * Aqui -1 é sempre "um à esquerda", com qualquer quantidade de itens.
 */
function distancia(i, centro, total) {
  let d = (i - centro) % total;
  if (d > total / 2) d -= total;
  if (d < -total / 2) d += total;
  return d;
}

export function initCarrossel() {
  const raiz = document.querySelector('[data-carrossel]');
  if (!raiz) return;

  const slides = [...raiz.querySelectorAll('[data-slide]')];
  const pontos = [...raiz.querySelectorAll('[data-ponto]')];
  const contadorAtual = raiz.querySelector('[data-contador-atual]');
  const total = slides.length;
  if (total < 2) return;

  let centro = 0;
  let timer = null;

  /**
   * Sob reduced-motion o CSS já mostra os três em coluna. Mexer em data-pos ali
   * não quebraria nada, mas ligar autoplay e listeners para uma pilha que não
   * empilha é gastar bateria à toa.
   */
  if (REDUZIDO.matches) return;

  const pintar = () => {
    slides.forEach((slide, i) => {
      const d = distancia(i, centro, total);
      const visivel = Math.abs(d) <= 2;
      slide.dataset.pos = visivel ? String(d) : 'fora';

      // Quem não está no centro não é lido nem alcançável por Tab: o leitor de
      // tela anunciaria três descrições de uma vez, e o Tab pararia num CTA
      // invisível a 30% de opacidade.
      slide.setAttribute('aria-hidden', d === 0 ? 'false' : 'true');
      const cta = slide.querySelector('.cart__cta');
      if (cta) cta.tabIndex = d === 0 ? 0 : -1;
    });
    pontos.forEach((p, i) => p.setAttribute('aria-selected', i === centro ? 'true' : 'false'));

    // Um dos dois existe, nunca os dois: o componente troca a fila de pontos
    // por um contador quando o cardápio não cabe em bolinhas de 44px.
    if (contadorAtual) contadorAtual.textContent = String(centro + 1);

    prepararVizinhos();
  };

  /**
   * O CARD SEGUINTE ENTRAVA EM CENA SEM FOTO.
   *
   * As imagens nascem `loading="lazy"`, e com onze cards isso é obrigatório —
   * carregar as onze de saída jogaria ~250 kB no orçamento por uma foto que a
   * pessoa talvez nunca veja. Mas o lazy do navegador decide pela POSIÇÃO NA
   * VIEWPORT, e num coverflow todos os cards estão empilhados no mesmo ponto,
   * escondidos por `opacity: 0` e `scale(0.4)`. O navegador não tem como saber
   * que o próximo da fila está a um toque de distância.
   *
   * O resultado, medido: com o Tápera no centro, os cards em ±2 vinham com
   * `naturalWidth: 0` — sem pixel nenhum. Ao avançar, o card entrava vazio e a
   * foto aparecia depois, de repente. É o "bugado e feio" que o dono viu.
   *
   * A correção é uma vizinhança de precarga um passo MAIOR que a de exibição: o
   * CSS mostra até ±2, então aqui se prepara até ±3. Assim, quando um card
   * chega a ±2 e passa a ser desenhado, o pixel dele já está em memória.
   *
   * `img.loading = 'eager'` E NÃO um `new Image()` de aquecimento. Os cards
   * vivem dentro de um `<picture>` com `<source type="image/avif">`, e um
   * `Image()` avulso baixaria o `src` do `<img>` — o webp. O navegador, ao
   * desenhar o card, escolheria o avif e baixaria de novo: dois arquivos pagos
   * para exibir um. Trocar o atributo mantém a escolha de formato com quem sabe
   * fazê-la, e a spec do HTML é explícita: sair de `lazy` para `eager` inicia o
   * carregamento se ele ainda não começou.
   */
  /**
   * A PRECARGA SÓ COMEÇA QUANDO O CARROSSEL CHEGA À TELA.
   *
   * Sem esta trava, o primeiro `pintar()` — que roda no load — promoveria sete
   * fotos a `eager` de uma vez, e elas disputariam banda com o hero enquanto a
   * pessoa ainda está na primeira dobra. Seria trocar um defeito visível por um
   * LCP pior, em 4G do interior.
   *
   * A seção fica a mais de uma tela de distância na rolagem, e o `rootMargin`
   * de uma tela dá o tempo de chegada.
   */
  let carrosselJaApareceu = false;

  function prepararVizinhos() {
    if (!carrosselJaApareceu) return;

    slides.forEach((slide, i) => {
      if (Math.abs(distancia(i, centro, total)) > 3) return;

      const img = slide.querySelector('img');
      if (img && img.loading === 'lazy') img.loading = 'eager';
    });
  }

  new IntersectionObserver(
    (entradas, observador) => {
      if (!entradas.some((e) => e.isIntersecting)) return;
      observador.disconnect();
      carrosselJaApareceu = true;
      prepararVizinhos();
    },
    { rootMargin: '100% 0px' }
  ).observe(raiz);

  const irPara = (i) => {
    centro = ((i % total) + total) % total;
    pintar();
  };
  const proximo = () => irPara(centro + 1);
  const anterior = () => irPara(centro - 1);

  /* ------------------------------------------------------------ autoplay */
  /**
   * WCAG 2.2.2: movimento automático que dura mais de 5s precisa de um jeito de
   * parar. A referência não tinha nenhum. Aqui ele para no hover, no foco do
   * teclado e quando a aba sai de vista — e o clique em qualquer controle
   * também derruba, porque a partir daí quem manda é a pessoa.
   */
  const parar = () => {
    if (timer) clearInterval(timer);
    timer = null;
  };
  const tocar = () => {
    parar();
    if (document.visibilityState !== 'visible') return;
    timer = setInterval(proximo, 5000);
  };

  /**
   * `pointerenter` FILTRADO POR pointerType, e não `mouseenter`.
   *
   * MEDIDO na auditoria mobile: em toque real o Chromium sintetiza eventos de
   * mouse para compatibilidade, e a sequência que ele emite é
   * `touchstart, touchend, mouseenter, mousemove, mousedown, mouseup, click` —
   * SEM `mouseleave` depois, porque um dedo não "sai" de lugar nenhum, ele
   * apenas some.
   *
   * Com `mouseenter` puro, o efeito no celular era: qualquer toque no
   * carrossel, mesmo um encostar sem querer enquanto se rola a página, matava
   * o autoplay para sempre. Parar após interação REAL é o certo; parar por um
   * hover que nunca existiu não é.
   *
   * Filtrando por `pointerType === 'mouse'`, o hover volta a ser hover. No
   * toque, quem derruba o autoplay são os handlers de swipe e de controle, que
   * é onde houve intenção de verdade.
   */
  raiz.addEventListener('pointerenter', (e) => {
    if (e.pointerType === 'mouse') parar();
  });
  raiz.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'mouse') tocar();
  });
  raiz.addEventListener('focusin', parar);
  raiz.addEventListener('focusout', (e) => {
    if (!raiz.contains(e.relatedTarget)) tocar();
  });
  document.addEventListener('visibilitychange', () => {
    document.visibilityState === 'visible' ? tocar() : parar();
  });

  /* ------------------------------------------------------------ controles */
  raiz.querySelector('[data-proximo]')?.addEventListener('click', () => {
    proximo();
    parar();
  });
  raiz.querySelector('[data-anterior]')?.addEventListener('click', () => {
    anterior();
    parar();
  });
  pontos.forEach((p, i) =>
    p.addEventListener('click', () => {
      irPara(i);
      parar();
    })
  );

  // Clicar num card lateral o traz para o centro — é o gesto que a pilha sugere.
  slides.forEach((slide, i) =>
    slide.addEventListener('click', (e) => {
      if (slide.dataset.pos === '0') return; // o do meio tem o próprio CTA
      e.preventDefault();
      irPara(i);
      parar();
    })
  );

  /**
   * Setas do teclado só quando o foco está DENTRO do carrossel.
   *
   * A referência escutava no `window`: com ela na página, apertar seta para o
   * lado em qualquer lugar mexia no carrossel — inclusive com o foco num campo
   * de texto, onde a seta deveria mover o cursor.
   */
  raiz.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { anterior(); parar(); }
    if (e.key === 'ArrowRight') { proximo(); parar(); }
  });

  /* --------------------------------------------------------------- swipe */
  /**
   * O gesto principal no celular, que é o público desta página.
   *
   * `touchmove` passivo e sem `preventDefault`: sequestrar o gesto quebraria a
   * ROLAGEM VERTICAL da página em cima do carrossel — o usuário ficaria preso
   * tentando descer. Só decidimos no `touchend`, e só se o movimento foi mais
   * horizontal que vertical.
   */
  let x0 = 0;
  let y0 = 0;
  raiz.addEventListener(
    'touchstart',
    (e) => {
      x0 = e.touches[0].clientX;
      y0 = e.touches[0].clientY;
    },
    { passive: true }
  );
  raiz.addEventListener(
    'touchend',
    (e) => {
      const dx = e.changedTouches[0].clientX - x0;
      const dy = e.changedTouches[0].clientY - y0;
      // 45px de limiar e horizontal dominante: sem a segunda condição, uma
      // rolagem vertical um pouco torta trocaria de slide sem querer.
      if (Math.abs(dx) < 45 || Math.abs(dx) <= Math.abs(dy)) return;
      dx < 0 ? proximo() : anterior();
      parar();
    },
    { passive: true }
  );

  pintar();
  tocar();
}
