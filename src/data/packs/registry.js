/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANVEIL · data/packs/registry.js
 * ---------------------------------------------------------------------------
 * Registro de paquetes de contenido.
 *
 * Un paquete es un conjunto de datos de juego —linajes, vocaciones, conjuros,
 * criaturas, objetos— con su licencia y su atribución asociadas. El motor no
 * distingue de dónde viene un dato: los paquetes se fusionan en un catálogo
 * único y todo lo demás consulta ese catálogo.
 *
 * Por qué existe esta capa:
 *   1. Cumplimiento de licencias. Cada dato conserva su `fuente`, así que la
 *      aplicación puede generar la atribución exacta de lo que tiene cargado,
 *      ni más ni menos.
 *   2. Contenido opcional. El jugador puede jugar solo con material original,
 *      solo con SRD, o con todo mezclado.
 *   3. Ampliación futura. Añadir un paquete de la comunidad será registrar una
 *      entrada aquí, sin tocar el resto del motor.
 *
 * Los paquetes voluminosos (conjuros, criaturas) se cargan de forma perezosa:
 * no tiene sentido tener 330 criaturas en memoria durante la creación de
 * personaje.
 *
 * Dependencias: core/Logger, core/Errors.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { crearCanal } from '../../core/Logger.js';
import { registrar } from '../../core/Errors.js';

const log = crearCanal('core');

/* ═══════════════════════════════════════════════════════════════════════════
   LICENCIAS
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Licencias reconocidas. `atribucionObligatoria` determina si el texto debe
 * aparecer en la aplicación; `permiteRedistribucion` documenta si el paquete
 * puede distribuirse junto al proyecto.
 */
export const LICENCIAS = Object.freeze({
  ORIGINAL: {
    clave: 'original',
    nombre: 'Contenido original de ARCANVEIL',
    url: null,
    atribucionObligatoria: false,
    permiteRedistribucion: true,
    texto: 'Obra original de este proyecto.',
  },

  CC_BY_4: {
    clave: 'cc-by-4.0',
    nombre: 'Creative Commons Attribution 4.0 International',
    url: 'https://creativecommons.org/licenses/by/4.0/legalcode',
    atribucionObligatoria: true,
    permiteRedistribucion: true,
    texto:
      'Licenciado bajo Creative Commons Attribution 4.0 International. ' +
      'Se permite el uso, la adaptación y la redistribución con atribución.',
  },

  MIT: {
    clave: 'mit',
    nombre: 'MIT License',
    url: 'https://opensource.org/licenses/MIT',
    atribucionObligatoria: true,
    permiteRedistribucion: true,
    texto: 'Licencia MIT. Se permite el uso y la redistribución con aviso de copyright.',
  },
});

/* ═══════════════════════════════════════════════════════════════════════════
   DEFINICIÓN DE PAQUETES
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * @typedef {Object} Paquete
 * @property {string} id
 * @property {string} nombre Visible en Ajustes.
 * @property {string} descripcion
 * @property {Object} licencia Entrada de LICENCIAS.
 * @property {string} atribucion Texto exacto exigido por la licencia.
 * @property {string[]} categorias Qué aporta: 'razas', 'clases', 'conjuros'…
 * @property {boolean} activoPorDefecto
 * @property {boolean} perezoso Se carga solo cuando se necesita.
 * @property {() => Promise<Object>} cargar Importación dinámica del contenido.
 * @property {boolean} [incluido=true] false si el usuario debe instalarlo.
 * @property {string} [instruccionesInstalacion]
 */

/**
 * Catálogo de paquetes disponibles.
 *
 * Los marcados con `incluido: false` no vienen con el proyecto: el usuario los
 * añade dejando los archivos JSON en la carpeta indicada. El registro los
 * detecta al arrancar y los activa si están presentes.
 *
 * @type {Record<string, Paquete>}
 */
