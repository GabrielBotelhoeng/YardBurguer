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

## 2026-08-25 — correção da fumaça (take intermediário, descartado)

- **Modelo:** `gemini-3.1-flash-image` · **Seed:** `44182` · **Custo:** 1 geração
- **Saída:** `assets/hero/hero-fumaca.webp` — **não aplicada**
- **Nota:** 3/5

**Mudança:** só o bloco de atmosfera.
`Smoke curling upward into the dark empty space above, lit from below by the
embers so it glows warm amber — no grey or blue tint anywhere in the smoke.`

**O que funcionou:** a fumaça virou âmbar, sem nenhum resquício azulado. Dizer
**de onde vem a luz da fumaça** funciona melhor que proibir a cor: fumaça é
fisicamente neutra e assume a cor de quem a ilumina.

**O que falhou:** o burger regrediu — voltou liso e brilhante, com o queijo
virando mancha lustrosa. As carnes na grelha também ficaram pálidas.

**Descoberta importante sobre o método:** a disciplina de "uma correção isolada
por vez" **depende de seed determinística**, e a API de imagem do Gemini não
tem. Mudei um bloco e o modelo re-sorteou a imagem inteira. Na prática, aqui,
cada geração é uma tentativa nova — não uma variação controlada da anterior.

Consequência: quando um take estiver bom, **o prompt inteiro precisa ir para o
`LOOK.md` como fórmula**, porque não dá para reconstruí-lo por partes depois.

---

## 2026-08-25 — hero final aprovado ★

- **Modelo:** `gemini-3.1-flash-image` · **Seed:** `44182` · **Custo:** 1 geração
- **Saída:** `assets/hero/hero-fumaca-burger.webp` → **em produção**
- **Nota:** 5/5 — **promovida para `LOOK.md`**

**Mudança:** bloco de sujeito reforçado, mantendo a fumaça corrigida. Cada frase
nova nega uma característica de render: pão craquelado e polvilhado de farinha,
prensado de um lado, queijo **fosco** e derretido irregular, carne saindo para
fora do pão, molho já empoçado na bandeja.

**O que funcionou:** tudo o que as duas gerações anteriores tinham de bom, junto.
Fumaça âmbar iluminada pela brasa, burger crível e legível como produto, e as
carnes na grelha recuperaram a crosta escura de selagem que haviam perdido — o
reforço de `deep dark sear crust and char marks` resolveu o efeito colateral sem
precisar de rodada extra.

Na página: fumaça sobe atrás da headline, grelha à esquerda, burger à direita,
brasa embaixo. O vazio escuro no centro recebe o texto sem competição.

**O que falha ainda:** saída em 1376px, ampliada ~2x no hero em tela retina.
Único item aberto, e não se resolve no prompt — depende do take em
`gemini-3-pro-image`, que segue em 503.

---

## Fotos de produto — não geradas

Destaques e combos usam foto real do CDN público do cardápio do Brendi, via
`fetch-menu-images.mjs`. Foto real sempre ganha de gerada quando existe.

Limite: o CDN só entrega 240×240 e não há rota maior.

---

## [camadas] Sete ingredientes em PERFIL — correção de perspectiva

**2026-08-25** · `produce-layers.mjs` · @scroll-trigger-specialist reportou,
@brand-art-director corrigiu

**Defeito:** o cliente disse que os ingredientes "não estão se transformando em
um hambúrguer, está tudo em cima do outro". Não era CSS nem GSAP — era o
conjunto de camadas.

Cada camada tinha sido gerada com um **ângulo de câmera diferente**:

| Camada | Como veio | Devia vir |
|---|---|---|
| `tomate-cebola` | vista de cima, disco inteiro | perfil |
| `blend` | vista de cima, crosta para a câmera | perfil |
| `pao-inferior` | 3/4, face cortada para cima | perfil |
| `pao-superior` | pão rústico oval, quase de frente | tampa de burger em perfil |

