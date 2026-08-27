/**
 * "Aberto agora" — e por que ele não pode ser renderizado no build.
 *
 * A página é estática: um selo calculado no build congelaria, e às três da
 * manhã diria "aberto agora" para quem quer pedir. Só o cliente sabe que horas
 * são, então o cálculo é dele.
 *
 * O FUSO É O DA LOJA, NUNCA O DO VISITANTE. `new Date().getHours()` responde a
 * pergunta errada: alguém em Portugal olhando a página às 22h de lá veria
 * "aberto" às 18h de Rio Verde, e alguém no Acre veria "fechado" com a casa
 * cheia. Toda leitura de hora passa por America/Sao_Paulo — inclusive a do dia
 * da semana, que vira quando o relógio local ainda não virou.
 *
 * SEGUNDA-FEIRA NÃO ESTÁ NA LISTA DE DIAS de propósito: a casa fecha, e a
 * ausência é o dado (ver marca.horario._segunda). Este módulo não sabe nada de
 * segunda; ele só sabe procurar o próximo dia que existe na lista.
 *
 * Assume que o expediente não cruza a meia-noite — hoje fecha 23h20, e cruzar
 * exigiria comparar contra o dia anterior. Se um dia virar 01h, é ESTA premissa
 * que quebra, e é aqui que se mexe.
 */

const FUSO = 'America/Sao_Paulo';

const DIAS_PT = {
  Sunday: 'domingo',
  Monday: 'segunda',
  Tuesday: 'terça',
  Wednesday: 'quarta',
  Thursday: 'quinta',
  Friday: 'sexta',
  Saturday: 'sábado',
};
const ORDEM = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Minutos desde a meia-noite, de "HH:MM". */
const emMinutos = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/** "18:00" -> "18h"; "23:20" -> "23h20". Como se fala, não como se armazena. */
const paraLeitura = (hhmm) => {
  const [h, m] = hhmm.split(':');
  return Number(m) === 0 ? `${Number(h)}h` : `${Number(h)}h${m}`;
};

/**
 * Hora e dia da semana NA LOJA. `en-US` fixo porque o que sai daqui é chave de
 * lookup (`Tuesday`), não texto de tela — traduzir aqui quebraria a comparação
 * com marca.horario.dias no aparelho de quem tem o sistema em outro idioma.
 */
function agoraNaLoja(quando = new Date()) {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: FUSO,
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(quando);

  const pegar = (tipo) => partes.find((p) => p.type === tipo)?.value ?? '';
  // 24 aparece no lugar de 00 em algumas implementações de hourCycle.
  const hora = Number(pegar('hour')) % 24;
  return { dia: pegar('weekday'), minutos: hora * 60 + Number(pegar('minute')) };
}

/**
 * @returns {{aberto: boolean, chave: string, valores: object}} o estado e os
 * dados para preencher o molde da copy — o texto em si mora no copy.json.
 */
export function calcularEstado(horario, quando = new Date()) {
  const { dia, minutos } = agoraNaLoja(quando);
  const abre = emMinutos(horario.abre);
  const fecha = emMinutos(horario.fecha);
  const hojeAbre = horario.dias.includes(dia);

  if (hojeAbre && minutos >= abre && minutos < fecha) {
    const faltam = fecha - minutos;
    // Meia hora é o limite em que "fecha às 23h20" deixa de ser informação e
    // vira armadilha: dá tempo de escolher, não de receber.
    return faltam <= 30
      ? { aberto: true, chave: 'fechaEmBreve', valores: { min: String(faltam) } }
      : { aberto: true, chave: 'abertoAte', valores: { hora: paraLeitura(horario.fecha) } };
  }

  if (hojeAbre && minutos < abre) {
    return { aberto: false, chave: 'abreHoje', valores: { hora: paraLeitura(horario.abre) } };
  }

  // Fechado: procura o próximo dia da lista, começando por amanhã. Sete voltas
  // sempre bastam, e se a lista estiver vazia devolve fechado sem promessa.
  const hoje = ORDEM.indexOf(dia);
  for (let i = 1; i <= 7; i++) {
    const candidato = ORDEM[(hoje + i) % 7];
    if (!horario.dias.includes(candidato)) continue;
    return {
      aberto: false,
      chave: 'abreDia',
      valores: { dia: DIAS_PT[candidato], hora: paraLeitura(horario.abre) },
    };
  }
  return { aberto: false, chave: null, valores: {} };
}

/** Preenche {hora}, {dia} e {min} no molde vindo da copy. */
const preencher = (molde, valores) =>
  molde.replace(/\{(\w+)\}/g, (inteiro, chave) => valores[chave] ?? inteiro);

export function initEstadoLoja({ horario, textos }) {
  const alvo = document.querySelector('[data-estado]');
  if (!alvo) return;

  const pintar = () => {
    const { aberto, chave, valores } = calcularEstado(horario);
    if (!chave) return;

    alvo.hidden = false;
    alvo.dataset.aberto = String(aberto);
    alvo.textContent = `${aberto ? textos.aberto : textos.fechado} — ${preencher(textos[chave], valores)}`;
  };

  pintar();
  // Um minuto: o selo precisa virar sozinho para quem deixa a aba aberta
  // esperando as 18h — que é exatamente o público com mais intenção de pedir.
  setInterval(pintar, 60_000);
  // Aba que volta do segundo plano pode ter perdido vários ticks.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') pintar();
  });
}
