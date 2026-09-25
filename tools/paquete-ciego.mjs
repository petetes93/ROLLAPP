#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANVEIL · tools/paquete-ciego.mjs
 * ---------------------------------------------------------------------------
 * Evaluación a ciegas de dos narradores sobre las mismas partidas.
 *
 * Toma dos carpetas de transcripciones de `medir-narrador.mjs
 * --transcripciones` (por ejemplo, el procedural y la IA de Groq) y, por cada
 * partida que esté en las dos, las pone como «Versión 1» y «Versión 2» en un
 * orden al azar. Quita las marcas que delatarían cuál es cuál (repeticiones
 * marcadas, contestadas o no) y deja una hoja para puntuar. La clave va en
 * otro fichero: se abre después de puntuar.
 *
 *   node tools/paquete-ciego.mjs carpetaA carpetaB salida/
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { randomInt } from 'node:crypto';

const [a, b, salida] = process.argv.slice(2);
if (!a || !b || !salida) {
  console.error('Uso: node tools/paquete-ciego.mjs carpetaA carpetaB salida/');
  process.exit(1);
}

/** Sin nada que diga de dónde sale: marcas, comodines ni títulos. */
function limpiar(md) {
  return md
    .split('\n')
    .filter((l) => !/^Comodines:|^# /.test(l))
    .map((l) => l.replace(/ ⟲$/u, '').replace(/ · (?:✅|❌)[^\n]*$/u, ''))
    .join('\n')
    .trim();
}

const comunes = readdirSync(a).filter((f) => f.endsWith('.md') && readdirSync(b).includes(f));
if (!comunes.length) {
  console.error('No hay partidas con el mismo nombre en las dos carpetas.');
  process.exit(1);
}

mkdirSync(salida, { recursive: true });
const clave = {};
const hoja = [
  '# Evaluación a ciegas de dos narradores',
  '',
  'Lee cada partida en sus dos versiones. No sabes cuál es cuál. Puntúa de 1 a 5:',
  '',
  '- **R** — no se siente repetitivo (5 = nada, 1 = mucho).',
  '- **P** — contesta a lo que se pregunta, con quien se pregunta.',
  '- **V** — los personajes parecen vivos y distintos entre sí.',
  '- **C** — continuidad: recuerda lo que pasó y no se contradice.',
  '- **D** — respeta lo que decides: no juega por ti ni inventa lo que no hiciste.',
  '',
  'Y al final de cada partida: ¿cuál seguirías jugando?',
  '',
];

for (const f of comunes) {
  const primero = randomInt(2) === 0 ? 'A' : 'B';
  const orden = primero === 'A' ? [a, b] : [b, a];
  clave[basename(f, '.md')] = { 'Versión 1': primero === 'A' ? a : b, 'Versión 2': primero === 'A' ? b : a };
  const id = `partida ${Object.keys(clave).length}`;
  hoja.push(`---`, '', `## ${id}`, '');
  orden.forEach((carpeta, i) => {
    hoja.push(`### Versión ${i + 1}`, '', limpiar(readFileSync(join(carpeta, f), 'utf8')), '');
  });
  hoja.push('| | R | P | V | C | D |', '|---|---|---|---|---|---|', '| Versión 1 | | | | | |', '| Versión 2 | | | | | |', '', '¿Cuál seguirías jugando? ____', '');
}

writeFileSync(join(salida, 'ciego.md'), hoja.join('\n'));
writeFileSync(join(salida, 'clave-NO-ABRIR-hasta-puntuar.json'), JSON.stringify(clave, null, 2));
console.log(`${comunes.length} partidas en ${join(salida, 'ciego.md')} · la clave, aparte.`);
