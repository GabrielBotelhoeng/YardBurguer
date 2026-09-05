/**
 * O texto da Cena 2 é legível SOBRE O VÍDEO?
 *
 * O gate de a11y não responde isso e nunca vai responder do jeito que está: ele
 * sobe a árvore do DOM atrás de um `background-color` para calcular contraste, e
 * atrás deste texto não há cor nenhuma — há um vídeo. Para o gate, a Cena 2 é um
 * ponto cego, e foi por isso que "contraste do título: 2,12–2,86:1" ficou aberto
 * como pendência sem ninguém conseguir fechar.
 *
 * COMO ESTE MEDE. Roda a cena de verdade, para no instante em que cada texto
 * está aceso, ESCONDE o texto, fotografa o que sobrou (vídeo + véu, exatamente o
 * que fica atrás dele) e calcula o contraste da cor do texto contra cada pixel
 * daquela faixa. O número que interessa é o PIOR pixel, não a média: uma média
 * boa com um estouro especular embaixo da letra continua sendo texto ilegível.
 *
 * headless: false é obrigatório — sem aba visível a cena não engata (o
 * observer não reporta, o vídeo não decodifica e o pin não é criado).
 *
 * OS PISOS, e por que são dois:
 *   4.5:1  texto normal (WCAG AA, 1.4.3)
 *   3.0:1  texto grande — >= 24px, ou >= 18.66px sendo bold
 * O script mede o corpo real de cada elemento e cobra o piso certo. Cobrar 4.5
 * de um título de 64px reprovaria o que a norma aprova.
 *
 * Uso: node squads/yard-burguer-squad/scripts/medir-contraste-cena2.mjs [url]
 * Sai com código 1 se algum texto ficar abaixo do seu piso.
 */
import { chromium, devices } from 'playwright';
import { writeFileSync } from 'node:fs';

const URL = process.argv[2] ?? 'http://localhost:4321';

/**
 * Saída de máquina, para o `audit-page.mjs` consumir.
 *
 * O gate roda headless e por isso NÃO consegue medir esta cena sozinho — sem
 * aba visível o observer não reporta, o vídeo não decodifica e o pin não é
 * criado. Em vez de deixar o gate afirmar um contraste que ele não coleta (o
 * defeito que a rodada de 26/08 veio corrigir), ele passa a INVOCAR este script
 * e a incorporar este arquivo.
 */
const SAIDA_JSON = process.env.SAIDA_JSON ?? null;
const medicoes = [];

const PERFIS = [
  { nome: 'celular  ', ctx: { ...devices['iPhone 13'], isMobile: true } },
  { nome: 'paisagem ', ctx: { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true } },
  { nome: 'desktop  ', ctx: { viewport: { width: 1440, height: 900 } } },
];

