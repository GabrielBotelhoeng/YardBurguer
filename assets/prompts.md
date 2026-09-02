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

---

### [diferenciais] As duas pessoas que ladeiam "Por que o YARD é diferente" — foto do cliente, nota n/a

**Não foi gerada.** São duas fotos de estúdio entregues pelo cliente em
2026-08-27 (`referencia/fotos/`), com o personagem da marca em traje árabe:
uma segurando hambúrguer e lata de Coca-Cola, outra segurando hambúrguer e a
placa "VEM PARA A YARD". Ficam registradas aqui porque o log serve para saber de
onde veio cada pixel da página, e não só o que passou por modelo.

**O recorte foi descartado, e o motivo importa** — foi a decisão de composição
desta rodada. A foto da placa tem **manto preto sobre fundo preto**: qualquer
recorte por luminância ou chroma come o manto e o bordado dourado junto com o
fundo. A do thobe branco recortaria bem, mas metade recortada e metade não é
colagem, e a regra de composição única vale aqui igual. O Higgsfield, que tem
`remove_background`, está em `credits: 0`.

Então o fundo preto virou material: ele é o mesmo carvão `#140C06` da paleta, e
as fotos entram como duas colunas escuras encostando o areia da seção numa borda
vertical limpa. A seção lê como cartaz em vez de "duas fotos com margem".

| Saída | Geometria | Peso | Quem baixa |
|---|---|---|---|
| `pessoa-{cocacola,placa}-420.webp` | 420x630 | 22 + 25 kB | celular DPR 2 |
| `pessoa-{cocacola,placa}-620.webp` | 620x930 | 40 + 47 kB | celular DPR 2,6–3 |
| `pessoa-{cocacola,placa}-840.webp` | 840x1260 | 63 + 74 kB | desktop e paisagem |

**O degrau de 620 nasceu de um defeito medido.** Com só 420w e 840w no `srcset`,
`sizes="50vw"` num aparelho DPR 3 pede 585px — e o browser, sem candidato entre
os dois, pegava o 840w. Só o iPhone SE (DPR 2) recebia o arquivo leve; iPhone 13,
Pixel 7 e o próprio Pixel 5 do gate de peso baixavam 137 kB onde 47 bastariam. O
620w derruba isso para 85 kB. **Auditado, não estimado** — se mudar o `sizes`
desta seção, remedir qual arquivo cada DPR baixa antes de dar por certo.

**`object-position` é diferente em cada lado**, porque o assunto está em lugares
diferentes do quadro: a lata mora na borda esquerda da foto 1 (38%), a placa
ocupa a metade direita da foto 2 (60%). Centrar as duas comia a lata de um lado
e a placa do outro.

---

### [carrossel] Os três cards de "Comece por estes" — foto do cliente, nota n/a

**Não foi gerada por mim.** São cinco imagens entregues pelo cliente em
2026-08-31 (`referencia/hambugueres/`), saídas do gerador de imagem do ChatGPT.
Ficam registradas porque o log serve para saber de onde veio cada pixel da
página, e não só o que passou pelos modelos deste projeto.

**O que substituíram:** os quadrados 480x480 do CDN do Brendi, que eram o teto
do que aquele CDN entrega. As três fotos antigas somavam 48 kB e eram o material
mais fraco da página — reamostragem de miniatura de delivery.

**Mapeamento, conferido contra `menu.json` ingrediente por ingrediente:**

| Arquivo de origem | O que está no quadro | Card |
|---|---|---|
| `...14_51_11.png` | coalho tostado, banana da terra caramelizada, bacon | `tapera-do-sertao` |
| `...14_51_33.png` | duas carnes empilhadas, cheddar cremoso em cordão | `supremo` |
| `...15_01_47.png` | jalapeño, pimenta vermelha, cebola crispy | `yard-king` |

**Duas escolhas do cliente contra o que o cardápio diz** — ficam anotadas para
quem for mexer depois não achar que foi descuido:

1. `supremo` recebeu a foto de duas carnes empilhadas, que é a descrição do
   **Yard King**, não do Supremo (Catupiry, costela desfiada, cebola
   caramelizada). O `yard-king` recebeu a foto de jalapeño, que **não
   corresponde a item nenhum** do cardápio. A troca foi pedida explicitamente
   depois de a divergência ser apresentada.
