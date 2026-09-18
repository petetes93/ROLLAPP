/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANUM · combat/CombatLog.js
 * ---------------------------------------------------------------------------
 * Registro de la refriega.
 *
 * Dos consumidores con necesidades opuestas:
 *
 *   · EL JUGADOR quiere saber qué acaba de pasar, con números concretos. «17
 *     de daño cortante, crítico» es información accionable.
 *   · EL DIRECTOR quiere material narrativo, no una hoja de cálculo. Necesita
 *     saber que el golpe fue devastador y que el enemigo está a punto de caer.
 *
 * Este módulo produce ambas versiones del mismo registro. También genera el
 * resumen final del combate, que es lo que se guarda en la memoria a largo
 * plazo: dentro de treinta turnos importará que ganaste, no cuánto daño hiciste
 * en la ronda tres.
 *
 * Funciones puras.
 *
 * Dependencias: DamageCalculator, AttackResolver, narrative.templates, statuses.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { TIPOS_DANO, magnitud } from './DamageCalculator.js';
import { RESULTADO } from './AttackResolver.js';
import { COMBATE as PLANTILLAS } from '../data/narrative.templates.js';
import { obtenerEstado } from '../data/statuses.data.js';

/* ═══════════════════════════════════════════════════════════════════════════
   ENTRADAS
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Construye una entrada de registro a partir de un ataque resuelto.
 *
 * @param {Object} resultado Salida de AttackResolver.resolver().
 * @param {Object} contexto
 * @returns {Object}
 */
export function entradaAtaque(resultado, contexto) {
  const { ronda, atacante, objetivo, ataque } = contexto;

  return {
    ronda,
    tipo: 'ataque',
    resultado: resultado.resultado,

    atacante: { id: atacante.id, nombre: atacante.nombre, esJugador: atacante.esJugador },
    objetivo: { id: objetivo.id, nombre: objetivo.nombre, esJugador: objetivo.esJugador },

    ataque: ataque?.nombre ?? 'ataque',

    tirada: resultado.tirada
      ? {
          natural: resultado.tirada.natural,
          total: resultado.tirada.total,
          umbral: resultado.tirada.umbral,
          critico: resultado.tirada.critico,
          pifia: resultado.tirada.pifia,
        }
      : null,

    dano: resultado.dano
      ? {
          total: resultado.dano.total,
          tipo: resultado.dano.tipo,
          bloqueado: resultado.dano.bloqueado,
          afinidad: resultado.dano.afinidad,
          magnitud: magnitud(resultado.dano.total, objetivo),
        }
      : null,

    estados: resultado.estadosAplicados ?? [],
    vidaRobada: resultado.vidaRobada ?? 0,
    cayo: resultado.cayo,

    // Estado del objetivo tras el golpe: es lo que el director necesita para
    // narrar la reacción.
    objetivoTras: {
      vida: resultado.objetivo.vida.actual,
      max: resultado.objetivo.vida.max,
      fraccion: resultado.objetivo.vida.actual / Math.max(1, resultado.objetivo.vida.max),
    },
  };
}

/**
 * Entrada de un efecto periódico.
 *
 * @param {Object} evento
 * @param {Object} combatiente
 * @param {number} ronda
 * @returns {Object}
 */
export function entradaPeriodico(evento, combatiente, ronda) {
  return {
    ronda,
    tipo: evento.tipo === 'curacion_periodica' ? 'curacion' : 'dano_periodico',
    objetivo: { id: combatiente.id, nombre: combatiente.nombre, esJugador: combatiente.esJugador },
    estado: evento.nombre,
    cantidad: evento.cantidad,
    acumulaciones: evento.acumulaciones ?? 1,
  };
}

/**
 * Entrada de un suceso singular: cambio de fase, invocación, huida.
 *
 * @param {string} tipo
 * @param {Object} datos
 * @param {number} ronda
 * @returns {Object}
 */
export function entradaSuceso(tipo, datos, ronda) {
  return { ronda, tipo, ...datos };
}

/* ═══════════════════════════════════════════════════════════════════════════
   NARRACIÓN PARA EL JUGADOR
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Convierte una entrada en la línea que ve el jugador.
 *
 * Es concreta y con números: en combate, saber que has hecho 17 y que al
 * enemigo le quedan 8 es lo que permite decidir el turno siguiente.
 *
 * @param {Object} entrada
 * @returns {string}
 */
export function paraJugador(entrada) {
  switch (entrada.tipo) {
    case 'ataque': return _lineaAtaque(entrada);
    case 'dano_periodico':
      return `${entrada.objetivo.nombre} sufre ${entrada.cantidad} de daño por ${entrada.estado.toLowerCase()}.`;
    case 'curacion':
      return `${entrada.objetivo.nombre} recupera ${entrada.cantidad} de vida.`;
    case 'fase':
      return entrada.narracion ?? `${entrada.jefe} cambia de comportamiento.`;
    case 'invocacion':
      return entrada.narracion ?? 'Llegan refuerzos.';
    case 'huida':
      return `${entrada.nombre} escapa del combate.`;
    case 'caida':
      return `${entrada.nombre} cae.`;
    case 'estado_expirado':
      return `${entrada.nombre}: se le pasa el efecto de ${entrada.estado.toLowerCase()}.`;
    case 'salvacion':
      return `${entrada.nombre} se libra de ${entrada.estado.toLowerCase()}.`;
    default:
      return '';
  }
}

