/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANUM · npc/DialogueSystem.js
 * ---------------------------------------------------------------------------
 * Conversación con personajes.
 *
 * No es un árbol de diálogo. El jugador escribe lo que quiera y el director lo
 * narra; este sistema se ocupa de lo que el director NO debe decidir:
 *
 *   · SI LA PERSUASIÓN FUNCIONA — lo resuelve una tirada, con la actitud del
 *     PNJ modificando la dificultad
 *   · QUÉ SABE Y QUÉ CUENTA — la información sale del conocimiento declarado
 *     del PNJ, no de lo que el modelo improvise
 *   · QUÉ ES IMPOSIBLE — hay cosas que alguien no hará por muy bien que se lo
 *     pidas, y eso se declara aquí
 *
 * El segundo punto es el que evita que el director invente rumores incoherentes.
 * Cuando el jugador pregunta por la región, la respuesta viene de datos reales
 * del mundo, y si el PNJ revela la ubicación de un sitio, ese sitio aparece en
 * el mapa de verdad.
 *
 * Dependencias: SystemBase, NPC, Region, locations.data.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { SystemBase } from '../core/SystemBase.js';
import * as N from './NPC.js';
import { obtenerLugar, obtenerRegion } from '../data/locations.data.js';
import { obtenerFaccion } from '../data/factions.data.js';
import { SOCIAL } from '../config/balance.config.js';

/** Eventos publicados. */
export const EVENTOS_DIALOGO = Object.freeze({
  INFORMACION: 'dialogue:info',
  REVELACION: 'dialogue:reveal',
  RECHAZO: 'dialogue:refused',
  PERSUASION: 'dialogue:persuasion',
});

/* ═══════════════════════════════════════════════════════════════════════════
   TIPOS DE PETICIÓN
   ---------------------------------------------------------------------------
   Cada uno declara su dificultad base y el umbral de actitud por debajo del
   cual es directamente imposible. Pedirle a alguien que te odia que arriesgue
   la vida por ti no es una tirada difícil: es un no.
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * @typedef {Object} TipoPeticion
 * @property {string} nombre
 * @property {string} umbralBase Dificultad de la prueba.
 * @property {number} actitudMinima Por debajo, imposible.
 * @property {string} rechazo Qué se narra cuando es imposible.
 */

/** @type {Record<string, TipoPeticion>} */
export const PETICIONES = Object.freeze({
  informacion_general: {
    nombre: 'información corriente',
    umbralBase: 'facil',
    actitudMinima: -40,
    rechazo: 'No tiene ninguna gana de hablar contigo.',
  },
  rumor: {
    nombre: 'un rumor',
    umbralBase: 'facil',
    actitudMinima: -25,
    rechazo: 'Te mira y sigue a lo suyo.',
  },
  direcciones: {
    nombre: 'indicaciones',
    umbralBase: 'facil',
    actitudMinima: -50,
    rechazo: 'Señala vagamente en una dirección cualquiera.',
  },
  secreto: {
    nombre: 'algo que no cuenta a cualquiera',
    umbralBase: 'ardua',
    actitudMinima: 30,
    rechazo: 'Eso no te lo va a contar. No a ti, al menos todavía.',
  },
  favor_menor: {
    nombre: 'un favor pequeño',
    umbralBase: 'moderada',
    actitudMinima: -10,
    rechazo: 'No está para hacerte favores.',
  },
  favor_mayor: {
    nombre: 'un favor importante',
    umbralBase: 'dificil',
    actitudMinima: 25,
    rechazo: 'Ni lo sueñes. No os conocéis tanto.',
  },
  descuento: {
    nombre: 'una rebaja',
    umbralBase: 'moderada',
    actitudMinima: -15,
    rechazo: 'El precio es el precio.',
  },
  acompanamiento: {
    nombre: 'que te acompañe',
    umbralBase: 'ardua',
    actitudMinima: 50,
    rechazo: 'Tiene su vida aquí. No se va a marchar contigo.',
  },
  traicionar_faccion: {
    nombre: 'que traicione a los suyos',
    umbralBase: 'legendaria',
    actitudMinima: 70,
    rechazo: 'Le has ofendido con solo insinuarlo.',
  },
  perdonar_deuda: {
    nombre: 'que olvide lo que le debes',
    umbralBase: 'dificil',
    actitudMinima: 40,
    rechazo: 'Una deuda es una deuda.',
  },
});

