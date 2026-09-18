/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANUM · world/TimeSystem.js
 * ---------------------------------------------------------------------------
 * Tiempo del mundo: franjas del día, estaciones y horarios.
 *
 * El reloj lo lleva `Clock`; este sistema traduce ese reloj en CONSECUENCIAS:
 *
 *   · Los servicios abren y cierran. Llegar a un pueblo a las tres de la
 *     madrugada significa que no hay posada.
 *   · Las estaciones cambian el mundo. En invierno los pasos se cierran y la
 *     comida escasea.
 *   · Los lugares evolucionan entre visitas. Volver a un sitio tres semanas
 *     después debería encontrarlo distinto.
 *
 * El primero es el que más se nota en el juego. Un horario que se respeta
 * convierte la hora del día en una decisión: ¿fuerzo la marcha para llegar
 * antes de que cierre la fragua, o acampo y espero?
 *
 * Dependencias: SystemBase, locations.data.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { SystemBase } from '../core/SystemBase.js';
import { obtenerLugar } from '../data/locations.data.js';

/** Eventos publicados. */
export const EVENTOS_TIEMPO = Object.freeze({
  ESTACION: 'world:season:change',
  SERVICIOS: 'world:services:change',
  EVOLUCION: 'world:location:evolved',
});

/* ═══════════════════════════════════════════════════════════════════════════
   HORARIOS
   ---------------------------------------------------------------------------
   Cada servicio declara sus horas de apertura y qué días descansa. Que esté en
   datos permite ajustarlo de un vistazo.
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * @typedef {Object} Horario
 * @property {number} abre Hora de apertura (0-23).
 * @property {number} cierra Hora de cierre.
 * @property {boolean} [siempre] Nunca cierra.
 * @property {string} cerrado Mensaje cuando está cerrado.
 */

/** @type {Record<string, Horario>} */
export const HORARIOS = Object.freeze({
  posada: {
    abre: 6, cierra: 26,   // Hasta las dos de la madrugada.
    cerrado: 'La posada está cerrada a estas horas. Habría que llamar muy fuerte.',
  },
  herrero: {
    abre: 7, cierra: 19,
    cerrado: 'La fragua está apagada. El herrero duerme.',
  },
  mercado: {
    abre: 7, cierra: 18,
    cerrado: 'Los puestos están recogidos. No hay nadie vendiendo.',
  },
  templo: {
    abre: 5, cierra: 22,
    cerrado: 'El templo está cerrado. Solo se oye algo dentro.',
  },
  archivo: {
    abre: 8, cierra: 17,
    cerrado: 'El archivo está cerrado. Los escribas no trabajan de noche.',
  },
  gremio: {
    abre: 8, cierra: 18,
    cerrado: 'La casa del gremio está cerrada.',
  },
});

/* ═══════════════════════════════════════════════════════════════════════════
   ESTACIONES
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * @typedef {Object} Estacion
 * @property {string} clave
 * @property {string} nombre
 * @property {number} desde Día del año en que empieza.
 * @property {Object} efectos
 * @property {string} descripcion
 */

/** Las cuatro estaciones, de noventa días cada una. */
export const ESTACIONES = Object.freeze([
  {
    clave: 'primavera', nombre: 'primavera', desde: 0,
    efectos: { climaLluvia: 1.4, precioComida: 1.1 },
    descripcion: 'El deshielo abre los caminos y el barro los complica.',
  },
  {
    clave: 'verano', nombre: 'verano', desde: 90,
    efectos: { horasLuz: 1.2, climaTormenta: 1.3, consumoAgua: 1.4 },
    descripcion: 'Días largos y calor que agota.',
  },
  {
    clave: 'otono', nombre: 'otoño', desde: 180,
    efectos: { precioComida: 0.8, climaNiebla: 1.5 },
    descripcion: 'La cosecha llena los graneros y la niebla los caminos.',
  },
  {
    clave: 'invierno', nombre: 'invierno', desde: 270,
    efectos: {
      horasLuz: 0.7, climaNieve: 2, precioComida: 1.6,
      pasosCerrados: true, consumoRaciones: 1.3,
    },
    descripcion: 'Los pasos se cierran y la comida se encarece.',
  },
]);

export class TimeSystem extends SystemBase {
  static nombre = 'time';
  static dependencias = ['clock'];
  static canal = 'world';

  constructor(contexto) {
    super(contexto);

    /** Última estación conocida, para detectar el cambio. @private */
    this._estacionAnterior = null;

    /** Servicios abiertos en la última comprobación. @private */
    this._serviciosAnteriores = null;
  }

  /* ═══════════════════════════════════════════════════════════════════════
     CICLO DE VIDA
     ═══════════════════════════════════════════════════════════════════════ */

