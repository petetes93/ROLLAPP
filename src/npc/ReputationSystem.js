/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANUM · npc/ReputationSystem.js
 * ---------------------------------------------------------------------------
 * Reputación con las facciones.
 *
 * La diferencia con `RelationshipSystem` es la escala. Aquella gestiona lo que
 * opina una persona; esta, lo que opina una organización. Y las organizaciones
 * se comportan distinto:
 *
 *   · CONTAGIAN — ayudar a unos molesta a sus enemigos, automáticamente
 *   · TIENEN UMBRALES — al cruzarlos se abren o cierran puertas concretas
 *   · EXIGEN — un aliado espera cosas de ti, no solo te las da
 *   · NO OLVIDAN — la reputación no deriva con el tiempo; una organización
 *     lleva registros
 *
 * Ese último punto es deliberado y contrasta con las relaciones personales. La
 * gente perdona; los gremios apuntan.
 *
 * Dependencias: SystemBase, factions.data, balance.config.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { SystemBase } from '../core/SystemBase.js';
import {
  FACCIONES, obtenerFaccion, faccionesDe,
  beneficiosAcumulados, evaluarAccion,
} from '../data/factions.data.js';
import { SOCIAL } from '../config/balance.config.js';
import { saturar } from '../utils/math.js';

/** Eventos publicados. */
export const EVENTOS_REPUTACION = Object.freeze({
  CAMBIO: 'faction:reputation:change',
  NIVEL: 'faction:level:change',
  BENEFICIO: 'faction:benefit:unlocked',
  EXPULSION: 'faction:expelled',
});

export class ReputationSystem extends SystemBase {
  static nombre = 'reputation';
  static dependencias = ['world'];
  static canal = 'npc';

  /* ═══════════════════════════════════════════════════════════════════════
     CICLO DE VIDA
     ═══════════════════════════════════════════════════════════════════════ */

  alIniciar() {
    this.reductores({
      'factions/reputacion': this._reducirReputacion,
      'factions/conocer': this._reducirConocer,
    });

    // Las acciones con carga moral pueden afectar a las facciones que las
    // valoran o desprecian.
    this.escuchar('consequence:alignment', (datos) => this._alDerivarMoral(datos));

    // Completar misiones de facción es la vía principal de subir reputación.
    this.escuchar('quests:completed', (datos) => this._alCompletarMision(datos));

    // Matar a un miembro de una facción tiene consecuencias con toda ella.
    this.escuchar('npc:killed', (datos) => this._alMatarMiembro(datos));

    // Al llegar a una región nueva se registran sus facciones.
    this.escuchar('world:region:change', ({ region }) => this._conocerFacciones(region));
  }

  alArrancar() {
    // Las facciones de la región inicial se registran de entrada.
    const region = this.leer('world.region');
    if (region) this._conocerFacciones(region);
  }

