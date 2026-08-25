---
task: "Document Scroll Triggers"
responsavel: "@scroll-trigger-specialist"
responsavel_type: agent
atomic_layer: task
Entrada: |
  - implementacao de motion em src/scripts/
  - scroll-storyboard.md como contrato de referencia
Saida: |
  - docs/scroll-triggers.md
  - lista de divergencias entre codigo e storyboard
Checklist:
  - "[ ] Mapear todo gatilho da pagina, inclusive os que nao usam ScrollTrigger"
  - "[ ] Registrar start, end, scrub e pin de cada cena pinada"
  - "[ ] Documentar a ponte Lenis-GSAP e a ordem de carregamento"
  - "[ ] Cruzar cada cena com o storyboard e listar divergencias"
  - "[ ] Nao corrigir o storyboard — reportar ao @motion-director"
---

# *document-scroll-triggers

Produz `docs/scroll-triggers.md`, pendência formal registrada em `docs/PENDENCIAS.md`:
a coreografia está implementada, não documentada.

O documento existe para que a próxima pessoa que mexer no scroll saiba **onde cada
gatilho dispara e por que o valor é aquele** — sem precisar reconstruir o raciocínio
lendo o código de trás para frente.

## Usage

```
@scroll-trigger-specialist
*document-scroll-triggers
```

## Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `origem` | path | Yes | Diretório dos scripts de motion (`src/scripts/`) |

## Estrutura do documento

### 1. Inventário de gatilhos

Toda cena que reage ao scroll, **inclusive as que não usam ScrollTrigger**. A página é
deliberadamente mista: navbar, scroll reveal e float loop rodam em
IntersectionObserver + CSS, e só a Cena 2 carrega GSAP. Documentar só a parte com
biblioteca esconde a decisão de arquitetura que faz o bundle inicial ser pequeno.

| Coluna | Conteúdo |
|---|---|
| Cena | Referência ao storyboard |
| Mecanismo | IntersectionObserver, CSS puro ou ScrollTrigger |
| Dispara em | Ponto de entrada, em linguagem de leitor |
| Pin / scrub | Valores, quando houver |
| Reduced-motion | Qual é o estado final estático |

### 2. Parâmetros da cena pinada

Para cada trilho: `start`, `end` (desktop e mobile), `scrub`, escalonamento entre
camadas, espera antes do movimento e fator de alcance mobile. Cada valor acompanhado
da razão — valor sem razão documentada é valor que o próximo alguém vai "limpar".

### 3. Ordem de carregamento e a ponte Lenis↔GSAP

Explicar que o GSAP entra por import dinâmico quando a Cena 2 se aproxima, que o Lenis
roda em rAF próprio até então, e que a partir daí o ticker do GSAP passa a ser o único
relógio. Quem não souber disso vai criar a próxima cena antes da ponte e passar uma
tarde atrás de uma tremida.

### 4. Pontos de refresh

Onde `ScrollTrigger.refresh()` é chamado e por quê — em especial o segundo refresh,
após o load das imagens lazy, que existe para o cenário de 4G do interior.

### 5. Divergências com o storyboard

Tabela de `cena · o que o storyboard diz · o que o código faz`. Esta seção é
**relatório, não correção**: quem atualiza o contrato é o `@motion-director`.

## Output

- **`docs/scroll-triggers.md`**: o mapa completo.
- **lista de divergências**: entregue ao `@motion-director` para reconciliar o
  storyboard.
