/**
 * Cena 2 — variante em VÍDEO. Chunk carregado sob demanda por motion.js.
 *
 * Mesma cena do storyboard, outro material: em vez de sete PNGs animados por
 * GSAP, um take único do hambúrguer se montando, com o scroll dirigindo
 * `video.currentTime` em vez de `transform`. É a técnica que a Apple usa nas
 * páginas de produto.
 *
 * DIREÇÃO DO ARQUIVO — não é detalhe de encode, é o contrato da cena.
 * O material entregue pelo cliente vai de MONTADO para EXPLODIDO. O storyboard
 * foi invertido em 2026-08-25 a pedido dele mesmo: "o ato de construir é o que
 * dá fome; o de destruir, não". Então o vídeo é revertido no ffmpeg, não no
 * runtime. Rodar `currentTime` de trás para frente seria o pior caso possível
 * para o decoder — cada quadro exigiria decodificar do keyframe anterior e
 * descartar tudo à frente. Revertido no arquivo, rolar para baixo é avançar no
 * tempo, que é o caminho para o qual todo decodificador é otimizado.
 *
 * ESTADO DE REPOUSO. O `<video>` nasce SEM src. Quem atribui é este arquivo, e
 * ele só roda quando há movimento permitido e a cena está a uma tela de
 * distância. Sob prefers-reduced-motion ou sem JS, o que fica na tela é o
 * <picture> do último quadro — o hambúrguer montado —, e nenhum byte de vídeo
 * é baixado. O estado final estático não é um remendo aqui: é o padrão, e o
 * vídeo é que é a exceção.
 */

import { gsap } from 'gsap/gsap-core';
import { CSSPlugin } from 'gsap/CSSPlugin';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ligarPonteLenis } from './ponte-lenis.js';

gsap.registerPlugin(CSSPlugin, ScrollTrigger);

/** Cadência do material entregue. Ver assets/video/README ou o log de encode. */
const FPS = 24;

/**
 * Teto de espera pelo buffer antes de desistir de esperar.
 *
 * `canplaythrough` é a garantia que se quer — o browser estimou que consegue
 * chegar ao fim sem parar. Mas o evento pode simplesmente nunca chegar quando a
 * aba está em segundo plano ou o browser resolve economizar dados. Depois deste
 * prazo a cena arranca com o que tiver: `loadeddata` já basta para buscar, e o
 * guarda-costas de seek mais abaixo cobre o resto.
 */
const LIMITE_BUFFER_MS = 6000;

/**
 * Quanto tempo o vigia espera por um `seeked` antes de declarar que buscar não
 * funciona neste device. Seek programático é notoriamente instável em mobile —
 * a cena precisa ter um caminho de saída que não dependa de o cliente reclamar.
 */
const LIMITE_VIGIA_MS = 2500;

function esperarVideoUtil(video) {
  // readyState 4 = HAVE_ENOUGH_DATA. Se já chegou, não há o que esperar.
  if (video.readyState >= 4) return Promise.resolve('pronto');

  return new Promise((resolve) => {
    let encerrado = false;
    const fim = (motivo) => {
      if (encerrado) return;
      encerrado = true;
      clearTimeout(relogio);
      video.removeEventListener('canplaythrough', aoPassar);
      video.removeEventListener('error', aoFalhar);
      resolve(motivo);
    };
    const aoPassar = () => fim('pronto');
    const aoFalhar = () => fim('erro');
    const relogio = setTimeout(() => fim('prazo'), LIMITE_BUFFER_MS);

    video.addEventListener('canplaythrough', aoPassar, { once: true });
    video.addEventListener('error', aoFalhar, { once: true });
  });
}

