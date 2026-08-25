# Identidade visual — YARD Burguer

## Referência

Parece um **still de documentário gastronômico rodado na hora dourada no
cerrado goiano** — não um render, não catálogo de delivery.

A prova de fogo: se a imagem poderia ilustrar qualquer hamburgueria do mundo,
está errada. Tem que parecer *aqui*.

## Paleta

Tirada de `squads/yard-burguer-squad/data/brand-sertao-premium.md`.

- **Dominante:** carvão `#140C06` — fundo, sombra, o vazio onde o texto entra
- **Secundária:** terracota `#8B4A2B` e areia `#E8DCC8` — madeira, cobre, pão
- **Acento (< 10% do quadro):** brasa `#C87A2E` — ponto de luz, ember, reflexo

`#D93A2B` (fogo) **não entra em imagem.** É cor exclusiva de CTA na interface.
Se aparecer numa foto, compete com o botão.

## Luz padrão

Sol baixo lateral de fim de tarde (~17h30), vindo da esquerda, mais a **brasa
como fonte prática dentro do quadro**. Sombras longas e quentes. Sem fill
frontal — é a queda para a sombra que dá volume.

Regra: a fonte de luz precisa ser identificável no quadro ou logo fora dele.
Luz que vem de lugar nenhum é a assinatura mais óbvia de imagem gerada.

## Lente padrão

- **Cena / ambiente:** 50mm, altura do peito, leve contra-plongée
- **Produto isolado / camada:** 100mm macro, altura do olho, perfeitamente
  horizontal

## Emulsão

Kodak Portra 400 empurrado meio stop. Grão visível nas sombras, **halação suave
e alaranjada nas altas luzes** (a brasa deve sangrar um pouco). Leve queda de
nitidez nos cantos. Sem clareamento digital.

Este é o bloco que mais separa "still" de "render" nesta marca — a brasa com
halação lê como filme; a brasa limpa lê como 3D.

## Atmosfera

Fumaça de churrasqueira, poeira suspensa pegando a luz lateral, gordura e
respingo na madeira. **Cena real tem bagunça.** Farelo, migalha, guardanapo
amassado, objeto fora do lugar.

## Fórmulas aprovadas

Copiadas do `prompts.md` quando tiram nota 5. Reutilizar literalmente.

### [hero] Grelha ao entardecer com burger na bandeja — nota 5

Aprovada pelo cliente em 2026-08-25. Gerada em `gemini-3.1-flash-image`,
seed `44182`. Montada por blocos em `produce-hero.mjs`.

```
Beef patties searing on a battered cast iron grill grate in the lower left of
the frame, deep dark sear crust and char marks, fat rendering and spitting. On
the worn wood to the lower right, one finished burger sits crooked on a hammered
copper tray. The bun is craggy and hand-formed with uneven browning and flour
still dusting the top, squashed lower on one side so the whole burger leans. The
melted cheese is matte, not glossy, and has set unevenly. One edge of the
charred patty juts out past the bun. Sauce has already run down and pooled on
the tray. It is lit only by the embers and the low sun, half of it falling into
shadow, and it sits slightly behind the plane of focus. Shot on 50mm at f/2.8,
camera at chest height, slight low angle looking across the grill. Focus on the
nearest patty, natural falloff toward the background. Last light of dusk raking
in from the left, low sun behind silhouetted cerrado trees on the horizon. The
glowing embers under the grate are the second light source and are visible in
frame. Long warm shadows, no frontal fill. Kodak Portra 400 pushed half a stop.
Visible grain in the shadows, soft orange halation bleeding from the embers and
highlights, slight sharpness falloff in the corners. Natural surface
imperfection: visible fibre and irregular sear on the meat, no smooth or plastic
surfaces. Charcoal brown #140C06 dominant, terracotta #8B4A2B in the wood and
copper, ember amber #C87A2E as accent on less than 10% of the frame. No cool
blue, no blown-out white. Smoke curling upward into the dark empty space above,
lit from below by the embers so it glows warm amber — no grey or blue tint
anywhere in the smoke. Suspended ash catching the side light. Grease spatter,
char crumbs and a stained cloth on the worn wood — the mess of a grill actually
in use. 16:9 landscape. The centre and upper right of the frame stay dark, empty
and uncluttered for large headline text. Asymmetric composition, subject
off-centre. No centred symmetry, no HDR, no lens flare, no text, no logos, no
hands.
```

## Regra descoberta: descrever quebrado, não remover

Objeto de superfície lisa — pão, queijo, molho — é o que denuncia geração. A
saída **não** é tirar o objeto do quadro: é descrever cada imperfeição
explicitamente, porque cada uma nega uma característica de render.

| Instrução | O que nega |
|---|---|
| pão craquelado, torto, prensado de um lado | simetria |
| farinha ainda polvilhada por cima | superfície acabada |
| queijo **fosco**, derretido de forma irregular | brilho plástico |
| carne saindo para fora do pão | alinhamento perfeito |
| molho já escorrido e empoçado na bandeja | cena limpa |
| metade na sombra, atrás do plano de foco | nitidez uniforme |

Isso foi aprendido tirando o burger e vendo o que se perdia: sem ele a imagem
ficava crível mas não vendia produto. Descrito quebrado, ele fica crível *e*
vende.

## Proibido neste projeto

- Céu azul saturado ou qualquer dominante fria — a marca é terrosa
- Branco estourado e HDR "vibrante"
- Superfície plástica: pão sem poro, carne sem fibra, queijo sem irregularidade
- Simetria centralizada **em cena** (ver exceção abaixo)
- Lens flare gratuito e bokeh decorativo em tudo
- Composição limpa demais, tipo foto de estoque
- Amarelo `#FFB300` + vermelho `#E8192C` — a paleta genérica de fast-food que o
  Prompt Base original propunha e que a marca rejeitou

## Exceção: camadas do burger explodido

O anti-slop de "simetria centralizada e sujeito no meio do quadro" **não vale
para as camadas de ingrediente** (`produce-layers.mjs`). Ali o enquadramento
centralizado e frontal é requisito técnico: cada camada é recortada e empilhada
no CSS, e um ingrediente fora de eixo quebraria o empilhamento.

O que continua valendo nelas: emulsão, textura, imperfeição e luz com fonte
identificável. Um queijo simétrico é aceitável; um queijo plástico não.
