/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANVEIL · ai/Persona.js
 * ---------------------------------------------------------------------------
 * Pasa a segunda persona lo que el jugador escribe en primera.
 *
 * El jugador escribe «me acerco al barquero y le enseño mi medallón»; el
 * narrador sin IA debe contestar «Te acercas al barquero y le enseñas tu
 * medallón», no citarlo entre comillas. No es un conjugador completo: cubre
 * el presente de los verbos habituales en una partida de rol y deja intacto
 * lo que no reconoce, que es mejor que inventar.
 *
 * Función pura.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** Irregulares y verbos en -er/-ir frecuentes (el resto se trata como -ar). */
const IRREGULARES = {
  soy: 'eres', estoy: 'estás', voy: 'vas', doy: 'das', hago: 'haces', digo: 'dices',
  pongo: 'pones', tengo: 'tienes', salgo: 'sales', vengo: 'vienes', traigo: 'traes',
  caigo: 'caes', oigo: 'oyes', sé: 'sabes', se: 'sabes', quepo: 'cabes', veo: 'ves',
  sigo: 'sigues', pido: 'pides', repito: 'repites', sirvo: 'sirves', mido: 'mides',
  elijo: 'eliges', persigo: 'persigues', consigo: 'consigues', recojo: 'recoges',
  cojo: 'coges', escojo: 'escoges', protejo: 'proteges', dirijo: 'diriges', exijo: 'exiges',
  vuelvo: 'vuelves', muevo: 'mueves', puedo: 'puedes', quiero: 'quieres', pienso: 'piensas',
  cierro: 'cierras', empiezo: 'empiezas', entiendo: 'entiendes', siento: 'sientes',
  duermo: 'duermes', muero: 'mueres', juego: 'juegas', cuento: 'cuentas', muestro: 'muestras',
  recuerdo: 'recuerdas', pruebo: 'pruebas', encuentro: 'encuentras', suelto: 'sueltas',
  sueño: 'sueñas', despierto: 'despiertas', defiendo: 'defiendes', enciendo: 'enciendes',
  conozco: 'conoces', parezco: 'pareces', ofrezco: 'ofreces', agradezco: 'agradeces',
  desaparezco: 'desapareces', aparezco: 'apareces', obedezco: 'obedeces', huyo: 'huyes',
  construyo: 'construyes', destruyo: 'destruyes', incluyo: 'incluyes', río: 'ríes',
  crezco: 'creces', rio: 'ríes', envío: 'envías', confío: 'confías', grito: 'gritas',
  subo: 'subes', abro: 'abres', escribo: 'escribes', recibo: 'recibes', decido: 'decides',
  vivo: 'vives', parto: 'partes', insisto: 'insistes', asisto: 'asistes', descubro: 'descubres',
  cubro: 'cubres', sufro: 'sufres', divido: 'divides', permito: 'permites', resisto: 'resistes',
  bebo: 'bebes', como: 'comes', corro: 'corres', leo: 'lees', creo: 'crees', aprendo: 'aprendes',
  comprendo: 'comprendes', rompo: 'rompes', meto: 'metes', saco: 'sacas', temo: 'temes',
  vendo: 'vendes', respondo: 'respondes', escondo: 'escondes', recorro: 'recorres',
  debo: 'debes', barro: 'barres', toso: 'toses',
  emprendo: 'emprendes', sorprendo: 'sorprendes', extiendo: 'extiendes', tiendo: 'tiendes',
  atiendo: 'atiendes', desciendo: 'desciendes', asciendo: 'asciendes',
  ataco: 'atacas', busco: 'buscas', toco: 'tocas', acerco: 'acercas', coloco: 'colocas',
  bendigo: 'bendices', maldigo: 'maldices', contradigo: 'contradices',
};

/** Pronombres y posesivos. */
const PRONOMBRES = {
  yo: 'tú', me: 'te', mi: 'tu', mis: 'tus', conmigo: 'contigo', mío: 'tuyo', mía: 'tuya',
  míos: 'tuyos', mías: 'tuyas', nosotros: 'vosotros', nosotras: 'vosotras', nuestro: 'vuestro',
  nuestra: 'vuestra', nuestros: 'vuestros', nuestras: 'vuestras', nos: 'os',
};

