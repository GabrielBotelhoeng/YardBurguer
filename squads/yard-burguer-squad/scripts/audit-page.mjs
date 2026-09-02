import { chromium, devices } from 'playwright';
import { writeFileSync } from 'node:fs';

const URL_BASE = process.env.ALVO;

/**
 * Auditoria com medição real, não estimativa.
 *
 * O throttling é aplicado via CDP porque o perfil do budget é 4G do interior
 * com CPU mid-range — medir em Wi-Fi de desktop responderia a pergunta errada.
 */
const REDE_4G_LENTA = {
  offline: false,
  downloadThroughput: (1.6 * 1024 * 1024) / 8,
  uploadThroughput: (750 * 1024) / 8,
  latency: 150,
};

async function medirWebVitals(pagina) {
  return pagina.evaluate(
    () =>
      new Promise((resolve) => {
        const resultado = { lcp: 0, cls: 0, lcpElemento: null };

        new PerformanceObserver((lista) => {
          const entradas = lista.getEntries();
          const ultima = entradas[entradas.length - 1];
          resultado.lcp = ultima.startTime;
          resultado.lcpElemento = ultima.element
            ? `${ultima.element.tagName}${ultima.element.className ? '.' + String(ultima.element.className).split(' ')[0] : ''}`
            : ultima.url || null;
        }).observe({ type: 'largest-contentful-paint', buffered: true });

        new PerformanceObserver((lista) => {
          for (const entrada of lista.getEntries()) {
            // Só conta shift que o usuário não causou.
            if (!entrada.hadRecentInput) resultado.cls += entrada.value;
          }
        }).observe({ type: 'layout-shift', buffered: true });

        // Deixa o scroll acontecer para capturar shift tardio das camadas lazy.
        setTimeout(() => {
          window.scrollTo(0, document.body.scrollHeight / 2);
          setTimeout(() => {
            window.scrollTo(0, document.body.scrollHeight);
            setTimeout(() => resolve(resultado), 2500);
          }, 2500);
        }, 1500);
      })
  );
}

/**
 * A MEDIDA DE ACESSIBILIDADE, extraida para rodar em QUALQUER orientacao.
 *
 * Estava embutida no bloco de retrato, e por isso a passada de paisagem so
 * conseguia coletar alvo de toque. O relatorio, porem, afirmava contraste em
 * paisagem — numero obtido a mao, fora deste script. Gate que afirma o que o
 * proprio instrumento nao coleta e exatamente o defeito que esta rodada veio
 * corrigir; ficar com metade dele seria repetir o erro em escala menor.
 */
