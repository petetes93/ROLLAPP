#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANUM · tools/generar-arte.mjs
 * ---------------------------------------------------------------------------
 * Genera las imágenes del juego con un modelo de difusión gratuito.
 *
 * Usa `image.pollinations.ai`, que responde a una petición HTTP normal sin
 * clave, sin cuenta y sin cuota de pago. Es la razón de que esto sea un script
 * y no un navegador conducido a mano: 40 imágenes por un chat web son una
 * tarde; por HTTP son un comando que se puede repetir.
 *
 * **Esto se ejecuta UNA VEZ, al construir.** El juego no toca la red jamás:
 * las imágenes quedan en `assets/` y de ahí las lee el manifiesto. Es la
 * restricción de siempre del proyecto y no cambia.
 *
 * La semilla sale del `refId`, así que repetir el comando reproduce la misma
 * imagen. Para pedir alternativas de una pieza concreta se usa `--variante N`,
 * que cambia la semilla de forma igual de reproducible.
 *
 * Uso:
 *   node tools/generar-arte.mjs --familia retratos --solo valdes
 *   node tools/generar-arte.mjs --familia retratos
 *   node tools/generar-arte.mjs                      → las 40
 *   node tools/generar-arte.mjs --solo valdes --variante 2 --forzar
 *   node tools/generar-arte.mjs --listar             → qué haría, sin pedir nada
 *
 * Es reanudable: lo ya descargado se salta salvo que se pase `--forzar`.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { writeFile, readFile, mkdir, stat } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, '..');

const { hashSemilla } = await import(pathToFileURL(resolve(RAIZ, 'src/core/RNG.js')).href);

/* ═══════════════════════════════════════════════════════════════════════════
   ARGUMENTOS
   ═══════════════════════════════════════════════════════════════════════════ */

const argv = process.argv.slice(2);
const leer = (b, d) => { const i = argv.indexOf(b); return i >= 0 ? (argv[i + 1] ?? d) : d; };

const opciones = {
  familia: leer('--familia', 'todas'),
  solo: leer('--solo', null),
  variante: Number(leer('--variante', '1')) || 1,
  forzar: argv.includes('--forzar'),
  listar: argv.includes('--listar'),
  espera: Number(leer('--espera', '2500')),
  reintentos: Number(leer('--reintentos', '3')),
};

/* ═══════════════════════════════════════════════════════════════════════════
   TAMAÑOS
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Proporciones de cada familia.
 *
 * Coinciden con los lienzos de `src/art/`, para que una imagen y su respaldo
 * vectorial encajen en el mismo hueco sin recorte distinto.
 */
const MEDIDAS = {
  retratos: { ancho: 800, alto: 960, carpeta: 'retratos' },
  criaturas: { ancho: 800, alto: 800, carpeta: 'criaturas' },
  paisajes: { ancho: 1024, alto: 576, carpeta: 'paisajes' },
};

/* ═══════════════════════════════════════════════════════════════════════════
   DESCARGA
   ═══════════════════════════════════════════════════════════════════════════ */

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Pide una imagen y devuelve sus bytes.
 *
 * Reintenta con espera creciente: el servicio es gratuito y compartido, así que
 * un 429 o un corte a mitad son normales, no una avería.
 *
 * @param {string} url
 * @param {number} intentos
 * @returns {Promise<Buffer>}
 */
async function pedir(url, intentos) {
  let ultimoFallo;

  for (let i = 1; i <= intentos; i++) {
    try {
      const respuesta = await fetch(url, {
        signal: AbortSignal.timeout(180_000),
        headers: { 'User-Agent': 'arcanum-build/1.0' },
      });

      if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);

      const tipo = respuesta.headers.get('content-type') ?? '';
      if (!tipo.startsWith('image/')) throw new Error(`respuesta no es imagen: ${tipo}`);

      const bytes = Buffer.from(await respuesta.arrayBuffer());

      // Una imagen de menos de 5 KB casi siempre es un cartel de error del
      // servicio, no un dibujo. Mejor reintentar que guardar basura.
      if (bytes.length < 5000) throw new Error(`imagen sospechosamente pequeña (${bytes.length} B)`);

      return bytes;
    } catch (e) {
      ultimoFallo = e;
      if (i < intentos) await dormir(opciones.espera * i * 2);
    }
  }

  throw ultimoFallo;
}

/* ═══════════════════════════════════════════════════════════════════════════
   PRINCIPAL
   ═══════════════════════════════════════════════════════════════════════════ */

// Los encargos se leen del cuaderno, que se genera de los catálogos. Así el
// prompt que se envía es EXACTAMENTE el que está documentado en dist/encargos.md.
const rutaEncargos = resolve(RAIZ, 'dist/encargos.json');

