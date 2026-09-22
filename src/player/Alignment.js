/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANVEIL · player/Alignment.js
 * ---------------------------------------------------------------------------
 * Alineamiento en dos ejes continuos, no en nueve casillas.
 *
 *   Moral: crueldad (−100) ←→ bondad (+100)
 *   Orden: caos (−100)     ←→ ley (+100)
 *
 * Por qué ejes y no casillas: el personaje no elige ser «neutral bueno» al
 * empezar y luego actúa como quiere. Empieza cerca del centro y se desplaza por
 * lo que HACE. La etiqueta es una lectura del estado actual, no una promesa.
 *
 * Esto le da al director un dato valioso: no «este personaje es bueno», sino
 * «este personaje ha ido derivando hacia la crueldad en los últimos turnos». Un
 * mundo que reacciona a eso se siente vivo.
 *
 * Funciones puras.
 *
 * Dependencias: config/balance.config.js, utils/math.js.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { SOCIAL } from '../config/balance.config.js';
import { saturar } from '../utils/math.js';

/* ═══════════════════════════════════════════════════════════════════════════
   LECTURA DE POSICIÓN
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Etiqueta del eje moral según su valor.
 * @param {number} valor −100 a 100
 * @returns {string}
 */
export function etiquetaMoral(valor) {
  const b = SOCIAL.alineamiento.bandaNeutral;
  if (valor >= 70) return 'compasivo';
  if (valor >= b) return 'bienintencionado';
  if (valor > -b) return 'pragmático';
  if (valor > -70) return 'despiadado';
  return 'cruel';
}

/**
 * Etiqueta del eje de orden según su valor.
 * @param {number} valor
 * @returns {string}
 */
export function etiquetaOrden(valor) {
  const b = SOCIAL.alineamiento.bandaNeutral;
  if (valor >= 70) return 'férreo';
  if (valor >= b) return 'metódico';
  if (valor > -b) return 'flexible';
  if (valor > -70) return 'imprevisible';
  return 'anárquico';
}

/**
 * Descripción combinada de ambos ejes.
 *
 * @param {Object} alineamiento { moral, orden }
 * @returns {{moral: string, orden: string, resumen: string, cuadrante: string}}
 */