Empilhar quatro perspectivas nunca forma um hambúrguer. Forma fotos sobrepostas.

**Causa raiz:** o `PREAMBULO` pedia `at eye level, perfectly horizontal`, mas os
prompts de camada pediam a face de cima com todas as letras — `seeds and pulp
visible`, `flat cut side facing up`, `sear crust`. Entre a instrução distante e
a descrição concreta, o modelo seguiu a concreta. **É o mesmo erro que já tinha
acontecido com o fundo**, e que o script tinha resolvido repetindo a exigência
no fim do prompt. A lição não havia sido aplicada à perspectiva.

**Correção, em três frentes:**

1. `BLOCOS.lente` diz o que se vê e o que **não** se vê: espessura e perfil sim,
   face de cima não. "Eye level" sozinho é ambíguo — a câmera pode estar na
   altura do objeto e ainda olhar para baixo.
2. Novo `EXIGENCIA_PERSPECTIVA`, repetido **depois** da descrição, junto do
   requisito de fundo. Mesma técnica que fez o chroma obedecer.
3. Cada prompt de camada reescrito para descrever o ingrediente de lado. A
   polpa do tomate aparece no corte lateral, não na face; a crosta do blend é a
   borda superior do perfil; o pão superior ganhou `domed`, `BURGER` e `wider
   than it is tall` porque sem isso voltava pão italiano.

**Validação barata antes do take caro** (`gemini-3.1-flash-image`, 2 gerações):

- `tomate-cebola`: 770×583 → **900×187**
- `blend`: 855×577 → **900×269**

A proporção virar faixa larga e baixa É a confirmação — camada de hambúrguer
vista de lado é larga e baixa. Perspectiva resolvida no rascunho.

**O que o rascunho não resolve:** pontos brancos espalhados pelo recorte, com
`fundo 68%` e `fundo derivou, nova rolagem` no log. É o chroma derivando no
modelo barato, não defeito de prompt — as camadas em produção estavam limpas
justamente por terem saído no `pro`. Take final regerado em `gemini-3-pro-image`.

**Nota:** pendente de aprovação do cliente. Se passar, promover o bloco de
perspectiva para o `LOOK.md`, porque ele vale para qualquer conjunto de camadas
futuro — não só para este.

---

## [camadas] Alface e tomate-cebola — o que a pesquisa de food styling corrigiu

**2026-08-25** · segunda correção, depois de o cliente apontar que alface e
cebola continuavam com cara artificial.

