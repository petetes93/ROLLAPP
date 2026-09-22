/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANVEIL · data/classes.data.js
 * ---------------------------------------------------------------------------
 * Vocaciones jugables. Contenido original.
 *
 * Cada vocación declara un campo `pistas`: el vocabulario con el que la gente
 * describe ese arquetipo al escribir libremente. Es lo que permite que
 * «quiero un tipo que aguante los golpes por sus compañeros» se resuelva como
 * Baluarte sin que el jugador haya visto una lista de clases.
 *
 * Los pesos importan: 'escudo' apunta claramente a Baluarte, mientras que
 * 'espada' aparece en tres vocaciones y por eso vale menos.
 *
 * Sin dependencias.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * @typedef {Object} Vocacion
 * @property {string} refId
 * @property {string} nombre
 * @property {'m'|'f'} genero
 * @property {string} lema
 * @property {string} descripcion Visible en la confirmación.
 * @property {string} promptLore Resumen enviado al director.
 * @property {string} atributoPrincipal
 * @property {string} atributoSecundario
 * @property {number} dadoVida Vida ganada por nivel.
 * @property {number} manaBase Maná inicial adicional.
 * @property {Array<{nombre: string, descripcion: string, nivel: number, efecto: Object}>} rasgos
 * @property {string[]} habilidadesGratis
 * @property {string[]} equipoInicial refIds de objetos.
 * @property {Record<string, number>} pistas Vocabulario → peso.
 * @property {string[]} preguntasPropias Preguntas de entrevista específicas.
 * @property {string[]} avanzadas Clases avanzadas accesibles.
 */

