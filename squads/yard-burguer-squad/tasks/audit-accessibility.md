---
task: "Audit Accessibility"
responsavel: "@mobile-performance-guardian"
responsavel_type: agent
atomic_layer: task
Entrada: |
  - build de preview
Saida: |
  - relatorio de acessibilidade
Checklist:
  - "[ ] Validar contraste de texto sobre imagem"
  - "[ ] Garantir navegacao por teclado"
  - "[ ] Conferir texto alternativo dos assets"
  - "[ ] Confirmar respeito a reducao de movimento"
---

# *audit-accessibility

Task generated from squad design blueprint for yard-burguer-squad.

## Usage

```
@mobile-performance-guardian
*audit-accessibility
```

## Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `build de preview` | string | Yes | build de preview |

## Output

- **relatorio de acessibilidade**: relatorio de acessibilidade

## Origin

Confidence: 87%
