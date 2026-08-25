# YARD Burguer — instruções do projeto

Landing de desejo para hamburgueria em Rio Verde (GO). Astro, CSS puro, zero
framework. O pedido acontece no Brendi; esta página vende a fome e entrega o
clique.

## Geração de mídia

### Antes de gerar QUALQUER coisa

1. Ler `assets/LOOK.md` — a identidade visual deste projeto. Nada é gerado fora
   dela.
2. Ler `assets/prompts.md` — o log do que já foi gerado, com nota. Reaproveitar
   as fórmulas nota 4-5. Não repetir os erros das nota 1-2.
3. Se o pedido for vago ("uma imagem do hero"), **NÃO gerar.** Escrever o prompt
   completo primeiro e mostrar para aprovação.

### Roteamento de modelo — escolher por tarefa, não por hábito

| Tarefa | Modelo pedido | Disponível hoje | Por quê |
|---|---|---|---|
| Rascunho / teste de composição | `flux/schnell` (fal) | `gemini-3.1-flash-image` | centavos, descartável |
| Take final, série consistente | `seedream-v4` (fal) | `gemini-3-pro-image` | melhor consistência entre peças |
| Imagem com texto legível | Nano Banana Pro (Gemini) | idem, via API direta | renderiza texto |
| Rosto de pessoa real recorrente | Higgsfield Soul ID | **indisponível** | única opção com identidade travada |
| Vídeo barato / movimento simples | `wan-2.5` (fal) | **indisponível** | ~$0,05/s |
| Vídeo hero, take único aprovado | Kling / Veo | **indisponível** | caro — só com autorização explícita |

**Estado real das contas** (verificado em 2026-08-25): Higgsfield em
`credits: 0`, plano free, `unlim.available: false`. Não há MCP da fal
configurado. O Gemini tem crédito e é o único caminho funcional.

Quando fal ou Higgsfield voltarem, trocar de gerador numa composição obriga a
**regerar a composição inteira** — nunca uma peça avulsa.

### Portões de custo (não negociáveis)

- **Vídeo: SEMPRE pedir confirmação antes**, com o custo estimado em USD na
  mensagem.
- Uma geração por vez. Nunca lote, nunca "5 variações" sem pedido explícito.
- Rascunho sempre em modelo barato. Modelo caro só depois de composição
  aprovada.
- Antes de gastar em vídeo, perguntar: dá para resolver com frame-sequence no
  canvas? Na maioria dos casos deste projeto, dá — e custa 10x menos.

### Anatomia obrigatória do prompt

Todo prompt de imagem ou vídeo é escrito em blocos explícitos, nesta ordem.
Prompt sem esses blocos gera "cara de IA" e é retrabalho:

1. **Sujeito** — o quê, em uma frase concreta. Sem adjetivo vago.
2. **Lente e distância** — 35mm / 85mm / macro; altura da câmera; ângulo.
3. **Luz** — fonte, direção, hora do dia, dureza. É o que mais decide o
   resultado.
4. **Emulsão / textura** — filme, grão, halação, imperfeição ótica.
5. **Paleta** — 2 ou 3 cores dominantes, tiradas do `LOOK.md`.
6. **Atmosfera** — poeira, névoa, fumaça, umidade. Dá profundidade e camadas.
7. **Movimento** — só vídeo. Um único movimento de câmera por clipe. Nunca dois.

### Anti-slop — evitar sempre, sem precisar pedir

- Simetria centralizada e sujeito no meio do quadro
- HDR saturado, contraste esmagado, "vibrante"
- Pele/superfície plástica, sem poro, sem assimetria
- Lens flare gratuito e bokeh de fundo em tudo
- Luz sem fonte identificável no quadro
- Composição limpa demais: cena real tem bagunça, desgaste, objeto fora do lugar

### Depois de gerar — obrigatório, sem exceção

- Salvar em `public/assets/<secao>/` com nome descritivo, nunca `image-1.png`.
- Registrar em `assets/prompts.md` **antes de continuar a tarefa**.
- Se o cliente disser que ficou bom, promover a fórmula para o `LOOK.md`.

### Manutenção do log

Se o `prompts.md` passar de ~40 entradas, arquivar as antigas em
`assets/prompts-archive.md` e deixar no caminho de leitura apenas as recentes
mais o `LOOK.md`.

## Regra de composição única

Uma composição fecha inteira num só modelo e numa só execução. Metade de um
gerador com metade de outro vira colagem.

Aplicado no código, não só aqui: `produce-layers.mjs` só escreve o
`manifest.json` quando as sete camadas fecham na mesma execução.

## Fatos de produto

Nome, descrição e ingrediente saem de `src/content/menu.json` (cardápio real do
Brendi) e de mais lugar nenhum. A copy reescreve o tom, nunca o fato.

Preço **não é renderizado na página** — vive no Brendi, onde muda.
