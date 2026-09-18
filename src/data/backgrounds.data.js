/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANUM · data/backgrounds.data.js
 * ---------------------------------------------------------------------------
 * Trasfondos: qué hacía el personaje antes de que empezara la crónica.
 *
 * En este motor el trasfondo pesa más que en la mayoría de sistemas, porque el
 * director de juego lo usa activamente: un contrabandista conoce gente en los
 * muelles y un desertor tiene a alguien buscándolo. El campo `consecuencias`
 * existe justo para eso — son hechos del mundo, no adornos de ficha.
 *
 * `deudaInicial` y `contactoInicial` se convierten en entidades reales del
 * mundo al crear el personaje. La deuda es una misión latente; el contacto,
 * un PNJ que existe desde el turno cero.
 *
 * Sin dependencias.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * @typedef {Object} Trasfondo
 * @property {string} refId
 * @property {string} nombre
 * @property {string} lema
 * @property {string} descripcion
 * @property {string} promptLore Contexto para el director.
 * @property {string[]} habilidades Competencias que otorga.
 * @property {string[]} equipoInicial
 * @property {number} oroExtra
 * @property {Object} rasgo Ventaja social propia del trasfondo.
 * @property {string[]} consecuencias Hechos del mundo derivados del pasado.
 * @property {Object|null} contactoInicial PNJ que existe desde el inicio.
 * @property {Object|null} deudaInicial Misión latente.
 * @property {string[]} preguntas Preguntas de entrevista específicas.
 * @property {Record<string, number>} pistas Vocabulario → peso.
 */

