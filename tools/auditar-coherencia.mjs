/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANVEIL · tools/auditar-coherencia.mjs
 * ---------------------------------------------------------------------------
 * ¿Lo que cuenta el juego casa con lo que está pasando?
 *
 * Son fallos que no rompen nada y que un jugador nota en seguida: que al salir
 * del pueblo se anuncie que cierra la fragua, que la apertura se repita en el
 * turno siguiente, que mirar alrededor pueda «fallar». Cada caso de aquí salió
 * de una partida grabada.
 *
 * Se prueban las piezas sueltas, sin arrancar el motor: cada una depende solo
 * de lo que lee del estado, y eso se puede simular.
 *
 *   node tools/auditar-coherencia.mjs
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { TimeSystem } from '../src/world/TimeSystem.js';
import { ActionRouter } from '../src/engine/ActionRouter.js';
import { interpretar } from '../src/engine/IntentParser.js';

let fallos = 0;

function comprobar(bien, texto, detalle = '') {
  if (bien) {
    console.log(`OK   ${texto}`);
  } else {
    fallos += 1;
    console.log(`MAL  ${texto}`);
    if (detalle) console.log(`     ${detalle}`);
  }
}

/* ── Los comercios solo cierran donde estás ─────────────────────────────── */

/**
 * Un `TimeSystem` sin motor: lee de un estado de mentira y apunta lo que
 * narra. Es lo único que toca `_revisarServicios`.
 */
function relojDePrueba(estado) {
  const reloj = Object.create(TimeSystem.prototype);
  reloj._serviciosAnteriores = null;
  reloj._lugarServicios = null;
  reloj.narrado = [];
  reloj.leer = (ruta, porDefecto) => ruta.split('.').reduce((o, k) => o?.[k], estado) ?? porDefecto;
  reloj.emitir = (evento, datos) => { if (evento === 'narrative:direct') reloj.narrado.push(datos.texto); };
  return reloj;
}

{
  const estado = { world: { ubicacion: 'vado_yunque', tiempo: { hora: 10 } } };
  const reloj = relojDePrueba(estado);

  reloj._revisarServicios();                 // foto en el pueblo, todo abierto
  estado.world.ubicacion = 'camino_norte';   // sale al camino a las 10
  reloj._revisarServicios();

  comprobar(!reloj.narrado.some((t) => /^Cierra/.test(t)),
    'salir del pueblo no anuncia que cierran sus comercios',
    `se narró: ${reloj.narrado.join(' | ')}`);
}

{
  const estado = { world: { ubicacion: 'vado_yunque', tiempo: { hora: 18 } } };
  const reloj = relojDePrueba(estado);

  reloj._revisarServicios();                 // las 18, la fragua abierta
  estado.world.tiempo.hora = 20;             // pasa el tiempo sin moverse
  reloj._revisarServicios();

  comprobar(reloj.narrado.some((t) => /fragua/.test(t)),
    'quedarse en el pueblo cuando cierra la fragua sí se cuenta',
    `se narró: ${reloj.narrado.join(' | ') || '(nada)'}`);
}

{
  // Volver al pueblo con la fragua ya cerrada tampoco es un «cierre»: no se
  // vio abrir en esta visita.
  const estado = { world: { ubicacion: 'camino_norte', tiempo: { hora: 21 } } };
  const reloj = relojDePrueba(estado);

  reloj._revisarServicios();
  estado.world.ubicacion = 'vado_yunque';
  reloj._revisarServicios();

  comprobar(!reloj.narrado.some((t) => /^Cierra/.test(t)),
    'llegar a un pueblo de noche no anuncia cierres');
}

/* ── Guardar un arma no se tira, y se hace con la que llevas ────────────── */

/** Un router sin motor, con un inventario de mentira. */
function routerCon(objetos, armaPrincipal = null) {
  const estado = { inventory: { objetos: { porId: objetos }, equipado: { armaPrincipal } } };
  const router = Object.create(ActionRouter.prototype);
  router.leer = (ruta, porDefecto) => ruta.split('.').reduce((o, k) => o?.[k], estado) ?? porDefecto;
  router.sistema = () => null;
  return router;
}

const HACHA = { id: 'o1', refId: 'hacha_mano', nombre: 'Hacha de mano', categoria: 'arma' };

{
  const intencion = interpretar('guardo la espada');
  comprobar(intencion.requiereTirada === false && intencion.tipo !== 'attack',
    '«guardo la espada» no tira dados ni cuenta como ataque',
    `tipo=${intencion.tipo} tirada=${intencion.requiereTirada}`);

  const r = routerCon({ o1: HACHA }, 'o1').enrutar(intencion);
  comprobar(r.ruta === 'local' && r.narracion === 'No llevas espada; guardas el hacha de mano.',
    'sin espada, se guarda el hacha que sí lleva', `salió: ${r.narracion}`);
}

{
  const r = routerCon({ o1: HACHA }, 'o1').enrutar(interpretar('limpio mi hacha junto al fuego'));
  comprobar(r.narracion === 'Limpias tu hacha junto al fuego.',
    'con el arma nombrada, se narra lo que escribió en segunda persona', `salió: ${r.narracion}`);
}

{
  const r = routerCon({}).enrutar(interpretar('guardo la espada'));
  comprobar(/^No llevas espada encima/.test(r.narracion ?? ''),
    'sin ningún arma, lo dice y no inventa una', `salió: ${r.narracion}`);
}

{
  const i = interpretar('guardo la espada y ataco al bandido');
  comprobar(i.tipo === 'attack', 'guardar y atacar en la misma frase sigue siendo un ataque', `tipo=${i.tipo}`);
}

console.log(`\n${fallos ? `${fallos} fallos.` : 'Todo correcto.'}`);
process.exit(fallos ? 1 : 0);
