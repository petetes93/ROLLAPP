/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANVEIL · data/locations.data.js
 * ---------------------------------------------------------------------------
 * Geografía de los Reinos Quebrados. Contenido original.
 *
 * Veinte lugares en seis regiones, conectados por un grafo con rutas de tipo y
 * peligro declarados. No es una lista de escenarios: es un mapa navegable donde
 * la distancia y el riesgo importan.
 *
 * Cada lugar declara:
 *   · Sus SERVICIOS, que determinan qué se puede hacer allí
 *   · Sus SUBLUGARES, los interiores en que se divide
 *   · Sus GANCHOS, que el generador de misiones convierte en encargos
 *   · Su forma de DESCUBRIMIENTO: ocho son visibles de inicio, el resto hay que
 *     encontrarlos
 *
 * El campo `descubrimiento` es lo que hace que explorar valga la pena. Tres
 * lugares solo aparecen registrando a fondo, y no salen en ningún rumor.
 *
 * Sin dependencias.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/* ═══════════════════════════════════════════════════════════════════════════
   REGIONES
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * @typedef {Object} Region
 * @property {string} refId
 * @property {string} nombre
 * @property {string} terrenoDominante
 * @property {number} peligroBase 1-5
 * @property {string} descripcion
 * @property {string} promptLore
 * @property {string[]} rumores
 * @property {string[]} facciones
 */

/** @type {Record<string, Region>} */
export const REGIONES = Object.freeze({

  valle_central: {
    refId: 'valle_central',
    nombre: 'El Valle Central',
    terrenoDominante: 'camino',
    peligroBase: 1,
    descripcion: 'Tierra de labranza y caminos transitados. Lo más parecido a la paz que queda.',
    promptLore: 'El corazón habitado de los reinos. Aldeas, campos y una guardia que cobra impuestos con más celo que eficacia. La gente habla claro y desconfía de los forasteros lo justo.',
    rumores: [
      'dicen que en el vado alguien vio luces bajo el agua',
      'los impuestos han subido otra vez y nadie sabe adónde va el dinero',
      'un mercader no llegó a su destino la semana pasada',
      'hay quien jura que las tumbas viejas del norte están abiertas',
    ],
    facciones: ['guardia_valle', 'gremio_yunque'],
  },

  bosque_cenizo: {
    refId: 'bosque_cenizo',
    nombre: 'El Bosque Cenizo',
    terrenoDominante: 'bosque',
    peligroBase: 2,
    descripcion: 'Árboles de corteza gris que no ardieron nunca, aunque lo parezca.',
    promptLore: 'Bosque antiguo cuyos árboles tienen la corteza del color de la ceniza. Los sombracorteza lo consideran suyo y no reconocen fronteras. De noche hay cosas que no son lobos.',
    rumores: [
      'los guardianes del bosque no dejan pasar a nadie hacia el norte',
      'la arboleda madre lleva tres estaciones sin dar semilla',
      'alguien ha estado talando donde no debía',
      'un cazador volvió sin poder hablar de lo que vio',
    ],
    facciones: ['circulo_arboleda'],
  },

  montanas_yunque: {
    refId: 'montanas_yunque',
    nombre: 'Las Montañas del Yunque',
    terrenoDominante: 'montana',
    peligroBase: 3,
    descripcion: 'Piedra, hierro y humo de fragua. Los pasos se cierran en invierno.',
    promptLore: 'Cordillera de los clanes ferranos. Cada valle tiene su forja y su rencilla. El metal es barato y la comida cara. Los pasos altos se cierran cuando llega la nieve, y eso no es negociable.',
    rumores: [
      'una veta nueva ha aparecido donde no debería haber nada',
      'el clan de Forja Alta lleva dos lunas sin bajar a comerciar',
      'algo se movió en las galerías profundas',
      'el gremio quiere imponer su sello a todas las forjas',
    ],
    facciones: ['clanes_ferranos', 'gremio_yunque'],
  },

  marisma_velo: {
    refId: 'marisma_velo',
    nombre: 'La Marisma del Velo',
    terrenoDominante: 'pantano',
    peligroBase: 4,
    descripcion: 'Agua parda, niebla que no se levanta y cosas que se mueven bajo la superficie.',
    promptLore: 'Pantano donde el velo entre este mundo y el otro está gastado. Los brumales viven sobre pilotes y hablan poco. Nadie cruza de noche. Los guardianes del velo mantienen algo cerrado, y no explican qué.',
    rumores: [
      'los guardianes han doblado la vigilancia y no dicen por qué',
      'una barca volvió vacía y limpia, sin señal de lucha',
      'la niebla llega más lejos cada año',
      'hay quien paga bien por hongos del velo, y no para comer',
    ],
    facciones: ['guardianes_velo'],
  },

  ruinas_albares: {
    refId: 'ruinas_albares',
    nombre: 'Las Ruinas Albares',
    terrenoDominante: 'ruinas',
    peligroBase: 4,
    descripcion: 'Lo que queda de quienes construían mejor que nosotros.',
    promptLore: 'Restos de la civilización albar, anterior a los reinos. Piedra que encaja sin mortero, mecanismos que aún funcionan y autómatas que siguen cumpliendo órdenes de nadie. Los custodios estudian; los buscadores saquean.',
    rumores: [
      'un buscador entró en la cámara sellada y no ha salido',
      'los custodios han encontrado algo y no lo comparten',
      'los autómatas se han vuelto más activos este mes',
      'hay una puerta que no responde a ninguna llave conocida',
    ],
    facciones: ['custodios_albares'],
  },

  dunas_rojas: {
    refId: 'dunas_rojas',
    nombre: 'Las Dunas Rojas',
    terrenoDominante: 'desierto',
    peligroBase: 3,
    descripcion: 'Arena del color del óxido y un sol que no perdona.',
    promptLore: 'Desierto al sur, cruzado por rutas de caravana. El agua vale más que el oro y la hospitalidad es ley. Bajo la arena hay más de lo que se ve: la sal roja no se formó sola.',
    rumores: [
      'una caravana entera desapareció entre dos oasis',
      'la sal roja se agota en los pozos de siempre',
      'algo grande se mueve bajo las dunas cuando cae la noche',
      'los caravaneros conocen un camino que no está en ningún mapa',
    ],
    facciones: ['caravanas_duna', 'sombras_puerto'],
  },
});