  alIniciar() {
    this.reductores({
      'world/tiempo': this._reducirTiempo,
    });

    // El reloj publica el avance; aquí se traducen las consecuencias.
    this.escuchar('clock:hour:new', () => this._revisarServicios());
    this.escuchar('clock:day:new', ({ diasTotales }) => this._alNuevoDia(diasTotales));
  }

  alArrancar() {
    this._estacionAnterior = this.estacionActual().clave;
    this._sincronizar();
  }

  /* ═══════════════════════════════════════════════════════════════════════
     ESTACIONES
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Estación correspondiente al día actual.
   * @returns {Estacion}
   */
  estacionActual() {
    const dia = this.leer('world.tiempo.diasTotales', 0);
    const diaDelAno = dia % 360;

    // Se busca la última estación cuyo umbral se haya cruzado.
    return [...ESTACIONES].reverse().find((e) => diaDelAno >= e.desde) ?? ESTACIONES[0];
  }

  /**
   * Día dentro de la estación actual.
   * @returns {number}
   */
  diaDeEstacion() {
    const diaDelAno = this.leer('world.tiempo.diasTotales', 0) % 360;
    return diaDelAno - this.estacionActual().desde;
  }

  /**
   * Comprueba el cambio de estación y lo anuncia.
   * @param {number} diasTotales
   * @private
   */
  _alNuevoDia(diasTotales) {
    const estacion = this.estacionActual();

    if (estacion.clave !== this._estacionAnterior) {
      const anterior = this._estacionAnterior;
      this._estacionAnterior = estacion.clave;

      this.despachar('world/tiempo', { estacion: estacion.clave });

      this.emitir(EVENTOS_TIEMPO.ESTACION, {
        anterior,
        nueva: estacion.clave,
        nombre: estacion.nombre,
        efectos: estacion.efectos,
      });

      this.emitir('narrative:direct', {
        texto: `Ha entrado el ${estacion.nombre}. ${estacion.descripcion}`,
        voz: 'system',
      });

      this.emitir('memory:remember', {
        texto: `Entró el ${estacion.nombre}.`,
        peso: 2,
      });

      // El invierno cierra pasos: es una consecuencia grande y hay que avisar.
      if (estacion.efectos.pasosCerrados) {
        this.emitir('ui:notice', {
          mensaje: 'Los pasos de montaña se han cerrado hasta la primavera.',
          tipo: 'aviso',
        });
      }
    }

    // La evolución de los lugares se evalúa a diario.
    this._evolucionarLugares(diasTotales);
  }

  /* ═══════════════════════════════════════════════════════════════════════
     SERVICIOS
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Comprueba si un servicio está disponible aquí y ahora.
   *
   * @param {string} servicio
   * @param {Object} [opciones]
   * @param {string} [opciones.lugar] Por defecto, el actual.
   * @returns {{disponible: boolean, motivo: string|null, abre: number|null}}
   */
  puedeUsar(servicio, opciones = {}) {
    const refId = opciones.lugar ?? this.leer('world.ubicacion');
    const lugar = obtenerLugar(refId);

    if (!lugar) {
      return { disponible: false, motivo: 'No sabes dónde estás.', abre: null };
    }

    // ─── ¿Existe aquí? ──────────────────────────────────────────────────
    if (!lugar.servicios?.includes(servicio)) {
      return {
        disponible: false,
        motivo: `No hay nada de eso en ${lugar.nombre}.`,
        abre: null,
      };
    }

    // ─── ¿Está en horario? ──────────────────────────────────────────────
    const horario = HORARIOS[servicio];
    if (!horario) return { disponible: true, motivo: null, abre: null };
    if (horario.siempre) return { disponible: true, motivo: null, abre: null };

    const hora = this.leer('world.tiempo.hora', 12);

    if (!this._enHorario(hora, horario)) {
      return {
        disponible: false,
        motivo: horario.cerrado,
        abre: horario.abre,
      };
    }

    return { disponible: true, motivo: null, abre: null };
  }

  /**
   * Comprueba si una hora está dentro de un horario.
   *
   * Los horarios que cruzan la medianoche se declaran con `cierra` mayor que 24.
   *
   * @param {number} hora
   * @param {Horario} horario
   * @returns {boolean}
   * @private
   */
  _enHorario(hora, horario) {
    if (horario.cierra > 24) {
      // Cruza medianoche: abierto desde `abre` hasta `cierra - 24` del día
      // siguiente.
      return hora >= horario.abre || hora < horario.cierra - 24;
    }

    return hora >= horario.abre && hora < horario.cierra;
  }

