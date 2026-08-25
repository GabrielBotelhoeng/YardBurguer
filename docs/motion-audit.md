# Auditoria de fallbacks de movimento — YARD Burguer

Task `audit-motion-fallbacks` · @motion-director · 2026-08-25

## Veredito: PASSA

## Checklist da task

### `prefers-reduced-motion` implementado

Tratado na base, em `src/styles/tokens.css`, não remendado por componente.

Medido com o Chromium em `reducedMotion: reduce`:

- GSAP **não é carregado** — o chunk de 45 kb nem chega a ser buscado
- Lenis **não é ativado**
- **0 de 7** camadas com `transform` aplicado
- Texto da cena 2 em opacidade cheia
- **0 de 13** itens do scroll reveal escondidos
- Zero erros de JS

O `initScrollReveal` nem chega a **armar** os elementos sob redução de
movimento. Isso é diferente de "animar rápido": o conteúdo nunca passa pelo
estado invisível, então não existe janela em que ele possa ficar preso.

### Versão simplificada para mobile

| Cena | Desktop | Mobile |
|---|---|---|
| Burger explodido | 7 camadas | **4 camadas** (`mobileLayers` do manifest) |
| Trilho do scrub | `+=180%` | `+=110%` |
| Scroll suave (Lenis) | ativo | **não é baixado** |
| Blur na navbar | — | não usa, custa GPU em aparelho fraco |

O Lenis fora do celular é decisão de comportamento, não só de peso: scroll suave
por JS briga com o toque nativo e deixa a rolagem com sensação de atraso.

### Conteúdo legível sem JS

Medido com JavaScript desabilitado:

- 2.745 caracteres de texto visível
- 6 CTAs visíveis e clicáveis
- **7 de 7** camadas do burger visíveis

A página funciona inteira. As camadas aparecem empilhadas formando o
hambúrguer — sem a explosão por scroll, mas com o argumento visual de pé.

### Desempenho em aparelho fraco

Testado com **CPU 4× throttled** e 4G lento, que é o perfil do orçamento:

- Zero erros de JS
- Nenhum long task travando a interação
- CLS 0,000 durante toda a rolagem, incluindo a cena pinada

## Regras de movimento respeitadas

| Regra | Situação |
|---|---|
| Só `transform` e `opacity` | ✅ nenhuma propriedade que dispare layout |
| No máximo 1 `pin` | ✅ só a cena 2 |
| Toda cena tem estado final estático | ✅ verificado sob reduced-motion |
| JS de animação no LCP ≤ 5 kb | ✅ 1,32 kb |

## Duas correções que vieram desta auditoria

### O `explodeY` estava sendo multiplicado por `speed`

O pão de baixo tinha `explodeY: 90` com `speed: 0.2` — andava **18 px de
verdade**, praticamente parado, enquanto o de cima andava 180. A explosão só
abria para cima e a base ficava espremida.

Ninguém lê isso olhando o código: os dois valores pareciam razoáveis
separadamente. Só apareceu ao ver a cena rolar em captura real.

`explodeY` passou a ser o deslocamento final em px, simétrico em torno do blend.

### Dois relógios dirigindo o mesmo scroll

O `motion.js` avançava o Lenis num `requestAnimationFrame` próprio, e o GSAP tem
o ticker dele. Dois laços independentes empurrando o mesmo scroll saem de fase a
cada quadro — é fonte direta de trepidação no scrub.

Agora o GSAP assume o Lenis quando entra, cancela o loop provisório e desliga o
`lagSmoothing`, que existe para animação por tempo e inventa salto de posição em
animação dirigida por scroll.

Ambas as correções seguem a documentação oficial do ScrollTrigger.

## Aberto

`animation-timeline: view()` — usado no parallax do hero e dos diferenciais —
ainda não é suportado no Firefox. Lá as duas cenas ficam **estáticas**, não
quebradas.

Aceito de propósito: cobrir o Firefox custaria ~4 kb de biblioteca para refazer o
que o browser já faz nativamente, e o tráfego da página é quase todo Chrome no
Android e Safari no iOS, vindo do link na bio.
