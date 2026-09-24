/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANVEIL · tools/auditar-persona.mjs
 * ---------------------------------------------------------------------------
 * Fija la conversión de primera a segunda persona.
 *
 * Es la pieza que más se nota cuando falla, porque su resultado sale tal cual
 * en la primera línea de cada turno. Y falla en silencio: «Te sientes en la
 * taberna» es una frase perfectamente formada que significa otra cosa.
 *
 * Los casos con `->` comprueban una conversión; los casos `igual` comprueban
 * que algo NO se toca, que es la mitad del trabajo: una regla que convierte de
 * más rompe frases que estaban bien.
 *
 *   node tools/auditar-persona.mjs
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { aSegundaPersona, esPrimeraPersona } from '../src/ai/Persona.js';

/** [entrada, salida esperada] */
const CASOS = [
  // ── Lo básico ─────────────────────────────────────────────────────────
  ['Me acerco', 'Te acercas'],
  ['anoto lo descubierto', 'anotas lo descubierto'],
  ['me acerco al barquero y le enseño mi medallon', 'te acercas al barquero y le enseñas tu medallon'],

  // ── Infinitivo de las sugerencias ─────────────────────────────────────
  ['Preguntar a Helmir por tu hermana', 'Preguntas a Helmir por tu hermana'],

  // ── Sentarse contra sentir ────────────────────────────────────────────
  ['Me siento en la taberna', 'Te sientas en la taberna'],
  ['me siento junto al fuego', 'te sientas junto al fuego'],
  ['siento que algo va mal', 'sientes que algo va mal'],
  ['Me siento mal', 'Te sientes mal'],

  // ── Subjuntivo tras «que» ─────────────────────────────────────────────
  ['Ataco al primer enemigo que vea', 'Atacas al primer enemigo que veas'],
  ['espero hasta que pueda pasar', 'esperas hasta que puedas pasar'],

  // ── Lo que NO se toca ─────────────────────────────────────────────────
  ['la puerta que cierra mal', 'la puerta que cierra mal'],
  ['me acerco con la mano lejos del arco', 'te acercas con la mano lejos del arco'],
  ['la miro a los ojos', 'la miras a los ojos'],
  ['lo cojo del suelo', 'lo coges del suelo'],
];

/** [texto, si debe detectarse como primera persona] */
const PERSONA = [
  ['Perdio la forja de su padre en un incendio', false],
  ['Perdí a mi maestro en el asedio', true],
  ['Mi hermana cruzo el vado y no volvio', true],
];

let fallos = 0;

for (const [entrada, esperado] of CASOS) {
  const real = aSegundaPersona(entrada);
  const bien = real === esperado;
  if (!bien) fallos += 1;
  console.log(`${bien ? 'OK  ' : 'MAL '} ${entrada}`);
  if (!bien) console.log(`     esperado: ${esperado}\n     obtenido: ${real}`);
}

for (const [texto, esperado] of PERSONA) {
  const real = esPrimeraPersona(texto);
  const bien = real === esperado;
  if (!bien) fallos += 1;
  console.log(`${bien ? 'OK  ' : 'MAL '} [${esperado ? '1ª' : '3ª'}] ${texto}`);
}

const total = CASOS.length + PERSONA.length;
console.log(`\n${total - fallos}/${total} correctos.`);
process.exit(fallos ? 1 : 0);
