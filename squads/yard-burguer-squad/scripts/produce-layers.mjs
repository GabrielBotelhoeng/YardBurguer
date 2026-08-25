#!/usr/bin/env node
/**
 * produce-layers.mjs — task produce-ingredient-layers (@brand-art-director).
 *
 * Gera as camadas do burger explodido e entrega WebP com alfa + manifest.
 *
 * DUAS RESTRICOES QUE DEFINEM O DESENHO DESTE SCRIPT:
 *
 * 1. O Gemini nao devolve alfa. Todas as respostas de imagem vem em JPEG, que
 *    nao tem canal de transparencia. Entao o fundo e resolvido em duas etapas:
 *    gerar sobre chroma magenta puro e recortar aqui com sharp. Magenta porque
 *    nenhum ingrediente e magenta — verde brigaria com alface, azul com cebola
 *    roxa, branco com pao.
 *
 * 2. Consistencia visual e obrigatoria. Sete chamadas separadas produzem sete
 *    estilos diferentes se o prompt nao amarrar luz, angulo e lente. O
 *    PREAMBULO abaixo e identico em toda camada e nao deve ser editado por
 *    camada — se precisar mudar estilo, muda para todas e regera o conjunto
 *    inteiro. Meia composicao nova com meia antiga vira colagem.
 *
 * Uso:
 *   node .../produce-layers.mjs                 # todas as camadas
 *   node .../produce-layers.mjs --only queijo   # uma camada (teste barato)
 *   node .../produce-layers.mjs --model gemini-3.1-flash-image
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import sharp from 'sharp';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const API = 'https://generativelanguage.googleapis.com/v1beta/models';
const MODELO_PADRAO = 'gemini-3-pro-image';

/** Chroma de recorte. Magenta puro nao existe em comida. */
const CHROMA = { r: 255, g: 0, b: 255 };
/**
 * Recorte com rampa em vez de corte seco. Abaixo de DENTRO e fundo puro; acima
 * de FORA e ingrediente; no meio o alfa e proporcional, o que da anti-aliasing
 * na borda. Corte seco deixaria serrilhado visivel quando a camada escala.
 */
const CHROMA_DENTRO = 90;
/**
 * 170 e o teto empirico. Em 200 o recorte comecou a comer as bordas do blend e
 * do bacon: carne selada e bacon sao avermelhados e ficam a menos de 200 de
 * distancia do magenta, entao a rampa passou a tratar ingrediente como fundo.
 * O patty perdeu um terco da altura antes de alguem notar.
 */
const CHROMA_FORA = 170;
/** Passadas de erosao da matte. 2 mata o halo em superficie brilhante. */
const CHOKE_PADRAO = 2;

/**
 * Blocos da anatomia obrigatoria (CLAUDE.md), na ordem. Identicos em toda
 * camada — e essa identidade que garante que sete chamadas separadas produzam
 * sete pecas do mesmo hamburguer, e nao sete estilos.
 *
 * Duas notas sobre como isto difere do hero:
 *
 * ATMOSFERA nao se aplica. A camada e recortada e vive sobre o fundo carvao da
 * pagina; fumaca ou poeira no quadro viraria sujeira no alfa.
 *
 * COMPOSICAO inverte o anti-slop. O LOOK.md registra a excecao: aqui o
 * enquadramento centralizado e frontal e requisito tecnico do empilhamento no
 * CSS, nao preguica de composicao. O que continua valendo e o resto —
 * superficie lisa e o que denuncia geracao, e a correcao e descrever quebrado.
 */
