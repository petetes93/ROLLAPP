/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANUM · inventory/Item.js
 * ---------------------------------------------------------------------------
 * Modelo de una instancia de objeto.
 *
 * Distinción central del sistema: una PLANTILLA es la entrada del catálogo
 * («espada corta»); una INSTANCIA es el objeto concreto que llevas encima, con
 * su durabilidad, sus afijos y su historia.
 *
 * Dos espadas cortas del mismo catálogo pueden ser objetos radicalmente
 * distintos: una afilada y casi rota, otra rúnica y sin estrenar. Solo las
 * instancias idénticas y apilables se agrupan.
 *
 * Funciones puras: reciben y devuelven objetos planos, serializables sin más.
 *
 * Dependencias: items.data, Rarity, Durability, utils/id, utils/text.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { obtenerPlantilla } from '../data/items.data.js';
import * as Rareza from './Rarity.js';
import * as Durabilidad from './Durability.js';
import { idEntidad, TIPO } from '../utils/id.js';
import { articuloIndet } from '../utils/text.js';

/**
 * @typedef {Object} Instancia
 * @property {string} id Identificador único de esta instancia.
 * @property {string} refId Plantilla de la que procede.
 * @property {string} nombre Nombre compuesto con afijos.
 * @property {string} categoria
 * @property {string} rareza
 * @property {number} cantidad
 * @property {number} peso Peso unitario, ya modificado por afijos.
 * @property {number} valor Valor unitario final.
 * @property {number} [durabilidad]
 * @property {number} [durabilidadMax]
 * @property {string[]} afijos refIds de los afijos aplicados.
 * @property {boolean} equipado
 * @property {string} [ranura]
 * @property {Object} [origen] De dónde salió: botín, compra, inicio.
 */

/* ═══════════════════════════════════════════════════════════════════════════
   CREACIÓN
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Crea una instancia a partir de una plantilla del catálogo.
 *
 * @param {string} refId
 * @param {Object} [opciones]
 * @param {number} [opciones.cantidad=1]
 * @param {string} [opciones.rareza] Si se omite, la de la plantilla.
 * @param {Array<Object>} [opciones.afijos] Objetos afijo completos.
 * @param {number} [opciones.durabilidad] Valor inicial concreto.
 * @param {Object} [opciones.origen]
 * @returns {Instancia|null} null si la plantilla no existe.
 */
export function crear(refId, opciones = {}) {
  const plantilla = obtenerPlantilla(refId);
  if (!plantilla) return null;

  const rareza = opciones.rareza ?? plantilla.rareza ?? 'comun';
  const afijos = opciones.afijos ?? [];

  // Los afijos alteran peso y valor antes de fijarlos en la instancia.
  const efectos = Rareza.efectosDeAfijos(afijos);

  let peso = plantilla.peso ?? 0;
  for (const e of efectos.reduccionPeso ?? []) peso *= 1 - (e.valor ?? 0);

  const valor = Rareza.calcularValor(plantilla.valor ?? 0, rareza, afijos);

  let durabilidadMax = 100;
  for (const e of efectos.durabilidadExtra ?? []) durabilidadMax += e.valor ?? 0;

  const instancia = {
    id: idEntidad(TIPO.OBJETO),
    refId,
    nombre: Rareza.componerNombre(plantilla.nombre, afijos, plantilla.genero ?? 'm'),
    categoria: plantilla.categoria,
    subtipo: plantilla.subtipo ?? null,
    rareza,
    cantidad: Math.max(1, opciones.cantidad ?? 1),
    peso: Math.round(peso * 100) / 100,
    valor,
    afijos: afijos.map((a) => a.refId),
    equipado: false,
    ranura: plantilla.ranura ?? null,
    origen: opciones.origen ?? { tipo: 'desconocido' },
  };

  if (plantilla.tieneDurabilidad) {
    instancia.tieneDurabilidad = true;
    instancia.durabilidadMax = durabilidadMax;
    instancia.durabilidad = opciones.durabilidad
      ?? plantilla.durabilidadInicial
      ?? durabilidadMax;
  }

  return instancia;
}

/**
 * Crea varias instancias de una vez.
 * @param {Array<{refId: string, cantidad?: number}>} lista
 * @param {Object} [opciones] Aplicadas a todas.
 * @returns {Instancia[]}
 */
export function crearVarias(lista, opciones = {}) {
  return lista
    .map((e) => crear(e.refId, { ...opciones, cantidad: e.cantidad ?? 1 }))
    .filter(Boolean);
}

/* ═══════════════════════════════════════════════════════════════════════════
   CONSULTA
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Plantilla de una instancia.
 * @param {Instancia} instancia
 * @returns {Object|null}
 */
export function plantilla(instancia) {
  return obtenerPlantilla(instancia?.refId);
}

/**
 * Afijos completos de una instancia.
 * @param {Instancia} instancia
 * @returns {Array<Object>}
 */
