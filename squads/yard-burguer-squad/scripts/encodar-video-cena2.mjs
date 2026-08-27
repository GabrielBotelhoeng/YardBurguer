/**
 * Encoda os takes do cliente para a Cena 2 em vídeo (scroll-scrubbed).
 *
 * Receita escrita em comentário não reproduz nada. Se o cliente mandar takes
 * novos, é este arquivo que roda — não uma linha de ffmpeg colada de um
 * relatório antigo.
 *
 * Uso:
 *   node encodar-video-cena2.mjs [take-16x9] [take-vertical]
 *   (padrão: assets/raw/burger-stack-16x9-original.mp4
 *            assets/raw/burger-stack-vertical-original.mp4)
 *
 * Requer ffmpeg no PATH. Instalado neste projeto via:
 *   winget install --id Gyan.FFmpeg -e
 *
 * ---------------------------------------------------------------------------
 * DOIS TAKES NATIVOS (2026-08-26)
 * ---------------------------------------------------------------------------
 *
 * Até aqui havia UM take 16:9 e o quadro do celular era derivado dele por corte
 * e composição. O cliente passou a entregar dois takes nativos — 1920x1080 e
 * 1080x1920, ambos a 24fps — então cada formato vem do material feito para ele.
 * Não há mais corte inventando enquadramento vertical a partir de horizontal.
 *
 * Os dois vieram com FUNDO ESCURO LISO, não com o xadrez de transparência da
 * primeira tentativa (mp4 não carrega canal alpha; o xadrez virava pixel). É
 * isso que torna a composição abaixo invisível: estender a borda de um fundo
 * liso devolve o mesmo fundo liso.
 *
 * ---------------------------------------------------------------------------
 * AS QUATRO DECISÕES DO ENCODE, E O QUE CADA UMA CUSTA
 * ---------------------------------------------------------------------------
 *
 * 1. REVERSE — os takes vão de montado para explodido; o storyboard pede o
 *    contrário desde 2026-08-25 ("o ato de construir é o que dá fome"). Inverter
 *    aqui e não no runtime não é preferência: rolar `currentTime` para trás
 *    obriga o decodificador a partir do keyframe anterior e descartar tudo à
 *    frente, a cada quadro. Invertido no arquivo, rolar para baixo é avançar no
 *    tempo — o único sentido para o qual todo decodificador é otimizado.
 *
 * 2. FASTSTART — sem o átomo `moov` no começo, o browser não consegue buscar
 *    antes de baixar quase o arquivo inteiro, e é isso que mata o scrubbing em
 *    conexão lenta.
 *
 * 3. GOP CURTO — com `-g 12` (a cada 0,5s a 24fps) o pior caso de seek é 11
 *    quadros a decodificar. Medido a 960x540 crf30: g=48 → 500 kB, g=12 → 786 kB.
 *    Seekability custa ~57% a mais de arquivo. Pagamos porque cena que trava ao
 *    buscar não é cena.
 *
 * 4. SEM B-FRAMES (`-bf 0 -refs 1`) — quadro B depende de um quadro futuro. Num
 *    vídeo que só toca, isso é compressão de graça; num vídeo que é BUSCADO
 *    quadro a quadro, é trabalho extra em cada seek.
 *
 * NÃO usamos fps menor: testado 24, 15 e 12 fps e o arquivo NÃO encolheu. Com
 * GOP fixo em segundos, os keyframes dominam o bitrate.
 *
 * NÃO usamos WebM/VP9: testado a 960x540 com o mesmo GOP, o VP9 PERDEU do x264
 * (crf42 → 875 kB contra 786 kB do x264 crf30, com qualidade pior).
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, '../../..');

const ORIGEM_LARGA = process.argv[2] ?? resolve(RAIZ, 'assets/raw/burger-stack-16x9-original.mp4');
const ORIGEM_VERTICAL = process.argv[3] ?? resolve(RAIZ, 'assets/raw/burger-stack-vertical-original.mp4');
const DESTINO = resolve(RAIZ, 'public/assets/video');

/**
 * Parâmetros comuns aos dois formatos. O que muda é só geometria — a mecânica de
 * seek precisa ser idêntica, senão um device teria um comportamento de scrub que
 * o outro não tem e o bug seria irreprodutível.
 */
