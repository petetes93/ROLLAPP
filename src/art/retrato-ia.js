/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANVEIL · src/art/retrato-ia.js
 * ---------------------------------------------------------------------------
 * Retrato generado a partir de lo que el jugador escribe.
 *
 * **La descripción del jugador ES el encargo.** Si escribe «herrera de barba
 * trenzada, cicatriz en la ceja y delantal quemado», eso es lo que se pinta.
 * No hay ilustración prefabricada que sustituya a eso: un catálogo de ocho
 * caras sirve para ocho personajes, y el jugador quiere el suyo.
 *
 * Usa `image.pollinations.ai`, que devuelve la imagen con una petición GET
 * normal, sin clave y sin cuenta. Eso permite algo importante: **se pide con
 * un `<img src>`**, no con `fetch`. Sin `fetch` no hay CORS que negociar, no
 * hay promesa que gestionar, y el navegador se encarga de la caché y de los
 * reintentos. Si falla, el `onerror` del propio elemento lo dice.
 *
 * Esto SÍ toca la red, y es la única parte del juego que lo hace. Es una
 * excepción consciente al principio de «sin red en ejecución»: ocurre una vez,
 * al crear el personaje, y si no hay conexión el retrato procedural que ya
 * está pintado se queda. La partida nunca depende de que esto funcione.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { hashSemilla } from '../core/RNG.js';
import { LINAJES } from './paleta.js';

/** Servicio. Gratuito, sin clave, sin cuenta. */
const SERVICIO = 'https://image.pollinations.ai/prompt/';

/** Único modelo disponible de forma anónima. */
const MODELO = 'sana';

/**
 * Tamaño del encargo.
 *
 * El marco del juego es 640×768, pero se piden 64px de más de alto. El
 * servicio estampa su marca en la banda inferior y `nologo=true` solo la quita
 * a quien tiene cuenta, así que en lugar de pedir permiso se pide lienzo de
 * sobra: el recorte de `object-fit: cover` con anclaje arriba se come esa
 * banda y deja el retrato limpio. Nada de tapar con un degradado encima —
 * eso se nota, y a pantalla pequeña se nota más.
 */
const ANCHO = 640;
const ALTO = 832;

/** Por debajo de esto, la descripción no da para un encargo. */
const MINIMO = 8;

/* ═══════════════════════════════════════════════════════════════════════════
   EL ENCARGO
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Cabeza del encargo: estilo en tres palabras y encuadre, y acto seguido el
 * sujeto.
 *
 * **El sujeto tiene que llegar pronto.** Es la lección que costó cuatro
 * tandas: con un párrafo de estilo delante, el modelo gastaba su atención ahí
 * y devolvía a un desconocido. Misma semilla, mismo texto de rasgos, solo
 * cambiando el orden: con el estilo delante salía una chica joven sin barba
 * ni cicatriz ni delantal; con el sujeto pegado al encuadre salía el herrero
 * barbudo con su delantal quemado. El estilo no se pierde por ir corto — se
 * remata al final, y lo que va al final matiza en vez de competir.
 *
 * Y nunca se niega nada («sin armadura», «no épico») porque negar invoca:
 * nombrar lo que no quieres es la forma más fiable de que aparezca. Solo se
 * dice lo que sí.
 *
 * **Hasta dónde llega el anime con este modelo.** Se probaron tres fuerzas de
 * estilo sobre el mismo sujeto y la misma semilla: «anime cel shaded», «2D
 * anime key visual, cel shaded, bold black ink outlines» y «anime screencap,
 * 1990s cel animation, thick ink lineart». Los tres devuelven pintura digital
 * semirrealista, no celda plana. `sana` es el único modelo que el servicio
 * sirve sin cuenta y no da más de sí. Así que aquí se usa la fórmula corta:
 * insistir no mejoraba la imagen y sí le quitaba sitio al sujeto. El anime de
 * verdad vive en el arte vectorial y en las ilustraciones del manifiesto.
 */
const CABEZA = 'Anime cel shaded bust portrait, head and shoulders, '
  + 'three-quarter view of one person,';

/** Remate de estilo. Al final matiza; si fuera delante, competiría. */
const COLA = 'plain flat background, soft overcast light, limited muted '
  + 'palette of ash grey, iron blue and oxidised bronze, dark low fantasy';