export class DialogueSystem extends SystemBase {
  static nombre = 'dialogue';
  static dependencias = ['npcs', 'rules', 'relationships'];
  static canal = 'npc';

  /* ═══════════════════════════════════════════════════════════════════════
     CICLO DE VIDA
     ═══════════════════════════════════════════════════════════════════════ */

  alIniciar() {
    // El enrutador delega aquí las intenciones sociales.
    this.escuchar('dialogue:request', (peticion) => this.resolver(peticion));
  }

  /* ═══════════════════════════════════════════════════════════════════════
     RESOLUCIÓN
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Resuelve una petición social a un PNJ.
   *
   * @param {Object} peticion
   * @param {string} [peticion.refId] PNJ objetivo; si falta, el primero presente.
   * @param {string} peticion.tipo Clave de PETICIONES.
   * @param {Object} [peticion.intencion] Intención interpretada.
   * @param {number} [peticion.bonoExtra]
   * @returns {{
   *   resuelto: boolean, exito: boolean, imposible: boolean,
   *   motivo: string|null, tirada: Object|null, resultado: Object|null,
   *   pistaDirector: string|null
   * }}
   */
  resolver(peticion) {
    const npcs = this.sistema('npcs');
    const npc = peticion.refId
      ? npcs?.obtener(peticion.refId)
      : npcs?.presentes()[0];

    if (!npc) {
      return {
        resuelto: false, exito: false, imposible: true,
        motivo: 'No hay nadie con quien hablar.',
        tirada: null, resultado: null, pistaDirector: null,
      };
    }

    const tipo = PETICIONES[peticion.tipo] ?? PETICIONES.informacion_general;

    // ─── Actitud efectiva ───────────────────────────────────────────────
    const efectiva = N.actitudEfectiva(npc, this.leer('factions.reputacion', {}));

    // ─── ¿Es imposible de entrada? ──────────────────────────────────────
    if (efectiva.valor < tipo.actitudMinima) {
      this.emitir(EVENTOS_DIALOGO.RECHAZO, {
        refId: npc.refId, nombre: npc.nombre, tipo: peticion.tipo,
      });

      return {
        resuelto: true, exito: false, imposible: true,
        motivo: tipo.rechazo,
        tirada: null, resultado: null,
        pistaDirector: `${npc.nombre} se niega en redondo: ${tipo.rechazo} No hagas que ceda.`,
      };
    }

    // ─── Tirada ─────────────────────────────────────────────────────────
    const habilidad = this._habilidadPara(peticion.intencion);
    const modificadores = this._modificadores(npc, efectiva, peticion);

    const rules = this.sistema('rules');
    const tirada = rules.resolver({
      habilidad,
      umbral: tipo.umbralBase,
      bonoExtra: modificadores.total + (peticion.bonoExtra ?? 0),
      fuenteExtra: modificadores.principal,
      aplicarMoral: true,
    });

    this.emitir(EVENTOS_DIALOGO.PERSUASION, {
      refId: npc.refId,
      nombre: npc.nombre,
      tipo: peticion.tipo,
      exito: tirada.exito,
      desglose: modificadores.desglose,
    });

    // ─── Consecuencias ──────────────────────────────────────────────────
    if (!tirada.exito) {
      // Insistir y fallar desgasta, sobre todo si se intimidó.
      if (peticion.intencion?.tipo === 'intimidate') {
        this.sistema('relationships')?.aplicarAccion(npc.refId, 'amenazar');
      }

      return {
        resuelto: true, exito: false, imposible: false,
        motivo: null, tirada, resultado: null,
        pistaDirector: `${npc.nombre} no accede a ${tipo.nombre}. Narra su negativa según su carácter.`,
      };
    }

    // ─── Éxito: se resuelve según el tipo ───────────────────────────────
    const resultado = this._aplicarExito(npc, peticion.tipo, tirada);

    return {
      resuelto: true, exito: true, imposible: false,
      motivo: null, tirada, resultado,
      pistaDirector: resultado?.pista ?? `${npc.nombre} accede a ${tipo.nombre}.`,
    };
  }