/* ═══════════════════════════════════════════════════════════════════════════
   LUGARES
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * @typedef {Object} Conexion
 * @property {string} hasta refId del destino.
 * @property {number} distancia En horas de viaje.
 * @property {string} tipo camino|sendero|paso|travesia|tunel
 * @property {number} peligro 0-5
 * @property {string} [estacional] Estación en que se cierra.
 */

/**
 * @typedef {Object} Lugar
 * @property {string} refId
 * @property {string} nombre
 * @property {string} region
 * @property {string} tipo asentamiento|punto|ruina|natural|mazmorra
 * @property {number} tamano 0-4
 * @property {string} terreno
 * @property {number} peligro
 * @property {string} descubrimiento inicial|rumor|exploracion|mision
 * @property {string[]} servicios
 * @property {Array<Object>} sublugares
 * @property {Conexion[]} conexiones
 * @property {string[]} ganchos
 * @property {string} descripcion
 * @property {string} promptLore
 */

/** @type {Record<string, Lugar>} */
export const LUGARES = Object.freeze({

  /* ═══════════════════ VALLE CENTRAL ═══════════════════ */

  vado_yunque: {
    refId: 'vado_yunque', nombre: 'Vado del Yunque', region: 'valle_central',
    tipo: 'asentamiento', tamano: 2, terreno: 'camino', peligro: 0,
    descubrimiento: 'inicial',
    servicios: ['posada', 'herrero', 'mercado', 'templo'],
    sublugares: [
      { refId: 'posada_tres_clavos', nombre: 'La posada de los Tres Clavos', tipo: 'posada' },
      { refId: 'fragua_vado', nombre: 'La fragua del vado', tipo: 'herrero' },
      { refId: 'mercado_vado', nombre: 'La plaza del mercado', tipo: 'mercado' },
    ],
    conexiones: [
      { hasta: 'camino_norte', distancia: 3, tipo: 'camino', peligro: 1 },
      { hasta: 'saucedo', distancia: 4, tipo: 'camino', peligro: 1 },
      { hasta: 'linde_cenizo', distancia: 6, tipo: 'sendero', peligro: 2 },
    ],
    ganchos: [
      'el herrero necesita hierro que ya no llega de las montañas',
      'alguien ha estado robando en el mercado y nadie lo ve',
      'un viajero dejó un paquete y no volvió a recogerlo',
    ],
    descripcion: 'Un puente de piedra sobre el río y un pueblo que creció alrededor del peaje.',
    promptLore: 'Cruce de caminos con posada, fragua y mercado semanal. Tres mil almas y una guardia de doce. Aquí empiezan y acaban muchos viajes.',
  },

  camino_norte: {
    refId: 'camino_norte', nombre: 'El Camino del Norte', region: 'valle_central',
    tipo: 'punto', tamano: 0, terreno: 'camino', peligro: 1,
    descubrimiento: 'inicial',
    servicios: [],
    sublugares: [],
    conexiones: [
      { hasta: 'vado_yunque', distancia: 3, tipo: 'camino', peligro: 1 },
      { hasta: 'tumbas_bajas', distancia: 4, tipo: 'sendero', peligro: 2 },
      { hasta: 'paso_yunque', distancia: 8, tipo: 'paso', peligro: 3, estacional: 'invierno' },
    ],
    ganchos: [
      'hay una carreta abandonada con la carga intacta',
      'un mojón nuevo indica un lugar que no debería existir',
    ],
    descripcion: 'Tierra batida entre campos de trigo. Se ve venir a la gente de lejos.',
    promptLore: 'Camino principal hacia el norte. Transitado de día, solitario de noche. Los mojones marcan distancias a lugares que ya no existen.',
  },

  saucedo: {
    refId: 'saucedo', nombre: 'Saucedo', region: 'valle_central',
    tipo: 'asentamiento', tamano: 1, terreno: 'camino', peligro: 0,
    descubrimiento: 'inicial',
    servicios: ['posada', 'mercado'],
    sublugares: [
      { refId: 'posada_saucedo', nombre: 'La casa del vado viejo', tipo: 'posada' },
    ],
    conexiones: [
      { hasta: 'vado_yunque', distancia: 4, tipo: 'camino', peligro: 1 },
      { hasta: 'linde_cenizo', distancia: 5, tipo: 'sendero', peligro: 2 },
      { hasta: 'pilotes_brumal', distancia: 9, tipo: 'travesia', peligro: 3 },
    ],
    ganchos: [
      'el pozo del pueblo sabe raro desde hace dos semanas',
      'una familia se marchó de noche sin avisar a nadie',
    ],
    descripcion: 'Veinte casas de adobe y un sauce enorme en la plaza.',
    promptLore: 'Aldea pequeña donde todos se conocen y nada pasa desapercibido. La gente es hospitalaria y curiosa a partes iguales.',
  },

  tumbas_bajas: {
    refId: 'tumbas_bajas', nombre: 'Las Tumbas Bajas', region: 'valle_central',
    tipo: 'mazmorra', tamano: 0, terreno: 'mazmorra', peligro: 2,
    descubrimiento: 'inicial',
    servicios: [],
    sublugares: [
      { refId: 'antecamara_tumbas', nombre: 'La antecámara', tipo: 'sala' },
      { refId: 'galeria_tumbas', nombre: 'La galería de los nichos', tipo: 'sala' },
    ],
    conexiones: [
      { hasta: 'camino_norte', distancia: 4, tipo: 'sendero', peligro: 2 },
    ],
    ganchos: [
      'los sellos de las tumbas están rotos desde dentro',
      'hay una escalera que baja más de lo que debería',
      'alguien ha dejado ofrendas recientes',
    ],
    descripcion: 'Un montículo con una puerta de piedra que alguien abrió y no volvió a cerrar.',
    promptLore: 'Necrópolis anterior a los reinos, saqueada muchas veces. Los nichos superiores están vacíos; los inferiores, no. Huele a moho y a tiempo.',
  },

  /* ═══════════════════ BOSQUE CENIZO ═══════════════════ */

  linde_cenizo: {
    refId: 'linde_cenizo', nombre: 'La Linde del Cenizo', region: 'bosque_cenizo',
    tipo: 'punto', tamano: 0, terreno: 'bosque', peligro: 2,
    descubrimiento: 'inicial',
    servicios: [],
    sublugares: [],
    conexiones: [
      { hasta: 'vado_yunque', distancia: 6, tipo: 'sendero', peligro: 2 },
      { hasta: 'saucedo', distancia: 5, tipo: 'sendero', peligro: 2 },
      { hasta: 'arboleda_madre', distancia: 7, tipo: 'sendero', peligro: 3 },
      { hasta: 'claro_quemado', distancia: 5, tipo: 'sendero', peligro: 3 },
    ],
    ganchos: [
      'los árboles del borde tienen marcas talladas que no reconoces',
      'hay huellas que entran y ninguna que salga',
    ],
    descripcion: 'Donde el campo abierto se convierte en árboles de corteza gris.',
    promptLore: 'Frontera del bosque. Los sombracorteza vigilan quién entra. La luz cambia al cruzar la primera línea de árboles.',
  },

  arboleda_madre: {
    refId: 'arboleda_madre', nombre: 'La Arboleda Madre', region: 'bosque_cenizo',
    tipo: 'asentamiento', tamano: 1, terreno: 'bosque', peligro: 2,
    descubrimiento: 'inicial',
    servicios: ['posada', 'templo'],
    sublugares: [
      { refId: 'circulo_arboleda_sub', nombre: 'El círculo de los troncos', tipo: 'templo' },
    ],
    conexiones: [
      { hasta: 'linde_cenizo', distancia: 7, tipo: 'sendero', peligro: 3 },
      { hasta: 'claro_quemado', distancia: 4, tipo: 'sendero', peligro: 3 },
      { hasta: 'senda_raices', distancia: 6, tipo: 'sendero', peligro: 4 },
    ],
    ganchos: [
      'la arboleda no ha dado semilla en tres estaciones',
      'el círculo ha expulsado a uno de los suyos y nadie explica por qué',
      'algo enferma los árboles del sector norte',
    ],
    descripcion: 'Casas construidas entre raíces que llevan siglos ahí.',
    promptLore: 'Asentamiento sombracorteza en torno a un árbol de veinte metros de diámetro. El Círculo de la Arboleda decide aquí. Los forasteros son tolerados, no bienvenidos.',
  },

  claro_quemado: {
    refId: 'claro_quemado', nombre: 'El Claro Quemado', region: 'bosque_cenizo',
    tipo: 'natural', tamano: 0, terreno: 'bosque', peligro: 3,
    descubrimiento: 'rumor',
    servicios: [],
    sublugares: [],
    conexiones: [
      { hasta: 'linde_cenizo', distancia: 5, tipo: 'sendero', peligro: 3 },
      { hasta: 'arboleda_madre', distancia: 4, tipo: 'sendero', peligro: 3 },
    ],
    ganchos: [
      'nada ha vuelto a crecer aquí en cien años',
      'el suelo está caliente en el centro del claro',
      'hay un círculo de piedras que no es de este bosque',
    ],
    descripcion: 'Un círculo perfecto de tierra muerta en medio del bosque.',
    promptLore: 'Claro donde no crece nada. La ceniza del suelo no es de madera. Los sombracorteza no se acercan y no dicen por qué.',
  },

  senda_raices: {
    refId: 'senda_raices', nombre: 'La Senda de las Raíces', region: 'bosque_cenizo',
    tipo: 'mazmorra', tamano: 0, terreno: 'mazmorra', peligro: 4,
    descubrimiento: 'exploracion',
    servicios: [],
    sublugares: [
      { refId: 'boca_senda', nombre: 'La boca de la senda', tipo: 'sala' },
      { refId: 'camara_raiz', nombre: 'La cámara de la raíz madre', tipo: 'sala' },
    ],
    conexiones: [
      { hasta: 'arboleda_madre', distancia: 6, tipo: 'sendero', peligro: 4 },
    ],
    ganchos: [
      'las raíces de aquí abajo se mueven cuando no las miras',
      'hay algo enterrado en la cámara y no es un cuerpo',
    ],
    descripcion: 'Un túnel formado por raíces entrelazadas que baja hacia algo.',
    promptLore: 'Galería natural bajo la Arboleda Madre. Las raíces forman las paredes. Al fondo hay una cámara que los sombracorteza sellaron hace generaciones.',
  },

  /* ═══════════════════ MONTAÑAS DEL YUNQUE ═══════════════════ */

  paso_yunque: {
    refId: 'paso_yunque', nombre: 'El Paso del Yunque', region: 'montanas_yunque',
    tipo: 'punto', tamano: 0, terreno: 'montana', peligro: 3,
    descubrimiento: 'inicial',
    servicios: [],
    sublugares: [],
    conexiones: [
      { hasta: 'camino_norte', distancia: 8, tipo: 'paso', peligro: 3, estacional: 'invierno' },
      { hasta: 'forja_alta', distancia: 5, tipo: 'paso', peligro: 3, estacional: 'invierno' },
      { hasta: 'galerias_hondas', distancia: 4, tipo: 'tunel', peligro: 4 },
    ],
    ganchos: [
      'un desprendimiento reciente ha dejado algo al descubierto',
      'hay clavijas de hierro en la pared que no llevan a ninguna parte',
    ],
    descripcion: 'Un corredor entre paredes de roca donde el viento no para nunca.',
    promptLore: 'Paso de montaña que conecta el valle con los clanes. Se cierra con las primeras nieves y no vuelve a abrirse hasta la primavera. Hay refugios cada media jornada.',
  },

  forja_alta: {
    refId: 'forja_alta', nombre: 'Forja Alta', region: 'montanas_yunque',
    tipo: 'asentamiento', tamano: 2, terreno: 'montana', peligro: 1,
    descubrimiento: 'inicial',
    servicios: ['posada', 'herrero', 'mercado', 'gremio'],
    sublugares: [
      { refId: 'gran_fragua', nombre: 'La Gran Fragua', tipo: 'herrero' },
      { refId: 'salon_clan', nombre: 'El salón del clan', tipo: 'posada' },
      { refId: 'casa_gremio', nombre: 'La casa del gremio', tipo: 'gremio' },
    ],
    conexiones: [
      { hasta: 'paso_yunque', distancia: 5, tipo: 'paso', peligro: 3, estacional: 'invierno' },
      { hasta: 'galerias_hondas', distancia: 3, tipo: 'tunel', peligro: 4 },
      { hasta: 'mina_abandonada', distancia: 6, tipo: 'sendero', peligro: 3 },
    ],
    ganchos: [
      'el gremio quiere imponer su sello y el clan se niega',
      'una veta nueva ha aparecido donde la piedra era estéril',
      'lleva dos lunas sin bajar nadie a comerciar al valle',
    ],
    descripcion: 'Un pueblo excavado en la ladera, con humo saliendo de cien chimeneas.',
    promptLore: 'Asentamiento ferrano y la mejor forja de los reinos. El clan lleva ocho generaciones aquí. El Gremio del Yunque quiere su sello en cada pieza; el clan considera eso un insulto.',
  },

  galerias_hondas: {
    refId: 'galerias_hondas', nombre: 'Las Galerías Hondas', region: 'montanas_yunque',
    tipo: 'mazmorra', tamano: 0, terreno: 'mazmorra', peligro: 4,
    descubrimiento: 'rumor',
    servicios: [],
    sublugares: [
      { refId: 'nivel_alto_galerias', nombre: 'El nivel alto', tipo: 'sala' },
      { refId: 'pozo_galerias', nombre: 'El pozo', tipo: 'sala' },
      { refId: 'fondo_galerias', nombre: 'El fondo', tipo: 'sala' },
    ],
    conexiones: [
      { hasta: 'paso_yunque', distancia: 4, tipo: 'tunel', peligro: 4 },
      { hasta: 'forja_alta', distancia: 3, tipo: 'tunel', peligro: 4 },
    ],
    ganchos: [
      'los mineros abandonaron el nivel bajo y no explican qué oyeron',
      'hay galerías que no aparecen en ningún plano del clan',
      'algo grande se mueve tres niveles por debajo',
    ],
    descripcion: 'Kilómetros de túneles que los ferranos excavaron y luego sellaron.',
    promptLore: 'Red de minas que baja más de lo que nadie admite. Los niveles altos siguen en uso; los bajos están tapiados. Hay una razón para eso y el clan no la cuenta.',
  },

  mina_abandonada: {
    refId: 'mina_abandonada', nombre: 'La Mina Callada', region: 'montanas_yunque',
    tipo: 'ruina', tamano: 0, terreno: 'montana', peligro: 3,
    descubrimiento: 'exploracion',
    servicios: [],
    sublugares: [],
    conexiones: [
      { hasta: 'forja_alta', distancia: 6, tipo: 'sendero', peligro: 3 },
    ],
    ganchos: [
      'las herramientas siguen donde las dejaron, oxidadas',
      'la entrada se tapió desde fuera, no desde dentro',
    ],
    descripcion: 'Una boca de mina tapiada con piedra y prisa.',
    promptLore: 'Mina que el clan cerró hace cuarenta años. Nadie de Forja Alta hablará de ella. Los más viejos cambian de tema.',
  },

  /* ═══════════════════ MARISMA DEL VELO ═══════════════════ */

  pilotes_brumal: {
    refId: 'pilotes_brumal', nombre: 'Los Pilotes', region: 'marisma_velo',
    tipo: 'asentamiento', tamano: 1, terreno: 'pantano', peligro: 2,
    descubrimiento: 'inicial',
    servicios: ['posada', 'mercado', 'templo'],
    sublugares: [
      { refId: 'casa_alta_pilotes', nombre: 'La casa alta', tipo: 'posada' },
      { refId: 'templo_velo', nombre: 'El templo del velo', tipo: 'templo' },
    ],
    conexiones: [
      { hasta: 'saucedo', distancia: 9, tipo: 'travesia', peligro: 3 },
      { hasta: 'espejo_negro', distancia: 5, tipo: 'travesia', peligro: 4 },
      { hasta: 'puerto_lodo', distancia: 7, tipo: 'travesia', peligro: 3 },
    ],
    ganchos: [
      'los guardianes han doblado la vigilancia sin explicación',
      'una barca volvió vacía y sin señales de lucha',
      'alguien paga muy bien por hongos del velo',
    ],
    descripcion: 'Un pueblo entero sobre pilotes de madera negra, unido por pasarelas.',
    promptLore: 'Asentamiento brumal construido sobre el agua. Las pasarelas crujen y nadie las repara de noche. Los guardianes del velo tienen aquí su templo y no comparten lo que saben.',
  },

  espejo_negro: {
    refId: 'espejo_negro', nombre: 'El Espejo Negro', region: 'marisma_velo',
    tipo: 'natural', tamano: 0, terreno: 'pantano', peligro: 5,
    descubrimiento: 'rumor',
    servicios: [],
    sublugares: [],
    conexiones: [
      { hasta: 'pilotes_brumal', distancia: 5, tipo: 'travesia', peligro: 4 },
    ],
    ganchos: [
      'el agua está más quieta de lo que el viento permite',
      'tu reflejo tarda en imitarte',
      'los guardianes vigilan este sitio y no explican qué contienen',
    ],
    descripcion: 'Una laguna de agua inmóvil que refleja lo que no está delante.',
    promptLore: 'Laguna donde el velo está más gastado que en ninguna otra parte. El agua no se mueve. Los guardianes del velo montan guardia en la orilla y no dejan acercarse. Lo que se refleja no siempre coincide.',
  },

  puerto_lodo: {
    refId: 'puerto_lodo', nombre: 'Puerto Lodo', region: 'marisma_velo',
    tipo: 'asentamiento', tamano: 2, terreno: 'pantano', peligro: 3,
    descubrimiento: 'rumor',
    servicios: ['posada', 'mercado', 'herrero'],
    sublugares: [
      { refId: 'taberna_lodo', nombre: 'La taberna sin nombre', tipo: 'posada' },
      { refId: 'muelles_lodo', nombre: 'Los muelles', tipo: 'mercado' },
    ],
    conexiones: [
      { hasta: 'pilotes_brumal', distancia: 7, tipo: 'travesia', peligro: 3 },
      { hasta: 'oasis_sal', distancia: 12, tipo: 'travesia', peligro: 4 },
    ],
    ganchos: [
      'aquí se compra y se vende lo que en otros sitios es delito',
      'un barco llegó sin tripulación y con la carga intacta',
      'las Sombras del Puerto buscan a alguien y pagan por información',
    ],
    descripcion: 'Un puerto de aguas turbias donde no se hacen preguntas.',
    promptLore: 'Ciudad portuaria en el borde del pantano. Aquí llega lo que no puede pasar por aduana. Las Sombras del Puerto mandan más que cualquier autoridad, y todo el mundo lo sabe.',
  },

  /* ═══════════════════ RUINAS ALBARES ═══════════════════ */

  umbral_albar: {
    refId: 'umbral_albar', nombre: 'El Umbral Albar', region: 'ruinas_albares',
    tipo: 'ruina', tamano: 1, terreno: 'ruinas', peligro: 3,
    descubrimiento: 'rumor',
    servicios: ['archivo'],
    sublugares: [
      { refId: 'campamento_custodios', nombre: 'El campamento de los custodios', tipo: 'archivo' },
      { refId: 'gran_arco', nombre: 'El gran arco', tipo: 'sala' },
    ],
    conexiones: [
      { hasta: 'camino_norte', distancia: 10, tipo: 'sendero', peligro: 3 },
      { hasta: 'sala_sellada', distancia: 3, tipo: 'sendero', peligro: 5 },
      { hasta: 'oasis_sal', distancia: 11, tipo: 'travesia', peligro: 4 },
    ],
    ganchos: [
      'los custodios han encontrado algo y no lo comparten',
      'un buscador entró en la cámara sellada y no ha salido',
      'los autómatas se han vuelto más activos este mes',
    ],
    descripcion: 'Un arco de treinta metros que sigue en pie sin sostener nada.',
    promptLore: 'Entrada al complejo albar. Los custodios mantienen un campamento permanente y catalogan lo que encuentran. El arco no tiene función aparente y no se puede datar.',
  },

  sala_sellada: {
    refId: 'sala_sellada', nombre: 'La Sala Sellada', region: 'ruinas_albares',
    tipo: 'mazmorra', tamano: 0, terreno: 'mazmorra', peligro: 5,
    descubrimiento: 'mision',
    servicios: [],
    sublugares: [
      { refId: 'corredor_sellado', nombre: 'El corredor', tipo: 'sala' },
      { refId: 'camara_puerta', nombre: 'La cámara de la puerta', tipo: 'sala' },
    ],
    conexiones: [
      { hasta: 'umbral_albar', distancia: 3, tipo: 'sendero', peligro: 5 },
    ],
    ganchos: [
      'la puerta no responde a ninguna llave conocida',
      'hay un guardián que lleva siglos esperando',
      'las inscripciones piden algo, y no es una llave',
    ],
    descripcion: 'Un corredor que baja hasta una puerta que nadie ha abierto.',
    promptLore: 'Complejo sellado desde dentro por los propios albares. Un autómata guardián custodia la puerta final. Las inscripciones están en albar puro y los custodios solo entienden fragmentos.',
  },

  /* ═══════════════════ DUNAS ROJAS ═══════════════════ */

  oasis_sal: {
    refId: 'oasis_sal', nombre: 'El Oasis de la Sal', region: 'dunas_rojas',
    tipo: 'asentamiento', tamano: 2, terreno: 'desierto', peligro: 2,
    descubrimiento: 'rumor',
    servicios: ['posada', 'mercado', 'templo', 'herrero'],
    sublugares: [
      { refId: 'caravanserai', nombre: 'El caravanserai', tipo: 'posada' },
      { refId: 'bazar_sal', nombre: 'El bazar', tipo: 'mercado' },
    ],
    conexiones: [
      { hasta: 'puerto_lodo', distancia: 12, tipo: 'travesia', peligro: 4 },
      { hasta: 'umbral_albar', distancia: 11, tipo: 'travesia', peligro: 4 },
      { hasta: 'pozos_hondos', distancia: 6, tipo: 'travesia', peligro: 4 },
    ],
    ganchos: [
      'la sal roja se agota en los pozos de siempre',
      'una caravana entera desapareció entre dos oasis',
      'los caravaneros conocen rutas que no están en ningún mapa',
    ],
    descripcion: 'Palmeras, agua y un bazar donde converge todo el sur.',
    promptLore: 'Oasis y punto de encuentro de las rutas de caravana. El agua es propiedad comunal y quien la roba muere. La hospitalidad es ley absoluta: bajo un techo, hasta un enemigo está a salvo.',
  },

  pozos_hondos: {
    refId: 'pozos_hondos', nombre: 'Los Pozos Hondos', region: 'dunas_rojas',
    tipo: 'mazmorra', tamano: 0, terreno: 'mazmorra', peligro: 4,
    descubrimiento: 'exploracion',
    servicios: [],
    sublugares: [
      { refId: 'boca_pozos', nombre: 'La boca del pozo', tipo: 'sala' },
      { refId: 'galeria_sal', nombre: 'La galería de sal', tipo: 'sala' },
    ],
    conexiones: [
      { hasta: 'oasis_sal', distancia: 6, tipo: 'travesia', peligro: 4 },
    ],
    ganchos: [
      'la sal de aquí abajo no se formó por evaporación',
      'las galerías siguen un patrón que no es natural',
      'algo se mueve cuando el pozo queda a oscuras',
    ],
    descripcion: 'Pozos de sal que bajan mucho más de lo que un pozo necesita.',
    promptLore: 'Minas de sal roja bajo las dunas. Las galerías inferiores tienen paredes talladas y nadie sabe por quién. La sal roja tiene un origen que los caravaneros prefieren no investigar.',
  },
});

