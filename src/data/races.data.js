/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANUM · data/races.data.js
 * ---------------------------------------------------------------------------
 * Linajes jugables. Contenido original de alta fantasía clásica.
 *
 * Cada linaje aporta cuatro cosas al personaje:
 *   1. Modificadores de atributo — mecánica
 *   2. Rasgos pasivos — mecánica con expresión narrativa
 *   3. Contexto cultural — material que el director usa para narrar
 *   4. Ganchos — semillas de historia que el director puede recoger
 *
 * El campo `promptLore` es el que se envía al director de juego. Es deliberada-
 * mente breve: describe cómo se comporta el mundo ante ese linaje, no una
 * enciclopedia. El director necesita saber que un Sombracorteza incomoda a los
 * guardias de ciudad, no la historia de sus últimos ocho siglos.
 *
 * Sin dependencias.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * @typedef {Object} Linaje
 * @property {string} refId Identificador estable.
 * @property {string} nombre
 * @property {string} gentilicio Plural, para la narración.
 * @property {'m'|'f'|'n'} genero Género gramatical del nombre.
 * @property {string} lema Frase que resume su carácter.
 * @property {string} descripcion Texto visible en la creación.
 * @property {string} aspecto Rasgos físicos, para que el director describa.
 * @property {string} cultura Cómo viven y qué valoran.
 * @property {string} promptLore Resumen enviado al director.
 * @property {Record<string, number>} atributos Modificadores.
 * @property {Array<{nombre: string, descripcion: string, efecto: Object}>} rasgos
 * @property {string[]} habilidadesGratis Competencias iniciales.
 * @property {string[]} ganchos Semillas narrativas.
 * @property {string[]} nombresEjemplo Para el generador aleatorio.
 * @property {number} esperanzaVida Años, para el contexto.
 * @property {string} terrenoNatal Terreno donde son comunes.
 */

