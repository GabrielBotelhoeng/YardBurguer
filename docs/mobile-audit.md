# Auditoria mobile — YARD Burguer

Task `audit-mobile-experience` · @mobile-performance-guardian
**Gate com poder de veto** · rodada de 2026-08-26

> A rodada anterior (2026-08-25) media a variante **camadas** e deu PASSA com
> LCP 1,01 s, CLS 0,000 e 690 kB. A Cena 2 em vídeo entrou em 26/08 12:27, ou
> seja, **depois** — o gate nunca tinha visto a variante que está no ar.

## Veredito: REPROVA

Dois critérios do `performance-budget.md` estouram na variante `video`:

| Meta | Alvo | Medido | |
|---|---|---|---|
| LCP à chegada | ≤ 2,5 s | **1,69 s** | ✅ |
| CLS sem interação | ≤ 0,1 | **0,000** | ✅ |
| **CLS ao rolar desde a chegada** | ≤ 0,1 | **1,85** | ❌ |
| **Peso total da rota** | ≤ 1,5 MB | **1,60 MB** | ❌ |
| Erros de JS | 0 | **0** | ✅ |
| 404 | 0 | **0** | ✅ |

Medido em Pixel 5, 4G do interior (1,6 Mbps, 150 ms de latência) com CPU a 1/4,
contra o build de produção servido estático.

## O salto de layout da Cena 2

É o achado desta rodada e não é ruído de medição.

O ScrollTrigger monta o pin da Cena 2 **depois** que a cena já está na tela. No
instante em que monta, insere um `pin-spacer` de **1.527 px** e o documento
salta de 7.449 px para 8.249 px — 800 px de conteúdo empurrados para baixo com
a pessoa olhando.

```
@    1ms  início               scrollY=   0  topo=727   doc=7449  cena fora da tela
@ 2032ms  pin-spacer inserido  scrollY= 546  topo=181   doc=8249  CENA NA TELA  altura=1527px
@ 2090ms  layout-shift         scrollY= 728  topo=0     doc=8249  CENA NA TELA  valor=1.00
@ 3019ms  layout-shift         scrollY=1638  topo=-111  doc=8249  CENA NA TELA  valor=0.85
```

**A causa é o atraso, não o pin.** A cena carrega por import dinâmico com
`rootMargin: 100%` — uma tela de antecedência. Em 4G lento essa antecedência não
basta: o GSAP e o primeiro quadro do vídeo demoram mais que o tempo de rolagem
até a cena, e o espaçador entra tarde.

**Acontece nas duas variantes.** Em `camadas` o shift também é 1,00 — a
diferença é que lá o espaçador entra com a cena já fora da tela (`topo=-1385`) e
quem pula é a seção seguinte. Ou seja, não é defeito do vídeo: é do mecanismo,
e o vídeo só o deixou mais visível por demorar mais para carregar.

### A condição importa — e é a condição real

**1,8473 em três execuções seguidas**, idêntico até a quarta casa, com os
mesmos dois shifts. Não é flutuação.

Mas só aparece quando a rolagem começa **enquanto a página ainda carrega** — que
é o que uma pessoa faz. Uma medição que espera a página assentar antes de rolar
mede 0,000, porque aí o pin já foi montado antes de qualquer coisa entrar em
quadro.

Isso vale como aviso para quem rodar este gate: **ver 0,000 no `audit.json` não
significa que o salto sumiu.** Significa que a medição esperou demais.

Reproduzir:

```
ALVO=http://localhost:4392/ node squads/yard-burguer-squad/scripts/medir-salto-layout.mjs
```

Ele rola em passos de ¼ de tela a cada 180 ms, começando 1,5 s após o load, lista
cada shift com o elemento que o causou e sai com código 1 quando o CLS passa de
0,1. `MODO=parado` é o controle e deve dar 0,000.

### O que o número significa e o que não significa

O CLS de campo descarta shift ocorrido até 500 ms após input real. Um dedo
humano rolando provavelmente **não** veria esse salto contabilizado no Core Web
Vitals. Aqui ele aparece porque a rolagem é programática, que não conta como
input.

Isso muda o impacto em SEO, não o impacto na pessoa: o salto de 800 px é visível
e acontece no meio da cena que a página existe para mostrar. O gate reprova pelo
que se vê, não pela métrica do relatório do Google.

### Caminho de correção sugerido

Reservar a altura do pin **antes** de o GSAP chegar — a seção já sabe quanto o
trilho vai medir (`+=110%` mobile, `+=180%` desktop). Um `min-height` equivalente
no CSS faria o espaçador nascer com o HTML, e o ScrollTrigger só ocuparia espaço
que já existia. Não foi aplicado nesta rodada: muda o comportamento da cena e
precisa de decisão.

## Peso: 1,60 MB contra teto de 1,5 MB

| Tipo | kB |
|---|---|
| media (o take da Cena 2) | 979 |
| image | 351 |
| script | 118 |
| stylesheet | 66 |
| font | 65 |
| document | 21 |
| **total** | **1.600** |

Estoura o teto em 4%. O vídeo sozinho é 61% da rota. É o preço da variante
`video` e é uma decisão de produto, não um defeito de implementação — mas o
orçamento é um número acordado, e o número foi rompido. Ou o teto sobe por
decisão explícita, ou o take encolhe.

Vale registrar o que **não** entra nessa conta: sob `prefers-reduced-motion` e
sem JavaScript, **zero byte de vídeo é pedido** (verificado nesta rodada). O
peso de 1,6 MB é o do caminho completo, não o do pior caso.

## LCP: 1,69 s, e por que a medição anterior dizia outra coisa

O `audit-page.mjs` rola a página sozinho para capturar shift tardio. Como o LCP
só congela no primeiro input **real**, e scroll programático não é input, o LCP
que ele reporta acaba sendo o maior elemento pintado em qualquer ponto da
página — nesta rodada, `IMG.card__foto` a 4,8 s, uma foto de cardápio que a
pessoa só vê depois de rolar.

Medido à chegada, sem rolagem: **1,69 s em retrato, 1,66 s em paisagem**, com o
LCP em `H1.hero__titulo` — o mesmo elemento da rodada anterior. É esse o número
que descreve a experiência de chegada, e ele passa com folga.

## Fluidez

Sem erro de JS, sem 404, 17 requisições. O scrub do vídeo aplica seek por quadro
(~39% menos seeks que quadros de ticker) e o vigia de degradação foi corrigido no
PR #5 — antes ele expirava antes de existir seek para julgar.

## Reaberto para a próxima rodada

- O salto de layout do pin (acima), que precisa de decisão antes de correção.
- O teto de peso: subir o número ou encolher o take.