2. A foto do `yard-king` tem a marca **"Alta Grill" gravada na bandeja de cobre**,
   na borda inferior. Aprovada mesmo assim. Na prática o véu do card (0.96 de
   opacidade na base) mais o bloco de texto cobrem quase toda a gravação — mas se
   o véu mudar, ela reaparece.

**As duas sobras não entraram:** `...15_00_09.png` é uma segunda tomada do Tápera
(mesma composição, outro ângulo) e `...14_51_28.png` mostra cebola crispy com
Catupiry, que é o **Open Crysp** — produto real, mas sem card no carrossel hoje.
São o material pronto se o carrossel virar 4 itens.

**O corte virou decisão, e é a mudança que importa.** O original é retrato
(1023x1537 ≈ 2:3) e o card é 4/5. Antes a foto era quadrada e o `object-fit:
cover` cortava 20% sem ninguém escolher onde — daí o `object-position: 50% 42%`
que existia para empurrar o corte. Agora cada foto foi recortada em 4/5 **no
arquivo**, com o hambúrguer centrado, e o `cover` não tem mais nada a tirar. O
`object-position` voltou para o centro e só existe como rede.

| Saída | Geometria | Peso | Corte de origem (`crop=l:a:x:y`) |
|---|---|---|---|
| `tapera-do-sertao.webp` | 640x800 | 47 kB | `1023:1279:0:258` |
| `supremo.webp` | 640x800 | 63 kB | `1023:1279:0:218` |
| `yard-king.webp` | 640x800 | 57 kB | `1086:1358:0:90` |

Fórmula, sem dependência nova — o `ffmpeg` do sistema já tem `libwebp`:

```
ffmpeg -i entrada.png -vf "crop=L:A:X:Y,scale=640:800:flags=lanczos" \
       -c:v libwebp -quality 76 -compression_level 6 -y saida.webp
```

**640x800 e não maior, por causa do gate de peso.** O card chega a 21rem (336px)
no desktop, então 640 cobre 2x em retina com folga. As três somam 166 kB contra
os 48 kB de antes: **+118 kB** numa folga medida de 224 kB (1,217 MB de teto
1,5 MB, ver `docs/mobile-audit.md`). Sobra ~106 kB. Se entrar uma quarta foto
nesse carrossel, **remedir antes** — não há espaço para duas.

---

## 2026-09-02 — hero vertical para o celular: recorte, não geração ★

- **Modelo:** nenhum · **Custo:** 0 crédito
- **Origem:** `public/assets/hero.webp` (o take aprovado 5/5 de 25/08, seed
  `44182`, `gemini-3.1-flash-image`)
- **Saída:** `public/assets/hero-vertical.webp`, 432×768, **23.608 bytes**

**O defeito que motivou.** O dono descreveu: no celular "dá pra ver só uma
grelha e uma mesa". Medido: o arquivo é 16:9 e num aparelho em pé o `cover`
mostra **25,8% da largura**, o centro. E a composição aprovada pôs de propósito
a grelha à esquerda, o burger à direita e o vazio escuro no centro para receber
o texto — ou seja, o assunto está exatamente nas duas pontas que o recorte
descarta primeiro.

**Por que recorte e não take novo.** Um take 9:16 gerado teria que reproduzir a
luz, a fumaça âmbar e o grão de uma imagem que já está aprovada, e o log de
25/08 registra que a seed foi aceita pela API **sem determinismo verificado** —
não há garantia de bater. O recorte carrega a composição aprovada por
construção, e não gasta crédito.

**Fórmula, sem dependência nova (`sharp` já está no projeto):**

```js
sharp('public/assets/hero.webp')
  .extract({ left: 910, top: 0, width: 432, height: 768 })
  .webp({ quality: 78 })
  .toFile('public/assets/hero-vertical.webp');
```