/** @type {Record<string, Linaje>} */
export const RAZAS = Object.freeze({

  /* ───────────────────────────────────────────────────────────────────────
     VALDÉS — humanos de los reinos centrales
     ─────────────────────────────────────────────────────────────────────── */
  valdes: {
    refId: 'valdes',
    nombre: 'Valdés',
    gentilicio: 'valdeses',
    genero: 'm',
    lema: 'Una vida corta obliga a decidir deprisa.',
    descripcion:
      'Pueblo de los reinos del valle central. Ni los más antiguos ni los más fuertes, ' +
      'pero sí los más numerosos y los más dispuestos a intentar algo que nunca se ha hecho. ' +
      'Donde otros linajes esperan una generación, un valdés lo prueba esta tarde.',
    aspecto:
      'Complexión variada, piel de tonos oliva a broncíneo, cabello oscuro. Visten en capas ' +
      'superpuestas y llevan encima más herramientas de las que necesitan.',
    cultura:
      'Organizados en ciudades-gremio donde el oficio pesa más que el apellido. La lealtad se ' +
      'debe al maestro que te enseñó, no a la tierra donde naciste. Envejecen rápido y lo saben: ' +
      'de ahí su prisa por dejar algo escrito.',
    promptLore:
      'Los valdeses son el pueblo mayoritario de los reinos del valle. Se les considera ' +
      'adaptables, pragmáticos y con prisa. Son bien recibidos casi en cualquier parte y ' +
      'se les toma por gente sin memoria larga, lo cual a veces es una ventaja.',
    atributos: { carisma: 1, astucia: 1, intelecto: 1 },
    rasgos: [
      {
        nombre: 'Aprendiz eterno',
        descripcion: 'Empiezas con una competencia adicional a tu elección.',
        efecto: { tipo: 'habilidadExtra', cantidad: 1 },
      },
      {
        nombre: 'Segunda oportunidad',
        descripcion: 'Una vez por descanso largo, repites una tirada fallida.',
        efecto: { tipo: 'repeticion', usos: 1, recarga: 'descansoLargo' },
      },
    ],
    habilidadesGratis: ['trato_social'],
    ganchos: [
      'Un maestro de gremio al que le debes el aprendizaje y aún no has pagado.',
      'Una carta de recomendación que ya no sirve porque quien la firmó ha muerto.',
      'Un hermano que eligió el camino contrario al tuyo.',
    ],
    nombresEjemplo: ['Iven', 'Maerta', 'Corvo', 'Selde', 'Andrek', 'Ilaria', 'Bras', 'Nuvia'],
    esperanzaVida: 70,
    terrenoNatal: 'ciudad',
  },

  /* ───────────────────────────────────────────────────────────────────────
     SOMBRACORTEZA — gente del bosque profundo
     ─────────────────────────────────────────────────────────────────────── */
  sombracorteza: {
    refId: 'sombracorteza',
    nombre: 'Sombracorteza',
    gentilicio: 'sombracortezas',
    genero: 'm',
    lema: 'El bosque recuerda lo que los reinos olvidan.',
    descripcion:
      'Nacidos bajo la techumbre del Bosque Cenizo, donde la luz llega filtrada y verde. ' +
      'Su piel adopta con los años la textura de la corteza que más han tocado. ' +
      'En las ciudades se les mira con desconfianza; en el bosque, con respeto.',
    aspecto:
      'Altos y enjutos, piel veteada en gris y pardo que se endurece con la edad. Ojos sin ' +
      'esclerótica visible, negros por completo. Se mueven sin hacer ruido, incluso sin proponérselo.',
    cultura:
      'No tienen ciudades: tienen arboledas con nombre. La propiedad les resulta un concepto ' +
      'incómodo y las deudas las pagan en favores, no en oro. Guardan memoria oral de ' +
      'acontecimientos que los archivos de los reinos dan por leyenda.',
    promptLore:
      'Los sombracortezas vienen del bosque profundo y tienen la piel veteada como corteza. ' +
      'En las ciudades levantan recelo y a menudo se les niega la entrada a gremios y templos. ' +
      'Conocen historias antiguas que los eruditos consideran fábulas. No entienden bien la propiedad privada.',
    atributos: { destreza: 2, temple: 1 },
    rasgos: [
      {
        nombre: 'Paso callado',
        descripcion: 'Ventaja en las tiradas de sigilo en terreno natural.',
        efecto: { tipo: 'ventaja', prueba: 'sigilo', condicion: 'terrenoNatural' },
      },
      {
        nombre: 'Corteza viva',
        descripcion: 'Reduces en 1 todo daño físico recibido.',
        efecto: { tipo: 'reduccionDano', valor: 1, categoria: 'fisico' },
      },
      {
        nombre: 'Memoria del bosque',
        descripcion: 'Puedes preguntar al director por un recuerdo antiguo del lugar donde estás.',
        efecto: { tipo: 'consultaNarrativa', usos: 1, recarga: 'descansoLargo' },
      },
    ],
    habilidadesGratis: ['supervivencia', 'sigilo'],
    ganchos: [
      'Tu arboleda fue talada y nadie respondió por ello.',
      'Llevas encima una semilla que debes plantar donde te digan, y aún no te lo han dicho.',
      'Un pacto con algo del bosque que aceptaste siendo demasiado joven.',
    ],
    nombresEjemplo: ['Vessel', 'Umbra', 'Tirno', 'Ash', 'Quenlai', 'Roble', 'Sirna', 'Ombro'],
    esperanzaVida: 200,
    terrenoNatal: 'bosque',
  },

  /* ───────────────────────────────────────────────────────────────────────
     FERRANO — pueblo de las forjas montañesas
     ─────────────────────────────────────────────────────────────────────── */
  ferrano: {
    refId: 'ferrano',
    nombre: 'Ferrano',
    gentilicio: 'ferranos',
    genero: 'm',
    lema: 'Lo que se hace bien, se hace una vez.',
    descripcion:
      'Del interior de las Montañas Yunque, donde el fuego lleva encendido tanto tiempo que nadie ' +
      'recuerda haberlo prendido. Bajos, densos y tercos. Miden a la gente por lo que deja hecho.',
    aspecto:
      'Anchos de hombros y de mano. Piel curtida por el calor de la forja, con motas de ceniza ' +
      'que ya no se van. Barbas y trenzas con anillas de metal que registran oficios y deudas.',
    cultura:
      'Su sociedad es un registro: cada anilla en la barba es un contrato cumplido. Romper la ' +
      'palabra dada es peor que un delito, es dejar de existir socialmente. Desprecian el trabajo ' +
      'chapucero más que la maldad.',
    promptLore:
      'Los ferranos vienen de las forjas de la montaña. Son tercos, meticulosos y llevan anillas ' +
      'en la barba que registran contratos cumplidos. Su palabra es vinculante y romperla los ' +
      'deshonra. Reconocen la calidad del trabajo a simple vista y desprecian lo mal hecho.',
    atributos: { vigor: 2, temple: 1 },
    rasgos: [
      {
        nombre: 'Ojo de forja',
        descripcion: 'Sabes de un vistazo la calidad y el estado real de cualquier objeto fabricado.',
        efecto: { tipo: 'revelarObjeto', alcance: 'fabricado' },
      },
      {
        nombre: 'Raíz de piedra',
        descripcion: 'Ventaja contra empujones, derribos y efectos que te muevan de tu sitio.',
        efecto: { tipo: 'ventaja', prueba: 'resistirDesplazamiento' },
      },
      {
        nombre: 'Palabra de anilla',
        descripcion: 'Al comprometerte formalmente, ganas +2 en todas las tiradas para cumplirlo.',
        efecto: { tipo: 'bonoJuramento', valor: 2 },
      },
    ],
    habilidadesGratis: ['artesania', 'tasacion'],
    ganchos: [
      'Una anilla vacía en tu barba: un contrato que aceptaste y no has cumplido.',
      'Una pieza que forjaste y acabó usándose para algo que no querías.',
      'El nombre de tu maestro está borrado del registro y nadie te explica por qué.',
    ],
    nombresEjemplo: ['Drum', 'Halda', 'Torbek', 'Gunna', 'Marek', 'Osla', 'Fendal', 'Brisa'],
    esperanzaVida: 250,
    terrenoNatal: 'montana',
  },

  /* ───────────────────────────────────────────────────────────────────────
     ALBAR — herederos de una edad anterior
     ─────────────────────────────────────────────────────────────────────── */
  albar: {
    refId: 'albar',
    nombre: 'Albar',
    gentilicio: 'albares',
    genero: 'm',
    lema: 'Vimos caer lo que ahora llamáis ruinas.',
    descripcion:
      'Los últimos de una civilización que gobernó cuando la magia era ley natural y no oficio. ' +
      'Quedan pocos y lo saben. Cargan con una elegancia que resulta anticuada y con la certeza ' +
      'incómoda de que todo esto ya ocurrió antes.',
    aspecto:
      'Esbeltos, de facciones angulosas y piel pálida con un brillo tenue bajo la luna. Los ojos ' +
      'cambian de color con su estado de ánimo, cosa que les avergüenza y no pueden evitar.',
    cultura:
      'Viven en las ciudades vacías de sus antepasados, ocupando una décima parte de lo construido. ' +
      'Su arte es la conservación: reparan, copian y catalogan. No crean casi nada nuevo, y esa es ' +
      'su tragedia y su reproche interno.',
    promptLore:
      'Los albares son los últimos de una civilización antigua y decadente. Habitan ciudades ' +
      'medio vacías. Su magia es más natural que aprendida. Se les respeta y se les teme a partes ' +
      'iguales; muchos los consideran arrogantes. Recuerdan hechos de hace siglos como si fueran recientes.',
    atributos: { intelecto: 2, carisma: 1 },
    rasgos: [
      {
        nombre: 'Sangre arcana',
        descripcion: 'Tu maná máximo aumenta en 5 y regeneras el doble al descansar.',
        efecto: { tipo: 'manaExtra', valor: 5, regeneracion: 2 },
      },
      {
        nombre: 'Ojos de luna',
        descripcion: 'Ves con normalidad en la oscuridad natural.',
        efecto: { tipo: 'visionOscuridad' },
      },
      {
        nombre: 'Memoria heredada',
        descripcion: 'Ventaja al identificar ruinas, símbolos y objetos de la edad anterior.',
        efecto: { tipo: 'ventaja', prueba: 'saber', condicion: 'edadAnterior' },
      },
    ],
    habilidadesGratis: ['saber_arcano', 'historia'],
    ganchos: [
      'Recuerdas un lugar que ya no existe y sabes cómo llegar a él.',
      'Un pariente tuyo vendió una reliquia que ahora está en malas manos.',
      'Sueñas con la caída, cada noche, con detalles que nunca te contaron.',
    ],
    nombresEjemplo: ['Aeryn', 'Solvaen', 'Nyra', 'Ithel', 'Calaste', 'Veren', 'Lumia', 'Ashiel'],
    esperanzaVida: 600,
    terrenoNatal: 'ruinas',
  },

  /* ───────────────────────────────────────────────────────────────────────
     GRISCUERNO — pueblo de las estepas altas
     ─────────────────────────────────────────────────────────────────────── */
  griscuerno: {
    refId: 'griscuerno',
    nombre: 'Griscuerno',
    gentilicio: 'griscuernos',
    genero: 'm',
    lema: 'La manada come antes que el cazador.',
    descripcion:
      'De las estepas del norte, donde el viento no para nunca. Corpulentos, con cuernos que ' +
      'crecen toda la vida y que tallan con la crónica de su clan. Los reinos los contratan como ' +
      'guardias y luego se sorprenden de que tengan opiniones.',
    aspecto:
      'Muy altos, de piel gris azulada y cuernos curvos que van del pardo al blanco según la edad. ' +
      'Voz grave que resuena. Tienen dificultad para pasar por puertas de ciudad.',
    cultura:
      'Organizados en clanes nómadas donde nadie come antes que los niños y los ancianos. La ' +
      'individualidad les resulta sospechosa; el heroísmo solitario, casi una enfermedad. Su mayor ' +
      'insulto es «el que se sirvió primero».',
    promptLore:
      'Los griscuernos vienen de las estepas del norte, son altos, de piel gris y con cuernos ' +
      'tallados con la historia de su clan. Piensan en términos de grupo, no de individuo. ' +
      'En las ciudades se les contrata como músculo y se les subestima. Su palabra colectiva vale más que la propia.',
    atributos: { vigor: 2, moral: 1, temple: 1 },
    rasgos: [
      {
        nombre: 'Envergadura',
        descripcion: 'Tu capacidad de carga aumenta en 15 unidades.',
        efecto: { tipo: 'cargaExtra', valor: 15 },
      },
      {
        nombre: 'Embestida',
        descripcion: 'Al cargar contra un enemigo, tu primer ataque hace +3 de daño.',
        efecto: { tipo: 'danoCarga', valor: 3 },
      },
      {
        nombre: 'Voz de clan',
        descripcion: 'Al proteger a otro, ganas +2 en todas las tiradas del combate.',
        efecto: { tipo: 'bonoProteger', valor: 2 },
      },
    ],
    habilidadesGratis: ['atletismo', 'intimidacion'],
    ganchos: [
      'Tu clan te expulsó y aún no has decidido si fue injusto.',
      'Llevas un cuerno tallado con una crónica que no es la tuya.',
      'Prometiste llevar a alguien de vuelta a casa y sigues sin encontrar el camino.',
    ],
    nombresEjemplo: ['Kordva', 'Ulgrath', 'Semma', 'Torvun', 'Yalka', 'Brendo', 'Nashk', 'Oruna'],
    esperanzaVida: 90,
    terrenoNatal: 'montana',
  },

  /* ───────────────────────────────────────────────────────────────────────
     MENUDO — gente de los caminos y las posadas
     ─────────────────────────────────────────────────────────────────────── */
  menudo: {
    refId: 'menudo',
    nombre: 'Menudo',
    gentilicio: 'menudos',
    genero: 'm',
    lema: 'Nadie vigila a quien no parece una amenaza.',
    descripcion:
      'Pequeños, rápidos y con un talento sobrenatural para estar donde conviene. Regentan ' +
      'posadas, cocinan mejor que nadie y saben más de lo que dicen. Su tamaño los ha hecho ' +
      'invisibles, y han convertido esa invisibilidad en un oficio.',
    aspecto:
      'Apenas llegan al pecho de un valdés. Manos pequeñas y ágiles, ojos vivos. Van bien ' +
      'alimentados y bien vestidos, casi siempre con bolsillos de más.',
    cultura:
      'No tienen territorio: tienen rutas. Cada familia controla un tramo de camino con sus ' +
      'posadas y sus contactos. La información circula por esa red más rápido que cualquier ' +
      'mensajero de la corona, y ellos lo saben perfectamente.',
    promptLore:
      'Los menudos son pequeños, hospitalarios y están en todas partes: posadas, cocinas, mercados. ' +
      'Manejan una red informal de información que cubre los caminos. Se les subestima siempre, y ' +
      'ellos lo fomentan. Saben rumores que nadie más sabe.',
    atributos: { destreza: 2, carisma: 1, astucia: 1 },
    rasgos: [
      {
        nombre: 'Bajo el radar',
        descripcion: 'Ventaja para pasar desapercibido en lugares concurridos.',
        efecto: { tipo: 'ventaja', prueba: 'sigilo', condicion: 'multitud' },
      },
      {
        nombre: 'Red de caminos',
        descripcion: 'En cualquier posada o mercado obtienes un rumor útil sin coste.',
        efecto: { tipo: 'rumorGratis', lugares: ['posada', 'mercado', 'taberna'] },
      },
      {
        nombre: 'Suerte de sobremesa',
        descripcion: 'Una vez por descanso, conviertes una pifia en un fallo normal.',
        efecto: { tipo: 'anularPifia', usos: 1, recarga: 'descansoCorto' },
      },
    ],
    habilidadesGratis: ['juego_manos', 'percepcion'],
    ganchos: [
      'Alguien de tu familia dejó una deuda en una posada de otro tramo.',
      'Guardas un secreto de un cliente y empieza a pesarte.',
      'Te fuiste de la ruta familiar y aún no has explicado por qué.',
    ],
    nombresEjemplo: ['Pipa', 'Berto', 'Nilla', 'Tomás', 'Fenna', 'Croque', 'Mirla', 'Osbe'],
    esperanzaVida: 110,
    terrenoNatal: 'camino',
  },

  /* ───────────────────────────────────────────────────────────────────────
     BRUMAL — nacidos donde el velo es fino
     ─────────────────────────────────────────────────────────────────────── */
  brumal: {
    refId: 'brumal',
    nombre: 'Brumal',
    gentilicio: 'brumales',
    genero: 'm',
    lema: 'No estoy del todo aquí, y eso me conviene.',
    descripcion:
      'Nacidos en los Pantanos del Velo, donde la frontera entre este mundo y lo que hay debajo ' +
      'se adelgaza. Algo de allí se les quedó dentro. Ni ellos saben qué.',
    aspecto:
      'Piel translúcida de tono cerúleo, cabello que se mueve como si hubiera corriente. ' +
      'Su reflejo tarda un instante de más en imitarlos, cosa que la gente nota sin saber qué ha notado.',
    cultura:
      'Comunidades pequeñas y silenciosas construidas sobre pilotes. Su religión no tiene dioses: ' +
      'tiene acuerdos. Consideran la muerte un cambio de estancia, lo que los hace valientes y ' +
      'profundamente inquietantes.',
    promptLore:
      'Los brumales vienen de los pantanos donde el velo entre mundos es fino. Tienen piel ' +
      'translúcida y su reflejo va con retraso. La gente se siente incómoda cerca de ellos sin ' +
      'saber por qué. Perciben cosas que otros no y no temen a la muerte del modo habitual.',
    atributos: { temple: 2, intelecto: 1 },
    rasgos: [
      {
        nombre: 'Medio ausente',
        descripcion: 'Una vez por combate, un ataque que te impacte falla en su lugar.',
        efecto: { tipo: 'evasionFantasma', usos: 1, recarga: 'combate' },
      },
      {
        nombre: 'Percibir el velo',
        descripcion: 'Notas la presencia de lo sobrenatural sin necesidad de tirada.',
        efecto: { tipo: 'deteccion', categoria: 'sobrenatural' },
      },
      {
        nombre: 'Sin miedo a la orilla',
        descripcion: 'Inmune al miedo y a los efectos que reduzcan tu moral por terror.',
        efecto: { tipo: 'inmunidad', estados: ['miedo', 'terror'] },
      },
    ],
    habilidadesGratis: ['saber_oculto', 'perspicacia'],
    ganchos: [
      'Alguien al otro lado del velo conoce tu nombre y lo usa.',
      'Volviste de un sitio del que no se vuelve y no recuerdas cómo.',
      'Tu reflejo hizo algo que tú no hiciste, y hubo testigos.',
    ],
    nombresEjemplo: ['Yssel', 'Moro', 'Kaine', 'Verna', 'Sil', 'Othen', 'Marea', 'Duvel'],
    esperanzaVida: 130,
    terrenoNatal: 'pantano',
  },

  /* ───────────────────────────────────────────────────────────────────────
     CRISOL — hechos, no nacidos
     ─────────────────────────────────────────────────────────────────────── */
  crisol: {
    refId: 'crisol',
    nombre: 'Crisol',
    gentilicio: 'crisoles',
    genero: 'm',
    lema: 'Me hicieron para algo. Estoy decidiendo si obedezco.',
    descripcion:
      'Construidos en la edad anterior como sirvientes, guardianes o herramientas. Sus creadores ' +
      'llevan siglos muertos y ellos siguen funcionando, sin instrucciones y sin permiso para pararse. ' +
      'La pregunta de qué hacer con una existencia sin encargo es su asunto permanente.',
    aspecto:
      'Cuerpo de aleación pálida con vetas de mineral luminoso que se apagan cuando están heridos. ' +
      'Rostro fijo, expresivo solo en la intensidad de la luz. No respiran, pero imitan el gesto ' +
      'para no incomodar.',
    cultura:
      'No tienen cultura propia: tienen la que eligen. Algunos imitan meticulosamente a sus antiguos ' +
      'amos; otros construyen algo nuevo. Se reconocen entre sí por la marca del taller que los hizo, ' +
      'y esa marca no siempre es un motivo de orgullo.',
    promptLore:
      'Los crisoles son autómatas de la edad anterior, aún funcionando siglos después de que ' +
      'murieran sus creadores. No comen ni duermen igual que los demás. Se preguntan constantemente ' +
      'por su propósito. Algunos los ven como objetos y otros como personas, y esa discusión les afecta a diario.',
    atributos: { temple: 2, vigor: 1 },
    rasgos: [
      {
        nombre: 'Sin aliento',
        descripcion: 'No necesitas comer ni beber. Hambre y sed no te afectan.',
        efecto: { tipo: 'inmunidad', recursos: ['hambre', 'sed'] },
      },
      {
        nombre: 'Chasis',
        descripcion: 'Reduces en 2 el daño físico recibido, pero tu maná máximo baja en 5.',
        efecto: { tipo: 'reduccionDano', valor: 2, penalizacionMana: 5 },
      },
      {
        nombre: 'Reparable',
        descripcion: 'Recuperas vida mediante reparación, no descanso. Un herrero te cura mejor que un sanador.',
        efecto: { tipo: 'curacionAlternativa', fuente: 'artesania' },
      },
      {
        nombre: 'Función original',
        descripcion: 'Elige una competencia: la dominas desde tu construcción.',
        efecto: { tipo: 'competenciaExperto', cantidad: 1 },
      },
    ],
    habilidadesGratis: ['saber_arcano'],
    ganchos: [
      'La marca de tu taller aparece en una ruina que no has visitado nunca.',
      'Recibes órdenes de alguien que ya no existe y a veces te sorprendes obedeciendo.',
      'Otro crisol te reconoció y te llamó por un nombre que no usas.',
    ],
    nombresEjemplo: ['Undécimo', 'Vara', 'Sexto-de-Torre', 'Ceniza', 'Guardián', 'Nueve', 'Yunque', 'Eco'],
    esperanzaVida: 0,   // 0 = indefinida
    terrenoNatal: 'ruinas',
  },
});