let encargos;

try {
  encargos = JSON.parse(await readFile(rutaEncargos, 'utf-8'));
} catch {
  console.error('No hay dist/encargos.json. Genera primero el cuaderno:\n');
  console.error('  node tools/encargos-arte.mjs --json\n');
  process.exit(1);
}

let cola = encargos;
if (opciones.familia !== 'todas') cola = cola.filter((e) => e.familia === opciones.familia);
if (opciones.solo) cola = cola.filter((e) => e.clave === opciones.solo);

if (!cola.length) {
  console.error('Ningún encargo coincide con esos filtros.');
  process.exit(1);
}

console.log('ARCANUM · generación de arte\n');
console.log(`  servicio: image.pollinations.ai (gratuito, sin clave)`);
console.log(`  encargos: ${cola.length}`);
console.log(`  variante: ${opciones.variante}\n`);

const hechos = [];
const fallidos = [];
const saltados = [];

for (const [i, e] of cola.entries()) {
  const medida = MEDIDAS[e.familia];
  const relativa = `${medida.carpeta}/${e.clave}.jpg`;
  const destino = resolve(RAIZ, 'assets', relativa);

  const etiqueta = `[${i + 1}/${cola.length}] ${e.familia}/${e.clave}`;

  // ── Reanudable ────────────────────────────────────────────────────────
  if (!opciones.forzar) {
    try {
      const info = await stat(destino);

      if (info.size > 5000) {
        console.log(`${etiqueta} · ya está, se salta`);
        saltados.push({ ...e, relativa });
        continue;
      }
    } catch { /* no existe: hay que generarla */ }
  }

  // ── URL ───────────────────────────────────────────────────────────────
  // La semilla depende del refId y de la variante: el mismo comando devuelve
  // la misma imagen, y `--variante 2` da otra distinta de forma reproducible.
  const semilla = (hashSemilla(`${e.clave}:${opciones.variante}`) >>> 0) % 2_000_000;

  const parametros = new URLSearchParams({
    width: String(medida.ancho),
    height: String(medida.alto),
    seed: String(semilla),
    nologo: 'true',
    model: 'sana',
  });

  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(e.prompt)}?${parametros}`;

  if (opciones.listar) {
    console.log(`${etiqueta} · ${medida.ancho}x${medida.alto} · semilla ${semilla}`);
    continue;
  }

  // ── Descarga ──────────────────────────────────────────────────────────
  process.stdout.write(`${etiqueta} · pidiendo… `);

  try {
    const bytes = await pedir(url, opciones.reintentos);

    await mkdir(dirname(destino), { recursive: true });
    await writeFile(destino, bytes);

    console.log(`${Math.round(bytes.length / 1024)} KB`);
    hechos.push({ ...e, relativa });
  } catch (fallo) {
    console.log(`FALLO · ${fallo.message}`);
    fallidos.push({ ...e, motivo: fallo.message });
  }

  // Cortesía con un servicio gratuito y compartido.
  if (i < cola.length - 1) await dormir(opciones.espera);
}

if (opciones.listar) process.exit(0);

/* ═══════════════════════════════════════════════════════════════════════════
   MANIFIESTO
   ═══════════════════════════════════════════════════════════════════════════ */

// Se declaran SOLO las que están en disco. Una entrada que apunte a un archivo
// que no existe haría una petición fallida por turno; el vector es mejor.
const rutaManifiesto = resolve(RAIZ, 'assets/manifest.json');

let manifiesto = { paisajes: {}, retratos: {}, criaturas: {} };

try {
  manifiesto = { ...manifiesto, ...JSON.parse(await readFile(rutaManifiesto, 'utf-8')) };
} catch { /* no había: se crea */ }

for (const e of [...hechos, ...saltados]) {
  manifiesto[e.familia] ??= {};
  manifiesto[e.familia][e.clave] = e.relativa;
}

await writeFile(rutaManifiesto, `${JSON.stringify(manifiesto, null, 2)}\n`, 'utf-8');

/* ═══════════════════════════════════════════════════════════════════════════
   INFORME
   ═══════════════════════════════════════════════════════════════════════════ */

console.log(`\n${hechos.length} generadas · ${saltados.length} ya estaban `
  + `· ${fallidos.length} fallidas`);

const total = Object.values(manifiesto).reduce((n, f) => n + Object.keys(f).length, 0);
console.log(`manifiesto: ${total} piezas declaradas`);

if (fallidos.length) {
  console.log('\nFallidas (vuelve a lanzar el comando: es reanudable):');
  for (const f of fallidos) console.log(`  ${f.familia}/${f.clave} · ${f.motivo}`);
  process.exitCode = 1;
}
