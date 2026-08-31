# Onde paramos — 31/08/2026

Branch: `feat/carrossel-e-emendas` · PR **#15** · HEAD `6db8ac3`

Documento de retomada. Escrito porque a sessão trabalhou com agentes em
paralelo e um deles morreu no meio; sem isto, quem voltar não sabe o que está
pronto, o que está quebrado de propósito, e o que trava por falta de decisão do
dono.

---

## Pronto, medido e no PR

| Entrega | Estado |
|---|---|
| Fotos próprias nos 3 cards do carrossel | feito, 4/5 recortado no arquivo |
| Defeito do texto subindo ao topo do card | corrigido (`flex-end` + `margin-bottom: auto`) |
| Copy dos 4 pilares de "Por que o YARD é diferente" | feito, mata a duplicação |
| Copiar endereço em "Onde a gente fica" | feito, com fallback real |
| Cartão do mapa (não é mapa) | feito |
| Barra fixa de pedido no celular | feito |

**Orçamento de peso.** Era 1,217 MB de teto 1,5 MB. As fotos custaram +118 kB
(medido: 1,333 MB), copiar endereço +1,04 kB gzip, barra fixa +539 bytes gzip.
**Remedir antes de qualquer coisa nova** — a folga encolheu bastante e as três
medições foram feitas em momentos diferentes da árvore.

---

## Quebrado de propósito — NÃO mergear sem ler

Worktree `.claude/worktrees/agent-a4138ff1022650326`, branch
`worktree-agent-a4138ff1022650326`, commit **`62366d1`**.

É o **movimento** da seção de diferenciais (stagger, números fantasma, parallax
nas fotos das pessoas). O agente parou no meio de um conserto quando a sessão
estourou o limite.

**O fio para retomar, que ele já tinha achado por medição:** `margin-inline:
auto` num item de grid faz o item virar `fit-content` em vez de `stretch`, e por
isso o min-content do trilho vazava para cima. A correção estava sendo aplicada
quando ele foi interrompido — o estado salvo é o defeito **diagnosticado e ainda
não corrigido**.

A copy daquela seção (`ece7e68`) já veio para cá por cherry-pick e está no PR.

---

## Trava por decisão do dono, não por técnica

1. **"Montado na hora do pedido"** — o quarto pilar novo está no ar mas **não
   tem fonte em `menu.json`**. O mais perto que a página chega é
   `hero.tituloDestaque` ("SERVIDO NA HORA."), que é promessa de entrega, não
   descrição de processo. Se o dono desmentir, **o pilar sai inteiro** — não
   reescrever para uma versão mais fraca do mesmo palpite (Artigo IV).
2. **Preço** — o cliente pediu preço nos lanches e nos combos. O `CLAUDE.md`
   proíbe renderizar preço, porque ele muda no Brendi e a landing passa a
   mentir. Reverter isso é decisão dele, não esquecimento nosso.
3. **Prova social** — não existe **nenhum** depoimento real no repositório.
   `referencia/HOME.jpeg` é mockup de outra marca com depoimento fictício
   assinado "Kristen Stewart", e provavelmente foi de onde veio a ideia. Precisa
   de prints do Google Business ou do `@yardburguer_rioverde`, com autorização.
4. **Deep link do Brendi** — não há como descobrir pelo repositório. Os HTMLs em
   `referencia/` **não são capturas do Brendi** (são blogs sobre geração de
   imagem). Os `imageId` do `menu.json` são do CDN de imagem
   (`images.brendi.com.br`), não da rota do menu. Alguém precisa abrir o
   cardápio, clicar num produto e ler a URL.
5. **Mapa** — o caminho viável seria montar imagem própria de tiles do
   OpenStreetMap (~25-40 kB), mas a atribuição ODbL/CC-BY-SA é dívida jurídica
   que ninguém aqui deve assumir sozinho num site de cliente.

---

## Suspeita levantada e DERRUBADA — a navbar está correta

Fica registrada porque o método de derrubar vale mais que o achado.

**O falso positivo:** a navbar aparecia translúcida com `data-scrolled` aplicado
e a página parada — `rgba(20,12,6,0.22)` numa medição, `rgba(20,12,6,0.682)` em
outra. No screenshot dava para ver o CTA de combos através da barra. Desligar a
`transition` fazia saltar para sólido. Tudo apontava para defeito.

**O que denunciou:** `nav.getAnimations()` mostrava uma `CSSTransition` em
estado `running` que não avançava depois de 4 segundos parado — treze vezes a
duração dela. Transição "rodando" que não progride não é comportamento de CSS,
é relógio parado.

**A prova:** contar quadros e comparar os dois relógios.

```js
const t0 = document.timeline.currentTime, p0 = performance.now();
let quadros = 0;
const conta = () => { quadros++; requestAnimationFrame(conta); };
requestAnimationFrame(conta);
await new Promise(r => setTimeout(r, 2000));
// document.timeline parado + performance.now() andando = renderer congelado
```

Deu **0 quadros em 2 s** e `document.timeline` avançando **0 ms** enquanto
`performance.now()` avançava 2.133 ms. O renderer da aba estava congelado pela
automação — os `Page.captureScreenshot` que deram timeout com "renderer may be
frozen" na mesma sessão eram o mesmo sintoma.

**Regra para a próxima vez:** antes de reportar qualquer defeito de transição,
animação ou timing observado sob automação neste projeto, rodar o teste dos dois
relógios. Vale para Chrome via CDP e vale para o histórico de
[[cena2-so-engata-com-aba-visivel]] — a página quase sempre está certa e o
ambiente de medição é que mente.

---

## Não começado

Marquee do cardápio · snap horizontal nos combos · indicador de seção ativa na
nav · badge de "mais pedido".

**Todos editam o mesmo `src/pages/index.astro`.** Foi por isso que não rodaram
em paralelo com os outros — agentes simultâneos no mesmo arquivo se atropelam.

Dois achados de brinde, não pedidos e provavelmente mais importantes que a
lista acima:

- `copy.json` declara `navbar.links` com 4 itens, mas o `index.astro` **ignora
  esse array** e escreve 3 links à mão, com rótulos que nem estão na copy. Dado
  morto divergindo da tela.
- Abaixo de 640px **a nav inteira some**, sem menu hambúrguer. Bate de frente
  com a regra de que o celular é o cliente principal desta página.

---

## Armadilha operacional aprendida hoje

**Dar porta explícita a cada agente paralelo.** `astro preview` não falha quando
a porta está ocupada — sobe na próxima e só avisa na saída. Três agentes medindo
com `ALVO=http://localhost:4321` fixo mediram, ou quase mediram, o build uns dos
outros. Dois confirmaram ter caído nisso e refizeram as medições em portas
próprias.
