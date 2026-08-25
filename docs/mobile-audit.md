# Auditoria mobile — YARD Burguer

Task `audit-mobile-experience` · @mobile-performance-guardian
**Gate com poder de veto** · 2026-08-25

## Veredito: PASSA

Todas as metas de `docs/performance-budget.md` foram atingidas com folga.

## Como foi medido

Chromium headless emulando **Pixel 5**, com throttling aplicado via CDP no perfil
do orçamento — 4G lento (1,6 Mbps down, 150 ms RTT) e **CPU 4× mais lenta**.

Medir em Wi-Fi de desktop responderia à pergunta errada: 90% do tráfego vem do
link na bio, em celular, muitas vezes em rede congestionada de fim de noite.

LCP e CLS vêm de `PerformanceObserver` na página real, não de estimativa. Cada
número abaixo é mediana de três execuções.

## Resultado

| Métrica | Meta | Medido | |
|---|---|---|---|
| LCP | ≤ 2,5 s | **1,01 s** | ✅ |
| CLS | ≤ 0,1 | **0,000** | ✅ |
| Peso total da rota | ≤ 1,5 MB | **690 kB** | ✅ |
| JS que afeta o LCP | ≤ 5 kb gzip | **1,32 kb** | ✅ |
| JS total | ≤ 60 kb gzip | **52,8 kb** | ✅ |
| Área de toque dos CTAs | ≥ 44×44 px | **todos passam** | ✅ |
| Erros de JS | 0 | **0** | ✅ |
| Requisições 404 | 0 | **0** | ✅ |

Elemento de LCP: `H1.hero__titulo`. O texto do hero pinta antes da foto de fundo
terminar — bom sinal, porque a promessa da página chega antes da imagem.

Distribuição do peso: **640 kB de imagem**, 67 kB de fonte, e praticamente nada
de script no caminho crítico.

## Dois defeitos encontrados e corrigidos

### CLS de 0,059 — e não era imagem

A suspeita óbvia era imagem sem dimensão declarada. Havia uma (`hero.webp`), mas
corrigi-la **não mudou o CLS**.

Rastreando as fontes do shift, o culpado apareceu: 0,058 de deslocamento aos
~2021 ms, no `DIV.hero__conteudo`. Exatamente o momento em que o Anton termina de
baixar e o texto reflui. FOUT clássico — o `@fontsource` usa
`font-display: swap`, então a página pinta com a fonte do sistema e se
reorganiza quando a real chega.

**Correção:** preload dos subsets latinos do Anton e do Inter. O Anton passa a
chegar aos ~670 ms, antes do LCP.

**Custo:** o LCP subiu de 844 ms para ~1010 ms. É troca deliberada — 165 ms de
LCP, ainda a 60% da margem do orçamento, por CLS zero.

Descartei `font-display: optional`, que resolveria o CLS sem custo de LCP, porque
ele desiste da fonte em rede ruim: quem estivesse no 4G congestionado veria a
página inteira na fonte do sistema. É precisamente o defeito que os prints
pegaram antes, quando a fonte da marca não carregava — e ele custa a
personalidade da página inteira.

### Áreas de toque abaixo de 44 px

Medidos: "Ver no mapa" 97×24, links do rodapé 179×20 e 68×20, logo da navbar
99×25.

Todos são links de texto, que ficam com a altura da linha. `min-height: 44px` com
`inline-flex` resolve sem mudar o peso visual.

Os links da navbar apareceram como 0×0 — é o `display: none` abaixo de 640 px,
comportamento esperado, não falha.

## Fluidez do scroll

Com CPU 4× throttled e a cena 2 rodando pin + scrub em 7 camadas: **zero erros de
JS**, nenhum long task travando a interação.

A arquitetura de peso é o que sustenta isso — o GSAP só é buscado quando a cena
está a uma tela de distância, então o custo dele nunca cai sobre o carregamento
inicial.

No celular, a cena reduz para 4 camadas e o Lenis nem é baixado, porque scroll
suave por JS atrapalha o toque nativo.

## Aberto, sem impacto no gate

O hero é servido em 1376 px e ocupa até 2880 px em tela retina — está sendo
ampliado ~2×. Não afeta as métricas (o peso já está dentro), mas afeta nitidez.
Depende do take em `gemini-3-pro-image`, que responde 503 desde a aprovação.
