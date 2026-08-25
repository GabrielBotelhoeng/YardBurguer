# Log de gerações — YARD Burguer

Regras: prompt sempre literal e completo (prompt resumido não é reproduzível).
Nota de 1 a 5 — sem nota o log vira lixo e ninguém consulta. Só **uma correção
testada por vez**: mudando três coisas, não se sabe qual resolveu.

## Sobre seed neste projeto

O sistema pede seed anotada para iterar dentro do mesmo enquadramento. A API de
imagem do Gemini (`generateContent` com `responseModalities: ['TEXT','IMAGE']`)
**não devolve seed na resposta**, e o suporte a seed de entrada ainda não foi
verificado aqui.

Consequência prática: hoje não dá para "manter o enquadramento e mudar só a
luz". Cada geração é um dado novo. Isso torna o bloco de prompt ainda mais
importante — é o único controle determinístico que resta.

**A verificar na próxima geração:** enviar `generationConfig.seed` e gerar duas
vezes com o mesmo valor. Se saírem idênticas, seed funciona e passa a ser
anotada em toda entrada.

---

## 2026-08-25 — camadas do burger explodido (7 peças)

- **Modelo:** `gemini-3.1-flash-image`
- **Seed:** não disponível
- **Custo:** ~11 gerações até fechar o conjunto (3 perdidas em 503, 1 com fundo errado)
- **Saída:** `public/assets/layers/*.webp` + `manifest.json`
- **Nota:** 4/5

**Prompt (preâmbulo idêntico em toda camada — é ele que garante consistência):**

```
Professional food product photography for a premium burger brand. Single
ingredient, photographed straight from the side at eye level, perfectly
horizontal. Soft warm key light from the upper left, gentle fill, no harsh
specular blowout. Shot on 100mm macro lens, sharp focus edge to edge, no
depth-of-field blur. The ingredient floats in the centre of the frame and is
fully visible, not cropped. <PROMPT DA CAMADA> CRITICAL REQUIREMENT: the entire
background must be one single flat colour, pure magenta, hex #FF00FF,
RGB(255,0,255), edge to edge, perfectly uniform. Do not use a studio backdrop,
gradient, dark background, wood, or any texture. No shadow cast on the
background, no plate, no surface, no props, no hands, no text. The magenta must
touch all four edges of the image.
```

**Prompt por camada:**

| id | bloco de sujeito |
|---|---|
| `pao-superior` | The top half of a glossy toasted brioche burger bun, golden brown, slightly domed. |
| `alface` | A single ruffled leaf of crisp fresh green lettuce, spread flat and wide. |
| `tomate-cebola` | One thick slice of ripe red tomato with a ring of raw purple onion resting on top of it. |
| `queijo` | A square slice of melted cheddar cheese, deep orange, edges softly drooping as if just melted. |
| `blend` | A thick 160g chargrilled beef burger patty, dark seared crust, visible grill marks, juicy. |
| `bacon` | Two strips of crispy fried bacon laid side by side, rippled, deep reddish brown. |
| `pao-inferior` | The bottom half of a toasted brioche burger bun, flat cut side facing up, golden. |

**O que funcionou:**
Travar luz, lente e ângulo num preâmbulo fixo deu consistência real entre sete
chamadas separadas — empilhadas, as camadas formam um hambúrguer crível. A
exigência de fundo no **fim** do prompt foi o que fez o modelo obedecer; quando
ela abria o texto, o `blend` voltou com fundo de estúdio escuro.

**O que falhou:**
Faltou bloco de **emulsão e textura**. O queijo e o pão têm superfície lisa
demais — leem como render, não como foto. É o anti-slop de "superfície plástica,
sem poro". Nenhum grão, nenhuma halação, nenhuma imperfeição foi pedida.

**Correção testada:** adicionar ao preâmbulo
`shot on Kodak Portra 400, visible grain in the shadows, soft orange halation on
the highlights, natural surface imperfection — visible pores in the bread,
visible fibre in the meat`.
→ **Ainda não testada.** Exige regerar as 7 (regra de composição única).

---

## 2026-08-25 — hero, 3 variantes

- **Modelo:** `gemini-3.1-flash-image`
- **Seed:** não disponível
- **Custo:** 3 gerações + 4 retries de 503
- **Saída:** `assets/hero/hero-{1,2,3}.webp`

**Base comum:**

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

### Variante 1 — produto · Nota 2/5

