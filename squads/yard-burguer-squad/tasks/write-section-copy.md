---
task: "Write Section Copy"
responsavel: "@hunger-copywriter"
responsavel_type: agent
atomic_layer: task
Entrada: |
  - estrutura de secoes
  - cardapio Brendi
  - voz da marca
Saida: |
  - copy final das 8 secoes
Checklist:
  - "[ ] Escrever headline do heroi"
  - "[ ] Escrever descricao de cada burger e combo"
  - "[ ] Ancorar voz regional sem soar caricato"
  - "[ ] Revisar ortografia e acentuacao PT-BR"
---

# *write-section-copy

Task generated from squad design blueprint for yard-burguer-squad.

## Usage

```
@hunger-copywriter
*write-section-copy
```

## Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `estrutura de secoes` | string | Yes | estrutura de secoes |
| `cardapio Brendi` | string | Yes | cardapio Brendi |
| `voz da marca` | string | Yes | voz da marca |

## Output

- **copy final das 8 secoes**: copy final das 8 secoes

## Origin

Confidence: 88%
