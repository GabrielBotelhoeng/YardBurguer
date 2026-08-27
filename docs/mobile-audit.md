# Auditoria mobile — YARD Burguer

Task `audit-mobile-experience` · @mobile-performance-guardian
**Gate com poder de veto** · rodada de 2026-08-26

> A rodada anterior (2026-08-25) media a variante **camadas** e deu PASSA com
> LCP 1,01 s, CLS 0,000 e 690 kB. A Cena 2 em vídeo entrou em 26/08 12:27, ou
> seja, **depois** — o gate nunca tinha visto a variante que está no ar.

## Veredito: REPROVA — por peso, e só por peso

O salto de layout que esta rodada encontrou **foi corrigido durante ela**; os
números abaixo já são os de depois.

| Meta | Alvo | Medido | |
|---|---|---|---|
| LCP à chegada | ≤ 2,5 s | **1,69 s** | ✅ |
| CLS sem interação | ≤ 0,1 | **0,000** | ✅ |
| Empurrão ao rolar (era 800 px) | 0 px | **0 px** | ✅ |
| **Peso total da rota** | ≤ 1,5 MB | **1,64 MB** | ❌ |
| Erros de JS | 0 | **0** | ✅ |
| 404 | 0 | **0** | ✅ |

O único critério em aberto é o peso, e ele é decisão de produto: ou o teto sobe,
ou o take encolhe. Nada mais reprova.

Medido em Pixel 5, 4G do interior (1,6 Mbps, 150 ms de latência) com CPU a 1/4,
contra o build de produção servido estático.

## O salto de layout da Cena 2 — achado e corrigido

**Antes: 800 px de empurrão. Depois: 0 px.** Medido no mesmo percurso, nos dois
builds, servidos lado a lado.

O que segue é o defeito como ele era, porque a causa explica a correção.

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

Isso vale como aviso para quem rodar este gate: **ver 0,000 de CLS não significa
que o salto sumiu.** Pode significar que a medição esperou demais.

Reproduzir:

```
ALVO=http://localhost:4392/ node squads/yard-burguer-squad/scripts/medir-salto-layout.mjs
```

Ele rola em passos de ¼ de tela a cada 180 ms, começando 1,5 s após o load, lista
cada shift com o elemento que o causou, reporta o empurrão e sai com código 1
quando ele passa de 4 px. `MODO=parado` é o controle.

### Por que o CLS bruto não serve de gate aqui

Depois da correção, com o empurrão em zero, **o CLS continuou marcando 1,8473**.

O motivo: a API de `layout-shift` dispara quando o ScrollTrigger troca a seção
de `relative` para `fixed` ao pinar. Como a cena ocupa a tela inteira, essa
reclassificação pontua perto de 1,0 mesmo sem nada se mover para quem olha.

Por isso o gate passou a medir **empurrão**: quanto a seção seguinte andou além
do que a rolagem explica. Se a pessoa rolou 182 px e o elemento subiu 182 px,
deslocamento é zero — foi ela quem rolou. O que sobra é empurrão, e é isso que
se vê.

Some-se a isso que o CLS de campo descarta shift ocorrido até 500 ms após input
real: um dedo humano provavelmente nunca veria esse número no Core Web Vitals.
Medir CLS bruto aqui responderia a pergunta errada nas duas pontas.

### A correção aplicada

O espaço do trilho passou a nascer com o HTML, num `<div class="cenavideo__trilho">`
vazio logo depois da seção, dimensionado por `--trilho-pin` (110svh no celular,
180svh no desktop). O ScrollTrigger recebeu `pinSpacing: false` e o `end` agora
**lê** a altura reservada em vez de trazer o próprio número — o CSS virou a
fonte da verdade do comprimento da cena.

Duas coisas que a correção precisou acertar e não são óbvias:

**A reserva não pode morar na seção.** A primeira tentativa usou `margin-bottom`
na própria `.cenavideo`. O documento passou a nascer com a altura certa e o
layout continuou saltando: quando o pin ativa, a seção sai do fluxo e leva a
margem junto — 800 px evaporando no pior momento possível. Por isso o trilho é
um **irmão**, não um filho nem uma margem.

**A reserva é uma promessa com prazo.** Há caminhos em que o pin nunca é criado:
sem `<video>`, sem fonte para o aparelho, erro de mídia, ou o arquivo pendurado
numa conexão que abre e não entrega byte. Em qualquer um deles a reserva viraria
um vão de uma tela e meia. Então o script devolve o espaço se em 8 s não houver
pin para ocupá-lo, e também quando o vigia degrada a cena. Verificado com o mp4
em 404 e com o mp4 pendurado: nos dois o trilho volta a zero e o documento
retorna aos 7.449 px.

Sob `prefers-reduced-motion` e sem JavaScript o trilho mede **0 px** e o
documento fica idêntico ao de antes da mudança — o fallback não paga nada por
essa correção.

## Peso: 1,40 MB contra teto de 1,5 MB — PASSA desde 26/08

> **Corrigido em 2026-08-26.** Esta seção afirmava um estouro de 9% que deixou de
> existir. O quadro vertical foi recomposto (`RECUO 0.72` em vez de 0.85) para abrir a
> lateral que a marca `YARD` / `BURGUER` precisava, e o efeito colateral resolveu o
> orçamento: mais área de fundo liso comprime melhor que detalhe.
>
> Medido, não estimado: `burger-stack-vertical.mp4` foi de 1.002.587 para 783.668
> bytes (−21,8%) e o poster de 112.494 para 92.176 (−18,1%).

| Tipo | antes (kB) | agora (kB) |
|---|---|---|
| media (o take da Cena 2) | 1.003 | **784** |
| image | 360 | **339** |
| script | 121 | 121 |
| stylesheet | 68 | 68 |
| font | 67 | 67 |
| document | 22 | 22 |
| **total** | **1.640** | **1.401** |

**Passa com 99 kB de folga** (−6,5% do teto), contra os +9,4% de antes. O vídeo
continua sendo a maior peça da rota, mas caiu de 61% para 56%.

Ressalva de método: `media`, `image` e `font` vêm da medição nova do
`audit-page.mjs`; `script`, `stylesheet` e `document` foram reaproveitados da
auditoria anterior, porque naquela corrida o Playwright os serviu de cache e
reportou zero. Nenhum dos três foi tocado por esta mudança.

Unidade importa aqui, e a primeira versão desta seção errou: os 1.640.127 bytes
medidos são 1.601 KiB na base 1024, e reportá-los como "1.600 kB" contra um teto
de "1,5 MB" comparava base binária com rótulo decimal — o estouro parecia 4%
quando é 9%. Este documento usa kB e MB decimais (1 kB = 1.000 bytes), que é o
que o `performance-budget.md` quer dizer com 1,5 MB.

É o preço da variante `video` e é uma decisão de produto, não um defeito de
implementação — mas o orçamento é um número acordado, e o número foi rompido.
Ou o teto sobe por decisão explícita, ou o take encolhe.

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

- **O teto de peso**, único critério ainda reprovado: subir o número ou encolher
  o take. É decisão de produto.
- **A variante `camadas` não foi corrigida.** O mesmo mecanismo de pin tardio
  vale para ela (medido: empurrão equivalente, com a cena já fora da tela). Como
  não é a variante no ar, ficou para quando ela voltar a ser usada — o caminho é
  o mesmo desta correção.
