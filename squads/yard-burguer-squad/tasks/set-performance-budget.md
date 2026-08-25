---
task: "Set Performance Budget"
responsavel: "@mobile-performance-guardian"
responsavel_type: agent
atomic_layer: task
Entrada: |
  - perfil de rede alvo
  - stack Astro
Saida: |
  - budget.md com metas de LCP CLS e peso
Checklist:
  - "[ ] Definir meta de LCP em 4G"
  - "[ ] Definir teto de peso por rota"
  - "[ ] Definir teto de JS de animacao"
  - "[ ] Registrar metas como gate de QA"
---

# *set-performance-budget

Task generated from squad design blueprint for yard-burguer-squad.

## Usage

```
@mobile-performance-guardian
*set-performance-budget
```

## Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `perfil de rede alvo` | string | Yes | perfil de rede alvo |
| `stack Astro` | string | Yes | stack Astro |

## Output

- **budget.md com metas de LCP CLS e peso**: budget.md com metas de LCP CLS e peso

## Origin

Confidence: 93%
