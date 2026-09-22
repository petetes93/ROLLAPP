/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANVEIL · data/narrative.templates.js
 * ---------------------------------------------------------------------------
 * Gramáticas y plantillas del director procedural.
 *
 * La calidad de la narración sin IA depende por completo de este archivo. La
 * estrategia no es tener muchas frases, sino COMPONER: cada descripción se
 * ensambla a partir de piezas independientes —lo que ves, lo que oyes, lo que
 * huele, un detalle raro— y la combinatoria hace el resto.
 *
 * Diez fragmentos por categoría y cuatro categorías dan diez mil variantes.
 * Ese es el truco de las gramáticas generativas: no acumular texto, sino
 * multiplicar.
 *
 * Marcadores admitidos en las plantillas:
 *   {jugador} {lugar} {npc} {enemigo} {objeto} {franja} {clima} {terreno}
 *
 * Sin dependencias.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/* ═══════════════════════════════════════════════════════════════════════════
   ATMÓSFERA POR TERRENO
   ---------------------------------------------------------------------------
   Cuatro registros sensoriales que se combinan. Se toma uno de cada, o solo
   dos, según cuánto texto haga falta.
   ═══════════════════════════════════════════════════════════════════════════ */

export const ATMOSFERA = Object.freeze({

  bosque: {
    vista: [
      'La luz llega verde y partida entre las copas',
      'Troncos gruesos como torres se pierden hacia arriba',
      'El sotobosque crece denso a la altura de la rodilla',
      'Un claro se abre unos pasos más adelante',
      'Raíces retorcidas levantan el suelo del sendero',
      'Musgo cubre todo lo que lleve quieto más de una estación',
      'Ramas caídas forman barreras que hay que rodear',
      'Helechos altos ocultan lo que haya a ras de tierra',
    ],
    sonido: [
      'Crujen ramas en algún punto que no logras situar',
      'Los pájaros callan de golpe y vuelven a empezar',
      'El viento arrastra un rumor constante entre las hojas',
      'Algo pequeño escapa entre la maleza',
      'Gotea agua de alguna parte, aunque no llueve',
      'El silencio pesa más de lo que debería',
    ],
    olfato: [
      'Huele a tierra húmeda y madera podrida',
      'El aire trae aroma a resina',
      'Hay un olor dulzón que no acabas de identificar',
      'Huele a hoja mojada y a hongo',
    ],
    detalle: [
      'Alguien marcó un tronco con un corte reciente',
      'Hay huellas en el barro, y no son de animal',
      'Una tela desgarrada cuelga de una zarza',
      'Los pájaros evitan una zona concreta',
      'Un árbol está partido por la mitad, y no fue el rayo',
      'Restos de una hoguera apagada hace poco',
    ],
  },

  montana: {
    vista: [
      'La roca desnuda se alza a ambos lados del paso',
      'El sendero se estrecha hasta obligar a ir en fila',
      'Abajo, el valle se ve pequeño y lejano',
      'Nubes bajas cubren y descubren la ladera',
      'Un desprendimiento reciente bloquea parte del camino',
      'La nieve aguanta en las hondonadas donde no da el sol',
    ],
    sonido: [
      'El viento silba entre las grietas',
      'Rueda una piedra ladera abajo y tarda en llegar al fondo',
      'El eco devuelve tus pasos con retraso',
      'Un ave rapaz chilla muy por encima',
      'Aquí arriba el silencio es distinto: más limpio y más grande',
    ],
    olfato: [
      'El aire es frío y no huele a nada',
      'Llega un olor mineral, a piedra mojada',
      'Huele levemente a azufre',
    ],
    detalle: [
      'Un mojón de piedras marca el camino, y alguien lo mantiene',
      'Hay clavijas de hierro oxidadas en la pared',
      'Una inscripción gastada, ilegible ya',
      'Restos de un campamento en un saliente protegido',
      'Huesos limpios amontonados en una hendidura',
    ],
  },

  ruinas: {
    vista: [
      'Columnas partidas sostienen un techo que ya no existe',
      'Las piedras encajan con una precisión que hoy nadie logra',
      'La vegetación ha entrado por donde antes había puertas',
      'Un mosaico asoma bajo la tierra acumulada',
      'Escaleras que suben hacia ninguna parte',
      'La geometría del sitio no acaba de tener sentido',
    ],
    sonido: [
      'Tus pasos suenan demasiado fuerte aquí',
      'Un goteo marca el tiempo en algún punto interior',
      'El viento entra por los huecos y produce una nota grave',
      'No hay insectos. Ni un solo sonido vivo',
    ],
    olfato: [
      'Huele a polvo de siglos y a piedra fría',
      'Un olor rancio sube de las partes bajas',
      'El aire está muerto y quieto',
    ],
    detalle: [
      'Alguien ha estado aquí hace poco: la tierra está removida',
      'Las inscripciones siguen legibles y no reconoces el alfabeto',
      'Hay marcas de garras en un umbral de piedra',
      'Una puerta cerrada que aguanta mejor que todo lo demás',
      'Algo brilla al fondo, medio enterrado',
      'Las sombras aquí no caen del todo donde deberían',
    ],
  },

  mazmorra: {
    vista: [
      'El pasillo se hunde en una oscuridad que tu luz no alcanza',
      'Las paredes rezuman humedad',
      'El techo baja hasta obligarte a agachar la cabeza',
      'Una bifurcación se abre por delante',
      'Los sillares están tallados a mano, uno por uno',
      'Hay marcas de arrastre en el suelo, hacia el interior',
    ],
    sonido: [
      'Algo se mueve al fondo y se detiene cuando te detienes',
      'Tu respiración suena enorme en este espacio cerrado',
      'Un chirrido metálico, lejano',
      'Agua cayendo en algún lugar por debajo de ti',
      'El silencio de aquí abajo tiene textura',
    ],
    olfato: [
      'Huele a moho y a encierro',
      'Un tufo dulzón de carne pasada llega a rachas',
      'Huele a hierro viejo',
    ],
    detalle: [
      'Marcas de uñas en la pared, a la altura del pecho',
      'Una antorcha consumida, aún tibia',
      'El suelo está limpio de polvo justo en un tramo',
      'Un mecanismo asoma entre dos sillares',
      'Alguien escribió algo en la pared, con prisa',
      'Hay una losa que suena distinto al pisarla',
    ],
  },

  ciudad: {
    vista: [
      'La calle se estrecha entre fachadas que se inclinan hacia dentro',
      'Ropa tendida cruza de un balcón a otro',
      'Un mercado ocupa la plaza más adelante',
      'Faroles apagados esperan al farolero',
      'Los adoquines están gastados en el centro por el paso',
      'Un callejón se abre a la izquierda, sin salida aparente',
    ],
    sonido: [
      'Voces, muchas, en varios idiomas a la vez',
      'Alguien discute a gritos dos calles más allá',
      'Ruedas de carro sobre piedra',
      'Un martillo golpea metal con ritmo constante',
      'Una campana marca la hora con retraso',
    ],
    olfato: [
      'Huele a pan recién hecho y a aguas menores',
      'Humo de cocina y de fragua se mezclan',
      'El olor del río llega cuando cambia el viento',
    ],
    detalle: [
      'Un mendigo te mira más de la cuenta',
      'Hay un cartel clavado con un rostro que no reconoces',
      'Dos guardias pasan y no te quitan ojo',
      'Alguien te sigue desde hace una calle',
      'Un niño corre y desaparece en un portal',
      'Una puerta se cierra justo cuando pasas',
    ],
  },

  camino: {
    vista: [
      'El camino se pierde en una curva más adelante',
      'Campos abiertos a ambos lados hasta donde alcanza la vista',
      'Un puente de piedra cruza un arroyo estrecho',
      'Los surcos de carro marcan la tierra',
      'Un árbol solitario marca un cruce',
      'A lo lejos se distingue humo de chimenea',
    ],
    sonido: [
      'El camino está en silencio salvo por tus pasos',
      'Grillos, muchos, en la hierba',
      'Ladra un perro en alguna granja',
      'El viento mueve el trigo con un sonido de agua',
    ],
    olfato: [
      'Huele a polvo y a hierba seca',
      'Llega olor a establo con el viento',
      'El aire está limpio',
    ],
    detalle: [
      'Un mojón indica distancias a lugares que no conoces',
      'Hay restos de una fogata junto al camino',
      'Una carreta abandonada con la rueda partida',
      'Alguien viene de frente, todavía lejos',
      'Un altar pequeño con ofrendas recientes',
    ],
  },

  pantano: {
    vista: [
      'El agua parda cubre el terreno hasta la rodilla',
      'Árboles muertos se levantan como dedos',
      'La niebla se posa a media altura y no se levanta',
      'Un sendero de tablones podridos cruza la ciénaga',
      'Burbujas suben desde el fondo y revientan sin ruido',
    ],
    sonido: [
      'Croan ranas en todas direcciones y ninguna',
      'Algo grande se mueve bajo el agua',
      'Chapoteos que no coinciden con tus pasos',
      'El silencio aquí es húmedo y sofocante',
    ],
    olfato: [
      'Huele a agua estancada y a putrefacción',
      'Un olor a metano hace que respires por la boca',
      'Hay un aroma dulce y equivocado bajo todo lo demás',
    ],
    detalle: [
      'Restos de una barca hundida asoman entre juncos',
      'Alguien colgó amuletos de las ramas',
      'El agua está más quieta de lo normal en un punto',
      'Huellas que entran en el agua y no salen',
      'Tu reflejo tarda en imitarte',
    ],
  },

  desierto: {
    vista: [
      'Las dunas se repiten hasta el horizonte',
      'El aire tiembla sobre la arena caliente',
      'Roca desnuda asoma donde el viento ha barrido la arena',
      'Un oasis se distingue a lo lejos, o eso parece',
      'Restos de una caravana medio enterrados',
    ],
    sonido: [
      'El viento arrastra arena con un siseo continuo',
      'El silencio aquí es absoluto y pesa',
      'La arena canta al deslizarse por una ladera',
    ],
    olfato: [
      'El aire está seco y no huele a nada',
      'Huele a piedra recalentada',
    ],
    detalle: [
      'Huesos blanqueados asoman de la arena',
      'Hay una piedra tallada que el viento no ha borrado del todo',
      'Un buitre traza círculos sin prisa',
      'Las huellas que dejaste hace un momento ya se están borrando',
    ],
  },

  oceano: {
    vista: [
      'El agua se extiende gris en todas direcciones',
      'La costa se recorta abrupta contra el cielo',
      'Las olas rompen contra las rocas con paciencia',
      'Un barco se distingue en la línea del horizonte',
    ],
    sonido: [
      'El mar suena constante, sin variación',
      'Gaviotas chillan por encima',
      'La madera cruje al ritmo del oleaje',
    ],
    olfato: [
      'Huele a sal y a algas',
      'El aire está cargado de humedad',
    ],
    detalle: [
      'Restos de un naufragio en la orilla',
      'Algo grande se mueve bajo la superficie',
      'La marea ha dejado al descubierto una entrada',
    ],
  },
});