  /**
   * Modificadores a la tirada social.
   *
   * La actitud del PNJ es el factor dominante, y con razón: convencer a un
   * amigo de algo no debería ser tan difícil como convencer a un desconocido.
   *
   * @private
   */
  _modificadores(npc, efectiva, peticion) {
    const desglose = [];

    // ─── Actitud ────────────────────────────────────────────────────────
    // Cada 20 puntos de actitud valen 1 al modificador.
    const porActitud = Math.round(efectiva.valor / 20);
    if (porActitud !== 0) {
      desglose.push({ fuente: `Actitud (${efectiva.actitud.nombre})`, valor: porActitud });
    }

    // ─── Historia compartida ────────────────────────────────────────────
    // Conocerse ayuda, pero con rendimientos decrecientes.
    const porEncuentros = Math.min(2, Math.floor(npc.encuentros / 3));
    if (porEncuentros > 0) {
      desglose.push({ fuente: 'Os conocéis', valor: porEncuentros });
    }

    // ─── Deudas pendientes ──────────────────────────────────────────────
    // Deberle algo a alguien resta autoridad para pedirle más.
    const pendientes = N.pendientes(npc).length;
    if (pendientes > 0) {
      desglose.push({ fuente: 'Le debes cosas', valor: -pendientes * 2 });
    }

    // ─── Carácter del PNJ ───────────────────────────────────────────────
    // A alguien codicioso se le convence peor con palabras.
    if (peticion.intencion?.tipo === 'persuade' && npc.rasgos.codicia > 0.7) {
      desglose.push({ fuente: 'Solo entiende de dinero', valor: -2 });
    }

    // Intimidar a un cobarde funciona; a un valiente, no.
    if (peticion.intencion?.tipo === 'intimidate') {
      const porValentia = npc.rasgos.valentia < 0.35 ? 3
        : npc.rasgos.valentia > 0.7 ? -3
        : 0;

      if (porValentia !== 0) {
        desglose.push({
          fuente: porValentia > 0 ? 'Se asusta con facilidad' : 'No se deja intimidar',
          valor: porValentia,
        });
      }
    }

    // Engañar a alguien perspicaz es más difícil.
    if (peticion.intencion?.tipo === 'deceive' && npc.rasgos.honestidad > 0.75) {
      desglose.push({ fuente: 'Detecta las mentiras', valor: -2 });
    }

    const total = desglose.reduce((a, m) => a + m.valor, 0);
    const principal = [...desglose].sort((a, b) => Math.abs(b.valor) - Math.abs(a.valor))[0];

    return { desglose, total, principal: principal?.fuente ?? 'Trato' };
  }

  /**
   * Habilidad que corresponde a una intención social.
   * @private
   */
  _habilidadPara(intencion) {
    const mapa = {
      persuade: 'trato_social',
      intimidate: 'intimidacion',
      deceive: 'engano',
      negotiate: 'trato_social',
      talk: 'trato_social',
    };

    return mapa[intencion?.tipo] ?? 'trato_social';
  }