/** Palabras tras las que suele empezar una nueva acción. */
const TRAS_VERBO = new Set(['y', 'e', 'luego', 'después', 'entonces', 'mientras', 'me', 'te', 'le', 'les', 'lo', 'la', 'los', 'las', 'se', 'no', 'también', 'ya', 'yo', 'nos', 'que', 'pero', 'ni', 'o', 'u', 'si', 'cuando']);

/** Palabras en -o que no son verbos aunque abran cláusula. */
const NO_VERBOS = new Set(['lo', 'yo', 'no', 'o', 'como', 'todo', 'algo', 'poco', 'mucho', 'medio', 'otro', 'solo', 'sólo', 'pero', 'luego', 'tanto', 'cuanto', 'primero', 'dentro', 'fuera', 'encima', 'debajo', 'despacio', 'rápido', 'claro', 'mismo', 'pronto']);

const PRETERITOS = {
  vi: 'viste', fui: 'fuiste', hice: 'hiciste', dije: 'dijiste', tuve: 'tuviste', estuve: 'estuviste',
  pude: 'pudiste', puse: 'pusiste', supe: 'supiste', quise: 'quisiste', vine: 'viniste', traje: 'trajiste',
  di: 'diste', anduve: 'anduviste', conduje: 'condujiste',
};

function conjugar(verbo) {
  const bajo = verbo.toLowerCase();
  if (IRREGULARES[bajo]) return IRREGULARES[bajo];
  if (PRETERITOS[bajo]) return PRETERITOS[bajo];
  // Pretérito regular: crecí → creciste, crucé → cruzaste, busqué → buscaste.
  if (/í$/.test(bajo) && bajo.length > 3) return `${bajo.slice(0, -1)}iste`;
  if (/qué$/.test(bajo)) return `${bajo.slice(0, -3)}caste`;
  if (/gué$/.test(bajo)) return `${bajo.slice(0, -3)}gaste`;
  if (/cé$/.test(bajo)) return `${bajo.slice(0, -2)}zaste`;
  if (/é$/.test(bajo) && bajo.length > 3) return `${bajo.slice(0, -1)}aste`;

  // Dónde cae la tilde lo decide todo, y por eso estas tres líneas van juntas:
  //
  //   «guío», «amplío»  → tilde en la í: primera del presente  → «guías»
  //   «perdió», «salió» → tilde en la ó: TERCERA del pretérito → no se toca
  //   «perdio», «salio» → sin tilde: es el pretérito mal escrito → no se toca
  //
  // La tercera línea es la que importa en la práctica. El trasfondo lo escribe
  // el jugador a mano y sin tildes, y tratar «perdio» como presente producía
  // «perdias la forja de su padre». Se prefiere dejar intacto un verbo que
  // destrozarlo: lo primero se lee, lo segundo no.
  if (/ío$/.test(bajo)) return `${bajo.slice(0, -2)}ías`;
  if (/i[oó]$/.test(bajo)) return null;

  if (/[^aeiou]o$/.test(bajo) || /[aeu]o$/.test(bajo)) return `${bajo.slice(0, -1)}as`;
  return null;
}

/**
 * ¿Este texto está escrito en primera persona?
 *
 * Hace falta porque `aSegundaPersona` solo sabe traducir desde primera. Lo que
 * el jugador escribe como acción sí viene en primera («me acerco»), pero el
 * trasfondo lo suele escribir en tercera, hablando de su personaje («Perdió la
 * forja de su padre»). Convertir eso no da una frase en segunda persona: da
 * una frase rota, con el verbo cambiado y los posesivos intactos.
 *
 * Se exige señal explícita. Sin señal, se responde que no: dejar el texto como
 * está siempre es legible; convertirlo a ciegas, no.
 *
 * @param {string} texto
 * @returns {boolean}
 */
export function esPrimeraPersona(texto) {
  const t = ` ${String(texto ?? '').toLowerCase()} `;

  // Pronombres y posesivos de primera, que no admiten otra lectura.
  if (/\s(yo|me|mi|mis|mío|mía|míos|mías|conmigo)[\s,.;:]/u.test(t)) return true;

  // Pretéritos de primera, inequívocos.
  if (/\s(fui|vi|hice|dije|tuve|estuve|pude|puse|supe|quise|vine|traje|perdí|gané|dejé|salí|llegué|nací)[\s,.;:]/u.test(t)) return true;

  return false;
}