/** @type {Record<string, Trasfondo>} */
export const TRASFONDOS = Object.freeze({

  /* ─────────────────────────────────────────────────────────────────────── */
  gremial: {
    refId: 'gremial',
    nombre: 'Aprendiz de gremio',
    lema: 'Aprendí un oficio. Luego dejé de ejercerlo.',
    descripcion:
      'Pasaste años en un taller aprendiendo a hacer algo con las manos. Sabes reconocer el buen ' +
      'trabajo y tienes contactos en cada ciudad con gremio.',
    promptLore:
      'Se formó en un gremio artesano. Reconoce trabajo de calidad, sabe negociar con artesanos ' +
      'y puede pedir favores en talleres. Dejó el oficio por algún motivo.',
    habilidades: ['artesania', 'tasacion'],
    equipoInicial: ['herramientas_oficio', 'ropa_trabajo'],
    oroExtra: 15,
    rasgo: {
      nombre: 'Credencial de gremio',
      descripcion: 'En cualquier ciudad con gremio consigues alojamiento y trabajo temporal.',
      efecto: { tipo: 'refugioSocial', lugares: ['ciudad', 'villa'] },
    },
    consecuencias: [
      'Tu maestro sigue vivo y no aprobó tu marcha.',
      'Hay una pieza tuya circulando con tu marca en ella.',
    ],
    contactoInicial: { rol: 'maestro artesano', actitud: 'decepcionado', ubicacion: 'ciudad natal' },
    deudaInicial: null,
    preguntas: [
      '¿Qué oficio aprendiste, y por qué lo dejaste?',
      '¿Qué opinaría tu maestro de lo que haces ahora?',
    ],
    pistas: { gremio: 9, artesano: 9, aprendiz: 8, taller: 8, oficio: 7, herrero: 7, forja: 6, maestro: 5 },
  },

  /* ─────────────────────────────────────────────────────────────────────── */
  soldado: {
    refId: 'soldado',
    nombre: 'Veterano',
    lema: 'Serví. Volví. No todos hicieron ambas cosas.',
    descripcion:
      'Estuviste en una guerra, en una guarnición o en una compañía mercenaria. Sabes moverte ' +
      'en formación, obedecer órdenes y reconocer cuándo una situación se va a torcer.',
    promptLore:
      'Es un veterano militar. Reconoce tácticas, respeta o desprecia la cadena de mando según ' +
      'su experiencia, y tiene camaradas dispersos. Cargó con algo de esa guerra.',
    habilidades: ['atletismo', 'intimidacion'],
    equipoInicial: ['insignia_compania', 'racion_viaje', 'venda'],
    oroExtra: 10,
    rasgo: {
      nombre: 'Camaradería',
      descripcion: 'Reconoces a otros veteranos y ellos a ti. Ventaja social con militares.',
      efecto: { tipo: 'ventajaSocial', grupo: 'militar' },
    },
    consecuencias: [
      'Alguien de tu antigua unidad te busca, y no sabes si para bien.',
      'Hay una orden que cumpliste y de la que no hablas.',
    ],
    contactoInicial: { rol: 'antiguo camarada', actitud: 'leal', ubicacion: 'errante' },
    deudaInicial: null,
    preguntas: [
      '¿En qué conflicto serviste?',
      '¿Qué orden cumpliste que preferirías no haber cumplido?',
    ],
    pistas: { soldado: 10, veterano: 10, guerra: 8, ejército: 9, mercenario: 7, guardia: 6, batalla: 7, compañía: 6 },
  },

  /* ─────────────────────────────────────────────────────────────────────── */
  erudito: {
    refId: 'erudito',
    nombre: 'Erudito',
    lema: 'Leí demasiado y ahora no puedo dejar de preguntar.',
    descripcion:
      'Bibliotecas, archivos, academias. Tu vida fue el estudio hasta que algo te sacó de ella. ' +
      'Sabes dónde buscar y a quién preguntar.',
    promptLore:
      'Se formó en una academia o biblioteca. Sabe investigar, leer lenguas antiguas y reconocer ' +
      'referencias que otros pasan por alto. Salió del mundo académico por algo.',
    habilidades: ['historia', 'saber_arcano'],
    equipoInicial: ['libro_notas', 'tinta_plata', 'lente_aumento'],
    oroExtra: 20,
    rasgo: {
      nombre: 'Acceso a archivos',
      descripcion: 'Puedes consultar bibliotecas y archivos vedados al público general.',
      efecto: { tipo: 'accesoInstitucion', lugares: ['biblioteca', 'academia', 'templo'] },
    },
    consecuencias: [
      'Publicaste algo que incomodó a alguien poderoso.',
      'Hay un libro que consultaste y que ya no está donde estaba.',
    ],
    contactoInicial: { rol: 'antiguo tutor', actitud: 'cordial', ubicacion: 'academia' },
    deudaInicial: { titulo: 'La cita que falta', tipo: 'investigacion' },
    preguntas: [
      '¿Qué investigabas cuando te fuiste?',
      '¿Qué encontraste que no deberías haber encontrado?',
    ],
    pistas: { erudito: 10, académico: 9, biblioteca: 9, estudioso: 8, investigar: 8, libro: 7, academia: 8, sabio: 7 },
  },

  /* ─────────────────────────────────────────────────────────────────────── */
  criminal: {
    refId: 'criminal',
    nombre: 'Fuera de la ley',
    lema: 'Nadie me dio nada. Lo cogí.',
    descripcion:
      'Robos, contrabando, información vendida. Sobreviviste en los márgenes y conoces a la gente ' +
      'que se mueve por ellos. Esa red sigue funcionando, para bien y para mal.',
    promptLore:
      'Tiene pasado criminal. Conoce el bajo mundo, los precios reales de las cosas y a quién ' +
      'sobornar. Los guardias lo miran mal si lo reconocen. Hay gente que le debe favores y gente a la que se los debe.',
    habilidades: ['sigilo', 'engano'],
    equipoInicial: ['ganzuas', 'capa_oscura', 'daga'],
    oroExtra: 25,
    rasgo: {
      nombre: 'Red del hampa',
      descripcion: 'En cualquier ciudad encuentras un contacto del bajo mundo.',
      efecto: { tipo: 'contactoUrbano', categoria: 'hampa' },
    },
    consecuencias: [
      'Hay una recompensa por ti en alguna parte, aunque sea pequeña.',
      'Alguien te cubrió las espaldas y sigue esperando el favor de vuelta.',
    ],
    contactoInicial: { rol: 'perista', actitud: 'interesada', ubicacion: 'ciudad' },
    deudaInicial: { titulo: 'La deuda pendiente', tipo: 'favor' },
    preguntas: [
      '¿Qué robaste que aún te persigue?',
      '¿A quién le debes un favor que no puedes pagar?',
    ],
    pistas: { ladrón: 10, criminal: 10, contrabandista: 9, hampa: 9, cárcel: 7, robar: 8, fugitivo: 8, callejón: 6 },
  },

  /* ─────────────────────────────────────────────────────────────────────── */
  noble: {
    refId: 'noble',
    nombre: 'Sangre noble',
    lema: 'Un apellido abre puertas. También las cierra.',
    descripcion:
      'Naciste con nombre, tierras o ambas cosas. Sabes cómo funcionan las cortes y sabes que ' +
      'nada de eso te sirve fuera de ellas.',
    promptLore:
      'Es de familia noble. Sabe de protocolo, política y linajes. La gente común lo trata con ' +
      'deferencia o con resentimiento. Su apellido tiene peso, para bien o para mal.',
    habilidades: ['trato_social', 'historia'],
    equipoInicial: ['ropas_finas', 'sello_lacrado', 'anillo_familia'],
    oroExtra: 60,
    rasgo: {
      nombre: 'Peso del apellido',
      descripcion: 'Consigues audiencia con autoridades locales sin necesidad de tirada.',
      efecto: { tipo: 'accesoSocial', nivel: 'autoridad' },
    },
    consecuencias: [
      'Tu familia espera algo de ti que aún no has dado.',
      'Hay una casa rival que recuerda perfectamente tu apellido.',
    ],
    contactoInicial: { rol: 'pariente influyente', actitud: 'exigente', ubicacion: 'capital' },
    deudaInicial: { titulo: 'Obligación de casa', tipo: 'familiar' },
    preguntas: [
      '¿Qué esperaba tu familia de ti?',
      '¿Estás en buenos términos con tu casa?',
    ],
    pistas: { noble: 10, aristócrata: 9, corte: 8, apellido: 7, linaje: 7, heredero: 8, casa: 5, señor: 5 },
  },

  /* ─────────────────────────────────────────────────────────────────────── */
  errante: {
    refId: 'errante',
    nombre: 'Errante',
    lema: 'Nunca he estado en ninguna parte más de una estación.',
    descripcion:
      'Caminos, caravanas, posadas distintas cada noche. No tienes casa y hace tiempo que dejaste ' +
      'de buscarla. A cambio, conoces rutas que no salen en los mapas.',
    promptLore:
      'Lleva años en el camino sin residencia fija. Conoce rutas, posadas y peligros del viaje. ' +
      'Se adapta rápido y no echa raíces. Alguien o algo lo mantiene en movimiento.',
    habilidades: ['supervivencia', 'percepcion'],
    equipoInicial: ['capa_viaje', 'saco_dormir', 'racion_viaje', 'cuerda'],
    oroExtra: 8,
    rasgo: {
      nombre: 'Conocedor de rutas',
      descripcion: 'Sabes el mejor camino entre dos puntos y dónde parar sin peligro.',
      efecto: { tipo: 'ventaja', prueba: 'viaje' },
    },
    consecuencias: [
      'Dejaste algo atrás en el primer sitio del que te fuiste.',
      'Hay un lugar al que no puedes volver.',
    ],
    contactoInicial: { rol: 'posadero', actitud: 'cordial', ubicacion: 'camino' },
    deudaInicial: null,
    preguntas: [
      '¿De qué estás huyendo, o qué estás buscando?',
      '¿Cuál es el sitio al que no puedes volver?',
    ],
    pistas: { errante: 10, vagabundo: 9, viajero: 9, nómada: 9, caminos: 7, sin_hogar: 8, caravana: 7 },
  },

  /* ─────────────────────────────────────────────────────────────────────── */
  devoto: {
    refId: 'devoto',
    nombre: 'Devoto',
    lema: 'Creí en algo. Sigo decidiendo si tenía razón.',
    descripcion:
      'Un templo, una orden o una promesa personal ordenaron tu vida durante años. Sabes de ritos, ' +
      'de consuelo y de la política que hay dentro de toda institución religiosa.',
    promptLore:
      'Tiene formación religiosa. Conoce ritos, símbolos y jerarquías de templo. Puede pedir ' +
      'refugio en lugares sagrados. Su relación con la fe puede haberse complicado.',
    habilidades: ['perspicacia', 'medicina'],
    equipoInicial: ['simbolo_sagrado', 'tunica_sencilla', 'incienso'],
    oroExtra: 12,
    rasgo: {
      nombre: 'Amparo de templo',
      descripcion: 'Obtienes refugio, curación básica y comida en cualquier templo.',
      efecto: { tipo: 'refugioSocial', lugares: ['templo', 'santuario'] },
    },
    consecuencias: [
      'Hay una pregunta que hiciste y que a tus superiores no les gustó.',
      'Alguien de tu orden confía en ti más de lo que mereces.',
    ],
    contactoInicial: { rol: 'hermano de orden', actitud: 'preocupada', ubicacion: 'templo' },
    deudaInicial: null,
    preguntas: [
      '¿En qué creías, y sigues creyendo?',
      '¿Qué te apartó de tu orden?',
    ],
    pistas: { devoto: 10, templo: 9, sacerdote: 9, fe: 8, orden: 6, monje: 8, religioso: 9, votos: 7 },
  },

  /* ─────────────────────────────────────────────────────────────────────── */
  superviviente: {
    refId: 'superviviente',
    nombre: 'Superviviente',
    lema: 'Yo salí. Otros no.',
    descripcion:
      'Una plaga, un incendio, una masacre, un naufragio. Algo arrasó tu vida anterior y tú ' +
      'seguiste respirando. Eso te dejó recursos y también cicatrices.',
    promptLore:
      'Sobrevivió a una catástrofe que se llevó su vida anterior. Es recursivo bajo presión y ' +
      'tiene cicatrices, físicas o no. Puede reaccionar mal ante situaciones que se lo recuerden.',
    habilidades: ['supervivencia', 'resistencia'],
    equipoInicial: ['cuchillo_gastado', 'manta_raida', 'recuerdo_familiar'],
    oroExtra: 5,
    rasgo: {
      nombre: 'Instinto de conservación',
      descripcion: 'Una vez por descanso largo, evitas por completo un daño que te habría matado.',
      efecto: { tipo: 'evitarMuerte', usos: 1, recarga: 'descansoLargo' },
    },
    consecuencias: [
      'Alguien más sobrevivió y no sabes dónde está.',
      'Hay una causa detrás de lo que ocurrió y nadie respondió por ella.',
    ],
    contactoInicial: null,
    deudaInicial: { titulo: 'Los que no salieron', tipo: 'personal' },
    preguntas: [
      '¿A qué sobreviviste?',
      '¿Hay alguien más que salió de aquello?',
    ],
    pistas: { superviviente: 10, huérfano: 8, catástrofe: 9, ruina: 6, perdí: 7, incendio: 7, plaga: 8, naufragio: 8 },
  },

  /* ─────────────────────────────────────────────────────────────────────── */
  artista: {
    refId: 'artista',
    nombre: 'Intérprete',
    lema: 'La gente paga por olvidarse un rato. Yo cobro por eso.',
    descripcion:
      'Música, relatos, acrobacias o teatro. Te ganaste la vida delante de gente y aprendiste ' +
      'a leer a un público mejor que a ti mismo.',
    promptLore:
      'Es intérprete: músico, narrador o actor. Sabe leer audiencias, improvisar y ganarse a la ' +
      'gente. Tiene reputación en los circuitos donde actuó, buena o mala.',
    habilidades: ['trato_social', 'acrobacias'],
    equipoInicial: ['instrumento', 'traje_escena', 'moneda_suerte'],
    oroExtra: 18,
    rasgo: {
      nombre: 'Ganarse la sala',
      descripcion: 'En cualquier taberna o plaza consigues comida, cama y algo de dinero actuando.',
      efecto: { tipo: 'ingresoSocial', lugares: ['taberna', 'plaza', 'posada'] },
    },
    consecuencias: [
      'Compusiste o contaste algo que ofendió a quien no debías.',
      'Hay un público en alguna ciudad que aún recuerda tu nombre.',
    ],
    contactoInicial: { rol: 'antiguo empresario', actitud: 'oportunista', ubicacion: 'ciudad' },
    deudaInicial: null,
    preguntas: [
      '¿Qué contabas o tocabas?',
      '¿En qué ciudad no te conviene volver a actuar?',
    ],
    pistas: { bardo: 8, músico: 10, actor: 9, artista: 9, cantante: 9, teatro: 8, acróbata: 8, taberna: 5 },
  },

  /* ─────────────────────────────────────────────────────────────────────── */
  campesino: {
    refId: 'campesino',
    nombre: 'Gente del campo',
    lema: 'Sé lo que cuesta comer. Los demás lo olvidan.',
    descripcion:
      'Tierra, ganado, estaciones. Trabajaste desde niño y sabes cosas prácticas que los nobles ' +
      'y los magos ignoran. Nadie espera gran cosa de ti, lo cual tiene sus ventajas.',
    promptLore:
      'Viene del campo. Conoce animales, cultivos, clima y trabajo duro. La gente sencilla confía ' +
      'en él de inmediato; las clases altas lo subestiman. Tiene sentido común práctico.',
    habilidades: ['supervivencia', 'resistencia'],
    equipoInicial: ['herramienta_campo', 'ropa_basta', 'racion_viaje'],
    oroExtra: 6,
    rasgo: {
      nombre: 'Uno de los nuestros',
      descripcion: 'La gente común te acoge y te habla con franqueza.',
      efecto: { tipo: 'ventajaSocial', grupo: 'plebe' },
    },
    consecuencias: [
      'Tu aldea depende de algo que está fallando.',
      'Dejaste un trabajo que alguien tuvo que asumir por ti.',
    ],
    contactoInicial: { rol: 'familiar en la aldea', actitud: 'cariñosa', ubicacion: 'aldea natal' },
    deudaInicial: null,
    preguntas: [
      '¿Qué te sacó del campo?',
      '¿Sigue tu familia allí?',
    ],
    pistas: { campesino: 10, granjero: 10, aldea: 8, campo: 7, pastor: 8, tierra: 6, humilde: 6, cosecha: 7 },
  },
});