  /* ═══════════════════════════════════════════════════════════════════════
     AJUSTE DE REPUTACIÓN
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Ajusta la reputación con una facción, con contagio a aliadas y enemigas.
   *
   * El contagio es lo que convierte las facciones en un sistema en vez de una
   * lista de números independientes: no se puede contentar a todo el mundo.
   *
   * @param {string} refId
   * @param {number} cambio
   * @param {Object} [opciones]
   * @param {string} [opciones.motivo]
   * @param {boolean} [opciones.silencioso=false]
   * @returns {{aplicado: boolean, valor: number, nivel: string, contagios: Array<Object>}}
   */
  ajustar(refId, cambio, opciones = {}) {
    const faccion = obtenerFaccion(refId);
    if (!faccion || !cambio) {
      return { aplicado: false, valor: 0, nivel: 'neutral', contagios: [] };
    }

    const reputaciones = this.leer('factions.reputacion', {});
    const actual = reputaciones[refId] ?? SOCIAL.reputacion.inicial;

    const nuevo = saturar(actual + cambio, SOCIAL.reputacion.min, SOCIAL.reputacion.max);

    const cambios = { [refId]: nuevo };
    const contagios = [];

    // ─── Contagio ───────────────────────────────────────────────────────
    for (const aliada of faccion.aliadas ?? []) {
      const previo = reputaciones[aliada] ?? SOCIAL.reputacion.inicial;
      const delta = Math.round(cambio * SOCIAL.reputacion.contagioAliada);

      if (delta === 0) continue;

      cambios[aliada] = saturar(previo + delta, SOCIAL.reputacion.min, SOCIAL.reputacion.max);
      contagios.push({ refId: aliada, delta, relacion: 'aliada' });
    }

    for (const enemiga of faccion.enemigas ?? []) {
      const previo = reputaciones[enemiga] ?? SOCIAL.reputacion.inicial;
      const delta = Math.round(cambio * SOCIAL.reputacion.contagioEnemiga);

      if (delta === 0) continue;

      cambios[enemiga] = saturar(previo + delta, SOCIAL.reputacion.min, SOCIAL.reputacion.max);
      contagios.push({ refId: enemiga, delta, relacion: 'enemiga' });
    }

    this.despachar('factions/reputacion', { cambios });

    // ─── Aviso solo al cruzar un nivel ──────────────────────────────────
    const nivelAntes = this.nivel(actual);
    const nivelDespues = this.nivel(nuevo);

    if (!opciones.silencioso) {
      this.emitir(EVENTOS_REPUTACION.CAMBIO, {
        refId, nombre: faccion.nombre, delta: cambio, valor: nuevo, motivo: opciones.motivo,
      });
    }

    if (nivelAntes !== nivelDespues) {
      this._anunciarNivel(faccion, nivelAntes, nivelDespues, nuevo > actual);
    }

    // Los contagios que cruzan nivel también se anuncian: enterarse de que has
    // molestado a alguien sin pretenderlo es parte del sistema.
    for (const c of contagios) {
      const f = obtenerFaccion(c.refId);
      if (!f) continue;

      const antes = this.nivel(reputaciones[c.refId] ?? SOCIAL.reputacion.inicial);
      const despues = this.nivel(cambios[c.refId]);

      if (antes !== despues) {
        this._anunciarNivel(f, antes, despues, c.delta > 0, true);
      }
    }

    return { aplicado: true, valor: nuevo, nivel: nivelDespues, contagios };
  }

  /**
   * Anuncia un cambio de nivel de reputación.
   * @private
   */
  _anunciarNivel(faccion, anterior, nuevo, mejora, porContagio = false) {
    this.emitir(EVENTOS_REPUTACION.NIVEL, {
      refId: faccion.refId,
      nombre: faccion.nombre,
      anterior,
      nuevo,
      mejora,
      porContagio,
    });

    const texto = mejora
      ? `${faccion.nombre}: ahora te consideran ${_etiqueta(nuevo)}.`
      : `${faccion.nombre}: has bajado a ${_etiqueta(nuevo)}.`;

    this.emitir('ui:notice', {
      mensaje: porContagio ? `${texto} (por tus tratos con otros)` : texto,
      tipo: mejora ? 'exito' : 'aviso',
    });

    this.emitir('memory:remember', { texto, peso: 2 });

    // ─── Beneficios desbloqueados ───────────────────────────────────────
    if (mejora && ['cordial', 'aliado', 'venerado'].includes(nuevo)) {
      const beneficio = faccion.beneficios[nuevo];

      if (beneficio) {
        this.emitir(EVENTOS_REPUTACION.BENEFICIO, {
          refId: faccion.refId, nivel: nuevo, beneficio,
        });

        this.emitir('narrative:direct', {
          texto: `${faccion.nombre} te abre una puerta: ${beneficio}`,
          voz: 'system',
        });
      }

      // Lo que la facción espera a cambio se comunica al alcanzar aliado.
      if (nuevo === 'aliado' && faccion.exige?.length) {
        this.emitir('memory:remember', {
          texto: `${faccion.nombre} espera de ti: ${faccion.exige.join(' ')}`,
          peso: 3,
        });
      }
    }

    // ─── Expulsión ──────────────────────────────────────────────────────
    if (!mejora && nuevo === 'odiado') {
      this.emitir(EVENTOS_REPUTACION.EXPULSION, { refId: faccion.refId, nombre: faccion.nombre });

      this.emitir('narrative:direct', {
        texto: `${faccion.nombre} te ha declarado enemigo. No esperes hospitalidad donde manden.`,
        voz: 'system',
      });
    }
  }

