/**
 * Encoda o take do cliente para a Cena 2 em vídeo (scroll-scrubbed).
 *
 * Receita escrita em comentário não reproduz nada. Se o cliente mandar um take
 * novo, é este arquivo que roda — não uma linha de ffmpeg colada de um relatório
 * antigo.
 *
 * Uso:
 *   node encodar-video-cena2.mjs [caminho-do-take]
 *   (padrão: assets/raw/burger-stack-original.mp4)
 *
 * Requer ffmpeg no PATH. Instalado neste projeto via:
 *   winget install --id Gyan.FFmpeg -e
 *
 * ---------------------------------------------------------------------------
 * AS QUATRO DECISÕES DO ENCODE, E O QUE CADA UMA CUSTA
 * ---------------------------------------------------------------------------
 *
 * 1. REVERSE — o take vai de montado para explodido; o storyboard pede o
 *    contrário desde 2026-08-25 ("o ato de construir é o que dá fome"). Inverter
 *    aqui e não no runtime não é preferência: rolar `currentTime` para trás
 *    obriga o decodificador a partir do keyframe anterior e descartar tudo à
 *    frente, a cada quadro. Invertido no arquivo, rolar para baixo é avançar no
 *    tempo — o único sentido para o qual todo decodificador é otimizado.
 *
 * 2. FASTSTART — o take original traz o átomo `moov` DEPOIS do `mdat`. Sem o
 *    índice no começo, o browser não consegue buscar antes de baixar quase o
 *    arquivo inteiro, e é isso que mata o scrubbing em conexão lenta. Verificado
 *    no resultado: `moov` no byte 36.
 *
 * 3. GOP CURTO — o original tem UM keyframe, no quadro 0. Buscar o segundo 9
 *    exigiria decodificar 239 quadros. Com `-g 12` (a cada 0,5s a 24fps) o pior
 *    caso vira 11 quadros. Medido o que isso custa em bytes, a 960x540 crf30:
 *      g=48 (2,0s) → 500 kB    g=24 (1,0s) → 594 kB
 *      g=12 (0,5s) → 786 kB    g=6  (0,25s) → 1160 kB
 *    Ou seja: seekability custa 57% a mais de arquivo entre g=48 e g=12. Pagamos
 *    porque cena que trava ao buscar não é cena.
 *
 * 4. SEM B-FRAMES (`-bf 0 -refs 1`) — quadro B depende de um quadro futuro. Num
 *    vídeo que só toca, isso é compressão de graça; num vídeo que é BUSCADO
 *    quadro a quadro, é trabalho extra em cada seek.
 *
 * NÃO usamos fps menor: testado 24, 15 e 12 fps e o arquivo NÃO encolheu (12fps
 * chegou a ficar maior). Com GOP fixo em segundos, os keyframes dominam o
 * bitrate e cortar fps só remove os quadros P baratos. 24fps é de graça.
 *
 * NÃO usamos WebM/VP9: testado a 960x540 com o mesmo GOP, o VP9 PERDEU do
 * x264 (crf42 → 875 kB contra 786 kB do x264 crf30, com qualidade pior). Com
 * keyframe forçado a cada 0,5s o VP9 não tem onde exercer a vantagem dele. Um
 * `<source>` a mais só teria custado complexidade.
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, '../../..');

const ORIGEM = process.argv[2] ?? resolve(RAIZ, 'assets/raw/burger-stack-original.mp4');
const DESTINO = resolve(RAIZ, 'public/assets/video');
const TEMP = resolve(RAIZ, 'assets/raw/burger-stack-revertido.mp4');

/**
 * Parâmetros comuns aos dois cortes. O que muda entre desktop e mobile é só
 * geometria — a mecânica de seek precisa ser idêntica, senão um device teria um
 * comportamento de scrub que o outro não tem e o bug seria irreprodutível.
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
 * A RESOLUÇÃO SAI DO TAMANHO DE EXIBIÇÃO, NÃO DE UM NÚMERO REDONDO.
 *
 * O 16:9 era 960x540 e estava certo enquanto o palco tinha 736px de largura: o
 * arquivo era REDUZIDO 0,77x na tela, que é o regime em que vídeo parece nítido.
 * A cena virou full-bleed em 2026-08-26 e o palco passou a exibir 1465px em
 * 1440x900 e 1785px em 1920x1080 — o mesmo arquivo passou a ser ESTICADO 1,86x,
 * e junto com ele os artefatos de um bitrate de 482 kbps.
 *
 * Medido aqui (240 quadros, mesmo GOP, mesmo preset — só a geometria mudou):
 *
 *   960x540  crf32 →  591 kB   estica 1,86x em 1920   (o que havia)
 *   1280x720 crf34 →  707 kB   estica 1,39x
 *   1600x900 crf33 → 1102 kB   estica 1,12x           ← escolhido
 *   1920x1080 crf34 → 1356 kB  reduz 0,93x (nativo)
 *
 * 1600x900 é onde a curva vira: leva o upscale para 1,12x — abaixo do limiar em
 * que se enxerga — e em 1440x900 já volta a ser redução. O 1080p nativo custaria
 * 254 kB a mais para comprar 0,19x de escala que ninguém vê. O crf sobe de 32
 * para 33 porque quadro maior perdoa mais compressão: o mesmo artefato ocupa
 * proporcionalmente menos da tela.
 *
 * O celular tem a sua própria conta, logo abaixo.
 */