export function afijos(instancia) {
  return (instancia?.afijos ?? [])
    .map((refId) => Rareza.AFIJOS[refId])
    .filter(Boolean);
}

/**
 * Peso total de una pila.
 * @param {Instancia} instancia
 * @returns {number}
 */
export function pesoTotal(instancia) {
  return Math.round((instancia?.peso ?? 0) * (instancia?.cantidad ?? 1) * 100) / 100;
}

/**
 * Valor total de una pila, ajustado por su estado de conservación.
 * Un objeto medio roto vale menos, y el mercader lo sabe.
 *
 * @param {Instancia} instancia
 * @returns {number}
 */
export function valorTotal(instancia) {
  const base = (instancia?.valor ?? 0) * (instancia?.cantidad ?? 1);
  if (!instancia?.tieneDurabilidad) return base;

  const fraccion = (instancia.durabilidad ?? 100) / (instancia.durabilidadMax ?? 100);
  // Nunca baja del 20 %: hasta un objeto roto tiene valor como chatarra.
  return Math.round(base * Math.max(0.2, fraccion));
}

/**
 * Comprueba si dos instancias pueden apilarse.
 *
 * Solo se apila lo idéntico: misma plantilla, misma rareza, mismos afijos y sin
 * durabilidad. Dos pociones sí; dos espadas con desgaste distinto, no.
 *
 * @param {Instancia} a
 * @param {Instancia} b
 * @returns {boolean}
 */
export function apilables(a, b) {
  if (!a || !b) return false;
  if (a.refId !== b.refId) return false;
  if (a.rareza !== b.rareza) return false;
  if (a.equipado || b.equipado) return false;

  const p = obtenerPlantilla(a.refId);
  if (!p?.apilable) return false;

  // Los objetos con durabilidad nunca se apilan: cada uno tiene su historia.
  if (a.tieneDurabilidad || b.tieneDurabilidad) return false;

  const afA = [...(a.afijos ?? [])].sort().join(',');
  const afB = [...(b.afijos ?? [])].sort().join(',');
  return afA === afB;
}

/**
 * Tamaño máximo de pila de un objeto.
 * @param {Instancia} instancia
 * @returns {number}
 */
export function pilaMaxima(instancia) {
  const p = obtenerPlantilla(instancia?.refId);
  if (!p?.apilable) return 1;
  return p.pilaMax ?? 20;
}

/* ═══════════════════════════════════════════════════════════════════════════
   ESTADÍSTICAS EFECTIVAS
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Estadísticas de combate de un objeto, con afijos y desgaste aplicados.
 *
 * Es lo que consulta CombatManager: no necesita saber nada de afijos ni de
 * durabilidad, solo pedir aquí los números finales.
 *
 * @param {Instancia} instancia
 * @returns {Object}
 */
export function estadisticas(instancia) {
  const p = plantilla(instancia);
  if (!p) return {};

  const efectos = Rareza.efectosDeAfijos(afijos(instancia));
  const penalizacion = Durabilidad.penalizacion(instancia);
  const roto = Durabilidad.estaRoto(instancia);

  const salida = {
    roto,
    penalizacionDesgaste: penalizacion,
    propiedades: p.propiedades ?? [],
  };

  // — Arma —
  if (p.dano) {
    salida.dano = { ...p.dano };
    salida.bonoDano = (p.bonoDano ?? 0) + _sumar(efectos.bonoDano) + penalizacion;
    salida.bonoAtaque = (p.bonoAtaque ?? 0) + _sumar(efectos.bonoAtaque) + penalizacion;
    salida.danoVersatil = p.danoVersatil ?? null;
    salida.municion = p.municion ?? null;

    if (efectos.danoElemental?.length) {
      salida.danoElemental = efectos.danoElemental.map((e) => ({
        elemento: e.elemento, notacion: e.notacion,
      }));
    }
    if (efectos.criticoAmpliado?.length) {
      salida.umbralCritico = Math.min(...efectos.criticoAmpliado.map((e) => e.umbral));
    }
    if (efectos.robarVida?.length) {
      salida.robarVida = Math.max(...efectos.robarVida.map((e) => e.fraccion));
    }
    if (efectos.estadoAlImpactar?.length) {
      salida.estadosAlImpactar = efectos.estadoAlImpactar;
    }
  }

  // — Armadura o escudo —
  if (p.armadura) {
    salida.defensa = (p.armadura.defensa ?? 0) + _sumar(efectos.bonoDefensa) + penalizacion;
    salida.reduccion = (p.armadura.reduccion ?? 0) + _sumar(efectos.bonoReduccion) + _sumar(efectos.reduccionDano);
  }

  // — Bonificadores generales —
  if (efectos.bonoAtributo?.length) {
    salida.bonosAtributo = {};
    for (const e of efectos.bonoAtributo) {
      salida.bonosAtributo[e.atributo] = (salida.bonosAtributo[e.atributo] ?? 0) + e.valor;
    }
  }

  const bonosHabilidad = {};
  if (p.efecto?.tipo === 'bonoHabilidad') {
    bonosHabilidad[p.efecto.habilidad] = p.efecto.valor;
  }
  for (const e of efectos.bonoHabilidad ?? []) {
    bonosHabilidad[e.habilidad] = (bonosHabilidad[e.habilidad] ?? 0) + e.valor;
  }
  if (Object.keys(bonosHabilidad).length) salida.bonosHabilidad = bonosHabilidad;

  if (p.efecto?.tipo === 'bonoLanzamiento' || efectos.bonoLanzamiento?.length) {
    salida.bonoLanzamiento = (p.efecto?.valor ?? 0) + _sumar(efectos.bonoLanzamiento);
  }

  if (efectos.esquivaExtra?.length) salida.esquivaExtra = _sumar(efectos.esquivaExtra);
  if (efectos.reduccionFatiga?.length) salida.reduccionFatiga = _sumar(efectos.reduccionFatiga);
  if (efectos.malicion?.length) salida.malicion = efectos.malicion[0];

  return salida;
}

