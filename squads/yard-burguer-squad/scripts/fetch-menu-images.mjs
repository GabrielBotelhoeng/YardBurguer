#!/usr/bin/env node
/**
 * Coleta as fotos de produto do CDN do Brendi — task optimize-image-pipeline.
 *
 * Por que baixar em vez de dar hotlink no CDN deles:
 *   1. hotlink de terceiro é dependência que quebra sem aviso e sem nosso controle;
 *   2. cada request para outro domínio custa DNS + TLS no 4G do interior, que é
 *      exatamente o cenário que o @mobile-performance-guardian protege;
 *   3. servindo do mesmo host as fotos entram no cache do site e no preload.
 *
 * O CDN só entrega 240x240 em WebP (~9kb). Não existe rota de resolução maior —
 * testado: /{id}, /original/{id}, /large/{id} e ?w= todos dão 404 ou ignoram.
 * Por isso o layout usa a foto em tamanho contido, onde 240px ainda fica nítido
 * em tela retina. Foto grande de verdade (hero) depende de material do dono.
 *
 * Uso: node squads/yard-burguer-squad/scripts/fetch-menu-images.mjs
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import sharp from 'sharp';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const CDN = 'https://images.brendi.com.br/optimized';
const destino = join(raiz, 'public', 'assets', 'produtos');

/**
 * Só as seções que a landing realmente renderiza. Bebida não vira foto na
 * página.
 *
 * `burgers` entrou em 2026-09-02, quando o carrossel deixou de mostrar três
 * itens e passou a mostrar o cardápio de hambúrguer inteiro. São 8 fotos a
 * mais — o peso disso está medido em `docs/mobile-audit.md`, e é a razão de
 * cada uma nascer em 480px e não maior.
 */
const SECOES_USADAS = ['destaques', 'combos', 'burgers'];

/**
 * QUEM JÁ TEM FOTO PRÓPRIA NÃO É TOCADO POR ESTE SCRIPT.
 *
 * Os três destaques receberam material do cliente em 31/08 (640x800, recortado
 * em 4/5 — ver `assets/prompts.md`). Sem esta guarda, rodar o coletor
 * SOBRESCREVE essas fotos pela miniatura de 240px do delivery, silenciosamente
 * e com nome de arquivo idêntico. O commit `a18923a` existe exatamente para
 * tirar a miniatura do delivery desses três cards; recolocá-la por descuido de
 * script seria desfazer trabalho aprovado.
 *
 * `open-crysp` entrou nesta lista por um segundo motivo, e ele é útil saber: o
 * `imageId` dele em `menu.json` responde **404** no CDN desde 2026-09-02 (o
 * Brendi trocou o id). A foto dele veio da quinta PNG do material do cliente,
 * que estava sobrando — a mesma que o log de 31/08 identificou como "Open
 * Crysp" e deixou de fora por não haver card para ela.
 *
 * Se um dia a foto própria de um deles for descartada, tire o id daqui — a
 * decisão é de quem apaga o arquivo, não deste script.
 */
const COM_FOTO_PROPRIA = new Set(['tapera-do-sertao', 'supremo', 'yard-king', 'open-crysp']);

/**
 * CADA SEÇÃO PEDE UM TAMANHO, E O TAMANHO SAI DA TELA — NÃO DO GOSTO.
 *
 * Medido em 390x844 com DPR3, que é o aparelho do público desta página:
 *
 *   - card do carrossel: 287 CSS px de largura → 861px físicos;
 *   - foto de combo: 76 a 88 CSS px → no máximo 264px físicos.
 *
 * Servir 400px para uma foto que a tela exibe em 264 é pagar 51% de área a
 * mais para jogar fora na hora do desenho. 280 cobre o pior caso com folga de
 * 6% e devolve ~30 kB ao orçamento — que, com onze cards no carrossel, virou o
 * recurso escasso desta página.
 *
 * Os burgers do carrossel ficam em 400 e não em 861 por um motivo diferente: a
 * FONTE do CDN tem 240px. Nenhum número aqui alcança a tela, porque o teto é o
 * original — 400 já é ampliação, e ampliar mais só engorda o arquivo.
 */
const LARGURA_POR_SECAO = { destaques: 400, burgers: 400, combos: 280 };

