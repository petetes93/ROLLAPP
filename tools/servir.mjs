#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANUM · tools/servir.mjs
 * ---------------------------------------------------------------------------
 * Servidor estático de desarrollo.
 *
 * Los módulos ES6 no cargan desde `file://`, así que hace falta servir por
 * HTTP. El README propone `python -m http.server`, que sirve, pero **cachea**:
 * editas un módulo, recargas, y el navegador sigue ejecutando el de antes. Se
 * pierde media hora buscando un fallo ya corregido.
 *
 * Esto es lo mismo pero con `Cache-Control: no-store`, sin dependencias y con
 * el Node que ya hace falta para empaquetar.
 *
 * Uso:
 *   node tools/servir.mjs            → http://localhost:8080
 *   node tools/servir.mjs --puerto 9000
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, dirname, extname, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, '..');

const argv = process.argv.slice(2);
const i = argv.indexOf('--puerto');
const PUERTO = Number(i >= 0 ? argv[i + 1] : '') || 8080;

/** Tipos que hacen falta aquí. Un mapa corto basta: el proyecto no usa más. */
const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

const servidor = createServer(async (peticion, respuesta) => {
  const url = new URL(peticion.url, `http://${peticion.headers.host}`);
  let ruta = decodeURIComponent(url.pathname);

  if (ruta.endsWith('/')) ruta += 'index.html';

  // No salir de la raíz. `..` en la URL no debe alcanzar el disco de arriba,
  // aunque esto solo escuche en local.
  const destino = resolve(RAIZ, `.${normalize(ruta)}`);

  if (destino !== RAIZ && !destino.startsWith(RAIZ + sep)) {
    respuesta.writeHead(403).end('fuera de la raíz');
    return;
  }

  try {
    const info = await stat(destino);
    if (info.isDirectory()) throw new Error('es una carpeta');

    const cuerpo = await readFile(destino);

    respuesta.writeHead(200, {
      'Content-Type': TIPOS[extname(destino)] ?? 'application/octet-stream',
      // La razón de que este archivo exista.
      'Cache-Control': 'no-store, must-revalidate',
    });

    respuesta.end(cuerpo);
  } catch {
    respuesta.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    respuesta.end(`no encontrado: ${ruta}`);
  }
});

servidor.listen(PUERTO, () => {
  console.log(`ARCANUM servido en http://localhost:${PUERTO}`);
  console.log(`  raíz: ${RAIZ}`);
  console.log('  sin caché: recargar basta para ver los cambios');
  console.log('\n  app:    /app/index.html');
  console.log('  lámina: /dist/lamina-arte.html');
});