/**
 * @param {Array<Object>} lista
 * @returns {number}
 * @private
 */
function _sumar(lista) {
  return (lista ?? []).reduce((a, e) => a + (Number(e.valor) || 0), 0);
}

/* ═══════════════════════════════════════════════════════════════════════════
   CONSUMO
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * @param {Instancia} instancia
 * @returns {boolean}
 */
export function esConsumible(instancia) {
  return plantilla(instancia)?.categoria === 'consumible';
}

/**
 * @param {Instancia} instancia
 * @returns {boolean}
 */
export function esEquipable(instancia) {
  return Boolean(plantilla(instancia)?.ranura);
}

/**
 * Efecto que produce consumir un objeto.
 * @param {Instancia} instancia
 * @returns {Object|null}
 */
export function efectoConsumo(instancia) {
  const p = plantilla(instancia);
  if (p?.categoria !== 'consumible') return null;
  return p.efecto ?? null;
}

/* ═══════════════════════════════════════════════════════════════════════════
   PRESENTACIÓN
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Nombre con cantidad, para listas y avisos.
 * @param {Instancia} instancia
 * @returns {string} 'Poción de curación ×3'
 */
export function nombreConCantidad(instancia) {
  const c = instancia?.cantidad ?? 1;
  return c > 1 ? `${instancia.nombre} ×${c}` : instancia?.nombre ?? '';
}

/**
 * Mención narrativa con artículo concordado, para la bitácora.
 * @param {Instancia} instancia
 * @returns {string} 'una espada corta afilada'
 */
export function mencion(instancia) {
  const p = plantilla(instancia);
  const genero = p?.genero ?? 'm';
  const c = instancia?.cantidad ?? 1;

  if (c > 1) return `${c} ${instancia.nombre.toLowerCase()}`;
  return `${articuloIndet(instancia.nombre, genero)} ${instancia.nombre.toLowerCase()}`;
}

/**
 * Ficha completa del objeto, para el tooltip.
 * @param {Instancia} instancia
 * @returns {Object}
 */
export function ficha(instancia) {
  const p = plantilla(instancia);
  const stats = estadisticas(instancia);
  const dur = Durabilidad.paraInterfaz(instancia);

  return {
    nombre: instancia.nombre,
    categoria: p?.categoria ?? '',
    subtipo: p?.subtipo ?? null,
    rareza: instancia.rareza,
    metaRareza: Rareza.meta(instancia.rareza),
    descripcion: p?.descripcion ?? '',
    peso: pesoTotal(instancia),
    valor: valorTotal(instancia),
    durabilidad: dur,
    estadisticas: stats,
    afijos: Rareza.describirAfijos(afijos(instancia)),
    equipado: instancia.equipado,
    ranura: instancia.ranura,
    irreemplazable: p?.propiedades?.includes('irreemplazable') ?? false,
    ilegal: p?.propiedades?.includes('ilegal') ?? false,
  };
}

/**
 * Descripción del objeto para el prompt del director.
 * Solo se envían los que llevan carga narrativa o son notables por su rareza.
 *
 * @param {Instancia} instancia
 * @returns {string|null}
 */
export function paraDirector(instancia) {
  const p = plantilla(instancia);
  if (!p) return null;

  const notable = p.promptLore
    || Rareza.indice(instancia.rareza) >= 3
    || p.propiedades?.includes('irreemplazable');

  if (!notable) return null;

  const partes = [instancia.nombre];
  if (p.promptLore) partes.push(p.promptLore);
  if (Durabilidad.estaRoto(instancia)) partes.push('(está roto)');

  return partes.join('. ');
}

export default {
  crear,
  crearVarias,
  plantilla,
  afijos,
  pesoTotal,
  valorTotal,
  apilables,
  pilaMaxima,
  estadisticas,
  esConsumible,
  esEquipable,
  efectoConsumo,
  nombreConCantidad,
  mencion,
  ficha,
  paraDirector,
};
