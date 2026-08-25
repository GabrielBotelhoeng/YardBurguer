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

*(Nenhuma ainda — a primeira geração sob este sistema é o hero fundido.)*

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
