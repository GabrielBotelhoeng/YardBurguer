---
task: "Audit Motion Fallbacks"
responsavel: "@motion-director"
responsavel_type: agent
atomic_layer: task
Entrada: |
  - implementacao de motion
Saida: |
  - relatorio de fallback
  - versao reduzida
Checklist:
  - "[ ] Implementar prefers-reduced-motion"
  - "[ ] Definir versao simplificada para mobile"
  - "[ ] Garantir conteudo legivel sem JS"
  - "[ ] Testar em dispositivo de baixo desempenho"
---

# *audit-motion-fallbacks

Task generated from squad design blueprint for yard-burguer-squad.

## Usage

```
@motion-director
*audit-motion-fallbacks
```

## Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `implementacao de motion` | string | Yes | implementacao de motion |

## Output

- **relatorio de fallback**: relatorio de fallback
- **versao reduzida**: versao reduzida

## Origin

Confidence: 91%