export const PAQUETES = Object.freeze({

  /* ─── Contenido propio ────────────────────────────────────────────────── */
  original: {
    id: 'original',
    nombre: 'Reinos Quebrados',
    descripcion:
      'Ambientación original de ARCANVEIL: 9 linajes y 8 vocaciones propias, con sus culturas, ' +
      'ganchos narrativos y rasgos exclusivos.',
    licencia: LICENCIAS.ORIGINAL,
    atribucion: '',
    categorias: ['razas', 'clases', 'trasfondos', 'habilidades', 'objetos'],
    activoPorDefecto: true,
    perezoso: false,
    incluido: true,
    cargar: async () => {
      const [razas, clases] = await Promise.all([
        import('../races.original.data.js'),
        import('../classes.data.js'),
      ]);
      return {
        razas: razas.RAZAS_ORIGINALES ?? razas.default,
        clases: clases.CLASES ?? clases.default,
      };
    },
  },

  /* ─── SRD escrito a mano ──────────────────────────────────────────────── */
  srd_nucleo: {
    id: 'srd_nucleo',
    nombre: 'SRD · Linajes y vocaciones',
    descripcion:
      '11 linajes del System Reference Document, traducidos y adaptados al Núcleo d20: ' +
      'humano, elfo, enano, mediano, gnomo, semielfo, semiorco, dracónido, tiflin, aasimar y goliat.',
    licencia: LICENCIAS.CC_BY_4,
    atribucion:
      'This work includes material taken from the System Reference Document 5.1 ("SRD 5.1") ' +
      'and the System Reference Document 5.2 ("SRD 5.2") by Wizards of the Coast LLC, ' +
      'available at https://www.dndbeyond.com/srd. The SRD 5.1 and SRD 5.2 are licensed under ' +
      'the Creative Commons Attribution 4.0 International License, available at ' +
      'https://creativecommons.org/licenses/by/4.0/legalcode. Material traducido y adaptado.',
    categorias: ['razas'],
    activoPorDefecto: true,
    perezoso: false,
    incluido: true,
    cargar: async () => {
      const m = await import('../races.srd.data.js');
      return { razas: m.RAZAS_SRD ?? m.default };
    },
  },

  /* ─── Volcados masivos, instalables por el usuario ────────────────────── */
  srd_conjuros: {
    id: 'srd_conjuros',
    nombre: 'SRD · Conjuros',
    descripcion:
      'Alrededor de 320 conjuros del SRD, convertidos automáticamente al sistema de glifos ' +
      'y maná del Núcleo d20.',
    licencia: LICENCIAS.CC_BY_4,
    atribucion:
      'Contenido derivado del System Reference Document 5.1 de Wizards of the Coast LLC, ' +
      'bajo licencia CC BY 4.0. Datos procesados mediante volcados de Open5e o 5e-bits.',
    categorias: ['conjuros'],
    activoPorDefecto: true,
    perezoso: true,
    incluido: false,
    instruccionesInstalacion:
      'Descarga spells.json de https://github.com/5e-bits/5e-database (carpeta src/2014) ' +
      'o de https://api.open5e.com/spells/ y colócalo en src/data/packs/srd/spells.json',
    cargar: async () => {
      const m = await import('./srd/spells.json', { with: { type: 'json' } });
      return { conjuros: m.default };
    },
  },

  srd_criaturas: {
    id: 'srd_criaturas',
    nombre: 'SRD · Criaturas',
    descripcion:
      'Alrededor de 330 criaturas del SRD, convertidas a combatientes del Núcleo d20 con ' +
      'su grado de amenaza recalculado.',
    licencia: LICENCIAS.CC_BY_4,
    atribucion:
      'Contenido derivado del System Reference Document 5.1 de Wizards of the Coast LLC, ' +
      'bajo licencia CC BY 4.0. Datos procesados mediante volcados de Open5e o 5e-bits.',
    categorias: ['enemigos'],
    activoPorDefecto: true,
    perezoso: true,
    incluido: false,
    instruccionesInstalacion:
      'Descarga monsters.json de https://github.com/5e-bits/5e-database ' +
      'y colócalo en src/data/packs/srd/monsters.json',
    cargar: async () => {
      const m = await import('./srd/monsters.json', { with: { type: 'json' } });
      return { enemigos: m.default };
    },
  },

  srd_objetos: {
    id: 'srd_objetos',
    nombre: 'SRD · Equipo y objetos mágicos',
    descripcion:
      'Armas, armaduras, equipo de aventura y objetos mágicos del SRD, con sus rarezas ' +
      'convertidas a la escala de siete grados del Núcleo d20.',
    licencia: LICENCIAS.CC_BY_4,
    atribucion:
      'Contenido derivado del System Reference Document 5.1 de Wizards of the Coast LLC, ' +
      'bajo licencia CC BY 4.0.',
    categorias: ['objetos'],
    activoPorDefecto: true,
    perezoso: true,
    incluido: false,
    instruccionesInstalacion:
      'Descarga equipment.json y magic-items.json de https://github.com/5e-bits/5e-database ' +
      'y colócalos en src/data/packs/srd/',
    cargar: async () => {
      const [equipo, magicos] = await Promise.all([
        import('./srd/equipment.json', { with: { type: 'json' } }),
        import('./srd/magic-items.json', { with: { type: 'json' } }),
      ]);
      return { objetos: [...(equipo.default ?? []), ...(magicos.default ?? [])] };
    },
  },

  srd_condiciones: {
    id: 'srd_condiciones',
    nombre: 'SRD · Estados alterados',
    descripcion: 'Condiciones del SRD mapeadas al sistema de estados del motor.',
    licencia: LICENCIAS.CC_BY_4,
    atribucion:
      'Contenido derivado del System Reference Document 5.1 de Wizards of the Coast LLC, ' +
      'bajo licencia CC BY 4.0.',
    categorias: ['estados'],
    activoPorDefecto: true,
    perezoso: true,
    incluido: false,
    instruccionesInstalacion:
      'Descarga conditions.json de https://github.com/5e-bits/5e-database ' +
      'y colócalo en src/data/packs/srd/conditions.json',
    cargar: async () => {
      const m = await import('./srd/conditions.json', { with: { type: 'json' } });
      return { estados: m.default };
    },
  },
});

