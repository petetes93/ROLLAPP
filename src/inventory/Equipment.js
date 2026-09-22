/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANVEIL · inventory/Equipment.js
 * ---------------------------------------------------------------------------
 * Ranuras de equipo y bonificadores derivados.
 *
 * Once ranuras. La lógica interesante está en las reglas de ocupación: un arma
 * a dos manos bloquea la mano secundaria, y un escudo bloquea el arma a dos
 * manos. Equipar algo puede desequipar otra cosa, y eso se avisa antes de
 * hacerlo.
 *
 * `bonificadores` es la función que consulta el resto del motor: reúne defensa,
 * reducción, bonos de atributo y de habilidad de todo lo equipado, ya con el
 * desgaste aplicado.
 *
 * Funciones puras.
 *
 * Dependencias: config/balance.config.js, Item, Durability.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { OBJETOS } from '../config/balance.config.js';
import * as Item from './Item.js';
import * as Durabilidad from './Durability.js';

/* ═══════════════════════════════════════════════════════════════════════════
   METADATOS DE RANURAS
   ═══════════════════════════════════════════════════════════════════════════ */

/** Información de cada ranura. */
export const META_RANURAS = Object.freeze({
  cabeza: { nombre: 'Cabeza', orden: 1, categorias: ['armadura'] },
  torso: { nombre: 'Torso', orden: 2, categorias: ['armadura'] },
  manos: { nombre: 'Manos', orden: 3, categorias: ['armadura'] },
  piernas: { nombre: 'Piernas', orden: 4, categorias: ['armadura'] },
  pies: { nombre: 'Pies', orden: 5, categorias: ['armadura'] },
  capa: { nombre: 'Capa', orden: 6, categorias: ['armadura'] },
  armaPrincipal: { nombre: 'Mano principal', orden: 7, categorias: ['arma'] },
  armaSecundaria: { nombre: 'Mano secundaria', orden: 8, categorias: ['arma', 'escudo'] },
  amuleto: { nombre: 'Amuleto', orden: 9, categorias: ['magico'] },
  anillo1: { nombre: 'Anillo I', orden: 10, categorias: ['magico'] },
  anillo2: { nombre: 'Anillo II', orden: 11, categorias: ['magico'] },
});

/**
 * Ranuras equivalentes: un anillo vale para cualquiera de las dos ranuras.
 * @param {string} ranura
 * @returns {string[]}
 */
export function ranurasEquivalentes(ranura) {
  if (ranura === 'anillo1' || ranura === 'anillo2') return ['anillo1', 'anillo2'];
  return [ranura];
}

/* ═══════════════════════════════════════════════════════════════════════════
   REGLAS DE OCUPACIÓN
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Comprueba si un objeto puede equiparse y qué habría que quitar.
 *
 * @param {Object} inventario
 * @param {Object} objeto
 * @param {string} [ranuraDeseada]
 * @returns {{
 *   puede: boolean, ranura: string|null, aDesequipar: string[],
 *   motivo: string|null, aviso: string|null
 * }}
 */
export function puedeEquipar(inventario, objeto, ranuraDeseada) {
  if (!objeto) return { puede: false, ranura: null, aDesequipar: [], motivo: 'Objeto inexistente', aviso: null };

  const plantilla = Item.plantilla(objeto);
  if (!plantilla?.ranura) {
    return { puede: false, ranura: null, aDesequipar: [], motivo: 'Ese objeto no se equipa', aviso: null };
  }

  if (Durabilidad.estaRoto(objeto)) {
    return { puede: false, ranura: null, aDesequipar: [], motivo: 'Está roto: hay que repararlo primero', aviso: null };
  }

  // — Elegir ranura —
  const equipado = inventario?.equipado ?? {};
  const candidatas = ranurasEquivalentes(ranuraDeseada ?? plantilla.ranura);

  // Si hay varias equivalentes, se prefiere una libre.
  let ranura = candidatas.find((r) => !equipado[r]) ?? candidatas[0];

  const aDesequipar = [];
  let aviso = null;

  // — La ranura elegida ya está ocupada —
  if (equipado[ranura]) {
    aDesequipar.push(ranura);
  }

  const propiedades = plantilla.propiedades ?? [];
  const objetos = inventario?.objetos?.porId ?? {};

  // — Un arma a dos manos ocupa también la secundaria —
  if (propiedades.includes('dosManos') && ranura === 'armaPrincipal') {
    if (equipado.armaSecundaria) {
      aDesequipar.push('armaSecundaria');
      const otro = objetos[equipado.armaSecundaria];
      aviso = `Necesitas las dos manos: soltarás ${otro?.nombre ?? 'lo que llevas en la otra mano'}`;
    }
  }

  // — Equipar en la secundaria obliga a soltar un arma a dos manos —
  if (ranura === 'armaSecundaria' && equipado.armaPrincipal) {
    const principal = objetos[equipado.armaPrincipal];
    const plantillaPrincipal = principal ? Item.plantilla(principal) : null;

    if (plantillaPrincipal?.propiedades?.includes('dosManos')) {
      aDesequipar.push('armaPrincipal');
      aviso = `Soltarás ${principal.nombre}: necesita las dos manos`;
    }
  }

  return {
    puede: true,
    ranura,
    aDesequipar: [...new Set(aDesequipar)],
    motivo: null,
    aviso,
  };
}

