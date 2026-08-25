---
task: "Debug ScrollTrigger"
responsavel: "@scroll-trigger-specialist"
responsavel_type: agent
atomic_layer: task
Entrada: |
  - sintoma observado, com viewport e conexao em que aparece
  - implementacao que cria o trigger
Saida: |
  - causa identificada, distinguindo mecanica de coreografia
  - correcao aplicada ou devolucao ao @motion-director
Checklist:
  - "[ ] Reproduzir o sintoma antes de propor causa"
  - "[ ] Verificar se ha mais de um rAF empurrando o mesmo scroll"
  - "[ ] Verificar quando o trilho foi medido em relacao ao load dos assets"
  - "[ ] Verificar sobrevivencia do trigger a troca de breakpoint"
  - "[ ] Confirmar que a correcao nao muda o que o usuario ve"
---

# *debug-scroll-trigger

Protocolo de diagnóstico. A regra que organiza tudo: **quase nenhum defeito de
ScrollTrigger está na animação — está em quando o trilho foi medido.**

## Usage

```
@scroll-trigger-specialist
*debug-scroll-trigger
```

## Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `sintoma` | string | Yes | O que se vê, com viewport e rede onde acontece |
| `implementacao` | path | Yes | Arquivo que cria o ScrollTrigger |

## Tabela de sintomas

| Sintoma | Causa mais provável | Onde olhar |
|---|---|---|
| Scrub treme ou vibra | Dois rAF independentes sobre o mesmo scroll | A ponte Lenis↔ticker: o loop provisório do Lenis foi cancelado? `lagSmoothing(0)` está ligado? |
| Cena termina no lugar errado em conexão lenta | Trilho medido antes das imagens lazy chegarem | Falta o segundo `ScrollTrigger.refresh()` após o `load` das pendentes |
| Salto de posição depois de engasgo | `lagSmoothing` ativo em animação dirigida por scroll | Ela compensa travada em animação por tempo; em scroll ela **inventa** deslocamento |
| Trilho errado após girar o aparelho | Valor em px fixo sem revalidação | `invalidateOnRefresh: true` |
| Cena quebra ao cruzar o breakpoint | Trigger criado fora de `gsap.matchMedia()` | Sem revert, sobrevive com o trilho do viewport antigo |
| Pin empurra ou sobrepõe a seção seguinte | `pinSpacing` inadequado ao layout | Conferir o wrapper que o pin injeta e a altura que ele reserva |
| Elemento pisca ao entrar o pin | Falta de antecipação na troca para posição fixa | `anticipatePin: 1` |
| Jank só em device fraco | Propriedade animada dispara layout | Só `transform` e `opacity` — qualquer outra coisa é violação de princípio |

## Procedimento

1. **Reproduzir.** Sintoma que não se reproduz não tem causa identificada, tem palpite.
   Anotar viewport, orientação e perfil de rede.
2. **Isolar a medição.** Ligar `markers`, observar onde `start` e `end` caem *no momento
   do defeito* — não no estado final da página.
3. **Percorrer a tabela** de cima para baixo. A ordem não é arbitrária: as causas do
   topo são as que mais aparecem neste projeto.
4. **Classificar antes de corrigir.** Se a correção muda o que o usuário vê, não é
   defeito de mecânica: é decisão de cena. Parar e devolver ao `@motion-director`.
5. **Desligar `markers`** antes de fechar.

## Output

- **causa identificada**: uma frase que liga sintoma a mecanismo, não uma lista de
  suspeitas.
- **correção aplicada** ou devolução explícita ao `@motion-director`, com o motivo.