  /* ═══════════════════════════════════════════════════════════════════════
     APLICACIÓN DEL ÉXITO
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Aplica el resultado de una petición conseguida.
   * @private
   */
  _aplicarExito(npc, tipo, tirada) {
    switch (tipo) {
      case 'rumor':
      case 'informacion_general':
        return this._darInformacion(npc, tirada);

      case 'direcciones':
        return this._darDirecciones(npc);

      case 'secreto':
        return this._darSecreto(npc);

      case 'descuento': {
        // El margen de la tirada determina cuánto se rebaja.
        const rebaja = Math.min(0.25, 0.05 + (tirada.margen ?? 0) * 0.02);
        this.emitir('trade:discount', { refId: npc.refId, rebaja });

        return {
          tipo: 'descuento',
          rebaja,
          pista: `${npc.nombre} accede a rebajar el precio un ${Math.round(rebaja * 100)} %.`,
        };
      }

      case 'perdonar_deuda': {
        const pendiente = N.pendientes(npc)[0];
        if (pendiente) {
          this.sistema('relationships')?.resolverCompromiso(npc.refId, pendiente.id, true);
        }
        return {
          tipo: 'deuda_perdonada',
          pista: `${npc.nombre} da por saldado lo que le debías.`,
        };
      }

      default:
        return {
          tipo,
          pista: `${npc.nombre} accede a lo que le pides.`,
        };
    }
  }

  /**
   * El PNJ comparte lo que sabe.
   *
   * La información sale de su conocimiento declarado, no de la improvisación
   * del modelo. Si no sabe nada nuevo, se dice, en vez de inventar.
   *
   * @private
   */
  _darInformacion(npc, tirada) {
    const npcs = this.sistema('npcs');
    const disponible = N.puedeContar(npc);

    // ─── Rumor ──────────────────────────────────────────────────────────
    if (disponible.rumores.length) {
      const rumor = this.rng.flujo('npc').elegir(disponible.rumores);

      const actualizado = N.marcarCompartido(npc, rumor);
      this.despachar('npc/registrar', { npc: actualizado });

      this.emitir(EVENTOS_DIALOGO.INFORMACION, {
        refId: npc.refId, clase: 'rumor', contenido: rumor,
      });

      this.emitir('memory:remember', { texto: `${npc.nombre} contó: ${rumor}`, peso: 2 });

      return {
        tipo: 'rumor',
        contenido: rumor,
        pista: `${npc.nombre} cuenta esto, con sus propias palabras: «${rumor}»`,
      };
    }

    // ─── Sin nada nuevo ─────────────────────────────────────────────────
    // Decirlo es mejor que dejar que el director invente algo incoherente.
    const region = obtenerRegion(this.leer('world.region'));

    return {
      tipo: 'nada_nuevo',
      pista: `${npc.nombre} no sabe nada que el personaje no sepa ya. Que hable de su día a día o de ${region?.nombre ?? 'la región'}, sin revelar nada concreto.`,
    };
  }

  /**
   * El PNJ revela la ubicación de un lugar.
   *
   * Y ese lugar aparece de verdad en el mapa. Es la vía por la que hablar con
   * la gente se convierte en exploración.
   *
   * @private
   */
  _darDirecciones(npc) {
    const disponible = N.puedeContar(npc);
    const conocidos = new Set(this.leer('world.localizaciones.orden', []));

    const nuevos = disponible.lugares.filter((refId) => !conocidos.has(refId));

    if (!nuevos.length) {
      return {
        tipo: 'sin_lugares',
        pista: `${npc.nombre} solo conoce sitios que el personaje ya tiene en el mapa.`,
      };
    }

    const refId = this.rng.flujo('npc').elegir(nuevos);
    const lugar = obtenerLugar(refId);

    // Se descubre de verdad.
    this.despachar('world/descubrir', { refId, motivo: `indicaciones de ${npc.nombre}` });

    const actualizado = N.marcarCompartido(npc, refId);
    this.despachar('npc/registrar', { npc: actualizado });

    this.emitir(EVENTOS_DIALOGO.REVELACION, {
      refId: npc.refId, clase: 'lugar', lugar: refId, nombre: lugar?.nombre,
    });

    return {
      tipo: 'lugar_revelado',
      lugar: refId,
      nombre: lugar?.nombre,
      pista: `${npc.nombre} explica cómo llegar a ${lugar?.nombre}. Ya está en el mapa del personaje.`,
    };
  }

