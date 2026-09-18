/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANUM · data/races.srd.data.js
 * ---------------------------------------------------------------------------
 * Paquete de linajes basado en el System Reference Document.
 *
 * ATRIBUCIÓN (obligatoria por licencia):
 *   This work includes material taken from the System Reference Document 5.1
 *   ("SRD 5.1") and the System Reference Document 5.2 ("SRD 5.2") by Wizards of
 *   the Coast LLC, available at
 *   https://www.dndbeyond.com/srd
 *   The SRD 5.1 and SRD 5.2 are licensed under the Creative Commons Attribution
 *   4.0 International License, available at
 *   https://creativecommons.org/licenses/by/4.0/legalcode
 *
 * MODIFICACIONES REALIZADAS (la licencia exige indicarlas):
 *   · Traducción al castellano.
 *   · Adaptación de los seis atributos del SRD al Sistema Núcleo d20:
 *       Fuerza → vigor · Destreza → destreza · Constitución → temple
 *       Inteligencia → intelecto · Sabiduría → astucia · Carisma → carisma
 *   · Sustitución de los bonificadores raciales fijos por el reparto flexible
 *     del Núcleo d20.
 *   · Rasgos reescritos y reequilibrados para las mecánicas de este motor
 *     (fatiga, moral, durabilidad, esquiva porcentual).
 *   · Añadidos campos propios no presentes en el SRD: promptLore, pistas,
 *     ganchos, preguntasPropias y cultura ampliada.
 *
 * NOTA: Forjado bélico (Warforged) y Tabaxi NO figuran aquí porque no forman
 * parte del SRD y no son de uso libre. Sus nichos los cubren los linajes
 * originales Crisol y Zarpasuave, en races.original.data.js.
 *
 * Sin dependencias.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** Texto de atribución mostrado en Ajustes y en el README. */
export const ATRIBUCION_SRD =
  'Incluye material del System Reference Document 5.1 y 5.2 de Wizards of the Coast LLC, ' +
  'bajo licencia Creative Commons Attribution 4.0 International. Contenido traducido y adaptado.';

