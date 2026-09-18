#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANUM · tools/auditar-arte.mjs
 * ---------------------------------------------------------------------------
 * Comprueba que todas las piezas de arte se generan enteras.
 *
 * Existe por un fallo concreto que costó cuatro vueltas encontrar: los tres
 * generadores construían sus degradados y su recorte y luego NO se los pasaban
 * a `lienzo()`. El SVG salía bien formado, sin errores y sin avisos, pero cada
 * `fill="url(#piel-2)"` apuntaba a una definición que no existía. El resultado
 * era una silueta sin relleno y unas sombras dibujadas sin recortar, es decir,
 * una mancha. Ninguna comprobación de sintaxis lo habría visto.
 *
 * Lo que se verifica de cada pieza:
 *
 *   · toda referencia `url(#x)` tiene su `id="x"` en el documento
 *   · no hay `NaN`, `undefined` ni `null` en ningún atributo
 *   · las etiquetas abiertas coinciden con las cerradas
 *   · la pieza tiene un tamaño razonable (una vacía pesa muy poco)
 *
 * Uso:
 *   node tools/auditar-arte.mjs
 *   node tools/auditar-arte.mjs --verboso
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, '..');

const modulo = (r) => import(pathToFileURL(resolve(RAIZ, r)).href);

const { paisaje } = await modulo('src/art/paisaje.js');
const { retrato } = await modulo('src/art/retrato.js');
const { criatura } = await modulo('src/art/criatura.js');

const { RAZAS } = await modulo('src/data/races.data.js');
const { LUGARES } = await modulo('src/data/locations.data.js');
const { ENEMIGOS } = await modulo('src/data/enemies.data.js');
const { FRANJAS, CLIMAS } = await modulo('src/art/paleta.js');

const verboso = process.argv.includes('--verboso');

/* ═══════════════════════════════════════════════════════════════════════════
   COMPROBACIONES
   ═══════════════════════════════════════════════════════════════════════════ */

/** Peso mínimo por debajo del cual una pieza está claramente vacía, en bytes. */
const PESO_MINIMO = 500;

/**
 * Revisa una pieza y devuelve la lista de problemas.
 *
 * @param {string} svg
 * @returns {string[]}
 */
function revisar(svg) {
  const fallos = [];

  if (typeof svg !== 'string' || !svg.startsWith('<svg')) {
    return ['no devuelve un SVG'];
  }

  if (svg.length < PESO_MINIMO) {
    fallos.push(`pieza sospechosamente corta (${svg.length} B)`);
  }

  // ── Referencias colgando ────────────────────────────────────────────────
  const definidos = new Set([...svg.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  const usados = new Set([...svg.matchAll(/url\(#([^)]+)\)/g)].map((m) => m[1]));

  for (const id of usados) {
    if (!definidos.has(id)) fallos.push(`referencia sin definir: url(#${id})`);
  }

  // ── Valores basura ──────────────────────────────────────────────────────
  // Un `undefined` en una coordenada no rompe el SVG: simplemente no dibuja
  // esa forma, en silencio.
  for (const basura of ['NaN', 'undefined', 'null', 'Infinity']) {
    if (svg.includes(basura)) fallos.push(`contiene «${basura}»`);
  }

  // ── Etiquetas descuadradas ──────────────────────────────────────────────
  const abiertas = (svg.match(/<(?!\/)[a-zA-Z]/g) ?? []).length;
  const cerradas = (svg.match(/<\/[a-zA-Z]/g) ?? []).length
    + (svg.match(/\/>/g) ?? []).length;

  if (abiertas !== cerradas) {
    fallos.push(`etiquetas descuadradas: ${abiertas} abiertas, ${cerradas} cerradas`);
  }

  return fallos;
}

/* ═══════════════════════════════════════════════════════════════════════════
   RECORRIDO
   ═══════════════════════════════════════════════════════════════════════════ */

let total = 0;
let conFallos = 0;
const problemas = [];

/**
 * @param {string} etiqueta
 * @param {string} svg
 */
function comprobar(etiqueta, svg) {
  total += 1;

  const fallos = revisar(svg);

  if (fallos.length) {
    conFallos += 1;
    problemas.push({ etiqueta, fallos });
  } else if (verboso) {
    console.log(`  ok  ${etiqueta}  (${Math.round(svg.length / 102.4) / 10} KB)`);
  }
}

console.log('ARCANUM · auditoría de arte\n');

/* ── Retratos ─────────────────────────────────────────────────────────────── */
for (const r of Object.values(RAZAS)) {
  comprobar(`retrato:${r.refId}`, retrato({ raza: r.refId, nombre: r.nombre }));
}

/* ── Criaturas ────────────────────────────────────────────────────────────── */
for (const e of Object.values(ENEMIGOS)) {
  comprobar(`criatura:${e.refId}`,
    criatura({ refId: e.refId, tipo: e.tipo, tamano: e.tamano, nombre: e.nombre }));
}

/* ── Paisajes: cada lugar, en TODAS las franjas y climas ──────────────────── */
// El paisaje es el único que cambia con el estado del mundo, así que es el
// único donde una combinación rara puede romperse sola.
for (const l of Object.values(LUGARES)) {
  for (const franja of Object.keys(FRANJAS)) {
    for (const clima of Object.keys(CLIMAS)) {
      comprobar(`paisaje:${l.refId}/${franja}/${clima}`, paisaje({
        refId: l.refId, terreno: l.terreno, tipo: l.tipo,
        nombre: l.nombre, franja, clima,
      }));
    }
  }
}

/* ── Reserva: identificadores que no existen en ningún catálogo ───────────── */
comprobar('retrato:linaje-inventado', retrato({ raza: 'no_existe' }));
comprobar('criatura:tipo-inventado', criatura({ refId: 'x', tipo: 'no_existe', tamano: 'colosal' }));
comprobar('paisaje:terreno-inventado', paisaje({ refId: 'x', terreno: 'no_existe', franja: 'ninguna' }));

/* ═══════════════════════════════════════════════════════════════════════════
   INFORME
   ═══════════════════════════════════════════════════════════════════════════ */

console.log(`${total} piezas generadas`);

if (!problemas.length) {
  console.log('0 problemas\n');
  console.log('Todas las piezas se generan enteras.');
  process.exit(0);
}

console.log(`${conFallos} con problemas\n`);

for (const p of problemas) {
  console.log(`  ${p.etiqueta}`);
  for (const f of p.fallos) console.log(`      · ${f}`);
}

process.exit(1);