/* ═══════════════════════════════════════════════════════════════════════════
   CONSULTAS
   ═══════════════════════════════════════════════════════════════════════════ */

/** @type {string[]} Orden de presentación en la creación. */
export const ORDEN_RAZAS = Object.freeze([
  'valdes', 'menudo', 'ferrano', 'sombracorteza',
  'albar', 'griscuerno', 'brumal', 'crisol',
]);

/**
 * Obtiene un linaje por su identificador.
 * @param {string} refId
 * @returns {Linaje|null}
 */
export function obtenerRaza(refId) {
  return RAZAS[refId] ?? null;
}

/**
 * Lista de linajes en orden de presentación.
 * @returns {Linaje[]}
 */
export function listarRazas() {
  return ORDEN_RAZAS.map((r) => RAZAS[r]).filter(Boolean);
}

/**
 * Resumen de los modificadores de un linaje, para mostrarlo como etiquetas.
 * @param {string} refId
 * @returns {string[]} ['Vigor +2', 'Temple +1']
 */
/**
 * Rasgos de un linaje.
 *
 * @param {string} refId
 * @returns {Array<Object>}
 */
export function rasgosDe(refId) {
  return obtenerRaza(refId)?.rasgos ?? [];
}

/**
 * Modificadores de atributo de un linaje.
 *
 * @param {string} refId
 * @returns {Record<string, number>}
 */
