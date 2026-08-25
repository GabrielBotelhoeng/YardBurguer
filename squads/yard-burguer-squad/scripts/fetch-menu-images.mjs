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

/** Só as seções que a landing realmente renderiza. Bebida não vira foto na página. */
const SECOES_USADAS = ['destaques', 'combos'];

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
   * Reamostragem para 480px.
   *
   * O CDN so entrega 240x240, e a 240 os cards ficavam com foto minuscula ou
   * borrada — a secao inteira lia como lista de delivery. Dobrar com lanczos3 e
   * uma leve mascara de nitidez nao INVENTA detalhe (isso seria trabalho de
   * modelo generativo, e a regra do brand-art-director e clara: foto de produto
   * e do burger real). O que ganha e a transicao entre pixels: a foto para de
   * parecer pixelada quando exibida maior.
   *
   * O limite continua sendo o original. Se um dia houver foto em alta do dono,
   * isto some e a foto real entra direto.
   */
  const tratada = await sharp(bytes)
    .resize({ width: 480, kernel: 'lanczos3' })
    .sharpen({ sigma: 0.6 })
    .webp({ quality: 84, effort: 6 })
    .toBuffer();

  const arquivo = join(destino, `${item.id}.webp`);
  await writeFile(arquivo, tratada);

  return { id: item.id, kb: +(tratada.length / 1024).toFixed(1) };
}

async function main() {
  const menu = JSON.parse(await readFile(join(raiz, 'src', 'content', 'menu.json'), 'utf8'));
  const itens = SECOES_USADAS.flatMap((secao) => menu[secao] ?? []);

  await mkdir(destino, { recursive: true });

  const resultados = await Promise.allSettled(itens.map(baixar));

  let total = 0;
  const falhas = [];

  resultados.forEach((resultado, i) => {
    if (resultado.status === 'fulfilled') {
      total += resultado.value.kb;
      console.log(`  ok   ${resultado.value.id.padEnd(20)} ${resultado.value.kb} kb`);
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