/**
 * Equipa un objeto, devolviendo el mapa de equipo resultante.
 *
 * No muta: devuelve los cambios para que Inventory los aplique como parche.
 *
 * @param {Object} inventario
 * @param {string} idObjeto
 * @param {string} [ranuraDeseada]
 * @returns {{
 *   exito: boolean, equipado: Object|null, desequipados: string[],
 *   ranura: string|null, motivo: string|null, aviso: string|null
 * }}
 */
export function equipar(inventario, idObjeto, ranuraDeseada) {
  const objeto = inventario?.objetos?.porId?.[idObjeto];
  if (!objeto) {
    return { exito: false, equipado: null, desequipados: [], ranura: null, motivo: 'No tienes ese objeto', aviso: null };
  }

  const check = puedeEquipar(inventario, objeto, ranuraDeseada);
  if (!check.puede) {
    return { exito: false, equipado: null, desequipados: [], ranura: null, motivo: check.motivo, aviso: null };
  }

  const nuevoEquipado = { ...(inventario.equipado ?? {}) };
  const desequipados = [];

  for (const r of check.aDesequipar) {
    if (nuevoEquipado[r]) {
      desequipados.push(nuevoEquipado[r]);
      nuevoEquipado[r] = null;
    }
  }

  nuevoEquipado[check.ranura] = idObjeto;

  return {
    exito: true,
    equipado: nuevoEquipado,
    desequipados,
    ranura: check.ranura,
    motivo: null,
    aviso: check.aviso,
  };
}

/**
 * Desequipa lo que hay en una ranura.
 *
 * @param {Object} inventario
 * @param {string} ranura
 * @returns {{exito: boolean, equipado: Object|null, idObjeto: string|null}}
 */
export function desequipar(inventario, ranura) {
  const actual = inventario?.equipado?.[ranura];
  if (!actual) return { exito: false, equipado: null, idObjeto: null };

  const nuevoEquipado = { ...(inventario.equipado ?? {}) };
  nuevoEquipado[ranura] = null;

  return { exito: true, equipado: nuevoEquipado, idObjeto: actual };
}

/* ═══════════════════════════════════════════════════════════════════════════
   BONIFICADORES
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Reúne todos los bonificadores del equipo actual.
 *
 * Punto único de consulta para combate y reglas: nadie más tiene que recorrer
 * las ranuras ni preocuparse por el desgaste.
 *
 * @param {Object} inventario
 * @returns {{
 *   defensa: number, reduccion: number, esquivaExtra: number,
 *   atributos: Record<string, number>, habilidades: Record<string, number>,
 *   lanzamiento: number, reduccionFatiga: number,
 *   armaPrincipal: Object|null, armaSecundaria: Object|null,
 *   penalizaSigilo: boolean, ruidoso: boolean, malditos: Array<Object>
 * }}
 */
export function bonificadores(inventario) {
  const salida = {
    defensa: 0,
    reduccion: 0,
    esquivaExtra: 0,
    atributos: {},
    habilidades: {},
    lanzamiento: 0,
    reduccionFatiga: 0,
    armaPrincipal: null,
    armaSecundaria: null,
    penalizaSigilo: false,
    ruidoso: false,
    malditos: [],
  };

  const equipado = inventario?.equipado ?? {};
  const objetos = inventario?.objetos?.porId ?? {};

  for (const [ranura, idObjeto] of Object.entries(equipado)) {
    if (!idObjeto) continue;

    const objeto = objetos[idObjeto];
    if (!objeto) continue;

    // Un objeto roto no aporta nada, aunque siga en la ranura.
    if (Durabilidad.estaRoto(objeto)) continue;

    const stats = Item.estadisticas(objeto);

    salida.defensa += stats.defensa ?? 0;
    salida.reduccion += stats.reduccion ?? 0;
    salida.esquivaExtra += stats.esquivaExtra ?? 0;
    salida.lanzamiento += stats.bonoLanzamiento ?? 0;
    salida.reduccionFatiga += stats.reduccionFatiga ?? 0;

    for (const [clave, valor] of Object.entries(stats.bonosAtributo ?? {})) {
      salida.atributos[clave] = (salida.atributos[clave] ?? 0) + valor;
    }
    for (const [clave, valor] of Object.entries(stats.bonosHabilidad ?? {})) {
      salida.habilidades[clave] = (salida.habilidades[clave] ?? 0) + valor;
    }

    const propiedades = stats.propiedades ?? [];
    if (propiedades.includes('penalizaSigilo')) salida.penalizaSigilo = true;
    if (propiedades.includes('ruidosa')) salida.ruidoso = true;

    if (stats.malicion) salida.malditos.push({ objeto, malicion: stats.malicion });

    if (ranura === 'armaPrincipal') salida.armaPrincipal = { objeto, stats };
    if (ranura === 'armaSecundaria') salida.armaSecundaria = { objeto, stats };
  }

  // Llevar armadura pesada estorba al sigilo, y eso se refleja como penalización.
  if (salida.penalizaSigilo) {
    salida.habilidades.sigilo = (salida.habilidades.sigilo ?? 0) - 2;
  }

  return salida;
}

