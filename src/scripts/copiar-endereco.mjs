/**
 * Copiar o endereço — e por que o botão não pode nascer no HTML.
 *
 * Quem lê a seção "Onde a gente fica" no celular quase nunca quer ler: quer
 * levar o endereço para o app de mapa, para o motoboy, para o grupo da família.
 * Hoje isso é seleção manual de texto em três linhas com <br> no meio, que no
 * toque é a operação mais frustrante que existe num telefone.
 *
 * O BOTÃO NASCE `hidden` E O SCRIPT O REVELA — mesmo contrato do selo de
 * aberto/fechado logo ao lado. Sem JS, um botão de copiar é um botão que não
 * copia: fica na tela prometendo o que não cumpre. Escondido, o que resta é o
 * endereço escrito, que continua correto e continua selecionável.
 *
 * A ÁREA DE TRANSFERÊNCIA PODE RECUSAR, E RECUSA CALADA.
 * `navigator.clipboard` só existe em contexto seguro (https ou localhost).
 * Numa prévia servida por IP na rede local — exatamente como este site é visto
 * antes de ir ao ar — o objeto existe e o `writeText` REJEITA. Por isso o
 * caminho é try/catch e não um `if (navigator.clipboard)`: a presença da API
 * não é promessa de sucesso. E por isso o aviso de sucesso só é escrito depois
 * da confirmação — botão que diz "copiado" com a área de transferência vazia é
 * pior que botão nenhum, porque o cliente cola o nada e não desconfia.
 */

/** Quanto o aviso fica na tela. Tempo de ler duas palavras, não mais. */
const DURACAO_AVISO = 3200;

/**
 * Plano B para quando a API moderna não está disponível ou foi recusada.
 * `execCommand` é obsoleto e é justamente por isso que ele serve aqui: os
 * navegadores que não têm a API nova são os que ainda o suportam.
 */
function copiarLegado(texto) {
  const area = document.createElement('textarea');
  area.value = texto;
  area.setAttribute('readonly', '');
  // Fora do quadro, mas ainda renderizado: `display: none` não é selecionável,
  // e sem seleção não há cópia. O `top: 0` evita o scroll que o iOS dá quando
  // foca um campo que está longe da viewport.
  area.style.cssText = 'position:fixed;top:0;left:-9999px;opacity:0;';
  document.body.appendChild(area);
  try {
    area.select();
    area.setSelectionRange(0, texto.length);
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    area.remove();
  }
}

/** @returns {Promise<boolean>} se o texto REALMENTE foi para a área de transferência. */
async function copiar(texto) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(texto);
      return true;
    } catch {
      // Contexto inseguro, permissão negada, aba sem foco. Cai no plano B.
    }
  }
  return copiarLegado(texto);
}

/**
 * Quando os dois caminhos falham, sobra devolver o trabalho ao aparelho: o
 * endereço fica selecionado na tela e o menu nativo de "Copiar" resolve em um
 * toque. É a diferença entre um erro e um beco sem saída.
 */
function selecionar(elemento) {
  try {
    const intervalo = document.createRange();
    intervalo.selectNodeContents(elemento);
    const selecao = window.getSelection();
    selecao.removeAllRanges();
    selecao.addRange(intervalo);
  } catch {
    // Seleção é conforto, não requisito. Se falhar, o aviso já explicou.
  }
}

export function initCopiarEndereco() {
  const botao = document.querySelector('[data-copiar-endereco]');
  const aviso = document.querySelector('[data-copiar-aviso]');
  const endereco = botao?.dataset.endereco;
  if (!botao || !endereco) return;

  botao.hidden = false;

  let relogio;
  botao.addEventListener('click', async () => {
    const ok = await copiar(endereco);

    if (!ok) selecionar(document.querySelector('[data-endereco-texto]') ?? botao);

    if (aviso) {
      aviso.dataset.ok = String(ok);
      // O aviso é `aria-live` e já está no DOM desde o primeiro quadro: trocar
      // só o texto é o que faz o leitor de tela anunciar. Inserir a região
      // inteira agora seria mudança que boa parte dos leitores ignora.
      aviso.textContent = ok ? botao.dataset.okTexto : botao.dataset.falhaTexto;
    }

    clearTimeout(relogio);
    relogio = setTimeout(() => {
      if (aviso) {
        aviso.textContent = '';
        delete aviso.dataset.ok;
      }
    }, DURACAO_AVISO);
  });
}
