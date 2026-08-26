/**
 * Mede a Cena 2 na variante VÍDEO (scroll-scrubbed).
 *
 * Irmão de medir-cena.mjs, que mede a variante em camadas. Não dá para usar o
 * mesmo: lá a pergunta é "alguma das 7 camadas transborda o quadro"; aqui não
 * há camada nenhuma. As perguntas mudam junto com o material.
 *
 * O que este script responde, com medição e não com estimativa:
 *   1. A seção cabe na tela? (cena pinada que não cabe tem o fim fora do quadro)
 *   2. O scrub RESPONDE? — currentTime medido em 5 pontos do trilho. É o único
 *      teste que separa "o vídeo está lá" de "o scroll está dirigindo o vídeo".
 *   3. Quantos bytes a página inteira transferiu, por tipo.
 *
 * Uso: node medir-cena-video.mjs <url> [pixel5|desktop] [dir-saida]
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

/**
 * Contabilidade de bytes REAIS da rede, via Resource Timing.
 *
 * `transferSize` conta o que passou no fio — header incluso, já comprimido —,
 * que é exatamente a pergunta do gate de peso. A primeira versão deste script
 * somava `content-length` das respostas e devolvia js: 0 kB, porque o preview
 * entrega os chunks em transfer-encoding chunked, sem esse header. Número que
 * some quando o servidor muda de humor não é medição.
 *
 * Coletado só no fim, depois de todo o trilho: o vídeo entra por range request
 * durante o scrub e a soma precisa incluir esses pedaços.
 */
async function coletarRede() {
  return pagina.evaluate(() =>
    performance
      .getEntriesByType('resource')
      .map((e) => ({
        url: e.name.replace(/^https?:\/\/[^/]+/, ''),
        bytes: e.transferSize || e.encodedBodySize || 0,
      }))
      .concat(
        (() => {
          const nav = performance.getEntriesByType('navigation')[0];
          return nav ? [{ url: '/ (documento)', bytes: nav.transferSize || 0 }] : [];
        })()
      )
  );
}

const geometria = await pagina.evaluate(() => {
  const s = document.querySelector('#explode');
  const r = s.getBoundingClientRect();
  return {
    topo: Math.round(r.top + scrollY),
    vh: innerHeight,
    vw: innerWidth,
    variante: s.dataset.cena ?? 'camadas',
  };
});

if (geometria.variante !== 'video') {
  console.error(`A página está servindo a variante "${geometria.variante}", não "video".`);
  console.error('Rode o build sem CENA2=camadas, ou use medir-cena.mjs.');
  await navegador.close();
  process.exit(1);
}

const trilho = Math.round(geometria.vh * (PERFIL === 'pixel5' ? 1.1 : 1.8));

async function irPara(frac) {
  const y = geometria.topo + trilho * frac;
  await pagina.evaluate((alvo) => {
    if (window.__yardLenis) window.__yardLenis.scrollTo(alvo, { immediate: true });
    else window.scrollTo(0, alvo);
  }, y);
  await pagina.waitForTimeout(1600); // scrub 0.5 + o seek precisam alcançar
}

async function medir(rotulo) {
  return pagina.evaluate((rot) => {
    const vh = innerHeight;
    const sec = document.querySelector('#explode');
    const palco = sec.querySelector('[data-palco]');
    const video = sec.querySelector('[data-video]');
    const cx = sec.getBoundingClientRect();
    const px = palco.getBoundingClientRect();

    let enquadramento = 'ok';
    if (px.top < 0) enquadramento = `palco corta ${Math.round(-px.top)}px em cima`;
    else if (px.bottom > vh) enquadramento = `palco corta ${Math.round(px.bottom - vh)}px embaixo`;
    else if (px.left < -1) enquadramento = `palco corta ${Math.round(-px.left)}px na esquerda`;
    else if (px.right > innerWidth + 1)
      enquadramento = `palco corta ${Math.round(px.right - innerWidth)}px na direita`;

    return {
      ponto: rot,
      vh,
      alturaSecao: Math.round(cx.height),
      secaoCabe: Math.round(cx.height) <= vh + 2,
      palco: { largura: Math.round(px.width), altura: Math.round(px.height) },
      enquadramento,
      video: {
        src: (video.currentSrc || video.src || '').split('/').pop(),
        currentTime: Number(video.currentTime.toFixed(3)),
        duration: Number.isFinite(video.duration) ? Number(video.duration.toFixed(2)) : null,
        readyState: video.readyState,
        // fim do último intervalo bufferizado: quanto do arquivo dá para buscar
        bufferizadoAte: video.buffered.length
          ? Number(video.buffered.end(video.buffered.length - 1).toFixed(2))
          : 0,
        visivel: palco.hasAttribute('data-pronto'),
        degradado: palco.hasAttribute('data-degradado'),
      },
    };
  }, rotulo);
}

