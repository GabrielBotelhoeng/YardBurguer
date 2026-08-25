# O que falta — YARD Burguer

Levantado em 2026-08-25, cruzando o estado do repo com o
`squads/yard-burguer-squad/workflows/landing-build-flow.yaml` e com as
referências de `referencia/referecnia parallax.txt`.

---

## 1. Bloqueia a venda para o dono

A demo no celular é o que fecha o negócio. Estes itens fazem o dono perguntar
"cadê?" na frente de você.

| Falta | Por quê |
|---|---|
| **WhatsApp** | Não existe um único link na página. As duas referências brasileiras (Meatz, Le Pinguê) põem WhatsApp em destaque, e o `para oque vai servir.txt` cita WhatsApp como canal. Hoje o único caminho de conversão é o Brendi. |
| **Endereço, horário e telefone** | A página não diz onde fica nem quando abre. Para uma hamburgueria local isso é básico — e é a primeira coisa que o dono procura. |
| **`og:image`** | Ausente. Quando o link for compartilhado no WhatsApp ou no story, aparece sem imagem. Justamente o caso de uso principal da página. |
| **Seção "quem somos"** | A Meatz humaniza com origem ("trailer em Brasília, 2015"). O YARD tem território e o "Tápera do Sertão", mas a página não conta história nenhuma. |
| **Prova social** | Nenhum depoimento. O `squads/.designs/` listava "Depoimento" como entidade e ela nunca foi implementada. |

## 2. Bloqueia o lançamento

| Falta | Situação |
|---|---|
| **Deploy** | Nenhum. Sem hospedagem, sem domínio configurado. |
| **`favicon.svg`** | Referenciado no `Base.astro`, mas o arquivo **não existe** — 404 em toda visita. |
| **Domínio** | `astro.config.mjs` aponta para `yardburguer.com.br`, que não está registrado nem apontado. |
| **Analytics** | `setup-conversion-tracking` nunca rodou. Não há GA4, Pixel nem medição do clique Landing→Brendi — ou seja, não dá para provar que a página converteu. |

## 3. Gates do próprio squad que nunca rodaram

O workflow define três auditorias, **duas com poder de veto**, e nenhuma foi
executada:

| Task | Artefato | Veto |
|---|---|---|
| `audit-motion-fallbacks` | `docs/motion-audit.md` | não |
| `audit-mobile-experience` | `docs/mobile-audit.md` | **sim** |
| `audit-accessibility` | `docs/a11y-audit.md` | **sim** |

Também nunca criados, e são pré-requisito formal dos gates:

- `docs/performance-budget.md` — as metas existem só como comentário no código
- `docs/scroll-triggers.md` — a coreografia está implementada, não documentada.
  Ganhou dono em 2026-08-25: `@scroll-trigger-specialist *document-scroll-triggers`
- `src/content/ctas.json` — a task `craft-cta-ladder` nunca rodou
- `docs/pitch-yard.md` — o roteiro de demo para o dono

## 4. Dívidas de imagem

| Item | Estado |
|---|---|
| Hero em 1376px | Ampliado ~2x em tela retina. Depende do take em `gemini-3-pro-image`, que responde 503 desde a aprovação. |
| Camadas em qualidade de rascunho | Geradas em `gemini-3.1-flash-image`. O take final em pro exigiria regerar as sete juntas. |
| `harvest-instagram-assets` | Nunca rodou. As fotos vieram do CDN do Brendi (240×240). O Instagram tem material em resolução maior e nunca foi coletado. |
| Fotos reais do dono | Tudo que é ambiente é gerado. Para anúncio pago, foto real do estabelecimento vale mais e evita desgaste. |

## 5. Conteúdo que a página promete e não entrega

- A navbar tinha link "Onde estamos" no `copy.json` — a seção não existe.
- `menu.json` tem 11 hambúrgueres, 5 combos e 6 porções. A página mostra 3
  destaques e 4 combos. O resto do catálogo só existe no Brendi.

---

## Ordem sugerida

1. **WhatsApp + endereço + horário + `og:image` + favicon.** É o pacote que
   transforma a página de "bonita" em "vendável", e nenhum deles depende de
   modelo de imagem ou de crédito.
2. **Rodar os três gates.** Dois têm veto; achar problema depois do deploy é
   pior.
3. **Deploy.** Vercel resolve em minutos e desbloqueia a demo no celular do
   dono — que é o argumento de venda.
4. **Analytics.** Só depois do deploy, e negociando peso com o gate de
   performance.
5. **Dívidas de imagem.** Dependem do `gemini-3-pro-image` sair do 503.
