# Política de geração de mídia

Definida pelo cliente. Vale para qualquer agente ou script do projeto.

## Modelos

| Papel | Pedido original | Em uso hoje | Motivo |
|---|---|---|---|
| Rascunho | `flux/schnell` | `gemini-3.1-flash-image` | Higgsfield em `credits: 0`, plano free, `unlim.available: false` |
| Take final | `Seedream V4` | `gemini-3-pro-image` | idem — o modelo nem aparece na lista que o plano cobre |

**Só usar o modelo final no take aprovado.** Rascunho existe para explorar
composição e iterar recorte; queimar o modelo caro em exploração é desperdício.

Quando o Higgsfield tiver crédito, trocar para Seedream significa **regerar o
conjunto inteiro** da composição afetada — nunca substituir uma peça avulsa.

## Vídeo

- **SEMPRE pedir confirmação antes de gerar.** Sem exceção.
- **Máximo uma geração por vez.** Nunca variações em lote.

Vídeo custa ordens de grandeza mais que imagem e não dá para revisar antes de
pagar. As duas regras existem para que nenhuma geração aconteça sem alguém ter
decidido que ela deve acontecer.

## Saída e registro

- Todo output de mídia vai para `public/assets/`.
- Todo prompt usado fica registrado em `assets/prompts.md`, junto com modelo,
  data e veredito.

O registro não é burocracia: é o que permite regerar o mesmo conjunto meses
depois. Sem ele, "regerar tudo com o mesmo estilo" vira impossível, e a regra de
composição única deixa de ser aplicável.

## Regra de composição única

Uma composição fecha inteira num só modelo e numa só execução. Metade de um
gerador com metade de outro vira colagem — cada elemento parece de uma foto
diferente.

Isso está aplicado no código, não só escrito aqui: `produce-layers.mjs` só
escreve o `manifest.json` quando as sete camadas fecham na mesma execução.
Conjunto incompleto não publica.