/* ═══════════════════════════════════════════════════════════════════════════
   MODIFICADORES DE FRANJA Y CLIMA
   ═══════════════════════════════════════════════════════════════════════════ */

/** Frases que sitúan la hora del día. */
export const FRANJA = Object.freeze({
  madrugada: [
    'Es plena madrugada y no se ve gran cosa',
    'La noche está en su punto más cerrado',
    'Falta mucho para que amanezca',
  ],
  alba: [
    'El cielo empieza a clarear por el este',
    'La primera luz llega gris y sin fuerza',
    'Amanece',
  ],
  manana: [
    'La mañana está entrada y la luz es limpia',
    'El sol ya calienta',
    'Es media mañana',
  ],
  mediodia: [
    'El sol está en lo alto y las sombras son cortas',
    'Es mediodía',
    'La luz cae vertical',
  ],
  tarde: [
    'La tarde avanza y las sombras se alargan',
    'La luz empieza a dorarse',
    'Queda tarde, pero no mucha',
  ],
  ocaso: [
    'El sol se pone y todo se tiñe de rojo',
    'Cae la tarde',
    'La luz se va deprisa',
  ],
  noche: [
    'Ha caído la noche',
    'Solo hay la luz que lleves encima',
    'La oscuridad es cerrada',
  ],
});

