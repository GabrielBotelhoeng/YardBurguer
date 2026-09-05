/**
 * Mede QUEM recebe o toque em cada card do carrossel.
 *
 * A pergunta não é "o CTA existe" — é "o dedo que pousa no meio dele acerta
 * quem?". Por isso o instrumento é `elementFromPoint` no centro do rect, e não
 * o rect sozinho. Um `<a>` pode estar fora do Tab e fora do leitor de tela
 * (`tabindex="-1"` + `aria-hidden`) e ainda assim ser o alvo que o dedo
 * encontra — foi exatamente o caso dos cards laterais até 2026-09-05.
 *
 * O CONTROLE RODA NA MESMA PÁGINA: mede o estado atual, desliga a regra por
 * `addStyleTag` e remede. Comparar dois builds não serviria — o carrossel tem
 * autoplay e o card do centro muda sozinho entre uma execução e outra.
 *
 * Uso:
 *   ALVO=http://localhost:4471/ node medir-alvo-toque.mjs
 *
 * Dar a porta explicitamente. Ver a lição do `EADDRINUSE` em docs/: medir
 * contra o servidor errado já custou uma bateria inteira de A/B neste projeto.
 */
import { chromium, devices } from 'playwright';

const ALVO = process.env.ALVO ?? 'http://localhost:4471/';

/** Altura mínima de alvo de ponteiro — WCAG 2.5.8 (AA). */
const PISO_AA = 24;

/**
 * A ÁREA É VARRIDA, não amostrada num ponto só.
 *
 * Com `rotateY` nos cards laterais, `getBoundingClientRect` devolve a caixa
 * PROJETADA: o centro dela pode cair fora da geometria real do link, e medir só
 * ali daria "não alcança" para um alvo perfeitamente alcançável dois pixels ao
 * lado. A varredura em grade de 2px responde a pergunta certa — quantos pontos
 * do quadro do CTA de fato entregam o toque ao CTA — e daí sai a MENOR caixa
 * que o dedo realmente encontra, que é o número que o WCAG 2.5.8 cobra.
 */
const sonda = () => {
  // Declarada AQUI dentro: a função é serializada para o navegador, e uma
  // constante do escopo do Node não atravessa junto.
  const PASSO = 2;
  const slides = [...document.querySelectorAll('[data-slide]')];
  return slides.map((slide) => {
    const cta = slide.querySelector('.cart__cta');
    const r = cta.getBoundingClientRect();

    let acertos = 0;
    let amostras = 0;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    const outros = new Set();

    for (let y = r.top; y <= r.bottom; y += PASSO) {
      for (let x = r.left; x <= r.right; x += PASSO) {
        if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) continue;
        amostras++;
        const el = document.elementFromPoint(x, y);
        if (el && el.classList.contains('cart__cta')) {
          acertos++;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        } else if (el) {
          // De QUEM é o elemento importa tanto quanto o que ele é: os cards se
          // sobrepõem, e um `.cart__base` aqui costuma ser o do card CENTRAL
          // passando por cima do vizinho, não o do próprio card medido.
          const dono = el.closest('[data-slide]');
          const nome = el.classList[0] || el.tagName.toLowerCase();
          outros.add(dono ? `${nome}@pos${dono.dataset.pos}` : nome);
        }
      }
    }

    return {
      pos: slide.dataset.pos,
      nome: slide.getAttribute('aria-label').split(': ')[1],
      // A caixa projetada — o que um relatório ingênuo reportaria.
      caixaLarg: Math.round(r.width),
      caixaAlt: Math.round(r.height),
      // A caixa que o dedo realmente encontra.
      alvoLarg: acertos ? Math.round(maxX - minX) : 0,
      alvoAlt: acertos ? Math.round(maxY - minY) : 0,
      acertos,
      amostras,
      foraDaTela: amostras === 0,
      ariaHidden: slide.getAttribute('aria-hidden'),
      tabIndex: cta.tabIndex,
      recebeNoLugar: [...outros].slice(0, 2).join(', ') || '—',
    };
  });
};

const navegador = await chromium.launch();
const ctx = await navegador.newContext({ ...devices['Pixel 5'] });
const pagina = await ctx.newPage();
await pagina.goto(ALVO, { waitUntil: 'load', timeout: 120000 });

// Parar o autoplay pelo hover, senão as duas medições veem cenas diferentes.
await pagina.locator('[data-carrossel]').scrollIntoViewIfNeeded();
await pagina.locator('[data-carrossel]').hover();
await pagina.waitForTimeout(1200);

const depois = await pagina.evaluate(sonda);

await pagina.addStyleTag({ content: '.cart__base { pointer-events: auto !important; }' });
await pagina.waitForTimeout(200);
const antes = await pagina.evaluate(sonda);

