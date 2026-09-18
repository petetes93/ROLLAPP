#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANUM · tools/lamina-arte.mjs
 * ---------------------------------------------------------------------------
 * Lámina de contacto de todo el arte generado.
 *
 * Genera un HTML con las piezas de los tres generadores puestas juntas. Existe
 * porque el fallo típico del arte generado no se ve pieza a pieza: cada una
 * puede estar bien y aun así la serie no parecer del mismo juego. Eso solo se
 * juzga viéndolas en una rejilla.
 *
 * Uso:
 *   node tools/lamina-arte.mjs                    → dist/lamina-arte.html
 *   node tools/lamina-arte.mjs --franja ocaso --clima lluvia
 *   node tools/lamina-arte.mjs --horas            → un lugar en las 7 franjas
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, '..');

// En Windows una ruta con letra de unidad no es una URL válida para `import()`;
// hay que convertirla o Node contesta ERR_UNSUPPORTED_ESM_URL_SCHEME.
const modulo = (relativa) => import(pathToFileURL(resolve(RAIZ, relativa)).href);

const { paisaje } = await modulo('src/art/paisaje.js');
const { retrato } = await modulo('src/art/retrato.js');
const { criatura } = await modulo('src/art/criatura.js');

const { RAZAS } = await modulo('src/data/races.data.js');
const { LUGARES } = await modulo('src/data/locations.data.js');
const { ENEMIGOS } = await modulo('src/data/enemies.data.js');
const { FRANJAS } = await modulo('src/art/paleta.js');

/* ═══ argumentos ═══════════════════════════════════════════════════════════ */

const argv = process.argv.slice(2);
const leer = (bandera, defecto) => {
  const i = argv.indexOf(bandera);
  return i >= 0 ? (argv[i + 1] ?? defecto) : defecto;
};

const franja = leer('--franja', 'tarde');
const clima = leer('--clima', 'despejado');
const salida = leer('--salida', 'dist/lamina-arte.html');
const porHoras = argv.includes('--horas');

/* ═══ montaje ══════════════════════════════════════════════════════════════ */

const celda = (svg, titulo, nota = '') => `
  <figure class="celda">
    <div class="marco">${svg}</div>
    <figcaption>${titulo}<span>${nota}</span></figcaption>
  </figure>`;

const secciones = [];

/* ── Retratos ─────────────────────────────────────────────────────────────── */
secciones.push(`<h2>Linajes <small>${Object.keys(RAZAS).length}</small></h2>
<div class="rejilla rejilla--retrato">${
  Object.values(RAZAS)
    .map((r) => celda(retrato({ raza: r.refId, nombre: r.nombre }), r.nombre, r.refId))
    .join('')
}</div>`);

/* ── Criaturas ────────────────────────────────────────────────────────────── */
secciones.push(`<h2>Criaturas <small>${Object.keys(ENEMIGOS).length}</small></h2>
<div class="rejilla rejilla--criatura">${
  Object.values(ENEMIGOS)
    .map((e) => celda(
      criatura({ refId: e.refId, tipo: e.tipo, tamano: e.tamano, nombre: e.nombre }),
      e.nombre, `${e.tipo} · ${e.tamano}`,
    ))
    .join('')
}</div>`);

/* ── Paisajes ─────────────────────────────────────────────────────────────── */
secciones.push(`<h2>Lugares <small>${Object.keys(LUGARES).length} · ${franja} · ${clima}</small></h2>
<div class="rejilla rejilla--paisaje">${
  Object.values(LUGARES)
    .map((l) => celda(
      paisaje({ refId: l.refId, terreno: l.terreno, tipo: l.tipo, nombre: l.nombre, franja, clima }),
      l.nombre, `${l.terreno} · peligro ${l.peligro}`,
    ))
    .join('')
}</div>`);

/* ── El mismo lugar a todas horas ─────────────────────────────────────────── */
if (porHoras) {
  const muestra = LUGARES.vado_yunque ?? Object.values(LUGARES)[0];

  secciones.push(`<h2>${muestra.nombre} a lo largo del día <small>misma semilla</small></h2>
  <div class="rejilla rejilla--paisaje">${
    Object.keys(FRANJAS)
      .map((f) => celda(
        paisaje({ refId: muestra.refId, terreno: muestra.terreno, tipo: muestra.tipo, nombre: muestra.nombre, franja: f, clima }),
        f, clima,
      ))
      .join('')
  }</div>`);
}

/* ═══ escritura ════════════════════════════════════════════════════════════ */

const html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8">
<title>ARCANUM · lámina de arte</title>
<style>
  body{margin:0;padding:2rem;background:#14161A;color:#DED8CB;
       font:15px/1.5 system-ui,sans-serif}
  h1{font-size:1.5rem;margin:0 0 .3rem}
  h1+p{color:#6E6961;margin:0 0 2.5rem;font-size:.85rem}
  h2{font-size:.7rem;letter-spacing:.14em;text-transform:uppercase;color:#8A9E7E;
     margin:2.5rem 0 .9rem;border-bottom:1px solid #33383F;padding-bottom:.5rem}
  h2 small{color:#6E6961;letter-spacing:.04em;text-transform:none;margin-left:.6rem}
  .rejilla{display:grid;gap:1rem}
  .rejilla--retrato{grid-template-columns:repeat(auto-fill,minmax(210px,1fr))}
  .rejilla--criatura{grid-template-columns:repeat(auto-fill,minmax(150px,1fr))}
  .rejilla--paisaje{grid-template-columns:repeat(auto-fill,minmax(320px,1fr))}
  .celda{margin:0}
  .marco{border:1px solid #33383F;border-radius:4px;overflow:hidden;background:#101216;
         aspect-ratio:1}
  .rejilla--paisaje .marco{aspect-ratio:5/2}
  .rejilla--retrato .marco{aspect-ratio:5/6}
  .marco svg{display:block;width:100%;height:100%}
  figcaption{font-size:.72rem;color:#A29C90;margin-top:.4rem;
             display:flex;justify-content:space-between;gap:.5rem}
  figcaption span{color:#6E6961;font-family:ui-monospace,monospace;font-size:.66rem}
</style></head><body>
<h1>ARCANUM · lámina de arte</h1>
<p>Todo generado por código desde <code>src/art/</code>. Ninguna imagen externa.</p>
${secciones.join('\n')}
</body></html>`;

const destino = resolve(RAIZ, salida);
await mkdir(dirname(destino), { recursive: true });
await writeFile(destino, html, 'utf-8');

const piezas = Object.keys(RAZAS).length + Object.keys(ENEMIGOS).length
  + Object.keys(LUGARES).length + (porHoras ? Object.keys(FRANJAS).length : 0);

console.log(`Lámina lista: ${salida}`);
console.log(`  ${piezas} piezas · ${Math.round(html.length / 1024)} KB`);
