# O que falta — YARD Burguer

Revisto em 2026-08-26, depois do PR #4 (Cena 2 em vídeo) e do PR #5 (correções
do CodeRabbit). O levantamento anterior era de 25/08 e boa parte dele já foi
entregue — o que saiu está no fim, em "Fechado desde 25/08", para não voltar a
ser refeito por engano.

---

## 0. Risco declarado: os gates com veto estão vencidos

Este é o único item da lista que não é "falta fazer" e sim "o repositório
afirma uma coisa que não é mais verdade".

`docs/a11y-audit.md` e `docs/mobile-audit.md` dizem **PASSA**. Foram escritos em
25/08 13:50. A Cena 2 em vídeo entrou em 26/08 12:27 — os dois gates **com poder
de veto nunca viram a variante que está no ar hoje**.

E a divergência não é hipotética. As medições de 26/08, aceitas de propósito no
PR #4, contradizem o documento:

| Medido em 26/08 | O que o a11y-audit afirma |
|---|---|
| Contraste do título em paisagem: 2,12–2,86:1 (AA exige 3,0) | "75 elementos medidos, 0 reprovados" |
| 3 alvos de toque abaixo de 44px na navbar em paisagem | gate mobile PASSA |

Re-rodar `audit-accessibility` e `audit-mobile-experience` contra a variante
`video` é barato e devolve honestidade aos dois documentos. As quatro pendências
aceitas continuam aceitas — o ponto é registrá-las no gate em vez de deixá-lo
dizendo que não existem.

## 1. Bloqueia o lançamento

Nada mudou desde 25/08.

| Falta | Situação |
|---|---|
| **Deploy** | Nenhum. Sem hospedagem. É o que desbloqueia a demo no celular do dono, que é o argumento de venda. |
| **Domínio** | `astro.config.mjs` aponta para `yardburguer.com.br`, que não está registrado nem apontado. O `og:image` usa `Astro.site`, então o link compartilhado hoje apontaria para um domínio que não existe. |
| **Analytics** | Nenhum `gtag`, pixel ou medição do clique Landing→Brendi. Sem isso não há como provar que a página converteu — que é o número que sustenta a próxima conversa com o dono. |

## 2. Conteúdo que o plano previa e nunca entrou

| Falta | Por quê |
|---|---|
| **Seção "quem somos"** | A Meatz humaniza com origem ("trailer em Brasília, 2015"). O YARD tem território e o "Tápera do Sertão" e a página não conta história nenhuma. |
| **Prova social** | Nenhum depoimento. `squads/.designs/` listava "Depoimento" como entidade e ela nunca foi implementada. |
| **`src/content/ctas.json`** | A task `craft-cta-ladder` nunca rodou. |
| **`docs/scroll-triggers.md`** | A coreografia está implementada e não documentada. Dono definido em 25/08: `@scroll-trigger-specialist *document-scroll-triggers`. |
| **`docs/pitch-yard.md`** | O roteiro de demo para o dono — o que se fala enquanto ele rola a página. |

O `menu.json` tem 11 hambúrgueres, 5 combos e 6 porções; a página mostra 3
destaques e 4 combos. Isso é **decisão, não dívida**: a seção é vitrine e todo
item leva ao Brendi (ver `scroll-storyboard.md`).

## 3. Dívidas de imagem

Todas presas à disponibilidade de modelo e crédito. Trocar de gerador no meio
obriga a regerar a composição inteira — ver `assets/LOOK.md`.

| Item | Estado |
|---|---|
| Coroa do pão fatiada no take 16:9 | 22 de 48 quadros amostrados. É material, não encode. Só se resolve com take novo, pedindo que o hambúrguer ocupe no máximo ~85% da altura do quadro. |
| Hero em 1376px | Ampliado ~2x em tela retina. Depende do take em `gemini-3-pro-image`. |
| Camadas em qualidade de rascunho | Geradas em `gemini-3.1-flash-image`. O take final em pro exigiria regerar as sete juntas. |
| `harvest-instagram-assets` | Nunca rodou. As fotos vieram do CDN do Brendi (240×240). |
| Fotos reais do estabelecimento | Tudo que é ambiente é gerado. Para anúncio pago, foto real vale mais. |

## 4. Pendências aceitas da Cena 2

Mergeadas de propósito no PR #4, com o cliente decidindo cada uma. **Não
"consertar" por iniciativa própria** — confirmar antes:

1. Coroa do pão fatiada no take 16:9 (ver acima).
2. Contraste do título em paisagem: 2,12–2,86:1. Era 2,17:1 antes da branch,
   então não piorou.
3. Três alvos de toque abaixo de 44px na navbar em paisagem — os `.nav__link`
   não têm `min-height`, ao contrário de `.rodape__link` e `.onde__link`.
4. Ultrawide, iPad em pé e celular deitado usam `contain` e ficam com faixa de
   carvão (21–78% de preenchimento).

---

## Ordem sugerida

1. **Re-rodar os dois gates com veto.** É o único item que corrige um risco já
   declarado, em vez de adicionar coisa nova.
2. **Deploy + domínio.** Desbloqueia a demo no celular, que é o que vende.
3. **Analytics.** Depois do deploy, negociando peso com o gate de performance.
4. **"Quem somos" e prova social.** Não dependem de crédito nem de modelo.
5. **Dívidas de imagem.** Por último: dependem de modelo disponível e crédito.

---

## Fechado desde 25/08

Entregue e verificado no repositório — não refazer:

- **WhatsApp** — `wa.me` com mensagem pronta, em `copy.json`.
- **Endereço, horário e formas de pagamento** — seção `#onde-estamos`.
- **`og:image`** — `public/assets/og.jpg` (1200×630) e as metas no `Base.astro`.
- **`favicon.svg`** — existe; era 404 em toda visita.
- **Os três documentos de auditoria e o `performance-budget.md`** — criados.
  Com a ressalva do item 0: os dois com veto precisam de nova rodada.
- **Cena 2 em vídeo** (PR #4) e as **11 correções do CodeRabbit** (PR #5).
