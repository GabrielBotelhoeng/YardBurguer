---
task: "Tune Pin Timeline"
responsavel: "@scroll-trigger-specialist"
responsavel_type: agent
atomic_layer: task
Entrada: |
  - cena aprovada no scroll-storyboard.md
  - implementacao existente com pin e scrub
Saida: |
  - parametros calibrados com comentario que justifica cada valor
  - registro da calibragem no mapa de gatilhos
Checklist:
  - "[ ] Medir o comprimento de trilho antes de mudar qualquer valor"
  - "[ ] Calibrar start/end e confirmar que o fim da cena cai onde o storyboard diz"
  - "[ ] Escolher scrub numerico ou booleano e justificar a escolha"
  - "[ ] Verificar invalidateOnRefresh em todo deslocamento em px fixo"
  - "[ ] Recalibrar em 390px e confirmar que nada sai da tela"
  - "[ ] Remover markers antes de entregar"
---

# *tune-pin-timeline

Calibra a mecânica de uma cena **já aprovada** pelo `@motion-director`. Esta task não
decide o que acontece na cena — decide com que trilho aquilo acontece.

## Usage

```
@scroll-trigger-specialist
*tune-pin-timeline
```

## Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `cena` | string | Yes | Identificador da cena no storyboard (ex.: `cena-2`) |
| `implementacao` | path | Yes | Arquivo que cria o ScrollTrigger (ex.: `src/scripts/explode.js`) |

## Procedimento

### 1. Medir antes de mexer

Ligar `markers: true` e anotar onde `start` e `end` caem de fato, em desktop e em
390px. Sem essa leitura inicial, qualquer ajuste vira tentativa e erro — e tentativa e
erro em trilho de pin custa caro porque cada mudança desloca o resto da página.

### 2. Comprimento de trilho

O `end` não controla o quanto os elementos andam, controla **quanto scroll é preciso**
para eles andarem aquilo. Movimento que lê como solavanco quase sempre é trilho curto
demais, não easing errado.

Referência atual da Cena 2: `+=180%` no desktop, `+=110%` no mobile. O valor mobile é
menor porque a tela é menor e o dedo percorre mais rápido — trilho longo em celular
vira cena que não termina nunca.

### 3. Scrub numérico vs booleano

`scrub: true` amarra a animação ao scroll quadro a quadro. `scrub: 1` insere um segundo
de perseguição, o que suaviza a leitura mas atrasa a resposta. Em cena com muitas
camadas o valor numérico esconde microtravadas da thread; em cena curta ele lê como
atraso. Registrar a escolha em comentário.

### 4. Deslocamento em px e viewport

Todo valor em px fixo dentro de trilho responsivo exige `invalidateOnRefresh: true`,
senão girar o aparelho mantém o cálculo da orientação anterior. Se os valores vêm de
manifest calibrado para desktop, aplicar fator de alcance no mobile — na Cena 2 esse
fator é `0.55`, e existe porque em 390px a camada de cima saía da tela.

### 5. Fechamento

Conferir que continua valendo: um pin ativo por vez, só `transform` e `opacity`,
`markers` desligado, e todo valor mágico acompanhado do comentário que o explica.

## Output

- **parametros calibrados**: valores de `start`, `end`, `scrub` e escalonamento, cada
  um com a justificativa no próprio código.
- **registro da calibragem**: entrada correspondente em `docs/scroll-triggers.md`.

## Handoff

Entrega para `@mobile-performance-guardian` medir em device real. A calibragem só está
aceita depois do gate.