/**
 * Rasgo físico de cada linaje, en inglés.
 *
 * Se antepone a lo que escribe el jugador para que su personaje siga
 * pareciendo de su pueblo. Si describe algo que lo contradice, manda el
 * jugador: su texto va después y pesa más.
 */
const LINAJE = Object.freeze({
  valdes: 'olive to bronze skin, dark hair',
  sombracorteza: 'tall and gaunt, grey-brown bark-veined skin, solid black eyes',
  ferrano: 'broad shouldered, ruddy weathered skin',
  albar: 'slender, angular pale features, faint sheen on the skin',
  griscuerno: 'very tall, grey-blue skin, curved horns from the temples',
  menudo: 'small and slight, bright eyes',
  brumal: 'translucent bluish skin, hair drifting as if underwater',
  crisol: 'body of pale alloy with faint glowing mineral veins',
});

/* ═══════════════════════════════════════════════════════════════════════════
   DEL ESPAÑOL AL ENCARGO
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Glosario español → inglés de rasgos de personaje.
 *
 * Existe porque **el modelo ignora el español**. Comprobado: con
 * «herrero de barba trenzada gris, cicatriz cruzando la ceja izquierda,
 * delantal de cuero quemado» devolvió una mujer joven sin barba, sin cicatriz
 * y sin delantal. El mismo encargo en inglés sale a la primera.
 *
 * Se traduce con una tabla y no con un servicio a propósito: traducir por red
 * añade una espera, otra cosa que puede caerse y una dependencia más. La tabla
 * es instantánea, funciona sin conexión y cubre el vocabulario que la gente
 * usa de verdad al describir un personaje de rol.
 *
 * El vocabulario arranca del que ya entiende el retrato vectorial
 * (`tonosDescripcion` y `detallesDescripcion` en `retrato.js`) para que ambos
 * lean lo mismo y el jugador no tenga que aprender dos lenguajes.
 */
/*
 * Cada entrada lleva un GRUPO, y **solo gana la primera coincidencia de cada
 * grupo**. Sin eso, «barba trenzada» producía a la vez «a braided beard» y
 * «a beard»: el encargo se llenaba de sinónimos peleándose, que es la forma
 * más fiable de confundir a un modelo de imagen.
 *
 * El orden dentro de un grupo es de más específico a más genérico, porque el
 * primero que acierta es el que se queda.
 */
