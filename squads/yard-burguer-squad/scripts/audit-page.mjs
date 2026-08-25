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

  const recursos = [];
  mobile.on('response', async (resp) => {
    try {
      const tam = Number((await resp.allHeaders())['content-length'] ?? 0);
      recursos.push({ url: resp.url(), status: resp.status(), bytes: tam, tipo: resp.request().resourceType() });
    } catch {}
  });

  const erros = [];
  mobile.on('pageerror', (e) => erros.push(e.message));
  mobile.on('console', (m) => {
    if (m.type() === 'error') erros.push(`console: ${m.text()}`);
  });

  await mobile.goto(URL_BASE, { waitUntil: 'load', timeout: 120000 });
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
  relatorio.toque = await mobile.evaluate(() =>
    Array.from(document.querySelectorAll('a, button')).map((el) => {
      const r = el.getBoundingClientRect();
      return {
        texto: (el.textContent || '').trim().slice(0, 32),
        largura: Math.round(r.width),
        altura: Math.round(r.height),
        ok: r.width >= 44 && r.height >= 44,
      };
    })
  );

  // ---------- Acessibilidade ----------
  relatorio.a11y = await mobile.evaluate(() => {
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
  });

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
  await rm.goto(URL_BASE, { waitUntil: 'load', timeout: 120000 });
  await rm.waitForTimeout(2500);

  relatorio.reducedMotion = await rm.evaluate(() => {
    const camadas = Array.from(document.querySelectorAll('.explode__camada'));
    const conteudoExplode = document.querySelector('.explode__conteudo');
    const revelaveis = Array.from(document.querySelectorAll('[data-reveal] > *'));
    return {
      gsapCarregado: typeof window.gsap !== 'undefined',
      lenisAtivo: typeof window.__yardLenis !== 'undefined' && window.__yardLenis !== null,
      camadasComTransform: camadas.filter(
        (c) => getComputedStyle(c).transform !== 'none'
      ).length,
      totalCamadas: camadas.length,
      conteudoExplodeVisivel: conteudoExplode
        ? Number(getComputedStyle(conteudoExplode).opacity) > 0.9
        : null,
      itensInvisiveis: revelaveis.filter(
        (el) => Number(getComputedStyle(el).opacity) < 0.9
      ).length,
      totalRevelaveis: revelaveis.length,
    };
  });
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

  await navegador.close();
  writeFileSync('audit.json', JSON.stringify(relatorio, null, 2));
  console.log(JSON.stringify(relatorio, null, 2));
}

auditar();
