/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANVEIL · tools/auditar-cronica.mjs
 * ---------------------------------------------------------------------------
 * Fija lo que el juego entiende de lo que escribe el jugador.
 *
 * Aquí se prueban las dos mitades del sistema:
 *
 *   1. La LECTURA: de una frase salen las personas, lugares, cosas y promesas
 *      que el jugador ha afirmado.
 *   2. La CONCORDANCIA: mencionar algo dos veces no lo duplica ni lo cambia,
 *      solo lo enriquece. Un rasgo registrado no se pierde nunca.
 *
 * Lo segundo es lo que importa de verdad y lo que más fácil se rompe al tocar
 * el código: basta con que `registrarCanon` sustituya en vez de sumar para que
 * la historia del jugador empiece a contradecirse sola.
 *
 *   node tools/auditar-cronica.mjs
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { leerTurno } from '../src/ai/Cronica.js';
import { MemoryStore } from '../src/ai/MemoryStore.js';

let fallos = 0;

const comprobar = (etiqueta, real, esperado) => {
  const bien = JSON.stringify(real) === JSON.stringify(esperado);
  if (!bien) fallos += 1;
  console.log(`${bien ? 'OK  ' : 'MAL '} ${etiqueta}`);
  if (!bien) console.log(`     esperado: ${JSON.stringify(esperado)}\n     obtenido: ${JSON.stringify(real)}`);
};

/* ── 1. Lectura ─────────────────────────────────────────────────────────── */

const ficha = (t) => leerTurno(t).entidades.map((e) => `${e.tipo}:${e.nombre}${e.rasgos.length ? `[${e.rasgos}]` : ''}${e.nota ? `|${e.nota}` : ''}`);

comprobar('persona con cargo y nota',
  ficha('Busco al capitan Verros, el que quemo mi forja'),
  ['persona:Verros[capitan]|quemo mi forja']);

comprobar('el genero lo pone el jugador',
  ficha('Pregunto por mi hermana Nerea'),
  ['persona:Nerea[hermana]']);

comprobar('lugar tras preposicion',
  ficha('Voy hacia Forja Alta'),
  ['lugar:Forja Alta']);

comprobar('el dueño de un objeto es persona, no cosa',
  ficha('Le enseño el medallon de Arven al posadero Delm'),
  ['persona:Arven', 'persona:Delm[posadero]']);

comprobar('una cosa con nombre propio si es cosa',
  ficha('Empuño la espada Amanecer'),
  ['cosa:Amanecer']);

comprobar('una accion corriente no inventa a nadie',
  ficha('Miro alrededor con calma'),
  []);

comprobar('el verbo que abre la frase no es un nombre',
  ficha('Busco agua en el arroyo'),
  []);

comprobar('una promesa, no dos',
  leerTurno('Juro que no descansare hasta encontrar a Verros').promesas,
  ['encontrar a Verros']);

/* ── 2. Concordancia ────────────────────────────────────────────────────── */

const mem = new MemoryStore();

for (const e of leerTurno('Busco al capitan Verros, el que quemo mi forja').entidades) {
  mem.registrarCanon(e, 1);
}
for (const e of leerTurno('Pregunto por Verros').entidades) {
  mem.registrarCanon(e, 5);
}
for (const e of leerTurno('El traidor Verros, el que mato a mi maestro, sigue libre').entidades) {
  mem.registrarCanon(e, 9);
}

const v = mem.deCanon('Verros');

comprobar('no se duplica', mem.canon.length, 1);
comprobar('cuenta las menciones', v.menciones, 3);
comprobar('el rasgo original no se pierde', v.rasgos.includes('capitan'), true);
comprobar('las notas se acumulan, no se pisan', v.notas.length, 2);
comprobar('la primera nota sigue siendo la primera', v.notas[0], 'quemo mi forja');

/* ── 3. Sobrevive al guardado ───────────────────────────────────────────── */

const restaurada = MemoryStore.restaurar(JSON.parse(JSON.stringify(mem.serializar())));
comprobar('el canon se guarda y vuelve', restaurada.deCanon('Verros')?.notas.length, 2);

console.log(`\n${fallos ? `${fallos} fallos.` : 'Todo correcto.'}`);
process.exit(fallos ? 1 : 0);
