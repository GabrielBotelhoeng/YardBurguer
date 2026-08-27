/**
 * Folha de contato da página — celular e desktop, seção por seção, mais as
 * cinco paradas da Cena 2.
 *
 * PARA QUE SERVE: mandar para o cliente julgar composição antes de um merge,
 * sem depender de ele abrir o aparelho. Não substitui o teste em celular real —
 * ver o bloco "o que estes prints NÃO provam", no fim.
 *
 * O PROBLEMA QUE ELE RESOLVE: em navegador HEADLESS a aba fica com
 * `visibilityState: 'hidden'`, e sob essa condição o `IntersectionObserver` não
 * reporta interseção. Como o motion.js arma o scroll reveal e a Cena 2 pelo
 * observer, uma captura ingênua fotografa uma página quase vazia — os grupos
 * [data-reveal] ficam com .reveal-armado e nunca recebem .reveal-visivel.
 *
 * NÃO É O CDP. Isso foi diagnosticado errado até 2026-08-27, e o erro custou
 * caro: a Cena 2 passou por duas rodadas dada como "não verificável por
 * automação". Com `headless: false` a aba fica visível, o observer dispara, o
 * vídeo decodifica e o pin é criado — a cena roda inteira sob automação. Quem
 * precisa da cena RODANDO usa medir-marca-no-take.mjs, que é headed.
 *
 * Este script segue headless de propósito: para fotografar a página parada, o
 * caminho por reduced-motion é mais rápido e mais estável que esperar o vídeo.
 *
 * A SAÍDA É reducedMotion: 'reduce'. Sob essa preferência o motion.js retorna
 * cedo nas duas funções, ANTES de armar qualquer coisa: nada é escondido e a
 * Cena 2 fica no estado final estático. Não é um truque para enganar a captura —
 * é exatamente o que vê no aparelho quem tem movimento reduzido ligado, então a
 * passada A documenta um estado real do produto e não um artifício da bancada.
 *
 * A CENA 2 É OUTRA PASSADA, e sem reduced-motion: ali o movimento é o assunto.
 * Quem monta cada parada é a bancada (bancada-cena2.html), com os mesmos valores
 * da timeline de video-scrub.js sobre o quadro do poster. Ver o cabeçalho dela
 * para o porquê de a bancada existir e para o contrato de gapEsq/gapDir.
 *
 * Uso:
 *   npm run build
 *   cp squads/yard-burguer-squad/scripts/bancada-cena2.html dist/__bancada.html
 *   npx astro preview --port 4321 &
 *   node squads/yard-burguer-squad/scripts/capturar-prints.mjs .tmp-prints
 *
 * A saída vai para .tmp-* de propósito: PNG de página envelhece no dia seguinte
 * e o repo não carrega isso (ver .gitignore).
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE ?? 'http://localhost:4321';
const SAIDA = process.argv[2] ?? '.tmp-prints';
mkdirSync(SAIDA, { recursive: true });

const VIEWPORTS = [
  { nome: 'celular', width: 390, height: 844, isMobile: true, deviceScaleFactor: 2 },
  { nome: 'desktop', width: 1440, height: 900, isMobile: false, deviceScaleFactor: 1 },
];

/**
 * Por seletor e não por índice de rolagem: âncora que sobrevive a uma seção
 * nova entrando no meio da página.
 */
const SECOES = [
  ['01-hero', 'section.hero'],
  ['02-diferenciais', 'section.diferenciais'],
  ['03-cena2-estado-final', '#explode'],
  ['04-mais-pedidos', '#mais-pedidos'],
  ['05-cardapio', '#cardapio'],
  ['06-combos', 'section.combos'],
  ['07-onde-estamos', '#onde-estamos'],
  ['08-chamada-final', 'section.final'],
  ['09-rodape', 'footer.rodape'],
];

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

const navegador = await chromium.launch();

/* ------------------------------------------------------- A) A PÁGINA INTEIRA */
for (const vp of VIEWPORTS) {
  const ctx = await navegador.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: vp.deviceScaleFactor,
    isMobile: vp.isMobile,
    hasTouch: vp.isMobile,
    reducedMotion: 'reduce',
  });
  const pag = await ctx.newPage();
  await pag.goto(BASE, { waitUntil: 'networkidle' });
  // Barra de rolagem de largura zero: some da captura sem roubar largura do
  // viewport medido, que é o erro de quem usa scrolling="no".
  await pag.addStyleTag({ content: 'html::-webkit-scrollbar{width:0;height:0}' });
  await pag.evaluate(() => document.fonts.ready);
  await dormir(600);

  for (const [rotulo, sel] of SECOES) {
    if (!(await pag.$(sel))) {
      console.log(`  ! ${vp.nome} ${rotulo}: seletor sem match (${sel})`);
      continue;
    }
    // scrollTo em vez de scrollIntoView: o Lenis intercepta o segundo e a
    // captura sai no meio da interpolação.
    await pag.evaluate((s) => {
      const e = document.querySelector(s);
      window.scrollTo({ top: window.scrollY + e.getBoundingClientRect().top, behavior: 'instant' });
    }, sel);
    await dormir(450);
    await pag.screenshot({ path: `${SAIDA}/${vp.nome}-${rotulo}.png` });
    console.log(`  ok ${vp.nome} ${rotulo}`);
  }
  await ctx.close();
}

/* ------------------------------------------- B) AS CINCO PARADAS DA CENA 2 */
const ctxB = await navegador.newContext({ viewport: { width: 1720, height: 900 } });
const banc = await ctxB.newPage();
banc.on('pageerror', (e) => console.log('  ! erro na bancada:', e.message));
await banc.goto(`${BASE}/__bancada.html`, { waitUntil: 'networkidle' });
await dormir(1500);
await banc.evaluate(() => window.semBarra());

for (let i = 0; i < 5; i++) {
  // armar() devolve gapEsq/gapDir — NEGATIVO é a marca por trás do produto.
  console.log(`  cena2 parada-${i}:`, JSON.stringify(await banc.evaluate((n) => window.armar(n), i)));
  for (const [id, nome] of [['mob', 'celular'], ['desk', 'desktop']]) {
    await (await banc.$(`#${id}`)).screenshot({ path: `${SAIDA}/cena2-${nome}-parada-${i}.png` });
  }
}

await navegador.close();
console.log('\nprints em', SAIDA);
console.log('NÃO provam o ritmo da cena rolando — isso só no aparelho.');
