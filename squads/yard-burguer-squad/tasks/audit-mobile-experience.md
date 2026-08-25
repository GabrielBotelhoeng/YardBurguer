---
task: "Audit Mobile Experience"
responsavel: "@mobile-performance-guardian"
responsavel_type: agent
atomic_layer: task
Entrada: |
  - build de preview
  - budget.md
Saida: |
  - relatorio de auditoria mobile
Checklist:
  - "[ ] Medir LCP CLS e INP reais"
  - "[ ] Verificar fluidez do scroll em mid range"
  - "[ ] Checar area de toque dos CTAs"
  - "[ ] Comparar resultado contra o budget"
---

# *audit-mobile-experience

Task generated from squad design blueprint for yard-burguer-squad.

## Usage

```
@mobile-performance-guardian
*audit-mobile-experience
```

## Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `build de preview` | string | Yes | build de preview |
| `budget.md` | string | Yes | budget.md |

## Output

- **relatorio de auditoria mobile**: relatorio de auditoria mobile

## Origin

Confidence: 90%