O corte em x=910 põe o hambúrguer (que ocupa x≈990–1310 no original) centrado,
com ~80px de fundo escuro à esquerda para o texto não encostar na comida, e
mantém o pôr do sol na borda direita. Qualidade 78 escolhida medindo as três:
72 dá 20.644 B, 78 dá 23.608 B, 84 dá 29.226 B.

**Peso: ele SUBTRAI.** `<source media>` substitui, não soma. Medido por CDP na
carga real: celular baixa `hero-vertical.webp` = **23.876 B**; desktop baixa
`hero.webp` = **80.638 B**, e nenhum dos dois baixa o outro. O celular economiza
**56.762 bytes** — numa folga de orçamento que era de apenas 21 kB.

**Nitidez também melhora.** Hoje o celular estica 355px do original (os 25,8%)
para 1170px físicos num DPR3: 3,3×. Com o recorte são 432px para os mesmos
1170: **2,7×**. Menos upscale, não mais.

**O que continua em aberto:** 432px de fonte para 1170px de tela ainda é
upscale. Resolver de vez exige um take vertical em resolução maior — decisão do
dono, porque custa crédito e a regra de composição única manda regerar a peça
inteira.

---

## 2026-09-02 — o carrossel passa a mostrar o cardápio inteiro

- **Modelo:** nenhum · **Custo:** 0 crédito
- **Saída:** 11 fotos de hambúrguer + 4 de combo em `public/assets/produtos/`

**O pedido do dono:** "pode adicionar todos os hambúrgueres, pois são fotos
provisórias — assim que eu mandar pra eles vou falar sobre as imagens". O
carrossel mostrava 3 de 11 itens do cardápio.

**De onde veio cada foto:**

| Origem | Itens | Formato |
|---|---|---|
| Material próprio do cliente (PNG de 31/08) | tapera-do-sertao, supremo, yard-king, **open-crysp** | webp 800×1000 q58 |
| CDN do Brendi (`fetch-menu-images.mjs`) | apolo, yard-tropical, yard-moda, burguer-salad, american-smash, cheese-burger, burguer-kids | avif + webp 400px |
| CDN do Brendi | os 4 combos | avif + webp 280px |

**`open-crysp` é o achado.** O `imageId` dele responde **404** no CDN desde
hoje — o Brendi trocou o id. A foto veio da quinta PNG do material do cliente,
que estava sobrando: a mesma que o log de 31/08 identificou como "Open Crysp" e
deixou de fora por não haver card para ela. Crop `1023:1279:0:258`.

**Por que AVIF só em algumas.** Medido na mesma imagem: nas fotos do CDN
(reamostragem de um original de 240px, pouco detalhe fino) o AVIF fica em 64%
do webp — 9.049 contra 14.060 bytes. Nas fotos próprias, que nascem grandes, ele
empata ou perde: 101% a 104%. Então o par `.avif` só existe para as do CDN, e o
componente pergunta ao disco em vez de guardar uma lista.

**Por que cada tamanho.** Medido em 390×844 DPR3, o aparelho do público:

- card do carrossel: 287 CSS px → 860px físicos. Fonte 800 = ampliação **1,07×**
  (era 1,35× a 1,49× com as fotos de 640, e aparecia nas bordas do pão).
- foto de combo: 76–88 CSS px → no máximo 264px físicos. 280 cobre com 6% de
  folga; os 400 anteriores eram 51% de área paga para jogar fora.
- burgers do CDN: 400 e não mais, porque a **fonte** tem 240px. Nenhum número
  alcança a tela quando o teto é o original.

**Peso — passou de 3 para 11 cards sem estourar.** Medido por CDP com a página
rolada inteira: **1.482.098 bytes** contra teto de 1,5 MB, folga de 17.902. O
`main` com 3 cards media 1.479.042. Onze fotos, resolução maior nas próprias, e
3 kB de diferença.

Reproduzir:

```
node squads/yard-burguer-squad/scripts/fetch-menu-images.mjs
node squads/yard-burguer-squad/scripts/recortar-fotos-cliente.mjs
```

**Continua valendo o que o log de 31/08 registrou:** a foto do `supremo` mostra
o produto do Yard King, e a do `yard-king` traz jalapeño e cebola crispy, que
não estão na descrição de nenhum item. São fotos provisórias por decisão do
dono, que vai tratar disso com o cliente.

