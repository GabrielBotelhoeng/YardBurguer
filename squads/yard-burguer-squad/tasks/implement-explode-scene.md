---
task: "Implement Explode Scene"
responsavel: "@motion-director"
responsavel_type: agent
atomic_layer: task
Entrada: |
  - storyboard
  - 7 PNGs de camada
  - tokens
Saida: |
  - secao burger explodido funcional
Checklist:
  - "[ ] Montar burger a partir das camadas ao entrar"
  - "[ ] Separar camadas em parallax ao rolar"
  - "[ ] Aplicar parallax lento no texto de fundo"
  - "[ ] Garantir pin e scrub estaveis sem travar"
---

# *implement-explode-scene

Task generated from squad design blueprint for yard-burguer-squad.

## Usage

```
@motion-director
*implement-explode-scene
```

## Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `storyboard` | string | Yes | storyboard |
| `7 PNGs de camada` | string | Yes | 7 PNGs de camada |
| `tokens` | string | Yes | tokens |

## Output

- **secao burger explodido funcional**: secao burger explodido funcional

## Origin

Confidence: 90%
