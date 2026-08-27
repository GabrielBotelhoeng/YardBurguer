/**
 * O selo de aberto/fechado diz a verdade em qualquer hora e em qualquer fuso?
 *
 * Onze instantes fixos, escritos em UTC e conferidos contra o dia da semana
 * real. Instante fixo e nao `new Date()` porque um teste que depende de quando
 * roda passa de manha e falha a noite.
 *
 * OS CASOS QUE IMPORTAM, e por que cada um esta aqui:
 *
 *   SEGUNDA em qualquer hora  a casa fecha, e segunda nao esta na lista de
 *                             dias. Se este caso disser "aberto", o codigo
 *                             esta lendo a lista errada.
 *   17h59 contra 18h00        a fronteira de abrir, no minuto.
 *   23h19 contra 23h20        a de fechar. 23h19 ainda e "fecha em 1 min".
 *   DOMINGO 23h30             o unico caso que exige PULAR um dia: o proximo
 *                             dia aberto e terca, nao segunda.
 *
 * O FUSO NAO E TESTAVEL AQUI. Este arquivo roda em Node, que usa o fuso da
 * maquina; no Windows a variavel TZ e ignorada, entao um teste de fuso daria
 * verde sem provar nada. A prova do fuso e feita no browser, com
 * `timezoneId` do Playwright — e ela e obrigatoria, porque o defeito que ela
 * pega (visitante fora do Brasil vendo "aberto" na hora errada) e silencioso.
 *
 * Uso: node squads/yard-burguer-squad/scripts/verificar-estado-loja.mjs
 * Sai com codigo 1 se algum caso falhar.
 */
import { calcularEstado } from '../../../src/scripts/estado-loja.mjs';
const horario = { abre: '18:00', fecha: '23:20', dias: ['Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'] };
const textos = { aberto:'Aberto agora', fechado:'Fechado agora', abertoAte:'fecha às {hora}', abreHoje:'abre hoje às {hora}', abreDia:'abre {dia} às {hora}', fechaEmBreve:'fecha em {min} min' };
const preencher = (m,v) => m.replace(/\{(\w+)\}/g,(i,k)=>v[k]??i);
const frase = (r) => r.chave ? `${r.aberto?textos.aberto:textos.fechado} — ${preencher(textos[r.chave], r.valores)}` : '(sem texto)';

// UTC nos instantes; Rio Verde e UTC-3. Dias conferidos com Intl.
const CASOS = [
  ['2026-08-24T20:00:00Z', 'SEGUNDA 17h  (casa fecha)',        'Fechado agora — abre terça às 18h'],
  ['2026-08-24T23:00:00Z', 'SEGUNDA 20h  (fecha mesmo assim)', 'Fechado agora — abre terça às 18h'],
  ['2026-08-25T15:00:00Z', 'terca 12h    (antes de abrir)',    'Fechado agora — abre hoje às 18h'],
  ['2026-08-25T20:59:00Z', 'terca 17h59  (1 min antes)',       'Fechado agora — abre hoje às 18h'],
  ['2026-08-25T21:00:00Z', 'terca 18h00  (abre)',              'Aberto agora — fecha às 23h20'],
  ['2026-08-26T01:00:00Z', 'terca 22h00',                      'Aberto agora — fecha às 23h20'],
  ['2026-08-26T02:00:00Z', 'terca 23h00  (fecha em 20)',       'Aberto agora — fecha em 20 min'],
  ['2026-08-26T02:19:00Z', 'terca 23h19  (ultimo minuto)',     'Aberto agora — fecha em 1 min'],
  ['2026-08-26T02:20:00Z', 'terca 23h20  (fechou)',            'Fechado agora — abre quarta às 18h'],
  ['2026-08-31T02:30:00Z', 'DOMINGO 23h30 (pula a segunda)',   'Fechado agora — abre terça às 18h'],
  ['2026-08-30T15:00:00Z', 'domingo 12h',                      'Fechado agora — abre hoje às 18h'],
];
let falhas = 0;
for (const [iso, rotulo, esperado] of CASOS) {
  const obtido = frase(calcularEstado(horario, new Date(iso)));
  const ok = obtido === esperado;
  if (!ok) falhas++;
  console.log((ok ? '  ok  ' : '  FALHA ') + rotulo.padEnd(32), '->', obtido, ok ? '' : `\n         esperado: ${esperado}`);
}
console.log('\nfuso da MAQUINA =', Intl.DateTimeFormat().resolvedOptions().timeZone);
console.log('terca 22h em Rio Verde ->', frase(calcularEstado(horario, new Date('2026-08-26T01:00:00Z'))));
console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTODOS OS 11 CASOS PASSAM');
process.exit(falhas ? 1 : 0);