  /**
   * Servicios del lugar actual con su estado.
   * @returns {Array<Object>}
   */
  serviciosDisponibles() {
    const lugar = obtenerLugar(this.leer('world.ubicacion'));
    if (!lugar?.servicios?.length) return [];

    return lugar.servicios.map((servicio) => {
      const estado = this.puedeUsar(servicio);
      const horario = HORARIOS[servicio];

      return {
        servicio,
        abierto: estado.disponible,
        nota: estado.disponible ? null : estado.motivo,
        abre: horario?.abre ?? null,
        cierra: horario?.cierra ?? null,
      };
    });
  }

  /**
   * Detecta cambios en los servicios abiertos y avisa.
   *
   * Enterarse de que la fragua acaba de cerrar es útil; que se avise cada hora
   * de que sigue cerrada, no.
   *
   * @private
   */
  _revisarServicios() {
    const abiertos = this.serviciosDisponibles()
      .filter((s) => s.abierto)
      .map((s) => s.servicio)
      .sort()
      .join(',');

    if (this._serviciosAnteriores === null) {
      this._serviciosAnteriores = abiertos;
      return;
    }

    if (abiertos === this._serviciosAnteriores) return;

    const antes = new Set(this._serviciosAnteriores.split(',').filter(Boolean));
    const ahora = new Set(abiertos.split(',').filter(Boolean));

    const cerrados = [...antes].filter((s) => !ahora.has(s));
    const nuevos = [...ahora].filter((s) => !antes.has(s));

    this._serviciosAnteriores = abiertos;

    this.emitir(EVENTOS_TIEMPO.SERVICIOS, { cerrados, abiertos: nuevos });

    // Solo se narra el cierre: es lo que impide hacer algo.
    if (cerrados.length) {
      const nombres = { posada: 'la posada', herrero: 'la fragua', mercado: 'el mercado', templo: 'el templo' };
      const lista = cerrados.map((s) => nombres[s] ?? s).join(' y ');

      this.emitir('narrative:direct', {
        texto: `Cierra ${lista}.`,
        voz: 'system',
      });
    }
  }

  /* ═══════════════════════════════════════════════════════════════════════
     EVOLUCIÓN DE LUGARES
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Los lugares cambian entre visitas.
   *
   * Volver a un sitio tres semanas después debería encontrarlo distinto. Sin
   * esto, el mundo espera quieto a que el jugador vuelva, y eso se nota.
   *
   * @param {number} diasTotales
   * @private
   */
  _evolucionarLugares(diasTotales) {
    const conocidos = this.leer('world.localizaciones.porId', {});
    const actual = this.leer('world.ubicacion');

    for (const [refId, estado] of Object.entries(conocidos)) {
      // El lugar donde estás no evoluciona a tus espaldas.
      if (refId === actual) continue;
      if (!estado.visitado) continue;

      const diasAusente = diasTotales - (estado.ultimaVisita ?? 0);

      // Menos de una semana no da para cambios apreciables.
      if (diasAusente < 7) continue;

      // La probabilidad crece con el tiempo, hasta un techo.
      const probabilidad = Math.min(0.4, diasAusente * 0.02);
      if (!this.rng.flujo('mundo').oportunidad(probabilidad)) continue;

      const cambio = this._generarCambio(refId, diasAusente);
      if (!cambio) continue;

      this.despachar('world/lugar/evolucionar', { refId, cambio, dia: diasTotales });

      this.emitir(EVENTOS_TIEMPO.EVOLUCION, { refId, cambio });

      // No se anuncia: el jugador lo descubrirá al volver, que es la gracia.
      this.log.debug(`${refId} ha cambiado: ${cambio.tipo}`);
    }
  }

  /**
   * Genera un cambio verosímil para un lugar.
   * @param {string} refId
   * @param {number} diasAusente
   * @returns {Object|null}
   * @private
   */
  _generarCambio(refId, diasAusente) {
    const lugar = obtenerLugar(refId);
    if (!lugar) return null;

    const flujo = this.rng.flujo('mundo');

    // Los cambios posibles dependen del tipo de lugar.
    const posibles = [];

    if (lugar.tipo === 'asentamiento') {
      posibles.push(
        { tipo: 'gente_nueva', peso: 40, nota: 'Hay caras que no estaban antes.' },
        { tipo: 'obra', peso: 25, nota: 'Están construyendo algo nuevo.' },
        { tipo: 'ausencia', peso: 20, nota: 'Falta alguien que solía estar aquí.' },
        { tipo: 'prosperidad', peso: 15, nota: 'El lugar se ve más próspero.' },
      );

      // Una ausencia larga permite cambios mayores.
      if (diasAusente > 30) {
        posibles.push({ tipo: 'cambio_mando', peso: 12, nota: 'Manda alguien distinto.' });
      }
    } else if (lugar.tipo === 'ruina' || lugar.tipo === 'mazmorra') {
      posibles.push(
        { tipo: 'saqueado', peso: 35, nota: 'Alguien ha estado aquí y se ha llevado cosas.' },
        { tipo: 'repoblado', peso: 30, nota: 'Algo nuevo ha hecho nido aquí.' },
        { tipo: 'derrumbe', peso: 20, nota: 'Parte del sitio se ha venido abajo.' },
        { tipo: 'abierto', peso: 15, nota: 'Hay un paso que antes estaba cerrado.' },
      );
    } else {
      posibles.push(
        { tipo: 'rastro', peso: 40, nota: 'Alguien ha pasado por aquí.' },
        { tipo: 'estacional', peso: 35, nota: 'El sitio se ve distinto con el cambio de estación.' },
      );
    }

    if (!posibles.length) return null;

    const elegido = flujo.elegirPonderado(posibles.map((p) => ({ valor: p, peso: p.peso })));

    return { ...elegido, dia: this.leer('world.tiempo.diasTotales', 0) };
  }

