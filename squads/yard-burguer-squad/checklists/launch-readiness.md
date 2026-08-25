# Checklist de Lançamento — YARD Burguer

Rodar antes de mostrar a página para o dono. Um item vermelho aqui pode custar a venda.

## Gate 1 — Performance mobile (veto: `@mobile-performance-guardian`)

- [ ] LCP ≤ 2,5s em 4G simulado (medido, não estimado)
- [ ] CLS ≤ 0,1
- [ ] INP ≤ 200ms
- [ ] Scroll fluido em device mediano — sem engasgo na cena do burger explodido
- [ ] JS de animação ≤ 45kb gzip
- [ ] Imagem do hero em AVIF com `fetchpriority="high"`
- [ ] Nenhum asset acima do teto de peso acordado

## Gate 2 — Movimento (`@motion-director`)

- [ ] `prefers-reduced-motion` respeitado em todas as 9 cenas
- [ ] Cada cena tem estado final estático legível
- [ ] Máximo 1 `pin` ativo por vez
- [ ] Só `transform` e `opacity` animados
- [ ] Cena mobile reduzida para 4 camadas funciona
- [ ] Conteúdo legível se o JS falhar

## Gate 3 — Acessibilidade (veto: `@mobile-performance-guardian`)

- [ ] Contraste AA em todo texto, inclusive sobre foto
- [ ] Navegação por teclado completa, com foco visível
- [ ] `alt` descritivo em todo asset com significado
- [ ] Área de toque dos CTAs ≥ 44px

## Gate 4 — Marca (`@brand-art-director`)

- [ ] Paleta Sertão Premium aplicada — sem resquício de amarelo/vermelho do Prompt Base
- [ ] `--yard-fogo` aparece **somente** em CTA clicável
- [ ] Logo legível em fundo claro e escuro
- [ ] Fotos dos cards são dos burgers **reais** do YARD
- [ ] Camadas do burger explodido com luz coerente

## Gate 5 — Copy (`@hunger-copywriter`)

- [ ] Ortografia e acentuação PT-BR conferidas
- [ ] Voz regional sem caricatura
- [ ] Tapera do Sertão com destaque de carro-chefe
- [ ] Escada de CTAs escalando ao longo do scroll

## Gate 6 — Crescimento (`@local-growth-engineer`)

- [ ] JSON-LD `Restaurant` válido (testar no Rich Results Test)
- [ ] Title e description mirando "hamburgueria Rio Verde"
- [ ] Open Graph renderizando bem no WhatsApp — **testar mandando o link para si mesmo**
- [ ] Evento de clique Landing → Brendi disparando
- [ ] UTM preservada na passagem para o cardápio
- [ ] Scroll depth por cena instrumentado

## Gate 7 — Integridade de negócio

- [ ] Todo caminho de compra termina no Brendi, nenhum beco sem saída
- [ ] Preços conferem com o cardápio — ou não são exibidos
- [ ] Instagram apontando para `@yardburguer_rioverde`
- [ ] Endereço e cidade corretos (alimentam o SEO local)

## Gate 8 — Segurança

- [ ] `.env` fora do controle de versão (confirmado via `git check-ignore`)
- [ ] Nenhuma chave de API no bundle do cliente
- [ ] Arquivo da chave em `referencia/` continua ignorado

## Gate 9 — Demo (`@deal-closer`)

- [ ] Página aberta no celular do dono, testada na rede dele
- [ ] Roteiro de demo ensaiado — o burger explodido é o clímax
- [ ] Escopo dentro/fora explícito na proposta
- [ ] Resposta pronta para "mas eu já tenho o Brendi"
