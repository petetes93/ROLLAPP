/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANVEIL · combat/InitiativeTracker.js
 * ---------------------------------------------------------------------------
 * Orden de iniciativa y avance de turnos dentro de una ronda.
 *
 * La iniciativa se tira una vez al empezar el combate y se conserva. Volver a
 * tirarla cada ronda haría el combate impredecible de una forma que no aporta:
 * el jugador no puede planificar si no sabe quién actúa después.
 *
 * Un caído no se retira del orden: se salta. Así el índice de turno no baila
 * cuando alguien cae, lo que evita una clase entera de errores sutiles.
 *
 * Funciones puras.
 *
 * Dependencias: Dice, Combatant, StatusEffects.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { tirar } from '../core/Dice.js';
import { COMBATE } from '../config/balance.config.js';
import * as Comb from './Combatant.js';

/* ═══════════════════════════════════════════════════════════════════════════
   TIRADA DE INICIATIVA
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Tira iniciativa para todos los combatientes y devuelve el orden.
 *
 * @param {import('../core/RNG.js').Flujo} flujo
 * @param {Array<Object>} combatientes
 * @param {Object} [opciones]
 * @param {boolean} [opciones.emboscadaJugador=false] El bando aliado actúa primero.
 * @param {boolean} [opciones.emboscadaEnemiga=false] El bando enemigo actúa primero.
 * @returns {{combatientes: Array<Object>, orden: string[], tiradas: Array<Object>}}
 */