/* ═══════════════════════════════════════════════════════════════════════════
   GESTOR
   ═══════════════════════════════════════════════════════════════════════════ */

export class RegistroPaquetes {
  constructor() {
    /**
     * Contenido ya cargado, indexado por identificador de paquete.
     * @type {Map<string, Object>}
     * @private
     */
    this._cargados = new Map();

    /**
     * Paquetes que fallaron al cargar. Se recuerdan para no reintentarlos en
     * bucle ni volver a registrar el mismo aviso.
     * @type {Set<string>}
     * @private
     */
    this._fallidos = new Set();

    /**
     * Paquetes activos. Arranca con los marcados por defecto.
     * @type {Set<string>}
     * @private
     */
    this._activos = new Set(
      Object.values(PAQUETES).filter((p) => p.activoPorDefecto).map((p) => p.id),
    );

    /** Catálogo fusionado por categoría. @private */
    this._catalogo = {
      razas: {},
      clases: {},
      trasfondos: {},
      habilidades: {},
      conjuros: {},
      enemigos: {},
      objetos: {},
      estados: {},
    };
  }

  /* ─────────────────────────────────────────────────────────────────────────
     CARGA
     ───────────────────────────────────────────────────────────────────────── */

  /**
   * Carga todos los paquetes activos no perezosos.
   * Los que fallen se omiten con un aviso: un paquete opcional ausente nunca
   * debe impedir que el juego arranque.
   *
   * @returns {Promise<void>}
   */
  async iniciar() {
    const fin = log.cronometro('cargar paquetes de contenido');

    const pendientes = [...this._activos]
      .map((id) => PAQUETES[id])
      .filter((p) => p && !p.perezoso);

    for (const paquete of pendientes) {
      await this.cargar(paquete.id);
    }

    fin();
    log.info(`Paquetes activos: ${[...this._cargados.keys()].join(', ') || 'ninguno'}`);
  }

  /**
   * Carga un paquete y fusiona su contenido en el catálogo.
   *
   * @param {string} id
   * @returns {Promise<boolean>} true si quedó disponible.
   */
  async cargar(id) {
    if (this._cargados.has(id)) return true;
    if (this._fallidos.has(id)) return false;

    const paquete = PAQUETES[id];
    if (!paquete) {
      log.aviso(`Paquete desconocido: "${id}"`);
      return false;
    }

    try {
      const contenido = await paquete.cargar();
      this._cargados.set(id, contenido);
      this._fusionar(id, contenido);
      log.debug(`paquete cargado: ${paquete.nombre}`);
      return true;
    } catch (e) {
      this._fallidos.add(id);

      if (paquete.incluido === false) {
        // Ausencia esperada: el usuario aún no ha instalado ese volcado.
        log.info(
          `Paquete opcional "${paquete.nombre}" no instalado. ` +
          `${paquete.instruccionesInstalacion ?? ''}`,
        );
      } else {
        registrar(e, 'core');
      }
      return false;
    }
  }