/** @type {Record<string, import('./races.original.data.js').Linaje>} */
export const RAZAS_SRD = Object.freeze({

  /* ═══════════════════════════════════════════════════════════════════════
     HUMANO
     ═══════════════════════════════════════════════════════════════════════ */
  humano: {
    refId: 'humano',
    fuente: 'srd',
    nombre: 'Humano',
    gentilicio: 'humanos',
    genero: 'm',
    lema: 'La ambición compensa una vida corta.',
    descripcion:
      'El linaje más numeroso y el más versátil. Donde otros pueblos conservan tradiciones ' +
      'milenarias, los humanos construyen imperios en una generación y los pierden en la siguiente. ' +
      'Su brevedad los vuelve inquietos.',
    aspecto:
      'Enormemente variados en estatura, tono de piel y rasgos. No hay dos regiones humanas ' +
      'que se parezcan, y ellos lo llevan a gala.',
    cultura:
      'Habitan en toda clase de territorios y forman la mayoría en casi todas las ciudades ' +
      'grandes. Se adaptan a lo que encuentran y adoptan costumbres ajenas sin pudor.',
    promptLore:
      'Es humano: el pueblo mayoritario y más adaptable. Es bien recibido casi en cualquier ' +
      'parte. Se le supone ambicioso y con prisa. No arrastra prejuicios raciales fuertes en su contra.',
    atributos: { carisma: 1, astucia: 1, vigor: 1 },
    rasgos: [
      {
        nombre: 'Versatilidad',
        descripcion: 'Empiezas con una competencia adicional a tu elección.',
        efecto: { tipo: 'habilidadExtra', cantidad: 1 },
      },
      {
        nombre: 'Determinación',
        descripcion: 'Una vez por descanso largo, repites una tirada fallida.',
        efecto: { tipo: 'repeticion', usos: 1, recarga: 'descansoLargo' },
      },
    ],
    habilidadesGratis: ['trato_social'],
    ganchos: [
      'Una familia que esperaba de ti algo distinto.',
      'Un maestro o mentor cuya recomendación ya no vale.',
      'Un lugar al que juraste volver con algo que demostrar.',
    ],
    nombresEjemplo: ['Aldric', 'Mira', 'Corven', 'Selde', 'Tomás', 'Ilaria', 'Bran', 'Nuvia'],
    esperanzaVida: 80,
    terrenoNatal: 'ciudad',
    pistas: { humano: 10, normal: 4, corriente: 4, versátil: 5, ambicioso: 4 },
  },

  /* ═══════════════════════════════════════════════════════════════════════
     ELFO
     ═══════════════════════════════════════════════════════════════════════ */
  elfo: {
    refId: 'elfo',
    fuente: 'srd',
    nombre: 'Elfo',
    gentilicio: 'elfos',
    genero: 'm',
    lema: 'Tenemos tiempo. Vosotros no.',
    descripcion:
      'Pueblo longevo y de gracia natural, con una relación con el mundo que los pueblos breves ' +
      'encuentran distante. Un elfo que decide algo puede tardar décadas en actuar, y aun así ' +
      'llegar antes que tú.',
    aspecto:
      'Esbeltos, de facciones finas y orejas puntiagudas. Rara vez muestran la edad hasta ' +
      'muy avanzada. Sus ojos varían en tonos poco habituales.',
    cultura:
      'No duermen: meditan en trance cuatro horas y quedan tan descansados como otros tras ocho. ' +
      'Sus comunidades son antiguas y de ritmo lento, y desconfían de las prisas ajenas.',
    promptLore:
      'Es elfo: longevo, elegante y con perspectiva de siglos. Se le respeta y a veces se le toma ' +
      'por distante o arrogante. Ve en el trance en lugar de dormir. Percibe cosas que otros pasan por alto.',
    atributos: { destreza: 2, astucia: 1 },
    rasgos: [
      {
        nombre: 'Visión oscura',
        descripcion: 'Ves con normalidad en la penumbra y distingues formas en la oscuridad total.',
        efecto: { tipo: 'visionOscuridad' },
      },
      {
        nombre: 'Sentidos agudos',
        descripcion: 'Ventaja en las tiradas de percepción.',
        efecto: { tipo: 'ventaja', prueba: 'percepcion' },
      },
      {
        nombre: 'Ascendencia feérica',
        descripcion: 'Ventaja contra el encantamiento. La magia no puede dormirte.',
        efecto: { tipo: 'ventaja', prueba: 'resistirEncantamiento', inmunidad: ['sueño_magico'] },
      },
      {
        nombre: 'Trance',
        descripcion: 'Descansas por completo en la mitad de tiempo que los demás.',
        efecto: { tipo: 'descansoRapido', factor: 0.5 },
      },
    ],
    habilidadesGratis: ['percepcion'],
    ganchos: [
      'Presenciaste algo hace un siglo que ahora vuelve a ocurrir.',
      'Un pueblo breve te importó más de lo que admites, y ya no está.',
      'Tu comunidad tomó una decisión con la que no estuviste de acuerdo.',
    ],
    nombresEjemplo: ['Aerith', 'Thalion', 'Nyssa', 'Elandor', 'Sariel', 'Veylin', 'Lirwen', 'Faelar'],
    esperanzaVida: 750,
    terrenoNatal: 'bosque',
    pistas: { elfo: 10, élfico: 10, longevo: 6, elegante: 5, arquero: 5, ágil: 4, antiguo: 4 },
    subrazas: {
      alto_elfo: {
        nombre: 'Alto elfo',
        descripcion: 'Educado en la tradición arcana. Intelecto +1 y un truco menor de magia.',
        atributos: { intelecto: 1 },
        rasgos: [{ nombre: 'Truco arcano', descripcion: 'Conoces un truco menor de glifos.', efecto: { tipo: 'trucoMagico', cantidad: 1 } }],
      },
      elfo_del_bosque: {
        nombre: 'Elfo del bosque',
        descripcion: 'Criado en la espesura. Astucia +1 y ocultación entre la vegetación.',
        atributos: { astucia: 1 },
        rasgos: [{ nombre: 'Máscara de la espesura', descripcion: 'Puedes ocultarte con vegetación ligera o lluvia.', efecto: { tipo: 'ocultacionNatural' } }],
      },
      drow: {
        nombre: 'Drow',
        descripcion: 'De las profundidades. Carisma +1, visión superior y sensibilidad a la luz.',
        atributos: { carisma: 1 },
        rasgos: [
          { nombre: 'Visión de las profundidades', descripcion: 'Tu visión en la oscuridad alcanza el doble.', efecto: { tipo: 'visionOscuridad', alcance: 2 } },
          { nombre: 'Sensibilidad a la luz', descripcion: 'Desventaja con luz solar directa.', efecto: { tipo: 'desventaja', condicion: 'luzSolar' } },
        ],
      },
    },
  },

  /* ═══════════════════════════════════════════════════════════════════════
     ENANO
     ═══════════════════════════════════════════════════════════════════════ */
  enano: {
    refId: 'enano',
    fuente: 'srd',
    nombre: 'Enano',
    gentilicio: 'enanos',
    genero: 'm',
    lema: 'La piedra recuerda quién la trabajó.',
    descripcion:
      'Pueblo de las montañas y las profundidades. Recios, tercos y de memoria larga para las ' +
      'deudas, tanto las que deben como las que les deben. Su artesanía es legendaria y ellos lo saben.',
    aspecto:
      'Bajos y anchos, densos como la piedra. Barbas cuidadas con trenzas y anillas. ' +
      'Manos grandes y desproporcionadas para su estatura.',
    cultura:
      'Clanes organizados en torno a la forja y la mina. El linaje pesa, pero el oficio pesa más: ' +
      'un mal artesano deshonra su apellido. Guardan rencores durante generaciones.',
    promptLore:
      'Es enano: recio, terco y de memoria larga. Viene de una cultura de forja y clan. ' +
      'Reconoce buen trabajo de un vistazo y desprecia lo chapucero. Aguanta el alcohol y el veneno mejor que nadie.',
    atributos: { temple: 2, vigor: 1 },
    rasgos: [
      {
        nombre: 'Visión oscura',
        descripcion: 'Ves con normalidad en la penumbra y distingues formas en la oscuridad.',
        efecto: { tipo: 'visionOscuridad' },
      },
      {
        nombre: 'Resistencia enana',
        descripcion: 'Ventaja contra venenos y reduces a la mitad el daño de estos.',
        efecto: { tipo: 'ventaja', prueba: 'resistirVeneno', reduccion: { veneno: 0.5 } },
      },
      {
        nombre: 'Conocimiento de la piedra',
        descripcion: 'Ventaja al examinar construcciones y hallazgos de piedra.',
        efecto: { tipo: 'ventaja', prueba: 'saber', condicion: 'piedra' },
      },
      {
        nombre: 'Carga firme',
        descripcion: 'La armadura pesada no reduce tu velocidad.',
        efecto: { tipo: 'ignorarPenalizacion', categoria: 'armaduraPesada' },
      },
    ],
    habilidadesGratis: ['artesania'],
    ganchos: [
      'Una deuda de clan que llevas años sin poder saldar.',
      'Un salón de tu pueblo tomado por algo que no debería estar allí.',
      'Una pieza que forjaste y acabó en las manos equivocadas.',
    ],
    nombresEjemplo: ['Thoradin', 'Helga', 'Brogan', 'Vistra', 'Dorn', 'Amber', 'Kildrak', 'Nala'],
    esperanzaVida: 350,
    terrenoNatal: 'montana',
    pistas: { enano: 10, enana: 10, forja: 7, mina: 7, barba: 6, hacha: 5, terco: 5, montaña: 5, martillo: 5 },
    subrazas: {
      enano_colinas: {
        nombre: 'Enano de las colinas',
        descripcion: 'Más resistente. Astucia +1 y vida adicional por nivel.',
        atributos: { astucia: 1 },
        rasgos: [{ nombre: 'Dureza enana', descripcion: 'Ganas 1 punto de vida adicional por nivel.', efecto: { tipo: 'vidaPorNivel', valor: 1 } }],
      },
      enano_montanas: {
        nombre: 'Enano de las montañas',
        descripcion: 'Más fuerte. Vigor +1 y competencia con armaduras.',
        atributos: { vigor: 1 },
        rasgos: [{ nombre: 'Adiestramiento marcial', descripcion: 'Competencia con toda armadura ligera y media.', efecto: { tipo: 'competenciaArmadura' } }],
      },
    },
  },

  /* ═══════════════════════════════════════════════════════════════════════
     MEDIANO
     ═══════════════════════════════════════════════════════════════════════ */
  mediano: {
    refId: 'mediano',
    fuente: 'srd',
    nombre: 'Mediano',
    gentilicio: 'medianos',
    genero: 'm',
    lema: 'La valentía se mide en momentos, no en estatura.',
    descripcion:
      'Pequeños, prácticos y sorprendentemente difíciles de matar. Prefieren la comodidad de una ' +
      'buena mesa a la gloria, lo cual hace más notable que tantos acaben en aventuras.',
    aspecto:
      'De poco más de un metro. Rostros amables y expresivos, pies grandes y a menudo descalzos. ' +
      'Ropas prácticas de colores cálidos.',
    cultura:
      'Comunidades rurales unidas donde todo el mundo es primo de alguien. Valoran la hospitalidad ' +
      'y la buena comida por encima de la ambición. Se les subestima siempre.',
    promptLore:
      'Es mediano: pequeño, ágil y afable. Se le subestima constantemente y eso le beneficia. ' +
      'Tiene suerte inexplicable y un valor tranquilo que sorprende a quien no lo espera.',
    atributos: { destreza: 2, carisma: 1 },
    rasgos: [
      {
        nombre: 'Suerte',
        descripcion: 'Al sacar un 1 natural, repites la tirada y usas el nuevo resultado.',
        efecto: { tipo: 'repetirPifia' },
      },
      {
        nombre: 'Valiente',
        descripcion: 'Ventaja contra el miedo.',
        efecto: { tipo: 'ventaja', prueba: 'resistirMiedo' },
      },
      {
        nombre: 'Agilidad menuda',
        descripcion: 'Puedes moverte a través del espacio de criaturas mayores que tú.',
        efecto: { tipo: 'movimientoLibre', condicion: 'criaturaMayor' },
      },
    ],
    habilidadesGratis: ['sigilo'],
    ganchos: [
      'Saliste de casa y en tu pueblo aún no entienden por qué.',
      'Alguien de tu familia se metió en un lío que has heredado.',
      'Guardas una receta, una llave o una historia que resulta valer mucho.',
    ],
    nombresEjemplo: ['Perrin', 'Lidda', 'Milo', 'Seraphina', 'Osborn', 'Rosie', 'Corrin', 'Nedda'],
    esperanzaVida: 150,
    terrenoNatal: 'camino',
    pistas: { mediano: 10, halfling: 10, pequeño: 7, menudo: 6, hospitalario: 5, suerte: 6, discreto: 5 },
    subrazas: {
      piesligeros: {
        nombre: 'Piesligeros',
        descripcion: 'Sociables y escurridizos. Carisma +1 y ocultación tras otros.',
        atributos: { carisma: 1 },
        rasgos: [{ nombre: 'Sigilo natural', descripcion: 'Puedes ocultarte tras una criatura mayor que tú.', efecto: { tipo: 'ocultacionTrasAliado' } }],
      },
      robusto: {
        nombre: 'Robusto',
        descripcion: 'De sangre dura. Temple +1 y resistencia al veneno.',
        atributos: { temple: 1 },
        rasgos: [{ nombre: 'Resistencia robusta', descripcion: 'Ventaja contra venenos y daño reducido a la mitad.', efecto: { tipo: 'ventaja', prueba: 'resistirVeneno' } }],
      },
    },
  },

  /* ═══════════════════════════════════════════════════════════════════════
     DRACÓNIDO
     ═══════════════════════════════════════════════════════════════════════ */
  draconido: {
    refId: 'draconido',
    fuente: 'srd',
    nombre: 'Dracónido',
    gentilicio: 'dracónidos',
    genero: 'm',
    lema: 'El clan primero. Siempre.',
    descripcion:
      'Descendientes de dragones, con escamas, aliento devastador y un sentido del honor que ' +
      'organiza sus vidas. Su lealtad al clan supera cualquier otra consideración, y eso les ha ' +
      'costado tanto amigos como enemigos.',
    aspecto:
      'Altos y corpulentos, cubiertos de escamas cuyo color delata su ascendencia. Sin cola ' +
      'ni alas, pero con hocico pronunciado y garras.',
    cultura:
      'Clanes con jerarquía estricta donde el valor propio se demuestra con hechos, no con ' +
      'palabras. Un dracónido sin clan es una figura trágica y bastante habitual entre los aventureros.',
    promptLore:
      'Es dracónido: humanoide con escamas y ascendencia de dragón. Puede exhalar un aliento ' +
      'devastador. Su honor y su clan lo definen. Impone respeto y a veces miedo por su sola presencia.',
    atributos: { vigor: 2, carisma: 1 },
    rasgos: [
      {
        nombre: 'Aliento',
        descripcion: 'Exhalas energía en cono. Daño 2d6, escala con el nivel. Recarga por descanso.',
        efecto: { tipo: 'alientoArma', dano: '2d6', escala: true, recarga: 'descansoCorto' },
      },
      {
        nombre: 'Ascendencia dracónica',
        descripcion: 'Resistes el tipo de daño asociado a tu linaje.',
        efecto: { tipo: 'resistenciaElemental', segun: 'linajeDragon' },
      },
      {
        nombre: 'Presencia imponente',
        descripcion: 'Ventaja en intimidación.',
        efecto: { tipo: 'ventaja', prueba: 'intimidacion' },
      },
    ],
    habilidadesGratis: ['intimidacion'],
    ganchos: [
      'Tu clan te repudió por algo que sigues sin considerar deshonroso.',
      'Buscas al dragón del que desciende tu linaje.',
      'Prometiste devolver el honor a un nombre que ya nadie pronuncia.',
    ],
    nombresEjemplo: ['Arjhan', 'Kava', 'Rhogar', 'Sora', 'Torinn', 'Nala', 'Balasar', 'Thava'],
    esperanzaVida: 80,
    terrenoNatal: 'montana',
    pistas: { dracónido: 10, dragonborn: 10, dragón: 8, escamas: 8, aliento: 8, honor: 5, clan: 5, imponente: 5 },
    linajesDragon: {
      fuego: { dano: 'fuego', forma: 'cono' },
      frio: { dano: 'frio', forma: 'cono' },
      rayo: { dano: 'rayo', forma: 'linea' },
      acido: { dano: 'acido', forma: 'linea' },
      veneno: { dano: 'veneno', forma: 'cono' },
    },
  },

  /* ═══════════════════════════════════════════════════════════════════════
     GNOMO
     ═══════════════════════════════════════════════════════════════════════ */
  gnomo: {
    refId: 'gnomo',
    fuente: 'srd',
    nombre: 'Gnomo',
    gentilicio: 'gnomos',
    genero: 'm',
    lema: '¿Y si lo intentamos al revés?',
    descripcion:
      'Pequeños, brillantes e incapaces de dejar un problema sin toquetear. Su entusiasmo es ' +
      'contagioso y su capacidad de atención, discutible. Inventan cosas que a veces funcionan.',
    aspecto:
      'Del tamaño de un mediano pero más delgados. Narices prominentes, ojos vivos y cabello ' +
      'que va en todas direcciones. Siempre manchados de algo.',
    cultura:
      'Comunidades excavadas o arbóreas, llenas de artilugios a medio terminar. Miden el prestigio ' +
      'por la originalidad de lo que inventas, no por su utilidad.',
    promptLore:
      'Es gnomo: pequeño, curioso e inventivo. Habla mucho y rápido. Su mente resiste ' +
      'especialmente bien la magia mental. Se le toma por excéntrico, y suele serlo.',
    atributos: { intelecto: 2, astucia: 1 },
    rasgos: [
      {
        nombre: 'Visión oscura',
        descripcion: 'Ves con normalidad en la penumbra.',
        efecto: { tipo: 'visionOscuridad' },
      },
      {
        nombre: 'Astucia gnoma',
        descripcion: 'Ventaja contra toda magia que afecte a tu mente.',
        efecto: { tipo: 'ventaja', prueba: 'resistirMagiaMental' },
      },
      {
        nombre: 'Curiosidad incurable',
        descripcion: 'Al examinar un mecanismo o artilugio, el director te revela algo útil.',
        efecto: { tipo: 'revelarMecanismo' },
      },
    ],
    habilidadesGratis: ['saber_arcano'],
    ganchos: [
      'Un invento tuyo salió mal y alguien pagó las consecuencias.',
      'Persigues una idea que todos te dicen que es imposible.',
      'Tu comunidad espera de ti un descubrimiento que aún no has hecho.',
    ],
    nombresEjemplo: ['Fonkin', 'Bimpnottin', 'Zook', 'Nyx', 'Boddynock', 'Ella', 'Warryn', 'Roywyn'],
    esperanzaVida: 400,
    terrenoNatal: 'bosque',
    pistas: { gnomo: 10, inventor: 8, curioso: 6, artilugio: 8, ingenioso: 7, excéntrico: 6, mecanismo: 7 },
    subrazas: {
      gnomo_bosque: {
        nombre: 'Gnomo del bosque',
        descripcion: 'Ligado a la naturaleza. Destreza +1 y trato con animales pequeños.',
        atributos: { destreza: 1 },
        rasgos: [{ nombre: 'Habla con bestias menores', descripcion: 'Te comunicas de forma simple con animales pequeños.', efecto: { tipo: 'hablarAnimales', tamano: 'pequeno' } }],
      },
      gnomo_rocas: {
        nombre: 'Gnomo de las rocas',
        descripcion: 'Artesano nato. Temple +1 y competencia con artilugios.',
        atributos: { temple: 1 },
        rasgos: [{ nombre: 'Manitas', descripcion: 'Fabricas artilugios menores con materiales básicos.', efecto: { tipo: 'fabricarArtilugio' } }],
      },
    },
  },

  /* ═══════════════════════════════════════════════════════════════════════
     SEMIELFO
     ═══════════════════════════════════════════════════════════════════════ */
  semielfo: {
    refId: 'semielfo',
    fuente: 'srd',
    nombre: 'Semielfo',
    gentilicio: 'semielfos',
    genero: 'm',
    lema: 'No pertenezco a ninguno de los dos. Eso también es un sitio.',
    descripcion:
      'Hijos de dos mundos que no acaban de encajar en ninguno. Esa posición incómoda les ha ' +
      'enseñado a leer a la gente mejor que nadie y a moverse entre culturas con soltura.',
    aspecto:
      'Estatura humana, facciones élficas suavizadas. Orejas levemente puntiagudas. ' +
      'Envejecen despacio, lo bastante como para incomodar a sus amigos humanos.',
    cultura:
      'No tienen una propia. Adoptan la de donde crecieron y siempre con una nota de distancia. ' +
      'Muchos acaban de intermediarios, diplomáticos o viajeros permanentes.',
    promptLore:
      'Es semielfo: mezcla de humano y elfo, sin encajar del todo en ninguna comunidad. ' +
      'Diplomático por necesidad y observador por costumbre. Suele caer bien y rara vez pertenecer.',
    atributos: { carisma: 2, destreza: 1 },
    rasgos: [
      {
        nombre: 'Visión oscura',
        descripcion: 'Ves con normalidad en la penumbra.',
        efecto: { tipo: 'visionOscuridad' },
      },
      {
        nombre: 'Herencia feérica',
        descripcion: 'Ventaja contra el encantamiento. La magia no puede dormirte.',
        efecto: { tipo: 'ventaja', prueba: 'resistirEncantamiento' },
      },
      {
        nombre: 'Versatilidad de dos mundos',
        descripcion: 'Empiezas con dos competencias adicionales a tu elección.',
        efecto: { tipo: 'habilidadExtra', cantidad: 2 },
      },
    ],
    habilidadesGratis: ['perspicacia'],
    ganchos: [
      'Un progenitor al que nunca conociste y del que sabes el nombre.',
      'Te expulsaron de una comunidad que creías tuya.',
      'Eres el único que puede hablar con dos bandos que se odian.',
    ],
    nombresEjemplo: ['Kaelen', 'Mirena', 'Doran', 'Sylwen', 'Ardin', 'Neve', 'Elric', 'Ysolde'],
    esperanzaVida: 180,
    terrenoNatal: 'ciudad',
    pistas: { semielfo: 10, mestizo: 7, diplomático: 6, entre: 4, forastero: 5, mediador: 6 },
  },

  /* ═══════════════════════════════════════════════════════════════════════
     SEMIORCO
     ═══════════════════════════════════════════════════════════════════════ */
  semiorco: {
    refId: 'semiorco',
    fuente: 'srd',
    nombre: 'Semiorco',
    gentilicio: 'semiorcos',
    genero: 'm',
    lema: 'Cuesta más tumbarme de lo que la gente calcula.',
    descripcion:
      'Fuertes, resistentes y acostumbrados a que se les juzgue antes de abrir la boca. ' +
      'Muchos cargan con una furia que han aprendido a administrar, y con la sospecha permanente ' +
      'de todo el que no los conoce.',
    aspecto:
      'Altos y musculosos, piel de tonos grisáceos o verdosos. Colmillos inferiores visibles ' +
      'y mandíbula marcada. Cicatrices frecuentes.',
    cultura:
      'Criados entre humanos u orcos, casi nunca aceptados del todo por ninguno. La fuerza les ' +
      'abrió puertas y les cerró otras. Muchos acaban en oficios donde nadie pregunta por el pasado.',
    promptLore:
      'Es semiorco: fuerte, resistente y prejuzgado allá donde va. Los guardias lo vigilan más ' +
      'de cerca. Aguanta castigos que tumbarían a otros y no cae fácilmente en combate.',
    atributos: { vigor: 2, temple: 1 },
    rasgos: [
      {
        nombre: 'Visión oscura',
        descripcion: 'Ves con normalidad en la penumbra.',
        efecto: { tipo: 'visionOscuridad' },
      },
      {
        nombre: 'Aguante implacable',
        descripcion: 'Al caer a 0 de vida, quedas en 1 en su lugar. Una vez por descanso largo.',
        efecto: { tipo: 'evitarCaida', usos: 1, recarga: 'descansoLargo' },
      },
      {
        nombre: 'Ataques salvajes',
        descripcion: 'Tus golpes críticos añaden un dado de daño adicional.',
        efecto: { tipo: 'danoCriticoExtra', dados: 1 },
      },
    ],
    habilidadesGratis: ['intimidacion'],
    ganchos: [
      'Te juzgaron por algo que no hiciste y no pudiste demostrarlo.',
      'Alguien te acogió cuando nadie más lo hizo, y le debes todo.',
      'Hay una parte de ti que temes y aún no sabes controlar.',
    ],
    nombresEjemplo: ['Grok', 'Yeva', 'Karn', 'Shump', 'Dench', 'Ovak', 'Mira', 'Thokk'],
    esperanzaVida: 75,
    terrenoNatal: 'montana',
    pistas: { semiorco: 10, orco: 8, fuerte: 6, bruto: 6, colmillos: 7, furia: 6, marginado: 6, cicatriz: 5 },
  },

  /* ═══════════════════════════════════════════════════════════════════════
     TIFLIN
     ═══════════════════════════════════════════════════════════════════════ */
  tiflin: {
    refId: 'tiflin',
    fuente: 'srd',
    nombre: 'Tiflin',
    gentilicio: 'tiflines',
    genero: 'm',
    lema: 'No elegí esta sangre. Sí elijo qué hago con ella.',
    descripcion:
      'Marcados por un pacto infernal que ninguno de ellos firmó. Cuernos, cola y ojos sin pupila ' +
      'los delatan allá donde van. Han aprendido a vivir con la sospecha ajena como ruido de fondo.',
    aspecto:
      'Cuernos de formas variadas, cola prensil, piel en tonos rojizos o violáceos. Ojos de un ' +
      'solo color sólido. Su presencia inquieta sin que nadie sepa explicar por qué.',
    cultura:
      'Dispersos, sin territorio propio. Suelen formar comunidades pequeñas y cerradas en los ' +
      'barrios peores de las ciudades. La desconfianza los ha vuelto solidarios entre sí.',
    promptLore:
      'Es tiflin: tiene cuernos, cola y sangre infernal. La gente desconfía de él por defecto ' +
      'y los templos le cierran las puertas. Resiste el fuego y maneja magia menor de forma innata.',
    atributos: { carisma: 2, intelecto: 1 },
    rasgos: [
      {
        nombre: 'Visión oscura',
        descripcion: 'Tu visión en la oscuridad es superior a la habitual.',
        efecto: { tipo: 'visionOscuridad', alcance: 2 },
      },
      {
        nombre: 'Resistencia infernal',
        descripcion: 'Reduces a la mitad todo daño de fuego.',
        efecto: { tipo: 'resistenciaElemental', elemento: 'fuego', valor: 0.5 },
      },
      {
        nombre: 'Legado infernal',
        descripcion: 'Conoces un truco de fuego. A nivel 3, un conjuro menor adicional.',
        efecto: { tipo: 'magiaInnata', trucos: ['llama_menor'], porNivel: { 3: 'reproche_infernal' } },
      },
    ],
    habilidadesGratis: ['engano'],
    ganchos: [
      'El pacto que te marcó lo firmó un antepasado, y alguien viene a cobrarlo.',
      'Un templo te expulsó y quieres saber por orden de quién.',
      'Cargas con una reputación que pertenece a otro tiflin.',
    ],
    nombresEjemplo: ['Damaia', 'Kairon', 'Zaria', 'Mordai', 'Nemeia', 'Ekemon', 'Rieta', 'Skamos'],
    esperanzaVida: 90,
    terrenoNatal: 'ciudad',
    pistas: { tiflin: 10, tiefling: 10, cuernos: 8, infernal: 9, demoníaco: 7, cola: 6, maldito: 6, marginado: 5 },
  },

  /* ═══════════════════════════════════════════════════════════════════════
     AASIMAR
     ═══════════════════════════════════════════════════════════════════════ */
  aasimar: {
    refId: 'aasimar',
    fuente: 'srd',
    nombre: 'Aasimar',
    gentilicio: 'aasimar',
    genero: 'm',
    lema: 'Alguien decidió por mí que yo importaba. Aún no sé si acertó.',
    descripcion:
      'Tocados por lo celestial, con una luz interior que no siempre saben si es un don o una ' +
      'vigilancia. La gente espera de ellos una bondad que no siempre sienten, y esa expectativa pesa.',
    aspecto:
      'Rasgos armónicos y ojos luminosos. Su piel emite un tenue resplandor en momentos de ' +
      'emoción intensa. A veces proyectan una sombra que no coincide con su cuerpo.',
    cultura:
      'No tienen comunidad propia: nacen dispersos entre otros pueblos, a menudo sin previo aviso ' +
      'para sus padres. Muchos acaban en templos, y muchos huyen de ellos.',
    promptLore:
      'Es aasimar: tiene linaje celestial y un resplandor tenue. La gente le atribuye una bondad ' +
      'que quizá no tenga. Puede sanar por contacto y revelar una forma luminosa. Su presencia impresiona.',
    atributos: { carisma: 2, temple: 1 },
    rasgos: [
      {
        nombre: 'Visión oscura',
        descripcion: 'Ves con normalidad en la penumbra.',
        efecto: { tipo: 'visionOscuridad' },
      },
      {
        nombre: 'Mano sanadora',
        descripcion: 'Curas por contacto vida igual a tu nivel. Una vez por descanso largo.',
        efecto: { tipo: 'curacionTacto', formula: 'nivel', usos: 1, recarga: 'descansoLargo' },
      },
      {
        nombre: 'Resistencia celestial',
        descripcion: 'Reduces a la mitad el daño necrótico y radiante.',
        efecto: { tipo: 'resistenciaElemental', elementos: ['necrotico', 'radiante'], valor: 0.5 },
      },
      {
        nombre: 'Revelación luminosa',
        descripcion: 'Una vez por descanso largo, manifiestas tu naturaleza: +daño y luz durante la escena.',
        efecto: { tipo: 'transformacion', usos: 1, recarga: 'descansoLargo' },
      },
    ],
    habilidadesGratis: ['perspicacia'],
    ganchos: [
      'Recibes visiones que no pediste y que no siempre entiendes.',
      'Un templo te reclama como suyo y tú no estás de acuerdo.',
      'Hiciste algo que no encaja con lo que todos esperan de ti.',
    ],
    nombresEjemplo: ['Seraphel', 'Auriel', 'Kaeda', 'Miron', 'Lysandra', 'Iomen', 'Cassiel', 'Vaela'],
    esperanzaVida: 160,
    terrenoNatal: 'ciudad',
    pistas: { aasimar: 10, celestial: 9, ángel: 8, luz: 6, divino: 7, sagrado: 6, resplandor: 7, elegido: 6 },
  },

  /* ═══════════════════════════════════════════════════════════════════════
     GOLIAT
     ═══════════════════════════════════════════════════════════════════════ */
  goliat: {
    refId: 'goliat',
    fuente: 'srd',
    nombre: 'Goliat',
    gentilicio: 'goliats',
    genero: 'm',
    lema: 'Nadie se queda atrás. Nadie carga solo.',
    descripcion:
      'Gigantes de las cumbres, criados donde el aire es fino y el error se paga caro. Su cultura ' +
      'mide el valor de una persona por lo que aporta al grupo, y desprecia por igual la vanidad ' +
      'y la queja.',
    aspecto:
      'Más de dos metros, piel gris moteada con marcas oscuras que consideran señales de destino. ' +
      'Calvos o con poco cabello. Musculatura evidente incluso bajo la ropa.',
    cultura:
      'Tribus nómadas de montaña con una ética de competición constante y ayuda mutua. Llevan la ' +
      'cuenta de sus logros en voz alta, no por vanidad, sino porque el grupo debe saber en quién confiar.',
    promptLore:
      'Es goliat: enorme, criado en la alta montaña con una ética tribal de esfuerzo y ayuda mutua. ' +
      'Carga más que nadie, aguanta el frío y compite consigo mismo. En las ciudades no cabe por las puertas.',
    atributos: { vigor: 2, temple: 1 },
    rasgos: [
      {
        nombre: 'Constitución de montaña',
        descripcion: 'Resistes el frío y te aclimatas a cualquier altitud.',
        efecto: { tipo: 'resistenciaElemental', elemento: 'frio', valor: 0.5 },
      },
      {
        nombre: 'Poderoso',
        descripcion: 'Tu capacidad de carga aumenta en 20 unidades.',
        efecto: { tipo: 'cargaExtra', valor: 20 },
      },
      {
        nombre: 'Resistencia de piedra',
        descripcion: 'Una vez por descanso corto, reduces un golpe recibido en 1d12 + tu temple.',
        efecto: { tipo: 'reduccionActiva', formula: '1d12+temple', usos: 1, recarga: 'descansoCorto' },
      },
      {
        nombre: 'Espíritu competitivo',
        descripcion: 'Ventaja en pruebas de atletismo y esfuerzo físico prolongado.',
        efecto: { tipo: 'ventaja', prueba: 'atletismo' },
      },
    ],
    habilidadesGratis: ['atletismo', 'resistencia'],
    ganchos: [
      'Tu tribu te encomendó una tarea y aún no la has completado.',
      'Perdiste a alguien en la montaña y no fue por el frío.',
      'Bajaste al valle por una razón que no sueles contar.',
    ],
    nombresEjemplo: ['Kalka', 'Thalai', 'Vunren', 'Ilma', 'Ghelryn', 'Aukan', 'Nalla', 'Keothi'],
    esperanzaVida: 90,
    terrenoNatal: 'montana',
    pistas: { goliat: 10, gigante: 8, montaña: 6, enorme: 7, alto: 5, tribu: 6, fuerte: 5, cumbre: 6 },
  },
});