export function describir(alineamiento) {
  const moral = alineamiento?.moral ?? 0;
  const orden = alineamiento?.orden ?? 0;
  const b = SOCIAL.alineamiento.bandaNeutral;

  const eMoral = etiquetaMoral(moral);
  const eOrden = etiquetaOrden(orden);

  // El cuadrante sirve al director para decidir cómo reacciona el mundo.
  let cuadrante;
  if (Math.abs(moral) < b && Math.abs(orden) < b) cuadrante = 'indefinido';
  else if (moral >= b && orden >= b) cuadrante = 'guardián';
  else if (moral >= b && orden <= -b) cuadrante = 'espíritu libre';
  else if (moral <= -b && orden >= b) cuadrante = 'implacable';
  else if (moral <= -b && orden <= -b) cuadrante = 'destructor';
  else if (moral >= b) cuadrante = 'benévolo';
  else if (moral <= -b) cuadrante = 'egoísta';
  else if (orden >= b) cuadrante = 'disciplinado';
  else cuadrante = 'errático';

  return {
    moral: eMoral,
    orden: eOrden,
    resumen: `${eOrden} y ${eMoral}`,
    cuadrante,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   DESPLAZAMIENTO
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Magnitudes de desplazamiento disponibles.
 * @readonly
 */
export const PASO = Object.freeze({
  MENOR: SOCIAL.alineamiento.pasoMenor,
  MEDIO: SOCIAL.alineamiento.pasoMedio,
  MAYOR: SOCIAL.alineamiento.pasoMayor,
});

/**
 * Catálogo de acciones con consecuencia moral.
 *
 * ConsequenceEngine lo consulta tras cada turno. Que esté aquí como datos, y no
 * repartido en ifs por el motor, permite ajustar el peso moral del juego
 * editando una tabla.
 */
export const ACCIONES_MORALES = Object.freeze({
  // — Eje moral —
  salvar_inocente: { moral: PASO.MAYOR, orden: 0, texto: 'Salvaste a alguien que no podía salvarse solo' },
  ayudar_sin_pago: { moral: PASO.MEDIO, orden: 0, texto: 'Ayudaste sin pedir nada a cambio' },
  perdonar_enemigo: { moral: PASO.MEDIO, orden: -PASO.MENOR, texto: 'Perdonaste a quien podías haber matado' },
  compartir_recursos: { moral: PASO.MENOR, orden: 0, texto: 'Compartiste lo que tenías' },
  proteger_debil: { moral: PASO.MEDIO, orden: 0, texto: 'Te interpusiste por alguien más débil' },

  matar_indefenso: { moral: -PASO.MAYOR, orden: 0, texto: 'Mataste a alguien que no podía defenderse' },
  traicionar_confianza: { moral: -PASO.MAYOR, orden: -PASO.MEDIO, texto: 'Traicionaste a quien confiaba en ti' },
  robar_necesitado: { moral: -PASO.MEDIO, orden: -PASO.MENOR, texto: 'Robaste a quien tenía menos que tú' },
  extorsionar: { moral: -PASO.MEDIO, orden: 0, texto: 'Sacaste provecho del miedo ajeno' },
  abandonar_aliado: { moral: -PASO.MEDIO, orden: -PASO.MENOR, texto: 'Dejaste atrás a alguien que contaba contigo' },
  torturar: { moral: -PASO.MAYOR, orden: 0, texto: 'Recurriste a la tortura' },

  // — Eje de orden —
  cumplir_palabra: { moral: PASO.MENOR, orden: PASO.MEDIO, texto: 'Cumpliste lo prometido aunque costara' },
  respetar_ley: { moral: 0, orden: PASO.MENOR, texto: 'Acataste la ley pudiendo saltártela' },
  entregar_criminal: { moral: PASO.MENOR, orden: PASO.MEDIO, texto: 'Entregaste a un criminal a las autoridades' },
  honrar_tradicion: { moral: 0, orden: PASO.MENOR, texto: 'Respetaste una costumbre ajena' },
  jurar_lealtad: { moral: 0, orden: PASO.MAYOR, texto: 'Empeñaste tu palabra formalmente' },

  romper_juramento: { moral: -PASO.MEDIO, orden: -PASO.MAYOR, texto: 'Rompiste un juramento' },
  desafiar_autoridad: { moral: 0, orden: -PASO.MEDIO, texto: 'Desafiaste a la autoridad establecida' },
  mentir_beneficio: { moral: -PASO.MENOR, orden: -PASO.MENOR, texto: 'Mentiste en tu propio beneficio' },
  liberar_prisionero: { moral: PASO.MENOR, orden: -PASO.MEDIO, texto: 'Liberaste a un prisionero por tu cuenta' },
  saquear: { moral: -PASO.MENOR, orden: -PASO.MEDIO, texto: 'Saqueaste lo que no era tuyo' },
});

/**
 * Aplica un desplazamiento de alineamiento.
 *
 * @param {Object} jugador
 * @param {Object} cambio { moral, orden }
 * @returns {{parche: Object, anterior: Object, nuevo: Object, cambioNotable: boolean, texto: string|null}}
 */
export function desplazar(jugador, cambio) {
  const a = jugador?.alineamiento ?? { moral: 0, orden: 0 };
  const lim = SOCIAL.alineamiento;

  const nuevo = {
    moral: saturar(a.moral + (cambio.moral ?? 0), lim.min, lim.max),
    orden: saturar(a.orden + (cambio.orden ?? 0), lim.min, lim.max),
  };

  const antes = describir(a);
  const despues = describir(nuevo);

  // Solo se avisa al jugador cuando la etiqueta cambia, no en cada punto.
  const cambioNotable = antes.cuadrante !== despues.cuadrante;

  return {
    parche: { player: { alineamiento: nuevo } },
    anterior: a,
    nuevo,
    cambioNotable,
    texto: cambioNotable ? `Algo ha cambiado en ti: ahora eres ${despues.resumen}` : null,
  };
}

/**
 * Aplica una acción del catálogo.
 *
 * @param {Object} jugador
 * @param {string} clave Clave de ACCIONES_MORALES.
 * @returns {{parche: Object|null, registro: string|null, cambioNotable: boolean, texto: string|null}}
 */
export function aplicarAccion(jugador, clave) {
  const accion = ACCIONES_MORALES[clave];
  if (!accion) return { parche: null, registro: null, cambioNotable: false, texto: null };

  const r = desplazar(jugador, accion);
  return {
    parche: r.parche,
    registro: accion.texto,
    cambioNotable: r.cambioNotable,
    texto: r.texto,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   COHERENCIA
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Mide la distancia entre la posición actual y una posición de referencia.
 *
 * Sirve para los juramentos del Custodio: si el personaje se aleja demasiado de
 * lo que juró, el juramento se resiente y pierde su bonificador.
 *
 * @param {Object} alineamiento
 * @param {Object} referencia
 * @returns {{distancia: number, coherente: boolean}}
 */
export function coherenciaCon(alineamiento, referencia) {
  const dm = (alineamiento?.moral ?? 0) - (referencia?.moral ?? 0);
  const dord = (alineamiento?.orden ?? 0) - (referencia?.orden ?? 0);
  const distancia = Math.sqrt(dm * dm + dord * dord);
  return { distancia, coherente: distancia <= 45 };
}

/**
 * Alineamiento inicial deducido del principio que declaró el jugador en la
 * entrevista.
 *
 * No es un análisis profundo: busca señales claras. Si no encuentra ninguna,
 * el personaje empieza en el centro, que es la posición honesta cuando aún no
 * ha hecho nada.
 *
 * @param {string} principio Respuesta a «¿qué no haría nunca?».
 * @returns {{moral: number, orden: number}}
 */
export function deducirInicial(principio) {
  if (!principio) return { moral: 0, orden: 0 };

  const t = principio.toLowerCase();
  let moral = 0;
  let orden = 0;

  const señales = [
    [/matar|asesinar|hacer daño|violencia/, { moral: 12 }],
    [/inocente|niño|indefenso|débil|debil/, { moral: 15 }],
    [/traicionar|traición|traicion/, { moral: 10, orden: 12 }],
    [/robar|hurtar/, { moral: 8, orden: 10 }],
    [/mentir|engañar|enganar/, { moral: 6, orden: 10 }],
    [/promesa|palabra|juramento|jurar/, { orden: 18 }],
    [/ley|norma|regla|autoridad/, { orden: 12 }],
    [/obedecer|órdenes|ordenes/, { orden: -10 }],   // «no obedecería órdenes» → caótico
    [/nada|todo vale|lo que sea|no tengo/, { moral: -8, orden: -12 }],
  ];

  for (const [patron, cambio] of señales) {
    if (patron.test(t)) {
      moral += cambio.moral ?? 0;
      orden += cambio.orden ?? 0;
    }
  }

  const lim = SOCIAL.alineamiento;
  return {
    moral: saturar(moral, lim.min, lim.max),
    orden: saturar(orden, lim.min, lim.max),
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   PARA EL DIRECTOR
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Contexto de alineamiento que se envía al director.
 *
 * Incluye la tendencia reciente porque es más útil que la posición absoluta: un
 * personaje que era compasivo y lleva cinco turnos endureciéndose es material
 * narrativo; un número fijo no lo es.
 *
 * @param {Object} jugador
 * @param {Object} [previo] Alineamiento de hace unos turnos.
 * @returns {string}
 */
export function contextoParaDirector(jugador, previo) {
  const actual = jugador?.alineamiento ?? { moral: 0, orden: 0 };
  const d = describir(actual);

  const partes = [`Su conducta hasta ahora lo muestra ${d.resumen}`];

  if (previo) {
    const deltaMoral = actual.moral - previo.moral;
    const deltaOrden = actual.orden - previo.orden;

    if (Math.abs(deltaMoral) >= 15) {
      partes.push(deltaMoral > 0
        ? 'y últimamente se ha vuelto más compasivo'
        : 'y últimamente se ha endurecido');
    }
    if (Math.abs(deltaOrden) >= 15) {
      partes.push(deltaOrden > 0
        ? 'además de más apegado a las normas'
        : 'además de más dispuesto a saltarse las normas');
    }
  }

  return `${partes.join(', ')}.`;
}

export default {
  etiquetaMoral,
  etiquetaOrden,
  describir,
  PASO,
  ACCIONES_MORALES,
  desplazar,
  aplicarAccion,
  coherenciaCon,
  deducirInicial,
  contextoParaDirector,
};
