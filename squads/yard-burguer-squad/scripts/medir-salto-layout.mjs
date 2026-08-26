/**
 * Mede o salto de layout da Cena 2 — e diz QUEM empurrou.
 *
 * Existe porque o `audit-page.mjs` sozinho não responde a pergunta. Ele soma o
 * CLS e pronto; quando o número passou de 1,0 em 26/08, o total não dizia se a
 * culpa era do conteúdo ou do scroll que a própria medição executa.
 *
 * A DIFERENÇA QUE DECIDE TUDO é o momento em que se rola:
 *
 *   - rolando desde a chegada (como uma pessoa faz): 1,8473, reprodutível até a
 *     quarta casa em três execuções;
 *   - esperando a página assentar antes de rolar: 0,000, porque o pin já foi
 *     montado antes de qualquer coisa entrar em quadro.
 *
 * Ver 0,000 não prova que o salto sumiu. Prova que a medição esperou demais.
 *
 * Uso:
 *   ALVO=http://localhost:4392/ node medir-salto-layout.mjs
 *   ALVO=... MODO=parado node medir-salto-layout.mjs    # controle: deve dar 0
 */
import { chromium, devices } from 'playwright';

const ALVO = process.env.ALVO ?? 'http://localhost:4330/';
const MODO = process.env.MODO ?? 'rolando';

const REDE_4G_LENTA = {
  offline: false,
  downloadThroughput: (1.6 * 1024 * 1024) / 8,
  uploadThroughput: (750 * 1024) / 8,
  latency: 150,
};

const navegador = await chromium.launch();
const ctx = await navegador.newContext({ ...devices['Pixel 5'] });
const pagina = await ctx.newPage();

const cdp = await ctx.newCDPSession(pagina);
await cdp.send('Network.enable');
await cdp.send('Network.emulateNetworkConditions', REDE_4G_LENTA);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });

await pagina.goto(ALVO, { waitUntil: 'load', timeout: 120000 });

await pagina.evaluate(() => {
  window.__eventos = [];
  const t0 = performance.now();
  const secao = document.querySelector('#explode');

  const registrar = (nome, extra) => {
    const r = secao?.getBoundingClientRect();
    window.__eventos.push({
      nome,
      instante: Math.round(performance.now() - t0),
      scrollY: Math.round(window.scrollY),
      cenaTopo: r ? Math.round(r.top) : null,
      cenaVisivel: r ? r.top < window.innerHeight && r.bottom > 0 : null,
      alturaDoc: Math.round(document.body.scrollHeight),
      ...extra,
    });
  };

  registrar('inicio');

  // O pin-spacer nasce no instante em que o ScrollTrigger monta o pin. É ele
  // que empurra tudo que está abaixo da cena.
  new MutationObserver((mutacoes) => {
    for (const m of mutacoes) {
      for (const no of m.addedNodes) {
        if (no.nodeType === 1 && String(no.className || '').includes('pin-spacer')) {
          registrar('pin-spacer inserido', {
            alturaSpacer: Math.round(no.getBoundingClientRect().height),
          });
        }
      }
    }
  }).observe(document.body, { childList: true, subtree: true });

  new PerformanceObserver((lista) => {
    for (const e of lista.getEntries()) {
      if (e.hadRecentInput) continue;
      registrar('layout-shift', {
        valor: Number(e.value.toFixed(4)),
        fontes: (e.sources || [])
          .map((s) => {
            const el = s.node;
            if (!el || !el.tagName) return '(sem no)';
            const cls = String(el.className || '').split(' ')[0];
            return `${el.tagName}${cls ? '.' + cls : ''}`;
          })
          .join(', '),
      });
    }
  }).observe({ type: 'layout-shift', buffered: true });
});

/**
 * A MÉTRICA HONESTA — e por que o CLS sozinho não serve aqui.
 *
 * O `layout-shift` dispara quando o ScrollTrigger troca a seção de `relative`
 * para `fixed` ao pinar, e como a cena ocupa a tela inteira isso pontua ~1,0
 * mesmo quando NADA se move para quem está olhando. Medido em 26/08: depois da
 * correção o CLS continuou 1,8473 e o deslocamento real caiu a zero.
 *
 * Então aqui se mede outra coisa: quanto a seção SEGUINTE à cena andou além do
 * que a rolagem explica. Se o usuário rolou 182px e o elemento subiu 182px,
 * deslocamento é zero — foi ele quem rolou. O que sobra é empurrão.
 *
 * Antes da correção: 800px. Depois: 0px.
 */
await pagina.evaluate(() => {
  window.__rastro = [];
  const abaixo = document.querySelector('#mais-pedidos');
  if (!abaixo) return;
  const amostrar = () => {
    window.__rastro.push({
      y: Math.round(window.scrollY),
      top: Math.round(abaixo.getBoundingClientRect().top),
    });
    requestAnimationFrame(amostrar);
  };
  amostrar();
});

if (MODO === 'parado') {
  await pagina.waitForTimeout(9000);
} else {
  // Passos de 1/4 de tela: o ritmo de um dedo, não um teletransporte.
  await pagina.waitForTimeout(1500);
  for (let i = 0; i < 40; i++) {
    await pagina.evaluate(() => window.scrollBy(0, window.innerHeight / 4));
    await pagina.waitForTimeout(180);
  }
  await pagina.waitForTimeout(2000);
}

const eventos = await pagina.evaluate(() => window.__eventos);
const cls = eventos
  .filter((e) => e.nome === 'layout-shift')
  .reduce((s, e) => s + e.valor, 0);

const rastro = await pagina.evaluate(() => window.__rastro ?? []);
let empurrao = 0;
for (let i = 1; i < rastro.length; i++) {
  const esperado = rastro[i - 1].top - (rastro[i].y - rastro[i - 1].y);
  empurrao = Math.max(empurrao, Math.abs(rastro[i].top - esperado));
}

console.log(`\nALVO=${ALVO}  MODO=${MODO}`);
console.log(`EMPURRÃO: ${empurrao}px  <- o que a pessoa vê (meta: 0)`);
console.log(`CLS bruto: ${cls.toFixed(4)}  (a troca relative/fixed do pin pontua aqui sem mover nada)\n`);

for (const e of eventos) {
  const vis = e.cenaVisivel === null ? '?' : e.cenaVisivel ? 'CENA NA TELA' : 'cena fora da tela';
  const extra =
    e.valor !== undefined
      ? `  valor=${e.valor}  <- ${e.fontes}`
      : e.alturaSpacer !== undefined
        ? `  altura=${e.alturaSpacer}px`
        : '';
  console.log(
    `@${String(e.instante).padStart(5)}ms  ${e.nome.padEnd(20)} scrollY=${String(e.scrollY).padStart(5)}  topoCena=${String(e.cenaTopo).padStart(6)}  doc=${e.alturaDoc}  ${vis}${extra}`
  );
}

// O gate reprova por EMPURRÃO, não por CLS: é o que a pessoa enxerga.
process.exitCode = empurrao > 4 ? 1 : 0;
await navegador.close();
