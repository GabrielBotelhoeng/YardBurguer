---
task: "Optimize Image Pipeline"
responsavel: "@brand-art-director"
responsavel_type: agent
atomic_layer: task
Entrada: |
  - assets brutos
  - breakpoints alvo
Saida: |
  - AVIF e WebP por breakpoint
  - srcset pronto
Checklist:
  - "[ ] Converter para AVIF com fallback WebP"
  - "[ ] Gerar variantes por breakpoint"
  - "[ ] Definir prioridade de carregamento do heroi"
  - "[ ] Confirmar peso total dentro do orcamento"
---

# *optimize-image-pipeline

Task generated from squad design blueprint for yard-burguer-squad.

## Usage

```
@brand-art-director
*optimize-image-pipeline
```

## Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `assets brutos` | string | Yes | assets brutos |
| `breakpoints alvo` | string | Yes | breakpoints alvo |

## Output

- **AVIF e WebP por breakpoint**: AVIF e WebP por breakpoint
- **srcset pronto**: srcset pronto

## Origin

Confidence: 93%
