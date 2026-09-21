#!/usr/bin/env node
/**
 * Arranca ARCANVEIL y el proxy seguro de Gemini con un solo comando.
 * La clave se hereda desde GEMINI_API_KEY y no se escribe en disco.
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

if (!process.env.GEMINI_API_KEY?.trim()) {
  console.error('Falta GEMINI_API_KEY. Consulta GEMINI_LOCAL.md.');
  process.exit(1);
}

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const puertoApp = process.env.ARCANVEIL_PORT || '8080';
const origin = `http://localhost:${puertoApp}`;
const entorno = { ...process.env, ARCANVEIL_ORIGIN: process.env.ARCANVEIL_ORIGIN || origin };
const procesos = [
  spawn(process.execPath, ['tools/gemini-proxy.mjs'], { cwd: raiz, env: entorno, stdio: 'inherit' }),
  spawn(process.execPath, ['tools/servir.mjs', '--puerto', puertoApp], { cwd: raiz, env: entorno, stdio: 'inherit' }),
];

let cerrando = false;
const cerrar = codigo => {
  if (cerrando) return;
  cerrando = true;
  for (const proceso of procesos) proceso.kill('SIGTERM');
  setTimeout(() => process.exit(codigo), 100).unref();
};

for (const proceso of procesos) {
  proceso.on('error', error => {
    console.error(`No se pudo arrancar: ${error.message}`);
    cerrar(1);
  });
  proceso.on('exit', codigo => {
    if (!cerrando && codigo) {
      console.error(`Un proceso terminó con código ${codigo}.`);
      cerrar(codigo);
    }
  });
}

process.on('SIGINT', () => cerrar(0));
process.on('SIGTERM', () => cerrar(0));
console.log(`ARCANVEIL estará en http://localhost:${puertoApp}/app/index.html`);
console.log('Pulsa Ctrl+C para cerrar la app y el proxy.');
