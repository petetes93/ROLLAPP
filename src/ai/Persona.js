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

/**
 * Palabras en -o que no son verbos aunque abran cláusula.
 *
 * Las últimas siete entran por un fallo que se vio jugando: «me acerco con la
 * mano lejos del arco» salía narrado como «con la manas lejos del arco».
 *
 * La causa es que `la` está en TRAS_VERBO —porque puede ser pronombre átono
 * delante de verbo, «la miro»— y entonces lo siguiente se trata como verbo. Es
 * la ambigüedad del castellano: «la mano» es artículo más sustantivo, «la
 * miro» es pronombre más verbo, y sin analizar la frase entera no se
 * distinguen.
 *
 * Por suerte el agujero es diminuto: hacen falta sustantivos FEMENINOS
 * acabados en -o, y en castellano hay un puñado. Se listan y se acabó. Sacar
 * `la` de TRAS_VERBO habría arreglado esto y roto «la miro», que es más común.
 */
const NO_VERBOS = new Set(['lo', 'yo', 'no', 'o', 'como', 'todo', 'algo', 'poco', 'mucho', 'medio', 'otro', 'solo', 'sólo', 'pero', 'luego', 'tanto', 'cuanto', 'primero', 'dentro', 'fuera', 'encima', 'debajo', 'despacio', 'rápido', 'claro', 'mismo', 'pronto',
  'mano', 'foto', 'moto', 'radio', 'libido', 'soprano', 'modelo']);

const PRETERITOS = {
  vi: 'viste', fui: 'fuiste', hice: 'hiciste', dije: 'dijiste', tuve: 'tuviste', estuve: 'estuviste',
  pude: 'pudiste', puse: 'pusiste', supe: 'supiste', quise: 'quisiste', vine: 'viniste', traje: 'trajiste',
  di: 'diste', anduve: 'anduviste', conduje: 'condujiste',
};

