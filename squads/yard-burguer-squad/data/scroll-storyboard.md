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
