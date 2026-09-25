#!/usr/bin/env node
/**
 * RUTA HEREDADA, DESACTIVADA. Arranca ARCANVEIL y el proxy de Gemini.
 *
 * No aparece en el selector del juego ni es respaldo de nada. Se conserva
 * como código separado: los términos de la API gratuita de Gemini reservan
 * a servicios de pago los clientes con usuarios en el EEE, Suiza y Reino
 * Unido, así que no es una vía para el juego publicado. La narración con IA
 * va por Groq (ver GROQ_LOCAL.md).
 *
 * La clave se pide sin eco (no queda en el historial de la terminal) y solo
 * llega al proceso del proxy; el servidor de la app no la hereda.
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { leerOculto } from './iniciar-groq.mjs';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const puertoApp = process.env.ARCANVEIL_PORT || '8080';
const origin = `http://localhost:${puertoApp}`;

let clave = process.env.GEMINI_API_KEY?.trim();
if (!clave) {
  try {
    clave = (await leerOculto(process.stdin, process.stdout, 'Clave de Gemini (no se verá): ')).trim();
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}

const limpio = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/GEMINI|GROQ|API_KEY|TOKEN|SECRET/i.test(k)));
const procesos = [
  spawn(process.execPath, ['tools/gemini-proxy.mjs'], { cwd: raiz, env: { ...limpio, GEMINI_API_KEY: clave, ARCANVEIL_ORIGIN: process.env.ARCANVEIL_ORIGIN || origin }, stdio: 'inherit' }),
  spawn(process.execPath, ['tools/servir.mjs', '--puerto', puertoApp], { cwd: raiz, env: limpio, stdio: 'inherit' }),
];
clave = null;

let cerrando = false;
const cerrar = (codigo) => {
  if (cerrando) return;
  cerrando = true;
  for (const proceso of procesos) proceso.kill('SIGTERM');
  setTimeout(() => process.exit(codigo), 100).unref();
};

for (const proceso of procesos) {
  proceso.on('error', (error) => {
    console.error(`No se pudo arrancar: ${error.message}`);
    cerrar(1);
  });
  proceso.on('exit', (codigo) => {
    if (!cerrando && codigo) {
      console.error(`Un proceso terminó con código ${codigo}.`);
      cerrar(codigo);
    }
  });
}

process.on('SIGINT', () => cerrar(0));
process.on('SIGTERM', () => cerrar(0));
console.log(`ARCANVEIL estará en http://localhost:${puertoApp}/app/index.html`);
console.log('Ruta heredada: en el juego, «Modelo instalado en este PC» con http://127.0.0.1:11435. Ctrl+C cierra todo.');