const SEEKAVEL = [
  '-c:v', 'libx264',
  '-preset', 'veryslow',
  '-profile:v', 'main',
  '-bf', '0',            // sem quadro B: nada depende de um quadro futuro
  '-refs', '1',          // uma referência só: menos trabalho por seek
  '-g', '12',            // keyframe a cada 0,5s a 24fps
  '-keyint_min', '12',
  '-sc_threshold', '0',  // cadência FIXA de keyframe, não a critério do detector de corte
  '-pix_fmt', 'yuv420p', // o único pix_fmt que Safari e Android antigo aceitam
  '-movflags', '+faststart',
];

/**
 * A MARGEM DE SEGURANÇA — por que os quadros são compostos e não só escalados.
 *
 * Medido nos takes (bounding box do produto por saturação, no quadro mais
 * espalhado E no montado, que é onde ele cresce):
 *
 *   16:9   folga lateral 17,6%  |  folga topo 4,1%  base 0,1%
 *   9:16   folga lateral  4,7%  |  folga topo 0,0%  base 0,1%
 *
 * Ou seja: o produto ENCOSTA nas bordas. `object-fit: cover` na tela corta o que
 * sobra da proporção, e sem margem esse corte sai do pão.
 *
 * A saída de cada formato é então composta: o take entra INTEIRO, encolhido pelo
 * RECUO, e as bordas dele são estendidas para preencher o que falta. O corte do
 * `cover` passa a cair nesse preenchimento antes de chegar ao produto.
 *
 * POR QUE O DESKTOP SAI EM 2:1 e não em 16:9. O palco é a tela MENOS a navbar,
 * então sua proporção vai de ~1,75 (1440x824) a ~1,99 (1366x692) — sempre mais
 * larga que os 1,778 do take. Compondo a saída em 2:1, o corte do `cover`
 * acontece na LATERAL em todas elas, que é onde o take tem 17,6% de folga, em
 * vez da vertical, onde tem 4,1% no melhor quadro e 0% no pior.
 *
 * O CELULAR sai em 9:16, a proporção nativa do seu take. Os palcos vão de 0,49
 * (Pixel 7) a 0,635 (iPhone SE) e o arquivo é 0,5625, ou seja a proporção da
 * tela cai dos DOIS lados: em tela mais estreita o cover corta lateral, em tela
 * mais larga corta vertical. Por isso aqui a margem precisa ser em volta.
 *
 * RESSALVA QUE VALE MAIS QUE ESTA MARGEM: medido quadro a quadro na fonte, o
 * produto toca a linha 0 em 114 dos 192 quadros do 16:9 e em 86 dos 192 do
 * vertical — a coroa do pão já vem FATIADA do gerador, em quase metade da
 * animação. Nenhum preenchimento conserta isso; ele só põe borrão em volta de um
 * pão que já está cortado. O take precisa nascer com ~8% de respiro no topo e
 * ~5% na base. Enquanto não nascer, a margem abaixo limita o estrago, não o
 * evita.
 */

/**
 * O RECUO É DOS DOIS, e a assimetria anterior era um bug.
 *
 * O desktop era composto com `escala = 1`, e `force_original_aspect_ratio=
 * decrease` de 1920x1080 dentro de 1600x800 dá fator 0,7407 — ou seja
 * 1422x800, ALTURA CHEIA. O preenchimento saía 89px por lado na horizontal e
 * ZERO na vertical. Um braço da mesma função tinha margem e o outro não.
 *
 * O que isso custava, medido: na faixa de janelas em que o palco fica mais alto
 * que 2:1 e o escape para `contain` ainda não disparou, o `cover` comia o pão de
 * baixo — 14px em 1680x900, 27px em 1500x800.
 *
 * 0,85 e não 0,92: o corte lateral no pior caso previsto (iPad deitado, palco
 * 1024x692 = 1,48 contra os 2,0 do arquivo) é de 13% por lado. Com 0,92 a margem
 * cairia para 4% e não cobriria; com 0,85 são 7,5% de preenchimento MAIS a folga
 * própria do take, que dá 22,5% no total. Passa com folga.
 */
const RECUO = 0.85;

