# Storyboard de Scroll — 9 cenas

Contrato compartilhado entre `@motion-director`, `@hunger-copywriter` e
`@mobile-performance-guardian`. Cada cena declara o que acontece, o que pode ser
cortado em mobile e qual o custo.

Notação: `scrub` = animação amarrada ao scroll. `pin` = seção travada enquanto anima.

---

## Cena 0 — Navbar
Fixa. Transparente no topo; ao passar de 80px ganha fundo carvão + `backdrop-filter`.
Logo à esquerda, dois botões à direita (contornado + sólido "Ver Cardápio").

- **Mobile:** vira hambúrguer menu. `backdrop-filter` é caro em GPU fraca — usar
  fundo sólido opaco abaixo de 768px.

## Cena 1 — Hero
Foto real do burger em full bleed, overlay carvão. Headline entra da esquerda no load.
Ken Burns lento e infinito na foto (scale 1 → 1.08, 20s).

- **Custo:** esta é a imagem de LCP. `fetchpriority="high"`, AVIF, sem lazy.
- **Mobile:** Ken Burns só via CSS `transform` (compositado). Se o device tiver
  `prefers-reduced-motion`, imagem estática.

## Cena 2 — A MONTAGEM DO BURGER ⭐
**A cena que vende o projeto.** Display gigante "YARD BURGUER" preenche o fundo. Na
frente, os ingredientes em camada própria, quebrando as letras.

**Invertida em 2026-08-25, a pedido do cliente.** Antes o hambúrguer chegava montado
e se separava — o usuário via um produto se desmanchar. Agora o scroll constrói: as
peças chegam espalhadas e se juntam até virar um hambúrguer de verdade. O ato de
construir é o que dá fome; o de destruir, não.

Timeline:
1. **Início do trilho:** as 7 camadas espalhadas, cada uma com desvio lateral e giro
   próprios, o conjunto em escala reduzida.
2. **Scrub:** as camadas convergem para o lugar **de baixo para cima** — pão inferior
   primeiro, superior por último —, escalonadas, enquanto o conjunto cresce até a
   escala cheia.
3. **Fim:** hambúrguer montado, e só então o título entra e nomeia o que foi montado.
4. Texto de fundo faz parallax mais lento que qualquer ingrediente.

- **Requer:** os 7 PNGs de `produce-ingredient-layers` + o manifest de ordem/offset.
- **Custo:** cena mais pesada do site. `pin` + `scrub`, 7 camadas animadas.
- **Estado de repouso:** o HTML nasce com o hambúrguer **montado**. A dispersão é
  aplicada pelo GSAP como ponto de partida, então o fim da animação coincide com o
  estado estático — é o que faz `prefers-reduced-motion` e o caso sem JS mostrarem o
  produto inteiro, não peças soltas.
- **Mobile:** as 7 camadas rodam em qualquer viewport desde que o manifest passou a
  marcar `mobile: true` no conjunto inteiro (a redução para 4 escondia alface, tomate
  e bacon, deixando marrom sobre marrom). O que muda no celular é o alcance da
  dispersão e o trilho de pin, não a quantidade de camadas. Nunca remover a cena —
  ela é o motivo da página existir.
- **Escala é restrição, não enfeite:** a pilha montada mede ~1,86× a largura do
  container. Separar 7 camadas sem reduzir a escala transborda o viewport — medido:
  cortava 109px em cima e 194px embaixo. Por isso o conjunto começa menor e cresce.

## Cena 2b — A MONTAGEM DO BURGER, variante em VÍDEO ⭐ (a que renderiza hoje)

A Cena 2 existe em **duas versões vivas**, e a flag em `src/config/cena2.js` decide
qual entra no build. O padrão é `video` desde 2026-08-26; a de camadas acima continua
funcionando e é a base de comparação. Só uma renderiza por vez — o orçamento de
movimento admite um pin por página.

Mesmo lugar no storyboard, outro material: em vez de sete PNGs animados por GSAP, um
take único do cliente com o scroll dirigindo `video.currentTime`.

**O take não monta camada por camada, e isso decide a coreografia.** Medido nos 192
quadros dos dois arquivos: as sete camadas estão na tela o tempo inteiro; o que se
move é o espaçamento, que abre até o meio e fecha no fim. Não existe "o quadro em que
o queijo entra" — logo, nada pode ser amarrado a evento de entrada. A rolagem virou
então uma **descida pela pilha**, que é verdade sobre o material e sobrevive a um take
novo.

Timeline (0 = topo do trilho, 1 = fim do pin):

| ponto | o que acontece |
|---|---|
| 0,00 → 0,94 | o vídeo é scrubado: peças espalhadas → hambúrguer fechado |
| 0,04 → 0,10 | o véu sobe até 0,82 — antes de existir texto para proteger |
| 0,06 → 0,80 | a marca acende nas laterais e apaga |
| 0,10 → 0,78 | **cinco paradas**, uma de cada vez, no slot da base |
| 0,84 → 0,94 | o título entra e nomeia o que foi montado |
| 0,94 → 1,00 | o **quadro de recompensa**: tudo pronto, seção ainda travada |

