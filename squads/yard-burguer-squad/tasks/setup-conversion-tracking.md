---
task: "Setup Conversion Tracking"
responsavel: "@local-growth-engineer"
responsavel_type: agent
atomic_layer: task
Entrada: |
  - GA4
  - Meta Pixel
  - destinos externos
Saida: |
  - eventos instrumentados
  - painel de leitura
Checklist:
  - "[ ] Instrumentar clique para o cardapio Brendi"
  - "[ ] Medir profundidade de scroll por cena"
  - "[ ] Rastrear origem de trafego por UTM"
  - "[ ] Documentar como ler os numeros"
---

# *setup-conversion-tracking

Task generated from squad design blueprint for yard-burguer-squad.

## Usage

```
@local-growth-engineer
*setup-conversion-tracking
```

## Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `GA4` | string | Yes | GA4 |
| `Meta Pixel` | string | Yes | Meta Pixel |
| `destinos externos` | string | Yes | destinos externos |

## Output

- **eventos instrumentados**: eventos instrumentados
- **painel de leitura**: painel de leitura

## Origin

Confidence: 84%