/**
 * O VERTICAL RECUA MAIS — 0.72 contra os 0.85 do desktop.
 *
 * Até 2026-08-26 o recuo era o mesmo nos dois, e a simetria estava certa
 * enquanto a margem servia só para o `cover` ter o que cortar. Ela passou a
 * servir para outra coisa: a marca `YARD` / `BURGUER` agora desce pelas laterais
 * do hambúrguer, e faixa lateral precisa de lateral.
 *
 * MEDIDO, e é por isso que os dois não podem ter o mesmo número. Com RECUO 0.85
 * nos dois, o produto ocupa 36,4% da largura no arquivo 2:1 e 75,7% no 9:16 — a
 * mesma composição dá quadros completamente diferentes. Na tela, num palco de
 * celular de 375x768, sobravam 38px de lateral livre à esquerda e 10px à
 * direita. As palavras ficavam atrás do hambúrguer; no desktop ladeavam limpo.
 * Era exatamente a divergência entre desktop e celular que o cliente proibiu.
 *
 * 0.72 põe o produto em 64,5% da largura do quadro vertical, o que devolve ~48px
 * de faixa livre de CADA lado no mesmo palco de 375px. A conta que liga os dois:
 * o `cover` do celular renderiza o arquivo a 432px e corta 28,5px por lado, e é
 * disso que a folga precisa sobrar.
 *
 * O CUSTO É REAL e foi escolhido com o cliente: o hambúrguer passa de 328px para
 * ~240px de largura na tela do celular. Foi a opção "meio-termo" — 0.61 daria
 * faixas do tamanho exato das do desktop e derrubaria o produto para 206px, perto
 * demais do "quadradinho no meio da tela" que ele já recusou uma vez.
 */
const RECUO_VERTICAL = 0.72;

/**
 * O TAKE VERTICAL NASCE TORTO, e sem corrigir isso o recuo acima é desperdiçado.
 *
 * Medido em 12 quadros do `burger-stack-vertical-original.mp4` (1080 de largura):
 * o produto vai de x=96 a x=1063 no quadro mais largo. São 96px de fundo à
 * esquerda e 17px à direita — o hambúrguer está deslocado 39,5px para a direita
 * do centro do quadro.
 *
 * `compor` centraliza o TAKE no quadro de saída, não o PRODUTO dentro do take.
 * Então a torção do material atravessava a composição inteira e chegava na tela:
 * com faixas simétricas em CSS, a da direita batia no hambúrguer 12px antes da
 * esquerda. Sem esta correção o 0.72 acima entregaria 61px de folga à esquerda e
 * 37px à direita — e é sempre o lado apertado que decide o tamanho da fonte.
 *
 * O deslocamento é aplicado em pixels da SAÍDA, então escala junto com o recuo.
 */
const DESLOC_PRODUTO_VERTICAL = -39.5;

/**
 * RESOLUÇÃO SAI DE PIXEL FÍSICO, NÃO DE PIXEL CSS. Foi o que faltava aqui.
 *
 * O celular saía em 640 de largura, dimensionado contra os ~390 CSS px do palco
 * — o que parecia downscale confortável. Mas o iPhone 14 tem `devicePixelRatio`
 * 3: o palco tem 1170 pixels FÍSICOS. O arquivo de 640 era esticado 1,83x, e a
 * cena que estava nítida no desktop amolecia no celular. O cliente viu na hora:
 * "no desktop ficou muito bonitos os hambúrgueres, já no mobile parece que a
 * qualidade caiu um pouco".
 *
 * O desktop escapava por acidente — DPR 1 na maioria dos monitores. Num MacBook
 * Retina de 1440 (2880 físicos) o 1600 sofria o mesmo esticão de 1,8x.
 *
 * MEDIDO, e o resultado inverte a intuição: resolução NATIVA com mais compressão
 * ganha de resolução menor com menos compressão, nos dois eixos ao mesmo tempo.
 * Nitidez medida como gradiente médio por pixel, no recorte do blend, já no
 * tamanho real de exibição:
 *
 *   celular, exibido a 1170px físicos
 *     640x1138  crf34 →  664 kB   estica 1,83x   nitidez 13,29   (o que havia)
 *     900x1600  crf34 → 1116 kB   estica 1,30x   nitidez 15,60
 *     1080x1920 crf38 →  980 kB   estica 1,08x   nitidez 15,87   ← escolhido
 *     1080x1920 crf34 → 1452 kB   estica 1,08x   nitidez 16,43
 *
 *   desktop, exibido a 2880px físicos (Retina 1440)
 *     1600x800  crf33 →  972 kB   nitidez 15,28   (o que havia)
 *     1920x960  crf37 →  840 kB   nitidez 15,90   ← escolhido
 *     1920x960  crf35 → 1024 kB   nitidez 16,27
 *
 * Em ambos, o nativo com crf alto é MAIS LEVE e MAIS NÍTIDO que o intermediário
 * com crf baixo. Faz sentido: mais amostras preservam a estrutura fina melhor do
 * que menos amostras bem descritas, e o quadro tem muita área lisa de fundo, que
 * comprime de graça em qualquer crf.
 *
 * Não passa de 1080/1920 porque é a resolução dos takes. Acima disso seria
 * inventar pixel — o upscale no encode custa bytes e não devolve detalhe.
 */
