/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANVEIL · data/rasgos.data.js
 * ---------------------------------------------------------------------------
 * Lo que hay en cada lugar y cómo se ve.
 *
 * `locations.data.js` dice qué es un sitio en una frase; esto dice qué se
 * puede mirar en él. Sin esto, «miro el río» en el Vado del Yunque recibía
 * «Ves lo principal; los detalles, no tanto» y un farol cualquiera: el río
 * existía en la descripción del lugar y el narrador no sabía que estaba ahí.
 *
 * Cada rasgo:
 *   · clave     — identificador estable.
 *   · palabras  — cómo lo nombra el jugador (expresión regular, en llano:
 *                 sin tildes y en minúsculas).
 *   · ve        — lo que se ve a simple vista, sin tirada. Concreto.
 *   · detalle   — lo que encuentra quien mira con atención (tirada buena).
 *   · sublugar  — si está dentro de un sublugar concreto.
 *
 * No son frases para barajar: cada rasgo sale cuando el jugador lo nombra o
 * lo tiene delante, y el mismo río se describe igual las dos veces, como en
 * el mundo real. Todo original.
 * ═══════════════════════════════════════════════════════════════════════════
 */

const congelar = (o) => Object.freeze(o);

/** @type {Readonly<Record<string, Array<{clave: string, palabras: string, ve: string, detalle: string, sublugar?: string}>>>} */
export const RASGOS = congelar({
  vado_yunque: [
    { clave: 'rio', palabras: 'rio|agua|orilla|corriente|vado|ribera',
      ve: 'El río baja ancho y pardo, con la corriente pegada a la orilla de enfrente. Donde el lecho se abre hay piedras planas: por ahí se cruzaba antes de que hubiera puente, y aún cruza quien no quiere pagar.',
      detalle: 'En el barro de la orilla hay huellas frescas de botas que llegan hasta el agua y no salen por ningún otro sitio: alguien ha cruzado a pie esta misma mañana, lejos de la vista del peaje.' },
    { clave: 'puente', palabras: 'puente|pretil|arco|arcos|piedra del puente',
      ve: 'Tres arcos de piedra gris, gastada en el centro por los carros. El pretil llega a la cintura y tiene marcas de cuerdas de amarrar.',
      detalle: 'Bajo el arco del centro, fuera de la vista desde el camino, alguien ha encajado una caja de madera entre las piedras. Está atada con cuerda nueva.' },
    { clave: 'peaje', palabras: 'peaje|garita|aduana|cobrador|portazgo',
      ve: 'Una garita de madera a la entrada del puente, con una tabla de precios pintada a mano: un cobre a pie, tres con bestia, cinco con carro.',
      detalle: 'Los precios de la tabla están repintados encima de otros más bajos. La pintura nueva aún no ha perdido el brillo.' },
    { clave: 'mercado', palabras: 'mercado|plaza|puesto|puestos|tenderete|feria|balanza|harina', sublugar: 'mercado_vado',
      ve: 'La plaza del mercado: toldos de lona, cajas de fruta, un puesto de harina con balanza de platos y gente que regatea a voces.',
      detalle: 'Entre los puestos se mueve un chaval sin comprar nada. Mira las bolsas, no la mercancía.' },
    { clave: 'fragua', palabras: 'fragua|forja|yunque|herreria|taller', sublugar: 'fragua_vado',
      ve: 'La fragua del vado da a la calle: fuelle de cuero, yunque, un barril de agua para templar y herraduras colgadas por tamaños.',
      detalle: 'Casi no hay barras de hierro en el montón. Lo que se forja hoy sale de piezas viejas fundidas: bisagras, clavos, una reja partida.' },
    { clave: 'posada', palabras: 'posada|tres clavos|taberna|mesonero|posadero|posadera', sublugar: 'posada_tres_clavos',
      ve: 'La posada de los Tres Clavos: una casa de dos plantas con tres clavos enormes sobre la puerta y el olor a potaje saliendo a la calle.',
      detalle: 'En el poste de la entrada hay avisos clavados: un carretero busca mozo, alguien vende una mula y otro pregunta por un hombre de capa verde.' },
    { clave: 'pozo', palabras: 'pozo|brocal|cubo|polea',
      ve: 'Un pozo de piedra en la esquina de la plaza, con brocal alto, polea de madera y un cubo de hierro atado a la cuerda.',
      detalle: 'La cuerda está deshilachada a media altura. Aguanta un cubo lleno; a una persona, quizá no.' },
    { clave: 'calle', palabras: 'calle|calles|pueblo|casas|alrededor|tejado|tejados|alero',
      ve: 'Calles de tierra apisonada entre casas de piedra y adobe, tejados bajos de pizarra y el camino principal que baja recto hasta el puente.',
      detalle: 'Casi todas las puertas que dan al camino tienen una muesca a la altura del pecho: marcas del peaje, una por cada año que el vecino ha pagado.' },
  ],

  camino_norte: [
    { clave: 'camino', palabras: 'camino|tierra|huellas|roderas|alrededor',
      ve: 'Tierra batida con roderas hondas y trigo a los dos lados, alto hasta la cintura. Se ve venir a la gente desde muy lejos.',
      detalle: 'Hay roderas de una carreta pesada que se salen del camino y se meten en el trigo, hacia el oeste.' },
    { clave: 'mojon', palabras: 'mojon|mojones|piedra|marca|distancia',
      ve: 'Un mojón de piedra con distancias grabadas: el Vado a una parte, el Paso a otra, y un tercer nombre borrado a golpes.',
      detalle: 'El nombre borrado se lee al tacto, no a la vista: empieza por «Ar» y la piedra alrededor está limpia, como si alguien lo tocara a menudo.' },
    { clave: 'trigo', palabras: 'trigo|campo|campos|espigas',
      ve: 'Campos de trigo sin segar que suben y bajan con el viento. En los lindes hay espantapájaros con ropa de soldado vieja.',
      detalle: 'Uno de los espantapájaros lleva botas buenas, demasiado buenas para estar ahí.' },
  ],

  saucedo: [
    { clave: 'sauce', palabras: 'sauce|arbol|plaza|alrededor',
      ve: 'Un sauce enorme ocupa media plaza. Bajo sus ramas hay bancos de piedra y dos viejos que no dejan de mirar a quien llega.',
      detalle: 'En la corteza hay nombres tallados, uno encima de otro, generaciones de ellos. Algunos están tachados con una sola raya.' },
    { clave: 'casas', palabras: 'casa|casas|adobe|calle|pueblo|aldea',
      ve: 'Veinte casas de adobe blanqueado con las puertas abiertas. Todo el mundo se entera de todo desde la puerta de su casa.',
      detalle: 'Una sola casa tiene la puerta cerrada y los postigos atrancados por dentro.' },
    { clave: 'vado_viejo', palabras: 'vado viejo|casa del vado', sublugar: 'casa_vado_viejo',
      ve: 'La casa del vado viejo, junto a un cauce seco donde antes pasaba el río. Tiene una barca varada en el patio.',
      detalle: 'La barca tiene los remos nuevos. Alguien la usa, aunque el río ya no pase por aquí.' },
  ],

  tumbas_bajas: [
    { clave: 'puerta', palabras: 'puerta|entrada|montículo|monticulo|boca',
      ve: 'Un montículo cubierto de hierba y una puerta de piedra entreabierta, con el marco negro de humo de antorchas viejas.',
      detalle: 'La losa de la puerta tiene arañazos por dentro, no por fuera.' },
    { clave: 'nichos', palabras: 'nicho|nichos|galeria|tumba|tumbas|huesos',
      ve: 'Nichos excavados en la roca, uno sobre otro. Los de arriba están vacíos y revueltos; los de abajo siguen tapiados.',
      detalle: 'Uno de los nichos de abajo tiene la argamasa fresca. Lo han tapiado hace poco.' },
    { clave: 'aire', palabras: 'aire|olor|oscuridad|alrededor',
      ve: 'Huele a moho y a tierra cerrada. La luz de fuera llega apenas tres pasos.',
      detalle: 'Hay una corriente muy débil que sube desde abajo. Más adentro hay otra salida.' },
  ],

  linde_cenizo: [
    { clave: 'arboles', palabras: 'arbol|arboles|corteza|bosque|linde|alrededor',
      ve: 'La primera línea de árboles de corteza gris, rectos como lanzas. Al cruzarla, la luz se vuelve verde y fría.',
      detalle: 'Algunos troncos tienen muescas a la altura de los ojos: marcas sombracorteza que indican por dónde se puede pasar.' },
    { clave: 'vigias', palabras: 'vigia|vigias|sombracorteza|guardia|centinela',
      ve: 'No se ve a nadie, pero el silencio de los pájaros dice que alguien vigila.',
      detalle: 'Entre las ramas altas hay una plataforma de cuerdas y tablas, bien disimulada. Desde ahí se domina todo el campo abierto.' },
  ],

  arboleda_madre: [
    { clave: 'arbol_madre', palabras: 'arbol|madre|tronco|raices|raiz|alrededor',
      ve: 'Un árbol de veinte metros de diámetro y, entre sus raíces, casas con puertas redondas y escaleras talladas en la madera viva.',
      detalle: 'La corteza del árbol tiene una grieta vertical, reciente, que alguien ha rellenado con resina.' },
    { clave: 'circulo', palabras: 'circulo|consejo|troncos|reunion', sublugar: 'circulo_troncos',
      ve: 'El círculo de los troncos: nueve tocones pulidos alrededor de un claro de musgo. Aquí decide el Círculo de la Arboleda.',
      detalle: 'Uno de los nueve tocones está cubierto con un paño. Falta alguien en el Círculo, y no lo han sustituido.' },
  ],

  claro_quemado: [
    { clave: 'claro', palabras: 'claro|ceniza|tierra|circulo|alrededor',
      ve: 'Un círculo perfecto de tierra gris donde no crece nada. El borde es tan limpio como si lo hubieran trazado con cuerda.',
      detalle: 'La ceniza del suelo es fina y pesa demasiado. Al removerla aparece debajo una capa vidriada, como arena fundida.' },
  ],

  senda_raices: [
    { clave: 'tunel', palabras: 'tunel|raices|raiz|paredes|alrededor',
      ve: 'Un túnel de raíces entrelazadas que baja en espiral. Las raíces sudan una savia oscura.',
      detalle: 'Algunas raíces están cortadas limpiamente y vueltas a atar con cuerda sombracorteza. Alguien ha abierto paso y lo ha disimulado.' },
    { clave: 'camara', palabras: 'camara|sello|puerta|fondo', sublugar: 'camara_raiz',
      ve: 'Al fondo, una cámara donde la raíz madre se enrosca alrededor de una losa sellada con cera y marcas grabadas.',
      detalle: 'La cera del sello tiene huellas de dedos. Alguien la calentó para despegarla y la volvió a colocar.' },
  ],

  paso_yunque: [
    { clave: 'paso', palabras: 'paso|corredor|roca|paredes|viento|alrededor',
      ve: 'Un corredor entre paredes de roca por donde el viento sopla sin parar. El camino está marcado con montones de piedras.',
      detalle: 'En la pared hay clavijas de hierro que suben hasta una repisa y se interrumpen. Alguien las arrancó a partir de cierta altura.' },
    { clave: 'refugio', palabras: 'refugio|cabana|techo',
      ve: 'Un refugio de piedra seca con techo de lajas, a media jornada del anterior. Dentro hay leña apilada y una marmita.',
      detalle: 'La leña está recién cortada y la ceniza aún templada: alguien durmió aquí anoche.' },
  ],

  forja_alta: [
    { clave: 'chimeneas', palabras: 'pueblo|chimenea|chimeneas|ladera|humo|alrededor',
      ve: 'Casas excavadas en la ladera, una encima de otra, y cien chimeneas soltando humo gris al mismo tiempo.',
      detalle: 'Una de cada tres chimeneas no humea. Las forjas pequeñas han cerrado.' },
    { clave: 'gran_fragua', palabras: 'fragua|forja|yunque|gran fragua', sublugar: 'gran_fragua',
      ve: 'La Gran Fragua: una nave de piedra con doce yunques y un horno que no se apaga nunca.',
      detalle: 'Cada pieza terminada lleva dos marcas: la del clan y, debajo, un hueco vacío donde el gremio quiere poner la suya.' },
    { clave: 'gremio', palabras: 'gremio|sello|casa del gremio', sublugar: 'casa_gremio',
      ve: 'La casa del gremio, con un yunque dorado sobre la puerta y dos guardias que no son del clan.',
      detalle: 'En la mesa de la entrada hay un registro abierto con nombres de herreros tachados en rojo.' },
  ],

  galerias_hondas: [
    { clave: 'galerias', palabras: 'galeria|galerias|tunel|tuneles|mina|alrededor',
      ve: 'Galerías apuntaladas con vigas renegridas. En los niveles altos se oye picar; más abajo, nada.',
      detalle: 'Los tapiados de los niveles bajos están hechos de dentro hacia fuera: la argamasa sobresale por este lado.' },
  ],

  mina_abandonada: [
    { clave: 'boca', palabras: 'boca|mina|tapia|piedras|alrededor',
      ve: 'Una boca de mina tapiada con piedras sin labrar y argamasa echada con prisa. Alrededor, herramientas oxidadas.',
      detalle: 'Entre las piedras del tapiado corre un aire frío. Por algún sitio sigue abierta.' },
  ],

  pilotes_brumal: [
    { clave: 'pasarelas', palabras: 'pasarela|pasarelas|pilotes|agua|madera|alrededor',
      ve: 'Casas sobre pilotes de madera negra, unidas por pasarelas que crujen a cada paso. El agua de debajo no deja ver el fondo.',
      detalle: 'Algunas tablas de las pasarelas están sueltas a propósito: quien vive aquí sabe cuáles pisar.' },
    { clave: 'templo', palabras: 'templo|velo|guardianes', sublugar: 'templo_velo',
      ve: 'El templo del velo: una casa alta con las ventanas cubiertas de tela gris y una campana sin badajo.',
      detalle: 'La tela de las ventanas tiene bordados por dentro que desde fuera no se ven: ojos cerrados, cientos de ellos.' },
  ],

  espejo_negro: [
    { clave: 'laguna', palabras: 'laguna|agua|espejo|reflejo|orilla|alrededor',
      ve: 'Una laguna de agua inmóvil, negra y lisa. Refleja el cielo, los árboles y algo más que no está en la orilla.',
      detalle: 'Tu reflejo tarda un instante en moverse cuando te mueves.' },
  ],

  puerto_lodo: [
    { clave: 'muelles', palabras: 'muelle|muelles|barca|barcas|puerto|agua|alrededor', sublugar: 'muelles',
      ve: 'Muelles de madera podrida, barcas de fondo plano y fardos sin marca que nadie vigila y nadie toca.',
      detalle: 'Los fardos sin marca tienen un nudo distinto al de los demás. Es una señal: esos no se tocan.' },
    { clave: 'taberna', palabras: 'taberna|sin nombre|posada', sublugar: 'taberna_sin_nombre',
      ve: 'La taberna sin nombre: una puerta baja, un farol rojo y conversaciones que se callan cuando entra alguien.',
      detalle: 'El tabernero sirve con la mano izquierda y tiene la derecha siempre bajo el mostrador.' },
  ],

  umbral_albar: [
    { clave: 'arco', palabras: 'arco|umbral|piedra|alrededor', sublugar: 'gran_arco',
      ve: 'Un arco de treinta metros de piedra blanca que se sostiene solo, sin muros ni bóveda. A través de él se ve el mismo paisaje que alrededor.',
      detalle: 'La piedra del arco no tiene juntas. Es de una sola pieza, y está tibia.' },
    { clave: 'campamento', palabras: 'campamento|custodios|tiendas|archivo', sublugar: 'campamento_custodios',
      ve: 'El campamento de los custodios: tiendas de lona, mesas de catalogar y cajas numeradas con fragmentos de piedra.',
      detalle: 'Una de las cajas está lacrada con un sello distinto al de los custodios.' },
  ],

  sala_sellada: [
    { clave: 'corredor', palabras: 'corredor|pasillo|inscripciones|paredes|alrededor', sublugar: 'corredor',
      ve: 'Un corredor que baja en rampa, con inscripciones albares en las paredes que brillan un poco cuando se acerca una luz.',
      detalle: 'Las inscripciones se repiten cada diez pasos, cada vez con una palabra menos.' },
    { clave: 'puerta', palabras: 'puerta|camara|guardian|automata', sublugar: 'camara_puerta',
      ve: 'Al fondo, una puerta de aleación pálida sin cerradura ni bisagras, y delante una figura inmóvil de cuatro metros.',
      detalle: 'La figura tiene polvo en los hombros y ninguno en las manos.' },
  ],

  oasis_sal: [
    { clave: 'agua', palabras: 'agua|oasis|pozo|estanque|palmeras|alrededor',
      ve: 'Palmeras alrededor de un estanque de agua clara, con un guarda sentado junto a cada cántaro comunal.',
      detalle: 'Los guardas del agua no llevan armas. No les hacen falta: todo el mundo sabe lo que pasa si se roba.' },
    { clave: 'bazar', palabras: 'bazar|mercado|puestos|telas', sublugar: 'bazar',
      ve: 'El bazar: telas tendidas de palmera a palmera, especias, sal roja en sacos y lenguas de todo el sur mezcladas.',
      detalle: 'La sal roja se vende sin regatear, en silencio, y siempre la compran los mismos.' },
  ],

  pozos_hondos: [
    { clave: 'pozo', palabras: 'pozo|pozos|sal|galeria|paredes|alrededor',
      ve: 'Un pozo ancho con escalones tallados en espiral que bajan hasta donde no llega la luz. Las paredes brillan de sal roja.',
      detalle: 'Más abajo de lo que se ve desde arriba, los escalones cambian: son más estrechos y más altos, hechos para piernas que no son humanas.' },
  ],
});

