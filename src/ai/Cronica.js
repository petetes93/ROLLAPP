/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANVEIL · ai/Cronica.js
 * ---------------------------------------------------------------------------
 * Lo que el jugador nombra, existe.
 *
 * Hasta ahora el mundo solo sabía lo que traía escrito de fábrica. El jugador
 * podía escribir «busco al capitán Verros, el que quemó mi forja» y tres
 * turnos después el juego no había oído hablar de Verros en su vida: el nombre
 * se perdía en el texto del turno y no quedaba nada. La historia no se
 * construía, se olvidaba.
 *
 * Aquí se lee lo que el jugador escribe y se saca lo que ha AFIRMADO sobre el
 * mundo: personas, lugares, cosas y promesas. Cada hallazgo entra en el canon
 * de la partida, y el canon es la única fuente de la que el director puede
 * beber al hablar de ellos.
 *
 * ── La regla de concordancia ─────────────────────────────────────────────
 *
 * El director procedural NO inventa sobre lo que está en el canon. Solo repite
 * y recombina lo que hay registrado. Esa limitación es justo lo que da
 * coherencia: si Verros es «capitán» y «quemó la forja», lo seguirá siendo en
 * el turno cuarenta, porque el narrador no tiene de dónde sacar otra cosa.
 *
 * Un modelo de lenguaje haría lo contrario —inventaría de más y se
 * contradiría—, y por eso el canon se le pasa también a él como hechos
 * cerrados, no como sugerencias.
 *
 * ── Por qué a mano y no con un modelo ────────────────────────────────────
 *
 * Extraer entidades con un modelo costaría una llamada por turno, latencia y
 * una dependencia de red en el bucle principal. Esto es instantáneo, funciona
 * sin conexión y se equivoca de forma predecible. Cuando falla, no reconoce
 * algo; nunca se inventa una persona que el jugador no nombró, que sería el
 * fallo grave.
 *
 * Funciones puras.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/* ═══════════════════════════════════════════════════════════════════════════
   LO QUE NO ES UN NOMBRE
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Palabras que empiezan frase y van en mayúscula sin ser nombres propios.
 *
 * En castellano toda frase abre con mayúscula, así que sin esta lista la
 * primera palabra de cada turno se registraría como personaje. «Busco» sería
 * alguien a quien conociste.
 */
const NO_NOMBRE = new Set([
  // Verbos y arranques frecuentes de una acción de rol.
  'busco', 'miro', 'voy', 'entro', 'salgo', 'hablo', 'pregunto', 'ataco', 'cojo',
  'abro', 'cierro', 'sigo', 'espero', 'descanso', 'observo', 'escucho', 'registro',
  'examino', 'me', 'le', 'les', 'lo', 'la', 'los', 'las', 'mi', 'mis', 'tu', 'tus',
  'su', 'sus', 'el', 'un', 'una', 'unos', 'unas', 'al', 'del', 'de', 'y', 'o', 'que',
  'si', 'no', 'con', 'sin', 'por', 'para', 'hacia', 'desde', 'hasta', 'en', 'sobre',
  'intento', 'quiero', 'debo', 'tengo', 'saco', 'dejo', 'tomo', 'pido', 'doy',
  'digo', 'cuento', 'recuerdo', 'pienso', 'decido', 'vuelvo', 'llego', 'paso',
  'cruzo', 'subo', 'bajo', 'corro', 'ando', 'camino', 'avanzo', 'retrocedo',
  'nunca', 'siempre', 'ahora', 'luego', 'antes', 'despues', 'entonces', 'aqui',
  'alli', 'esto', 'eso', 'aquello', 'este', 'esta', 'ese', 'esa', 'todo', 'nada',
  'alguien', 'nadie', 'algo', 'cuando', 'donde', 'como', 'quien', 'porque',
]);

/**
 * Sustantivos comunes que a veces se escriben con mayúscula y no son nombres.
 *
 * El jugador escribe «la Posada» o «el Mercado» y eso es el sitio de siempre,
 * no un lugar nuevo del mundo.
 */
const COMUNES = new Set([
  'posada', 'taberna', 'mercado', 'fragua', 'herreria', 'templo', 'plaza',
  'camino', 'bosque', 'montana', 'rio', 'puente', 'muro', 'puerta', 'calle',
  'pueblo', 'ciudad', 'aldea', 'castillo', 'torre', 'muralla', 'granja',
  'norte', 'sur', 'este', 'oeste', 'dia', 'noche', 'manana', 'tarde',
]);

/* ═══════════════════════════════════════════════════════════════════════════
   PISTAS DE TIPO
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Qué palabra delante de un nombre lo convierte en persona, y con qué rasgo.
 *
 * El rasgo importa tanto como el tipo: «el capitán Verros» no solo registra a
 * Verros, registra que es capitán, y eso es lo que el director podrá decir de
 * él sin inventarse nada.
 */