/** @type {Record<string, Vocacion>} */
export const CLASES = Object.freeze({

  /* ───────────────────────────────────────────────────────────────────────
     BALUARTE — el que se queda delante
     ─────────────────────────────────────────────────────────────────────── */
  baluarte: {
    refId: 'baluarte',
    nombre: 'Baluarte',
    genero: 'm',
    lema: 'Detrás de mí no pasa nadie.',
    descripcion:
      'Combatientes formados para sostener una línea. No buscan el golpe brillante: buscan que ' +
      'el que tienen detrás siga vivo al terminar. Su virtud es la terquedad y su defecto, la misma.',
    promptLore:
      'Es un baluarte: un combatiente defensivo entrenado para proteger a otros. Su instinto es ' +
      'interponerse. La gente le confía la retaguardia y espera que aguante.',
    atributoPrincipal: 'vigor',
    atributoSecundario: 'temple',
    dadoVida: 10,
    manaBase: 0,
    rasgos: [
      {
        nombre: 'Interponerse',
        descripcion: 'Puedes recibir en tu lugar un ataque dirigido a un aliado adyacente.',
        nivel: 1,
        efecto: { tipo: 'redirigirAtaque', usosPorRonda: 1 },
      },
      {
        nombre: 'Postura firme',
        descripcion: 'Si no te mueves en tu turno, reduces en 3 todo daño hasta tu siguiente turno.',
        nivel: 1,
        efecto: { tipo: 'reduccionDano', valor: 3, condicion: 'sinMover' },
      },
      {
        nombre: 'Segundo aliento',
        descripcion: 'Una vez por combate recuperas vida igual a tu nivel × 3.',
        nivel: 3,
        efecto: { tipo: 'curacion', formula: 'nivel*3', usos: 1, recarga: 'combate' },
      },
    ],
    habilidadesGratis: ['atletismo', 'resistencia'],
    equipoInicial: ['espada_corta', 'escudo_madera', 'coraza_cuero', 'racion_viaje'],
    pistas: {
      escudo: 10, proteger: 9, defender: 9, aguantar: 8, tanque: 10, guardaespaldas: 9,
      muralla: 8, guardián: 7, guardia: 6, soldado: 5, armadura: 6, resistir: 6,
      caballero: 5, veterano: 4, pesado: 4, línea: 5, retaguardia: 6,
    },
    preguntasPropias: [
      '¿A quién juraste proteger, y sigue con vida?',
      '¿Qué es lo que no pudiste detener?',
    ],
    avanzadas: ['muro_juramentado', 'vanguardia'],
  },

  /* ───────────────────────────────────────────────────────────────────────
     FILO — el duelista
     ─────────────────────────────────────────────────────────────────────── */
  filo: {
    refId: 'filo',
    nombre: 'Filo',
    genero: 'm',
    lema: 'Un golpe, bien puesto, basta.',
    descripcion:
      'Espadachines de precisión, formados en escuelas de duelo o aprendidos a base de sobrevivir. ' +
      'Cambian armadura por movimiento y confían en llegar antes que el otro.',
    promptLore:
      'Es un filo: duelista ágil y preciso. Prefiere el enfrentamiento limpio y la técnica al ' +
      'número. Suele tener escuela, reputación o rivales.',
    atributoPrincipal: 'destreza',
    atributoSecundario: 'vigor',
    dadoVida: 8,
    manaBase: 0,
    rasgos: [
      {
        nombre: 'Estocada',
        descripcion: 'Tu primer ataque de cada combate se lanza con ventaja.',
        nivel: 1,
        efecto: { tipo: 'ventaja', prueba: 'ataque', condicion: 'primerAtaque' },
      },
      {
        nombre: 'Reflejo de esgrima',
        descripcion: 'Tu esquiva aumenta un 8 % adicional.',
        nivel: 1,
        efecto: { tipo: 'esquivaExtra', valor: 0.08 },
      },
      {
        nombre: 'Riposta',
        descripcion: 'Al esquivar por completo un ataque, contraatacas de inmediato.',
        nivel: 3,
        efecto: { tipo: 'contraataque', disparador: 'esquivaTotal' },
      },
    ],
    habilidadesGratis: ['acrobacias', 'perspicacia'],
    equipoInicial: ['estoque', 'daga', 'jubon_reforzado', 'racion_viaje'],
    pistas: {
      duelista: 10, esgrima: 10, estoque: 9, espadachín: 10, florete: 9, rápido: 6,
      ágil: 7, preciso: 7, honor: 5, duelo: 9, técnica: 6, elegante: 5,
      mercenario: 4, rival: 5, escuela: 4,
    },
    preguntasPropias: [
      '¿Quién te enseñó a pelear, y qué opinaría de ti ahora?',
      '¿Hay alguien buscándote por un duelo pendiente?',
    ],
    avanzadas: ['maestro_de_sala', 'hoja_errante'],
  },

  /* ───────────────────────────────────────────────────────────────────────
     GLIFISTA — magia estudiada
     ─────────────────────────────────────────────────────────────────────── */
  glifista: {
    refId: 'glifista',
    nombre: 'Glifista',
    genero: 'm',
    lema: 'Todo efecto tiene una notación correcta.',
    descripcion:
      'Magos académicos. Su poder no viene de la sangre ni de un pacto, sino de años entendiendo ' +
      'cómo se escribe una orden que la realidad acepte. Llevan cuadernos y los defienden con la vida.',
    promptLore:
      'Es un glifista: mago formado en el estudio de glifos y notación arcana. Necesita su cuaderno ' +
      'y tiempo para preparar. Su magia es metódica, no intuitiva. Suele venir de una academia o de un maestro.',
    atributoPrincipal: 'intelecto',
    atributoSecundario: 'temple',
    dadoVida: 6,
    manaBase: 12,
    rasgos: [
      {
        nombre: 'Cuaderno de glifos',
        descripcion: 'Conoces tres glifos iniciales y puedes aprender más de fuentes escritas.',
        nivel: 1,
        efecto: { tipo: 'grimorio', inicial: 3 },
      },
      {
        nombre: 'Análisis arcano',
        descripcion: 'Identificas cualquier efecto mágico que veas con una tirada de Intelecto.',
        nivel: 1,
        efecto: { tipo: 'identificarMagia' },
      },
      {
        nombre: 'Notación eficiente',
        descripcion: 'Un glifo por descanso te cuesta la mitad de maná.',
        nivel: 3,
        efecto: { tipo: 'descuentoMana', valor: 0.5, usos: 1, recarga: 'descansoLargo' },
      },
    ],
    habilidadesGratis: ['saber_arcano', 'historia'],
    equipoInicial: ['baston_glifos', 'cuaderno_arcano', 'tunica_estudio', 'tinta_plata'],
    pistas: {
      mago: 8, hechicero: 6, arcano: 8, glifo: 10, académico: 9, erudito: 8,
      estudioso: 8, libro: 6, cuaderno: 7, conjuro: 7, magia: 6, academia: 9,
      investigador: 7, teoría: 6, maestro: 4, aprendiz: 5,
    },
    preguntasPropias: [
      '¿Qué buscabas aprender que tu academia no quiso enseñarte?',
      '¿Qué hay escrito en tu cuaderno que no enseñas a nadie?',
    ],
    avanzadas: ['archivista', 'rompeglifos'],
  },

  /* ───────────────────────────────────────────────────────────────────────
     VINCULADO — magia por pacto
     ─────────────────────────────────────────────────────────────────────── */
  vinculado: {
    refId: 'vinculado',
    nombre: 'Vinculado',
    genero: 'm',
    lema: 'Pedí ayuda. Me la dieron. Aún estoy pagando.',
    descripcion:
      'Su magia no se estudia: se debe. Alguien o algo les concedió poder y el precio sigue ' +
      'corriendo. Son poderosos e inestables, y nunca están del todo solos.',
    promptLore:
      'Es un vinculado: su magia procede de un pacto con una entidad. Esa entidad tiene intereses ' +
      'propios y a veces se manifiesta. El poder le llega fácil, pero con condiciones. Suele ocultarlo.',
    atributoPrincipal: 'carisma',
    atributoSecundario: 'temple',
    dadoVida: 7,
    manaBase: 10,
    rasgos: [
      {
        nombre: 'Voz del pacto',
        descripcion: 'Tu entidad te aconseja una vez por descanso largo. No siempre dice la verdad.',
        nivel: 1,
        efecto: { tipo: 'consejoEntidad', usos: 1, recarga: 'descansoLargo' },
      },
      {
        nombre: 'Poder prestado',
        descripcion: 'Puedes gastar vida en lugar de maná, a razón de 2 de vida por 1 de maná.',
        nivel: 1,
        efecto: { tipo: 'conversionVital', ratio: 2 },
      },
      {
        nombre: 'Marca visible',
        descripcion: 'Tu marca se enciende cerca de lo sobrenatural. Delata y protege a la vez.',
        nivel: 3,
        efecto: { tipo: 'deteccion', categoria: 'sobrenatural', penalizacionSigilo: -2 },
      },
    ],
    habilidadesGratis: ['saber_oculto', 'trato_social'],
    equipoInicial: ['foco_pacto', 'capa_raida', 'daga_ritual', 'racion_viaje'],
    pistas: {
      pacto: 10, maldito: 8, marca: 7, entidad: 9, brujo: 8, oscuro: 6,
      precio: 6, deuda: 6, voz: 5, poseído: 7, demonio: 6, trato: 8,
      susurro: 6, atormentado: 6, poder: 4,
    },
    preguntasPropias: [
      '¿Qué pediste, y qué te pidieron a cambio?',
      '¿Sabe alguien lo que llevas dentro?',
    ],
    avanzadas: ['heraldo', 'rompepacto'],
  },

  /* ───────────────────────────────────────────────────────────────────────
     RASTREADOR — el que conoce el camino
     ─────────────────────────────────────────────────────────────────────── */
  rastreador: {
    refId: 'rastreador',
    nombre: 'Rastreador',
    genero: 'm',
    lema: 'El terreno ya ha decidido el combate. Solo hay que leerlo.',
    descripcion:
      'Cazadores, guías y exploradores. Se manejan donde no hay caminos y suelen ver el peligro ' +
      'un momento antes que los demás. Pacientes hasta la exasperación.',
    promptLore:
      'Es un rastreador: explorador y cazador, cómodo en la naturaleza y a menudo incómodo en las ' +
      'ciudades. Lee huellas, clima y terreno. Suele viajar solo y tener un motivo para no parar.',
    atributoPrincipal: 'destreza',
    atributoSecundario: 'astucia',
    dadoVida: 8,
    manaBase: 3,
    rasgos: [
      {
        nombre: 'Leer el terreno',
        descripcion: 'Ventaja en percepción y supervivencia fuera de zonas urbanas.',
        nivel: 1,
        efecto: { tipo: 'ventaja', prueba: ['percepcion', 'supervivencia'], condicion: 'terrenoNatural' },
      },
      {
        nombre: 'Tiro certero',
        descripcion: 'Tus ataques a distancia ignoran la penalización por cobertura parcial.',
        nivel: 1,
        efecto: { tipo: 'ignorarCobertura', grado: 'parcial' },
      },
      {
        nombre: 'Emboscada preparada',
        descripcion: 'Si tú inicias el combate, todo tu bando actúa antes que los enemigos.',
        nivel: 3,
        efecto: { tipo: 'iniciativaGrupo', condicion: 'emboscadaPropia' },
      },
    ],
    habilidadesGratis: ['supervivencia', 'percepcion'],
    equipoInicial: ['arco_corto', 'cuchillo_caza', 'capa_viaje', 'cuerda', 'racion_viaje'],
    pistas: {
      cazador: 10, rastreador: 10, explorador: 9, bosque: 6, arco: 8, guía: 8,
      huellas: 9, naturaleza: 7, salvaje: 6, solitario: 5, montaraz: 9,
      trampa: 6, animal: 5, sendero: 6, paciente: 4,
    },
    preguntasPropias: [
      '¿A qué llevas años siguiendo la pista?',
      '¿Qué te sacó del sitio donde estabas cómodo?',
    ],
    avanzadas: ['ojo_de_halcon', 'guardian_de_sendas'],
  },

  /* ───────────────────────────────────────────────────────────────────────
     SOMBRA — el que no estaba allí
     ─────────────────────────────────────────────────────────────────────── */
  sombra: {
    refId: 'sombra',
    nombre: 'Sombra',
    genero: 'f',
    lema: 'La puerta cerrada es una opinión.',
    descripcion:
      'Ladrones, espías, informadores. Su oficio es entrar, saber y salir. Rara vez ganan un ' +
      'combate de frente, y rara vez necesitan tenerlo.',
    promptLore:
      'Es una sombra: especialista en sigilo, cerraduras e información. Trabaja desde los márgenes. ' +
      'Suele tener contactos turbios y un pasado que prefiere no detallar.',
    atributoPrincipal: 'astucia',
    atributoSecundario: 'destreza',
    dadoVida: 7,
    manaBase: 2,
    rasgos: [
      {
        nombre: 'Golpe oportuno',
        descripcion: 'Contra un enemigo desprevenido, tu daño se duplica.',
        nivel: 1,
        efecto: { tipo: 'multiplicadorDano', valor: 2, condicion: 'desprevenido' },
      },
      {
        nombre: 'Manos hábiles',
        descripcion: 'Ventaja para forzar cerraduras, robar y desactivar mecanismos.',
        nivel: 1,
        efecto: { tipo: 'ventaja', prueba: 'juego_manos' },
      },
      {
        nombre: 'Salida prevista',
        descripcion: 'Puedes huir de cualquier combate sin tirada, una vez por escena.',
        nivel: 3,
        efecto: { tipo: 'huidaGarantizada', usos: 1, recarga: 'escena' },
      },
    ],
    habilidadesGratis: ['sigilo', 'juego_manos'],
    equipoInicial: ['daga', 'ganzuas', 'capa_oscura', 'cuerda_seda'],
    pistas: {
      ladrón: 10, pícaro: 10, sigilo: 9, espía: 9, sombras: 8, ganzúa: 10,
      robar: 8, contrabandista: 8, gremio: 6, callejón: 6, oculto: 6,
      información: 6, discreto: 6, hábil: 4, asesino: 7,
    },
    preguntasPropias: [
      '¿Qué robaste que no deberías haber robado?',
      '¿A quién le debes un favor que no puedes pagar?',
    ],
    avanzadas: ['mano_izquierda', 'fantasma'],
  },

  /* ───────────────────────────────────────────────────────────────────────
     PORTAVOZ — el que convence
     ─────────────────────────────────────────────────────────────────────── */
  portavoz: {
    refId: 'portavoz',
    nombre: 'Portavoz',
    genero: 'm',
    lema: 'Toda pelea empieza porque alguien no supo hablar a tiempo.',
    descripcion:
      'Negociadores, embajadores, cantores de crónicas. Su arma es saber qué quiere el otro antes ' +
      'de que lo diga. Resuelven más problemas en una taberna que otros en una batalla.',
    promptLore:
      'Es un portavoz: negociador y orador. Su fuerza está en la palabra y en leer a la gente. ' +
      'Suele tener contactos, reputación y enemigos hechos con la lengua.',
    atributoPrincipal: 'carisma',
    atributoSecundario: 'astucia',
    dadoVida: 7,
    manaBase: 5,
    rasgos: [
      {
        nombre: 'Leer a la gente',
        descripcion: 'Al conocer a alguien, el director te revela algo que quiere o teme.',
        nivel: 1,
        efecto: { tipo: 'revelarMotivacion' },
      },
      {
        nombre: 'Palabra de aliento',
        descripcion: 'Una vez por escena, otorgas ventaja a un aliado en su siguiente tirada.',
        nivel: 1,
        efecto: { tipo: 'otorgarVentaja', usos: 1, recarga: 'escena' },
      },
      {
        nombre: 'Salida airosa',
        descripcion: 'Puedes intentar convertir un combate iniciado en una negociación.',
        nivel: 3,
        efecto: { tipo: 'desescalar', umbral: 'dificil' },
      },
    ],
    habilidadesGratis: ['trato_social', 'perspicacia'],
    equipoInicial: ['daga', 'ropas_finas', 'instrumento', 'sello_lacrado'],
    pistas: {
      bardo: 8, negociador: 10, diplomático: 10, hablar: 7, convencer: 9,
      cantor: 7, embajador: 9, labia: 8, carisma: 7, mentir: 6, social: 7,
      música: 6, cuentacuentos: 8, encantador: 7, noble: 5,
    },
    preguntasPropias: [
      '¿Qué mentira tuya sigue en pie y a quién sostiene?',
      '¿A quién convenciste de algo de lo que te arrepientes?',
    ],
    avanzadas: ['tejedor_de_pactos', 'voz_de_corte'],
  },

  /* ───────────────────────────────────────────────────────────────────────
     CUSTODIO — el que sostiene un juramento
     ─────────────────────────────────────────────────────────────────────── */
  custodio: {
    refId: 'custodio',
    nombre: 'Custodio',
    genero: 'm',
    lema: 'No sirvo a un dios. Sirvo a una promesa.',
    descripcion:
      'Sanadores y protectores ligados a un juramento propio, no a una iglesia. Su poder crece ' +
      'mientras cumplen lo prometido y flaquea cuando lo traicionan.',
    promptLore:
      'Es un custodio: sanador y protector ligado a un juramento personal. Su magia depende de ' +
      'cumplir esa promesa. No pertenece a ninguna iglesia. Si rompe su juramento, pierde poder.',
    atributoPrincipal: 'temple',
    atributoSecundario: 'carisma',
    dadoVida: 9,
    manaBase: 8,
    rasgos: [
      {
        nombre: 'Imposición',
        descripcion: 'Curas vida igual a tu nivel × 4, repartida como quieras, por descanso largo.',
        nivel: 1,
        efecto: { tipo: 'reservaCuracion', formula: 'nivel*4', recarga: 'descansoLargo' },
      },
      {
        nombre: 'Juramento vivo',
        descripcion: 'Mientras cumples tu juramento, +1 a todas las tiradas. Al romperlo, −2 hasta repararlo.',
        nivel: 1,
        efecto: { tipo: 'bonoJuramento', cumpliendo: 1, roto: -2 },
      },
      {
        nombre: 'Escudo de promesa',
        descripcion: 'Puedes absorber con tu propia vida el daño dirigido a quien protegiste por juramento.',
        nivel: 3,
        efecto: { tipo: 'absorberDano', objetivo: 'juramentado' },
      },
    ],
    habilidadesGratis: ['medicina', 'perspicacia'],
    equipoInicial: ['maza', 'simbolo_juramento', 'cota_ligera', 'vendas', 'racion_viaje'],
    pistas: {
      sanador: 10, curar: 9, juramento: 10, promesa: 9, clérigo: 7, paladín: 8,
      proteger: 5, fe: 6, devoto: 7, medicina: 8, templo: 5, votos: 9,
      penitencia: 7, redención: 7, culpa: 5,
    },
    preguntasPropias: [
      '¿Qué juraste exactamente, y ante quién?',
      '¿Has estado cerca de romperlo?',
    ],
    avanzadas: ['guardian_de_votos', 'penitente'],
  },
});

/* ═══════════════════════════════════════════════════════════════════════════
   CONSULTAS
   ═══════════════════════════════════════════════════════════════════════════ */

/** @type {string[]} */
export const ORDEN_CLASES = Object.freeze([
  'baluarte', 'filo', 'rastreador', 'sombra',
  'glifista', 'vinculado', 'portavoz', 'custodio',
]);

/**
 * @param {string} refId
 * @returns {Vocacion|null}
 */
export function obtenerClase(refId) {
  return CLASES[refId] ?? null;
}

/** @returns {Vocacion[]} */
export function listarClases() {
  return ORDEN_CLASES.map((c) => CLASES[c]).filter(Boolean);
}

/**
 * Léxico completo para el intérprete: palabra → { refId, peso }.
 * Se construye una sola vez al importar el módulo.
 * @type {Map<string, Array<{refId: string, peso: number}>>}
 */
export const LEXICO_CLASES = (() => {
  const mapa = new Map();
  for (const clase of Object.values(CLASES)) {
    for (const [palabra, peso] of Object.entries(clase.pistas)) {
      if (!mapa.has(palabra)) mapa.set(palabra, []);
      mapa.get(palabra).push({ refId: clase.refId, peso });
    }
  }
  return mapa;
})();

export default CLASES;
