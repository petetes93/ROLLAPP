/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANVEIL · npc/NPC.js
 * ---------------------------------------------------------------------------
 * Modelo de personaje no jugador.
 *
 * Un PNJ no es un contenedor de diálogo: es alguien con intereses, memoria y
 * una opinión sobre el personaje que puede cambiar. Cuatro capas:
 *
 *   · IDENTIDAD — nombre, oficio, rasgo memorable. Lo que no cambia.
 *   · ACTITUD — qué opina del personaje ahora mismo. Cambia con lo que haces.
 *   · MEMORIA — qué recuerda de sus encuentros anteriores. Es lo que hace que
 *     volver a ver a alguien signifique algo.
 *   · ESTADO — dónde está, qué hace, si está vivo.
 *
 * La memoria es la capa que más aporta. Sin ella, cada conversación empieza de
 * cero y el mundo se siente amnésico.
 *
 * Funciones puras.
 *
 * Dependencias: factions.data, balance.config, utils.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { obtenerFaccion } from '../data/factions.data.js';
import { SOCIAL } from '../config/balance.config.js';
import { idEntidad, TIPO } from '../utils/id.js';
import { saturar } from '../utils/math.js';
import { truncar } from '../utils/text.js';

/* ═══════════════════════════════════════════════════════════════════════════
   ACTITUDES
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Escala de actitud individual.
 *
 * Distinta de la reputación de facción: puedes caerle bien al herrero aunque su
 * gremio te odie. La gente no es su bandera.
 */
export const ACTITUDES = Object.freeze([
  { clave: 'enemigo', desde: -100, nombre: 'te odia', color: 'peligro' },
  { clave: 'hostil', desde: -60, nombre: 'te detesta', color: 'peligro' },
  { clave: 'receloso', desde: -25, nombre: 'desconfía de ti', color: 'aviso' },
  { clave: 'neutral', desde: -10, nombre: 'te es indiferente', color: 'neutral' },
  { clave: 'cordial', desde: 15, nombre: 'te trata bien', color: 'exito' },
  { clave: 'amigo', desde: 50, nombre: 'te aprecia', color: 'exito' },
  { clave: 'leal', desde: 80, nombre: 'te es leal', color: 'acento' },
]);

/**
 * @param {number} valor
 * @returns {Object}
 */
export function actitudDe(valor) {
  return [...ACTITUDES].reverse().find((a) => valor >= a.desde) ?? ACTITUDES[3];
}

/* ═══════════════════════════════════════════════════════════════════════════
   ESTADOS VITALES
   ═══════════════════════════════════════════════════════════════════════════ */

/** Situación de un PNJ. */
export const SITUACION = Object.freeze({
  VIVO: 'vivo',
  HERIDO: 'herido',
  MUERTO: 'muerto',
  DESAPARECIDO: 'desaparecido',
  MARCHADO: 'marchado',
});

/* ═══════════════════════════════════════════════════════════════════════════
   CREACIÓN
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * @typedef {Object} PersonajeNoJugador
 * @property {string} refId Identificador estable.
 * @property {string} nombre
 * @property {'m'|'f'} genero
 * @property {string} rol Oficio o papel.
 * @property {string} rasgo Detalle físico memorable.
 * @property {string} [linaje]
 * @property {string} [faccion] refId de la facción a la que pertenece.
 * @property {number} actitud -100 a 100.
 * @property {string} situacion
 * @property {string} lugar Dónde suele estar.
 * @property {string} [sublugar]
 * @property {Array<Object>} memoria Encuentros recordados.
 * @property {Object} conocimiento Qué sabe y puede contar.
 * @property {Object} rasgos Personalidad, para la coherencia narrativa.
 * @property {boolean} esMercader
 * @property {string} promptLore Contexto para el director.
 */

/**
 * Crea un PNJ.
 *
 * @param {Object} datos
 * @returns {PersonajeNoJugador}
 */
