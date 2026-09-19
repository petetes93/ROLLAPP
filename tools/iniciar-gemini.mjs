#!/usr/bin/env node
/**
 * Arranca ROLLAPP y el proxy seguro de Gemini con un solo comando.
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
const procesos = [
  spawn(process.execPath, ['tools/gemini-proxy.mjs'], { cwd: raiz, env: process.env, stdio: 'inherit' }),
  spawn(process.execPath, ['tools/servir.mjs', '--puerto', process.env.ROLLAPP_PORT || '8080'], { cwd: raiz, env: process.env, stdio: 'inherit' }),
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
const puertoApp = process.env.ROLLAPP_PORT || '8080';
console.log(`ROLLAPP estará en http://localhost:${puertoApp}/app/index.html`);
console.log('Pulsa Ctrl+C para cerrar la app y el proxy.');