/**
 * @param {Object} e
 * @returns {string}
 * @private
 */
function _lineaAtaque(e) {
  const quien = e.atacante.esJugador ? 'Atacas' : `${e.atacante.nombre} ataca`;
  const aQuien = e.objetivo.esJugador ? 'te' : `a ${e.objetivo.nombre}`;

  switch (e.resultado) {
    case RESULTADO.ESQUIVADO:
      return e.objetivo.esJugador
        ? `Esquivas el ataque de ${e.atacante.nombre}.`
        : `${e.objetivo.nombre} esquiva tu ataque.`;

    case RESULTADO.FALLO:
      return `${quien} y falla. (${e.tirada?.total} contra ${e.tirada?.umbral})`;

    case RESULTADO.PIFIA:
      return `${quien} y falla estrepitosamente. (1 natural)`;

    case RESULTADO.IMPOSIBLE:
      return `${e.atacante.nombre} no puede atacar.`;

    case RESULTADO.CRITICO:
    case RESULTADO.IMPACTO: {
      const partes = [];

      const verbo = e.resultado === RESULTADO.CRITICO ? 'golpea de lleno' : 'acierta';
      partes.push(`${quien} ${aQuien} y ${verbo}: ${e.dano.total} de daño`);

      if (e.dano.tipo) partes.push(TIPOS_DANO[e.dano.tipo]?.nombre ?? e.dano.tipo);

      const notas = [];
      if (e.resultado === RESULTADO.CRITICO) notas.push('crítico');
      if (e.dano.bloqueado > 0) notas.push(`${e.dano.bloqueado} absorbidos`);
      if (e.dano.afinidad === 'resistente') notas.push('resistido');
      if (e.dano.afinidad === 'vulnerable') notas.push('vulnerable');
      if (e.vidaRobada > 0) notas.push(`+${e.vidaRobada} de vida robada`);

      let linea = partes.join(' ');
      if (notas.length) linea += ` (${notas.join(', ')})`;
      linea += '.';

      // Estados aplicados.
      for (const est of e.estados ?? []) {
        const estado = obtenerEstado(est.refId);
        if (estado) linea += ` ${e.objetivo.nombre} queda ${estado.nombre.toLowerCase()}.`;
      }

      if (e.cayo) linea += ` ${e.objetivo.nombre} cae.`;

      return linea;
    }

    default:
      return '';
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   NARRACIÓN PARA EL DIRECTOR
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Convierte una tanda de entradas en material narrativo para el director.
 *
 * Sin números: el director necesita saber que el golpe fue devastador y que el
 * enemigo cojea, no las cifras exactas.
 *
 * @param {Array<Object>} entradas Entradas de la ronda.
 * @returns {string}
 */
export function paraDirector(entradas) {
  const lineas = [];

  for (const e of entradas) {
    switch (e.tipo) {
      case 'ataque': {
        if (e.resultado === RESULTADO.ESQUIVADO) {
          lineas.push(`${e.objetivo.nombre} esquivó el ataque de ${e.atacante.nombre}.`);
          break;
        }
        if (e.resultado === RESULTADO.FALLO || e.resultado === RESULTADO.PIFIA) {
          lineas.push(`${e.atacante.nombre} falló su ataque${e.resultado === RESULTADO.PIFIA ? ' de forma torpe' : ''}.`);
          break;
        }
        if (!e.dano) break;

        const golpe = `${e.atacante.nombre} alcanzó a ${e.objetivo.nombre} con un golpe ${e.dano.magnitud}`;
        const estados = (e.estados ?? [])
          .map((s) => obtenerEstado(s.refId)?.nombre?.toLowerCase())
          .filter(Boolean);

        let linea = golpe;
        if (estados.length) linea += `, dejándolo ${estados.join(' y ')}`;
        if (e.cayo) linea += '. Cayó';
        else if (e.objetivoTras.fraccion < 0.25) linea += '. Está al límite';

        lineas.push(`${linea}.`);
        break;
      }

      case 'dano_periodico':
        lineas.push(`${e.objetivo.nombre} sigue sufriendo por ${e.estado.toLowerCase()}.`);
        break;

      case 'fase':
        lineas.push(e.narracion ?? `${e.jefe} cambió de comportamiento.`);
        break;

      case 'invocacion':
        lineas.push(e.narracion ?? 'Llegaron refuerzos enemigos.');
        break;

      case 'huida':
        lineas.push(`${e.nombre} huyó del combate.`);
        break;
    }
  }

  return lineas.join(' ');
}

/* ═══════════════════════════════════════════════════════════════════════════
   RESUMEN DEL COMBATE
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Resumen de toda la refriega, para la memoria a largo plazo.
 *
 * Dentro de treinta turnos importará que ganaste y a qué precio, no cuánto daño
 * hiciste en la ronda tres.
 *
 * @param {Array<Object>} registro Todas las entradas.
 * @param {Object} contexto
 * @returns {{texto: string, estadisticas: Object}}
 */
export function resumir(registro, contexto) {
  const { resultado, rondas, enemigos, jugadorInicial, jugadorFinal } = contexto;

  // ─── Estadísticas ───────────────────────────────────────────────────────
  const ataquesJugador = registro.filter((e) => e.tipo === 'ataque' && e.atacante?.esJugador);
  const impactos = ataquesJugador.filter((e) => e.dano);

  const estadisticas = {
    rondas,
    ataques: ataquesJugador.length,
    impactos: impactos.length,
    fallos: ataquesJugador.length - impactos.length,
    criticos: ataquesJugador.filter((e) => e.resultado === RESULTADO.CRITICO).length,
    danoInfligido: impactos.reduce((a, e) => a + (e.dano?.total ?? 0), 0),
    danoRecibido: registro
      .filter((e) => (e.tipo === 'ataque' && e.objetivo?.esJugador)
        || (e.tipo === 'dano_periodico' && e.objetivo?.esJugador))
      .reduce((a, e) => a + (e.dano?.total ?? e.cantidad ?? 0), 0),
    enemigosDerrotados: registro.filter((e) => e.tipo === 'caida' && !e.esJugador).length,
    enemigosHuidos: registro.filter((e) => e.tipo === 'huida').length,
    precision: ataquesJugador.length ? impactos.length / ataquesJugador.length : 0,
  };

  // ─── Texto ──────────────────────────────────────────────────────────────
  const nombres = [...new Set(enemigos.map((e) => e.nombreBase ?? e.nombre))];
  const contra = nombres.length === 1
    ? nombres[0]
    : `${nombres.slice(0, -1).join(', ')} y ${nombres.at(-1)}`;

  const partes = [];

  switch (resultado) {
    case 'victoria':
      partes.push(`Combate contra ${contra}: victoria en ${rondas} ronda${rondas === 1 ? '' : 's'}.`);
      break;
    case 'derrota':
      partes.push(`Combate contra ${contra}: derrota.`);
      break;
    case 'huida':
      partes.push(`Combate contra ${contra}: el personaje escapó.`);
      break;
    default:
      partes.push(`Combate contra ${contra}: quedó en tablas.`);
  }

  // El precio pagado importa más que las cifras.
  const vidaPerdida = (jugadorInicial?.vida?.actual ?? 0) - (jugadorFinal?.vida?.actual ?? 0);
  const fraccionFinal = (jugadorFinal?.vida?.actual ?? 0) / Math.max(1, jugadorFinal?.vida?.max ?? 1);

  if (vidaPerdida <= 0) {
    partes.push('Salió sin un rasguño.');
  } else if (fraccionFinal < 0.2) {
    partes.push('Salió al borde de la muerte.');
  } else if (fraccionFinal < 0.5) {
    partes.push('Salió malherido.');
  }

  if (estadisticas.enemigosHuidos > 0) {
    partes.push(`${estadisticas.enemigosHuidos} enemigo${estadisticas.enemigosHuidos === 1 ? '' : 's'} escapó.`);
  }

  return { texto: partes.join(' '), estadisticas };
}

/* ═══════════════════════════════════════════════════════════════════════════
   APERTURA Y CIERRE
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Línea de apertura del combate.
 *
 * @param {import('../core/RNG.js').Flujo} flujo
 * @param {Array<Object>} enemigos
 * @param {Object} [opciones]
 * @returns {string}
 */
export function apertura(flujo, enemigos, opciones = {}) {
  const nombres = [...new Set(enemigos.map((e) => e.nombreBase ?? e.nombre))];
  const cuantos = enemigos.length;

  const descripcion = cuantos === 1
    ? nombres[0]
    : `${cuantos} ${nombres.length === 1 ? (enemigos[0].plural ?? nombres[0]) : nombres.join(' y ')}`;

  if (opciones.emboscadaEnemiga) {
    return `Te caen encima sin aviso: ${descripcion}.`;
  }
  if (opciones.emboscadaJugador) {
    return `Los tienes a tiro y no te han visto: ${descripcion}.`;
  }

  const base = flujo.elegir(PLANTILLAS.inicio);
  return `${base} ${descripcion}.`;
}

/**
 * Línea de cierre del combate.
 *
 * @param {import('../core/RNG.js').Flujo} flujo
 * @param {string} resultado
 * @returns {string}
 */
export function cierre(flujo, resultado) {
  switch (resultado) {
    case 'victoria': return flujo.elegir(PLANTILLAS.victoria);
    case 'derrota': return flujo.elegir(PLANTILLAS.derrota);
    case 'huida': return flujo.elegir(PLANTILLAS.huida);
    default: return 'El combate se detiene sin un vencedor claro.';
  }
}

export default {
  entradaAtaque,
  entradaPeriodico,
  entradaSuceso,
  paraJugador,
  paraDirector,
  resumir,
  apertura,
  cierre,
};