  /* ═══════════════════════════════════════════════════════════════════════
     DEDUCCIÓN AUTOMÁTICA
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Una acción moral puede afectar a las facciones que la valoran o desprecian.
   *
   * Es la vía por la que el mundo reacciona sin que nadie lo declare: robar
   * molesta a la Guardia del Valle porque su catálogo lo lista como despreciado.
   *
   * @param {Object} datos
   * @private
   */
  _alDerivarMoral(datos) {
    if (!datos?.texto) return;

    // Solo las facciones que el jugador conoce reaccionan.
    const conocidas = this.leer('factions.conocidas.orden', []);

    for (const refId of conocidas) {
      const evaluacion = evaluarAccion(refId, datos.texto);
      if (!evaluacion.coincide) continue;

      const cambio = evaluacion.direccion * SOCIAL.reputacion.porAccionMoral;

      this.ajustar(refId, cambio, {
        motivo: evaluacion.motivo,
        silencioso: true,
      });
    }
  }

  /** @private */
  _alCompletarMision(datos) {
    if (!datos?.faccion) return;

    this.ajustar(datos.faccion, SOCIAL.reputacion.porMisionFaccion, {
      motivo: `misión completada: ${datos.titulo ?? ''}`,
    });
  }

  /** @private */
  _alMatarMiembro(datos) {
    if (!datos?.faccion) return;

    this.ajustar(datos.faccion, -SOCIAL.reputacion.porMatarMiembro, {
      motivo: `mató a ${datos.nombre ?? 'uno de los suyos'}`,
    });
  }

  /**
   * Registra las facciones de una región como conocidas.
   *
   * Una facción que no se conoce no aparece en la interfaz ni reacciona: el
   * jugador no puede tener reputación con alguien de quien no ha oído hablar.
   *
   * @param {string} region
   * @private
   */
  _conocerFacciones(region) {
    const presentes = faccionesDe(region);
    if (!presentes.length) return;

    const conocidas = this.leer('factions.conocidas.orden', []);
    const nuevas = presentes.filter((f) => !conocidas.includes(f.refId));

    if (!nuevas.length) return;

    this.despachar('factions/conocer', { facciones: nuevas.map((f) => f.refId) });

    for (const f of nuevas) {
      this.log.debug(`facción conocida: ${f.nombre}`);
    }
  }

  /* ═══════════════════════════════════════════════════════════════════════
     CONSULTAS
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Nivel de reputación correspondiente a un valor.
   * @param {number} valor
   * @returns {string}
   */
  nivel(valor) {
    const niveles = [...SOCIAL.reputacion.niveles].reverse();
    return niveles.find((n) => valor >= n.desde)?.clave ?? 'neutral';
  }

  /**
   * Reputación actual con una facción.
   * @param {string} refId
   * @returns {number}
   */
  reputacion(refId) {
    return this.leer(`factions.reputacion.${refId}`, SOCIAL.reputacion.inicial);
  }

  /**
   * Beneficios activos de una facción.
   * @param {string} refId
   * @returns {string[]}
   */
  beneficios(refId) {
    return beneficiosAcumulados(refId, this.nivel(this.reputacion(refId)));
  }

  /**
   * Comprueba si el jugador disfruta de un beneficio concreto.
   *
   * Lo consultan el sistema de precios y el de servicios: un aliado del gremio
   * paga menos en sus talleres.
   *
   * @param {string} refId
   * @param {string} nivelMinimo
   * @returns {boolean}
   */
  tieneNivel(refId, nivelMinimo) {
    const escala = SOCIAL.reputacion.niveles.map((n) => n.clave);
    const actual = escala.indexOf(this.nivel(this.reputacion(refId)));
    const minimo = escala.indexOf(nivelMinimo);

    return actual >= 0 && minimo >= 0 && actual >= minimo;
  }

  /**
   * Descuento comercial derivado de la reputación con una facción.
   *
   * @param {string} refId
   * @returns {number} Multiplicador de precio: 1 es neutral.
   */
  multiplicadorPrecio(refId) {
    const nivel = this.nivel(this.reputacion(refId));

    const factores = {
      venerado: 0.8,
      aliado: 0.88,
      cordial: 0.95,
      neutral: 1,
      receloso: 1.1,
      hostil: 1.3,
      odiado: 1.6,
    };

    return factores[nivel] ?? 1;
  }

