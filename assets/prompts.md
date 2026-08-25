# Registro de prompts — YARD Burguer

Todo prompt usado para gerar mídia deste projeto fica aqui. O objetivo não é
burocracia: é conseguir **regerar o mesmo conjunto** meses depois, quando
ninguém lembrar por que a luz vinha da esquerda.

Regra de composição: uma composição fecha inteira num só modelo e numa só
execução. Regerar significa regerar tudo — nunca metade nova com metade antiga.

---

## Modelos em uso

O plano original pedia `flux/schnell` para rascunho e `Seedream V4` no take
final. Ambos vivem no Higgsfield, e a conta está em `credits: 0`, plano free,
com `unlim.available: false` — verificado em 2026-08-25. Os modelos nem aparecem
na lista que o plano cobre.

A intenção foi mantida com o que existe:

| Papel | Modelo | Quando |
|---|---|---|
| Rascunho | `gemini-3.1-flash-image` | exploração, variantes, iteração de recorte |
| Take final | `gemini-3-pro-image` | só no take aprovado |

Trocar para Seedream assim que o Higgsfield tiver crédito significa **regerar o
conjunto inteiro**, não uma camada avulsa.

---

## Camadas do burger explodido (cena 2)

**Script:** `squads/yard-burguer-squad/scripts/produce-layers.mjs`
**Modelo:** `gemini-3.1-flash-image`
**Saída:** `public/assets/layers/*.webp` + `manifest.json`
**Data:** 2026-08-25

O Gemini não devolve canal alfa — toda resposta vem em JPEG. Por isso as camadas
são geradas sobre chroma magenta e recortadas localmente com `sharp`.

### Preâmbulo (idêntico em toda camada — é ele que garante consistência)

```
Professional food product photography for a premium burger brand. Single
ingredient, photographed straight from the side at eye level, perfectly
horizontal. Soft warm key light from the upper left, gentle fill, no harsh
specular blowout. Shot on 100mm macro lens, sharp focus edge to edge, no
depth-of-field blur. The ingredient floats in the centre of the frame and is
fully visible, not cropped.
```

### Exigência de fundo (vai no FIM do prompt, não no início)

```
CRITICAL REQUIREMENT: the entire background must be one single flat colour,
pure magenta, hex #FF00FF, RGB(255,0,255), edge to edge, perfectly uniform. Do
not use a studio backdrop, gradient, dark background, wood, or any texture. No
shadow cast on the background, no plate, no surface, no props, no hands, no
text. The magenta must touch all four edges of the image.
```

> **Por que no fim:** na primeira versão isso abria o prompt e o `blend` voltou
> com fundo de estúdio escuro. O modelo seguiu a parte concreta (a descrição do
> ingrediente) e descartou a instrução distante.

### Por camada

| id | prompt do ingrediente |
|---|---|
| `pao-superior` | The top half of a glossy toasted brioche burger bun, golden brown, slightly domed. |
| `alface` | A single ruffled leaf of crisp fresh green lettuce, spread flat and wide. |
| `tomate-cebola` | One thick slice of ripe red tomato with a ring of raw purple onion resting on top of it. |
| `queijo` | A square slice of melted cheddar cheese, deep orange, edges softly drooping as if just melted. |
| `blend` | A thick 160g chargrilled beef burger patty, dark seared crust, visible grill marks, juicy. |
| `bacon` | Two strips of crispy fried bacon laid side by side, rippled, deep reddish brown. |
| `pao-inferior` | The bottom half of a toasted brioche burger bun, flat cut side facing up, golden. |

### Parâmetros de recorte que custaram iteração

| Parâmetro | Valor | Descoberta |
|---|---|---|
| chroma | magenta | verde brigaria com alface, azul com cebola roxa, branco com pão |
| `CHROMA_DENTRO` | 90 | abaixo disso é fundo puro |
| `CHROMA_FORA` | 170 | em 200 o recorte comeu a borda do blend e do bacon — o patty perdeu um terço da altura |
| choke | 2 passadas | mata a franja da alface frisada |
| despill por matiz | ligado, exceto `tomate-cebola` | cebola roxa é legitimamente mais azul que verde |

---

## Foto do hero (cena 1)

**Script:** `squads/yard-burguer-squad/scripts/produce-hero.mjs`
**Modelo:** `gemini-3.1-flash-image`
**Saída:** `public/assets/hero.webp`
**Data:** 2026-08-25

### Base (comum às três variantes)

```
Cinematic wide landscape food photograph, 16:9, for a premium burger restaurant
hero banner. Deep dark moody scene: charcoal-brown background, warm amber key
light raking from the side, rustic dark wood surface and a hammered copper
serving tray. Rich terracotta and ember tones, no cool blue tones, no bright
white. IMPORTANT COMPOSITION: the centre of the frame is empty, dark and
uncluttered, because large headline text will be placed there. Keep the food
off-centre, toward the lower left or lower right. Plenty of negative space and
deep shadow in the middle of the image. No text, no logos, no watermarks, no
people looking at camera, no hands in the centre.
```

### Variantes

| # | nome | prompt | veredito |
|---|---|---|---|
| 1 | produto | A single tall artisanal burger with melted cheddar and crispy bacon sits on the copper tray in the lower right corner, glowing under warm light, steam rising softly. | descartada |
| 2 | ambiente | A rustic countryside burger joint table in the lower third: dark wood, copper tray, a burger slightly out of focus, scattered embers of warm light, evoking a backyard grill at dusk in the Brazilian cerrado. | aplicada |
| 3 | processo | Burger patties searing on a hot cast iron grill in the lower left, glowing embers beneath, smoke curling upward into the dark empty space above. | preferida pelo cliente |

### Feedback aberto sobre o hero

Gabriel avaliou em 2026-08-25:

- A composição da **variante 3 (grelha)** acomoda melhor e chama mais atenção.
- O clima do **cerrado ao entardecer** da variante 2 deve ser preservado.
- **O burger montado em primeiro plano parece artificial** — é o elemento que
  mais denuncia geração. As carnes na grelha, a fumaça e a brasa passam bem
  porque são texturas irregulares.

Direção pendente: fundir as duas composições e resolver o burger artificial.
Aguardando prompt do cliente antes de gerar.

---

## Fotos de produto (destaques e combos)

**Não são geradas.** Vêm do CDN público do cardápio do Brendi, coletadas por
`squads/yard-burguer-squad/scripts/fetch-menu-images.mjs`. São fotos reais dos
produtos da casa — sempre preferíveis a imagem gerada quando existem.

Limite conhecido: o CDN só entrega 240×240 e não há rota de resolução maior.