const CARGOS = Object.freeze([
  [/\b(capit[aá]n|capitana)\s+$/i, 'capitán'],
  [/\b(sargento|sargenta)\s+$/i, 'sargento'],
  [/\b(comandante)\s+$/i, 'comandante'],
  [/\b(maestr[oa])\s+$/i, 'maestro'],
  [/\b(mentor|mentora)\s+$/i, 'mentor'],
  [/\b(herrer[oa])\s+$/i, 'herrero'],
  [/\b(posader[oa]|tabernero|tabernera|mesoner[oa])\s+$/i, 'posadero'],
  [/\b(mercader|comerciante|buhoner[oa])\s+$/i, 'mercader'],
  [/\b(sacerdote|sacerdotisa|clérig[oa]|clerig[oa])\s+$/i, 'sacerdote'],
  [/\b(guardia|centinela)\s+$/i, 'guardia'],
  [/\b(ladr[oó]n|ladrona|bandid[oa])\s+$/i, 'ladrón'],
  [/\b(sold[aá]d[oa]|mercenari[oa])\s+$/i, 'soldado'],
  [/\b(rey|reina|se[ñn]or|se[ñn]ora|lord|dama)\s+$/i, 'noble'],
  [/\b(herman[oa])\s+$/i, 'hermano'],
  [/\b(padre|madre)\s+$/i, 'progenitor'],
  [/\b(hij[oa])\s+$/i, 'hijo'],
  [/\b(ti[oa]|prim[oa])\s+$/i, 'familia'],
  [/\b(amig[oa]|compa[ñn]er[oa])\s+$/i, 'amigo'],
  [/\b(vieja|viejo|ancian[oa])\s+$/i, 'anciano'],
  [/\b(doctor|doctora|sanador|sanadora|curander[oa])\s+$/i, 'sanador'],
  [/\b(cazador|cazadora|rastreador|rastreadora)\s+$/i, 'cazador'],
  [/\b(mag[oa]|hechicer[oa]|bruj[oa])\s+$/i, 'mago'],
]);

/** Lo que delante de un nombre lo convierte en lugar. */
const LUGARES_PISTA = Object.freeze([
  /\b(aldea|pueblo|ciudad|villa|puerto|fuerte|castillo|torre|abadía|abadia|monasterio|paso|valle|bosque|montaña|montana|río|rio|lago|isla|mina|ruinas|cripta|templo|posada|taberna)\s+(?:de\s+|del\s+|de\s+la\s+)?$/i,
  /\b(?:en|hacia|hasta|desde|rumbo a|camino de)\s+$/i,
]);

/**
 * Lo que delante de un nombre lo convierte en cosa.
 *
 * SIN «de» a propósito. «La espada Arven» es una espada que se llama así; «el
 * medallón de Arven» es el medallón de alguien llamado Arven, y ese alguien es
 * una persona. Con el «de» dentro del patrón, los dueños se registraban como
 * objetos y el mundo se llenaba de gente convertida en chatarra.
 */
const COSAS_PISTA = Object.freeze([
  /\b(medall[oó]n|colgante|anillo|espada|daga|hacha|martillo|arco|libro|tomo|grimorio|mapa|carta|llave|reliquia|amuleto|corona|cetro|estandarte|sello)\s+$/i,
]);

/* ═══════════════════════════════════════════════════════════════════════════
   EXTRACCIÓN
   ═══════════════════════════════════════════════════════════════════════════ */

const sinTildes = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * ¿Esta palabra en mayúscula es un nombre propio?
 *
 * @param {string} palabra
 * @param {boolean} abreFrase Si es la primera de su oración.
 * @param {string} textoCompleto
 * @returns {boolean}
 */
function esNombrePropio(palabra, abreFrase, textoCompleto) {
  const plano = sinTildes(palabra).toLowerCase();

  if (NO_NOMBRE.has(plano) || COMUNES.has(plano)) return false;
  if (palabra.length < 3) return false;
  if (!/^[A-ZÁÉÍÓÚÑ]/u.test(palabra)) return false;

  // Abriendo frase, la mayúscula no prueba nada: hace falta verla en mitad de
  // otra frase, donde nadie escribe mayúsculas por accidente.
  if (abreFrase) {
    const enMedio = new RegExp(`[a-záéíóúñü,]\\s+${palabra}\\b`, 'u');
    return enMedio.test(textoCompleto);
  }

  return true;
}

/**
 * Lee un turno del jugador y devuelve lo que ha afirmado sobre el mundo.
 *
 * @param {string} texto Lo que escribió el jugador.
 * @returns {{entidades: Array<Object>, promesas: string[]}}
 */