function conMayuscula(original, nueva) {
  return original[0] === original[0].toUpperCase() && original[0] !== original[0].toLowerCase()
    ? nueva[0].toUpperCase() + nueva.slice(1)
    : nueva;
}

/**
 * Pasa un texto de primera a segunda persona.
 * @param {string} texto
 * @returns {string}
 */
const INF_IRREG = { ir: 'vas', ser: 'eres', ver: 'ves', dar: 'das', hacer: 'haces', decir: 'dices', poner: 'pones', salir: 'sales', tener: 'tienes', venir: 'vienes', seguir: 'sigues', pedir: 'pides', volver: 'vuelves', buscar: 'buscas', entrar: 'entras', tomar: 'tomas', encontrar: 'encuentras', mostrar: 'muestras', contar: 'cuentas', recordar: 'recuerdas', probar: 'pruebas', despertar: 'despiertas', pensar: 'piensas', empezar: 'empiezas', cerrar: 'cierras', perder: 'pierdes', entender: 'entiendes', sentir: 'sientes', dormir: 'duermes', mover: 'mueves', oler: 'hueles', jugar: 'juegas', elegir: 'eliges', huir: 'huyes', oír: 'oyes' };

/**
 * «Preguntar a Helmir por tu hermana» → «Preguntas a Helmir por tu hermana».
 * Las sugerencias llegan en infinitivo; al narrarlas se conjugan.
 */
function infinitivoInicial(texto) {
  const m = texto.match(/^(\s*)([A-Za-zÁÉÍÓÚáéíóúñÑ]*?)(ar|er|ir|ír)(te|se|le|lo|la|les|los|las)?(?=\s|$)/iu);
  if (!m) return null;
  const [todo, esp, raiz, term, clitico] = m;
  const inf = `${raiz}${term}`.toLowerCase();
  const t = term.toLowerCase();
  let conj = INF_IRREG[inf];
  if (!conj) {
    if (inf.length < 4) return null;
    const r = raiz.toLowerCase();
    conj = t === 'ar' ? `${r}as` : `${r}es`;
  }
  let pron = '';
  if (clitico === 'te' || clitico === 'se') pron = 'te ';
  else if (clitico) pron = `${clitico} `;
  const salida = `${pron}${conj}`;
  const mayus = /^[A-ZÁÉÍÓÚÑ]/u.test(m[2] || term);
  const conMayus = mayus ? salida[0].toUpperCase() + salida.slice(1) : salida;
  return esp + conMayus + texto.slice(todo.length);
}

export function aSegundaPersona(texto) {
  const inf = infinitivoInicial(String(texto ?? ''));
  if (inf !== null) return inf;
  const partes = String(texto ?? '').split(/(\s+|[,.;:!?¡¿«»"()]+)/u);
  let anterior = null;       // última palabra vista
  let inicioClausula = true;

  return partes.map((p) => {
    if (!p || /^\s+$/u.test(p)) return p;
    if (/^[,.;:!?¡¿«»"()]+$/u.test(p)) { inicioClausula = true; return p; }

    const bajo = p.toLowerCase();
    let salida = p;

    // "me" delante de verbo es reflexivo; "yo" también cambia.
    if (PRONOMBRES[bajo]) {
      salida = conMayuscula(p, PRONOMBRES[bajo]);
    } else if ((inicioClausula || TRAS_VERBO.has(anterior)) && !NO_VERBOS.has(bajo)
      && !(['lo', 'la', 'los', 'las'].includes(anterior) && /(ado|ido|ierto|uesto|echo|icho|oto)$/.test(bajo))
      && (/o$/.test(bajo) || /[éí]$/.test(bajo) || PRETERITOS[bajo]) && bajo.length > 1) {
      const c = conjugar(bajo);
      if (c) salida = conMayuscula(p, c);
    } else if ((inicioClausula || TRAS_VERBO.has(anterior)) && IRREGULARES[bajo]) {
      salida = conMayuscula(p, IRREGULARES[bajo]);
    }

    inicioClausula = false;
    anterior = bajo;
    return salida;
  }).join('');
}

export default { aSegundaPersona, esPrimeraPersona };
