/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANVEIL · engine/Segmentos.js
 * ---------------------------------------------------------------------------
 * Lo que escribe el jugador, en orden y sin aplanar.
 *
 * «Le pregunto por el puente, le enseño la carta y si miente me voy» son tres
 * cosas: una pregunta, un gesto y una condición que depende de lo que conteste
 * el otro. Se reducía todo a una sola intención —hablar— y se narraba entero
 * como hecho, incluido el «me voy», que aún no ha pasado.
 *
 * Aquí se parte en segmentos:
 *
 *   · accion       — lo que hace.
 *   · dialogo      — lo que dice; lo entrecomillado es literal.
 *   · omision      — lo que deja de lado a propósito («ignoro al centinela»).
 *   · condicional  — lo que hará SI pasa algo. No se ejecuta: queda pendiente.
 *   · espera       — «luego espero».
 *   · delegacion   — «que mi compañera negocie»: actúa otro, él observa.
 *
 * Cada uno lleva además si es una negativa («no os entregaré la llave») o una
 * pregunta. Funciones puras.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { sinAcentos } from '../utils/text.js';

export const TIPO_SEGMENTO = Object.freeze({
  ACCION: 'accion',
  DIALOGO: 'dialogo',
  OMISION: 'omision',
  CONDICIONAL: 'condicional',
  ESPERA: 'espera',
  DELEGACION: 'delegacion',
});

const CITA = /«[^»]*»|"[^"]*"|“[^”]*”/gu;
const llano = (t) => sinAcentos(String(t ?? '').toLowerCase());

/** Palabras en -o que no son verbos y no pueden abrir un segmento. */
const NO_VERBO = new Set(['todo', 'mucho', 'poco', 'algo', 'como', 'solo', 'cuando', 'pero', 'luego', 'tanto', 'medio', 'otro', 'mismo', 'cuanto', 'dentro', 'nuestro', 'vuestro', 'cuidado', 'rapido', 'despacio', 'claro']);

const CLITICO = '(?:le|les|me|te|lo|la|los|las|se|nos|os)';

/** Un verbo en primera persona: -o, -é, y los que acaban en -oy (voy, doy, estoy, soy). */
const PRIMERA = '\\p{L}+(?:o|é|oy)\\b';

/** Dónde empieza el siguiente segmento. */
const CORTES = [
  /\s*;\s*/u,
  /(?<=[.!?…])\s+/u,
  new RegExp(`,?\\s+(?:y\\s+)?(?:luego|despu[eé]s|entonces)\\s+`, 'iu'),
  /,?\s+y\s+(?=si\s)/iu,
  /,\s*(?=si\s)/iu,
  new RegExp(`,\\s+(?=${CLITICO}\\s+${PRIMERA})`, 'iu'),
  new RegExp(`\\s+y\\s+(?=${CLITICO}\\s+${PRIMERA})`, 'iu'),
  /,\s+(?=\p{L}{3,}[oé]\b)/iu,
  /\s+y\s+(?=\p{L}{3,}[oé]\b)/iu,
];

/** ¿Hay en este trozo algo que haga el propio jugador? (primera persona) */
const HACE_EL = new RegExp(`(?:^|\\s)(?:(?:me|le|lo|la|les|los|las|nos|os|te)\\s+${PRIMERA}|(?!se\\b)\\p{L}{3,}[oé]\\b|(?:voy|doy|estoy|soy)\\b)`, 'iu');

/** Gestos que preparan lo que viene después: acercarse, volver con alguien, enseñar algo. */
const PREPARA = /^(?:me acerco|me aproximo|vuelvo (?:con|junto|a donde|hacia)|voy (?:hacia|con|junto)|me dirijo|me giro|me vuelvo hacia|(?:le|les) (?:enseno|muestro|tiendo|acerco)|saco)\b/;

const OMISION = /^(?:ignoro|paso de|no hago caso|sin hacer caso|me desentiendo|dejo (?:estar|en paz|atras)|no me meto)\b/;
const ESPERA = /^(?:espero|aguardo|me quedo esperando|me quedo quiet[oa]|no hago nada|observo(?: en silencio)?)\s*[.!]?$/;
const HABLA = new RegExp(`^(?:${CLITICO}\\s+)?(?:digo|pregunto|cuento|explico|contesto|respondo|grito|susurro|suplico|exijo|pido|advierto|aviso)\\b`);
const NEGATIVA = /\b(?:me niego|no acepto|no pienso|no voy a|no (?:os|te|le|les)\s+(?:entregar|dar|vender|dejar|devolver)\w*|no (?:entregar|dar|vender|dejar|devolver)\w*|no (?:lo|la|los|las) (?:hare|har[eé]|dare|dar[eé]|entregare|entregar[eé])|jamas|ni hablar|ni loco|ni loca)\b/;
const DELEGA = /^(?:que|dejo que|deja que)\s+(mi compañer[oa]|mi amig[oa]|[A-ZÁÉÍÓÚÑ][\p{L}]+)\s+(.+)$/iu;
const CONECTOR_INICIAL = /^(?:y|luego|despu[eé]s|entonces|pero)\s+/iu;

/**
 * Parte el texto del jugador en segmentos ordenados.
 *
 * @param {string} texto
 * @returns {Array<{tipo: string, texto: string, negativa: boolean, pregunta: boolean,
 *   condicion?: string, consecuencia?: string, quien?: string, delegado?: string, objeto?: string}>}
 */