const BLOCOS = {
  // 2. Lente e distancia
  lente:
    'Professional food photography of a single ingredient, shot on a 100mm macro lens at eye level, perfectly horizontal, sharp focus edge to edge, no depth-of-field blur.',

  // 3. Luz
  luz:
    'Soft warm key light from the upper left, gentle fill, no harsh specular blowout, no light without a visible direction.',

  /**
   * 4. Emulsao — SEM grao e SEM halacao, ao contrario do hero.
   *
   * Emulsao de filme e chroma key sao contraditorios. Grao e halacao sao
   * tratamento de quadro inteiro: o modelo os aplica tambem no fundo, e o
   * magenta puro vira rosa lavado a 120-150 de distancia do alvo — perto demais
   * dos tons avermelhados da comida para qualquer recorte confiavel. Testado
   * tres vezes, inclusive proibindo explicitamente grao no fundo. Nao adianta:
   * nao da para pedir que o fundo seja chapado e fotografico ao mesmo tempo.
   *
   * O que resolveu o plastico no hero, porem, nao foi o grao — foi a linguagem
   * de IMPERFEICAO. Essa parte fica, e ela nao mexe no fundo.
   */
  emulsao:
    'Real food texture with natural imperfection — visible pores, fibre and irregularity. Nothing smooth, nothing glossy, nothing computer-generated. Matte surfaces.',

  // 5. Paleta — escopo AMARRADO ao ingrediente.
  //    Na primeira versao dizia so "warm tones, no cool blue cast". Magenta e
  //    fortemente azul, entao a paleta brigou com a exigencia de chroma e
  //    venceu: o fundo voltou rosa lavado em 6 das 7 camadas e o recorte falhou
  //    inteiro. Instrucao de cor precisa dizer a QUE ela se aplica.
  paleta:
    'The ingredient itself is in warm terracotta and ember tones, with no blown-out white. This colour instruction applies only to the food, never to the background.',

  // Requisito de enquadramento (excecao registrada no LOOK.md).
  enquadramento:
    'The ingredient floats in the centre of the frame, fully visible, not cropped.',
};

const PREAMBULO = Object.values(BLOCOS).join(' ');

/**
 * O requisito de fundo vem DEPOIS da descricao do ingrediente, e nao antes.
 * Na primeira versao ele abria o prompt e o blend voltou com fundo de estudio
 * escuro — o modelo seguiu a parte mais concreta e descartou a instrucao
 * distante. Repetido e no fim, ele obedece.
 */
const EXIGENCIA_FUNDO = [
  'CRITICAL REQUIREMENT: the entire background must be one single flat colour,',
  'pure magenta, hex #FF00FF, RGB(255,0,255), edge to edge, perfectly uniform.',
  'Do not use a studio backdrop, gradient, dark background, wood, or any texture.',
  'No shadow cast on the background, no plate, no surface, no props, no hands, no text.',
  'The magenta must touch all four edges of the image.',
  // Sem esta frase o fundo deriva. Grao e halacao sao tratamentos de quadro
  // inteiro: o modelo aplicava a emulsao tambem no fundo, e o magenta puro
  // virava rosa lavado a 100+ de distancia do alvo — perto demais dos tons
  // avermelhados da comida para qualquer recorte confiavel.
  'The background is a flat digital chroma key, NOT part of the photograph:',
  'no film grain, no halation, no colour bleed, no vignette and no light spill',
  'on the background. Grain, halation and warm tone apply to the food only.',
].join(' ');

/**
 * Contrato espelhado em src/components/ExplodeScene.astro. order define o
 * empilhamento; mobile marca as quatro que sobrevivem no storyboard de celular.
 *
 * explodeY agora e o deslocamento FINAL em px, nao um valor a ser multiplicado
 * por speed. Antes os dois se multiplicavam, e o resultado era invisivel no
 * codigo: o pao de baixo tinha explodeY 90 mas speed 0.2, entao andava 18px de
 * verdade — praticamente parado, enquanto o de cima andava 180. A explosao
 * abria so para cima e a pilha ficava espremida embaixo.
 *
 * Os valores sao simetricos em torno do blend, que e o eixo, e a amplitude
 * cresce conforme a camada se afasta do centro. E assim que uma explosao se
 * comporta.
 *
 * Os ingredientes seguem o cardapio real (menu.json): blend de 160g, pao
 * brioche, cheddar. Nada aqui e inventado.
 */