---

## 2026-09-02 — hero vertical 9:16: prompt PRONTO, geração BLOQUEADA por crédito

- **Modelo pretendido:** `gemini-3-pro-image` (resolve, de quebra, o item aberto
  desde 25/08: saída em 1376px, ampliada em tela retina)
- **Status:** **não gerado.** A API respondeu
  `429 RESOURCE_EXHAUSTED — Your prepayment credits are depleted`. Higgsfield
  também está em `credits: 0`. Ver `CLAUDE.md`.
- **Saída pretendida:** `assets/hero/hero-vertical-take.png` → substituiria
  `public/assets/hero-vertical.webp` (hoje um recorte do take 16:9)

**Por que existir.** O celular hoje recebe um recorte do take deitado (x de 910
a 1342): 432px de fonte para 1170px de tela num DPR3 — ampliação de 2,7×. O
recorte resolveu o enquadramento e o peso, não a resolução. Só um take nascido
vertical resolve.

**O prompt é a fórmula aprovada 5/5 de 25/08, com mudança isolada no
enquadramento.** Os blocos de lente, luz, emulsão e paleta ficaram idênticos
palavra por palavra — se o resultado divergir, a diferença é atribuível à
composição e a mais nada. O que mudou: o burger sobe para primeiro plano na
metade de baixo, a grelha vai para trás e para cima fora de foco, e o terço
SUPERIOR fica vazio para a headline (no 16:9 quem recebia o texto era o centro).

```
One finished burger on a hammered copper tray in the LOWER HALF of a tall
vertical frame, close to camera and slightly off-kilter: the bun pressed
unevenly to one side, sauce escaping and running down the edge, a few sesame
seeds fallen loose on the tray, deep dark sear crust and char marks on the
patty, cheese melted irregular and matte, meat spilling past the edge of the
bun. Behind it and higher up the frame, well out of focus, beef patties sear on
a battered cast iron grill grate, fat rendering and spitting. No hands, no
people. Shot on 50mm at f/2.8, camera at chest height, slight low angle looking
up the length of the grill so the scene stacks vertically. Focus on the near
burger, natural falloff toward the grill behind. Last light of dusk raking in
from the left, low sun behind silhouetted cerrado trees on the horizon. The
glowing embers under the grate are the second light source and are visible in
frame. Long warm shadows, no frontal fill. Kodak Portra 400 pushed half a stop.
Visible grain in the shadows, soft orange halation bleeding from the embers and
highlights, slight sharpness falloff in the corners. Natural surface
imperfection: visible fibre and irregular sear on the meat, no smooth or plastic
surfaces. Charcoal brown #140C06 dominant, terracotta #8B4A2B in the wood and
copper, ember amber #C87A2E as accent on less than 10% of the frame. No cool
blue, no blown-out white. Warm amber smoke lit from below by the embers curling
upward into the dark empty space at the top, no grey or blue tint in the smoke.
Suspended dust and ash catching the side light. Grease spatter, char crumbs and
a stained cloth on the worn wood — the mess of a grill actually in use. 9:16
vertical portrait orientation, tall frame. The UPPER THIRD of the frame stays
dark, empty and uncluttered for large headline text. Asymmetric composition,
subject off-centre and low. No centred symmetry, no HDR, no lens flare, no text,
no logos, no hands.
```

**Para rodar quando houver crédito:** copie o bloco acima para um arquivo
temporário — `assets/hero/` é ignorado pelo git de propósito, é saída bruta — e

```
node squads/yard-burguer-squad/scripts/gemini-image.mjs \
  --prompt "$(cat /tmp/prompt-hero-vertical.txt)" \
  --out assets/hero/hero-vertical-take.png
```

Depois: recortar em 9:16 exato se a saída divergir, converter para webp com
qualidade ~78 e substituir `public/assets/hero-vertical.webp`. **Medir o peso
antes de trocar** — o recorte atual custa 23.876 bytes e a folga do orçamento é
de 17,9 kB. Um take nativo maior pode não caber; nesse caso, ou ele nasce menor,
ou algo sai para pagar.
