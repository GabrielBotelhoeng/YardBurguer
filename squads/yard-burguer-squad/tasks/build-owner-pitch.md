---
task: "Build Owner Pitch"
responsavel: "@deal-closer"
responsavel_type: agent
atomic_layer: task
Entrada: |
  - landing publicada
  - argumentos do doc de venda
Saida: |
  - roteiro de demo
  - deck curto
  - proposta
Checklist:
  - "[ ] Montar roteiro de demo no celular"
  - "[ ] Traduzir ganhos em linguagem de dono"
  - "[ ] Definir escopo e faixa de preco"
  - "[ ] Preparar resposta as objecoes previsiveis"
---

# *build-owner-pitch

Task generated from squad design blueprint for yard-burguer-squad.

## Usage

```
@deal-closer
*build-owner-pitch
```

## Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `landing publicada` | string | Yes | landing publicada |
| `argumentos do doc de venda` | string | Yes | argumentos do doc de venda |

## Output

- **roteiro de demo**: roteiro de demo
- **deck curto**: deck curto
- **proposta**: proposta

## Origin

Confidence: 80%