/** Frases de clima. */
export const CLIMA = Object.freeze({
  despejado: ['El cielo está limpio', 'No hay una nube'],
  nublado: ['El cielo está cubierto', 'Las nubes van bajas y grises'],
  lluvia: ['Llueve sin parar', 'La lluvia cala y no afloja', 'El agua corre por todas partes'],
  tormenta: ['La tormenta descarga con fuerza', 'Truena cerca', 'El viento y el agua vienen de lado'],
  niebla: ['La niebla lo cubre todo', 'No ves más allá de unos pasos', 'La niebla se pega a la ropa'],
  nieve: ['Cae nieve en silencio', 'La nieve cubre el suelo y borra el camino'],
  ventisca: ['La ventisca hace imposible mirar de frente', 'El viento y la nieve muerden'],
  calorSofocante: ['El calor es asfixiante', 'El aire quema al respirar'],
});

/* ═══════════════════════════════════════════════════════════════════════════
   RESULTADOS DE ACCIÓN
   ---------------------------------------------------------------------------
   Se seleccionan según el grado de éxito que devolvió la tirada. El motor ya
   ha decidido: estas frases solo narran.
   ═══════════════════════════════════════════════════════════════════════════ */

export const RESULTADOS = Object.freeze({

  exitoRotundo: {
    generico: [
      'Sale mejor de lo que esperabas',
      'Todo encaja a la primera',
      'Lo consigues sin esfuerzo aparente',
      'No podría haber salido mejor',
    ],
    fisico: [
      'Tu cuerpo responde antes de que lo pienses',
      'El movimiento sale limpio y sin dudas',
    ],
    social: [
      'Encuentras exactamente las palabras que hacían falta',
      'La otra parte cambia de actitud casi sin darse cuenta',
    ],
    sigilo: [
      'Nadie percibe absolutamente nada',
      'Te mueves como si el sitio fuera tuyo',
    ],
    saber: [
      'La respuesta te llega completa y ordenada',
      'Reconoces no solo qué es, sino de dónde viene',
    ],
  },

  exitoClaro: {
    generico: [
      'Sale bien',
      'Lo consigues sin complicaciones',
      'Funciona',
    ],
    fisico: ['El esfuerzo da resultado', 'Aguantas y lo sacas adelante'],
    social: ['Consigues lo que buscabas', 'Te escuchan y ceden'],
    sigilo: ['Pasas sin ser visto', 'Nadie levanta la vista'],
    saber: ['Lo reconoces con seguridad', 'Sabes lo que estás mirando'],
  },

  exitoJusto: {
    generico: [
      'Sale, pero por poco',
      'Lo consigues, aunque no queda limpio',
      'Funciona, con algún tropiezo por el camino',
      'Te vale, aunque no sea como querías',
    ],
    fisico: ['Lo logras, pero te cuesta más de lo debido', 'Aguantas por los pelos'],
    social: ['Cede, aunque sin convencimiento', 'Consigues algo, no todo'],
    sigilo: ['Pasas, pero alguien mira en tu dirección un segundo de más'],
    saber: ['Te suena, aunque no acabas de situarlo del todo'],
  },

  fracaso: {
    generico: [
      'No sale',
      'No consigues lo que buscabas',
      'Falla',
      'No hay manera',
    ],
    fisico: ['El cuerpo no responde a tiempo', 'Te falta un poco'],
    social: ['No cuela', 'La otra parte no se mueve'],
    sigilo: ['Alguien te ve', 'Un ruido te delata'],
    saber: ['No consigues situarlo', 'Se te escapa'],
  },

  fracasoGrave: {
    generico: [
      'Sale mal, y además llama la atención',
      'No solo falla: empeora la situación',
      'Es peor que no haberlo intentado',
      'Se te va de las manos',
    ],
    fisico: ['Pierdes el equilibrio y acabas en el suelo', 'Algo cede y te llevas un golpe'],
    social: ['Dices exactamente lo que no había que decir', 'La has empeorado'],
    sigilo: ['Tropiezas y todo el mundo se gira', 'Te descubren de la peor forma posible'],
    saber: ['Sacas una conclusión equivocada y actúas en consecuencia'],
  },
});