/**
 * O CELULAR DEIXOU DE SER QUADRADO (2026-08-26).
 *
 * O corte 1:1 era honesto e ainda assim ficava feio: um quadrado de 468x468
 * parado no meio de uma tela de 390x844, com carvão liso ocupando o resto. O
 * cliente descreveu como "esse quadrado na tela do mobile acaba ficando muito
 * feio", e tinha razão — a cena é full-bleed em toda parte menos justamente
 * onde a maioria das pessoas vai vê-la.
 *
 * Encher a tela CORTANDO não é possível, e vale registrar o número: a tela é
 * 0,46 de proporção, o take é 1,78. Cobrir uma com a outra exigiria uma faixa
 * de 498px de largura do original — e o hambúrguer sozinho tem 780px. Qualquer
 * corte que preencha a altura decepa o pão pelas laterais.
 *
 * Então o quadro é COMPOSTO, não cortado:
 *
 *   crop=780:1080:570:0   isola o hambúrguer com a moldura justa (x 570..1350,
 *                         medido por energia de borda no frame mais espalhado)
 *   [bg] o mesmo recorte ampliado até a tela cheia, desfocado e escurecido
 *   [fg] o recorte na largura real, centrado por cima
 *
 * O hambúrguer passa a ocupar 100% da largura da tela e continua inteiro — o
 * contrato do storyboard segue de pé. O que preenche o resto é o próprio
 * ambiente do take, e como o fundo já é bokeh escuro de balcão, ele funde com o
 * carvão em vez de ler como faixa.
 *
 * Medido: 640x1388 crf35 = 688 kB contra 582 kB do quadrado. 106 kB a mais
 * (+18%) para a cena deixar de ter buraco. O crf pode subir para 35 porque a
 * maior parte do quadro agora é borrão — área lisa comprime de graça, e o teste
 * de textura na carne a 4s não mostrou artefato.
 *
 * 640 de largura para uma tela de 390 CSS px é redução de 1,64x, que é o regime
 * saudável. 720 custaria +132 kB para um ganho que não chega ao olho em banda
 * de celular.
 */
const RECORTE_CELULAR = 'crop=780:1080:570:0';
const CELULAR = { largura: 640, altura: 1388 };

/**
 * Compõe [fundo desfocado] + [recorte nítido centrado] no tamanho pedido.
 *
 * `setsar=1` no fim NÃO é decoração. `crop` preserva o SAR do stream mas muda o
 * DAR, e o `scale` seguinte tenta reconciliar os dois mexendo no SAR em vez das
 * dimensões. Sem forçar, o encode saiu 640x1388 com SAR 4511:2880 — ou seja, um
 * arquivo que o browser exibia como 1002x1388 (proporção 0,72) em vez dos 0,46
 * verticais. Medido no `videoWidth` do DOM: a cena preenchia menos do que devia
 * e ninguém saberia dizer por quê, porque o ffprobe do width/height mostra o
 * número certo. É o SAR que mente.
 */