/* ═══════════════════════════════════════════════════════════════════════════
   CONSULTAS
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * @param {string} refId
 * @returns {Lugar|null}
 */
export function obtenerLugar(refId) {
  return LUGARES[refId] ?? null;
}

/**
 * @param {string} refId
 * @returns {Region|null}
 */
export function obtenerRegion(refId) {
  return REGIONES[refId] ?? null;
}

/**
 * Lugares de una región.
 * @param {string} region
 * @returns {Lugar[]}
 */
export function lugaresDe(region) {
  return Object.values(LUGARES).filter((l) => l.region === region);
}

/**
 * Lugares visibles al empezar la partida.
 * @returns {Lugar[]}
 */
export function lugaresIniciales() {
  return Object.values(LUGARES).filter((l) => l.descubrimiento === 'inicial');
}

/**
 * Busca un sublugar en cualquier lugar.
 * @param {string} refId
 * @returns {Object|null}
 */
export function obtenerSublugar(refId) {
  for (const lugar of Object.values(LUGARES)) {
    const encontrado = (lugar.sublugares ?? []).find((s) => s.refId === refId);
    if (encontrado) return { ...encontrado, lugar: lugar.refId };
  }
  return null;
}

/**
 * Sublugares de un lugar.
 * @param {string} refIdLugar
 * @returns {Array<Object>}
 */