const LARGA = { largura: 1920, altura: 960 };    // 2:1 — ver "DESKTOP" acima
const CELULAR = { largura: 1080, altura: 1920 }; // 9:16 nativo do take

/**
 * A cor do FUNDO na linha de borda do take — não a cor média dela.
 *
 * A distinção é o que fez a diferença. A primeira versão amostrava um retângulo
 * no canto superior esquerdo, e o canto tem vinheta: dava 45 enquanto a linha de
 * borda no centro do quadro estava em 51. Pintar a margem com 45 deixava um
 * degrau de 6 níveis atravessando a tela na emenda — sutil, mas numa área lisa e
 * escura o olho encontra.
 *
 * Amostrar a linha inteira também não serve: quando o pão encosta na borda, ele
 * entra na média e puxa a cor para o claro.
 *
 * Então: lê a linha de borda inteira, ordena os pixels por brilho e tira a média
 * dos 40% MAIS ESCUROS. O produto é sempre mais claro que o fundo neste
 * material, então ele cai fora do corte sozinho, e o que sobra é o fundo tal como
 * ele é na altura exata onde a emenda vai acontecer.
 */
function corDoFundoNaBorda(arquivo, largura, y, alturaFaixa) {
  const bruto = execFileSync('ffmpeg', [
    '-v', 'error', '-ss', '4', '-i', arquivo,
    '-frames:v', '1',
    '-vf', `crop=${largura}:${alturaFaixa}:0:${y},scale=${largura}:1`,
    '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-',
  ], { maxBuffer: 1 << 24 });

  /**
   * Amostra incompleta REPROVA em vez de virar cor.
   *
   * O `-ss 4` presume um take com mais de 4s. Num take curto o ffmpeg sai com
   * codigo 0 e zero byte de video: o laco abaixo lia `undefined`, a media dava
   * NaN, e o `toString(16)` devolvia "0xNaNNaNNaN" — que o ffmpeg aceita como
   * cor mais adiante e pinta de preto. O defeito so aparecia na margem do
   * video final, longe daqui.
   */
  if (bruto.length < largura * 3) {
    throw new Error(
      `amostra de cor vazia em ${arquivo} (y=${y}): ${bruto.length} bytes, ` +
        `esperado ${largura * 3}. O take provavelmente e mais curto que os 4s do -ss.`
    );
  }

  const px = [];
  for (let i = 0; i < largura; i++) {
    px.push([bruto[i * 3], bruto[i * 3 + 1], bruto[i * 3 + 2]]);
  }
  px.sort((a, b) => a[0] + a[1] + a[2] - (b[0] + b[1] + b[2]));
  const escuros = px.slice(0, Math.max(1, Math.floor(largura * 0.4)));
  const soma = escuros.reduce((s, p) => [s[0] + p[0], s[1] + p[1], s[2] + p[2]], [0, 0, 0]);
  const hex = (n) => Math.round(n / escuros.length).toString(16).padStart(2, '0');
  return `0x${hex(soma[0])}${hex(soma[1])}${hex(soma[2])}`;
}

