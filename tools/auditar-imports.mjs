/**
 * Comprueba que cada nombre importado exista de verdad en el módulo de origen.
 * Es el fallo que `node --check` no puede ver: la sintaxis es correcta, pero el
 * nombre no está.
 */

import { readdirSync, statSync, readFileSync } from 'fs';
import { join, dirname, resolve, relative } from 'path';

const RAIZ = process.cwd();

function recorrer(dir, salida = []) {
  for (const entrada of readdirSync(dir)) {
    const ruta = join(dir, entrada);
    if (statSync(ruta).isDirectory()) recorrer(ruta, salida);
    else if (entrada.endsWith('.js')) salida.push(ruta);
  }
  return salida;
}

/** Nombres que un módulo exporta. */
function exportaciones(fuente) {
  const nombres = new Set();

  for (const m of fuente.matchAll(/^export\s+(?:const|let|var|function|class|async function)\s+([\p{L}\p{N}_$]+)/gmu)) {
    nombres.add(m[1]);
  }

  for (const m of fuente.matchAll(/^export\s*\{([^}]*)\}/gm)) {
    for (const parte of m[1].split(',')) {
      const t = parte.trim();
      if (!t) continue;
      nombres.add(t.includes(' as ') ? t.split(/\s+as\s+/)[1].trim() : t);
    }
  }

  if (/^export\s+default/m.test(fuente)) nombres.add('default');

  return nombres;
}

/** Nombres que un módulo importa, con su origen. */
function importaciones(fuente) {
  const salida = [];

  const patron = /^import\s+([\s\S]*?)\s+from\s+['"]([^'"]+)['"]/gm;

  for (const m of fuente.matchAll(patron)) {
    const clausula = m[1].trim();
    const origen = m[2];

    if (!origen.startsWith('.')) continue;

    // import * as X — trae todo, nada que comprobar.
    if (/^\*\s+as\s+[\w$]+$/.test(clausula)) continue;

    const conLlaves = clausula.match(/^(?:([\w$]+)\s*,\s*)?\{([\s\S]*)\}$/);

    if (conLlaves) {
      if (conLlaves[1]) salida.push({ nombre: 'default', origen });

      for (const parte of conLlaves[2].split(',')) {
        const t = parte.trim();
        if (!t) continue;
        salida.push({ nombre: t.split(/\s+as\s+/)[0].trim(), origen });
      }
      continue;
    }

    if (/^[\w$]+$/.test(clausula)) salida.push({ nombre: 'default', origen });
  }

  return salida;
}

/* ── auditoría ────────────────────────────────────────────────────────── */

const archivos = recorrer(join(RAIZ, 'src'));
const cache = new Map();

function exportsDe(ruta) {
  if (!cache.has(ruta)) {
    try {
      cache.set(ruta, exportaciones(readFileSync(ruta, 'utf8')));
    } catch {
      cache.set(ruta, null);
    }
  }
  return cache.get(ruta);
}

const problemas = [];

for (const archivo of archivos) {
  const fuente = readFileSync(archivo, 'utf8');

  for (const { nombre, origen } of importaciones(fuente)) {
    let destino = resolve(dirname(archivo), origen);
    if (!destino.endsWith('.js')) destino += '.js';

    const exportados = exportsDe(destino);

    if (exportados === null) {
      problemas.push({ archivo, destino, nombre, tipo: 'módulo ausente' });
      continue;
    }

    if (!exportados.has(nombre)) {
      problemas.push({ archivo, destino, nombre, tipo: 'nombre inexistente' });
    }
  }
}

/* ── informe ──────────────────────────────────────────────────────────── */

const r = (p) => relative(RAIZ, p);

if (!problemas.length) {
  console.log('Sin desajustes: todas las importaciones encuentran su exportación.');
} else {
  // Agrupado por módulo de origen, que es como se arreglan.
  const porDestino = new Map();

  for (const p of problemas) {
    const clave = r(p.destino);
    if (!porDestino.has(clave)) porDestino.set(clave, []);
    porDestino.get(clave).push(p);
  }

  console.log(problemas.length + ' desajustes en ' + porDestino.size + ' módulos:\n');

  for (const [destino, lista] of [...porDestino].sort()) {
    const nombres = [...new Set(lista.map((p) => p.nombre))];
    console.log('  ' + destino);
    console.log('    falta exportar: ' + nombres.join(', '));
    console.log('    lo importan:    ' + [...new Set(lista.map((p) => r(p.archivo)))].join(', '));
    console.log();
  }
}

console.log('archivos analizados: ' + archivos.length);