export function atributosDe(refId) {
  return obtenerRaza(refId)?.atributos ?? {};
}

/**
 * Contexto del linaje para el director.
 *
 * @param {string} refId
 * @returns {string}
 */
export function loreParaDirector(refId) {
  const raza = obtenerRaza(refId);
  if (!raza) return '';

  const partes = [raza.promptLore];
  if (raza.cultura) partes.push(raza.cultura);

  return partes.filter(Boolean).join(' ');
}

/**
 * Competencias que un linaje otorga de partida.
 *
 * @param {string} refId
 * @returns {string[]}
 */
export function habilidadesGratisDe(refId) {
  return obtenerRaza(refId)?.habilidadesGratis ?? [];
}

/**
 * Subrazas de un linaje.
 *
 * Ningún linaje del catálogo base tiene subrazas; la función existe porque la
 * entrevista de creación las contempla y un pack de contenido podría añadirlas.
 *
 * @param {string} refId
 * @returns {Array<{clave: string, nombre: string, descripcion: string}>}
 */
export function subrazasDe(refId) {
  return obtenerRaza(refId)?.subrazas ?? [];
}

/**
 * Nombre de ejemplo del linaje, elegido al azar.
 *
 * @param {string} refId
 * @param {Object} [rng] Gestor o flujo con elegir().
 * @returns {string}
 */