export function sublugaresDe(refIdLugar) {
  return LUGARES[refIdLugar]?.sublugares ?? [];
}

/**
 * Busca un lugar por nombre aproximado.
 * Lo usa el enrutador cuando el jugador escribe «voy a Forja Alta».
 *
 * @param {string} texto
 * @returns {Lugar|null}
 */
export function buscarLugar(texto) {
  if (!texto) return null;

  const limpio = String(texto).toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  for (const l of Object.values(LUGARES)) {
    const nombre = l.nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (nombre === limpio) return l;
  }

  for (const l of Object.values(LUGARES)) {
    const nombre = l.nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (nombre.includes(limpio) || limpio.includes(nombre)) return l;
  }

  return null;
}

/**
 * Lugar de partida según el linaje del personaje.
 *
 * Empezar donde tu gente vive hace que el mundo se sienta tuyo desde el primer
 * turno.
 *
 * @param {string} linaje
 * @returns {string}
 */
export function inicioSegunLinaje(linaje) {
  // Los identificadores son los de races.data.js: valdes, sombracorteza,
  // ferrano, albar, griscuerno, menudo, brumal, crisol.
  const mapa = {
    ferrano: 'forja_alta',
    brumal: 'pilotes_brumal',
    sombracorteza: 'arboleda_madre',
    crisol: 'oasis_sal',
    albar: 'umbral_albar',
    griscuerno: 'paso_yunque',
    valdes: 'vado_yunque',
    menudo: 'saucedo',
  };
  return mapa[linaje] ?? 'vado_yunque';
}

export default LUGARES;