const MEDIR_A11Y = () => {
    const luminancia = (r, g, b) => {
      const f = (c) => {
        c /= 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    /**
     * Alfa importa. A primeira versão lia os três primeiros números do rgba e
     * tratava como opaco — e reportou contraste 1 nos cards de combo, que na
     * verdade passam com 5.14. Falso positivo em auditoria é pior que nenhuma
     * auditoria: manda corrigir o que não está quebrado.
     */
    const parse = (cor) => {
      const n = (cor.match(/[\d.]+/g) || []).map(Number);
      return { rgb: n.slice(0, 3), alfa: n.length > 3 ? n[3] : 1 };
    };
    const misturar = (frente, fundo) =>
      frente.rgb.map((c, i) => Math.round(c * frente.alfa + fundo[i] * (1 - frente.alfa)));
    const contraste = (a, b) => {
      const [l1, l2] = [luminancia(...a), luminancia(...b)].sort((x, y) => y - x);
      return (l1 + 0.05) / (l2 + 0.05);
    };

    /** Sobe na árvore até achar um fundo que não seja transparente. */
    const fundoReal = (el) => {
      const camadas = [];
      let no = el;
      while (no && no !== document.documentElement) {
        const bg = parse(getComputedStyle(no).backgroundColor);
        if (bg.alfa > 0) {
          camadas.push(bg);
          if (bg.alfa === 1) break;
        }
        no = no.parentElement;
      }
      // Compõe de trás para frente até chegar num fundo opaco.
      let resultado = [20, 12, 6];
      for (const camada of camadas.reverse()) resultado = misturar(camada, resultado);
      return resultado;
    };

    const textos = Array.from(
      document.querySelectorAll('h1,h2,h3,p,a,dt,dd,address,span,li')
    ).filter((el) => (el.textContent || '').trim().length > 2 && el.offsetParent !== null);

    const contrastes = textos.map((el) => {
      const s = getComputedStyle(el);
      const tamanho = parseFloat(s.fontSize);
      const peso = Number(s.fontWeight) || 400;
      const grande = tamanho >= 24 || (tamanho >= 18.66 && peso >= 700);
      const razao = contraste(misturar(parse(s.color), fundoReal(el)), fundoReal(el));
      return {
        texto: (el.textContent || '').trim().slice(0, 40),
        tag: el.tagName,
        razao: Math.round(razao * 100) / 100,
        minimo: grande ? 3 : 4.5,
        ok: razao >= (grande ? 3 : 4.5),
      };
    });

    const imagens = Array.from(document.querySelectorAll('img')).map((img) => ({
      src: img.getAttribute('src'),
      alt: img.getAttribute('alt'),
      ariaHidden: img.getAttribute('aria-hidden') === 'true',
      temDimensoes: !!(img.getAttribute('width') && img.getAttribute('height')),
    }));

    return {
      contrastes: contrastes.filter((c) => !c.ok),
      totalTextos: contrastes.length,
      imagens,
      imagensSemAlt: imagens.filter((i) => i.alt === null && !i.ariaHidden),
      semDimensoes: imagens.filter((i) => !i.temDimensoes),
      idioma: document.documentElement.lang,
      h1: document.querySelectorAll('h1').length,
      landmarks: {
        header: document.querySelectorAll('header').length,
        main: document.querySelectorAll('main').length,
        footer: document.querySelectorAll('footer').length,
        nav: document.querySelectorAll('nav').length,
      },
    };
};

async function auditar() {
  const navegador = await chromium.launch();
  const relatorio = {};

  // ---------- Mobile com throttling ----------
  const ctxMobile = await navegador.newContext({
    ...devices['Pixel 5'],
  });
  const mobile = await ctxMobile.newPage();

  const cdp = await ctxMobile.newCDPSession(mobile);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', REDE_4G_LENTA);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });

  /**
   * O PESO É LIDO DO CDP, NÃO DO `content-length`. E ISSO NÃO É PREFERÊNCIA.
   *
   * A versão anterior somava o cabeçalho `content-length` de cada resposta. O
   * `astro preview` — e qualquer servidor que comprima na hora — responde com
   * `Transfer-Encoding: chunked` quando o Chromium pede gzip, e resposta
   * chunked NÃO TEM `content-length`. O `?? 0` transformava isso em zero, e o
   * gate somava **0 byte** para todo script, todo CSS e o próprio HTML.
   *
   * O estrago medido em 2026-09-02: o relatório dizia 1,217 MB contra teto de
   * 1,5 MB, com "224 kB de folga". O peso real era 1,480 MB — a folga era de
   * 20 kB, 1,3%. Um gate com poder de veto passou meses afirmando uma margem
   * que não existia, sem nunca acusar erro: recurso não medido não aparece
   * como falha, aparece como leveza.
   *
   * `Network.loadingFinished.encodedDataLength` é o byte que de fato passou
   * pela rede, JÁ COMPRIMIDO, informado pelo próprio navegador quando o
   * download termina. Não depende de cabeçalho nenhum.
   *
   * O PLANO B ÓBVIO ESTÁ ERRADO: `response.body()` devolve o corpo
   * DESCOMPRIMIDO. Quem tentou isso mediu 1,646 MB na mesma página — infla
   * tudo que é texto e reprova build que passa. Não voltar a esse caminho.
   */
  const recursos = [];
  const emVoo = new Map();

  cdp.on('Network.responseReceived', (e) => {
    emVoo.set(e.requestId, {
      url: e.response.url,
      status: e.response.status,
      // O CDP usa 'Document'/'Stylesheet'/'Media'; o resto do relatório sempre
      // falou minúsculo, herdado do resourceType() do Playwright.
      tipo: String(e.type ?? 'Other').toLowerCase(),
      bytes: 0,
    });
  });

  cdp.on('Network.loadingFinished', (e) => {
    const recurso = emVoo.get(e.requestId);
    if (!recurso) return;
    recurso.bytes = e.encodedDataLength;
    recursos.push(recurso);
    emVoo.delete(e.requestId);
  });

  // Requisição que falhou não entrega byte e não pode entrar na conta — nem
  // ficar pendurada no mapa até o fim da execução.
  cdp.on('Network.loadingFailed', (e) => emVoo.delete(e.requestId));

  const erros = [];
  mobile.on('pageerror', (e) => erros.push(e.message));
  mobile.on('console', (m) => {
    if (m.type() === 'error') erros.push(`console: ${m.text()}`);
  });

  await mobile.goto(URL_BASE, { waitUntil: 'load', timeout: 120000 });

  /**
   * LCP À CHEGADA — medido ANTES de `medirWebVitals`, que rola a página.
   *
   * O LCP só congela no primeiro input REAL, e scroll programático não é input.
   * Então o número que sai depois da rolagem é o maior elemento pintado em
   * QUALQUER ponto da página: em 26/08 deu 4,8s apontando para uma foto de
   * cardápio que a pessoa só vê depois de rolar. O LCP que descreve a chegada é
   * este aqui — 1,69s, no H1 do hero.
   */
  relatorio.lcpChegada = await mobile.evaluate(
    () =>
      new Promise((resolve) => {
        const r = { lcp: 0, elemento: null, cls: 0 };
        new PerformanceObserver((l) => {
          const u = l.getEntries().at(-1);
          r.lcp = u.startTime;
          r.elemento = u.element
            ? `${u.element.tagName}${u.element.className ? '.' + String(u.element.className).split(' ')[0] : ''}`
            : u.url || null;
        }).observe({ type: 'largest-contentful-paint', buffered: true });
        new PerformanceObserver((l) => {
          for (const e of l.getEntries()) if (!e.hadRecentInput) r.cls += e.value;
        }).observe({ type: 'layout-shift', buffered: true });
        setTimeout(() => resolve(r), 6000);
      })
  );

  relatorio.vitals = await medirWebVitals(mobile);
  relatorio.erros = erros;

  relatorio.rede = {
    requisicoes: recursos.length,
    quatroCentoQuatro: recursos.filter((r) => r.status === 404).map((r) => r.url),
    porTipo: recursos.reduce((acc, r) => {
      acc[r.tipo] = (acc[r.tipo] ?? 0) + r.bytes;
      return acc;
    }, {}),
    totalBytes: recursos.reduce((s, r) => s + r.bytes, 0),
  };

  // ---------- Área de toque dos CTAs ----------
  /**
   * Só entra o que EXISTE na tela.
   *
   * A versão anterior media todo `a` e `button` do documento, inclusive os
   * ocultos por `display: none` — que devolvem 0x0 e eram contados como
   * reprovados. Em 26/08 isso produziu "3 alvos de 0px na navbar" em retrato,
   * onde esses links nem aparecem. Alvo invisível não é alvo de toque, e falso
   * positivo em gate com veto manda corrigir o que não está quebrado.
   */
  relatorio.toque = await mobile.evaluate(() =>
    Array.from(document.querySelectorAll('a, button'))
      .map((el) => {
        const r = el.getBoundingClientRect();
        return {
          texto: (el.textContent || '').trim().slice(0, 32),
          classe: String(el.className || '').split(' ')[0],
          largura: Math.round(r.width),
          altura: Math.round(r.height),
          visivel: el.offsetParent !== null && r.width > 0 && r.height > 0,
          ok: r.width >= 44 && r.height >= 44,
        };
      })
      .filter((t) => t.visivel)
  );

  // ---------- Acessibilidade ----------
  relatorio.a11y = await mobile.evaluate(MEDIR_A11Y);

  // ---------- Navegação por teclado ----------
  await mobile.evaluate(() => window.scrollTo(0, 0));
  const ordemFoco = [];
  for (let i = 0; i < 14; i++) {
    await mobile.keyboard.press('Tab');
    const foco = await mobile.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const s = getComputedStyle(el);
      return {
        tag: el.tagName,
        texto: (el.textContent || '').trim().slice(0, 30),
        outline: s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0,
      };
    });
    if (foco) ordemFoco.push(foco);
  }
  relatorio.teclado = ordemFoco;

  await ctxMobile.close();

  // ---------- Reduced motion ----------
  const ctxRM = await navegador.newContext({
    ...devices['Pixel 5'],
    reducedMotion: 'reduce',
  });
  const rm = await ctxRM.newPage();
  const errosRM = [];
  rm.on('pageerror', (e) => errosRM.push(e.message));
  /**
   * Byte de vídeo pedido sob reduced-motion é falha de contrato, não detalhe de
   * peso: a variante `video` promete que nada de mídia é buscado quando o
   * usuário recusa movimento. O gate anterior não checava isto porque só
   * conhecia a variante `camadas`.
   */
  const videosPedidos = [];
  rm.on('request', (r) => {
    if (r.url().endsWith('.mp4')) videosPedidos.push(r.url());
  });
  await rm.goto(URL_BASE, { waitUntil: 'load', timeout: 120000 });
  await rm.waitForTimeout(2500);

  relatorio.reducedMotion = await rm.evaluate(() => {
    const camadas = Array.from(document.querySelectorAll('.explode__camada'));
    const conteudoExplode = document.querySelector('.explode__conteudo');
    const revelaveis = Array.from(document.querySelectorAll('[data-reveal] > *'));
    // A variante `video` não tem camada nenhuma: o estado de repouso dela é o
    // <picture> do último quadro. Sem isto o gate media zero de zero e passava.
    const posterVideo = document.querySelector('#explode picture img');
    return {
      variante: document.querySelector('#explode')?.dataset.cena ?? null,
      gsapCarregado: typeof window.gsap !== 'undefined',
      lenisAtivo: typeof window.__yardLenis !== 'undefined' && window.__yardLenis !== null,
      pinSpacers: document.querySelectorAll('.pin-spacer').length,
      camadasComTransform: camadas.filter(
        (c) => getComputedStyle(c).transform !== 'none'
      ).length,
      totalCamadas: camadas.length,
      posterVisivel: posterVideo
        ? posterVideo.offsetParent !== null &&
          Number(getComputedStyle(posterVideo).opacity) > 0.5
        : null,
      conteudoExplodeVisivel: conteudoExplode
        ? Number(getComputedStyle(conteudoExplode).opacity) > 0.9
        : null,
      itensInvisiveis: revelaveis.filter(
        (el) => Number(getComputedStyle(el).opacity) < 0.9
      ).length,
      totalRevelaveis: revelaveis.length,
    };
  });
  relatorio.reducedMotion.videosPedidos = videosPedidos.length;
  relatorio.errosReducedMotion = errosRM;
  await ctxRM.close();

  // ---------- Sem JavaScript ----------
  const ctxSemJs = await navegador.newContext({ ...devices['Pixel 5'], javaScriptEnabled: false });
  const semJs = await ctxSemJs.newPage();
  await semJs.goto(URL_BASE, { waitUntil: 'load', timeout: 120000 });
  relatorio.semJs = await semJs.evaluate(() => ({
    textoVisivel: document.body.innerText.trim().length,
    ctasVisiveis: Array.from(document.querySelectorAll('.cta')).filter(
      (el) => el.offsetParent !== null
    ).length,
    camadasVisiveis: Array.from(document.querySelectorAll('.explode__camada')).filter(
      (el) => Number(getComputedStyle(el).opacity) > 0.5
    ).length,
  }));
  await ctxSemJs.close();

  /**
   * ---------- PAISAGEM ----------
   *
   * O gate media só retrato até 26/08, e as três divergências conhecidas da
   * Cena 2 estão TODAS em paisagem: contraste do título, alvos de toque da
   * navbar e o enquadramento com `contain`. Medir só em pé respondia a pergunta
   * fácil.
   *
   * Celular deitado não é caso raro aqui: a cena é full-bleed e a pessoa gira o
   * aparelho justamente para vê-la maior.
   */
  const ctxPaisagem = await navegador.newContext({ ...devices['Pixel 5 landscape'] });
  const paisagem = await ctxPaisagem.newPage();
  await paisagem.goto(URL_BASE, { waitUntil: 'load', timeout: 120000 });
  await paisagem.waitForTimeout(2000);

  relatorio.paisagem = {
    a11y: await paisagem.evaluate(MEDIR_A11Y),
    toque: await paisagem.evaluate(() =>
      Array.from(document.querySelectorAll('a, button'))
        .map((el) => {
          const r = el.getBoundingClientRect();
          return {
            texto: (el.textContent || '').trim().slice(0, 32),
            classe: String(el.className || '').split(' ')[0],
            largura: Math.round(r.width),
            altura: Math.round(r.height),
            visivel: el.offsetParent !== null && r.width > 0 && r.height > 0,
            ok: r.width >= 44 && r.height >= 44,
          };
        })
        .filter((t) => t.visivel && !t.ok)
    ),
  };
  await ctxPaisagem.close();

  await navegador.close();
  writeFileSync('audit.json', JSON.stringify(relatorio, null, 2));
  console.log(JSON.stringify(relatorio, null, 2));
}

auditar();