**O que a pesquisa mostrou** ([FoodShot AI](https://foodshot.ai/blog/burger-photography),
[Food Bloggers of Canada](https://www.foodbloggersofcanada.com/food-styling-the-burger/),
[Hitchcock Farms](https://www.hitchcockfarms.com/blog/best-lettuce-for-burgers)):

1. **Alface é faixa, não folha.** Food stylist usa folha de borda ondulada
   formando uma faixa contínua que corre pelo perímetro e sobra ~1cm da borda.
   A nossa era uma folha assimétrica — grossa de um lado, ponta fina do outro.
   Centralizada, o pão cobria o meio e sobravam duas pontas soltas nas
   laterais: exatamente o "recorte colado" que o cliente viu.
2. **Cada ingrediente aparece pela FRENTE**, não pelas beiradas — *"every
   ingredient peeking out the front"*. Eu vinha resolvendo tudo por transbordo
   lateral, que é justamente o que denuncia a montagem.

**O defeito real do tomate-cebola:** a camada não estava em perfil. Mostrava a
face cortada inteira (polpa e sementes de frente) e a cebola como elipse
completa deslocada para a direita — vista de cima com outro nome. Empilhada, a
cebola aparecia só de um lado.

**Correções de prompt:**

| Camada | Antes | Depois |
|---|---|---|
| alface | "a single ruffled leaf… thin wavy band" | "a wide continuous band… ONE unbroken layer", negando fragmento isolado e ponta fina |
| tomate-cebola | "cut edge facing the camera" | "reading as a horizontal red band… NOT the flat cut face"; cebola CENTRADA e "never a full ellipse" |

**Armadilha nova, e cara:** pedir `spanning the full width edge to edge` briga
com o bloco de enquadramento, que exige o ingrediente inteiro dentro do quadro.
O modelo obedeceu ao mais concreto e encostou a folha nas quatro bordas — o
resultado empilhado mostrava um **retângulo reto** atrás do pão, com o topo
cortado em linha. A formulação que funciona é "much wider than it is tall" +
"floats fully inside the frame with clear empty margin on all four sides" +
"top contour must be irregular, never a straight horizontal line".

É a terceira vez que o mesmo mecanismo morde este script: **instrução concreta
vence instrução distante**. Já aconteceu com o fundo, com a perspectiva e agora
com o enquadramento.

Resultado: alface 900×320, tomate-cebola 900×234, ambas em perfil e coerentes
com as outras cinco. Nota pendente de aprovação do cliente.

---

## 2026-08-25 · Cena 2 em vídeo — encode do take do cliente (não é geração)

Não houve geração: o take veio pronto do cliente (`burger-stack.mp4`, 10,10 MB,
1920x1080, H.264, 10s a 24fps). O trabalho foi de **encode para scroll-scrubbing**,
e fica registrado aqui porque produziu asset novo em `public/assets/video/`.

Original preservado (fora do build) em `assets/raw/burger-stack-original.mp4`.
Reproduzir: `node squads/yard-burguer-squad/scripts/encodar-video-cena2.mjs`.

**O take chega invertido em relação ao storyboard.** Ele vai de montado para
explodido; a Cena 2 foi invertida em 25/08 a pedido do próprio cliente ("o ato de
construir é o que dá fome"). O vídeo é revertido no ffmpeg, não no runtime —
rolar `currentTime` para trás obriga o decodificador a partir do keyframe
anterior a cada quadro.

| Saída | Geometria | Peso | Onde entra |
|---|---|---|---|
| `burger-stack-16x9.mp4` | 960x540, crf 32, g=12 | 591 kB | desktop |
| `burger-stack-1x1.mp4` | corte 1:1 → 640x640, crf 32, g=12 | 582 kB | mobile |
| `burger-stack-poster-16x9.webp` | 960x540 | 33 kB | estado de repouso |
| `burger-stack-poster-1x1.webp` | 640x640 | 31 kB | estado de repouso |

Só um `.mp4` é baixado por viewport. Os dois juntos ainda pesam menos que os
663 kB dos 7 PNGs de camada que a cena substitui.

**Três medições que contrariaram o palpite** — ficam aqui para ninguém refazer:

1. **Baixar o fps não diminui o arquivo.** Testado 24, 15 e 12 fps: 12fps chegou
   a ficar *maior*. Com GOP fixo em segundos os keyframes dominam o bitrate, e
   cortar fps só remove os quadros P, que são os baratos. 24fps é de graça.
2. **VP9/WebM perdeu do H.264.** A 960x540 com o mesmo GOP: VP9 crf42 = 875 kB
   contra x264 crf30 = 786 kB, com qualidade pior. Keyframe forçado a cada 0,5s
   tira do VP9 exatamente a vantagem dele. Não vale um `<source>` a mais.
3. **Cortar para 1:1 ENCARECE o arquivo.** O corte joga fora o bokeh do balcão,
   que é o pixel barato, e mantém só o hambúrguer, que é o caro. Por isso o
   mobile precisou descer para 640px enquanto o desktop segurou 960.

**Preço da seekability, medido a 960x540 crf30:** g=48 (kf a cada 2s) = 500 kB ·
g=24 = 594 kB · g=12 = 786 kB · g=6 = 1160 kB. Ficamos em g=12: 57% mais pesado
que g=48, e é o que faz o scrub não travar ao buscar.
