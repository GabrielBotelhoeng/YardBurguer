---
task: "Produce Ingredient Layers"
responsavel: "@brand-art-director"
responsavel_type: agent
atomic_layer: task
Entrada: |
  - brief do burger heroi
  - paleta de luz (data/brand-sertao-premium.md)
  - lista de camadas
Saida: |
  - 7 PNGs transparentes
  - manifest de camadas (ordem e offset)
Checklist:
  - "[ ] Gerar burger heroi com luz coerente"
  - "[ ] Isolar cada camada em PNG transparente"
  - "[ ] Garantir alinhamento vertical entre camadas"
  - "[ ] Exportar manifest com ordem e offset de cada camada"
---

# *produce-ingredient-layers

Produz os assets que tornam a cena 2 (burger explodido) possível. **Esta é a task
mais crítica do squad** — `@motion-director` fica bloqueado até ela terminar.

## Por que é o gargalo

A cena do burger explodido não é um problema de código: é um problema de asset. Não
existe como separar ingredientes de uma foto normal em tempo real. Cada camada precisa
existir como PNG independente, com fundo transparente e luz compatível com as outras.
Sem isso, a seção que vende o projeto simplesmente não existe.

## As 7 camadas

Ordem de empilhamento, de cima para baixo:

| # | Camada | Observação |
|---|---|---|
| 1 | Pão superior (brioche, gergelim) | Maior deslocamento na explosão |
| 2 | Alface | Borda irregular ajuda a leitura de profundidade |
| 3 | Tomate + cebola roxa | Podem vir juntos ou separados |
| 4 | Queijo derretido | O escorrido é o que dá fome — não cortar |
| 5 | Blend (a carne) | Centro de massa da composição |
| 6 | Bacon | Opcional conforme o burger retratado |
| 7 | Pão inferior | Menor deslocamento, quase âncora |

## Regras de geração

Todas as camadas precisam compartilhar:

- **Mesma direção de luz** — âmbar quente vindo do canto superior esquerdo.
- **Mesma câmera** — straight-on, altura do olho, sem perspectiva dramática.
- **Mesma escala** — o pão superior e o inferior têm que casar em largura.
- **Fundo removível** — gerar sobre branco sólido e recortar, ou pedir transparência
  direto se o modelo suportar.

Um ingrediente com luz vinda do outro lado destrói a ilusão de que aquilo já foi um
hambúrguer inteiro.

## Pipeline

### Caminho A — Gemini (⚠ bloqueado hoje)

```bash
node squads/yard-burguer-squad/scripts/gemini-image.mjs \
  --model gemini-3-pro-image \
  --prompt "Isolated product shot of ..." \
  --out assets/raw/01-pao-superior.png
```

**Status verificado em 2026-08-24:** a chave em `.env` autentica corretamente, mas
todos os modelos de imagem retornam `429 RESOURCE_EXHAUSTED` com `limit: 0` — o free
tier do Google não cobre geração de imagem. Modelos de texto funcionam
(`gemini-flash-latest`).

**Para destravar:** habilitar billing no projeto Google Cloud vinculado à chave, em
`console.cloud.google.com` → Billing. Depois disso o comando acima funciona sem
alteração no script.

### Caminho B — Higgsfield (ativo)

O MCP do Higgsfield está conectado e é o caminho utilizável agora. Fluxo:

1. `generate_image` para o burger herói completo, fixando o estilo de luz.
2. `generate_image_batch` para as camadas, referenciando o herói para manter
   coerência.
3. `remove_background` por camada, gerando o PNG transparente.
4. `upscale_image` apenas no herói, se necessário para o hero em telas grandes.

## Manifest de saída

Gerar `assets/layers/manifest.json` — é o contrato que `@motion-director` consome:

```json
{
  "layers": [
    { "id": "pao-superior", "src": "01-pao-superior.png", "order": 1, "explodeY": -180, "speed": 1.0 },
    { "id": "alface",       "src": "02-alface.png",       "order": 2, "explodeY": -120, "speed": 0.85 },
    { "id": "tomate-cebola","src": "03-tomate-cebola.png","order": 3, "explodeY":  -70, "speed": 0.7 },
    { "id": "queijo",       "src": "04-queijo.png",       "order": 4, "explodeY":  -30, "speed": 0.55 },
    { "id": "blend",        "src": "05-blend.png",        "order": 5, "explodeY":    0, "speed": 0.4 },
    { "id": "bacon",        "src": "06-bacon.png",        "order": 6, "explodeY":   40, "speed": 0.3 },
    { "id": "pao-inferior", "src": "07-pao-inferior.png", "order": 7, "explodeY":   90, "speed": 0.2 }
  ],
  "mobileLayers": ["pao-superior", "queijo", "blend", "pao-inferior"]
}
```

`mobileLayers` existe porque o storyboard limita a cena a 4 camadas em mobile.

## Definição de pronto

- [ ] 7 PNGs com fundo transparente de verdade (sem halo branco nas bordas)
- [ ] Empilhadas na ordem do manifest, formam um hambúrguer crível
- [ ] Luz coerente entre todas
- [ ] `manifest.json` gerado e validado por `@motion-director`
- [ ] Peso aprovado por `@mobile-performance-guardian`
