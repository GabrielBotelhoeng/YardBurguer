import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import subsetFont from 'subset-font';

/**
 * Gera os woff2 finais de Anton e Inter, self-hosted, a partir dos arquivos
 * originais do @fontsource — que continuam instalados só como MATÉRIA-PRIMA
 * (node_modules nunca vai pro commit).
 *
 * NÃO roda no build. É geração pontual: o resultado é commitado em
 * public/assets/fonts/ e só se regenera rodando este script de novo, do jeito
 * que o resto do projeto trata mídia gerada (ver CLAUDE.md, "Depois de gerar —
 * obrigatório, sem exceção").
 *
 * Uso: node squads/yard-burguer-squad/scripts/subsetar-fontes.mjs
 *
 * ---------------------------------------------------------------------------
 * POR QUE ESTE CONJUNTO DE CARACTERES E NÃO OUTRO
 * ---------------------------------------------------------------------------
 * O conteúdo real da página (varrido com Playwright em 375/390/430/844×390 e
 * desktop, percorrendo cada nó de texto do DOM e lendo o font-family
 * computado) usa:
 *   - Anton: dígitos e só um subconjunto de A-Z/a-z + áãéêíóú
 *   - Inter: ASCII quase inteiro + áãçéêóõú, –—'''"·©
 *
 * Mas o conteúdo vem de src/content/*.json e muda sem passar por revisão de
 * fonte. Por isso o subset carrega MARGEM, não o mínimo medido:
 *
 *   - Alfabeto latino completo, maiúsculo e minúsculo (A-Z, a-z)
 *   - Dígitos 0-9
 *   - Pontuação ASCII comum (espaço e toda a faixa imprimível de U+0021 a
 *     U+007E: . , ; : ! ? ' " ( ) - / & % $ # @ etc.)
 *   - Acentos do português em maiúsculo e minúsculo: À Á Â Ã Ç É Ê Í Ó Ô Õ Ú Ü
 *     à á â ã ç é ê í ó ô õ ú ü, mais Ñ/ñ (comum em nomes emprestados)
 *   - Tipografia comum em copy web: – — (en/em dash), aspas curvas ‘ ’ “ ”,
 *     reticências …, meio-ponto ·, copyright ©, indicadores ordinais º ª
 *
 * QUEBRA SE ALGUÉM PUSER FORA DESSE CONJUNTO: qualquer caractere que não está
 * nesta lista — ç-cedilha de outro idioma tipo ő/ű, um emoji, um caractere
 * matemático, ø/æ/ß nórdico-alemão, aspas angulares «», til livre ~ solto
 * fora de combinação — vai virar "tofu" (glifo .notdef, geralmente uma
 * caixinha vazia), porque o unicode-range do @font-face continua o mesmo
 * (herdado do arquivo "latin" original do @fontsource: U+0000-00FF e mais uns
 * intervalos de pontuação), então o navegador ainda escolhe esta fonte para o
 * caractere — só que o glifo não está mais dentro do arquivo.
 *
 * Se o cardápio ou a copy precisarem de um caractere fora da lista acima,
 * ADICIONE-O em `CARACTERES_MARGEM` abaixo e rode o script de novo. Não dá pra
 * simplesmente confiar que "deve caber" — é isso que este comentário existe
 * pra prevenir.
 *
 * ---------------------------------------------------------------------------
 * POR QUE O EIXO DE PESO DA INTER FICOU 400–700 E NÃO 100–900
 * ---------------------------------------------------------------------------
 * O mesmo levantamento de DOM (font-weight computado, em CADA elemento, não só
 * texto) achou exatamente três valores usados na página inteira, em todas as
 * viewports: 400, 600 e 700. Nunca 100-390 nem 710-900.
 *
 * A Inter Variable original carrega o eixo inteiro (100 a 900) porque é uma
 * fonte de uso genérico — mas cada extremo do eixo é peso morto se a página
 * nunca pede. Restringir para 400–700 mantém a fonte VARIÁVEL (qualquer valor
 * intermediário, tipo 500 ou 650, ainda interpola normalmente — não é um
 * "pino" fixo em três instâncias), só corta os dois pedaços do eixo que
 * nenhum elemento usa.
 *
 * QUEBRA SE: um `font-weight` menor que 400 (100/200/300, "thin"/"light") ou
 * maior que 700 (800/900, "black") for aplicado a texto em Inter no futuro —
 * o navegador vai fazer clamp pro limite mais próximo (400 ou 700) em vez de
 * renderizar o peso pedido. Não quebra layout nem lança erro; só não fica tão
 * fino/grosso quanto o CSS pediu.
 *
 * TESTADO CONTRA A ALTERNATIVA ESTÁTICA: instanciar Inter em três arquivos
 * estáticos (400, 600 e 700 fixos, sem eixo) deu 13.436 + 13.868 + 13.828 =
 * 41.132 bytes somados — quase o DOBRO do único arquivo variável 400–700
 * (21.496 bytes no teste com fonttools). Cada estático carrega o glyf inteiro
 * from scratch; o variável reaproveita o mesmo glyph set e só guarda os
 * deltas de interpolação, que saem mais baratos que triplicar o contorno.
 * Por isso a escolha foi variável de faixa curta, não estáticos.
 */

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '../../../');

const CARACTERES_MARGEM =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz' +
  '0123456789' +
  ' !"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~' +
  'ÀÁÂÃÇÉÊÍÓÔÕÚÜàáâãçéêíóôõúü' +
  'ÑñÀàÈèÌìÒòÙù' + // graves comuns em nomes próprios importados (raro, mas barato incluir)
  '–—‘’“”…·©ºª';

async function gerarAnton() {
  const origem = path.join(
    RAIZ,
    'node_modules/@fontsource/anton/files/anton-latin-400-normal.woff2'
  );
  const buffer = readFileSync(origem);
  const subset = await subsetFont(buffer, CARACTERES_MARGEM, {
    targetFormat: 'woff2',
  });
  const destino = path.join(RAIZ, 'public/assets/fonts/anton-subset.woff2');
  mkdirSync(path.dirname(destino), { recursive: true });
  writeFileSync(destino, subset);
  console.log(
    `Anton: ${buffer.length} -> ${subset.length} bytes (${Math.round(
      (1 - subset.length / buffer.length) * 100
    )}% menor) -> ${path.relative(RAIZ, destino)}`
  );
}

async function gerarInter() {
  const origem = path.join(
    RAIZ,
    'node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2'
  );
  const buffer = readFileSync(origem);
  const subset = await subsetFont(buffer, CARACTERES_MARGEM, {
    targetFormat: 'woff2',
    variationAxes: {
      // A página só usa 400/600/700. Faixa continua variável, só mais curta —
      // ver justificativa completa no comentário acima.
      wght: { min: 400, max: 700, default: 400 },
    },
  });
  const destino = path.join(RAIZ, 'public/assets/fonts/inter-subset.woff2');
  mkdirSync(path.dirname(destino), { recursive: true });
  writeFileSync(destino, subset);
  console.log(
    `Inter: ${buffer.length} -> ${subset.length} bytes (${Math.round(
      (1 - subset.length / buffer.length) * 100
    )}% menor) -> ${path.relative(RAIZ, destino)}`
  );
}

await gerarAnton();
await gerarInter();