function conjugar(verbo) {
  const bajo = verbo.toLowerCase();
  if (IRREGULARES[bajo]) return IRREGULARES[bajo];
  if (PRETERITOS[bajo]) return PRETERITOS[bajo];
  // Futuro de primera: descansaré → descansarás, volveré → volverás.
  //
  // Va ANTES del pretérito porque «-ré» también acaba en «-é» y la regla de
  // abajo lo convertiría en «descansaraste». Aparece en cuanto el jugador
  // promete algo, que es justo cuando el texto se lee con más atención.
  if (/[aei]ré$/.test(bajo) && bajo.length > 4) return `${bajo.slice(0, -1)}ás`;

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

/**
 * Subjuntivos de primera persona, con su forma en segunda.
 *
 * Son los que aparecen tras «que» en una acción de rol: «ataco al primer
 * enemigo que vea», «espero hasta que pueda pasar». El bucle de abajo solo
 * mira verbos acabados en -o, -é o -í, así que estos no los tocaba nunca y la
 * frase salía a medio convertir: «Atacas al primer enemigo que vea».
 *
 * Es una lista y no una regla porque en castellano la terminación -a o -e tras
 * «que» la comparten el subjuntivo («que vea») y el indicativo de tercera
 * persona («que llega»): sin saber el verbo no se distinguen, y convertir «que
 * llega» en «que llegas» cambiaría de quién habla la frase.
 */
const SUBJUNTIVOS = Object.freeze({
  vea: 'veas', pueda: 'puedas', encuentre: 'encuentres', sepa: 'sepas',
  tenga: 'tengas', haga: 'hagas', diga: 'digas', vaya: 'vayas', sea: 'seas',
  este: 'estes', esté: 'estés', quiera: 'quieras', deba: 'debas', logre: 'logres',
  consiga: 'consigas', salga: 'salgas', venga: 'vengas', ponga: 'pongas',
  vuelva: 'vuelvas', oiga: 'oigas', vea_: 'veas', llegue: 'llegues',
  necesite: 'necesites', decida: 'decidas', note: 'notes', vean: 'veas',
  coja: 'cojas', abra: 'abras', cierre: 'cierres', mire: 'mires', busque: 'busques',
});

export function aSegundaPersona(texto) {
  // «Me siento en la taberna» es sentarse, no sentir, y salía «Te sientes en
  // la taberna». El verbo es el mismo en primera persona y solo el contexto lo
  // desambigua: con «me» delante y un sitio detrás, uno se sienta. Sin «me»
  // («siento que algo va mal») es sentir, y eso se deja al bucle de abajo.
  let t = String(texto ?? '')
    .replace(/\bme\s+siento\b(?=\s+(en|sobre|junto|frente|cerca|a\b|al\b))/giu,
      (m) => (m[0] === m[0].toUpperCase() ? 'Te sientas' : 'te sientas'));

  const inf = infinitivoInicial(t);
  if (inf !== null) return inf;
  const partes = t.split(/(\s+|[,.;:!?¡¿«»"()]+)/u);
  let anterior = null;       // última palabra vista
  let anteanterior = null;   // la de antes, para reconocer «el que»
  let inicioClausula = true;

  // Distinto de `inicioClausula`: esto solo lo abre un punto, y sirve para
  // saber si una palabra en mayúscula puede ser un verbo o es un nombre.
  let inicioFrase = true;

  return partes.map((p) => {
    if (!p || /^\s+$/u.test(p)) return p;
    if (/^[,.;:!?¡¿«»"()]+$/u.test(p)) {
      inicioClausula = true;
      if (/[.!?…]/u.test(p)) inicioFrase = true;
      return p;
    }

    const bajo = p.toLowerCase();
    let salida = p;

    // Una palabra en mayúscula que no abre frase es un nombre propio, no un
    // verbo. Sin esto, «Viaja con Dhorak, Lyssara, Núcleo» convertía «Núcleo»
    // —que va tras una coma, o sea en «inicio de cláusula»— en «núcleas». Los
    // nombres importados de una historia van justo así, en lista.
    const nombrePropio = !inicioFrase && /^[A-ZÁÉÍÓÚÑ]/u.test(p) && !PRONOMBRES[bajo];

    if (nombrePropio) {
      inicioClausula = false;
      inicioFrase = false;
      anteanterior = anterior;
      anterior = bajo;
      return p;
    }

    // ¿Venimos de un relativo que señala a otra persona?
    const relativoAjeno = anterior === 'quien'
      || (anterior === 'que' && ['el', 'la', 'los', 'las'].includes(anteanterior));

    // "me" delante de verbo es reflexivo; "yo" también cambia.
    if (PRONOMBRES[bajo]) {
      salida = conMayuscula(p, PRONOMBRES[bajo]);
    } else if (relativoAjeno) {
      // Detrás de «el que», «quien», «los que»… se habla de OTRO, no de ti.
      //
      // «Busco al capitán Verros, el que quemó mi forja» salía como «el que
      // quemas tu forja»: el jugador contaba qué hizo Verros y el narrador se
      // lo atribuía al propio personaje. Es la misma confusión de persona que
      // destrozaba el trasfondo, metida dentro de una frase.
      //
      // Los posesivos SÍ se convierten —«mi forja» es del jugador y pasa a
      // «tu forja»—; lo que no se toca es el verbo.
      salida = PRONOMBRES[bajo] ? conMayuscula(p, PRONOMBRES[bajo]) : p;
    } else if (anterior === 'que' && SUBJUNTIVOS[bajo]) {
      // Subjuntivo tras «que»: solo aquí, porque fuera de esa posición estas
      // formas son casi siempre tercera persona («la puerta que cierra mal»).
      salida = conMayuscula(p, SUBJUNTIVOS[bajo]);
    } else if ((inicioClausula || TRAS_VERBO.has(anterior)) && !NO_VERBOS.has(bajo)
      && !(['lo', 'la', 'los', 'las'].includes(anterior) && /(ado|ido|ierto|uesto|echo|icho|oto)$/.test(bajo))
      && (/o$/.test(bajo) || /[éí]$/.test(bajo) || PRETERITOS[bajo]) && bajo.length > 1) {
      const c = conjugar(bajo);
      if (c) salida = conMayuscula(p, c);
    } else if ((inicioClausula || TRAS_VERBO.has(anterior)) && IRREGULARES[bajo]) {
      salida = conMayuscula(p, IRREGULARES[bajo]);
    }

    inicioClausula = false;
    inicioFrase = false;
    anteanterior = anterior;
    anterior = bajo;
    return salida;
  }).join('');
}

export default { aSegundaPersona, esPrimeraPersona };