/** Lê as dimensões reais da fonte — as margens dependem delas. */
function medir(arquivo) {
  const saida = execFileSync('ffprobe', [
    '-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height', '-of', 'csv=p=0', arquivo,
  ]).toString().trim();
  const [w, h] = saida.split(',').map(Number);
  return { w, h };
}

/**
 * Põe o take inteiro no quadro pedido e ESTENDE AS BORDAS DELE para preencher o
 * resto. Uma camada só.
 *
 * A versão anterior era duas camadas: o take por cima, e por baixo uma cópia
 * AMPLIADA e desfocada dele mesmo servindo de fundo. Isso tinha um defeito que
 * nenhum ajuste de brilho resolvia — a cópia ampliada contém o hambúrguer, e o
 * hambúrguer dela é MAIOR que o da frente. A silhueta transbordava em volta do
 * produto e desenhava um halo claro contornando a peça inteira. O cliente viu
 * duas vezes: "por que tá esse borrado em volta? tipo quadrado" e, depois de eu
 * corrigir só o brilho, "e esses borrados em volta deles vai arrumar isso
 * ainda?". Ele estava certo nas duas.
 *
 * `fillborders=mode=smear` replica os pixels da BORDA do take para fora. Como
 * essa borda é fundo — o produto nunca a alcança, é para isso que serve o
 * RECUO — o preenchimento é fundo puro, sem nenhuma parte do hambúrguer nele.
 * E como cada lado replica a sua própria borda, o gradiente horizontal do take
 * (medido: 50 na esquerda contra 65 na direita no 16:9) é preservado, coisa que
 * esticar uma borda só não faria.
 *
 * Some junto o que existia para remendar a abordagem antiga: não há mais blur,
 * porque não há cópia para disfarçar; não há mais feather, porque não há duas
 * camadas para emendar. A transição é contínua por construção — o pixel da
 * margem É o pixel da borda.
 *
 * `setsar=1` no fim NÃO é decoração. `scale` reconcilia DAR mexendo no sample
 * aspect ratio em vez das dimensões, e um encode anterior saiu 640x1388 com SAR
 * 4511:2880 — o browser exibia como 1002x1388, proporção 0,72 em vez de 0,46. O
 * ffprobe de width/height mostra o número certo; é o SAR que mente.
 */