/** Lo que tiene cualquier sitio de un terreno, para lugares sin rasgos propios. */
export const RASGOS_TERRENO = congelar({
  camino: [{ clave: 'camino', palabras: 'camino|tierra|alrededor', ve: 'Tierra batida, roderas y cunetas con hierba alta.', detalle: 'Hay huellas recientes que se salen del camino.' }],
  bosque: [{ clave: 'bosque', palabras: 'bosque|arbol|arboles|alrededor', ve: 'Troncos grises, sotobosque espeso y una luz que llega en manchas.', detalle: 'Una rama partida a la altura del hombro: alguien pasó por aquí hace poco.' }],
  montana: [{ clave: 'roca', palabras: 'roca|montana|ladera|alrededor', ve: 'Roca desnuda, pedreras sueltas y el viento de cara.', detalle: 'Un hito de piedras recién colocado marca un desvío que no sale en ningún mapa.' }],
  pantano: [{ clave: 'agua', palabras: 'agua|pantano|barro|alrededor', ve: 'Agua parada, juncos altos y un olor dulce a cosa podrida.', detalle: 'Hay una pértiga clavada en el barro con una cinta atada: una marca de paso seguro.' }],
  desierto: [{ clave: 'dunas', palabras: 'duna|dunas|arena|alrededor', ve: 'Dunas rojas hasta el horizonte y un calor que dobla el aire.', detalle: 'Entre dos dunas asoma el borde de una piedra tallada.' }],
  ruinas: [{ clave: 'ruinas', palabras: 'ruina|ruinas|piedra|alrededor', ve: 'Piedra blanca caída, columnas partidas y silencio.', detalle: 'En una losa hay marcas de herramientas recientes.' }],
  mazmorra: [{ clave: 'oscuridad', palabras: 'oscuridad|pared|paredes|alrededor', ve: 'Piedra húmeda, oscuridad y el eco de tus propios pasos.', detalle: 'Una corriente de aire muy débil llega de algún sitio más adentro.' }],
});