/* ═══════════════════════════════════════════════════════════════════════════
   COMBATE
   ═══════════════════════════════════════════════════════════════════════════ */

export const COMBATE = Object.freeze({
  inicio: [
    'El acero sale de las vainas',
    'No hay tiempo para hablar',
    'Se acabó la conversación',
    'Todo se decide ahora',
  ],
  golpeJugador: {
    critico: [
      'Encuentras el hueco y aprovechas',
      'El golpe entra donde tenía que entrar',
      'Le alcanzas de lleno',
    ],
    normal: [
      'Tu golpe conecta',
      'Le alcanzas',
      'El impacto le hace retroceder',
    ],
    debil: [
      'Le rozas',
      'El golpe llega, pero sin fuerza',
    ],
    fallo: [
      'Falla por poco',
      'Se aparta a tiempo',
      'Tu golpe corta el aire',
    ],
  },
  golpeEnemigo: {
    critico: [
      'El golpe te alcanza de lleno y te deja sin aire',
      'No lo ves venir',
    ],
    normal: [
      'Encaja un golpe',
      'Te alcanza',
    ],
    fallo: [
      'Consigues apartarte',
      'El golpe pasa de largo',
      'Lo desvías a duras penas',
    ],
  },
  victoria: [
    'El campo queda en silencio',
    'Se acabó',
    'Ya no queda nadie en pie frente a ti',
  ],
  derrota: [
    'Las piernas te fallan',
    'La oscuridad te alcanza',
  ],
  huida: [
    'Consigues romper el cerco',
    'Sales de allí sin mirar atrás',
  ],
  huidaFallida: [
    'No hay por dónde salir',
    'Te cortan el paso',
  ],
});