const GLOSARIO = Object.freeze([
  // ── Pelo ──────────────────────────────────────────────────────────────
  ['color-pelo', /\b(pelo|cabello|melena)\s+(rojiz|pelirroj|roj)/, 'red hair'],
  ['color-pelo', /\b(pelo|cabello|melena)\s+(negr|azabache)/, 'black hair'],
  ['color-pelo', /\b(pelo|cabello|melena)\s+(blanc|platead|cano|gris)/, 'silver white hair'],
  ['color-pelo', /\b(pelo|cabello|melena)\s+(rubi|dorad)/, 'blonde hair'],
  ['color-pelo', /\b(pelo|cabello|melena)\s+(castañ|marron|moren)/, 'brown hair'],
  ['color-pelo', /\b(pelo|cabello|melena)\s+(azul|verde|violeta|morad|rosa)/, 'unnaturally coloured hair'],
  ['color-pelo', /\b(calv|rapad)/, 'shaved head'],
  // La trenza exige contexto de pelo: «barba trenzada» no es un peinado.
  ['peinado', /(pelo|cabello|melena)[^,.;]{0,24}trenz|trenz[^,.;]{0,24}(pelo|cabello|melena)/, 'braided hair'],
  ['peinado', /\brizad|\brizos/, 'curly hair'],
  ['largo-pelo', /\b(pelo|cabello|melena)\s+(larg)/, 'long hair'],
  ['largo-pelo', /\b(pelo|cabello|melena)\s+(cort)/, 'short hair'],

  // ── Ojos ──────────────────────────────────────────────────────────────
  ['ojos', /\bojos?\s+(roj|carmesi|escarlata)/, 'red eyes'],
  ['ojos', /\bojos?\s+(azul|celest|cian)/, 'blue eyes'],
  ['ojos', /\bojos?\s+verde/, 'green eyes'],
  ['ojos', /\bojos?\s+(dorad|ambar|miel)/, 'amber eyes'],
  ['ojos', /\bojos?\s+(violet|morad)/, 'violet eyes'],
  ['ojos', /\bojos?\s+(negr|oscur)/, 'dark eyes'],
  ['ojos', /\bojos?\s+(gris|claro)/, 'grey eyes'],

  // ── Cara ──────────────────────────────────────────────────────────────
  ['cicatriz', /\bcicatriz/, 'a scar across the face'],
  ['parche', /\bparche/, 'an eyepatch'],
  // Lo específico antes que lo genérico: gana la primera del grupo.
  ['barba', /\bbarba\s+\w*trenzad/, 'a braided beard'],
  ['barba', /\bbarba|barbud/, 'a beard'],
  ['bigote', /\bbigote/, 'a moustache'],
  ['tatuaje', /\btatuaj/, 'facial tattoos'],
  ['piel', /\bpecas/, 'freckles'],
  ['edad', /\bviej|ancian|canoso/, 'an old weathered face'],
  ['edad', /\bjoven|jovenc/, 'a young face'],
  ['gesto', /\bcansad|ojeras|agotad/, 'a tired face with dark circles'],
  ['gesto', /\bserio|severo|duro/, 'a stern hard expression'],

  // ── Cuerpo ────────────────────────────────────────────────────────────
  ['cuerpo', /\bhombros anchos|corpulent|fornid|robust|musculos/, 'broad powerful shoulders'],
  ['cuerpo', /\bdelgad|flac|enjut|esbelt/, 'a lean slender build'],
  ['altura', /\balt[oa]\b|\bgigante/, 'very tall'],
  ['altura', /\bbaj[oa]\b|\bpequeñ|\bmenud/, 'short and slight'],

  // ── Ropa y equipo ─────────────────────────────────────────────────────
  ['cabeza', /\bcapucha|encapuchad/, 'wearing a hood'],
  ['cabeza', /\bcorona|diadema/, 'wearing a circlet'],
  ['capa', /\bcapa\b|\bmanto/, 'wearing a worn cloak'],
  ['ropa', /\bdelantal/, 'wearing a leather apron'],
  ['ropa', /\barmadura|coraza|malla/, 'wearing battered armour'],
  ['ropa', /\btunica/, 'wearing a simple tunic'],
  ['ropa', /\bharapos|andrajos/, 'ragged clothing'],
  ['ropa', /\bcuero/, 'worn leather clothing'],
  ['cuernos', /\bcuernos/, 'curved horns'],
  ['estado', /\bquemad|chamuscad/, 'scorched and burned'],

  // ── Oficio ────────────────────────────────────────────────────────────
  ['oficio', /\bherrer/, 'a blacksmith'],
  ['oficio', /\bcazador|rastread/, 'a hunter'],
  ['oficio', /\bladron|bandid/, 'a thief'],
  ['oficio', /\bmag[oa]\b|hechicer|bruj/, 'a spellcaster'],
  ['oficio', /\bguerrer|soldad|mercenari/, 'a soldier'],
  ['oficio', /\bsacerdot|clerig|monj/, 'a cleric'],
  ['oficio', /\berudit|escrib/, 'a scholar'],
  ['oficio', /\bbard|juglar/, 'a travelling performer'],
]);

/**
 * Traduce lo que escribió el jugador a fragmentos de encargo en inglés.
 *
 * Lo que no reconoce se descarta: ver `encargoRetrato` para por qué el texto
 * en español ya no viaja al final del encargo.
 *
 * @param {string} texto
 * @param {string} [yaDicho] Texto del encargo que ya está escrito (el linaje).
 *   Lo que ya aparezca ahí no se repite: el griscuerno ya es «very tall» por
 *   nacimiento, y decirlo dos veces no lo hace más alto, solo gasta atención.
 * @returns {string}
 */
/**
 * Qué parte del linaje pisa cada concepto del glosario.
 *
 * El linaje describe al pueblo; la descripción describe a ESTE personaje. Si
 * el jugador dice «ojos azules» y el linaje dice «bright eyes», el retrato
 * llevaba las dos y salía un ojo de cada. Manda el jugador: su rasgo se queda
 * y el del linaje se cae. Lo que el jugador no menciona, el linaje lo conserva.
 */
