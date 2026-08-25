# 🍔 yard-burguer-squad

Squad AIOX para a landing page cinematográfica da **YARD Burguer** (Rio Verde–GO).

A página vende desejo por scrollytelling e entrega o clique no cardápio Brendi.
Ela **não** substitui o cardápio — é a vitrine da rua, não a cozinha.

## Os 6 agentes

| Agente | Nome | Dono de |
|---|---|---|
| `@brand-art-director` | 🔥 Brasa | Identidade Sertão Premium, camadas do burger, todo asset de imagem |
| `@motion-director` | 🎬 Trilho | Timeline de cenas, burger explodido, parallax, fallbacks |
| `@hunger-copywriter` | 🥩 Fome | Copy PT-BR das 9 cenas, escada de CTAs |
| `@mobile-performance-guardian` | 🛡️ Sentinela | LCP, acessibilidade — **tem poder de veto** |
| `@local-growth-engineer` | 📍 Praça | SEO local, GA4/Pixel, conversão Landing→Brendi |
| `@deal-closer` | 🤝 Balcão | Demo no celular do dono, deck, proposta |

Os agentes core do AIOX seguem responsáveis pelo resto: `@dev` implementa,
`@qa` revisa, `@devops` faz push e deploy.

## Conhecimento de domínio

Leia antes de tocar em qualquer coisa:

- **`data/brand-sertao-premium.md`** — a identidade. Fonte da verdade de marca.
- **`data/scroll-storyboard.md`** — as 9 cenas e o orçamento de movimento.
- **`data/business-context.md`** — o que a página resolve e como se vende.
- **`config/tech-stack.md`** — Astro 5 + GSAP + Lenis, e por que não Next.

## Duas decisões que valem explicação

**1. A paleta do Prompt Base foi superada de propósito.**
O `referencia/Prompt Base.txt` propunha amarelo `#FFB300` + vermelho `#E8192C`,
herdados de uma referência do Dribbble. Mas a logo real do YARD é terrosa — marrom,
bege, duas palmeiras — e o carro-chefe chama "Tapera do Sertão". A marca já é
regional. Copiar a paleta genérica de fast-food jogaria fora o único diferencial que
o YARD já tem. O squad defende **Sertão Premium**.

**2. Astro em vez de Next.**
A página é estática com muita animação. O risco número um é o LCP no 4G de quem
abre pelo link da bio. Astro entrega HTML quase puro; Next cobraria runtime JS por
algo que não precisa dele.

## Caminho crítico

`produce-ingredient-layers` é o gargalo de todo o projeto. A cena do burger explodido
exige **7 PNGs transparentes com luz coerente** — sem eles, a seção que vende o
projeto não existe, e `@motion-director` fica bloqueado. Comece por ela.

## ⚠ Estado do pipeline de imagem

| Provider | Status | Nota |
|---|---|---|
| Gemini | 🔴 Bloqueado | Chave válida e autenticada, mas **quota 0 para modelos de imagem** no free tier (429). Texto funciona. Destravar habilitando billing no projeto Google Cloud. |
| Higgsfield | 🟢 Disponível | Caminho ativo hoje via MCP |

Verificado em 2026-08-24. A chave vive em `.env` na raiz — protegida por `.gitignore`,
confirmado com `git check-ignore`. **Nunca commitar.**

## Como usar

```bash
# ativar um agente
@brand-art-director
*produce-ingredient-layers

# gerar imagem (quando o billing do Gemini estiver ativo)
node squads/yard-burguer-squad/scripts/gemini-image.mjs \
  --prompt "..." --out assets/raw/01-pao-superior.png

# validar o squad
node -e "const {SquadValidator}=require('C:/Users/botel/.aiox-core/development/scripts/squad/squad-validator.js');new SquadValidator().validate('./squads/yard-burguer-squad').then(r=>console.log(r.valid))"
```

## Fluxo

`workflows/landing-build-flow.yaml` — fundação → assets → tratamento →
implementação → instrumentação → gates → venda.

Antes de mostrar ao dono: `checklists/launch-readiness.md` (9 gates).

---

Gerado por `@squad-creator` (Craft) via `*design-squad` + `*create-squad --from-design`.
Blueprint: `squads/.designs/yard-burguer-squad-design.yaml` · confiança 0.89
