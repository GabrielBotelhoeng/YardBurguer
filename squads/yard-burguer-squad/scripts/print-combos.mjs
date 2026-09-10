/**
 * Print da seção de combos, em retrato e paisagem.
 *
 * Existe porque combo é a seção que já levou o feedback "parece site de
 * entrada": ela precisa ser OLHADA depois de mexida, não só medida. Enquadra a
 * seção inteira, então o print muda de altura junto com o número de combos.
 *
 * Uso: ALVO=http://localhost:4471/ node print-combos.mjs
 */
import { chromium, devices } from 'playwright';
import { mkdir } from 'node:fs/promises';

const ALVO = process.env.ALVO ?? 'http://localhost:4471/';
const SAIDA = process.env.SAIDA ?? 'squads/yard-burguer-squad/medicoes/prints';

await mkdir(SAIDA, { recursive: true });
const navegador = await chromium.launch();

for (const [nome, ctxOpts] of [
  ['retrato', { ...devices['Pixel 5'] }],
  ['paisagem', { ...devices['Pixel 5 landscape'] }],
  ['desktop', { viewport: { width: 1440, height: 900 } }],
]) {
  const ctx = await navegador.newContext({
    ...ctxOpts,
    // Sem movimento: a seção tem `data-reveal` e o print pegaria o estado
    // pré-animação, com a lista invisível. Não é o que se quer conferir.
    reducedMotion: 'reduce',
  });
  const pagina = await ctx.newPage();
  await pagina.goto(ALVO, { waitUntil: 'load', timeout: 120000 });
  const secao = pagina.locator('.combos');
  await secao.scrollIntoViewIfNeeded();
  await pagina.waitForTimeout(600);
  await secao.screenshot({ path: `${SAIDA}/combos-${nome}.png` });
  const n = await pagina.locator('.combo').count();
  const vazamento = await pagina.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
  console.log(`  ${nome.padEnd(9)} ${n} combos · vazamento horizontal: ${vazamento ? 'SIM' : 'não'}`);
  await ctx.close();
}

await navegador.close();
console.log(`\n  prints em ${SAIDA}/`);
