/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANVEIL · tools/generar-iconos.mjs
 * ---------------------------------------------------------------------------
 * Convierte `assets/icon.svg` en los PNG que hacen falta para instalar el
 * juego como aplicación.
 *
 * Por qué existe este rodeo: el proyecto no tiene dependencias, y rasterizar
 * un SVG desde Node sin librerías no se puede. El navegador sí sabe hacerlo y
 * lo hace bien, así que el script levanta una página que pinta el SVG en un
 * canvas y devuelve los PNG por POST. Se abre, se ejecuta sola, escribe y se
 * apaga.
 *
 * Solo hay que ejecutarlo cuando cambie el icono:
 *
 *   node tools/generar-iconos.mjs
 *   # y abrir http://127.0.0.1:8123 en cualquier navegador
 *
 * Nada de esto viaja al juego: es una herramienta de taller.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUERTO = 8123;

/**
 * Qué se genera y por qué cada uno.
 *
 * - 192 y 512: el mínimo que Chrome exige para ofrecer «instalar».
 * - maskable: Android recorta el icono a un círculo. Sin margen se come el
 *   dibujo, así que este lleva un 14% de aire alrededor.
 * - apple-touch-icon: iOS ignora el manifiesto por completo. Sin este archivo
 *   el icono de la pantalla de inicio es una captura de la página.
 */
const PIEZAS = [
  { archivo: 'assets/icon-192.png', lado: 192, aire: 0 },
  { archivo: 'assets/icon-512.png', lado: 512, aire: 0 },
  { archivo: 'assets/icon-maskable-512.png', lado: 512, aire: 0.14 },
  { archivo: 'assets/apple-touch-icon.png', lado: 180, aire: 0.06 },
];

const FONDO = '#11101F';

const PAGINA = (svg, piezas) => `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><title>Generando iconos…</title>
<style>body{background:#11101F;color:#DED8CB;font:14px/1.6 system-ui;padding:2rem}</style>
</head><body>
<h1>Generando iconos…</h1><pre id="salida">trabajando</pre>
<script type="module">
const PIEZAS = ${JSON.stringify(piezas)};
const salida = document.getElementById('salida');

const blob = new Blob([${JSON.stringify(svg)}], { type: 'image/svg+xml' });
const url = URL.createObjectURL(blob);
const img = await new Promise((res, rej) => {
  const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url;
});

const hechos = {};

for (const p of PIEZAS) {
  const c = document.createElement('canvas');
  c.width = c.height = p.lado;
  const g = c.getContext('2d');
  g.fillStyle = ${JSON.stringify(FONDO)};
  g.fillRect(0, 0, p.lado, p.lado);
  const d = p.lado * (1 - p.aire * 2);
  g.drawImage(img, p.lado * p.aire, p.lado * p.aire, d, d);
  hechos[p.archivo] = c.toDataURL('image/png').split(',')[1];
}

URL.revokeObjectURL(url);

const r = await fetch('/guardar', {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify(hechos),
});

salida.textContent = await r.text();
</script></body></html>`;

const svg = await readFile(join(RAIZ, 'assets/icon.svg'), 'utf-8');

const servidor = createServer(async (pet, res) => {
  if (pet.method === 'POST' && pet.url === '/guardar') {
    const trozos = [];
    for await (const t of pet) trozos.push(t);

    const datos = JSON.parse(Buffer.concat(trozos).toString('utf-8'));
    const escritos = [];

    for (const [archivo, base64] of Object.entries(datos)) {
      const buf = Buffer.from(base64, 'base64');
      await writeFile(join(RAIZ, archivo), buf);
      escritos.push(`${archivo} · ${Math.round(buf.length / 1024)} kB`);
    }

    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(escritos.join('\n'));

    console.log(escritos.join('\n'));
    console.log('\nListo. Puedes cerrar la pestaña.');

    // Se apaga solo: es una herramienta de un solo uso, no un servidor.
    setTimeout(() => servidor.close(() => process.exit(0)), 300);
    return;
  }

  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
  res.end(PAGINA(svg, PIEZAS));
});

servidor.listen(PUERTO, '127.0.0.1', () => {
  console.log(`Abre http://127.0.0.1:${PUERTO} para generar los iconos.`);
});
