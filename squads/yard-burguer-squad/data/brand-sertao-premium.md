# Identidade — Sertão Premium

Direção aprovada pelo cliente na fase de design do squad. **Esta é a fonte da verdade
de marca.** Ela substitui deliberadamente a paleta do `referencia/Prompt Base.txt`.

## Por que não seguimos o Prompt Base

O Prompt Base propunha amarelo `#FFB300` + vermelho `#E8192C`. Essa paleta foi herdada
da referência Dribbble "Burgee" — é a paleta genérica de fast-food, usada por qualquer
hamburgueria do mundo.

A logo real do YARD diz outra coisa: marrom e bege terrosos, duas palmeiras dentro de
um pão. E o carro-chefe da casa chama **"Tapera do Sertão"**. A marca já é regional,
goiana, de quintal — não é rede americana.

Copiar a paleta da referência jogaria fora o único ativo de diferenciação que o YARD já
tem. Vender "mais uma hamburgueria amarela e vermelha" é vender commodity. Vender
"a hamburgueria do sertão" é vender território.

## Paleta

| Token | Hex | Uso |
|---|---|---|
| `--yard-carvao` | `#140C06` | Fundo escuro, navbar, footer, CTA final |
| `--yard-areia` | `#E8DCC8` | Seções claras, respiro |
| `--yard-brasa` | `#C87A2E` | Âmbar de destaque, números, ícones |
| `--yard-terracota` | `#8B4A2B` | Cor de apoio, bordas, cards |
| `--yard-fogo` | `#D93A2B` | **Exclusivo de CTA.** Nunca decorativo |
| `--yard-creme` | `#F5EFE4` | Texto sobre fundo escuro |

**Regra de disciplina:** `--yard-fogo` só existe em elemento clicável que leva ao
cardápio. No momento em que ele vira enfeite, o CTA perde poder de atração.

## Tipografia

- **Display:** condensada, pesada, caixa alta. É ela que preenche o fundo na cena do
  burger explodido — precisa ter peso suficiente para as letras serem "quebradas" pelo
  hambúrguer na frente.
- **Corpo:** sans humanista, boa legibilidade em tela pequena a 16px mínimo.
- **Escala:** o hero usa `clamp()` agressivo. Em mobile o display não pode passar de
  ~13vw ou quebra a composição.

## Textura

Grão de papel / partícula de brasa sutil sobre os fundos escuros. Baixa opacidade
(≤6%). Serve para tirar o aspecto de "template plano". Deve ser CSS ou um único
tile pequeno — nunca uma imagem grande por seção.

## Voz da marca

Regional sem caricatura. Não escrever "uai", "trem bão", sotaque forçado. O tom é
**orgulho de origem**: direto, quente, confiante. "Feito no sertão" e não
"Feito no sertão, sô".

## Aplicação por seção

| Seção | Fundo | Destaque |
|---|---|---|
| Navbar | carvão + blur ao rolar | creme |
| Hero | foto + overlay carvão | fogo (CTA) |
| Burger explodido | carvão | display em terracota |
| Diferenciais | areia | brasa |
| Mais pedidos | areia, cards alternando carvão/terracota | brasa |
| Cardápio | creme | brasa |
| Combos | brasa (seção inteira) | carvão no texto |
| CTA final | carvão + partícula | fogo |
| Footer | carvão | areia |
