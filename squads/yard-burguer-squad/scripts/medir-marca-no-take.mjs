/**
 * A marca lateral invade o hambúrguer DURANTE o take?
 *
 * A pergunta que a bancada não responde. Ela mede UM palco (1280x724) sobre o
 * quadro PARADO do poster; este script roda a cena de verdade e varre o take
 * instante a instante, em nove formatos de tela.
 *
 * FOI ELE QUE PEGOU O DEFEITO de 2026-08-27: a faixa BURGUER passava por trás do
 * produto em 13 de 13 amostras no desktop (-21px em 1440, -75px em 1920),
 * enquanto a bancada aprovava com +31px. Nenhum dos dois estava com defeito — a
 * bancada respondia outra pergunta.
 *
 * headless: false É OBRIGATÓRIO, e este é o fato que destravou tudo.
 *
 *   O que impede a Cena 2 de engatar sob automação NÃO é o CDP, como este repo
 *   afirmou por duas rodadas. É a aba ficar com `visibilityState: 'hidden'`, que
 *   é o estado de todo browser headless. Sem visibilidade o IntersectionObserver
 *   não reporta interseção, o vídeo não decodifica (readyState 0) e o
 *   `await video.play()` nunca settla — então o pin não chega a ser criado.
 *   Com a aba visível, a cena roda inteira sob automação.
 *
 * COMO A CAIXA DO PRODUTO É MEDIDA: o quadro corrente do vídeo é desenhado num
 * canvas e cada coluna conta como "produto" se tiver pixel claramente acima do
 * carvão (luminância > 90) e com saturação (> 28). Calibrado contra os valores
 * que a bancada mede nos posters — bate em 1 milésimo (0,346/0,710 contra
 * 0,347/0,711 no 16:9). Se divergir disso, o detector é que está errado.
 *
 * O `fit` REAL IMPORTA. O palco recua para `contain` fora da faixa 1,15:1 a
 * 1,9:1; assumir `cover` ali superestima a largura projetada e INVENTA invasão
 * que não existe — aconteceu na primeira rodada, com o celular deitado acusando
 * -127px que não eram reais.
 *
 * Uso:
 *   node squads/yard-burguer-squad/scripts/medir-marca-no-take.mjs [url]
 *
 * Contrato: folga positiva nos DOIS lados, em TODOS os instantes, em TODOS os
 * perfis. Negativo em qualquer célula é a palavra por trás do hambúrguer.
 */
import { chromium, devices } from 'playwright';

const URL = process.argv[2] ?? 'http://localhost:4321';

/**
 * Os nove cobrem as três decisões de layout da cena: qual arquivo carrega (lado
 * curto <= 900px pega o vertical), se a mídia fica em cover ou contain, e o
 * clamp do corpo da fonte. Tirar um perfil daqui é deixar de cobrir um ramo.
 */
const PERFIS = [
  { nome: 'iphone-se   ', ctx: { ...devices['iPhone SE'], isMobile: true } },
  { nome: 'iphone-13   ', ctx: { ...devices['iPhone 13'], isMobile: true } },
  { nome: 'pixel-7     ', ctx: { ...devices['Pixel 7'], isMobile: true } },
  { nome: 'cel-deitado ', ctx: { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true } },
  { nome: 'ipad-pe     ', ctx: { viewport: { width: 820, height: 1180 } } },
  { nome: 'laptop-1024 ', ctx: { viewport: { width: 1024, height: 768 } } },
  { nome: 'desktop-1440', ctx: { viewport: { width: 1440, height: 900 } } },
  { nome: 'desktop-1920', ctx: { viewport: { width: 1920, height: 900 } } },
  { nome: 'ultrawide   ', ctx: { viewport: { width: 2560, height: 1080 } } },
];

const navegador = await chromium.launch({ headless: false });
let reprovou = false;

