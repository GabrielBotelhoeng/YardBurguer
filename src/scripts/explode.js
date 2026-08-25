/**
 * Cena 2 — a montagem do burger. Chunk carregado sob demanda por motion.js.
 *
 * Só este arquivo importa GSAP + ScrollTrigger, e é o único lugar da página
 * que justifica esse peso: pin com scrub em 7 camadas não se faz com CSS.
 *
 * A CENA FOI INVERTIDA (pedido do cliente, 2026-08-25).
 *
 * Antes: o burger chegava montado e se separava conforme o scroll. O problema
 * não era a mecânica, era a promessa — o usuário via um hambúrguer se destruir.
 * Agora os ingredientes chegam espalhados e o scroll os monta: cada peça pousa
 * no lugar, de baixo para cima, até virar um hambúrguer de verdade. O scroll
 * deixa de desmanchar e passa a construir, e é o ato de construir que dá
 * vontade de comer.
 *
 * O estado de REPOUSO no CSS continua sendo o hambúrguer montado. Isso não é
 * detalhe: sem JS e sob prefers-reduced-motion a cena precisa mostrar o produto
 * inteiro, não peças soltas. A dispersão é aplicada pelo GSAP como ponto de
 * PARTIDA da animação, então o fim do trilho coincide exatamente com o estado
 * estático — a animação converge para o HTML, em vez de divergir dele.
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

  /**
   * Todas as sete camadas rodam em qualquer viewport desde que o manifest passou
   * a marcar mobile:true no conjunto inteiro. O filtro continua aqui porque o
   * contrato do manifest ainda permite excluir camada — mas hoje ele não corta
   * nada, e a auditoria justifica: a cena é lazy e não toca o LCP.
   */
  const camadas = Array.from(secao.querySelectorAll('.explode__camada')).filter(
    (camada) => !ehMobile || camada.dataset.mobile === 'true'
  );
  if (!camadas.length) return;

  const fundo = secao.querySelector('[data-parallax]');

  const trilho = gsap.timeline({
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
   * Quanto as peças partem afastadas.
   *
   * explodeY do manifest é o deslocamento que a camada tinha na versão que
   * explodia. Espalhar precisa de mais do que separar: numa cena que separa, o
   * olho parte do produto inteiro e acompanha; numa cena que monta, o olho
   * precisa ler "peças soltas" no primeiro quadro, senão a montagem não tem
   * de onde sair. 1.35 é o ponto em que as camadas deixam de se tocar sem que
   * as extremas saiam do quadro.
   */
  const DISPERSAO = 1.35;

  /**
   * No celular o alcance é reduzido. Os valores do manifest foram calibrados
   * para desktop; aplicados em 390px de largura, a camada de cima sairia da
   * tela e a dispersão viraria "ingredientes sumindo pra cima".
   */
  const alcance = ehMobile ? 0.55 : 1;

  /**
   * Espalhar não é só afastar no eixo Y.
   *
   * Deslocamento apenas vertical lê como um hambúrguer esticado, não como peças
   * espalhadas. Um desvio lateral alternado e um giro leve quebram a coluna e
   * fazem cada ingrediente parecer que caiu onde caiu. Tudo volta a zero no
   * fim — é o que garante que o último quadro seja exatamente o estado estático
   * do HTML.
   */
  const DESVIO_X = ehMobile ? 26 : 64;
  const GIRO = ehMobile ? 4 : 7;

  /**
   * Ordem de chegada: de baixo para cima, como se monta um hambúrguer de
   * verdade. O pão inferior pousa primeiro e o superior fecha por último.
   *
   * As camadas vêm do DOM na ordem visual (pão de cima primeiro), então a
   * ordem de montagem é a inversa.
   */
  const ordemDeMontagem = [...camadas].reverse();

  const PASSO = 0.055;
  const DURACAO = 0.42;
  const fimDaMontagem = (ordemDeMontagem.length - 1) * PASSO + DURACAO;

  /**
   * O conjunto começa menor e cresce enquanto monta.
   *
   * Sem isso a cena é geometricamente impossível: a pilha montada mede 537px de
   * um viewport de 889, e separar sete camadas o bastante para nenhuma encostar
   * na outra exige uns 720px a mais de respiro. Medido no browser, a versão sem
   * escala cortava 109px do pão de cima e 194px do de baixo.
   *
   * Reduzir a escala no início resolve o transbordo e ainda entrega um segundo
   * efeito de graça: o hambúrguer parece se aproximar da câmera conforme se
   * monta. O deslocamento vertical junto compensa o fato de a pilha nascer
   * abaixo do centro do viewport — o texto ocupa o topo do fluxo, então o
   * conjunto espalhado precisa subir para caber simétrico.
   */
  const pilha = secao.querySelector('.explode__camadas');
  if (pilha) {
    trilho.fromTo(
      pilha,
      { scale: ehMobile ? 0.7 : 0.62, y: ehMobile ? -60 : -100 },
      { scale: 1, y: 0, ease: 'none', duration: fimDaMontagem },
      0
    );
  }

  ordemDeMontagem.forEach((camada, posicao) => {
    const indiceNoDom = camadas.indexOf(camada);
    const dispersao = Number(camada.dataset.explodeY ?? 0) * DISPERSAO * alcance;

    // Alterna o lado pelo índice visual, não pelo de montagem: o que importa é
    // que camadas vizinhas no empilhamento caiam para lados opostos.
    const lado = indiceNoDom % 2 === 0 ? 1 : -1;
    const distanciaDoCentro = Math.abs(indiceNoDom - (camadas.length - 1) / 2);
    const peso = distanciaDoCentro / ((camadas.length - 1) / 2 || 1);

    trilho.fromTo(
      camada,
      {
        y: dispersao,
        x: lado * DESVIO_X * peso,
        rotation: lado * GIRO * peso,
      },
      {
        y: 0,
        x: 0,
        rotation: 0,
        ease: 'none',
        duration: DURACAO,
      },
      posicao * PASSO
    );
  });

  /**
   * O título entra depois que o hambúrguer fecha.
   *
   * Na versão anterior o texto precisava sair de cena porque o pão de cima
   * subia por cima dele. Aqui o problema se resolve pela narrativa em vez de
   * pelo remendo: enquanto as peças estão no ar, a cena é sobre o movimento;
   * quando o hambúrguer fica pronto, o título aparece e nomeia o que acabou de
   * ser montado.
   *
   * Sob prefers-reduced-motion nada disso roda e o texto nasce visível pelo CSS.
   */
  const conteudo = secao.querySelector('.explode__conteudo');
  if (conteudo) {
    trilho.fromTo(
      conteudo,
      { opacity: 0, y: 24 },
      { opacity: 1, y: 0, ease: 'none', duration: 0.16 },
      Math.max(0, fimDaMontagem - 0.04)
    );
  }

  // Texto de fundo: mais lento que qualquer ingrediente. É a diferença de
  // velocidade contra as camadas que cria a profundidade.
  if (fundo) {
    const fator = Number(fundo.dataset.parallax ?? 0.15);
    trilho.to(fundo, { y: -220 * fator, ease: 'none', duration: 1 }, 0);
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
