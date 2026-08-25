#!/usr/bin/env node
/**
 * gemini-image.mjs — geração de asset de imagem via Gemini.
 *
 * Usado por @brand-art-director nas tasks produce-ingredient-layers e
 * harvest/optimize. Lê GEMINI_API_KEY do .env da raiz do projeto.
 *
 * Uso:
 *   node squads/yard-burguer-squad/scripts/gemini-image.mjs \
 *     --prompt "..." --out assets/raw/pao-superior.png [--model gemini-3-pro-image]
 *
 * Nunca imprime a chave. Nunca recebe a chave por argumento.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODEL = 'gemini-3-pro-image';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i]?.replace(/^--/, '');
    if (key) args[key] = argv[i + 1];
  }
  return args;
}

/** Lê GEMINI_API_KEY do ambiente ou do .env na raiz do projeto. */
async function loadApiKey(projectRoot) {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;

  try {
    const env = await readFile(resolve(projectRoot, '.env'), 'utf-8');
    const match = env.match(/^GEMINI_API_KEY=(.+)$/m);
    if (match) return match[1].trim();
  } catch {
    // .env ausente cai no erro abaixo
  }

  throw new Error(
    'GEMINI_API_KEY não encontrada. Defina no .env da raiz do projeto ou no ambiente.'
  );
}

async function generateImage({ prompt, model, apiKey }) {
  const response = await fetch(`${API_BASE}/${model}:generateContent`, {
    method: 'POST',
    headers: {
      'x-goog-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
    }),
  });

  const payload = await response.json();

  if (payload.error) {
    throw new Error(
      `Gemini ${payload.error.code} ${payload.error.status}: ${payload.error.message}`
    );
  }

  const parts = payload.candidates?.[0]?.content?.parts ?? [];
  const image = parts.find((part) => part.inlineData?.data);

  if (!image) {
    const text = parts.find((part) => part.text)?.text;
    throw new Error(
      `Resposta sem imagem${text ? ` — o modelo respondeu: ${text.slice(0, 200)}` : ''}`
    );
  }

  return Buffer.from(image.inlineData.data, 'base64');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.prompt || !args.out) {
    console.error('Uso: --prompt "..." --out caminho/arquivo.png [--model modelo]');
    process.exit(1);
  }

  const projectRoot = resolve(import.meta.dirname, '../../..');
  const model = args.model || DEFAULT_MODEL;

  try {
    const apiKey = await loadApiKey(projectRoot);
    const buffer = await generateImage({ prompt: args.prompt, model, apiKey });

    const outPath = resolve(projectRoot, args.out);
    await mkdir(dirname(outPath), { recursive: true });
    await writeFile(outPath, buffer);

    console.log(`✅ ${args.out} — ${(buffer.length / 1024).toFixed(0)}kb (${model})`);
  } catch (error) {
    console.error(`❌ ${error.message}`);
    process.exit(1);
  }
}

main();
