# Auditoria de acessibilidade — YARD Burguer

Task `audit-accessibility` · @mobile-performance-guardian
**Gate com poder de veto** · 2026-08-25

## Veredito: PASSA

## Contraste de texto

**75 elementos de texto medidos, 0 reprovados.**

O cálculo usa a fórmula de luminância relativa da WCAG, com o limite variando
por tamanho: 4,5:1 para texto normal e 3:1 para texto grande (≥ 24 px, ou
≥ 18,66 px em negrito).

### Defeito encontrado e corrigido: os CTAs

Todos os botões principais mediam exatamente **4,00** — abaixo do mínimo de 4,5.

A causa: creme `#F5EFE4` sobre o vermelho fogo `#D93A2B`. O texto do CTA é
negrito de 16 px, e 16 px não alcança o limite de "texto grande", que começa em
18,66 px. Passava perto o suficiente para ninguém desconfiar a olho nu.

**Correção:** o texto do CTA vai para branco puro, o que leva a razão para
**4,57**.

Escurecer o fogo também resolveria, mas o fogo é token de marca e mudá-lo
alteraria a cor de todo CTA da página por causa de um problema que é de texto.

### Um falso positivo que quase virou retrabalho

A primeira rodada acusou contraste **1,0** nos cards de combo — o que
significaria texto invisível.

Era erro do meu script de auditoria: ele lia os três primeiros números de
`rgba(20, 12, 6, 0.07)` e tratava a cor como opaca, ignorando o alfa. O fundo
real é a mistura de 7% de carvão sobre brasa, e o contraste verdadeiro é
**5,14** — passa com folga.

O script foi corrigido para compor as camadas de alfa até encontrar um fundo
opaco. Falso positivo em auditoria é pior que auditoria nenhuma: manda corrigir
o que não está quebrado, e queima a confiança no resto do relatório.

## Navegação por teclado

Percorridos os 13 primeiros elementos focáveis:

- **Ordem de tabulação segue a ordem visual.** Nenhum salto.
- **Todos com anel de foco visível** — o `:focus-visible` com contorno em brasa
  está nos tokens desde o início e funciona em todos.
- Nenhuma armadilha de foco.

## Texto alternativo

**15 imagens, nenhuma sem `alt`.**

- As 7 camadas do burger usam a legenda do ingrediente como `alt` — "Blend de
  160g", "Cheddar derretido na chapa". Descrevem o que a imagem mostra, não o
  nome do arquivo.
- Cards de produto e combos trazem nome e composição.
- A foto de fundo do hero tem `alt=""` e `aria-hidden="true"`, que é o correto:
  ela é decorativa e o conteúdo já está no `H1`.

Todas declaram `width` e `height`.

## Redução de movimento

Testado com `prefers-reduced-motion: reduce`:

| Verificação | Resultado |
|---|---|
| GSAP carregado | **não** — o chunk de 45 kb nem é buscado |
| Lenis ativo | **não** |
| Camadas com `transform` | **0 de 7** |
| Texto da cena 2 visível | **sim**, opacidade cheia |
| Itens do scroll reveal ocultos | **0 de 13** |
| Erros de JS | **0** |

Isto é mais forte que "a animação fica mais lenta": sob redução de movimento a
página simplesmente **não anima**, e todo conteúdo nasce no estado final. O
tratamento está na base, no `tokens.css`, e não remendado por componente.

## Sem JavaScript

| Verificação | Resultado |
|---|---|
| Texto visível | 2.745 caracteres |
| CTAs visíveis | 6 |
| Camadas do burger visíveis | 7 de 7 |

A página inteira funciona sem JS. As camadas aparecem empilhadas — sem a
explosão por scroll, mas formando o hambúrguer, que é o argumento visual.

## Estrutura semântica

- `lang="pt-BR"` no `<html>`
- Exatamente **1 `<h1>`**
- Landmarks presentes: `header`, `nav`, `main`, `footer`
- Endereço em `<address>`, horário e pagamento em `<dl>`

## Alvos de toque

Ver `docs/mobile-audit.md` — quatro elementos abaixo de 44 px foram encontrados e
corrigidos. Nenhum reprovado na medição final.
