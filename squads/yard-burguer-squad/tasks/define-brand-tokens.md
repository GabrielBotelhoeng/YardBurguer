---
task: "Define Brand Tokens"
responsavel: "@brand-art-director"
responsavel_type: agent
atomic_layer: task
Entrada: |
  - logo YARD
  - referencias visuais
  - direcao Sertao Premium
Saida: |
  - tokens.css
  - tailwind theme
  - brand-guide.md
Checklist:
  - "[ ] Extrair paleta terrosa da logo real"
  - "[ ] Definir escala tipografica display + corpo"
  - "[ ] Publicar tokens como CSS custom properties"
  - "[ ] Validar contraste AA em cada par de cor"
---

# *define-brand-tokens

Task generated from squad design blueprint for yard-burguer-squad.

## Usage

```
@brand-art-director
*define-brand-tokens
```

## Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `logo YARD` | string | Yes | logo YARD |
| `referencias visuais` | string | Yes | referencias visuais |
| `direcao Sertao Premium` | string | Yes | direcao Sertao Premium |

## Output

- **tokens.css**: tokens.css
- **tailwind theme**: tailwind theme
- **brand-guide.md**: brand-guide.md

## Origin

Confidence: 95%
