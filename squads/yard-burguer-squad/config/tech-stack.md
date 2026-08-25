# Tech Stack — yard-burguer-squad

Decidido na fase de design do squad. Extends do core AIOX.

## Stack

| Camada | Escolha | Por quê |
|---|---|---|
| Framework | **Astro 5** | A página é essencialmente estática com muita animação. Astro entrega HTML quase puro e zero JS por padrão — o oposto do custo que um framework de app cobraria aqui. |
| Animação | **GSAP 3 + ScrollTrigger** | Padrão da indústria para timeline amarrada a scroll, com `pin` e `scrub` confiáveis. |
| Scroll | **Lenis** | Suaviza o scroll sem sequestrar a rolagem nativa. |
| Estilo | **Tailwind 4** | Tokens da marca como CSS custom properties, direto no tema. |
| Imagem | `astro:assets` | AVIF/WebP e srcset no build, sem serviço externo. |
| Deploy | **Vercel** | Estático na edge, preview por branch para mostrar ao cliente. |
| Geração de asset | **Gemini** (`gemini-3-pro-image`) | Camadas do burger explodido em PNG transparente. |

## Por que não Next.js

É o stack dos outros projetos, mas aqui não há rota dinâmica, sessão nem dado de
servidor — é uma página. Next entregaria hidratação e runtime JS para algo que não
precisa deles, competindo com o orçamento de LCP que é o risco número um do projeto.

## Por que não HTML puro

Nove cenas com componentes repetidos (cards de burger, itens de cardápio) ficariam
manuais demais para iterar. Astro dá componentização sem custo de runtime.

## Regras de implementação

- **Zero JS por padrão.** `client:*` só onde há interação real (tabs do cardápio).
  As animações de scroll carregam num único bundle com `client:visible`.
- **Só `transform` e `opacity`** nas animações. Nada que dispare layout.
- **A imagem do hero** é o LCP: `fetchpriority="high"`, sem lazy, AVIF primeiro.
- **`prefers-reduced-motion`** tratado no CSS base, não como remendo por componente.
- **Segredos em `.env`**, nunca no repositório. `GEMINI_API_KEY` já está protegida
  pelo `.gitignore` da raiz.

## Comandos

```bash
npm run dev       # desenvolvimento
npm run build     # build de produção
npm run preview   # servir o build local (usar este para auditar performance)
```

## Dependência entre agentes e stack

| Agente | Toca em |
|---|---|
| `@brand-art-director` | `src/styles/tokens.css`, `public/assets/`, `scripts/gemini-image.mjs` |
| `@motion-director` | `src/scripts/motion/`, componentes de seção |
| `@hunger-copywriter` | `src/content/` (copy separada do markup) |
| `@mobile-performance-guardian` | `astro.config`, auditoria sobre `npm run preview` |
| `@local-growth-engineer` | `src/layouts/` (head, JSON-LD), scripts de analytics |