const pontos = [0, 0.25, 0.5, 0.75, 1];
const relatorio = [];

for (const p of pontos) {
  await irPara(p);
  const m = await medir(`${Math.round(p * 100)}%`);
  relatorio.push(m);
  await pagina.screenshot({ path: `${SAIDA}/video-${PERFIL}-${Math.round(p * 100)}.png` });
}

const g = relatorio[0];
console.log(`\n=== VÍDEO · ${PERFIL} — viewport ${geometria.vw}x${geometria.vh} ===`);
console.log(
  `seção: ${g.alturaSecao}px · cabe na tela: ${g.secaoCabe ? 'SIM' : 'NAO'} · palco ${g.palco.largura}x${g.palco.altura}`
);
console.log(`arquivo servido: ${g.video.src} · duração ${g.video.duration}s`);
console.log(`degradado para estático: ${g.video.degradado ? 'SIM' : 'nao'}`);
console.log('\nponto   currentTime   esperado   readyState  buffer  enquadramento');
for (const r of relatorio) {
  const esperado = ((parseInt(r.ponto, 10) / 100) * (r.video.duration ?? 10)).toFixed(2);
  console.log(
    `${r.ponto.padEnd(6)}  ${String(r.video.currentTime).padEnd(12)}  ${esperado.padEnd(9)}  ` +
      `${String(r.video.readyState).padEnd(10)}  ${String(r.video.bufferizadoAte).padEnd(6)}  ${r.enquadramento}`
  );
}

// O scrub só é válido se currentTime ANDA. Um vídeo parado no quadro 0 em todos
// os pontos passaria em qualquer checagem visual superficial.
const tempos = relatorio.map((r) => r.video.currentTime);
const andou = Math.max(...tempos) - Math.min(...tempos);
console.log(
  `\nscrub responde: ${andou > 1 ? 'SIM' : 'NAO'} (currentTime percorreu ${andou.toFixed(2)}s de ${g.video.duration}s)`
);

const rede = await coletarRede();
const total = rede.reduce((s, r) => s + r.bytes, 0);
const porTipo = {};
for (const r of rede) {
  const t = /\.mp4$/.test(r.url)
    ? 'video'
    : /\.(webp|jpg|png|avif)$/.test(r.url)
      ? 'imagem'
      : /\.js$/.test(r.url)
        ? 'js'
        : /\.(css|woff2?)$/.test(r.url)
          ? 'css+fonte'
          : 'html/outros';
  porTipo[t] = (porTipo[t] ?? 0) + r.bytes;
}
console.log(`\npeso transferido: ${(total / 1024).toFixed(1)} kB`);
for (const [t, b] of Object.entries(porTipo).sort((a, b) => b[1] - a[1])) {
  console.log(`   ${t.padEnd(12)} ${(b / 1024).toFixed(1)} kB`);
}
console.log(`orçamento 1500 kB: ${total / 1024 <= 1500 ? 'PASSA' : 'ESTOURA'}`);

writeFileSync(
  `${SAIDA}/medicao-video-${PERFIL}.json`,
  JSON.stringify({ perfil: PERFIL, relatorio, rede, total, porTipo }, null, 2)
);
await navegador.close();