  /**
   * Fusiona el contenido de un paquete en el catálogo global, marcando cada
   * entrada con su procedencia para poder generar la atribución exacta.
   *
   * @param {string} idPaquete
   * @param {Object} contenido
   * @private
   */
  _fusionar(idPaquete, contenido) {
    for (const [categoria, datos] of Object.entries(contenido)) {
      if (!datos) continue;
      if (!this._catalogo[categoria]) this._catalogo[categoria] = {};

      const entradas = Array.isArray(datos)
        ? Object.fromEntries(datos.map((d) => [d.refId ?? d.index ?? d.slug, d]))
        : datos;

      for (const [clave, valor] of Object.entries(entradas)) {
        if (!clave) continue;

        // Una colisión de identificadores entre paquetes se resuelve
        // prefijando: 'elfo' del SRD no pisa a 'elfo' de un paquete comunitario.
        const claveFinal = this._catalogo[categoria][clave]
          ? `${idPaquete}:${clave}`
          : clave;

        this._catalogo[categoria][claveFinal] = { ...valor, _paquete: idPaquete };
      }
    }
  }

  /* ─────────────────────────────────────────────────────────────────────────
     CONSULTA
     ───────────────────────────────────────────────────────────────────────── */

  /**
   * Devuelve una categoría completa del catálogo fusionado.
   * @param {string} categoria 'razas' | 'clases' | 'conjuros'…
   * @returns {Record<string, Object>}
   */
  catalogo(categoria) {
    return this._catalogo[categoria] ?? {};
  }

  /**
   * Busca una entrada concreta.
   * @param {string} categoria
   * @param {string} refId
   * @returns {Object|null}
   */
  obtener(categoria, refId) {
    return this._catalogo[categoria]?.[refId] ?? null;
  }

  /**
   * Carga bajo demanda una categoría perezosa.
   * @param {string} categoria
   * @returns {Promise<Record<string, Object>>}
   */
  async pedir(categoria) {
    const necesarios = Object.values(PAQUETES).filter(
      (p) => p.perezoso && this._activos.has(p.id) && p.categorias.includes(categoria),
    );
    for (const p of necesarios) await this.cargar(p.id);
    return this.catalogo(categoria);
  }

  /* ─────────────────────────────────────────────────────────────────────────
     ACTIVACIÓN
     ───────────────────────────────────────────────────────────────────────── */

  /**
   * Activa o desactiva un paquete. Al desactivar se reconstruye el catálogo
   * desde cero: es más lento que retirar entradas una a una, pero garantiza
   * que no queden restos.
   *
   * @param {string} id
   * @param {boolean} activo
   * @returns {Promise<void>}
   */
  async activar(id, activo) {
    if (activo) {
      this._activos.add(id);
      this._fallidos.delete(id);
      await this.cargar(id);
      return;
    }

    this._activos.delete(id);
    this._cargados.delete(id);

    for (const categoria of Object.keys(this._catalogo)) this._catalogo[categoria] = {};
    for (const idCargado of [...this._cargados.keys()]) {
      this._fusionar(idCargado, this._cargados.get(idCargado));
    }
  }

  /** @param {string} id @returns {boolean} */
  estaActivo(id) {
    return this._activos.has(id);
  }

  /* ─────────────────────────────────────────────────────────────────────────
     ATRIBUCIÓN
     ───────────────────────────────────────────────────────────────────────── */

  /**
   * Textos de atribución de los paquetes efectivamente cargados.
   * Solo se incluyen los que la licencia exige: no se atribuye lo que no lo
   * necesita, ni se omite lo que sí.
   *
   * @returns {Array<{paquete: string, licencia: string, url: string|null, texto: string}>}
   */
  atribuciones() {
    const salida = [];
    for (const id of this._cargados.keys()) {
      const p = PAQUETES[id];
      if (!p?.licencia.atribucionObligatoria) continue;
      salida.push({
        paquete: p.nombre,
        licencia: p.licencia.nombre,
        url: p.licencia.url,
        texto: p.atribucion,
      });
    }
    return salida;
  }

  /**
   * Radiografía del registro, para Ajustes y para la consola.
   * @returns {Object}
   */
  inspeccionar() {
    return {
      activos: [...this._activos],
      cargados: [...this._cargados.keys()],
      fallidos: [...this._fallidos],
      totales: Object.fromEntries(
        Object.entries(this._catalogo).map(([k, v]) => [k, Object.keys(v).length]),
      ),
      disponibles: Object.values(PAQUETES).map((p) => ({
        id: p.id,
        nombre: p.nombre,
        instalado: !p.incluido ? this._cargados.has(p.id) : true,
        activo: this._activos.has(p.id),
        licencia: p.licencia.clave,
      })),
    };
  }
}

/** Instancia compartida. */
export const paquetes = new RegistroPaquetes();

export default paquetes;