/** Luminância relativa — WCAG 2.x, sRGB. */
function luminancia(r, g, b) {
  const canal = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

const razao = (l1, l2) => (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);

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
    console.log(perfil.nome, '— NAO ENGATOU');
    reprovou = true;
    await ctx.close();
    continue;
  }

  // Onde o pin comeca e quanto ele acrescentou. O --trilho-pin do CSS e a fonte
  // da verdade do comprimento (o ScrollTrigger le esse mesmo valor).
  const { base, comp } = await pag.evaluate(() => {
    const sp = document.querySelector('.pin-spacer');
    const base = window.scrollY + sp.getBoundingClientRect().top;
    /**
     * A régua vai DENTRO do .cenavideo__trilho, e isso não é detalhe: é ali que
     * `--trilho-pin` é declarado. Pendurada em .cenavideo (que é irmão, não pai)
     * a variável não existe, `height` cai para 0 e o script varre um trilho de
     * comprimento zero — passando por "aprovado" sem ter medido nada. Foi
     * exatamente o falso verde que este comentário existe para não repetir.
     */
    const trilho = document.querySelector('.cenavideo__trilho');
    const regua = document.createElement('div');
    regua.style.cssText = 'position:absolute;visibility:hidden;height:var(--trilho-pin)';
    trilho.appendChild(regua);
    const comp = regua.getBoundingClientRect().height;
    regua.remove();
    if (!comp) throw new Error('trilho de comprimento 0 — --trilho-pin não resolveu');
    return { base, comp };
  });

  const rolar = (y) =>
    pag.evaluate((alvo) => {
      const L = window.__yardLenis ?? window.lenis;
      if (L && typeof L.scrollTo === 'function') L.scrollTo(alvo, { immediate: true, force: true });
      else window.scrollTo({ top: alvo, behavior: 'instant' });
    }, y);

  /**
   * Varre o trilho e guarda, para cada texto, a fracao em que ele esta MAIS
   * opaco. Medir no pico e o certo: e ali que ele esta legivel de verdade, e um
   * texto a 30% de opacidade daria um contraste artificialmente ruim que nao
   * corresponde a nenhum instante em que alguem tenta ler.
   */
  const SELETORES = ['[data-passo]', '.cenavideo__titulo', '.cenavideo__texto'];
  const picos = new Map();
  for (let i = 0; i <= 40; i++) {
    await rolar(base + comp * (i / 40));
    await pag.waitForTimeout(140);
    const estados = await pag.evaluate((sels) => {
      const saida = [];
      sels.forEach((sel) => {
        document.querySelectorAll('#explode ' + sel).forEach((el, n) => {
          const cs = getComputedStyle(el);
          // Opacidade efetiva: o pai (.cenavideo__conteudo) tambem anima.
          let o = 1, p = el;
          while (p && p !== document.body) { o *= Number(getComputedStyle(p).opacity); p = p.parentElement; }
          saida.push({ chave: sel + '#' + n, o, corTexto: cs.color, corpo: parseFloat(cs.fontSize), peso: cs.fontWeight });
        });
      });
      return saida;
    }, SELETORES);
    for (const e of estados) {
      if (e.o > (picos.get(e.chave)?.o ?? 0)) picos.set(e.chave, { ...e, f: i / 40 });
    }
  }

  for (const [chave, info] of picos) {
    if (info.o < 0.85) continue; // nunca chega a ficar legivel; nao ha o que medir

    await rolar(base + comp * info.f);
    await pag.waitForTimeout(500);

    /**
     * ESCONDE TODOS OS TEXTOS DA CENA, não só o alvo.
     *
     * Escondendo apenas o alvo, os outros quatro `[data-passo]` continuavam
     * acesos e caíam DENTRO da faixa fotografada — no celular eles ficam
     * empilhados perto. O "fundo" então continha texto da mesma cor do texto
     * medido, e o pior pixel virava a própria cor: contraste **1,00 exato**, em
     * dez das vinte e uma medições. Número que parece defeito grave e é erro de
     * instrumento; no desktop, onde os passos se espalham, o mesmo texto dava
     * 7,9–8,3.
     *
     * O que se quer atrás do texto é vídeo + véu, que é o que o comentário do
     * topo sempre prometeu medir. `visibility: hidden` preserva o layout, então
     * esconder todos não move nada de lugar.
     */
    const caixa = await pag.evaluate(
      ({ sels, alvoChave }) => {
        let alvo = null;
        sels.forEach((sel) => {
          document.querySelectorAll('#explode ' + sel).forEach((el, n) => {
            if (sel + '#' + n === alvoChave) alvo = el;
            el.style.visibility = 'hidden';
          });
        });
        if (!alvo) return null;
        const r = alvo.getBoundingClientRect();
        return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) };
      },
      { sels: SELETORES, alvoChave: chave }
    );
    if (!caixa || caixa.width < 2 || caixa.height < 2) continue;

    const buf = await pag.screenshot({ clip: caixa });

    // Devolve TODOS, pelo mesmo motivo que escondeu todos.
    await pag.evaluate((sels) => {
      sels.forEach((sel) => {
        document.querySelectorAll('#explode ' + sel).forEach((el) => {
          el.style.visibility = '';
        });
      });
    }, SELETORES);

    // Decodifica o PNG no proprio browser: evita dependencia nova so para ler
    // pixel, e o canvas ali ja e o mesmo que renderizou a cena.
    const pixels = await pag.evaluate(async (b64) => {
      const img = new Image();
      img.src = 'data:image/png;base64,' + b64;
      await img.decode();
      const cv = document.createElement('canvas');
      cv.width = img.width; cv.height = img.height;
      const cx = cv.getContext('2d', { willReadFrequently: true });
      cx.drawImage(img, 0, 0);
      return Array.from(cx.getImageData(0, 0, cv.width, cv.height).data);
    }, buf.toString('base64'));

    const [tr, tg, tb] = (info.corTexto.match(/\d+/g) ?? [232, 220, 200]).map(Number);
    const lumTexto = luminancia(tr, tg, tb);

    const grande = info.corpo >= 24 || (info.corpo >= 18.66 && Number(info.peso) >= 700);
    const piso = grande ? 3.0 : 4.5;

    /**
     * ALÉM DO PIOR PIXEL, A FRAÇÃO ABAIXO DO PISO.
     *
     * "Pior pixel" sozinho é uma métrica que tende a 1,00 sempre que o fundo
     * cruza a luminância do texto — e um fundo com variação ampla SEMPRE cruza,
     * em algum ponto. Sozinha ela não distingue "um pixel coincidente na borda"
     * de "o texto sumiu em cima do pão". Reprovar nos dois casos é reprovar por
     * construção.
     *
     * A fração responde o que falta: quanto da área atrás do texto está abaixo
     * do piso. É ela que separa artefato de defeito, e por isso vai junto no
     * relatório em vez de substituir o pior pixel.
     */
    let pior = Infinity;
    let piorPixel = null;
    let abaixoDoPiso = 0;
    let totalPixels = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      const rz = razao(lumTexto, luminancia(pixels[i], pixels[i + 1], pixels[i + 2]));
      totalPixels++;
      if (rz < piso) abaixoDoPiso++;
      if (rz < pior) { pior = rz; piorPixel = [pixels[i], pixels[i + 1], pixels[i + 2]]; }
    }
    const fracaoRuim = Math.round((abaixoDoPiso / totalPixels) * 1000) / 10;
    const passa = pior >= piso;
    if (!passa) reprovou = true;

    medicoes.push({
      perfil: perfil.nome.trim(),
      elemento: chave,
      corpo: Math.round(info.corpo),
      grande,
      pior: Math.round(pior * 100) / 100,
      fracaoRuim,
      piso,
      passa,
      piorPixel,
      // A cor de origem fica registrada: quando o número surpreender, a
      // primeira pergunta é sempre "contra que cor isso foi medido".
      corTexto: info.corTexto,
      lumTexto: Math.round(lumTexto * 1000) / 1000,
      caixa: `${caixa.width}x${caixa.height}`,
    });

    console.log(
      perfil.nome,
      chave.padEnd(26),
      String(Math.round(info.corpo)) + 'px',
      (grande ? 'grande' : 'normal').padEnd(7),
      '| pior ' + pior.toFixed(2) + ':1',
      'ruim ' + String(fracaoRuim).padStart(5) + '%',
      'piso ' + piso.toFixed(1),
      passa ? 'PASSA' : 'REPROVA',
      '| texto ' + info.corTexto + ' | pixel ' + JSON.stringify(piorPixel)
    );
  }
  await ctx.close();
}

await navegador.close();

if (SAIDA_JSON) {
  writeFileSync(
    SAIDA_JSON,
    JSON.stringify(
      {
        medido: true,
        metodo: 'amostragem de pixel sob o texto, com o próprio texto escondido',
        // Sem medição nenhuma o veredito seria "aprova" por vacuidade — o mesmo
        // falso verde do trilho de comprimento zero, algumas linhas acima.
        reprova: reprovou,
        totalMedicoes: medicoes.length,
        medicoes,
      },
      null,
      2
    )
  );
}

console.log(reprovou ? '\nREPROVA — ha texto abaixo do piso AA sobre o video.' : '\nAPROVA — todo texto da cena passa no seu piso AA.');
process.exit(reprovou ? 1 : 0);