export function nombreSugerido(refId, rng) {
  const nombres = obtenerRaza(refId)?.nombresEjemplo ?? [];
  if (!nombres.length) return '';

  const flujo = rng?.elegir ? rng : rng?.flujo?.('creacion') ?? rng?.dados;

  return flujo?.elegir
    ? flujo.elegir(nombres)
    : nombres[Math.floor(Math.random() * nombres.length)];
}

/**
 * Léxico para deducir el linaje de lo que escribe el jugador.
 *
 * Se construye a partir de los propios datos: nombre, gentilicio, terreno natal
 * y las palabras del aspecto. Así añadir un linaje no obliga a mantener una
 * lista de sinónimos aparte.
 */
export const LEXICO_RAZAS = (() => {
  const mapa = new Map();

  const anadir = (palabra, refId, peso) => {
    const limpia = String(palabra).toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    if (limpia.length < 4) return;

    if (!mapa.has(limpia)) mapa.set(limpia, []);

    // No se repite la misma raza para la misma palabra.
    if (!mapa.get(limpia).some((e) => e.refId === refId)) {
      mapa.get(limpia).push({ refId, peso });
    }
  };

  for (const raza of Object.values(RAZAS)) {
    // El nombre y el gentilicio son las señales más fuertes.
    anadir(raza.nombre, raza.refId, 10);
    anadir(raza.refId, raza.refId, 10);
    anadir(raza.gentilicio, raza.refId, 9);

    // El singular del gentilicio: «valdeses» → «valdes».
    if (raza.gentilicio?.endsWith('es')) anadir(raza.gentilicio.slice(0, -2), raza.refId, 8);
    if (raza.gentilicio?.endsWith('s')) anadir(raza.gentilicio.slice(0, -1), raza.refId, 8);

    // El terreno de origen orienta, pero pesa poco: varios lo comparten.
    if (raza.terrenoNatal) anadir(raza.terrenoNatal, raza.refId, 2);

    // Palabras del aspecto: pistas débiles pero útiles.
    for (const palabra of String(raza.aspecto ?? '').split(/\W+/)) {
      if (palabra.length >= 6) anadir(palabra, raza.refId, 1);
    }
  }

  return mapa;
})();

export function etiquetasRaza(refId) {
  const raza = RAZAS[refId];
  if (!raza) return [];
  const nombres = {
    vigor: 'Vigor', destreza: 'Destreza', temple: 'Temple',
    intelecto: 'Intelecto', astucia: 'Astucia', carisma: 'Carisma',
    moral: 'Moral',
  };
  return Object.entries(raza.atributos).map(
    ([clave, valor]) => `${nombres[clave] ?? clave} ${valor > 0 ? '+' : ''}${valor}`,
  );
}

export default RAZAS;