for (const perfil of PERFIS) {
  const ctx = await navegador.newContext(perfil.ctx);
  const pag = await ctx.newPage();
  await pag.goto(URL, { waitUntil: 'networkidle' });

  await pag.evaluate(() => {
    const s = document.querySelector('#explode');
    window.scrollTo({ top: window.scrollY + s.getBoundingClientRect().top - 300, behavior: 'instant' });
  });

  const engatou = await pag
    .waitForFunction(
      () => {
        const v = document.querySelector('#explode video');
        return v && v.readyState >= 3 && !!document.querySelector('.pin-spacer');
      },
      null,
      { timeout: 20000 }
    )
    .then(() => true)
    .catch(() => false);

  if (!engatou) {
    console.log(perfil.nome, '— NAO ENGATOU (headless ligado? aba sem foco?)');
    reprovou = true;
    await ctx.close();
    continue;
  }

  const r = await pag.evaluate(async () => {
    const s = document.querySelector('#explode');
    const v = s.querySelector('video');
    const palco = s.querySelector('[data-palco]');
    const [me, md] = [...s.querySelectorAll('[data-marca]')];

    const cv = document.createElement('canvas');
    cv.width = 480;
    cv.height = Math.round((480 * v.videoHeight) / v.videoWidth);
    const cx = cv.getContext('2d', { willReadFrequently: true });

    const bordas = () => {
      cx.drawImage(v, 0, 0, cv.width, cv.height);
      const d = cx.getImageData(0, 0, cv.width, cv.height).data;
      let e = cv.width, dr = 0;
      for (let x = 0; x < cv.width; x++)
        for (let y = 0; y < cv.height; y++) {
          const i = (y * cv.width + x) * 4;
          const mx = Math.max(d[i], d[i + 1], d[i + 2]);
          const mn = Math.min(d[i], d[i + 1], d[i + 2]);
          if (mx > 90 && mx - mn > 28) { if (x < e) e = x; if (x > dr) dr = x; break; }
        }
      return [e / cv.width, dr / cv.width];
    };

    const rp = palco.getBoundingClientRect();
    const arq = v.videoWidth / v.videoHeight;
    const caixa = rp.width / rp.height;
    const fit = getComputedStyle(v).objectFit;
    const larg = fit === 'contain'
      ? Math.min(rp.width, rp.height * arq)
      : arq >= caixa ? rp.height * arq : rp.width;
    const off = rp.left + (rp.width - larg) / 2;
    const re = me.getBoundingClientRect(), rd = md.getBoundingClientRect();

    const amostras = [];
    for (let t = 0.4; t < v.duration; t += 0.6) {
      v.currentTime = t;
      await new Promise((ok) => { v.onseeked = ok; setTimeout(ok, 900); });
      const [fe, fd] = bordas();
      amostras.push({
        t: +t.toFixed(1),
        esq: Math.round(off + fe * larg - re.right),
        dir: Math.round(rd.left - (off + fd * larg)),
      });
    }
    return {
      arquivo: (v.currentSrc || '').split('/').pop(),
      palco: `${Math.round(rp.width)}x${Math.round(rp.height)}`,
      fit,
      amostras,
    };
  });

  const pior = r.amostras.reduce((a, b) => (Math.min(b.esq, b.dir) < Math.min(a.esq, a.dir) ? b : a));
  const invadem = r.amostras.filter((a) => a.esq < 0 || a.dir < 0).length;
  if (invadem) reprovou = true;

  console.log(
    perfil.nome,
    r.arquivo.padEnd(28),
    'palco', r.palco.padEnd(10),
    r.fit.padEnd(8),
    '| invade', String(invadem).padStart(2) + '/' + r.amostras.length,
    '| pior t=' + String(pior.t).padEnd(4),
    'YARD', String(pior.esq).padStart(5) + 'px',
    'BURGUER', String(pior.dir).padStart(5) + 'px'
  );
  await ctx.close();
}

await navegador.close();
console.log(reprovou ? '\nREPROVA — a marca encosta no produto em algum ponto.' : '\nAPROVA — folga positiva nos dois lados, em todos os instantes.');
process.exit(reprovou ? 1 : 0);