export function leerTurno(texto) {
  const original = String(texto ?? '').replace(/\s+/g, ' ').trim();
  if (!original) return { entidades: [], promesas: [] };

  const entidades = [];
  const vistos = new Set();

  // Se recorre buscando mayúsculas, guardando lo que hay justo antes: esa
  // antesala es la que dice si lo que viene es persona, lugar o cosa.
  const patron = /[A-ZÁÉÍÓÚÑ][a-záéíóúñü]{2,}(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñü]{2,})?/gu;

  // Posiciones donde empieza una oración, para no confundir la mayúscula de
  // apertura con un nombre.
  const inicios = new Set([0]);
  for (const m of original.matchAll(/[.!?…]+\s+/gu)) inicios.add(m.index + m[0].length);

  for (const m of original.matchAll(patron)) {
    const nombre = m[0];
    const clave = sinTildes(nombre).toLowerCase();

    if (vistos.has(clave)) continue;
    if (!esNombrePropio(nombre.split(/\s+/)[0], inicios.has(m.index), original)) continue;

    vistos.add(clave);

    const antes = original.slice(Math.max(0, m.index - 40), m.index);

    // Se guarda la palabra TAL CUAL la escribió el jugador, no la etiqueta del
    // catálogo: quien escribe «mi hermana Nerea» no quiere leer después que
    // Nerea es su «hermano». El género lo puso él y se respeta.
    const entrada = CARGOS.find(([r]) => r.test(antes));
    const cargo = entrada
      ? [entrada[0], (antes.match(entrada[0])?.[1] ?? entrada[1]).toLowerCase()]
      : null;
    const esLugar = LUGARES_PISTA.some((r) => r.test(antes));
    const esCosa = COSAS_PISTA.some((r) => r.test(antes));

    // Orden de decisión: un cargo delante gana a todo, porque «el capitán
    // Verros» es una persona aunque la frase diga «voy hacia el capitán
    // Verros», donde la pista de lugar también casaría.
    const tipo = cargo ? 'persona' : esCosa ? 'cosa' : esLugar ? 'lugar' : 'persona';

    entidades.push({
      nombre,
      tipo,
      rasgos: cargo ? [cargo[1]] : [],
      // Lo que se dice de él en esta misma frase, que es de donde sale la
      // carne del personaje: «Verros, el que quemó mi forja».
      nota: notaDe(original, m.index + nombre.length),
    });
  }

  return { entidades, promesas: promesasDe(original) };
}

/**
 * La oración subordinada que sigue a un nombre, si la hay.
 *
 * «el capitán Verros, el que quemó mi forja» → «el que quemó mi forja». Es lo
 * que convierte un nombre en un personaje: sin esto solo tendríamos la
 * etiqueta.
 *
 * @param {string} texto
 * @param {number} desde Posición justo después del nombre.
 * @returns {string}
 */
function notaDe(texto, desde) {
  const cola = texto.slice(desde);

  const m = cola.match(/^\s*,\s*(?:el\s+que|la\s+que|quien|que)\s+([^,.;!?]{6,90})/iu);
  if (m) return m[1].trim();

  return '';
}

/**
 * Promesas y propósitos declarados.
 *
 * Son la otra mitad de lo que construye una historia: no solo quién existe,
 * también a qué se ha comprometido el personaje. El jugador que escribe «juro
 * que encontraré a mi hermana» ha abierto un hilo, y el juego debe saberlo.
 *
 * @param {string} texto
 * @returns {string[]}
 */
function promesasDe(texto) {
  const patrones = [
    // El giro entero, antes que sus partes: «no descansaré hasta encontrar a
    // Verros» es UNA promesa, y el orden importa porque el primero que casa
    // se queda con el tramo.
    /\b(?:no\s+(?:descansar[ée]|parar[ée])\s+hasta\s+(?:que\s+)?)([^,.;!?]{8,100})/giu,
    /\b(?:juro|prometo|doy mi palabra)\s+(?:que\s+)?([^,.;!?]{8,100})/giu,
    /\b(?:voy a|pienso|tengo que)\s+((?:encontrar|buscar|vengar|matar|recuperar|salvar|devolver|entregar|destruir)[^,.;!?]{4,90})/giu,
  ];

  const halladas = [];
  const tramos = [];   // qué trozos del texto ya están reclamados

  for (const p of patrones) {
    for (const m of texto.matchAll(p)) {
      const inicio = m.index;
      const fin = inicio + m[0].length;

      // Si este trozo ya lo cubre una promesa anterior, es la misma dicha de
      // otra forma. Sin esto, «juro que no descansaré hasta encontrar a
      // Verros» abría dos hilos —el largo y el corto— para un solo juramento.
      if (tramos.some(([a, b]) => inicio < b && fin > a)) continue;

      const t = m[1].trim().replace(/^(?:que|a)\s+/i, '');
      if (!t || halladas.includes(t)) continue;

      tramos.push([inicio, fin]);
      halladas.push(t);
    }
  }

  return halladas.slice(0, 2);
}

export default { leerTurno };