async function baixar(item) {
  const url = `${CDN}/${item.imageId}`;
  const resposta = await fetch(url);

  if (!resposta.ok) {
    throw new Error(`${item.id}: HTTP ${resposta.status} em ${url}`);
  }

  const tipo = resposta.headers.get('content-type') ?? '';
  if (!tipo.startsWith('image/')) {
    throw new Error(`${item.id}: esperava imagem, veio "${tipo}"`);
  }

  const bytes = Buffer.from(await resposta.arrayBuffer());

  /**
   * Reamostragem para 400px, e EM DOIS FORMATOS.
   *
   * O CDN so entrega 240x240, e a 240 os cards ficavam com foto minuscula ou
   * borrada — a secao inteira lia como lista de delivery. Reamostrar com
   * lanczos3 e uma leve mascara de nitidez nao INVENTA detalhe (isso seria
   * trabalho de modelo generativo, e a regra do brand-art-director e clara:
   * foto de produto e do burger real). O que ganha e a transicao entre pixels.
   *
   * ERA 480px E VIROU 400. O card pede 865-954px fisicos num aparelho DPR3, e a
   * FONTE tem 240: nenhum numero aqui alcanca a tela, porque o teto e o
   * original. Entre 480 e 400 a diferenca visivel e nula — os dois sao
   * ampliacao da mesma imagem — e 400 devolve peso ao orcamento, que com onze
   * cards no carrossel passou a ser o recurso escasso.
   *
   * O AVIF sai junto porque nestas fotos ele ganha feio: medido, 9.049 bytes
   * contra 14.060 do webp na mesma imagem (64%). Ganha justamente por serem
   * reamostragens suaves, com pouco detalhe fino. Nas fotos proprias do cliente,
   * que nascem grandes, o AVIF empata ou perde — por isso ELAS continuam so em
   * webp, e o componente serve `<picture>` com o avif apenas onde ele existe.
   */
  const base = sharp(bytes).resize({ width: LARGURA_POR_SECAO[item._secao], kernel: 'lanczos3' }).sharpen({ sigma: 0.6 });

  const webp = await base.clone().webp({ quality: 82, effort: 6 }).toBuffer();
  const avif = await base.clone().avif({ quality: 56, effort: 5 }).toBuffer();

  await writeFile(join(destino, `${item.id}.webp`), webp);
  await writeFile(join(destino, `${item.id}.avif`), avif);

  return { id: item.id, kb: +(avif.length / 1024).toFixed(1), webpKb: +(webp.length / 1024).toFixed(1) };
}

async function main() {
  const menu = JSON.parse(await readFile(join(raiz, 'src', 'content', 'menu.json'), 'utf8'));
  const itens = SECOES_USADAS.flatMap((secao) =>
    (menu[secao] ?? []).map((item) => ({ ...item, _secao: secao }))
  ).filter((item) => {
    if (COM_FOTO_PROPRIA.has(item.id)) {
      console.log(`  pula ${item.id.padEnd(20)} foto própria do cliente, não sobrescrever`);
      return false;
    }
    return true;
  });

  await mkdir(destino, { recursive: true });

  const resultados = await Promise.allSettled(itens.map(baixar));

  let total = 0;
  const falhas = [];

  resultados.forEach((resultado, i) => {
    if (resultado.status === 'fulfilled') {
      total += resultado.value.kb;
      console.log(
        `  ok   ${resultado.value.id.padEnd(20)} avif ${resultado.value.kb} kb  (webp ${resultado.value.webpKb} kb)`
      );
    } else {
      falhas.push(itens[i].id);
      console.error(`  FALHA ${itens[i].id}: ${resultado.reason.message}`);
    }
  });

  console.log(`\n${itens.length - falhas.length}/${itens.length} imagens · ${total.toFixed(1)} kb total`);

  if (falhas.length) {
    console.error(
      `\nFalharam: ${falhas.join(', ')}\n` +
        'O CDN pode ter trocado o id. Reveja o cardápio e atualize imageId em menu.json.'
    );
    process.exitCode = 1;
  }
}

main().catch((erro) => {
  console.error(`Falha ao coletar imagens: ${erro.message}`);
  process.exitCode = 1;
});