**Sujeito:** `A single tall artisanal burger with melted cheddar and crispy bacon sits on the copper tray in the lower right corner, glowing under warm light, steam rising softly.`

**O que falhou:** burger grande e limpo em primeiro plano, o pior cenário para
denunciar geração. Descartada.

### Variante 2 — ambiente · Nota 3/5 · *aplicada em produção*

**Sujeito:** `A rustic countryside burger joint table in the lower third: dark wood, copper tray, a burger slightly out of focus, scattered embers of warm light, evoking a backyard grill at dusk in the Brazilian cerrado.`

**O que funcionou:** o clima. Cerrado ao entardecer, árvores em silhueta, brasa
ao fundo — é a marca. O vazio escuro no centro-direita recebeu a headline sem
briga.

**O que falhou:** o burger em primeiro plano parece artificial. Avaliação do
cliente: composição acomoda pior que a 3.

### Variante 3 — processo · Nota 4/5 · *preferida pelo cliente*

**Sujeito:** `Burger patties searing on a hot cast iron grill in the lower left, glowing embers beneath, smoke curling upward into the dark empty space above.`

**O que funcionou:** a composição acomoda melhor e chama mais atenção. As carnes
na grelha, a fumaça e a brasa passam como reais porque são **texturas
irregulares** — o modelo acerta bagunça com mais facilidade que superfície lisa.

**O que falhou:** o burger montado à direita parece artificial, mesmo defeito da
variante 1.

### Diagnóstico transversal das três

Nenhuma tinha bloco de **lente**, **emulsão** nem **atmosfera**. O prompt tinha
sujeito, composição e paleta — metade da anatomia. Sem grão, halação e
imperfeição, o modelo devolve superfície plástica por padrão.

**Correção isolada a testar no próximo take:** adicionar os blocos 2 (lente),
4 (emulsão) e 6 (atmosfera), **mantendo a composição da variante 3 e o clima da
variante 2**, e **removendo o burger montado do primeiro plano** — o elemento
que mais denuncia geração nas três.

---

## 2026-08-25 — hero fusão, primeiro take sob a anatomia de 7 blocos

- **Modelo:** `gemini-3.1-flash-image` (rascunho — o pro estava em 503)
- **Seed:** `44182` — **aceita pela API sem erro**, determinismo ainda não verificado
- **Custo:** 1 geração (+ 9 tentativas perdidas em 503 nos modelos pro)
- **Saída:** `assets/hero/hero-fusao-rascunho.webp` → aplicada em `public/assets/hero.webp`
- **Nota:** 4/5

**Prompt (literal, montado em blocos por `produce-hero.mjs`):**

```
Beef patties searing on a battered cast iron grill grate in the lower left of
the frame, fat rendering and spitting, char marks forming. No assembled burger
anywhere in the shot. Shot on 50mm at f/2.8, camera at chest height, slight low
angle looking across the grill. Focus on the nearest patty, natural falloff
toward the background. Last light of dusk raking in from the left, low sun
behind silhouetted cerrado trees on the horizon. The glowing embers under the
grate are the second light source and are visible in frame. Long warm shadows,
no frontal fill. Kodak Portra 400 pushed half a stop. Visible grain in the
shadows, soft orange halation bleeding from the embers and highlights, slight
sharpness falloff in the corners. Natural surface imperfection: visible fibre
and irregular sear on the meat, no smooth or plastic surfaces. Charcoal brown
#140C06 dominant, terracotta #8B4A2B in the wood and copper, ember amber
#C87A2E as accent on less than 10% of the frame. No cool blue, no blown-out
white. Smoke curling upward into the dark empty space above. Suspended dust and
ash catching the side light. Grease spatter, char crumbs and a stained cloth on
the worn wood — the mess of a grill actually in use. 16:9 landscape. The centre
and upper right of the frame stay dark, empty and uncluttered for large
headline text. Asymmetric composition, subject off-centre. No centred symmetry,
no HDR, no lens flare, no text, no logos, no hands.
```

**O que funcionou — e resolveu o defeito que motivou tudo isso:**

Os blocos de **emulsão** e **atmosfera** eliminaram a superfície plástica. A
carne tem fibra e selagem irregular, o grão aparece nas sombras, e a cena tem a
bagunça que faltava — farelo de carvão, cinza, pano encardido, respingo na
madeira. Nenhuma das três variantes anteriores tinha isso porque nenhuma pedia.