const PISA = Object.freeze({
  ojos: /\beyes?\b/,
  'color-pelo': /\bhair\b/,
  peinado: /\bhair\b/,
  'largo-pelo': /\bhair\b/,
  cuerpo: /\bshoulder|\bbuild\b|slight|gaunt|slender|broad/,
  altura: /\btall\b|\bsmall\b|\bshort\b/,
  cuernos: /\bhorns?\b/,
});

/**
 * Quita del linaje los trozos que la descripción del jugador ya contradice.
 *
 * @param {string} linaje
 * @param {Set<string>} grupos Conceptos que el glosario sí reconoció.
 * @returns {string}
 */
function podarLinaje(linaje, grupos) {
  const choques = [...grupos].map((g) => PISA[g]).filter(Boolean);
  if (!choques.length) return linaje;

  return String(linaje ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t && !choques.some((r) => r.test(t)))
    .join(', ');
}

export function traducirRasgos(texto, yaDicho = '') {
  return analizar(texto, yaDicho).frases.join(', ');
}

/**
 * El trabajo de verdad: devuelve las frases y qué conceptos tocaron.
 *
 * Los conceptos hacen falta fuera para podar el linaje, pero no tienen por qué
 * asomar en la API pública, que es una frase.
 *
 * @param {string} texto
 * @param {string} [yaDicho]
 * @returns {{ frases: string[], grupos: Set<string> }}
 */