const CAMADAS = [
  {
    id: 'pao-superior',
    order: 1,
    explodeY: -300,
    speed: 1.0,
    mobile: true,
    prompt: 'The top half of a toasted brioche burger bun, golden brown and unevenly baked, with visible open crumb pores, a few loose sesame seeds and slight flour dusting. Matte crust, never glossy.',
  },
  {
    id: 'alface',
    order: 2,
    explodeY: -195,
    speed: 1.0,
    mobile: false,
    prompt: 'A single ruffled leaf of crisp green lettuce, spread flat and wide, with irregular torn edges, visible leaf veins and a couple of water droplets. One edge slightly wilted.',
  },
  {
    id: 'tomate-cebola',
    order: 3,
    explodeY: -105,
    speed: 1.0,
    mobile: false,
    // Cebola roxa e legitimamente mais azul que verde — despill por matiz a
    // destruiria, deixando a cebola cinza.
    despillForte: false,
    prompt:
      'One hand-cut slice of ripe red tomato, thickness slightly uneven, seeds and pulp visible and glistening from its own juice, with a ring of raw purple onion resting off-centre on top of it.',
  },
  {
    id: 'queijo',
    order: 4,
    explodeY: -35,
    speed: 1.0,
    mobile: true,
    prompt:
      'A slice of cheddar cheese caught mid-melt, deep orange, edges drooping unevenly and one corner still holding its shape. Matte surface with slight oil separation, never a smooth plastic sheet.',
  },
  {
    id: 'blend',
    order: 5,
    explodeY: 0,
    speed: 1.0,
    mobile: true,
    prompt:
      'A thick 160g chargrilled beef patty, deep dark uneven sear crust, visible coarse grind and meat fibre, ragged hand-formed edges, rendered fat glistening in the crevices.',
  },
  {
    id: 'bacon',
    order: 6,
    explodeY: 70,
    speed: 1.0,
    mobile: false,
    prompt: 'Two strips of fried bacon laid side by side, rippled and buckled unevenly, deep reddish brown with darker charred spots and irregular streaks of rendered fat.',
  },
  {
    id: 'pao-inferior',
    order: 7,
    explodeY: 160,
    speed: 1.0,
    mobile: true,
    prompt: 'The bottom half of a brioche burger bun, flat cut side facing up, toasted unevenly on the griddle with darker patches, visible open crumb texture. Matte, never glossy.',
  },
];

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 2) {
    const chave = argv[i]?.replace(/^--/, '');
    if (chave) args[chave] = argv[i + 1];
  }
  return args;
}

async function carregarChave() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  const env = await readFile(resolve(raiz, '.env'), 'utf-8').catch(() => '');
  const achado = env.match(/^GEMINI_API_KEY=(.+)$/m);
  if (achado) return achado[1].trim();
  throw new Error('GEMINI_API_KEY ausente no ambiente e no .env da raiz.');
}

const dormir = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 503 do Gemini e pico de demanda, nao erro de chamada — a mesma requisicao
 * passa segundos depois. Sem retry, um pico transitorio derruba camadas
 * aleatorias do conjunto e obriga a refazer tudo, gastando credito de novo.
 * Backoff exponencial: 4s, 8s, 16s.
 */
async function gerarComRetry({ camada, modelo, chave, tentativas = 4 }) {
  for (let tentativa = 1; ; tentativa++) {
    try {
      return await gerar({ camada, modelo, chave });
    } catch (erro) {
      const transitorio = /^(429|500|503)/.test(erro.message);
      if (!transitorio || tentativa >= tentativas) throw erro;

      const espera = 2000 * 2 ** tentativa;
      console.log(`       ${camada.id}: ${erro.message.slice(0, 40)}… nova tentativa em ${espera / 1000}s`);
      await dormir(espera);
    }
  }
}

