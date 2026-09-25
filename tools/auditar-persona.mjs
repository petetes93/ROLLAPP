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
import { trasPreposicion, concordar } from '../src/utils/text.js';
import { paraJugador } from '../src/combat/CombatLog.js';
import { RESULTADO } from '../src/combat/AttackResolver.js';
import * as Mapa from '../src/world/MapGraph.js';
import { LUGARES as CATALOGO } from '../src/data/locations.data.js';

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

  // ── Relativo que habla de OTRO ────────────────────────────────────────
  // El verbo se queda como está —lo hizo él, no tú— pero el posesivo sí
  // cambia, porque la forja sigue siendo del jugador.
  ['Busco al capitan Verros, el que quemo mi forja', 'Buscas al capitan Verros, el que quemo tu forja'],
  ['Hablo con quien vendio mi espada', 'Hablas con quien vendio tu espada'],

  // ── Futuro de primera ─────────────────────────────────────────────────
  ['Juro que no descansaré hasta encontrar a Verros', 'Juras que no descansarás hasta encontrar a Verros'],
  ['Volveré mañana', 'Volverás mañana'],

  // ── Verbos regulares que no están en ninguna lista ────────────────────
  // «limpio mi hacha junto al fuego» salía «Limpio tu hacha»: cambiaba el
  // posesivo y no el verbo. Los -iar en primera acaban en -io, igual que un
  // pretérito sin tilde, y la regla que protege al segundo se comía al primero.
  ['limpio mi hacha junto al fuego', 'limpias tu hacha junto al fuego'],
  ['limpio mi hacha', 'limpias tu hacha'],
  ['afilo la espada', 'afilas la espada'],
  ['enciendo una hoguera', 'enciendes una hoguera'],
  ['bebo del arroyo', 'bebes del arroyo'],
  ['cambio de rumbo y estudio el mapa', 'cambias de rumbo y estudias el mapa'],
  ['acaricio al caballo', 'acaricias al caballo'],

  // ── Lo que NO se toca ─────────────────────────────────────────────────
  ['la puerta que cierra mal', 'la puerta que cierra mal'],
  ['me acerco con la mano lejos del arco', 'te acercas con la mano lejos del arco'],
  ['la miro a los ojos', 'la miras a los ojos'],
  ['lo cojo del suelo', 'lo coges del suelo'],

  // ── En plural, con compañeros ─────────────────────────────────────────
  ['esperamos a que anochezca', 'esperáis a que anochezca'],
  ['nos escondemos tras el carro', 'os escondéis tras el carro'],
  ['Ulmir y yo vigilamos el camino', 'Ulmir y tú vigiláis el camino'],
  ['le preguntamos por el hierro', 'le preguntáis por el hierro'],
  ['fuimos al vado ayer', 'fuisteis al vado ayer'],
  ['subimos la cuesta', 'subís la cuesta'],
  ['los ramos del altar', 'los ramos del altar'],

  // ── Los nombres no se conjugan ────────────────────────────────────────
  ['Seldar me acompaña', 'Seldar te acompaña'],
  ['Dadar, ¿qué sabes del hierro?', 'Dadar, ¿qué sabes del hierro?'],
  ['Preguntar a Helmir por tu hermana', 'Preguntas a Helmir por tu hermana'],
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

/** Nombres propios con artículo a media frase. [preposición, nombre, esperado] */
const LUGARES = [
  ['hacia', 'El Camino del Norte', 'hacia el Camino del Norte'],
  ['a', 'El Vado del Yunque', 'al Vado del Yunque'],
  ['de', 'El Vado del Yunque', 'del Vado del Yunque'],
  ['a', 'La Forja Alta', 'a la Forja Alta'],
  ['por', 'Los Pozos Hondos', 'por los Pozos Hondos'],
  ['hacia', 'Saucedo', 'hacia Saucedo'],
];

for (const [prep, nombre, esperado] of LUGARES) {
  const real = trasPreposicion(prep, nombre);
  const bien = real === esperado;
  if (!bien) fallos += 1;
  console.log(`${bien ? 'OK  ' : 'MAL '} ${prep} + ${nombre}`);
  if (!bien) console.log(`     esperado: ${esperado}\n     obtenido: ${real}`);
}

// Lo que `describir` devuelve va detrás de un punto en el parte de viaje: no
// puede empezar en minúscula ni llevar un artículo en mayúscula a media frase.
let descripcionesMal = 0;
let rutasVistas = 0;
const ids = Array.isArray(CATALOGO) ? CATALOGO.map((l) => l.id ?? l.refId) : Object.keys(CATALOGO ?? {});
for (const origen of ids) {
  for (const destino of ids) {
    if (origen === destino) continue;
    const r = Mapa.ruta(origen, destino);
    if (!r?.encontrada) continue;
    rutasVistas += 1;
    const d = Mapa.describir(r);
    if (/\s(por|hacia|a|de)\s(El|La|Los|Las)\s/u.test(d) || /\sy\s(El|La|Los|Las)\s/u.test(d)) {
      descripcionesMal += 1;
      if (descripcionesMal <= 3) console.log(`MAL  ${d}`);
    }
  }
}
// Sin rutas no se ha comprobado nada: eso es un fallo de la prueba, no un OK.
if (descripcionesMal || rutasVistas < 10) fallos += 1;
console.log(`${descripcionesMal || rutasVistas < 10 ? 'MAL ' : 'OK  '} ${rutasVistas} rutas descritas sin artículos en mayúscula a media frase`);

/** Concordancia de género en el parte de combate. [palabra, género, esperado] */
const GENERO = [
  ['envenenado', 'f', 'envenenada'],
  ['aturdido', 'f', 'aturdida'],
  ['sangrando', 'f', 'sangrando'],
  ['ardiendo', 'f', 'ardiendo'],
  ['invisible', 'f', 'invisible'],
  ['envenenado', 'm', 'envenenado'],
];

for (const [palabra, genero, esperado] of GENERO) {
  const real = concordar(palabra, genero);
  const bien = real === esperado;
  if (!bien) fallos += 1;
  console.log(`${bien ? 'OK  ' : 'MAL '} ${palabra} (${genero}) → ${real}`);
}

// Y en una línea de parte de verdad: «Brunhilda queda envenenado».
{
  const linea = paraJugador({
    tipo: 'ataque', resultado: RESULTADO.IMPACTO, ronda: 1, ataque: 'Machete',
    atacante: { id: 'e1', nombre: 'Saqueador A', esJugador: false },
    objetivo: { id: 'jugador', nombre: 'Brunhilda', esJugador: true, genero: 'f' },
    tirada: { total: 15, umbral: 12 },
    dano: { total: 4, tipo: 'cortante', magnitud: 'leve' },
    estados: [{ refId: 'envenenado' }],
    cayo: false,
    objetivoTras: { vida: 20, max: 26, fraccion: 0.77 },
  });
  const bien = /Quedas envenenada/.test(linea) && !/Brunhilda queda/.test(linea);
  if (!bien) fallos += 1;
  console.log(`${bien ? 'OK  ' : 'MAL '} parte: ${linea}`);
}

const total = CASOS.length + PERSONA.length + LUGARES.length + 1 + GENERO.length + 1;
console.log(`\n${total - fallos}/${total} correctos.`);
process.exit(fallos ? 1 : 0);
