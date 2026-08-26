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
 * primeira tentativa (mp4 não carrega canal alpha; o xadrez virava pixel). Isso
 * é o que torna a composição abaixo praticamente invisível: borrar um fundo liso
 * devolve o mesmo fundo liso.
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
 * A saída de cada formato é então composta: o take inteiro (nunca cortado) sobre
 * uma cópia dele mesmo ampliada e desfocada, que preenche o que falta. O corte
 * do `cover` passa a cair no preenchimento antes de chegar ao produto.
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

const LARGA = { largura: 1600, altura: 800 };   // 2:1 — ver "DESKTOP" acima
const CELULAR = { largura: 640, altura: 1138 }; // 9:16 nativo do take

/**
 * Compõe [fundo desfocado] + [take inteiro centrado] no tamanho pedido.
 *
 * `escala` diz quanto do quadro o take ocupa. `contain` no primeiro plano
 * garante que ele entra INTEIRO — é a linha que torna decepar o pão um estado
 * impossível de representar, e não um bug que se conserta.
 *
 * `setsar=1` em cada etapa NÃO é decoração. `scale` reconcilia DAR mexendo no
 * sample aspect ratio em vez das dimensões, e um encode anterior saiu 640x1388
 * com SAR 4511:2880 — o browser exibia como 1002x1388, proporção 0,72 em vez de
 * 0,46. O ffprobe de width/height mostra o número certo; é o SAR que mente.
 */
const compor = (l, a, escala = 1) => {
  const fl = Math.round((l * escala) / 2) * 2;
  const fa = Math.round((a * escala) / 2) * 2;
  return (
    `split[a][b];` +
    // O fundo COBRE preservando a proporção e depois é cortado — nunca esticado.
    // `scale=l:a` puro deformava o take, então o que ficava encostado na borda do
    // primeiro plano não era a mesma coisa que estava atrás dele, e a emenda
    // aparecia como um degrau reto atravessando a tela.
    `[a]scale=${l}:${a}:force_original_aspect_ratio=increase,crop=${l}:${a},setsar=1,` +
    // -0.06 e não -0.15: escurecer demais era metade do degrau. O bastante para o
    // fundo recuar e o hambúrguer continuar sendo o assunto, sem virar faixa.
    `gblur=sigma=30,eq=brightness=-0.06[bg];` +
    // O FEATHER — sem ele a composição não engana ninguém. `overlay` cola o
    // primeiro plano com alfa 1 até a última linha, então por mais que fundo e
    // frente combinem de cor, a emenda ainda é uma reta perfeita atravessando a
    // tela — e olho humano acha reta perfeita em qualquer lugar. A rampa de 60px
    // nas quatro bordas faz a transição deixar de existir como linha.
    `[b]scale=${fl}:${fa}:force_original_aspect_ratio=decrease,setsar=1,format=rgba,` +
    `geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':` +
    `a='255*min(1,min(min(X,W-X),min(Y,H-Y))/60)'[fg];` +
    `[bg][fg]overlay=(W-w)/2:(H-h)/2:format=auto,setsar=1`
  );
};

/**
 * O crf sobe em relação ao material antigo porque boa parte do quadro agora é
 * fundo liso escuro e borrão — área lisa comprime de graça, e o mesmo artefato
 * ocupa proporcionalmente menos da tela num quadro maior.
 */
const VARIANTES = [
  {
    origem: 'larga',
    nome: 'burger-stack-16x9.mp4',
    vf: compor(LARGA.largura, LARGA.altura, RECUO),
    crf: '33',
    nivel: '4.2',
    para: 'desktop — 2:1 composto, margem lateral para o cover cortar',
  },
  {
    origem: 'vertical',
    nome: 'burger-stack-vertical.mp4',
    vf: compor(CELULAR.largura, CELULAR.altura, RECUO),
    crf: '34',
    nivel: '4.0',
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
  { origem: 'larga', nome: 'burger-stack-poster-16x9.webp', vf: compor(LARGA.largura, LARGA.altura, RECUO) },
  { origem: 'vertical', nome: 'burger-stack-poster-vertical.webp', vf: compor(CELULAR.largura, CELULAR.altura, RECUO) },
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

console.log('\npronto. Confira o faststart com:');
console.log(`   ffprobe -v error -show_entries format=duration -of default=nw=1 ${resolve(DESTINO, VARIANTES[0].nome)}`);