async function gerar({ camada, modelo, chave }) {
  const resposta = await fetch(`${API}/${modelo}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': chave, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `${PREAMBULO} ${camada.prompt} ${EXIGENCIA_FUNDO}` }] }],
      generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
    }),
  });

  const payload = await resposta.json();

  if (payload.error) {
    throw new Error(`${payload.error.code} ${payload.error.status}: ${payload.error.message}`);
  }

  const partes = payload.candidates?.[0]?.content?.parts ?? [];
  const imagem = partes.find((parte) => parte.inlineData?.data);

  if (!imagem) {
    const texto = partes.find((parte) => parte.text)?.text;
    throw new Error(`resposta sem imagem${texto ? ` — modelo disse: ${texto.slice(0, 160)}` : ''}`);
  }

  return Buffer.from(imagem.inlineData.data, 'base64');
}

/**
 * Recorte por chroma. Percorre o raw, aplica alfa em rampa e depois apara a
 * moldura vazia para a camada ocupar o proprio bounding box — sem isso cada PNG
 * viria com margem diferente e o empilhamento no CSS ficaria desalinhado.
 *
 * Duas correcoes que separam recorte utilizavel de recorte amador:
 *
 * DESPILL — a borda do ingrediente reflete o fundo e fica com franja magenta.
 * Nos pixels de transicao, o excesso de vermelho+azul sobre o verde e puxado
 * para baixo. So nos pixels de transicao: aplicar no miolo destruiria tomate,
 * cebola roxa e bacon, que sao legitimamente avermelhados.
 *
 * RGB SOB O TRANSPARENTE — alfa zero nao apaga a cor, so a esconde. Quando o
 * browser reescala a imagem ele interpola RGB junto e o magenta escondido
 * ressurge como halo. Por isso o pixel invisivel tambem e neutralizado.
 */
async function recortar(bufferJpeg, choke, despillForte) {
  const { data, info } = await sharp(bufferJpeg)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const canais = info.channels;
  let removidos = 0;

  /**
   * Chroma medido, nao assumido.
   *
   * A versao anterior comparava contra #FF00FF literal. Quando o modelo
   * devolveu um magenta lavado — porque outro bloco do prompt pedia tons
   * quentes — a distancia ficou em ~112, dentro da rampa e fora do corte, e
   * NENHUM pixel virou transparente. O recorte falhou sem que nada estivesse
   * errado com a imagem.
   *
   * A primeira tentativa de conserto foi usar a cor medida do canto COMO
   * chroma, para ser imune a deriva. Foi pior: magenta lavado fica perto demais
   * dos tons vermelho-amarronzados da comida, e com a tolerancia calibrada para
   * magenta puro o recorte passou a comer o ingrediente. As camadas sairam
   * esburacadas.
   *
   * A licao: nao adaptar o recorte a um fundo ruim. Exigir o fundo certo e
   * RECUSAR quando ele nao vier. O canto vira validacao, nao referencia — ele e
   * fundo por definicao, entao a distancia dele ao magenta puro mede
   * exatamente o quanto o modelo desobedeceu.
   */
  const cantos = [
    0,
    (info.width - 1) * canais,
    (info.height - 1) * info.width * canais,
    ((info.height - 1) * info.width + info.width - 1) * canais,
  ];
  const mediana = (valores) => valores.slice().sort((a, b) => a - b)[Math.floor(valores.length / 2)];
  const chroma = {
    r: mediana(cantos.map((i) => data[i])),
    g: mediana(cantos.map((i) => data[i + 1])),
    b: mediana(cantos.map((i) => data[i + 2])),
  };

  const desvio = Math.sqrt(
    (chroma.r - CHROMA.r) ** 2 + (chroma.g - CHROMA.g) ** 2 + (chroma.b - CHROMA.b) ** 2
  );

  /**
   * Controle de admissao, medido nos dois desastres anteriores.
   *
   * Ate ~85 o fundo ainda e magenta saturado de verdade (ex.: rgb 228,57,208) e
   * fica a mais de 170 de qualquer tom de comida — o recorte tem folga. Acima
   * de ~110 o fundo vira rosa lavado, entra na faixa dos ingredientes
   * avermelhados e o recorte come o proprio ingrediente: foi assim que as
   * camadas sairam esburacadas.
   *
   * Dentro do limite o recorte usa a cor MEDIDA, nao o magenta ideal, porque e
   * contra o fundo real que o pixel precisa ser comparado. Fora do limite,
   * recusa — adaptar-se a um fundo ruim foi exatamente o erro que produziu as
   * camadas furadas.
   */
  if (desvio > 85) {
    throw new Error(
      `fundo a ${Math.round(desvio)} de distancia do magenta puro ` +
        `(medido rgb ${chroma.r},${chroma.g},${chroma.b}). ` +
        'O modelo nao obedeceu a exigencia de chroma — provavel conflito com um bloco de cor do prompt. Regerar.'
    );
  }

  for (let i = 0; i < data.length; i += canais) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    const distancia = Math.sqrt((r - chroma.r) ** 2 + (g - chroma.g) ** 2 + (b - chroma.b) ** 2);

    if (distancia <= CHROMA_DENTRO) {
      data[i + 3] = 0;
      // Neutraliza a cor escondida para nao virar halo ao reescalar.
      data[i] = g;
      data[i + 2] = g;
      removidos++;
    } else if (distancia < CHROMA_FORA) {
      const proporcao = (distancia - CHROMA_DENTRO) / (CHROMA_FORA - CHROMA_DENTRO);
      data[i + 3] = Math.round(proporcao * 255);

      // Despill restrito a borda.
      const media = (r + b) / 2;
      if (media > g) {
        const excesso = (media - g) * (1 - proporcao);
        data[i] = Math.max(0, Math.round(r - excesso));
        data[i + 2] = Math.max(0, Math.round(b - excesso));
      }
    }
  }

  /**
   * Choke da matte: 1px de erosao no alfa.
   *
   * O despill trata a cor da franja, mas nao a existencia dela. Em recorte de
   * borda complexa — a alface frisada e o caso extremo — sobra um anel de
   * pixels que sao meio fundo e meio ingrediente, e nenhum ajuste de cor
   * resolve isso porque o pixel realmente contem as duas coisas.
   *
   * Encolher a matte em um pixel come a franja inteira. Custa um pixel de
   * ingrediente na borda, que ninguem percebe, e elimina o halo, que todo mundo
   * percebe.
   */
  /**
   * Despill por matiz no miolo opaco.
   *
   * O choke resolve franja de um ou dois pixels. Nao resolve o reflexo: numa
   * superficie brilhante como o pao brioche, o fundo magenta se reflete numa
   * faixa larga e macia que entra varios pixels adentro. Erodir a matte ate la
   * comeria o ingrediente.
   *
   * O que denuncia o reflexo e o matiz. Pao dourado, bacon, carne selada,
   * cheddar e alface tem azul ABAIXO do verde. Magenta levanta o azul. Entao
   * onde o azul passa do verde num ingrediente quente, aquilo e reflexo do
   * fundo — e so ali a correcao age.
   *
   * A cebola roxa e a excecao real: ela e legitimamente mais azul que verde.
   * Por isso a camada tomate-cebola desliga esta etapa em vez de confiar no
   * limiar. Limiar nao distingue reflexo de cebola; o contrato da camada sim.
   */
  if (despillForte) {
    for (let i = 0; i < data.length; i += canais) {
      if (data[i + 3] < 250) continue;
      const g = data[i + 1];
      if (data[i + 2] > g) data[i + 2] = g;
    }
  }

  for (let passada = 0; passada < choke; passada++) {
    const alfaOriginal = new Uint8Array(info.width * info.height);
    for (let p = 0; p < alfaOriginal.length; p++) {
      alfaOriginal[p] = data[p * canais + 3];
    }

    for (let y = 0; y < info.height; y++) {
      for (let x = 0; x < info.width; x++) {
        const p = y * info.width + x;
        if (alfaOriginal[p] === 0) continue;

        let menor = alfaOriginal[p];
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const vy = y + dy;
            const vx = x + dx;
            if (vy < 0 || vy >= info.height || vx < 0 || vx >= info.width) continue;
            const vizinho = alfaOriginal[vy * info.width + vx];
            if (vizinho < menor) menor = vizinho;
          }
        }
        data[p * canais + 3] = menor;
      }
    }
  }

  const totalPixels = info.width * info.height;
  const proporcaoFundo = removidos / totalPixels;

  // Bounding box pelo ALFA, nao pelo trim do sharp: trim compara cor com o
  // pixel do canto e para assim que encontra variacao, e o RGB sob o
  // transparente varia de pixel a pixel depois da neutralizacao. Alfa e o
  // criterio correto — e o unico que sabe onde o ingrediente termina.
  let minX = info.width;
  let minY = info.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * canais + 3] > 8) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < 0) {
    throw new Error('recorte removeu a imagem inteira — chroma provavelmente errado');
  }

  const base = sharp(data, {
    raw: { width: info.width, height: info.height, channels: canais },
  }).extract({
    left: minX,
    top: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  });

  /**
   * WebP com alfa em vez de PNG. O mesmo recorte sai em ~1/10 do peso, e sete
   * PNGs de 600kb somariam 4mb — a cena que deveria vender o projeto viraria a
   * cena que derruba o LCP no 4G. Redimensionado para 900px porque a camada
   * nunca e exibida acima de ~480px CSS; 900 cobre retina com folga.
   */
  const saida = await base
    .resize({ width: 900, withoutEnlargement: true })
    .webp({ quality: 82, alphaQuality: 90, effort: 6 })
    .toBuffer({ resolveWithObject: true });

  return {
    buffer: saida.data,
    largura: saida.info.width,
    altura: saida.info.height,
    proporcaoFundo,
    desvioChroma: Math.round(desvio),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const modelo = args.model || MODELO_PADRAO;
  const choke = args.choke !== undefined ? Number(args.choke) : CHOKE_PADRAO;
  const alvo = args.only ? CAMADAS.filter((c) => c.id === args.only) : CAMADAS;

  if (!alvo.length) {
    throw new Error(`camada "${args.only}" nao existe. Opcoes: ${CAMADAS.map((c) => c.id).join(', ')}`);
  }

  const chave = await carregarChave();
  const dirRaw = join(raiz, 'assets', 'raw');
  const dirSaida = join(raiz, 'public', 'assets', 'layers');
  await mkdir(dirRaw, { recursive: true });
  await mkdir(dirSaida, { recursive: true });

  console.log(`modelo: ${modelo} · camadas: ${alvo.length}\n`);

  const prontas = [];

  // Sequencial de proposito: cada imagem custa credito, e uma falha de quota no
  // meio de sete chamadas paralelas deixaria o conjunto pela metade — que e
  // exatamente o defeito que a regra de composicao unica proibe.
  for (const camada of alvo) {
    try {
      const caminhoRaw = join(dirRaw, `${camada.id}.jpg`);

      // --reuse reprocessa o JPEG ja pago. Afinar tolerancia de recorte e
      // tentativa e erro; refazer a geracao a cada ajuste queimaria credito
      // para receber uma imagem diferente, que e justamente o que nao se quer
      // quando o objetivo e comparar recortes do mesmo raw.
      /**
       * Retry tambem para recorte reprovado, nao so para 503.
       *
       * A deriva do fundo e estocastica: a mesma instrucao de chroma as vezes e
       * obedecida e as vezes nao, na mesma execucao. Tratar isso como erro
       * terminal derrubava o conjunto inteiro por causa de uma ou duas camadas,
       * obrigando a refazer as sete. Uma nova rolagem da camada que falhou custa
       * uma geracao; refazer o conjunto custa sete.
       */
      let raw;
      let resultado;

      for (let tentativa = 1; ; tentativa++) {
        if (args.reuse !== undefined && existsSync(caminhoRaw)) {
          raw = await readFile(caminhoRaw);
        } else {
          raw = await gerarComRetry({ camada, modelo, chave });
        }

        try {
          resultado = await recortar(raw, choke, camada.despillForte !== false);
          break;
        } catch (erro) {
          const chromaRuim = erro.message.includes('distancia do magenta');
          const podeRepetir = chromaRuim && args.reuse === undefined && tentativa < 3;
          if (!podeRepetir) throw erro;
          console.log(`       ${camada.id}: fundo derivou, nova rolagem (${tentativa}/2)`);
        }
      }

      await writeFile(caminhoRaw, raw);

      const { buffer, largura, altura, proporcaoFundo, desvioChroma } = resultado;
      await writeFile(join(dirSaida, `${camada.id}.webp`), buffer);

      const kb = (buffer.length / 1024).toFixed(0);
      const fundo = (proporcaoFundo * 100).toFixed(0);
      const deriva = desvioChroma > 40 ? `  chroma +${desvioChroma}` : '';
      console.log(`  ok   ${camada.id.padEnd(15)} ${largura}x${altura}  ${kb}kb  fundo ${fundo}%${deriva}`);

      /**
       * Recorte ruim REPROVA a camada em vez de so avisar.
       *
       * Na versao anterior isto era um console.warn e o manifest era escrito
       * assim mesmo. O resultado: sete camadas sem transparencia foram
       * publicadas com um aviso que ninguem leu, e a cena 2 quebrou. Aviso que
       * nao bloqueia nao e gate, e decoracao.
       */
      if (proporcaoFundo < 0.15) {
        throw new Error(
          `recorte falhou — so ${fundo}% virou transparente. ` +
            `Chroma medido a ${desvioChroma} de distancia do magenta puro. ` +
            'Provavel briga entre a exigencia de fundo e algum bloco de cor do prompt.'
        );
      }
      if (proporcaoFundo > 0.9) {
        throw new Error(`recorte comeu a camada — ${fundo}% transparente`);
      }

      prontas.push({
        id: camada.id,
        src: `/assets/layers/${camada.id}.webp`,
        order: camada.order,
        explodeY: camada.explodeY,
        speed: camada.speed,
        mobile: camada.mobile,
        largura,
        altura,
      });
    } catch (erro) {
      console.error(`  FALHA ${camada.id}: ${erro.message}`);
      process.exitCode = 1;
    }
  }

  // Manifest so e reescrito em execucao completa. Rodar --only e teste, e teste
  // nao deve publicar um manifest de uma camada so.
  if (!args.only && prontas.length === CAMADAS.length) {
    const manifest = {
      _gerado: new Date().toISOString(),
      _modelo: modelo,
      _nota:
        'Conjunto fechado em uma unica sessao e um unico modelo. Regerar significa regerar TODAS as camadas — misturar modelos vira colagem.',
      mobileLayers: prontas.filter((c) => c.mobile).map((c) => c.id),
      camadas: prontas.sort((a, b) => a.order - b.order),
    };
    await writeFile(join(dirSaida, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
    console.log(`\nmanifest.json escrito com ${prontas.length} camadas.`);
  } else if (args.only) {
    console.log('\n--only e teste: manifest nao foi tocado.');
  } else {
    console.error('\nConjunto incompleto — manifest NAO foi escrito para nao publicar colagem.');
  }
}

main().catch((erro) => {
  console.error(`Falha: ${erro.message}`);
  process.exitCode = 1;
});