  /* ═══════════════════════════════════════════════════════════════════════
     SINCRONIZACIÓN
     ═══════════════════════════════════════════════════════════════════════ */

  /** @private */
  _sincronizar() {
    this.despachar('world/tiempo', { estacion: this.estacionActual().clave });
  }

  /** @private */
  _reducirTiempo(estado, accion) {
    const parche = { world: { tiempo: { ...estado.world.tiempo } } };

    if (accion.payload?.estacion) {
      parche.world.tiempo.estacion = accion.payload.estacion;
    }

    return parche;
  }

  /* ═══════════════════════════════════════════════════════════════════════
     CONSULTAS
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Efectos de la estación actual.
   * @returns {Object}
   */
  efectosEstacion() {
    return this.estacionActual().efectos ?? {};
  }

  /**
   * Comprueba si es de noche.
   * @returns {boolean}
   */
  esDeNoche() {
    const franja = this.leer('world.tiempo.franja', 'mediodia');
    return ['noche', 'madrugada'].includes(franja);
  }

  /**
   * Horas de luz que quedan hoy.
   *
   * Lo consulta el sistema de viaje: emprender un trayecto de seis horas cuando
   * quedan dos de luz es una decisión, no un accidente.
   *
   * @returns {number}
   */
  horasDeLuz() {
    const hora = this.leer('world.tiempo.hora', 12);
    const factor = this.efectosEstacion().horasLuz ?? 1;

    // El anochecer se desplaza con la estación.
    const anochece = Math.round(19 * factor);

    return Math.max(0, anochece - hora);
  }

  /**
   * Contexto temporal para el director.
   * @returns {string}
   */
  paraDirector() {
    const tiempo = this.leer('world.tiempo');
    const estacion = this.estacionActual();

    const partes = [
      `Día ${tiempo.dia}, ${this._nombreFranja(tiempo.franja)}. Es ${estacion.nombre}.`,
    ];

    // Los servicios cerrados importan: el director no debería ofrecer una
    // posada que está cerrada.
    const cerrados = this.serviciosDisponibles().filter((s) => !s.abierto);

    if (cerrados.length) {
      const nombres = { posada: 'la posada', herrero: 'la fragua', mercado: 'el mercado', templo: 'el templo' };
      partes.push(`Está cerrado: ${cerrados.map((s) => nombres[s.servicio] ?? s.servicio).join(', ')}.`);
    }

    if (this.esDeNoche()) partes.push('Es de noche: sin luz propia no se ve nada.');

    return partes.join(' ');
  }

  /** @private */
  _nombreFranja(franja) {
    const nombres = {
      madrugada: 'plena madrugada', alba: 'al alba', manana: 'por la mañana',
      mediodia: 'a mediodía', tarde: 'por la tarde', ocaso: 'al ocaso',
      noche: 'de noche',
    };
    return nombres[franja] ?? franja;
  }

  /** @returns {Object} */
  serializar() {
    return {
      estacionAnterior: this._estacionAnterior,
      serviciosAnteriores: this._serviciosAnteriores,
    };
  }

  /** @param {Object} datos */
  restaurar(datos) {
    this._estacionAnterior = datos?.estacionAnterior ?? null;
    this._serviciosAnteriores = datos?.serviciosAnteriores ?? null;
  }

  /** @returns {Object} */
  inspeccionar() {
    return {
      estacion: this.estacionActual().nombre,
      diaDeEstacion: this.diaDeEstacion(),
      franja: this.leer('world.tiempo.franja'),
      horasDeLuz: this.horasDeLuz(),
      servicios: this.serviciosDisponibles(),
    };
  }
}

export default TimeSystem;