const visiveis = (l) => l.filter((r) => r.pos !== 'fora');
const linha = (r) =>
  `  pos=${String(r.pos).padStart(4)}  caixa ${String(`${r.caixaLarg}x${r.caixaAlt}`).padEnd(7)} ` +
  `alvo real ${String(r.alvoLarg ? `${r.alvoLarg}x${r.alvoAlt}` : '—').padEnd(7)} ` +
  `${String(`${r.acertos}/${r.amostras} pts`).padEnd(13)} ` +
  `aria-hidden=${String(r.ariaHidden).padEnd(5)} tabindex=${String(r.tabIndex).padStart(2)}  ` +
  `no lugar: ${String(r.recebeNoLugar).padEnd(22)} ${r.nome}`;

console.log('\nCONTROLE (pointer-events: auto — o estado anterior à correção):');
visiveis(antes).forEach((r) => console.log(linha(r)));

console.log('\nATUAL:');
visiveis(depois).forEach((r) => console.log(linha(r)));

const capturam = (l) => visiveis(l).filter((r) => r.pos !== '0' && r.acertos > 0);
const central = visiveis(depois).find((r) => r.pos === '0');
const subDimensionados = capturam(antes).filter((r) => r.alvoAlt < PISO_AA);

console.log('\nVEREDITO');
console.log(`  laterais alcançáveis pelo dedo — controle: ${capturam(antes).length}` +
  (capturam(antes).length ? ` (${capturam(antes).map((r) => `pos=${r.pos} ${r.alvoLarg}x${r.alvoAlt}`).join(', ')})` : ''));
console.log(`  desses, abaixo de ${PISO_AA}px de altura (WCAG 2.5.8): ${subDimensionados.length}`);
console.log(`  laterais alcançáveis pelo dedo — atual:    ${capturam(depois).length}`);
console.log(`  card central segue clicável: ${central?.acertos > 0 ? 'SIM' : 'NÃO — REGRESSÃO'}` +
  ` (alvo real ${central?.alvoLarg}x${central?.alvoAlt}px)`);

/**
 * O CONTRATO QUE A CORREÇÃO NÃO PODE QUEBRAR.
 *
 * Tirar o ponteiro do `.cart__base` só é correto se o toque atravessar até o
 * card. Se atravessasse até o palco, o gesto morria e o carrossel ficava sem
 * navegação por toque nos vizinhos — troca muito pior do que o alvo de 26px.
 */
await pagina.reload({ waitUntil: 'load' });
await pagina.locator('[data-carrossel]').scrollIntoViewIfNeeded();
await pagina.locator('[data-carrossel]').hover();
await pagina.waitForTimeout(1200);

/**
 * O PONTO DO CLIQUE É PROCURADO, não calculado.
 *
 * O centro do bbox do CTA vizinho cai por cima do CARD CENTRAL — os cards se
 * sobrepõem e o do meio tem `z-index: 30`. Clicar ali testa o card errado: o
 * listener retorna cedo em `pos === '0'` e o teste acusa uma regressão que não
 * existe. Custou uma rodada descobrir isso.
 *
 * Então o teste varre o quadro do link fantasma e clica no primeiro ponto que
 * comprovadamente pertence ao slide vizinho.
 */
const alvoDoClique = await pagina.evaluate(() => {
  const vizinho = document.querySelector('[data-slide][data-pos="1"]');
  const r = vizinho.querySelector('.cart__cta').getBoundingClientRect();
  for (let y = r.top; y <= r.bottom; y += 2) {
    for (let x = r.left; x <= r.right; x += 2) {
      if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) continue;
      const el = document.elementFromPoint(x, y);
      if (el?.closest('[data-slide]') === vizinho) return { x, y, dono: el.className.split(' ')[0] };
    }
  }
  return null;
});

const antesDoClique = await pagina.evaluate(
  () => document.querySelector('[data-slide][data-pos="0"]').dataset.indice
);

if (!alvoDoClique) {
  console.log('  nenhum ponto do quadro do CTA fantasma pertence ao card vizinho');
} else {
  console.log(
    `  ponto tocado: (${Math.round(alvoDoClique.x)}, ${Math.round(alvoDoClique.y)}) sobre .${alvoDoClique.dono}`
  );
  await pagina.mouse.click(alvoDoClique.x, alvoDoClique.y);
  await pagina.waitForTimeout(900);
}

const depoisDoClique = await pagina.evaluate(() => ({
  centro: document.querySelector('[data-slide][data-pos="0"]').dataset.indice,
  saiuDaPagina: location.pathname !== '/',
}));

const centralizou = depoisDoClique.centro !== antesDoClique && !depoisDoClique.saiuDaPagina;
console.log(
  `  toque no vizinho ainda o centraliza: ${centralizou ? 'SIM' : 'NÃO — REGRESSÃO'}` +
    ` (card ${antesDoClique} -> ${depoisDoClique.centro})`
);

const passa =
  capturam(depois).length === 0 && central?.acertos > 0 && central?.alvoAlt >= PISO_AA && centralizou;
console.log(`\n  ${passa ? 'PASSA' : 'REPROVA'}`);

await navegador.close();
process.exit(passa ? 0 : 1);