/* ═══════════════════════════════════════════════════════════════════════════
   PERSONAJES NO JUGADORES
   ═══════════════════════════════════════════════════════════════════════════ */

export const NPC = Object.freeze({
  /** Piezas para generar nombres. */
  nombres: {
    pilaA: ['Bre', 'Cor', 'Dal', 'Fen', 'Gar', 'Hel', 'Ir', 'Kor', 'Mar', 'Nav', 'Ors', 'Ren', 'Sel', 'Tor', 'Ul', 'Ver'],
    pilaB: ['dan', 'wen', 'mir', 'ket', 'sa', 'vek', 'lin', 'dor', 'ta', 'nis', 'gard', 'ela', 'rok', 'vane'],
  },

  /** Oficios habituales, con su contexto. */
  oficios: [
    { nombre: 'posadero', lugar: 'posada', actitud: 'cordial' },
    { nombre: 'herrero', lugar: 'fragua', actitud: 'seca' },
    { nombre: 'mercader', lugar: 'mercado', actitud: 'interesada' },
    { nombre: 'guardia', lugar: 'puerta', actitud: 'desconfiada' },
    { nombre: 'cazador', lugar: 'bosque', actitud: 'reservada' },
    { nombre: 'sanadora', lugar: 'templo', actitud: 'amable' },
    { nombre: 'escriba', lugar: 'archivo', actitud: 'distraída' },
    { nombre: 'contrabandista', lugar: 'callejón', actitud: 'cauta' },
    { nombre: 'granjero', lugar: 'campo', actitud: 'franca' },
    { nombre: 'mendigo', lugar: 'plaza', actitud: 'suplicante' },
    { nombre: 'capitana', lugar: 'muelle', actitud: 'brusca' },
    { nombre: 'cartógrafa', lugar: 'estudio', actitud: 'curiosa' },
  ],

  /** Rasgos físicos memorables. */
  rasgos: [
    'con una cicatriz que le cruza la ceja',
    'que no te mira a los ojos',
    'de manos enormes y gastadas',
    'que habla más despacio de lo normal',
    'con un ojo lechoso',
    'que huele a humo',
    'de risa fácil y ojos que no ríen',
    'con las uñas negras de tierra',
    'que lleva luto',
    'de acento que no sitúas',
    'con un tatuaje mal borrado en el cuello',
    'que tiembla ligeramente',
  ],

  /** Apertura de diálogo por actitud. */
  saludos: {
    cordial: ['«Buenas. ¿Qué necesitas?»', '«Pasa, pasa. ¿En qué te ayudo?»'],
    seca: ['«¿Qué.»', '«Habla, que tengo trabajo.»'],
    interesada: ['«Ah, un cliente. Mira lo que quieras.»', '«¿Compras o vendes?»'],
    desconfiada: ['«Alto ahí. ¿Qué se te ha perdido?»', '«No te he visto antes por aquí.»'],
    reservada: ['Te mira un rato antes de decir nada.', '«…» Espera a que hables tú.'],
    amable: ['«Que la fortuna te acompañe. ¿Estás herido?»'],
    cauta: ['«No hables tan alto.»', '«Aquí no. Ven.»'],
    suplicante: ['«Una moneda, señor. Una sola.»'],
    hostil: ['«Lárgate.»', '«No queremos problemas. Vete.»'],
  },
});

