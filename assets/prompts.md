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

## Fotos de produto — não geradas

Destaques e combos usam foto real do CDN público do cardápio do Brendi, via
`fetch-menu-images.mjs`. Foto real sempre ganha de gerada quando existe.

Limite: o CDN só entrega 240×240 e não há rota maior.