As cinco paradas, lidas de cima para baixo da pilha: Pão brioche · Bacon crocante ·
Cheddar derretido · Blend de 160g · Três molhos da casa. As três "provas da casa"
moram dentro delas (1, 4 e 5) em vez de virarem um segundo carrossel.

- **A marca ladeia, não atravessa.** `YARD` desce pela lateral esquerda e `BURGUER`
  pela direita, em `mix-blend-mode: screen` — ela soma luz ao quadro em vez de se
  sentar sobre ele, então acende no fundo escuro e recua sozinha em cima do pão. Foi
  centralizada até 26/08 e o cliente recusou: cruzava o produto no meio.
- **Nunca três tipografias no mesmo quadro.** A janela de cada elemento é exclusiva:
  a marca apaga em 0,80 e o título só entra em 0,84.
- **Mobile:** idêntico ao desktop, e isso custou um re-encode. O quadro vertical
  compõe com `RECUO 0.72` (contra 0.85 do 2:1) justamente para abrir a lateral que a
  marca precisa — sem isso o produto ocupava 75,7% da largura e sobravam 10px de
  folga à direita, com as palavras atrás do hambúrguer. Ver
  `encodar-video-cena2.mjs`.
- **Trilho:** 240svh no desktop, 150svh no celular. Mais longo que o da variante em
  camadas de propósito, porque esta tem cinco leituras e aquela não tem nenhuma.
- **Estado de repouso:** o `<picture>` do último quadro — o hambúrguer montado. Sob
  `prefers-reduced-motion` e sem JS, nenhum byte de vídeo é baixado e as paradas não
  existem (os mesmos fatos estão em texto estático na Cena 3).
- **Verificação:** `verificar-agenda-cena2.mjs` confere a aritmética dos 18 marcos.
  A cena rolando de verdade **não** é verificável por automação — `IntersectionObserver`
  não dispara em aba dirigida por CDP.

## Cena 3 — Por que o YARD é diferente
Fundo areia. Burger PNG flutuando à esquerda, texto e 4 ícones à direita, entrando em
direções opostas. Ícones em cascata com delay.

Os 4 pilares: Blend Artesanal · Pão Brioche · Molhos Exclusivos · Smash.

## Cena 4 — Os mais pedidos
Cards alternando carvão e terracota. Entram de baixo em sequência. Hover: sobe +
sombra + zoom leve na foto.

Itens: **Tapera do Sertão** (carro-chefe, merece destaque maior), Yard King, Supremo.

- **Mobile:** hover não existe — o card precisa já nascer legível e clicável.
- **Fonte das fotos:** reais, do Instagram (`harvest-instagram-assets`).

## Cena 5 — Cardápio completo
Fundo creme, tabs (Burgers / Porções / Bebidas). Itens em cascata ao trocar de tab.

- **Decisão:** esta seção **não** substitui o Brendi. É vitrine. Todo item leva ao
  cardápio real. Manter preços sincronizados ou omiti-los para não desatualizar.

## Cena 6 — Combos
Fundo brasa inteiro, texto carvão. Burger PNG à direita em float loop suave.
3 combos + botão fogo "Pedir Agora".

## Cena 7 — CTA final
Fundo carvão. Texto grande creme com uma palavra em brasa. Botão fogo pulsando.
Partículas de brasa subindo ao fundo.

- **Custo:** partículas em canvas podem custar caro. Teto: 30 partículas, pausar
  quando a seção sai da viewport, desligar em reduced-motion.

## Cena 8 — Footer
Carvão. Logo, links rápidos, `@yardburguer_rioverde`, link do cardápio, endereço
Rio Verde-GO (o endereço também alimenta o SEO local).

---

## Orçamento de movimento

| Regra | Valor |
|---|---|
| Cenas com `pin` simultâneas | máx. 1 |
| Camadas animadas por cena | máx. 7, em qualquer viewport |
| Propriedades animadas | só `transform` e `opacity` |
| JS de animação (gzip) | ≤ 45kb — **estourado hoje: 46,1kb** (ver nota) |
| `prefers-reduced-motion` | todas as cenas têm estado final estático |

**Nota sobre o teto de 45kb (medido em 2026-08-25):** o chunk da Cena 2 fecha em
46,12kb gzip. O estouro não veio da inversão da cena — o build anterior já marcava
45,98kb, e a mudança somou 140 bytes. O piso é o próprio GSAP core + CSSPlugin +
ScrollTrigger, que não desce de ~46kb juntos. O teto foi escrito antes de existir
medição real e precisa ser rediscutido com o `@mobile-performance-guardian`: ou sobe
para 47kb, ou a cena troca de biblioteca. O chunk é carregado sob demanda e não entra
no LCP, que o gate mediu em 1,01s.