/* ═══════════════════════════════════════════════════════════════════════════
   OPCIONES SUGERIDAS
   ---------------------------------------------------------------------------
   El director procedural las ofrece según el contexto. Son atajos, nunca
   restricciones: el jugador puede escribir cualquier otra cosa.
   ═══════════════════════════════════════════════════════════════════════════ */

export const OPCIONES = Object.freeze({
  exploracion: [
    { label: 'Seguir adelante', intent: 'explore', risk: 'low' },
    { label: 'Mirar con calma', intent: 'observe', risk: 'low' },
    { label: 'Registrar el sitio', intent: 'search', risk: 'medium' },
    { label: 'Avanzar sin hacer ruido', intent: 'hide', risk: 'medium' },
    { label: 'Volver por donde has venido', intent: 'travel', risk: 'low' },
    { label: 'Descansar aquí', intent: 'rest', risk: 'medium' },
  ],
  npcPresente: [
    { label: 'Hablar', intent: 'talk', risk: 'low' },
    { label: 'Observar antes de acercarte', intent: 'observe', risk: 'low' },
    { label: 'Preguntar por el camino', intent: 'talk', risk: 'low' },
    { label: 'Intentar pasar desapercibido', intent: 'hide', risk: 'medium' },
    { label: 'Ofrecer algo a cambio de información', intent: 'negotiate', risk: 'low' },
  ],
  combate: [
    { label: 'Atacar', intent: 'attack', risk: 'high' },
    { label: 'Defenderte y esperar', intent: 'wait', risk: 'medium' },
    { label: 'Usar un objeto', intent: 'use_item', risk: 'low' },
    { label: 'Buscar una salida', intent: 'flee', risk: 'high' },
    { label: 'Intentar hablar', intent: 'negotiate', risk: 'high' },
  ],
  contenedor: [
    { label: 'Abrirlo', intent: 'open', risk: 'medium' },
    { label: 'Examinarlo primero', intent: 'observe', risk: 'low' },
    { label: 'Dejarlo estar', intent: 'explore', risk: 'low' },
  ],
  descubrimiento: [
    { label: 'Acercarte', intent: 'explore', risk: 'medium' },
    { label: 'Estudiarlo desde aquí', intent: 'observe', risk: 'low' },
    { label: 'Rodearlo', intent: 'travel', risk: 'low' },
  ],
});

