/**
 * Mede a Cena 2 em pontos do trilho de pin e reporta transbordo por camada.
 * Uso: node medir-cena.mjs <url> [pixel5|desktop]
 */
import { chromium, devices } from 'playwright';
import { writeFileSync } from 'node:fs';

const URL = process.argv[2] ?? 'http://localhost:4330/';
const PERFIL = process.argv[3] ?? 'pixel5';
const SAIDA = process.argv[4] ?? '.';

const navegador = await chromium.launch();
const contexto = await navegador.newContext(
  PERFIL === 'pixel5' ? devices['Pixel 5'] : { viewport: { width: 1440, height: 900 } }
);
const pagina = await contexto.newPage();

await pagina.goto(URL, { waitUntil: 'networkidle' });

// A cena é lazy: só inicializa quando chega perto. Rola até ela e espera o GSAP.
const geometria = await pagina.evaluate(() => {
  const s = document.querySelector('#explode');
  const r = s.getBoundingClientRect();
  return { topo: Math.round(r.top + scrollY), vh: innerHeight, vw: innerWidth };
});

const trilho = Math.round(geometria.vh * (PERFIL === 'pixel5' ? 1.1 : 1.8));

async function irPara(frac) {
  const y = geometria.topo + trilho * frac;
  await pagina.evaluate((alvo) => {
    if (window.__yardLenis) window.__yardLenis.scrollTo(alvo, { immediate: true });
    else window.scrollTo(0, alvo);
  }, y);
  await pagina.waitForTimeout(1400); // scrub:1 precisa alcançar
}

async function medir(rotulo) {
  return pagina.evaluate((rot) => {
    const vh = innerHeight;
    const camadas = [...document.querySelectorAll('.explode__camada')].map((li) => {
      const b = li.getBoundingClientRect();
      let estado = 'ok';
      if (b.top < 0) estado = `corta ${Math.round(-b.top)}px em cima`;
      else if (b.bottom > vh) estado = `corta ${Math.round(b.bottom - vh)}px embaixo`;
      // Transbordo lateral: com larguraRelativa > 1 as camadas passam da largura
      // base de proposito — e assim que bacon e alface aparecem —, mas nunca
      // podem sair do viewport.
      else if (b.left < -1) estado = `corta ${Math.round(-b.left)}px na esquerda`;
      else if (b.right > innerWidth + 1)
        estado = `corta ${Math.round(b.right - innerWidth)}px na direita`;
      return { id: li.dataset.layer, topo: Math.round(b.top), base: Math.round(b.bottom), estado };
    });
    const sec = document.querySelector('#explode');
    return {
      ponto: rot,
      vh,
      alturaSecao: Math.round(sec.getBoundingClientRect().height),
      secaoCabe: Math.round(sec.getBoundingClientRect().height) <= vh + 2,
      problemas: camadas.filter((c) => c.estado !== 'ok'),
      camadas,
    };
  }, rotulo);
}

const pontos = [0, 0.25, 0.5, 0.75, 1];
const relatorio = [];

for (const p of pontos) {
  await irPara(p);
  const m = await medir(`${Math.round(p * 100)}%`);
  relatorio.push(m);
  await pagina.screenshot({ path: `${SAIDA}/cena-${PERFIL}-${Math.round(p * 100)}.png` });
}

console.log(`\n=== ${PERFIL} — viewport ${geometria.vw}x${geometria.vh} ===`);
console.log(`altura da seção: ${relatorio[0].alturaSecao}px · cabe na tela: ${relatorio[0].secaoCabe ? 'SIM' : 'NAO'}`);
for (const r of relatorio) {
  const p = r.problemas;
  console.log(`\n[${r.ponto}] ${p.length === 0 ? 'todas as 7 camadas dentro do quadro' : p.length + ' com transbordo:'}`);
  p.forEach((c) => console.log(`   ${c.id}: ${c.estado}`));
}

writeFileSync(`${SAIDA}/medicao-${PERFIL}.json`, JSON.stringify(relatorio, null, 2));
await navegador.close();