export function crear(datos) {
  const refId = datos.refId ?? `npc_${(datos.nombre ?? 'anonimo').toLowerCase().replace(/\s+/g, '_')}`;

  return {
    refId,
    id: datos.id ?? idEntidad(TIPO.NPC),

    // ─── Identidad ────────────────────────────────────────────────────────
    nombre: datos.nombre ?? 'Alguien',
    genero: datos.genero ?? 'm',
    rol: datos.rol ?? 'lugareño',
    rasgo: datos.rasgo ?? null,
    linaje: datos.linaje ?? null,
    faccion: datos.faccion ?? null,

    // ─── Actitud ──────────────────────────────────────────────────────────
    actitud: saturar(datos.actitud ?? 0, -100, 100),
    actitudInicial: datos.actitud ?? 0,

    // ─── Estado ───────────────────────────────────────────────────────────
    situacion: datos.situacion ?? SITUACION.VIVO,
    lugar: datos.lugar ?? null,
    sublugar: datos.sublugar ?? null,

    // ─── Memoria ──────────────────────────────────────────────────────────
    memoria: datos.memoria ?? [],
    encuentros: datos.encuentros ?? 0,
    primerEncuentro: datos.primerEncuentro ?? null,
    ultimoEncuentro: datos.ultimoEncuentro ?? null,

    // ─── Lo que sabe ──────────────────────────────────────────────────────
    conocimiento: {
      rumores: datos.conocimiento?.rumores ?? [],
      lugares: datos.conocimiento?.lugares ?? [],
      secretos: datos.conocimiento?.secretos ?? [],
      compartidos: datos.conocimiento?.compartidos ?? [],
    },

    // ─── Personalidad ─────────────────────────────────────────────────────
    // Determina cómo reacciona, para que el director sea coherente entre
    // conversaciones.
    rasgos: {
      apertura: datos.rasgos?.apertura ?? 0.5,      // Cuánto habla de sí mismo.
      codicia: datos.rasgos?.codicia ?? 0.5,        // Cuánto le mueve el dinero.
      valentia: datos.rasgos?.valentia ?? 0.5,      // Si se acobarda.
      lealtad: datos.rasgos?.lealtad ?? 0.5,        // Si traiciona.
      honestidad: datos.rasgos?.honestidad ?? 0.5,  // Si miente.
    },

    // ─── Comercio ─────────────────────────────────────────────────────────
    esMercader: datos.esMercader ?? false,
    inventarioMercader: datos.inventarioMercader ?? null,
    oro: datos.oro ?? null,

    // ─── Narrativa ────────────────────────────────────────────────────────
    promptLore: datos.promptLore ?? null,
    deudas: datos.deudas ?? [],
    promesas: datos.promesas ?? [],
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   ACTITUD
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Modifica la actitud de un PNJ.
 *
 * @param {PersonajeNoJugador} npc
 * @param {number} delta
 * @param {string} [motivo]
 * @returns {{npc: PersonajeNoJugador, anterior: Object, nueva: Object, cambioNivel: boolean}}
 */
export function modificarActitud(npc, delta, motivo) {
  const antes = npc.actitud;
  const despues = saturar(antes + delta, -100, 100);

  const anterior = actitudDe(antes);
  const nueva = actitudDe(despues);

  // Un cambio de actitud significativo se recuerda.
  const memoria = nueva.clave !== anterior.clave && motivo
    ? [...npc.memoria, { tipo: 'actitud', texto: motivo, delta, turno: null }].slice(-SOCIAL.memoriaNPC)
    : npc.memoria;

  return {
    npc: { ...npc, actitud: despues, memoria },
    anterior,
    nueva,
    cambioNivel: nueva.clave !== anterior.clave,
  };
}

/**
 * Actitud efectiva, combinando la individual con la reputación de facción.
 *
 * La individual pesa más: la gente juzga a quien tiene delante antes que a lo
 * que representa. Pero la facción cuenta, y mucho si eres su enemigo declarado.
 *
 * @param {PersonajeNoJugador} npc
 * @param {Record<string, number>} reputaciones
 * @returns {{valor: number, actitud: Object, desglose: Array<Object>}}
 */
export function actitudEfectiva(npc, reputaciones = {}) {
  const desglose = [{ fuente: 'Trato personal', valor: npc.actitud }];

  let total = npc.actitud;

  // ─── Su facción ─────────────────────────────────────────────────────────
  if (npc.faccion) {
    const reputacion = reputaciones[npc.faccion] ?? 0;
    // Se aplica a un tercio: es su facción, no él.
    const aporte = Math.round(reputacion / 3);

    if (aporte !== 0) {
      const faccion = obtenerFaccion(npc.faccion);
      desglose.push({ fuente: faccion?.nombre ?? 'Su facción', valor: aporte });
      total += aporte;
    }
  }

  // ─── Facciones enemigas de la suya ──────────────────────────────────────
  // Si eres aliado de sus enemigos, lo nota.
  if (npc.faccion) {
    const faccion = obtenerFaccion(npc.faccion);

    for (const enemiga of faccion?.enemigas ?? []) {
      const reputacionEnemiga = reputaciones[enemiga] ?? 0;
      if (reputacionEnemiga < 40) continue;

      const penalizacion = -Math.round(reputacionEnemiga / 4);
      const nombreEnemiga = obtenerFaccion(enemiga)?.nombre ?? enemiga;

      desglose.push({ fuente: `Tratas con ${nombreEnemiga}`, valor: penalizacion });
      total += penalizacion;
    }
  }

  const valor = saturar(total, -100, 100);

  return { valor, actitud: actitudDe(valor), desglose };
}

/* ═══════════════════════════════════════════════════════════════════════════
   MEMORIA
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Registra un encuentro.
 *
 * @param {PersonajeNoJugador} npc
 * @param {Object} contexto
 * @param {number} contexto.turno
 * @param {string} [contexto.resumen] Qué pasó.
 * @returns {{npc: PersonajeNoJugador, primeraVez: boolean}}
 */
export function registrarEncuentro(npc, contexto) {
  const primeraVez = npc.encuentros === 0;

  const memoria = contexto.resumen
    ? [...npc.memoria, {
        tipo: 'encuentro',
        texto: truncar(contexto.resumen, 160),
        turno: contexto.turno,
      }].slice(-SOCIAL.memoriaNPC)
    : npc.memoria;

  return {
    npc: {
      ...npc,
      encuentros: npc.encuentros + 1,
      primerEncuentro: npc.primerEncuentro ?? contexto.turno,
      ultimoEncuentro: contexto.turno,
      memoria,
    },
    primeraVez,
  };
}

/**
 * Añade un recuerdo concreto.
 *
 * @param {PersonajeNoJugador} npc
 * @param {string} texto
 * @param {Object} [opciones]
 * @returns {PersonajeNoJugador}
 */
export function recordar(npc, texto, opciones = {}) {
  const entrada = {
    tipo: opciones.tipo ?? 'hecho',
    texto: truncar(texto, 200),
    turno: opciones.turno ?? null,
    peso: opciones.peso ?? 1,
  };

  return {
    ...npc,
    memoria: [...npc.memoria, entrada].slice(-SOCIAL.memoriaNPC),
  };
}

/**
 * Lo que recuerda un PNJ, para el prompt del director.
 *
 * @param {PersonajeNoJugador} npc
 * @param {number} [limite=4]
 * @returns {string}
 */
export function memoriaParaPrompt(npc, limite = 4) {
  if (!npc.memoria.length) return '';

  const relevantes = [...npc.memoria]
    .sort((a, b) => (b.peso ?? 1) - (a.peso ?? 1))
    .slice(0, limite);

  return relevantes.map((m) => m.texto).join('; ');
}

/* ═══════════════════════════════════════════════════════════════════════════
   CONOCIMIENTO
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Información que este PNJ puede compartir y aún no ha compartido.
 *
 * @param {PersonajeNoJugador} npc
 * @returns {{rumores: string[], lugares: string[], secretos: string[]}}
 */
export function puedeContar(npc) {
  const compartidos = new Set(npc.conocimiento.compartidos);

  return {
    rumores: npc.conocimiento.rumores.filter((r) => !compartidos.has(r)),
    lugares: npc.conocimiento.lugares.filter((l) => !compartidos.has(l)),
    // Los secretos requieren confianza: no se cuentan a un desconocido.
    secretos: npc.actitud >= 50
      ? npc.conocimiento.secretos.filter((s) => !compartidos.has(s))
      : [],
  };
}

/**
 * Marca una información como ya compartida.
 *
 * @param {PersonajeNoJugador} npc
 * @param {string} info
 * @returns {PersonajeNoJugador}
 */
export function marcarCompartido(npc, info) {
  if (npc.conocimiento.compartidos.includes(info)) return npc;

  return {
    ...npc,
    conocimiento: {
      ...npc.conocimiento,
      compartidos: [...npc.conocimiento.compartidos, info],
    },
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   DEUDAS Y PROMESAS
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Registra una deuda o promesa.
 *
 * Es lo que da peso a las palabras del jugador: prometer algo y no cumplirlo
 * tiene consecuencias, porque alguien lo tiene apuntado.
 *
 * @param {PersonajeNoJugador} npc
 * @param {Object} datos
 * @param {'deuda'|'promesa'} datos.clase
 * @param {string} datos.texto
 * @param {'jugador'|'npc'} datos.deudor Quién debe.
 * @param {number} [datos.turno]
 * @returns {PersonajeNoJugador}
 */
export function anotarCompromiso(npc, datos) {
  const entrada = {
    id: idEntidad(TIPO.EVENTO),
    texto: truncar(datos.texto, 200),
    deudor: datos.deudor,
    turno: datos.turno ?? null,
    cumplido: false,
  };

  const clave = datos.clase === 'deuda' ? 'deudas' : 'promesas';

  return { ...npc, [clave]: [...npc[clave], entrada] };
}

/**
 * Marca un compromiso como cumplido.
 *
 * @param {PersonajeNoJugador} npc
 * @param {string} id
 * @param {boolean} [cumplido=true]
 * @returns {{npc: PersonajeNoJugador, deltaActitud: number}}
 */
export function resolverCompromiso(npc, id, cumplido = true) {
  let deltaActitud = 0;

  const resolver = (lista) => lista.map((c) => {
    if (c.id !== id) return c;

    // Cumplir lo prometido sube la actitud; incumplirlo la hunde.
    deltaActitud = cumplido
      ? (c.deudor === 'jugador' ? 20 : 5)
      : (c.deudor === 'jugador' ? -30 : -5);

    return { ...c, cumplido, resuelto: true };
  });

  return {
    npc: { ...npc, deudas: resolver(npc.deudas), promesas: resolver(npc.promesas) },
    deltaActitud,
  };
}

/**
 * Compromisos pendientes del jugador con este PNJ.
 *
 * @param {PersonajeNoJugador} npc
 * @returns {Array<Object>}
 */
export function pendientes(npc) {
  return [...npc.deudas, ...npc.promesas]
    .filter((c) => !c.cumplido && c.deudor === 'jugador');
}

/* ═══════════════════════════════════════════════════════════════════════════
   SITUACIÓN
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Cambia la situación de un PNJ.
 *
 * Que la muerte sea un estado y no una eliminación importa: el mundo debe
 * recordar que alguien murió y quién lo mató.
 *
 * @param {PersonajeNoJugador} npc
 * @param {string} situacion
 * @param {string} [motivo]
 * @returns {PersonajeNoJugador}
 */
export function cambiarSituacion(npc, situacion, motivo) {
  const memoria = motivo
    ? [...npc.memoria, { tipo: 'situacion', texto: motivo, peso: 3 }].slice(-SOCIAL.memoriaNPC)
    : npc.memoria;

  return { ...npc, situacion, memoria, motivoSituacion: motivo ?? null };
}

/**
 * @param {PersonajeNoJugador} npc
 * @returns {boolean}
 */
export function estaDisponible(npc) {
  return npc.situacion === SITUACION.VIVO || npc.situacion === SITUACION.HERIDO;
}

/* ═══════════════════════════════════════════════════════════════════════════
   PRESENTACIÓN
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Datos del PNJ para la interfaz.
 *
 * @param {PersonajeNoJugador} npc
 * @param {Record<string, number>} [reputaciones]
 * @returns {Object}
 */
export function paraInterfaz(npc, reputaciones) {
  const efectiva = actitudEfectiva(npc, reputaciones);

  return {
    refId: npc.refId,
    nombre: npc.nombre,
    rol: npc.rol,
    rasgo: npc.rasgo,
    faccion: npc.faccion ? obtenerFaccion(npc.faccion)?.nombre : null,
    actitud: efectiva.valor,
    etiquetaActitud: efectiva.actitud.nombre,
    colorActitud: efectiva.actitud.color,
    situacion: npc.situacion,
    encuentros: npc.encuentros,
    esMercader: npc.esMercader,
    pendientes: pendientes(npc).length,
    disponible: estaDisponible(npc),
  };
}

/**
 * Descripción del PNJ para el director.
 *
 * Incluye todo lo que necesita para ser coherente: quién es, qué opina del
 * personaje, qué recuerda y qué le debe.
 *
 * @param {PersonajeNoJugador} npc
 * @param {Record<string, number>} [reputaciones]
 * @returns {string}
 */
export function paraDirector(npc, reputaciones) {
  const partes = [];

  // ─── Identidad ──────────────────────────────────────────────────────────
  const identidad = [npc.nombre];
  if (npc.rol) identidad.push(`(${npc.rol}${npc.rasgo ? `, ${npc.rasgo}` : ''})`);
  partes.push(identidad.join(' '));

  if (npc.promptLore) partes.push(npc.promptLore);

  // ─── Facción ────────────────────────────────────────────────────────────
  if (npc.faccion) {
    const f = obtenerFaccion(npc.faccion);
    if (f) partes.push(`Pertenece a ${f.nombre}.`);
  }

  // ─── Actitud ────────────────────────────────────────────────────────────
  const efectiva = actitudEfectiva(npc, reputaciones);
  partes.push(`Actitud hacia el personaje: ${efectiva.actitud.nombre}.`);

  // El motivo de una actitud negativa da material narrativo.
  const negativos = efectiva.desglose.filter((d) => d.valor < -5);
  if (negativos.length) {
    partes.push(`Le pesa: ${negativos.map((d) => d.fuente.toLowerCase()).join(', ')}.`);
  }

  // ─── Historia compartida ────────────────────────────────────────────────
  if (npc.encuentros === 0) {
    partes.push('No se conocen.');
  } else if (npc.encuentros === 1) {
    partes.push('Se han visto una vez antes.');
  } else {
    partes.push(`Se han visto ${npc.encuentros} veces.`);
  }

  const memoria = memoriaParaPrompt(npc);
  if (memoria) partes.push(`Recuerda: ${memoria}.`);

  // ─── Compromisos ────────────────────────────────────────────────────────
  const deudas = pendientes(npc);
  if (deudas.length) {
    partes.push(`PENDIENTE: el personaje le debe ${deudas.map((d) => d.texto).join('; ')}.`);
  }

  // ─── Personalidad ───────────────────────────────────────────────────────
  const rasgos = [];
  if (npc.rasgos.honestidad < 0.3) rasgos.push('miente con facilidad');
  if (npc.rasgos.codicia > 0.7) rasgos.push('el dinero le mueve mucho');
  if (npc.rasgos.valentia < 0.3) rasgos.push('se acobarda');
  if (npc.rasgos.apertura > 0.7) rasgos.push('habla más de lo que debería');
  if (npc.rasgos.lealtad > 0.7) rasgos.push('es leal a los suyos');

  if (rasgos.length) partes.push(`Carácter: ${rasgos.join(', ')}.`);

  return partes.join(' ');
}

/**
 * Presentación narrativa la primera vez que aparece.
 *
 * @param {PersonajeNoJugador} npc
 * @returns {string}
 */
export function presentar(npc) {
  const partes = [npc.nombre];

  if (npc.rol) partes.push(npc.rol);
  if (npc.rasgo) partes.push(npc.rasgo);

  return partes.join(', ');
}

export default {
  ACTITUDES,
  SITUACION,
  actitudDe,
  crear,
  modificarActitud,
  actitudEfectiva,
  registrarEncuentro,
  recordar,
  memoriaParaPrompt,
  puedeContar,
  marcarCompartido,
  anotarCompromiso,
  resolverCompromiso,
  pendientes,
  cambiarSituacion,
  estaDisponible,
  paraInterfaz,
  paraDirector,
  presentar,
};
