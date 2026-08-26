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
 * O corte 1:1 do mobile parte de x=420 numa fonte 1920x1080: o hambúrguer está
 * centrado e ocupa a faixa central; o que sai são as laterais, que no take são
 * só bokeh do balcão. Enquadrar por object-fit desperdiçaria esses pixels DEPOIS
 * de baixá-los.
 */
const VARIANTES = [
  {
    nome: 'burger-stack-16x9.mp4',
    vf: 'scale=960:540:flags=lanczos',
    crf: '32',
    nivel: '4.0',
    para: 'desktop — quadro cheio, 16:9',
  },
  {
    nome: 'burger-stack-1x1.mp4',
    vf: 'crop=1080:1080:420:0,scale=640:640:flags=lanczos',
    crf: '32',
    nivel: '3.1',
    para: 'mobile — corte quadrado, a cena é vertical no celular',
  },
];

const POSTERS = [
  { nome: 'burger-stack-poster-16x9.webp', vf: 'scale=960:540:flags=lanczos' },
  { nome: 'burger-stack-poster-1x1.webp', vf: 'crop=1080:1080:420:0,scale=640:640:flags=lanczos' },
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