const compor = (fonte, l, a, escala = 1, deslocX = 0) => {
  const { corTopo, corBase } = fonte;
  // Quanto o take cabe dentro de `escala` do quadro, preservando a proporção.
  const fator = Math.min((l * escala) / fonte.w, (a * escala) / fonte.h);
  /**
   * MARGENS PARES, e isso não é preciosismo de alinhamento.
   *
   * Em yuv420p o plano de croma tem METADE da resolução. Com margem ímpar o
   * `fillborders` cobre o plano de luma e deixa parte do croma por preencher, e
   * o resultado é uma faixa que o `pad` deixou preta permanecendo preta.
   *
   * Aconteceu exatamente assim: em 1080x1920 a margem deu 81px, e as colunas de
   * x=999 a 1079 saíram com luminância 0,0 — uma tarja preta vertical no lado
   * direito da tela do celular, enquanto a esquerda (também 81px) vinha correta.
   * O encode anterior, em 640x1138, tinha margem 48 e passou ileso; o defeito só
   * apareceu quando a resolução subiu e a conta caiu num número ímpar.
   *
   * Arredondar o quadro do take para múltiplo de 4 faz as duas margens saírem
   * pares. O `format=yuv444p` abaixo é o cinto além do suspensório — resolve na
   * raiz, fazendo o filtro trabalhar sem subamostragem de croma.
   */
  const fw = Math.round((fonte.w * fator) / 4) * 4;
  const fh = Math.round((fonte.h * fator) / 4) * 4;
  /**
   * O deslocamento entra AQUI e sai par, como todo o resto.
   *
   * `Math.round(deslocX / 2) * 2` mantém a margem esquerda par — a mesma razão da
   * nota acima sobre croma: margem ímpar deixa parte do plano de croma sem
   * preencher e o `pad` devolve uma tarja preta. Já aconteceu uma vez, em 81px.
   *
   * O clamp existe porque deslocar demais zeraria uma das margens e o
   * `fillborders` receberia largura negativa. Na prática o deslocamento é ~28px
   * contra margens de ~150px, mas quem mexer no RECUO depois não vai lembrar
   * disso.
   */
  const esqCentrado = Math.floor((l - fw) / 4) * 2;
  const desloc = Math.round(deslocX * fator / 2) * 2;
  const esq = Math.min(Math.max(esqCentrado + desloc, 0), l - fw);
  const topo = Math.floor((a - fh) / 4) * 2;
  const dir = l - fw - esq;
  const base = a - fh - topo;
  return (
    `scale=${fw}:${fh},` +
    // Sem subamostragem de croma, o fillborders cobre os três planos por igual.
    // O encoder devolve para yuv420p depois, via -pix_fmt.
    `format=yuv444p,` +
    /**
     * SMEAR SÓ NA LATERAL. No topo e na base ele produzia um defeito grosseiro.
     *
     * `mode=smear` replica a linha da borda para fora. Isso é seguro onde a
     * borda é fundo — e na lateral é: o take tem 17,6% de folga no 16:9.
     *
     * No TOPO não é. Medido quadro a quadro, o produto toca a linha 0 em 114 dos
     * 192 quadros: quando o pão sobe, ele encosta na borda do take. O smear então
     * replicava o PÃO, esticando a coroa dele numa coluna clara que atravessava a
     * margem inteira até o alto da tela. O cliente descreveu como "um feixo de
     * luz gigante em cima do pão". Medido no pior quadro: a linha 2 do terço
     * central marcava 150 de luminância média, pico 250, contra 45-60 do fundo.
     *
     * Por isso topo e base são PINTADOS com a cor do fundo, amostrada do próprio
     * take. O pão continua vindo decepado do gerador — isso é o material, e não
     * tem conserto aqui —, mas ao menos deixa de ser amplificado num pilar.
     *
     * Duas cores, e não uma: o fundo tem gradiente vertical (medido 51 no alto e
     * 88 embaixo, no vertical), e pintar tudo do mesmo tom criaria uma emenda
     * onde antes não havia.
     */
    // A ordem importa: primeiro abre a margem LATERAL e a preenche por smear,
    // depois abre a vertical e a PINTA. `fillborders` não cria espaço — ele
    // substitui pixels dentro do quadro que já existe.
    `pad=${l}:${fh}:${esq}:0,` +
    `fillborders=left=${esq}:right=${dir}:top=0:bottom=0:mode=smear,` +
    `pad=${l}:${a}:0:${topo}:color=${corTopo},` +
    `drawbox=x=0:y=0:w=${l}:h=${topo}:color=${corTopo}:t=fill,` +
    `drawbox=x=0:y=${a - base}:w=${l}:h=${base}:color=${corBase}:t=fill,` +
    `setsar=1`
  );
};

/**
 * As duas fontes, medidas uma vez: dimensões e a cor do fundo nas duas pontas.
 *
 * A faixa é fina (1,5% da altura) e colada na borda de propósito: a cor precisa
 * ser a do fundo NA ALTURA DA EMENDA, não uma média da região. Quanto mais longe
 * da borda, mais o gradiente do fundo afasta a amostra do valor que interessa.
 */
function descrever(arquivo) {
  const { w, h } = medir(arquivo);
  const faixaH = Math.max(2, Math.round(h * 0.015));
  return {
    w, h,
    corTopo: corDoFundoNaBorda(arquivo, w, 0, faixaH),
    corBase: corDoFundoNaBorda(arquivo, w, h - faixaH, faixaH),
  };
}

const FONTE = {
  larga: descrever(ORIGEM_LARGA),
  vertical: descrever(ORIGEM_VERTICAL),
};

/**
 * O crf sobe em relação ao material antigo porque boa parte do quadro agora é
 * fundo liso escuro — área lisa comprime de graça, e o mesmo artefato ocupa
 * proporcionalmente menos da tela num quadro maior.
 */
