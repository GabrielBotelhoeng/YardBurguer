# Auditoria de acessibilidade — YARD Burguer

Task `audit-accessibility` · @mobile-performance-guardian
**Gate com poder de veto** · rodada de 2026-08-26, com adendo de 2026-09-05

> A rodada anterior (2026-08-25) media a variante **camadas**, só em retrato, e
> deu PASSA com "75 elementos de texto medidos, 0 reprovados". A Cena 2 em vídeo
> entrou em 26/08 12:27 — depois. Esta rodada mede a variante que está no ar, em
> retrato **e em paisagem**.

## Veredito: PASSA COM RESSALVA — reconfirmado em 2026-09-05

Um critério objetivo reprova, e ele já era conhecido e aceito. Mais importante:
esta rodada descobriu que o método de contraste é **cego para o caso principal
da Cena 2** — ver a seção seguinte, que vale mais que o veredito.

> **Adendo de 2026-09-05.** O gate encontrou uma segunda cegueira, do mesmo
> feitio: o julgamento de alvo de toque não vê oclusão nem projeção 3D. Um alvo
> de 26 × 36 px no carrossel foi corrigido e o instrumento que o achou ficou em
> `medir-alvo-toque.mjs`. A ressalva do contraste **continua aberta** — as duas
> seções no fim deste documento dizem o que falta juntar ao gate.

Os dois números de contraste abaixo saem do próprio `audit-page.mjs` e ficam no
`audit.json`. Na primeira versão desta rodada só o de retrato saía dali — o de
paisagem foi medido à mão, por um script de bancada, e o relatório afirmava um
número que o instrumento não coletava. Era o mesmo defeito que esta rodada veio
denunciar, em escala menor; foi corrigido antes de o documento valer.

| Critério | Retrato | Paisagem |
|---|---|---|
| Contraste de texto | 0 reprovados de 79 | 0 reprovados de 82 |
| Alvos de toque ≥ 44 px | 0 problemas de 10 | **3 problemas de 13** ❌ |
| Foco visível no teclado | 13 paradas, 0 sem outline | — |
| `lang`, `h1` único, landmarks | ok | — |
| Imagens sem `alt` | 0 | — |
| Imagens sem dimensão declarada | 0 | — |

## A ressalva que importa: contraste sobre vídeo não é medido

O cálculo de contraste sobe a árvore do DOM procurando um `background-color`
opaco e compõe o alfa. Isso funciona para texto sobre cor — e **não funciona
para texto sobre vídeo ou imagem**, porque o fundo real são os pixels do quadro,
que não estão em nenhum `background-color`.

O título da Cena 2 fica exatamente aí: por cima do take. Este relatório mede
"0 reprovados" nas duas orientações porque enxerga o carvão do palco, não o
vídeo. A medição por amostragem de pixel feita no PR #4 encontrou **2,12–2,86:1
em paisagem**, abaixo do mínimo AA de 3,0.

Ou seja: os dois números não se contradizem, medem coisas diferentes. O "0
reprovados" desta tabela **não cobre o título da Cena 2**, e nenhuma rodada
anterior deste gate cobriu.

Para a próxima rodada, medir texto sobre mídia exige amostrar o quadro por baixo
do texto — que é o que `medir-cena-video.mjs` já faz. Enquanto os dois métodos
não se juntarem, este gate não pode afirmar contraste da Cena 2.

## Alvos de toque: três links de navbar em paisagem

| Elemento | Medido |
|---|---|
| `.nav__link` "Destaques" | 77 × **19** px |
| `.nav__link` "Nosso hambúrguer" | 138 × **19** px |
| `.nav__link` "Onde estamos" | 104 × **19** px |

Altura de 19 px contra mínimo de 44. Os `.nav__link` não têm `min-height`, ao
contrário de `.rodape__link` e `.onde__link`, que já foram corrigidos.

É a **pendência aceita nº 3** do PR #4 — decidida pelo cliente, não regressão.
Fica registrada aqui em vez de ficar só na descrição do PR, que era o buraco
que esta rodada veio fechar.

### Um falso positivo do método, corrigido nesta rodada

A primeira passada acusou "3 alvos de 0 × 0 px" em **retrato**. São esses mesmos
links, que em retrato estão ocultos por `display: none` — `getBoundingClientRect`
devolve zero e o script antigo os contava como reprovados.