export async function initVideoScrubScene({ secao, ehMobile }) {
  const video = secao.querySelector('[data-video]');
  const palco = secao.querySelector('[data-palco]');
  if (!video || !palco) return;

  await ligarPonteLenis(ScrollTrigger, gsap);

  /**
   * Um arquivo por viewport, escolhido aqui e não por `<source media>`.
   *
   * A seleção por media dentro de `<video>` é mal suportada — ao contrário de
   * `<picture>`, vários browsers ignoram o atributo e pegam o primeiro source.
   * Como o src já era atribuído por JS de qualquer forma (para não baixar nada
   * sob reduced-motion), escolher aqui não custa nada e é determinístico.
   *
   * O corte quadrado existe porque o material é 16:9 e a cena é vertical no
   * celular. Enquadrar com object-fit desperdiçaria os pixels das laterais —
   * que no material são só bokeh do balcão. Cortado no ffmpeg, o mesmo peso
   * entrega o hambúrguer maior.
   */
  const fonte = ehMobile ? video.dataset.srcQuadrada : video.dataset.srcLarga;
  if (!fonte) return;

  video.src = fonte;
  // preload só entra junto com o src: antes disso não há o que pré-carregar, e
  // deixar "auto" no HTML faria o browser buscar mesmo sob reduced-motion.
  video.preload = 'auto';
  video.load();

  const desfecho = await esperarVideoUtil(video);
  if (desfecho === 'erro') return; // fica o <picture>, que é o estado de repouso

  /**
   * Destrava de seek do iOS.
   *
   * No Safari de iOS, atribuir `currentTime` a um vídeo que nunca foi tocado
   * simplesmente não faz nada — o elemento só passa a aceitar busca depois de
   * ter entrado em reprodução ao menos uma vez. Com `muted` + `playsinline` o
   * play é permitido sem gesto do usuário, então um play/pause imediato resolve
   * sem que ninguém veja um quadro sequer se mexer.
   *
   * O catch não é decoração: se a política de autoplay recusar, a cena continua
   * e quem decide se dá para buscar é o vigia, com evidência em vez de palpite.
   */
  try {
    await video.play();
    video.pause();
  } catch {
    /* política de autoplay recusou — o vigia decide o que fazer */
  }

  const duracao = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 10;

  // Primeiro quadro = peças espalhadas. Isso acontece ANTES do fade-in, então a
  // troca do poster montado para o vídeo espalhado nunca aparece em tela: a
  // cena ainda está a uma tela de distância quando este chunk roda.
  video.currentTime = 0;
  palco.setAttribute('data-pronto', '');

  /**
   * O trilho é o MESMO da variante em camadas: +=180% no desktop, +=110% no
   * mobile. Não é preguiça — é o que torna as duas versões comparáveis lado a
   * lado. O cliente vai julgar o material, não o comprimento do trilho, e
   * mudar as duas variáveis ao mesmo tempo destruiria a comparação.
   *
   * Em números: 10s a 24fps são 240 quadros. No desktop, 180% de uma tela de
   * 900px são 1620px de scroll — ~6,8px por quadro. É denso o bastante para o
   * movimento ler como contínuo e curto o bastante para ninguém cansar.
   */
  const estado = { t: 0 };

  const trilho = gsap.timeline({
    scrollTrigger: {
      trigger: secao,
      start: 'top top',
      end: ehMobile ? '+=110%' : '+=180%',
      /**
       * scrub 0.5, e não o 1 da variante em camadas.
       *
       * Em camadas o scrub alto suaviza transform, que é de graça. Aqui cada
       * quadro de suavização vira um `currentTime` a mais — ou seja, um seek.
       * Amortecer demais faz o vídeo continuar buscando depois que o dedo já
       * parou, e o que se vê é o hambúrguer "escorregando" sozinho. Meio
       * segundo tira o serrilhado do trackpad sem criar essa cauda.
       */
      scrub: 0.5,
      pin: true,
      anticipatePin: 1,
      // O trilho é medido em % do viewport e o palco tem aspect-ratio: girar o
      // celular muda os dois. Sem invalidar, o fim da cena fica calculado para
      // a orientação anterior.
      invalidateOnRefresh: true,
    },
  });

  /**
   * O guarda de quadro.
   *
   * Sem ele, `onUpdate` atribui `currentTime` a cada quadro do ticker — até 60
   * vezes por segundo — para buscar posições que caem TODAS dentro do mesmo
   * quadro de vídeo. O decodificador recebe uma fila de seeks redundantes,
   * cancela cada um no meio para atender o próximo e o resultado é um vídeo que
   * trava justamente enquanto se rola.
   *
   * MEDIDO (2026-08-25, trilho inteiro percorrido em 4,3s, build de produção):
   * 261 quadros de ticker produziram 160 seeks em vez de 261 — 39% a menos, com
   * 0 seeks perdidos e o currentTime chegando aos 10,00s. O corte é maior quanto
   * mais devagar se rola, que é justamente quando mais quadros de ticker caem
   * dentro do mesmo quadro de vídeo. E não muda um pixel do que se vê: buscar
   * duas posições dentro do mesmo quadro mostra o mesmo quadro.
   */
  const QUADRO = 1 / FPS;
  let aplicado = -1;
  let seeksPedidos = 0;
  let seeksAtendidos = 0;

  video.addEventListener('seeked', () => {
    seeksAtendidos += 1;
  });

  trilho.to(
    estado,
    {
      t: duracao,
      ease: 'none',
      duration: 1,
      onUpdate: () => {
        // readyState 2 = HAVE_CURRENT_DATA: abaixo disso o seek entra numa fila
        // que nunca esvazia e a cena engasga em vez de esperar.
        if (video.readyState < 2) return;
        if (Math.abs(estado.t - aplicado) < QUADRO) return;
        aplicado = estado.t;
        seeksPedidos += 1;
        video.currentTime = estado.t;
      },
    },
    0
  );

  /**
   * O título entra depois que o hambúrguer fecha — igual à variante em camadas.
   * Enquanto as peças estão no ar a cena é sobre o movimento; quando o
   * hambúrguer fica pronto, o título aparece e nomeia o que foi montado.
   */
  const conteudo = secao.querySelector('[data-conteudo]');

  /**
   * O véu vem UM POUCO ANTES do texto — 0.82 contra 0.86.
   *
   * Não é capricho: quando o texto começa a aparecer o fundo já precisa estar
   * escuro, ou existe uma janela de poucos quadros em que o creme entra em cima
   * da tábua clara sem proteção nenhuma. Acendendo o véu primeiro, o texto
   * sempre pousa sobre base pronta.
   *
   * E ele não fica aceso a cena inteira porque, enquanto as peças estão no ar,
   * não há texto para proteger — só teria o efeito de apagar o terço de baixo
   * do take.
   */
  const veu = secao.querySelector('[data-veu]');
  if (veu) {
    trilho.fromTo(veu, { opacity: 0 }, { opacity: 1, ease: 'none', duration: 0.14 }, 0.82);
  }

  if (conteudo) {
    trilho.fromTo(
      conteudo,
      { opacity: 0, y: 24 },
      { opacity: 1, y: 0, ease: 'none', duration: 0.16 },
      0.86
    );
  }

  /*
   * NÃO existe mais parallax de texto de fundo aqui — e a ausência é a decisão,
   * não um esquecimento.
   *
   * Enquanto o vídeo era uma moldura no meio do carvão, o `YARD BURGUER` ao
   * fundo era o plano de trás e a diferença de velocidade criava profundidade.
   * Com o vídeo em full-bleed existe UM plano só: a palavra passaria a andar por
   * cima do próprio produto. Parallax sem segundo plano não é profundidade, é
   * tremida.
   *
   * O elemento saiu do VideoScene.astro junto com este tween. A variante em
   * camadas (explode.js / ExplodeScene.astro) mantém o dela, porque lá o carvão
   * vazio continua existindo.
   */

  /**
   * Remedição depois que o vídeo virou conteúdo real.
   *
   * O palco tem aspect-ratio no CSS, então o layout não salta quando o vídeo
   * chega — mas o trilho de pin foi medido antes de o `<video>` ter dimensão
   * intrínseca, e medir de novo custa um quadro. Em 4G do interior é a
   * diferença entre a cena terminar no lugar certo e terminar depois do fim.
   */
  ScrollTrigger.refresh();

  /**
   * O VIGIA — a parte honesta desta cena.
   *
   * Seek programático em mobile não é confiável e não adianta fingir que é. Em
   * WebView de Instagram, em iOS com economia de dados, em Android antigo, o
   * `currentTime` pode simplesmente não se mover. O sintoma para o usuário não
   * é "o vídeo travou": é uma seção que prende o scroll por duas telas mostrando
   * um quadro parado. Isso é pior do que não ter a cena.
   *
   * Então a cena verifica a si mesma: se pedimos seeks e o browser não atendeu
   * nenhum, ela desiste do scrub, solta o pin e vira o que sempre foi seu
   * estado de repouso — o hambúrguer montado. Perde-se a animação; não se perde
   * a página.
   */
  setTimeout(() => {
    if (seeksPedidos === 0) return; // ninguém rolou ainda; nada a julgar
    if (seeksAtendidos > 0) return; // está buscando, a cena é válida
    degradarParaEstatico();
  }, LIMITE_VIGIA_MS);

  function degradarParaEstatico() {
    trilho.scrollTrigger?.kill(true); // true = reverte o pin e o pinSpacing
    trilho.kill();
    gsap.set([conteudo, veu].filter(Boolean), { clearProps: 'all' });
    palco.removeAttribute('data-pronto');

    /**
     * Reproduzir funciona onde buscar falha.
     *
     * O device que não aceita seek quase sempre aceita play — são caminhos
     * diferentes no decodificador. Sem o pin a cena não dirige mais nada, mas
     * ainda dá para tocar a montagem uma vez quando ela entra em quadro. É
     * pior que o scrub e melhor que uma foto parada, e não custa nenhum byte
     * novo: o arquivo já está baixado.
     */
    palco.setAttribute('data-degradado', '');
    const observador = new IntersectionObserver(
      (entradas) => {
        if (!entradas.some((e) => e.isIntersecting)) return;
        observador.disconnect();
        video.currentTime = 0;
        palco.setAttribute('data-pronto', '');
        video.play().catch(() => {
          // Nem play funcionou. Fica o <picture> montado, que é o contrato.
          palco.removeAttribute('data-pronto');
        });
      },
      { threshold: 0.4 }
    );
    observador.observe(secao);
  }
}