  /**
   * El PNJ comparte un secreto.
   *
   * Los secretos son ganchos de lugar: al revelarse abren un hilo narrativo que
   * el director puede convertir en misión.
   *
   * @private
   */
  _darSecreto(npc) {
    const disponible = N.puedeContar(npc);

    if (!disponible.secretos.length) {
      return {
        tipo: 'sin_secretos',
        pista: `${npc.nombre} confía en el personaje, pero no guarda ningún secreto que contarle.`,
      };
    }

    const secreto = this.rng.flujo('npc').elegir(disponible.secretos);

    const actualizado = N.marcarCompartido(npc, secreto);
    this.despachar('npc/registrar', { npc: actualizado });

    this.emitir(EVENTOS_DIALOGO.REVELACION, {
      refId: npc.refId, clase: 'secreto', contenido: secreto,
    });

    // Un secreto revelado es un hilo abierto.
    this.emitir('memory:thread', {
      tipo: 'misterio',
      texto: secreto,
      relacionadoCon: npc.refId,
    });

    this.emitir('memory:remember', {
      texto: `${npc.nombre} le confió un secreto: ${secreto}`,
      peso: 3,
    });

    return {
      tipo: 'secreto',
      contenido: secreto,
      pista: `${npc.nombre} baja la voz y cuenta esto: «${secreto}». Que se note que le cuesta.`,
    };
  }

  /* ═══════════════════════════════════════════════════════════════════════
     DEDUCCIÓN DEL TIPO DE PETICIÓN
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Deduce qué está pidiendo el jugador a partir de su texto.
   *
   * @param {string} texto
   * @param {Object} [intencion]
   * @returns {string} Clave de PETICIONES.
   */
  deducirPeticion(texto, intencion) {
    const t = (texto ?? '').toLowerCase();

    const patrones = [
      [/secreto|confianza|no le cuentes|entre nosotros|de verdad/, 'secreto'],
      [/dónde|donde|cómo llego|camino|ruta|indicac/, 'direcciones'],
      [/rumor|se dice|has oído|noticia|qué se cuenta/, 'rumor'],
      [/rebaja|descuento|más barato|precio|regate/, 'descuento'],
      [/acompáñ|ven conmigo|únete|vente/, 'acompanamiento'],
      [/perdona.*deuda|olvida.*debo|salda/, 'perdonar_deuda'],
      [/traiciona|delata|en contra de los tuyos/, 'traicionar_faccion'],
      [/necesito que|hazme el favor|ayúdame a|podrías/, 'favor_mayor'],
      [/pásame|dame|préstame|un momento/, 'favor_menor'],
    ];

    for (const [patron, tipo] of patrones) {
      if (patron.test(t)) return tipo;
    }

    // Sin pistas, se asume información general.
    return intencion?.tipo === 'negotiate' ? 'descuento' : 'informacion_general';
  }

  /* ═══════════════════════════════════════════════════════════════════════
     CONTEXTO
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Contexto de diálogo para el director.
   *
   * Le dice qué puede contar cada presente, para que no invente información que
   * no existe en el mundo.
   *
   * @returns {string}
   */
  paraDirector() {
    const presentes = this.sistema('npcs')?.presentes() ?? [];
    if (!presentes.length) return '';

    const lineas = [];

    for (const npc of presentes) {
      const disponible = N.puedeContar(npc);
      const tiene = [];

      if (disponible.rumores.length) tiene.push('rumores de la región');
      if (disponible.lugares.length) tiene.push('la ubicación de un sitio');
      if (disponible.secretos.length) tiene.push('un secreto (solo si confía)');

      if (tiene.length) {
        lineas.push(`· ${npc.nombre} puede contar: ${tiene.join(', ')}.`);
      } else {
        lineas.push(`· ${npc.nombre} no tiene información nueva que dar.`);
      }
    }

    return `QUÉ SABEN:\n${lineas.join('\n')}\nNo inventes información que no esté aquí: si no saben nada, que no sepan nada.`;
  }
}

export default DialogueSystem;
