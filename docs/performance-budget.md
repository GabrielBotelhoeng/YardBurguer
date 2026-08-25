# Orçamento de performance — YARD Burguer

Task `set-performance-budget` · @mobile-performance-guardian

As metas já vinham sendo aplicadas desde o começo, mas só existiam como
comentário espalhado no código. Sem estarem escritas aqui, os gates de
auditoria não tinham contra o que medir — e gate sem número é opinião.

## Perfil de rede alvo

**4G do interior de Goiás, aparelho mid-range.** Não é o iPhone do
desenvolvedor em Wi-Fi.

Isso importa porque cerca de 90% do tráfego vem do link na bio do Instagram —
ou seja, celular, muitas vezes em rede congestionada de fim de noite, que é
exatamente o horário em que a casa abre.

Perfil de teste: **throttling 4G lento** (~1,6 Mbps down, 750 kbps up, 150 ms
RTT) com CPU 4× mais lenta.

## Metas

| Métrica | Meta | Falha o gate acima de |
|---|---|---|
| LCP | ≤ 2,5 s | 4,0 s |
| CLS | ≤ 0,1 | 0,25 |
| INP | ≤ 200 ms | 500 ms |
| Peso total da rota (primeira visita) | ≤ 1,5 MB | 2,5 MB |
| **JS que afeta o LCP** | **≤ 5 kb gzip** | 15 kb |
| JS total, incluindo o que é lazy | ≤ 60 kb gzip | 90 kb |
| Área de toque de qualquer CTA | ≥ 44 × 44 px | — |

## Por que o teto de JS inicial é tão baixo

Cinco kilobytes parece agressivo até lembrar de onde vêm os outros números.

A cena do burger explodido precisa de GSAP + ScrollTrigger, que sozinhos pesam
~45 kb gzip. Se esse peso entrasse no bundle inicial, ele sozinho estouraria o
orçamento de LCP antes de qualquer imagem carregar.

A arquitetura resolve isso separando: o bundle inicial tem só
IntersectionObserver e CSS, e o GSAP entra por import dinâmico quando a cena 2
está a uma tela de distância. Quando isso acontece, o usuário já está rolando —
o custo não cai sobre o carregamento.

**O teto baixo é o que protege essa decisão.** Sem ele, a primeira pessoa com
pressa importa GSAP no topo da página e ninguém percebe até o LCP dobrar.

## Regras que derivam do orçamento

1. **Animação usa só `transform` e `opacity`.** Qualquer propriedade que dispare
   layout está fora.
2. **No máximo um `pin`** na página inteira. Pin é caro e o storyboard já gastou
   o único que havia na cena 2.
3. **Imagem grande é lazy**, exceto a do hero, que é o próprio LCP e leva
   `fetchpriority="high"`.
4. **Toda imagem declara `width` e `height`.** É isso que segura o CLS em zero.
5. **Biblioteca nova precisa de justificativa por escrito.** Se dá para fazer
   com CSS nativo, faz-se com CSS — foi assim que o parallax fora da cena 2
   custou 0 kb.

## Gate

Este documento é a entrada da task `audit-mobile-experience`, que tem **poder de
veto**. Resultado acima da coluna "falha o gate" devolve o trabalho para
`implement-parallax-layers` com feedback específico.

A ordem de correção é: **simplificar a cena antes de otimizar asset.** Reduzir
uma camada custa menos que reduzir qualidade de imagem, e o usuário nota menos.