const comporVertical = (l, a) =>
  `${RECORTE_CELULAR},split[a][b];` +
  // O fundo COBRE preservando a proporção e depois é cortado — nunca esticado.
  // `scale=l:a` puro deformava o recorte 0,72 até 0,46, então o que ficava
  // encostado na borda do primeiro plano não era a mesma coisa que estava atrás
  // dele, e a emenda aparecia como um degrau reto atravessando a tela. Medido no
  // quadro montado, onde o balcão claro do primeiro plano encontrava fundo
  // escuro esticado. Cobrindo e cortando, as duas camadas mostram a mesma região
  // da cena na altura da emenda e ela some.
  `[a]scale=${l}:${a}:force_original_aspect_ratio=increase,crop=${l}:${a},setsar=1,` +
  // -0.06 e não -0.15: escurecer demais era metade do degrau. O bastante para o
  // fundo recuar e o hambúrguer continuar sendo o assunto, sem virar uma faixa.
  `gblur=sigma=30,eq=brightness=-0.06[bg];` +
  /**
   * O FEATHER — sem ele a composição não engana ninguém.
   *
   * `overlay` cola o primeiro plano com alfa 1 até a última linha, então por
   * mais que fundo e frente combinem de cor, a emenda ainda é uma reta perfeita
   * atravessando a tela — e olho humano acha reta perfeita em qualquer lugar.
   * Aparecia com força no quadro montado, onde a borda superior do primeiro
   * plano é balcão claro.
   *
   * A rampa de 90px leva o alfa de 0 a 1 nas bordas de cima e de baixo, e a
   * transição deixa de existir como linha. 90 e não 40: abaixo disso a rampa
   * ainda lê como borda; acima, começa a comer o pão no quadro 0, que encosta
   * na borda do recorte.
   */
  `[b]scale=${l}:-2,setsar=1,format=rgba,` +
  `geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='255*min(1,min(Y,H-Y)/90)'[fg];` +
  `[bg][fg]overlay=(W-w)/2:(H-h)/2:format=auto,setsar=1`;

const VARIANTES = [
  {
    nome: 'burger-stack-16x9.mp4',
    vf: 'scale=1600:900:flags=lanczos',
    crf: '33',
    nivel: '4.2', // 1600x900 passa do teto de macroblocos do 4.0
    para: 'desktop — quadro cheio, 16:9, dimensionado para o palco full-bleed',
  },
  {
    nome: 'burger-stack-vertical.mp4',
    vf: comporVertical(CELULAR.largura, CELULAR.altura),
    crf: '35',
    nivel: '4.0',
    para: 'celular — 9:19,5 composto, o hambúrguer inteiro na largura toda',
  },
];

/**
 * Os posters acompanham o vídeo que substituem — mesma resolução E mesma
 * composição.
 *
 * Sob prefers-reduced-motion o poster é a cena inteira. Se ele fosse o corte
 * quadrado enquanto o vídeo é o vertical composto, quem pediu menos movimento
 * veria um enquadramento que ninguém mais vê — e veria o buraco de carvão que
 * acabamos de fechar.
 */
const POSTERS = [
  { nome: 'burger-stack-poster-16x9.webp', vf: 'scale=1600:900:flags=lanczos' },
  { nome: 'burger-stack-poster-vertical.webp', vf: comporVertical(CELULAR.largura, CELULAR.altura) },
];

function ff(args) {
  execFileSync('ffmpeg', ['-v', 'error', '-y', ...args], { stdio: 'inherit' });
}

const kb = (p) => `${(statSync(p).size / 1024).toFixed(0)} kB`;

mkdirSync(DESTINO, { recursive: true });

// Passo 1 — reverter e tirar o áudio, em qualidade quase-fonte.
// As variantes saem DAQUI e não do original: reverter uma vez só evita que os
// dois cortes divirjam num quadro por arredondamento de timestamp.
console.log(`revertendo ${ORIGEM} …`);
ff(['-i', ORIGEM, '-an', '-vf', 'reverse', '-c:v', 'libx264', '-preset', 'medium', '-crf', '14', '-pix_fmt', 'yuv420p', TEMP]);

for (const v of VARIANTES) {
  const saida = resolve(DESTINO, v.nome);
  console.log(`encodando ${v.nome} (${v.para}) …`);
  ff(['-i', TEMP, '-an', '-vf', v.vf, ...SEEKAVEL, '-crf', v.crf, '-level', v.nivel, saida]);
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
  ff(['-sseof', '-0.1', '-i', TEMP, '-frames:v', '1', '-vf', p.vf, '-q:v', '78', saida]);
  console.log(`   ${p.nome}: ${kb(saida)}`);
}

console.log('\npronto. Confira o faststart com:');
console.log(`   ffprobe -v error -show_entries format=duration -of default=nw=1 ${resolve(DESTINO, VARIANTES[0].nome)}`);