export function tirarIniciativa(flujo, combatientes, opciones = {}) {
  const { emboscadaJugador = false, emboscadaEnemiga = false } = opciones;

  const tiradas = [];

  const conIniciativa = combatientes.map((c) => {
    const modDestreza = Math.floor(((c.atributos?.destreza ?? 10) - 10) / 2);

    const modificadores = [{ fuente: 'Destreza', valor: modDestreza }];

    if (COMBATE.iniciativaBase !== 0) {
      modificadores.push({ fuente: 'Base', valor: COMBATE.iniciativaBase });
    }

    // Los estados pueden alterar la iniciativa: congelado ralentiza, acelerado
    // adelanta.
    const modsEstados = Comb.modificadoresDeEstados(c);
    if (modsEstados.iniciativa) {
      modificadores.push({ fuente: 'Estados', valor: modsEstados.iniciativa });
    }

    const resultado = tirar(flujo, { modificadores, umbral: null });

    // Una emboscada no es un bonificador: es un desnivel enorme, para que
    // sorprender importe de verdad.
    let bonoEmboscada = 0;
    if (emboscadaJugador && c.bando === Comb.BANDO.ALIADO) bonoEmboscada = 100;
    if (emboscadaEnemiga && c.bando === Comb.BANDO.ENEMIGO) bonoEmboscada = 100;

    const total = resultado.total + bonoEmboscada;

    tiradas.push({
      id: c.id,
      nombre: c.nombre,
      total,
      natural: resultado.natural,
      emboscada: bonoEmboscada > 0,
    });

    return { ...c, iniciativa: total, _desempate: resultado.natural };
  });

  // Orden descendente. En empate manda el dado natural; si también empata, el
  // jugador va primero, que es lo menos frustrante.
  const ordenados = [...conIniciativa].sort((a, b) => {
    if (b.iniciativa !== a.iniciativa) return b.iniciativa - a.iniciativa;
    if (b._desempate !== a._desempate) return b._desempate - a._desempate;
    return a.esJugador ? -1 : 1;
  });

  return {
    combatientes: ordenados.map(({ _desempate, ...c }) => c),
    orden: ordenados.map((c) => c.id),
    tiradas: tiradas.sort((a, b) => b.total - a.total),
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   AVANCE DE TURNO
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Determina quién actúa a continuación.
 *
 * Los caídos se saltan sin retirarse del orden: así el índice no se descuadra
 * al morir alguien a mitad de ronda.
 *
 * @param {Object} estadoCombate
 * @param {Object} combatientes Mapa de combatientes por identificador.
 * @returns {{siguiente: string|null, indice: number, nuevaRonda: boolean, saltados: string[]}}
 */
export function siguienteTurno(estadoCombate, combatientes) {
  const orden = estadoCombate.iniciativa ?? [];
  if (!orden.length) return { siguiente: null, indice: 0, nuevaRonda: false, saltados: [] };

  const saltados = [];
  let indice = estadoCombate.turnoActual ?? 0;
  let nuevaRonda = false;

  // Se recorre el orden buscando al siguiente que pueda actuar. El tope de
  // vueltas evita un bucle infinito si todos están caídos.
  for (let intentos = 0; intentos <= orden.length; intentos++) {
    indice++;

    if (indice >= orden.length) {
      indice = 0;
      nuevaRonda = true;
    }

    const id = orden[indice];
    const c = combatientes[id];

    if (!c) { saltados.push(id); continue; }
    if (!c.vivo) { saltados.push(id); continue; }

    // Quien pierde el turno por completo se salta aquí, pero sus estados sí se
    // resuelven: eso lo hace CombatManager antes de llamar a esta función.
    return { siguiente: id, indice, nuevaRonda, saltados };
  }

  // Nadie puede actuar: el combate ha terminado.
  return { siguiente: null, indice, nuevaRonda, saltados };
}

/**
 * Comprueba si un combatiente pierde su turno por estados.
 *
 * @param {Object} c
 * @returns {{pierde: boolean, motivo: string|null}}
 */
export function pierdeTurno(c) {
  if (!c?.vivo) return { pierde: true, motivo: 'está fuera de combate' };

  const puedeActuar = Comb.puede(c, 'atacar').puede || Comb.puede(c, 'mover').puede;

  if (!puedeActuar) {
    const bloqueante = (c.estados ?? [])
      .map((e) => e.refId)
      .find((refId) => ['aturdido', 'paralizado', 'moribundo'].includes(refId));

    return { pierde: true, motivo: bloqueante ?? 'no puede actuar' };
  }

  return { pierde: false, motivo: null };
}

/* ═══════════════════════════════════════════════════════════════════════════
   TURNOS ADICIONALES
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Calcula cuántas acciones tiene un combatiente en su turno.
 *
 * El estado `acelerado` concede una acción extra. Es un efecto potente y por
 * eso dura poco.
 *
 * @param {Object} c
 * @returns {number}
 */
export function accionesDisponibles(c) {
  const mods = Comb.modificadoresDeEstados(c);
  return 1 + (mods.ataquesExtra ?? 0);
}

/* ═══════════════════════════════════════════════════════════════════════════
   INSERCIÓN Y RETIRADA
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Inserta un combatiente en el orden con el combate ya empezado.
 *
 * Se usa cuando un jefe invoca refuerzos. El recién llegado tira su iniciativa
 * y se coloca donde le corresponda; si su turno ya pasó en esta ronda, actuará
 * en la siguiente.
 *
 * @param {import('../core/RNG.js').Flujo} flujo
 * @param {Object} estadoCombate
 * @param {Object} nuevo Combatiente a insertar.
 * @param {Object} combatientes
 * @returns {{orden: string[], combatiente: Object, indiceAjustado: number}}
 */
export function insertar(flujo, estadoCombate, nuevo, combatientes) {
  const modDestreza = Math.floor(((nuevo.atributos?.destreza ?? 10) - 10) / 2);

  const resultado = tirar(flujo, {
    modificadores: [{ fuente: 'Destreza', valor: modDestreza }],
    umbral: null,
  });

  const conIniciativa = { ...nuevo, iniciativa: resultado.total };

  const orden = [...(estadoCombate.iniciativa ?? [])];
  const actual = estadoCombate.turnoActual ?? 0;

  // Se busca la posición según la iniciativa.
  let posicion = orden.length;

  for (let i = 0; i < orden.length; i++) {
    const otro = combatientes[orden[i]];
    if (otro && conIniciativa.iniciativa > (otro.iniciativa ?? 0)) {
      posicion = i;
      break;
    }
  }

  orden.splice(posicion, 0, conIniciativa.id);

  // Si se insertó antes del turno actual, el índice se desplaza para que no
  // cambie de quién es el turno.
  const indiceAjustado = posicion <= actual ? actual + 1 : actual;

  return { orden, combatiente: conIniciativa, indiceAjustado };
}

/**
 * Retira a un combatiente del orden.
 *
 * Solo se usa cuando alguien HUYE del combate: los caídos permanecen en el
 * orden y se saltan, para que el índice no baile.
 *
 * @param {Object} estadoCombate
 * @param {string} id
 * @returns {{orden: string[], indiceAjustado: number}}
 */
export function retirar(estadoCombate, id) {
  const orden = estadoCombate.iniciativa ?? [];
  const posicion = orden.indexOf(id);

  if (posicion === -1) {
    return { orden, indiceAjustado: estadoCombate.turnoActual ?? 0 };
  }

  const nuevoOrden = orden.filter((x) => x !== id);
  const actual = estadoCombate.turnoActual ?? 0;

  const indiceAjustado = posicion < actual ? actual - 1 : actual;

  return { orden: nuevoOrden, indiceAjustado: Math.max(0, indiceAjustado) };
}

/* ═══════════════════════════════════════════════════════════════════════════
   CONSULTAS
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Combatiente que actúa ahora.
 * @param {Object} estadoCombate
 * @param {Object} combatientes
 * @returns {Object|null}
 */
export function actuando(estadoCombate, combatientes) {
  const id = estadoCombate.iniciativa?.[estadoCombate.turnoActual ?? 0];
  return id ? combatientes[id] ?? null : null;
}

/**
 * Orden de iniciativa para la interfaz.
 *
 * @param {Object} estadoCombate
 * @param {Object} combatientes
 * @returns {Array<Object>}
 */
export function paraInterfaz(estadoCombate, combatientes) {
  const orden = estadoCombate.iniciativa ?? [];
  const actual = estadoCombate.turnoActual ?? 0;

  return orden.map((id, i) => {
    const c = combatientes[id];
    if (!c) return null;

    return {
      id,
      nombre: c.nombre,
      bando: c.bando,
      esJugador: c.esJugador,
      activo: i === actual,
      vivo: c.vivo,
      iniciativa: c.iniciativa,
      fraccionVida: Comb.fraccionVida(c),
      estados: (c.estados ?? []).length,
      // Se marca a quién le toca después, que es información útil para decidir.
      siguiente: i === (actual + 1) % orden.length,
    };
  }).filter(Boolean);
}

/**
 * Resumen del orden para el director.
 * @param {Object} estadoCombate
 * @param {Object} combatientes
 * @returns {string}
 */
export function paraDirector(estadoCombate, combatientes) {
  const orden = estadoCombate.iniciativa ?? [];
  const actual = estadoCombate.turnoActual ?? 0;

  const activos = orden.map((id) => combatientes[id]).filter((c) => c?.vivo);
  const enPie = activos.filter((c) => c.bando === Comb.BANDO.ENEMIGO);

  if (!enPie.length) return 'No queda nadie en pie frente al personaje.';

  const descripciones = enPie.map((c) => Comb.paraDirector(c));
  const quienActua = combatientes[orden[actual]];

  return `En pie: ${descripciones.join('; ')}. Actúa ahora: ${quienActua?.nombre ?? '?'}.`;
}

/**
 * Comprueba si el combate ha terminado.
 *
 * @param {Object} combatientes
 * @returns {{terminado: boolean, resultado: string|null}}
 */
export function comprobarFin(combatientes) {
  const vivos = Object.values(combatientes).filter((c) => c.vivo);

  const aliados = vivos.filter((c) => c.bando === Comb.BANDO.ALIADO);
  const enemigos = vivos.filter((c) => c.bando === Comb.BANDO.ENEMIGO);

  if (!aliados.length) return { terminado: true, resultado: 'derrota' };
  if (!enemigos.length) return { terminado: true, resultado: 'victoria' };

  return { terminado: false, resultado: null };
}

export default {
  tirarIniciativa,
  siguienteTurno,
  pierdeTurno,
  accionesDisponibles,
  insertar,
  retirar,
  actuando,
  paraInterfaz,
  paraDirector,
  comprobarFin,
};