/* ═══════════════════════════════════════════════════════════════════════════
   CONSULTAS
   ═══════════════════════════════════════════════════════════════════════════ */

/** @type {string[]} Orden de presentación. */
export const ORDEN_RAZAS_SRD = Object.freeze([
  'humano', 'elfo', 'enano', 'mediano', 'gnomo',
  'semielfo', 'semiorco', 'draconido', 'tiflin', 'aasimar', 'goliat',
]);

/**
 * @param {string} refId
 * @returns {Object|null}
 */
export function obtenerRazaSRD(refId) {
  return RAZAS_SRD[refId] ?? null;
}

/** @returns {Object[]} */
export function listarRazasSRD() {
  return ORDEN_RAZAS_SRD.map((r) => RAZAS_SRD[r]).filter(Boolean);
}

/**
 * Subrazas disponibles de un linaje, si las tiene.
 * @param {string} refId
 * @returns {Array<{clave: string, nombre: string, descripcion: string}>}
 */
export function subrazasDe(refId) {
  const raza = RAZAS_SRD[refId];
  if (!raza?.subrazas) return [];
  return Object.entries(raza.subrazas).map(([clave, sub]) => ({
    clave,
    nombre: sub.nombre,
    descripcion: sub.descripcion,
  }));
}

export default RAZAS_SRD;