/* ═══════════════════════════════════════════════════════════════════════════
   CONSULTAS
   ═══════════════════════════════════════════════════════════════════════════ */

/** @type {string[]} */
export const ORDEN_TRASFONDOS = Object.freeze([
  'gremial', 'soldado', 'erudito', 'criminal', 'noble',
  'errante', 'devoto', 'superviviente', 'artista', 'campesino',
]);

/**
 * @param {string} refId
 * @returns {Trasfondo|null}
 */
export function obtenerTrasfondo(refId) {
  return TRASFONDOS[refId] ?? null;
}

/** @returns {Trasfondo[]} */
export function listarTrasfondos() {
  return ORDEN_TRASFONDOS.map((t) => TRASFONDOS[t]).filter(Boolean);
}

/**
 * Léxico de pistas de trasfondos, para el intérprete de la entrevista.
 * @type {Map<string, Array<{refId: string, peso: number}>>}
 */
export const LEXICO_TRASFONDOS = (() => {
  const mapa = new Map();
  for (const t of Object.values(TRASFONDOS)) {
    for (const [palabra, peso] of Object.entries(t.pistas ?? {})) {
      const clave = palabra.toLowerCase();
      if (!mapa.has(clave)) mapa.set(clave, []);
      mapa.get(clave).push({ refId: t.refId, peso });
    }
  }
  return mapa;
})();

export default TRASFONDOS;
