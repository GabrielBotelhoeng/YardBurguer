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

## Cena 2 — O BURGER EXPLODIDO ⭐
**A cena que vende o projeto.** Display gigante "YARD BURGUER" preenche o fundo. Na
frente, o hambúrguer aberto com cada ingrediente flutuando em camada própria,
quebrando as letras.

Timeline:
1. **Entrada:** cada camada voa de uma direção diferente e monta o burger.
2. **Scrub:** ao continuar rolando, as camadas se separam de novo, cada uma com
   velocidade própria (pão de cima mais rápido, prato mais lento).
3. Texto de fundo faz parallax mais lento que qualquer ingrediente.

- **Requer:** os 7 PNGs de `produce-ingredient-layers` + o manifest de ordem/offset.
- **Custo:** cena mais pesada do site. `pin` + `scrub`, 7 camadas animadas.
- **Mobile:** reduzir para 4 camadas (pão cima, queijo, blend, pão baixo) e encurtar
  a distância de pin. Nunca remover a cena — ela é o motivo da página existir.

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
| Camadas animadas por cena | máx. 7 desktop / 4 mobile |
| Propriedades animadas | só `transform` e `opacity` |
| JS de animação (gzip) | ≤ 45kb |
| `prefers-reduced-motion` | todas as cenas têm estado final estático |
