/**
 * Verificador da AGENDA da Cena 2 (variante em vídeo).
 *
 *   node squads/yard-burguer-squad/scripts/verificar-agenda-cena2.mjs
 *
 * POR QUE ISTO EXISTE. A cena já sangrou uma vez exatamente aqui: o tween do
 * texto começava em 0.86 e durava 0.16, terminando em 1.02. O GSAP não trunca —
 * ele estica a timeline para 1.02, o ScrollTrigger remapeia o trilho inteiro
 * sobre 0→1.02 e o título só fechava DEPOIS que o pin soltava. O defeito era
 * puro erro de soma e não aparecia em nenhum teste: a cena "funcionava".
 *
 * Com cinco paradas, uma marca e um véu de dois níveis, são dezoito marcos numa
 * régua de 0 a 1. Conferir isso no olho é como o 1.02 entrou.
 *
 * O QUE ELE NÃO É. Não é teste do runtime: não abre browser, não roda GSAP, não
 * mede pixel. Ele confere a ARITMÉTICA do agendamento e o piso de contraste.
 * Verificar a cena de verdade rolando continua exigindo olho em aparelho real —
 * e, aviso registrado em 2026-08-26, IntersectionObserver não dispara em aba
 * dirigida por CDP, então automação de browser não substitui isso.
 *
 * ACOPLAMENTO. As constantes abaixo são uma CÓPIA das de
 * src/scripts/video-scrub.js e de VideoScene.astro. Se lá mudar, muda aqui —
 * senão este script passa a aprovar uma agenda que não é a que roda. É a mesma
 * regra que vale entre CONSULTA_CELULAR e o @media do componente.
 */

// Reproduz EXATAMENTE o agendamento de video-scrub.js e verifica as invariantes.
const FIM = 0.94, VEU_PARADAS = 0.82, DUR_VEU = 0.14, DUR_TEXTO = 0.10;
const P_INI = 0.10, P_FIM = 0.78, RAMPA = 0.03, N = 5;
const fatia = (P_FIM - P_INI) / N;

const ev = [];
ev.push(['video',        0,               FIM]);
ev.push(['veu:sobe',     0.04,            0.04 + 0.06]);
ev.push(['veu:fecha',    FIM - DUR_VEU,   FIM]);
ev.push(['marca:acende', 0.06,            0.06 + 0.10]);
ev.push(['marca:scale',  0.06,            0.06 + 0.66]);
ev.push(['marca:apaga',  0.74,            0.74 + 0.06]);
for (let i = 0; i < N; i++) {
  const ent = P_INI + i * fatia;
  ev.push([`parada${i+1}:entra`, ent, ent + RAMPA]);
  ev.push([`parada${i+1}:sai`, ent + fatia - RAMPA, ent + fatia]);
}
ev.push(['titulo',       FIM - DUR_TEXTO, FIM]);
ev.push(['hold',         FIM,             1.0]);

let falhas = 0;
const erro = (m) => { falhas++; console.log('  REPROVA: ' + m); };

console.log('AGENDA (0 = topo do trilho, 1 = fim do pin)');
for (const [n, a, b] of ev) console.log(`  ${n.padEnd(16)} ${a.toFixed(3)} -> ${b.toFixed(3)}`);

console.log('\nINVARIANTES');
// 1. Nada passa de 1.0 — o defeito de 2026-08-26 (tween terminando em 1.02).
const maxFim = Math.max(...ev.map(e => e[2]));
console.log(`  1. nenhum tween passa de 1.0 ..... fim maximo = ${maxFim.toFixed(4)}`);
if (maxFim > 1.0000001) erro('algo termina depois do fim do pin');

// 2. A timeline dura exatamente 1.0 (o hold garante os 6% de recompensa).
if (Math.abs(maxFim - 1.0) > 1e-9) erro('a timeline nao fecha em 1.0');

// 3. Paradas nao se sobrepoem entre si.
for (let i = 0; i < N - 1; i++) {
  const fimI = P_INI + i * fatia + fatia;
  const iniProx = P_INI + (i + 1) * fatia;
  if (fimI > iniProx + 1e-9) erro(`parada${i+1} invade a parada${i+2}`);
}
console.log('  2. paradas nao se sobrepoem entre si ..... ok');

// 4. Nunca ha parada + titulo ao mesmo tempo (a objecao das 3 camadas).
const ultimaParadaFim = P_FIM;
const tituloIni = FIM - DUR_TEXTO;
console.log(`  3. ultima parada acaba em ${ultimaParadaFim.toFixed(2)}, titulo entra em ${tituloIni.toFixed(2)}`);
if (ultimaParadaFim > tituloIni) erro('parada e titulo dividem o quadro');

// 5. Nunca ha marca + titulo ao mesmo tempo.
const marcaFim = 0.74 + 0.06;
console.log(`  4. marca apaga em ${marcaFim.toFixed(2)}, titulo entra em ${tituloIni.toFixed(2)}`);
if (marcaFim > tituloIni) erro('marca e titulo dividem o quadro');

// 6. O veu ja esta em VEU_PARADAS antes da primeira parada aparecer.
const veuPronto = 0.04 + 0.06;
console.log(`  5. veu pronto em ${veuPronto.toFixed(2)}, primeira parada entra em ${P_INI.toFixed(2)}`);
if (veuPronto > P_INI + 1e-9) erro('a primeira parada pousa antes de o veu subir');

// 7. Contraste: o veu na faixa do texto precisa ficar >= 0.650 (areia, AA 4.5:1).
const ALFA_GRADIENTE = 0.86, PISO_AA = 0.650;
const alfaEfetiva = ALFA_GRADIENTE * VEU_PARADAS;
console.log(`  6. alfa na faixa do texto = ${ALFA_GRADIENTE} x ${VEU_PARADAS} = ${alfaEfetiva.toFixed(3)} (piso ${PISO_AA})`);
if (alfaEfetiva < PISO_AA) erro('a legenda reprova AA sobre o pior pixel');

console.log('\nRITMO POR PARADA');
for (const [rot, tela, trilhoPct] of [['celular 390x844', 844, 1.50], ['desktop 1440x900', 900, 2.40]]) {
  const trilho = tela * trilhoPct;
  console.log(`  ${rot.padEnd(18)} trilho ${Math.round(trilho)}px  ->  ${Math.round(fatia * trilho)}px por parada`);
}

console.log(falhas === 0 ? '\nAPROVADO — 6 invariantes' : `\nREPROVADO — ${falhas} falha(s)`);
process.exit(falhas === 0 ? 0 : 1);