O bloco de **luz** também rendeu: a brasa sob a grelha é fonte visível dentro do
quadro, e o sol baixo atrás das árvores em silhueta dá a segunda fonte. Some a
sensação de "luz que vem de lugar nenhum".

Tirar o burger montado do primeiro plano foi decisivo. O que sobrou — carne,
fumaça, brasa, madeira gasta — é tudo textura irregular, que é onde o modelo
acerta.

Na página, a headline "FEITO NA BRASA" caiu sobre brasa real: imagem e texto
passaram a afirmar a mesma coisa.

**O que falhou:**

1. A fumaça saiu cinza-azulada. Contradiz o bloco de paleta, que pede
   explicitamente `no cool blue`. É o defeito mais visível que resta.
2. A saída veio em 1376px de largura. O hero ocupa 1440 CSS px, que em tela
   retina são 2880px — a foto está sendo ampliada ~2x e perde nitidez. Não é
   defeito de prompt, é limite de saída do modelo de rascunho.

**Correção testada:** nenhuma ainda — uma por vez.
**Próxima correção isolada (só esta, sem mexer em mais nada):** trocar
`Suspended dust and ash catching the side light` por
`Warm amber smoke lit from below by the embers, no grey or blue tint in the
smoke`.

O problema de resolução se resolve no take em `gemini-3-pro-image`, não no
prompt — pendente, modelo em 503 desde a aprovação.

---

## 2026-08-25 — hero fusão + burger (take em produção)

- **Modelo:** `gemini-3.1-flash-image` (o pro seguia em 503)
- **Seed:** `44182` — mesma do take anterior
- **Custo:** 1 geração
- **Saída:** `assets/hero/hero-fusao-burger.webp` → aplicada em `public/assets/hero.webp`
- **Nota:** 4/5

**Mudança isolada em relação ao take anterior:** apenas o bloco de **sujeito**.
Todos os outros seis blocos ficaram idênticos, para que a diferença fosse
atribuível.

```
Beef patties searing on a battered cast iron grill grate in the lower left of
the frame, fat rendering and spitting, char marks forming. On the worn wood to
the lower right, one finished burger sits slightly off-kilter on a hammered
copper tray: the bun pressed unevenly to one side, sauce escaping and running
down the edge, a few sesame seeds fallen loose on the tray. It is lit only by
the embers and the low sun, half of it falling into shadow, and it sits
slightly behind the plane of focus.
```

**Contexto:** o burger montado tinha sido removido porque era o que denunciava
geração nas três primeiras variantes. Remover resolveu o plástico, mas custou o
produto — uma landing de hamburgueria precisa mostrar hambúrguer. Cliente pediu
de volta.

**O que funcionou:**

Especificar imperfeição ponto a ponto salvou o burger. Cada instrução nega uma
característica de render: pão prensado torto (nega simetria), molho escorrendo
pela borda (nega superfície limpa), gergelim solto na bandeja (nega composição
arrumada), metade na sombra e atrás do plano de foco (nega nitidez uniforme).

Na página a composição fecha: grelha à esquerda, burger à direita, headline no
vazio escuro do meio. O burger fica parcialmente atrás do "HORA." e isso cria
profundidade em vez de atrapalhar.

**Regra que emerge deste par de takes:** o modelo acerta textura irregular e
erra superfície lisa. Objeto liso não precisa ser removido — precisa ser
descrito quebrado.

**O que falhou:**

1. A fumaça continua cinza-azulada. Não foi tocada de propósito: mudar sujeito e
   atmosfera juntos tornaria impossível saber o que resolveu o quê.
2. Saída ainda em 1376px, ampliada ~2x no hero em tela retina.
3. As carnes na grelha ficaram mais pálidas que no take anterior, com menos
   crosta de selagem. Efeito colateral não pedido — a atenção do modelo se
   dividiu com o burger novo.

**Próxima correção isolada (a fila, uma por vez):**
1. `Warm amber smoke lit from below by the embers, no grey or blue tint in the smoke`
2. Reforçar a selagem das carnes na grelha, se o item 1 não resolver junto
3. Take em `gemini-3-pro-image` para resolver resolução

---

## Fotos de produto — não geradas

Destaques e combos usam foto real do CDN público do cardápio do Brendi, via
`fetch-menu-images.mjs`. Foto real sempre ganha de gerada quando existe.

Limite: o CDN só entrega 240×240 e não há rota maior.