export function segmentar(texto) {
  const original = String(texto ?? '').trim();
  if (!original) return [];

  // Las citas no se parten por dentro: se guardan y se reponen al final.
  const citas = [];
  let protegido = original.replace(CITA, (c) => {
    citas.push(c);
    return `\u0000${citas.length - 1}\u0000`;
  });

  let trozos = [protegido];
  for (const corte of CORTES) {
    trozos = trozos.flatMap((t) => t.split(corte));
  }

  const reponer = (t) => t.replace(/\u0000(\d+)\u0000/g, (_, i) => citas[Number(i)]);

  const limpios = trozos
    .map((t) => reponer(t).trim().replace(CONECTOR_INICIAL, '').replace(/[,;]\s*$/u, '').trim())
    .filter(Boolean);

  // Se recosen dos casos que los cortes separan de más:
  //   · un trozo que empieza por una palabra que no es verbo («mucho
  //     sigilo») era parte del anterior;
  //   · una condición sin consecuencia («si el guardia se niega») se lleva
  //     el trozo siguiente («lo empujo al río»).
  const unidos = [];
  for (const t of limpios) {
    const previo = unidos.at(-1);
    const primera = llano(t).split(/\s+/)[0];
    if (previo && NO_VERBO.has(primera)) {
      unidos[unidos.length - 1] = `${previo} y ${t}`;
    } else if (previo && /^si\s/i.test(previo) && !previo.includes(',')
      && (original.includes(`${previo},`) || !HACE_EL.test(previo.replace(/^si\s+\S+/i, '')))) {
      // Con la coma del jugador («si el herrero me sigue mirando, me voy»)
      // no hace falta adivinar dónde acaba la condición: acaba ahí. Sin ella
      // se adivinaba por la forma de las palabras, y «herrero» parecía un
      // verbo en primera persona.
      unidos[unidos.length - 1] = `${previo}, ${t}`;
    } else {
      unidos.push(t);
    }
  }
  return unidos.map(clasificar);
}

/** @private */
function clasificar(texto) {
  const n = llano(texto);
  const sinCitas = llano(texto.replace(CITA, ''));
  const base = {
    texto,
    negativa: NEGATIVA.test(n),
    pregunta: /\?/.test(texto) || /^(?:le |les )?pregunto\b/.test(n),
  };

  if (/^si\s+/.test(n)) {
    const resto = texto.replace(/^si\s+/i, '');
    const coma = resto.indexOf(',');
    const corte = coma > 0
      ? coma
      : resto.search(new RegExp(`\\s(?=(?:me|le|lo|la|les|los|las|nos|os|te)\\s+${PRIMERA}|(?!se\\b)\\p{L}{3,}[oé]\\b|(?:voy|doy|estoy|soy)\\b)`, 'iu'));
    const condicion = corte > 0 ? resto.slice(0, corte).trim() : resto.trim();
    const consecuencia = corte > 0 ? resto.slice(corte + 1).trim() : '';
    return { ...base, tipo: TIPO_SEGMENTO.CONDICIONAL, condicion, consecuencia };
  }

  if (OMISION.test(sinCitas)) {
    const objeto = texto.replace(/^\S+\s+(?:de\s+|caso\s+(?:a\s+|al\s+)?|a\s+|al\s+)?/iu, '').trim();
    return { ...base, tipo: TIPO_SEGMENTO.OMISION, objeto };
  }

  const delega = texto.match(DELEGA);
  if (delega) {
    return { ...base, tipo: TIPO_SEGMENTO.DELEGACION, quien: delega[1], delegado: delega[2] };
  }

  if (ESPERA.test(sinCitas)) return { ...base, tipo: TIPO_SEGMENTO.ESPERA };

  if (CITA.test(texto) || HABLA.test(sinCitas)) {
    CITA.lastIndex = 0;
    return { ...base, tipo: TIPO_SEGMENTO.DIALOGO };
  }

  return { ...base, tipo: TIPO_SEGMENTO.ACCION };
}

/**
 * Qué se resuelve en este turno y qué no.
 *
 * El foco es lo primero que hace o dice: de ahí salen la intención y la
 * tirada. Salvo que lo primero sea solo preparar lo segundo: en «me acerco
 * al herrero y le pregunto por el paso», lo que pide respuesta es la
 * pregunta, y el foco se quedaba en acercarse. Lo condicional queda
 * pendiente; lo omitido, apuntado.
 *
 * @param {ReturnType<typeof segmentar>} segmentos
 * @returns {{foco: Object|null, hechos: Object[], pendientes: Object[], omisiones: Object[], delegacion: Object|null}}
 */
export function ordenar(segmentos) {
  const hechos = segmentos.filter((s) => [TIPO_SEGMENTO.ACCION, TIPO_SEGMENTO.DIALOGO, TIPO_SEGMENTO.ESPERA, TIPO_SEGMENTO.DELEGACION].includes(s.tipo));
  let foco = hechos.find((s) => s.tipo === TIPO_SEGMENTO.ACCION || s.tipo === TIPO_SEGMENTO.DIALOGO || s.tipo === TIPO_SEGMENTO.DELEGACION) ?? null;
  const dialogo = hechos.find((s) => s.tipo === TIPO_SEGMENTO.DIALOGO);
  if (foco?.tipo === TIPO_SEGMENTO.ACCION && dialogo
    && hechos.slice(0, hechos.indexOf(dialogo)).every((s) => s.tipo === TIPO_SEGMENTO.ACCION && PREPARA.test(llano(s.texto)))) {
    foco = dialogo;
  }
  return {
    foco,
    hechos,
    pendientes: segmentos.filter((s) => s.tipo === TIPO_SEGMENTO.CONDICIONAL),
    omisiones: segmentos.filter((s) => s.tipo === TIPO_SEGMENTO.OMISION),
    delegacion: segmentos.find((s) => s.tipo === TIPO_SEGMENTO.DELEGACION) ?? null,
  };
}

export default { segmentar, ordenar, TIPO_SEGMENTO };
