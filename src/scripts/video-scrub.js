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

  /**
   * A CONTRAPARTIDA DA RESERVA.
   *
   * O CSS reserva `--trilho-pin` desde o primeiro paint para o pin não precisar
   * inserir espaço com a cena na tela. Mas há caminhos em que o pin NUNCA é
   * criado — sem `<video>`, sem fonte para este aparelho, erro de mídia, ou o
   * arquivo pendurado numa conexão que aceita a conexão e não entrega byte. Em
   * qualquer um deles a reserva viraria um buraco de uma tela e meia entre a
   * cena e a seção seguinte, e ninguém ligaria o vazio à causa.
   *
   * Então a reserva é uma promessa com prazo: se em 8s não existir pin para
   * ocupá-la, ela é devolvida. Some um espaço que ninguém estava usando — o
   * caso ruim de um caminho que já era o caminho ruim.
   */
  /**
   * O trilho é o div vazio logo depois da seção — irmão, não filho.
   *
   * Precisa ser irmão: quando o ScrollTrigger pina, a seção sai do fluxo e
   * qualquer espaço reservado DENTRO dela sai junto. A primeira tentativa de
   * correção usava `margin-bottom` na própria seção e o layout continuava
   * saltando exatamente por isso — o documento nascia com a altura certa e
   * perdia 800px no instante do pin.
   */
  const reservaDoTrilho = secao.parentElement?.querySelector('[data-reserva-trilho]');
  const liberarReserva = () => reservaDoTrilho?.setAttribute('data-sem-trilho', '');
  const relogioDaReserva = setTimeout(liberarReserva, 8000);
  const desistir = () => {
    clearTimeout(relogioDaReserva);
    liberarReserva();
  };

  if (!video || !palco) return desistir();

  await ligarPonteLenis(ScrollTrigger, gsap);

  /**
   * Um arquivo por aparelho, escolhido aqui e não por `<source media>`.
   *
   * A seleção por media dentro de `<video>` é mal suportada — ao contrário de
   * `<picture>`, vários browsers ignoram o atributo e pegam o primeiro source.
   * Como o src já era atribuído por JS de qualquer forma (para não baixar nada
   * sob reduced-motion), escolher aqui não custa nada e é determinístico.
   *
   * O arquivo do celular é um quadro VERTICAL COMPOSTO (9:16), não um corte do
   * 16:9. O material é horizontal e a tela do celular é altíssima: cortar para
   * preencher exigiria uma faixa de 498px do original, e o hambúrguer sozinho
   * tem 780px — decaparia o pão pelas laterais. Então o ffmpeg monta o quadro:
   * o recorte nítido do hambúrguer na largura toda, sobre o mesmo recorte
   * ampliado e desfocado preenchendo o que sobra em cima e embaixo. Ver
   * encodar-video-cena2.mjs para a receita e os números.
   *
   * A CONSULTA VEM DO HTML, não daqui — é a mesma string que o `<picture>` usa
   * no `media` do poster (ver o cabeçalho de VideoScene.astro). Escrever a
   * pergunta duas vezes é como poster e vídeo passaram a discordar de
   * proporção; lendo do DOM, existe uma resposta só.
   *
   * `ehMobile` (a media query de largura vinda do motion.js) NÃO serve para esta
   * escolha: ela responde pela largura, que muda quando o aparelho gira. Um
   * iPhone 14 deitado tem 844px de largura e era classificado como desktop —
   * baixava 1102 kB em vez dos 688 kB do vertical. A consulta do HTML pergunta
   * pelo lado curto e por isso dá a mesma resposta nas duas orientações.
   *
   * O que isso compra, e é o motivo de não haver troca de fonte na rotação: se
   * a resposta não muda ao girar, não há arquivo novo para buscar, não há
   * `currentTime` para reposicionar no meio da troca e não há salto para o
   * usuário ver. A alternativa — trocar o src no `resize` — custaria um segundo
   * download de 582 kB e uma janela em que o vídeo não tem quadro para mostrar,
   * para resolver um problema que simplesmente deixa de acontecer.
   */
  const consultaCelular = video.dataset.consultaCelular;
  const ehTelaDeCelular = consultaCelular
    ? window.matchMedia(consultaCelular).matches
    : ehMobile; // sem o atributo, o comportamento antigo em vez de nenhum vídeo

  const fonte = ehTelaDeCelular ? video.dataset.srcVertical : video.dataset.srcLarga;
  if (!fonte) return desistir();

  video.src = fonte;
  // preload só entra junto com o src: antes disso não há o que pré-carregar, e
  // deixar "auto" no HTML faria o browser buscar mesmo sob reduced-motion.
  video.preload = 'auto';
  video.load();

  const desfecho = await esperarVideoUtil(video);
  if (desfecho === 'erro') return desistir(); // fica o <picture>, o estado de repouso

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
   * DECIDE `cover` vs `contain` COMPARANDO ARQUIVO E PALCO.
   *
   * O CSS não consegue fazer esta conta: ele não conhece a proporção do arquivo,
   * e o palco é o viewport menos a navbar, então nem a proporção da tela serve
   * de proxy — 1440x900 é 1,60 de viewport e 1,748 de palco. Uma tentativa de
   * escrever isso em `aspect-ratio` derrubou 1440x900 e o iPhone 14 para
   * `contain` e liberou o iPad mini para um `cover` que cortava 20% da altura.
   *
   * Aqui as duas grandezas estão à mão. `cover` só entra se o corte couber na
   * margem que o encode embutiu; caso contrário fica o `contain` do CSS, que
   * mostra o produto inteiro e aceita faixa de carvão.
   *
   * MARGEM_SEGURA é 0,15 porque o encode compõe com RECUO = 0,85 — 7,5% de
   * preenchimento por lado, ou 15% num eixo. Se aquele número mudar, este muda
   * junto; são o mesmo fato escrito nas duas pontas.
   */
  const MARGEM_SEGURA = 0.15;

  function ajustarEnquadramento() {
    const r = palco.getBoundingClientRect();
    if (!r.width || !r.height || !video.videoWidth || !video.videoHeight) return;
    const arquivo = video.videoWidth / video.videoHeight;
    const caixa = r.width / r.height;
    // Quanto o cover comeria do eixo mais apertado.
    const corte = 1 - Math.min(arquivo, caixa) / Math.max(arquivo, caixa);
    palco.toggleAttribute('data-fit', false);
    if (corte <= MARGEM_SEGURA) palco.setAttribute('data-fit', 'cover');
  }

  ajustarEnquadramento();
  // Girar o aparelho muda o palco e pode virar o veredito. `resize` cobre a
  // rotação em todo browser; `orientationchange` sozinho não dispara em desktop.
  window.addEventListener('resize', ajustarEnquadramento, { passive: true });

  /**
   * O trilho é o MESMO da variante em camadas: +=180% no desktop, +=110% no
   * mobile. Não é preguiça — é o que torna as duas versões comparáveis lado a
   * lado. O cliente vai julgar o material, não o comprimento do trilho.
   *
   * QUEM DECIDE É `ehTelaDeCelular`, NÃO `ehMobile`. Esta linha usava o
   * `ehMobile` do motion.js, que era `matchMedia('(max-width: 767px)')` avaliado
   * UMA VEZ no load — o mesmo defeito que já tinha sido corrigido para a escolha
   * do arquivo, ainda vivo num segundo consumidor. Consertaram o arquivo e
   * esqueceram o trilho.
   *
   * O que isso produzia, medido em A/B no build de produção, com o viewport
   * final IDÊNTICO em 390x844: 928px de trilho se a página abriu em pé, 1519px
   * se abriu deitada e girou. +64% de trilho, metade do ritmo da cena, decidido
   * por uma coisa que o usuário não escolheu.
   *
   * `ehTelaDeCelular` sai da consulta por LADO CURTO, que é invariante à
   * rotação. Ela dá a mesma resposta em pé e deitado, então o trilho para de
   * depender de como a página nasceu — e continua não havendo o que retrocarregar
   * ao girar, porque é a mesma pergunta que escolheu o arquivo.
   *
   * Em números com o material atual: 8s a 24fps são 192 quadros. No desktop,
   * 180% de uma tela de 900px são 1620px de scroll — ~7,9px por quadro (era 6,3
   * com os 240 quadros do take de 10s). No celular são ~4,5px. Um clique de roda
   * avança 12 a 25 quadros: continua lendo como contínuo.
   */
  const estado = { t: 0 };

  /**
   * O COMPRIMENTO DO TRILHO VEM DO CSS, e por um motivo específico.
   *
   * Era `'+=110%'` / `'+=180%'` aqui, e o ScrollTrigger reservava o espaço
   * sozinho, com `pinSpacing`. O problema não era o número: era QUANDO ele
   * passava a existir. O pin só é montado depois que o chunk do GSAP e o
   * primeiro quadro do vídeo chegam, e em 4G do interior isso acontece com a
   * cena já na tela — 1527px de espaçador entrando de uma vez, 800px de
   * conteúdo empurrados na cara da pessoa. CLS 1,8473 contra meta de 0,1.
   *
   * Agora `--trilho-pin` no CSS reserva esse espaço desde o primeiro paint, e
   * este `end` LÊ o que foi reservado em vez de trazer o próprio número. Os
   * dois não podem divergir: se divergissem, sobraria espaço vazio no fim da
   * cena ou o trilho terminaria fora do quadro.
   *
   * `getComputedStyle` devolve px resolvidos, então svh, notch e barra de URL
   * já vêm embutidos — e `invalidateOnRefresh` faz a conta de novo quando o
   * aparelho gira.
   */
  const comprimentoDoTrilho = () =>
    Math.round(reservaDoTrilho?.getBoundingClientRect().height ?? 0) || 0;

  const trilho = gsap.timeline({
    scrollTrigger: {
      trigger: secao,
      start: 'top top',
      end: () => `+=${comprimentoDoTrilho()}`,
      /**
       * O espaço já existe no documento (ver `--trilho-pin`); se o
       * ScrollTrigger criasse o dele, a cena passaria a ocupar o dobro.
       */
      pinSpacing: false,
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

  // O pin existe: a reserva tem dono e o prazo não corre mais.
  clearTimeout(relogioDaReserva);

  /**
   * O guarda de quadro.
   *
   * Sem ele, `onUpdate` atribui `currentTime` a cada quadro do ticker — até 60
   * vezes por segundo — para buscar posições que caem TODAS dentro do mesmo
   * quadro de vídeo. O decodificador recebe uma fila de seeks redundantes,
   * cancela cada um no meio para atender o próximo e o resultado é um vídeo que
   * trava justamente enquanto se rola.
   *
   * MEDIDO (2026-08-25, trilho inteiro percorrido em 4,3s, build de produção,
   * com o take de 10s que havia então): 261 quadros de ticker produziram 160
   * seeks em vez de 261 — 39% a menos, com 0 seeks perdidos e o currentTime
   * chegando ao fim da duração. O corte é maior quanto
   * mais devagar se rola, que é justamente quando mais quadros de ticker caem
   * dentro do mesmo quadro de vídeo. E não muda um pixel do que se vê: buscar
   * duas posições dentro do mesmo quadro mostra o mesmo quadro.
   */
  const QUADRO = 1 / FPS;
  let aplicado = -1;
  let seeksAtendidos = 0;
  /** Timer do vigia. Nasce nulo: o relogio so comeca quando ha o que vigiar. */
  let vigia = null;

  video.addEventListener('seeked', () => {
    seeksAtendidos += 1;
  });

  /**
   * O QUADRO DE RECOMPENSA — por que a montagem acaba em 0.94 e não em 1.00.
   *
   * A cena inteira existe para chegar em um instante: o hambúrguer fechado, o
   * título aceso por cima dele, e tudo parado tempo suficiente para a pessoa
   * olhar. Até 2026-08-26 esse instante NÃO EXISTIA, e a causa era aritmética.
   *
   * O tween do texto começava em 0.86 e durava 0.16, terminando em 1.02. O GSAP
   * não trunca: ele estica a duração da timeline para 1.02 e o ScrollTrigger
   * passa a mapear o trilho inteiro sobre 0→1.02. Medido: no último quadro ainda
   * pinado a opacidade do título era 0,918 em 390x844 e 0,991 em 375x667 — ele
   * só fechava DEPOIS que o pin soltava e a cena já estava subindo.
   *
   * Fechar em 1.00 corrige a conta e não entrega a cena: aí o título completa
   * exatamente no ÚLTIMO PIXEL do pin. Medido também, e dá zero quadro de
   * recompensa — um ponto não é uma pausa.
   *
   * Então a montagem toda (vídeo, véu e texto) acaba em 0.94 e os últimos 6% do
   * trilho não animam nada. Não é tempo perdido: é o único trecho em que existe
   * o quadro que a cena promete. Em números, 6% de 110% de uma tela de 844 são
   * ~56px de rolagem com tudo pronto e a seção ainda travada.
   */
  const FIM_DA_MONTAGEM = 0.94;

  trilho.to(
    estado,
    {
      t: duracao,
      ease: 'none',
      duration: FIM_DA_MONTAGEM,
      onUpdate: () => {
        // readyState 2 = HAVE_CURRENT_DATA: abaixo disso o seek entra numa fila
        // que nunca esvazia e a cena engasga em vez de esperar.
        if (video.readyState < 2) return;
        if (Math.abs(estado.t - aplicado) < QUADRO) return;
        aplicado = estado.t;
        // O vigia conta a partir DAQUI — do primeiro seek de verdade, nao da
        // inicializacao da cena, que acontece uma tela antes de alguem rolar.
        armarVigia();
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
  const DUR_VEU = 0.14;
  if (veu) {
    trilho.fromTo(
      veu,
      { opacity: 0 },
      { opacity: 1, ease: 'none', duration: DUR_VEU },
      FIM_DA_MONTAGEM - DUR_VEU
    );
  }

  /**
   * O texto fecha JUNTO com o véu, em 0.94 — nunca depois.
   *
   * A duração é menor que a do véu (0.10 contra 0.14) de propósito: é isso que
   * mantém a regra antiga de que o véu entra primeiro. Ele começa 0.04 antes e
   * os dois terminam no mesmo ponto, então em qualquer instante da entrada do
   * texto o véu está mais adiantado na própria rampa — o creme nunca pousa sobre
   * a tábua clara desprotegida.
   *
   * A duração encolheu de 0.16 para 0.10 porque 0.16 não cabia: começando em
   * 0.86, ela terminava em 1.02 e era exatamente o que impedia o título de
   * fechar enquanto a cena ainda estava pinada.
   */
  const DUR_TEXTO = 0.1;
  if (conteudo) {
    trilho.fromTo(
      conteudo,
      { opacity: 0, y: 24 },
      { opacity: 1, y: 0, ease: 'none', duration: DUR_TEXTO },
      FIM_DA_MONTAGEM - DUR_TEXTO
    );
  }

  /**
   * O HOLD. Um tween vazio que não move nada e existe só para a timeline durar
   * 1.00 em vez de 0.94.
   *
   * Sem ele o GSAP encerraria a timeline no último tween (0.94) e o
   * ScrollTrigger normalizaria o trilho sobre 0→0.94 — o que reescalaria tudo e
   * devolveria o problema: o fim da montagem voltaria a coincidir com o fim do
   * pin. É este trecho morto que transforma os 6% finais em pausa de verdade.
   */
  trilho.to({}, { duration: 1 - FIM_DA_MONTAGEM }, FIM_DA_MONTAGEM);

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
   * O palco é dimensionado por CSS antes de qualquer byte chegar, então o layout
   * não salta quando o vídeo chega — mas o trilho de pin foi medido antes de o
   * `<video>` ter dimensão intrínseca, e medir de novo custa um quadro. Em 4G do interior é a
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
   *
   * QUANDO O RELÓGIO COMEÇA — e por que não é aqui.
   *
   * Até o review de 2026-08-26 este `setTimeout` era armado na inicialização da
   * cena e disparava uma única vez, 2,5s depois. Só que a cena inicializa com
   * `rootMargin: '100% 0px'` — uma tela inteira ANTES de aparecer. Quem rola em
   * ritmo humano chega no trilho muito depois desses 2,5s, o vigia já disparou
   * sem nenhum seek pedido, voltou pelo `return` de "nada a julgar" e nunca mais
   * foi consultado. Ou seja: a rede de segurança desta cena não pegava ninguém,
   * exceto quem rolasse a página em menos de dois segundos e meio.
   *
   * Agora o relógio parte do PRIMEIRO seek pedido (ver `armarVigia` no
   * `onUpdate`), que é o instante em que passa a existir algo para julgar.
   *
   * O QUE ESTE VIGIA **NÃO** COBRE — medido em 2026-08-26, e vale saber antes de
   * confiar nele:
   *
   * Ele só enxerga o caso "seek pedido e não atendido". O caso do vídeo que
   * nunca bufferiza passa por fora: o `onUpdate` do tween sai cedo no
   * `readyState < 2`, antes de pedir qualquer seek, então o vigia nem chega a
   * ser armado.
   *
   * Testado pendurando o mp4 (conexão aberta, zero bytes — o 4G do interior
   * travando, não um 404): a cena não prende o usuário, mas quem salva NÃO é
   * este vigia. O que salva é o `await video.play()` lá em cima nunca resolver
   * com `readyState 0`, de modo que a timeline e o pin jamais chegam a ser
   * criados e a seção rola normalmente com o `<picture>` na tela. Verificado:
   * 12s depois, sem pin-spacer e sem trava.
   *
   * O resultado para o usuário está certo. A rede que o segura é outra. Se um
   * dia alguém trocar aquele `await` por algo com timeout, este vigia não vai
   * assumir o posto sozinho — vai precisar contar também os seeks recusados por
   * falta de dado.
   */
  function armarVigia() {
    // Uma vez só: o prazo vale a partir do primeiro seek e não se renova a cada
    // quadro de ticker, senão ele nunca vence e o julgamento nunca acontece.
    if (vigia !== null) return;
    vigia = setTimeout(() => {
      if (seeksAtendidos > 0) return; // está buscando, a cena é válida
      degradarParaEstatico();
    }, LIMITE_VIGIA_MS);
  }

  function degradarParaEstatico() {
    // A cena já foi julgada; um timer sobrevivente só faria isto de novo.
    clearTimeout(vigia);
    trilho.scrollTrigger?.kill(true); // true = reverte o pin e o pinSpacing
    trilho.kill();
    // Sem pin, a reserva do CSS não tem mais ocupante: devolver, senão fica um
    // vão de uma tela e meia entre a cena degradada e a seção seguinte.
    liberarReserva();
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