const VARIANTES = [
  {
    origem: 'larga',
    nome: 'burger-stack-16x9.mp4',
    vf: compor(FONTE.larga, LARGA.largura, LARGA.altura, RECUO),
    crf: '37',
    nivel: '4.2',
    para: 'desktop — 2:1 composto, margem lateral para o cover cortar',
  },
  {
    origem: 'vertical',
    nome: 'burger-stack-vertical.mp4',
    vf: compor(FONTE.vertical, CELULAR.largura, CELULAR.altura, RECUO_VERTICAL, DESLOC_PRODUTO_VERTICAL),
    crf: '38',
    nivel: '4.2',
    para: 'celular — 9:16 composto, margem em volta',
  },
];

/**
 * Os posters acompanham o vídeo que substituem — mesma resolução E mesma
 * composição.
 *
 * Sob prefers-reduced-motion o poster é a cena inteira. Se ele tivesse outro
 * enquadramento, quem pediu menos movimento veria um quadro que ninguém mais vê.
 */
const POSTERS = [
  { origem: 'larga', nome: 'burger-stack-poster-16x9.webp', vf: compor(FONTE.larga, LARGA.largura, LARGA.altura, RECUO) },
  { origem: 'vertical', nome: 'burger-stack-poster-vertical.webp', vf: compor(FONTE.vertical, CELULAR.largura, CELULAR.altura, RECUO_VERTICAL, DESLOC_PRODUTO_VERTICAL) },
];

function ff(args) {
  execFileSync('ffmpeg', ['-v', 'error', '-y', ...args], { stdio: 'inherit' });
}

const kb = (p) => `${(statSync(p).size / 1024).toFixed(0)} kB`;

mkdirSync(DESTINO, { recursive: true });

/**
 * Passo 1 — reverter e tirar o áudio, em qualidade quase-fonte.
 *
 * As variantes saem DAQUI e não do original: reverter uma vez por formato evita
 * que o vídeo e o poster do mesmo formato divirjam num quadro por arredondamento
 * de timestamp — o poster é extraído do fim deste arquivo, não do original.
 */
const REVERTIDOS = {
  larga: resolve(RAIZ, 'assets/raw/rev-16x9.mp4'),
  vertical: resolve(RAIZ, 'assets/raw/rev-vertical.mp4'),
};

for (const [chave, origem] of [['larga', ORIGEM_LARGA], ['vertical', ORIGEM_VERTICAL]]) {
  console.log(`revertendo ${origem} …`);
  ff(['-i', origem, '-an', '-vf', 'reverse', '-c:v', 'libx264', '-preset', 'medium',
      '-crf', '14', '-pix_fmt', 'yuv420p', REVERTIDOS[chave]]);
}

for (const v of VARIANTES) {
  const saida = resolve(DESTINO, v.nome);
  console.log(`encodando ${v.nome} (${v.para}) …`);
  ff(['-i', REVERTIDOS[v.origem], '-an', '-vf', v.vf, ...SEEKAVEL, '-crf', v.crf, '-level', v.nivel, saida]);
  console.log(`   ${v.nome}: ${kb(saida)}`);
}

/**
 * Os posters são o ÚLTIMO quadro do vídeo revertido — o hambúrguer montado.
 *
 * Não é um poster de carregamento: é o estado de repouso da cena. Sob
 * prefers-reduced-motion e sem JS, é a única coisa que existe nesta seção, e o
 * storyboard exige que toda cena mostre o produto inteiro, nunca peças soltas.
 * Pegar o primeiro quadro entregaria exatamente o oposto.
 */
for (const p of POSTERS) {
  const saida = resolve(DESTINO, p.nome);
  console.log(`gerando ${p.nome} (último quadro = hambúrguer montado) …`);
  ff(['-sseof', '-0.1', '-i', REVERTIDOS[p.origem], '-frames:v', '1', '-vf', p.vf, '-q:v', '78', saida]);
  console.log(`   ${p.nome}: ${kb(saida)}`);
}

// A duracao nao diz nada sobre faststart: ela sai igual com o moov no fim. O
// que se quer verificar e a ORDEM dos atomos — moov antes de mdat, senao o
// browser espera o arquivo inteiro antes do primeiro quadro.
console.log('\npronto. Confira o faststart com:');
console.log(
  `   ffprobe -v trace -i ${resolve(DESTINO, VARIANTES[0].nome)} 2>&1 | grep -m 2 -E "type:'(moov|mdat)'"`
);
console.log('   o moov precisa aparecer ANTES do mdat.');