  /**
   * Facciones conocidas con su estado, para la interfaz.
   * @returns {Array<Object>}
   */
  listado() {
    const conocidas = this.leer('factions.conocidas.orden', []);

    return conocidas.map((refId) => {
      const f = obtenerFaccion(refId);
      const valor = this.reputacion(refId);
      const nivel = this.nivel(valor);

      return {
        refId,
        nombre: f?.nombre ?? refId,
        lema: f?.lema,
        valor,
        nivel,
        etiqueta: _etiqueta(nivel),
        beneficios: beneficiosAcumulados(refId, nivel),
        exige: nivel === 'aliado' || nivel === 'venerado' ? f?.exige ?? [] : [],
        // Fracción para la barra: se normaliza el rango completo a 0-1.
        fraccion: (valor - SOCIAL.reputacion.min) / (SOCIAL.reputacion.max - SOCIAL.reputacion.min),
      };
    }).sort((a, b) => b.valor - a.valor);
  }

  /**
   * Contexto de facciones para el director.
   *
   * Solo se envían las que importan: las de la región actual y aquellas con las
   * que la relación es extrema. Enumerar las ocho en cada turno gastaría
   * contexto sin aportar.
   *
   * @returns {string}
   */
  paraDirector() {
    const region = this.leer('world.region');
    const locales = faccionesDe(region).map((f) => f.refId);

    const relevantes = this.listado().filter((f) =>
      locales.includes(f.refId) || Math.abs(f.valor) >= 40);

    if (!relevantes.length) return '';

    const lineas = relevantes.map((f) => {
      const aqui = locales.includes(f.refId) ? ' [presente aquí]' : '';
      return `· ${f.nombre}: ${f.etiqueta}${aqui}`;
    });

    return `FACCIONES:\n${lineas.join('\n')}`;
  }

  /* ═══════════════════════════════════════════════════════════════════════
     REDUCTORES
     ═══════════════════════════════════════════════════════════════════════ */

  /** @private */
  _reducirReputacion(estado, accion) {
    const { cambios } = accion.payload ?? {};
    if (!cambios) return null;

    return {
      factions: {
        reputacion: { ...estado.factions.reputacion, ...cambios },
      },
    };
  }

  /** @private */
  _reducirConocer(estado, accion) {
    const { facciones = [] } = accion.payload ?? {};
    if (!facciones.length) return null;

    const conocidas = estado.factions.conocidas;
    const porId = { ...conocidas.porId };
    const orden = [...conocidas.orden];
    const reputacion = { ...estado.factions.reputacion };

    for (const refId of facciones) {
      if (porId[refId]) continue;

      const f = obtenerFaccion(refId);
      if (!f) continue;

      porId[refId] = {
        refId,
        nombre: f.nombre,
        aliadas: f.aliadas ?? [],
        enemigas: f.enemigas ?? [],
      };
      orden.push(refId);

      if (reputacion[refId] === undefined) {
        reputacion[refId] = SOCIAL.reputacion.inicial;
      }
    }

    return { factions: { conocidas: { porId, orden }, reputacion } };
  }

  /** @returns {Object} */
  inspeccionar() {
    return {
      conocidas: this.leer('factions.conocidas.orden', []).length,
      total: Object.keys(FACCIONES).length,
      listado: this.listado().map((f) => `${f.nombre}: ${f.valor} (${f.nivel})`),
    };
  }
}

/**
 * Etiqueta legible de un nivel de reputación.
 * @param {string} nivel
 * @returns {string}
 * @private
 */
function _etiqueta(nivel) {
  const etiquetas = {
    odiado: 'enemigo declarado',
    hostil: 'enemigo',
    receloso: 'sospechoso',
    neutral: 'un desconocido',
    cordial: 'alguien de fiar',
    aliado: 'aliado',
    venerado: 'uno de los suyos',
  };
  return etiquetas[nivel] ?? 'un desconocido';
}

export default ReputationSystem;