function analizar(texto, yaDicho = '') {
  // Sin tildes y en minúsculas: la gente escribe «marrón» y «marron» por igual.
  const d = String(texto ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  const hallados = [];

  // Un concepto, una respuesta. Sin agrupar, «barba trenzada gris» sacaba a la
  // vez *a braided beard* y *a beard*, y el modelo pintaba dos barbas o
  // ninguna. Gana la primera entrada del grupo que casa: por eso el glosario
  // pone siempre lo específico antes que lo genérico.
  const usados = new Set();
  const dicho = String(yaDicho ?? '').toLowerCase();

  for (const [grupo, patron, ingles] of GLOSARIO) {
    if (dicho.includes(ingles.toLowerCase())) continue;
    if (usados.has(grupo)) continue;
    if (!patron.test(d)) continue;

    usados.add(grupo);
    if (!hallados.includes(ingles)) hallados.push(ingles);
  }

  // El lado importa cuando hay cicatriz o parche, y es fácil de acertar. Va
  // pegado a la marca, no al final de la lista: suelto al final, el modelo lo
  // leía como «el herrero está a la izquierda» y descentraba el retrato.
  const lado = /izquierd/.test(d) ? 'left' : (/derech/.test(d) ? 'right' : '');

  if (lado) {
    const i = hallados.findIndex((h) => /scar|eyepatch/.test(h));
    if (i !== -1) hallados[i] = `${hallados[i]} on the ${lado} side`;
  }

  return { frases: hallados, grupos: usados };
}

/**
 * Construye el encargo completo a partir de la descripción del jugador.
 *
 * @param {Object} personaje
 * @param {string} personaje.raza
 * @param {string} personaje.descripcion Lo que escribió el jugador.
 * @returns {string|null} El prompt, o null si no hay descripción suficiente.
 */
export function encargoRetrato(personaje = {}) {
  const descripcion = String(personaje.descripcion ?? personaje.retrato ?? '').trim();
  if (descripcion.length < MINIMO) return null;

  const linaje = LINAJE[personaje.raza] ?? '';
  const { frases, grupos } = analizar(descripcion, linaje);

  const rasgo = podarLinaje(linaje, grupos);
  const traducido = frases.join(', ');

  // El linaje y los rasgos se unen con coma porque son la misma lista de
  // atributos: pegados con espacio salía «dark hair a scar across the face» y
  // el modelo leía un rasgo inventado en vez de dos.
  const sujeto = [rasgo, traducido].filter(Boolean).join(', ');

  // Orden: encuadre → sujeto → remate de estilo. El sujeto en el centro y
  // pronto; ver CABEZA para por qué esto importa tanto.
  //
  // El español original ya NO viaja al final. Con la misma semilla y el mismo
  // sujeto, con y sin cola en español, los dos retratos salen equivalentes: la
  // cola no aporta ningún rasgo que el glosario no hubiera puesto ya. No es
  // que estorbe —eso no lo demuestra la prueba—, es que no paga su sitio, y un
  // encargo corto es más fácil de razonar cuando algo sale mal.
  //
  // El precio es que lo que el glosario no reconoce se pierde. Se acepta: vale
  // más un retrato fiel a seis rasgos que uno confuso que intentó diez. Cuando
  // falte un rasgo, se añade al glosario; no se vuelve a colar español.
  return `${CABEZA} ${sujeto}. ${COLA}`;
}

/**
 * URL de la imagen para una descripción.
 *
 * La semilla sale del texto, así que la misma descripción da siempre el mismo
 * retrato. Eso importa: el jugador debe reconocer a su personaje al volver a
 * cargar la partida, no encontrarse a un desconocido.
 *
 * @param {Object} personaje
 * @returns {string|null}
 */
export function urlRetrato(personaje = {}) {
  const prompt = encargoRetrato(personaje);
  if (!prompt) return null;

  const texto = `${personaje.raza ?? ''}:${personaje.descripcion ?? personaje.retrato ?? ''}`;
  const semilla = (hashSemilla(texto) >>> 0) % 2_000_000;

  const parametros = new URLSearchParams({
    width: String(ANCHO),
    height: String(ALTO),
    seed: String(semilla),
    nologo: 'true',
    model: MODELO,
  });

  return `${SERVICIO}${encodeURIComponent(prompt)}?${parametros}`;
}

/* ═══════════════════════════════════════════════════════════════════════════
   PINTADO
   ═══════════════════════════════════════════════════════════════════════════ */

/** Peticiones en curso, para no pisar una con otra. */
const enCurso = new WeakMap();

/**
 * Avisa a la interfaz de en qué punto va el retrato.
 *
 * Se emite un evento además de llamar al callback porque quien pinta el rótulo
 * («La IA está pintando tu retrato…») no es quien llama a esta función: la
 * cadena pasa por `pintarRetrato`, que no sabe nada de rótulos. El evento sube
 * por el mismo nodo y lo escucha el que lo necesita.
 *
 * @param {HTMLElement} nodo
 * @param {'generando'|'listo'|'sin-red'} estado
 * @param {Function} [alCambiarEstado]
 */
function avisar(nodo, estado, alCambiarEstado) {
  nodo.dataset.retratoIa = estado;
  nodo.dispatchEvent(new CustomEvent('retrato-ia', { detail: { estado } }));
  alCambiarEstado?.(estado);
}

/**
 * Sustituye el retrato de un nodo por el generado desde la descripción.
 *
 * El vectorial ya está pintado cuando esto se llama, y **no se borra hasta que
 * la imagen ha cargado**. Al revés se vería un hueco, y si no hay red el hueco
 * se quedaría para siempre.
 *
 * @param {HTMLElement} nodo
 * @param {Object} personaje
 * @param {Function} [alCambiarEstado] Recibe 'generando' | 'listo' | 'sin-red'.
 */
export function mejorarRetratoIA(nodo, personaje = {}, alCambiarEstado) {
  if (!nodo) return;

  const url = urlRetrato(personaje);
  if (!url) return;

  // Ya se está pidiendo exactamente esto: no duplicar.
  if (enCurso.get(nodo) === url) return;
  enCurso.set(nodo, url);

  avisar(nodo, 'generando', alCambiarEstado);

  const img = new Image();

  img.addEventListener('load', () => {
    // Puede haber cambiado de personaje mientras cargaba; si es así, no se
    // pisa lo que haya ahora.
    if (enCurso.get(nodo) !== url) return;

    // `arte--ia` ancla el encuadre arriba: el retrato llega más alto que el
    // marco a propósito (ver ALTO) y lo que sobra tiene que caer por abajo.
    img.className = 'arte arte--imagen arte--ia';
    img.alt = personaje.nombre ? `Retrato de ${personaje.nombre}` : 'Retrato';

    nodo.replaceChildren(img);
    avisar(nodo, 'listo', alCambiarEstado);
  });

  img.addEventListener('error', () => {
    if (enCurso.get(nodo) !== url) return;

    // Sin red o servicio caído. El vectorial sigue puesto, que es justo el
    // comportamiento previsto: el juego no depende de esto.
    avisar(nodo, 'sin-red', alCambiarEstado);
    enCurso.delete(nodo);
  });

  img.src = url;
}
