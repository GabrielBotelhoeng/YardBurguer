---
task: "Implement Local Seo"
responsavel: "@local-growth-engineer"
responsavel_type: agent
atomic_layer: task
Entrada: |
  - dados da loja
  - cardapio
  - cidade alvo
Saida: |
  - schema Restaurant
  - metadados
  - checklist GBP
Checklist:
  - "[ ] Implementar JSON-LD Restaurant e Menu"
  - "[ ] Escrever title e description locais"
  - "[ ] Gerar Open Graph para compartilhamento"
  - "[ ] Listar acoes de Google Business Profile"
---

# *implement-local-seo

Task generated from squad design blueprint for yard-burguer-squad.

## Usage

```
@local-growth-engineer
*implement-local-seo
```

## Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `dados da loja` | string | Yes | dados da loja |
| `cardapio` | string | Yes | cardapio |
| `cidade alvo` | string | Yes | cidade alvo |

## Output

- **schema Restaurant**: schema Restaurant
- **metadados**: metadados
- **checklist GBP**: checklist GBP

## Origin

Confidence: 86%