/**
 * Arma con la que se ataca ahora mismo.
 *
 * Si no hay nada equipado, devuelve los datos del puño: nunca se queda uno sin
 * poder atacar, solo sin poder atacar bien.
 *
 * @param {Object} inventario
 * @returns {{objeto: Object|null, stats: Object, desarmado: boolean}}
 */
export function armaActiva(inventario) {
  const b = bonificadores(inventario);

  if (b.armaPrincipal) return { ...b.armaPrincipal, desarmado: false };

  return {
    objeto: null,
    desarmado: true,
    stats: {
      dano: { notacion: '1d3', tipo: 'contundente' },
      bonoAtaque: 0,
      bonoDano: 0,
      propiedades: ['desarmado'],
    },
  };
}

/**
 * Comprueba si hay munición para el arma equipada.
 *
 * @param {Object} inventario
 * @returns {{necesita: boolean, tiene: boolean, refId: string|null, cantidad: number}}
 */
export function comprobarMunicion(inventario) {
  const arma = armaActiva(inventario);
  const refIdMunicion = arma.stats?.municion;

  if (!refIdMunicion) return { necesita: false, tiene: true, refId: null, cantidad: 0 };

  const objetos = Object.values(inventario?.objetos?.porId ?? {});
  const pila = objetos.find((o) => o.refId === refIdMunicion);

  return {
    necesita: true,
    tiene: Boolean(pila && pila.cantidad > 0),
    refId: refIdMunicion,
    cantidad: pila?.cantidad ?? 0,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   PRESENTACIÓN
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Estado de todas las ranuras, para EquipmentSlots.
 * @param {Object} inventario
 * @returns {Array<Object>}
 */
export function paraInterfaz(inventario) {
  const equipado = inventario?.equipado ?? {};
  const objetos = inventario?.objetos?.porId ?? {};

  return OBJETOS.ranurasEquipo.map((ranura) => {
    const idObjeto = equipado[ranura];
    const objeto = idObjeto ? objetos[idObjeto] : null;
    const meta = META_RANURAS[ranura] ?? { nombre: ranura, orden: 99 };

    return {
      ranura,
      nombre: meta.nombre,
      orden: meta.orden,
      ocupada: Boolean(objeto),
      objeto,
      idObjeto: idObjeto ?? null,
      roto: objeto ? Durabilidad.estaRoto(objeto) : false,
      rareza: objeto?.rareza ?? null,
    };
  }).sort((a, b) => a.orden - b.orden);
}

/**
 * Resumen del equipo para el prompt del director.
 *
 * Solo se mencionan las armas, la armadura de torso y lo notable. El director
 * no necesita saber que llevas botas.
 *
 * @param {Object} inventario
 * @returns {string}
 */
export function paraDirector(inventario) {
  const equipado = inventario?.equipado ?? {};
  const objetos = inventario?.objetos?.porId ?? {};
  const partes = [];

  const relevantes = ['armaPrincipal', 'armaSecundaria', 'torso', 'capa'];

  for (const ranura of relevantes) {
    const objeto = objetos[equipado[ranura]];
    if (!objeto) continue;

    let mencion = objeto.nombre;
    if (Durabilidad.estaRoto(objeto)) mencion += ' (roto)';
    partes.push(mencion);
  }

  if (!partes.length) return 'Va desarmado y sin protección.';
  return `Lleva: ${partes.join(', ')}.`;
}

export default {
  META_RANURAS,
  ranurasEquivalentes,
  puedeEquipar,
  equipar,
  desequipar,
  bonificadores,
  armaActiva,
  comprobarMunicion,
  paraInterfaz,
  paraDirector,
};