Alvo invisível não é alvo de toque. A medição desta rodada filtra por
visibilidade real (`offsetParent` e dimensão > 0) antes de julgar, e em retrato
o resultado correto é **0 problemas de 10 alvos**.

## Carrossel: o alvo que só o dedo enxergava — corrigido em 2026-09-05

Os `.cart__cta` dos cards fora do centro já saíam do Tab e do leitor de tela
(`tabindex="-1"` + `aria-hidden="true"`), mas seguiam com `pointer-events: auto`
por baixo de `opacity: 0`. Eram alvos anunciados como inexistentes e alcançáveis
mesmo assim — a definição de armadilha.

Ninguém navegava para o lugar errado: o listener do slide dá `preventDefault` e
os onze CTAs vão para o mesmo cardápio. O defeito era o toque cair num link
fantasma em vez de cair no card, que é o gesto que a pilha sugere.

Corrigido com `pointer-events: none` no `.cart__base`, devolvido a `auto` no
card central e no bloco de `reduced-motion`, onde os onze cards ficam visíveis
e cada CTA é legítimo.

### O número que circulava estava errado, e o método explica por quê

O achado original falava em **55 × 18 px em todos os cards laterais**. Medido
com varredura, o alvo real era **um** card (`pos=1`, o vizinho da direita), de
**26 × 36 px**. Os outros três não eram alcançáveis por dedo nenhum: dois estão
fora da viewport do Pixel 5 e o terceiro fica coberto pelo `.claro__wrap`.

A diferença vem do instrumento. Sob `rotateY`, `getBoundingClientRect` devolve a
**caixa projetada** — 108 × 41 px para esse mesmo card —, que não é a geometria
que o toque encontra. Medir a caixa dá um número; medir quem `elementFromPoint`
devolve, ponto a ponto, dá outro. Só o segundo é o alvo.

Consequência para o veredito: 26 × 36 px **passa** no WCAG 2.5.8 (AA, 24 × 24) e
reprova no 2.5.5 (AAA, 44 × 44). Era um defeito de nível AAA, não a falha AA que
o relato sugeria — e ainda assim valia corrigir, porque o custo foi uma linha.

### Isto é a mesma cegueira do contraste, na outra ponta

O `audit-page.mjs` julga alvo de toque por `getBoundingClientRect`. Ele não vê
oclusão, não vê `pointer-events` e não vê projeção 3D: um alvo coberto por outro
elemento é contado como bom, e um alvo girado é medido pela sombra. É o gêmeo do
problema de contraste desta rodada — o instrumento mede o que está declarado no
CSS, não o que chega em quem usa.

`medir-alvo-toque.mjs` é a resposta para o carrossel, e traz o próprio controle
junto: desliga a correção por CSSOM na mesma página e remede, porque com
autoplay dois builds nunca param no mesmo card. Juntar essa varredura ao gate é
o item 2 da próxima rodada, ao lado da amostragem de pixel para contraste.

## Redução de movimento

Verificado na variante `video`, que a rodada anterior não conseguia checar — o
script procurava `.explode__camada`, que não existe nesta variante.

Sob `prefers-reduced-motion: reduce`:

- o `<picture>` do último quadro fica visível — o hambúrguer montado, que é o
  estado de repouso prometido;
- **zero requisição de vídeo** é feita;
- nenhum `pin-spacer`, nenhum GSAP, nenhum Lenis;
- o documento mantém 7.449 px, sem o salto de 800 px da versão animada;
- os 2.713 caracteres de texto seguem na página.

O contrato é cumprido inteiro.

## Sem JavaScript

Idêntico ao de reduced-motion: `<picture>` visível, zero byte de vídeo, texto
completo, 6 CTAs clicáveis. A página vende sem uma linha de JS executada.

## Navegação por teclado

13 paradas de foco, todas com `outline` visível, em ordem que segue a leitura da
página.

## Estrutura semântica

`lang="pt-BR"`, um único `h1`, e os quatro landmarks presentes: `header`,
`main`, `footer`, `nav`. Todas as imagens têm `alt` (ou `aria-hidden` quando
decorativas) e todas declaram `width`/`height`.

## Reaberto para a próxima rodada

1. **Contraste sobre mídia** — juntar a amostragem de pixel a este gate. Sem
   isso ele continua cego para a Cena 2.
2. **`min-height` nos `.nav__link`** — pendência aceita; reabrir só com o
   cliente.