/* ═══════════════════════════════════════════════════════════════════════════
   TRANSICIONES Y CONECTORES
   ═══════════════════════════════════════════════════════════════════════════ */

export const CONECTORES = Object.freeze({
  tiempo: ['Poco después,', 'Al rato,', 'Sin transición,', 'Un momento más tarde,', 'Entonces,'],
  contraste: ['Aun así,', 'Pese a todo,', 'Sin embargo,', 'Y sin embargo,'],
  consecuencia: ['Por eso,', 'De modo que', 'Así que', 'Lo que significa que'],
  adicion: ['Además,', 'Y hay más:', 'Por si fuera poco,'],
});

/** Cierres que dejan la escena abierta. */
export const CIERRES = Object.freeze([
  'Depende de ti.',
  'La decisión es tuya.',
  '¿Qué haces?',
  'Está en tu mano.',
  'Tú dirás.',
]);

/* ═══════════════════════════════════════════════════════════════════════════
   EVENTOS AMBIENTALES
   ---------------------------------------------------------------------------
   Pequeños sucesos sin consecuencia mecánica. Existen para que el mundo no
   parezca esperar quieto a que el jugador actúe.
   ═══════════════════════════════════════════════════════════════════════════ */

export const AMBIENTE = Object.freeze({
  general: [
    'Una bandada cruza el cielo en formación cerrada.',
    'El viento cambia de dirección.',
    'Algo cruje a tu espalda y no hay nada cuando te giras.',
    'Se te ocurre que llevas más tiempo del que pensabas.',
    'Un olor te recuerda a algo que no logras precisar.',
  ],
  noche: [
    'Una estrella cae y se apaga antes de tocar el horizonte.',
    'Algo aúlla, lejos.',
    'La temperatura baja de golpe.',
  ],
  ciudad: [
    'Dos personas discuten y se callan al pasar tú.',
    'Un carro cargado te obliga a apartarte.',
    'Alguien canta desde una ventana alta.',
  ],
  peligro: [
    'Los animales pequeños han desaparecido.',
    'No se oye un solo pájaro.',
    'Tienes la sensación de que te observan.',
    'El aire se ha quedado quieto.',
  ],
});

/* ═══════════════════════════════════════════════════════════════════════════
   CONSULTAS
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Bloque de atmósfera de un terreno.
 * @param {string} terreno
 * @returns {Object}
 */
export function atmosferaDe(terreno) {
  return ATMOSFERA[terreno] ?? ATMOSFERA.camino;
}

/**
 * Frases de resultado según el grado y la categoría de la prueba.
 *
 * @param {string} grado 'exitoRotundo' | 'exitoClaro' | …
 * @param {string} [categoria='generico']
 * @returns {string[]}
 */
export function resultadosDe(grado, categoria = 'generico') {
  const bloque = RESULTADOS[grado] ?? RESULTADOS.exitoJusto;
  return bloque[categoria] ?? bloque.generico;
}

/**
 * Traduce una habilidad a la categoría narrativa que le corresponde.
 * @param {string} habilidad
 * @returns {string}
 */
export function categoriaDe(habilidad) {
  const mapa = {
    atletismo: 'fisico', resistencia: 'fisico', acrobacias: 'fisico',
    sigilo: 'sigilo', juego_manos: 'sigilo',
    trato_social: 'social', intimidacion: 'social', engano: 'social', perspicacia: 'social',
    saber_arcano: 'saber', historia: 'saber', saber_oculto: 'saber', medicina: 'saber',
    artesania: 'saber', tasacion: 'saber',
  };
  return mapa[habilidad] ?? 'generico';
}

export default {
  ATMOSFERA,
  FRANJA,
  CLIMA,
  RESULTADOS,
  COMBATE,
  NPC,
  OPCIONES,
  CONECTORES,
  CIERRES,
  AMBIENTE,
  atmosferaDe,
  resultadosDe,
  categoriaDe,
};