const llano = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Los rasgos de un lugar, con los del terreno como respaldo.
 * @param {string} refIdLugar
 * @param {string} [terreno]
 * @returns {Array<Object>}
 */
export function rasgosDe(refIdLugar, terreno) {
  return RASGOS[refIdLugar] ?? RASGOS_TERRENO[terreno] ?? [];
}

/**
 * El rasgo que nombra el texto, si lo hay en este lugar.
 *
 * Gana el que se nombra primero: «el pozo de la plaza» es el pozo, no la
 * plaza. A igualdad de sitio, la palabra más larga.
 *
 * @param {string} texto
 * @param {string} refIdLugar
 * @param {string} [terreno]
 * @returns {Object|null}
 */
export function buscarRasgo(texto, refIdLugar, terreno) {
  const n = llano(texto);
  let mejor = null;
  let donde = Infinity;
  let largo = 0;
  for (const r of rasgosDe(refIdLugar, terreno)) {
    for (const palabra of r.palabras.split('|')) {
      if (palabra === 'alrededor') continue;
      const i = n.search(new RegExp(`\\b${palabra}\\b`));
      if (i < 0) continue;
      if (i < donde || (i === donde && palabra.length > largo)) { mejor = r; donde = i; largo = palabra.length; }
    }
  }
  return mejor;
}

/**
 * El rasgo que describe el conjunto: el que responde a «alrededor».
 * @param {string} refIdLugar
 * @param {string} [terreno]
 * @returns {Object|null}
 */
export function rasgoGeneral(refIdLugar, terreno) {
  const lista = rasgosDe(refIdLugar, terreno);
  return lista.find((r) => r.palabras.split('|').includes('alrededor')) ?? lista[0] ?? null;
}

export default { RASGOS, RASGOS_TERRENO, rasgosDe, buscarRasgo, rasgoGeneral };
