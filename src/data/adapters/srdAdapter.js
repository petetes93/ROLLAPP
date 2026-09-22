/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANVEIL · data/adapters/srdAdapter.js
 * ---------------------------------------------------------------------------
 * Conversión de datos del SRD al Sistema Núcleo d20.
 *
 * Acepta los volcados JSON de 5e-bits y de Open5e, que tienen formatos
 * distintos, y produce entidades del motor. La detección de formato es
 * automática: no hay que decirle de dónde viene el archivo.
 *
 * Conversiones principales:
 *   · Atributos    STR/DEX/CON/INT/WIS/CHA → vigor/destreza/temple/intelecto/astucia/carisma
 *   · Clase de armadura → defensa + reducción de daño
 *   · Nivel de conjuro → coste en maná (progresión propia)
 *   · Desafío (CR)  → grado de amenaza del Núcleo d20
 *   · Rareza        → escala de siete grados del motor
 *
 * Toda entidad convertida conserva `_fuente: 'srd'` y `_original`, para poder
 * rastrear su procedencia y cumplir la atribución.
 *
 * Dependencias: config/balance.config.js, core/Logger, utils/text.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { PROGRESION, OBJETOS, COMBATE } from '../../config/balance.config.js';
import { crearCanal } from '../../core/Logger.js';
import { slug } from '../../utils/text.js';

const log = crearCanal('core');

/* ═══════════════════════════════════════════════════════════════════════════
   TABLAS DE CONVERSIÓN
   ═══════════════════════════════════════════════════════════════════════════ */

/** Atributos del SRD → atributos del Núcleo d20. */
export const MAPA_ATRIBUTOS = Object.freeze({
  strength: 'vigor',
  dexterity: 'destreza',
  constitution: 'temple',
  intelligence: 'intelecto',
  wisdom: 'astucia',
  charisma: 'carisma',
  str: 'vigor', dex: 'destreza', con: 'temple',
  int: 'intelecto', wis: 'astucia', cha: 'carisma',
});

/**
 * Desafío del SRD → grado de amenaza del motor.
 * La escala del SRD llega a 30; la nuestra tiene siete escalones, así que se
 * agrupa por tramos.
 */
export const MAPA_AMENAZA = Object.freeze([
  { hasta: 0.125, grado: 'insignificante' },
  { hasta: 0.5, grado: 'menor' },
  { hasta: 2, grado: 'normal' },
  { hasta: 5, grado: 'peligroso' },
  { hasta: 10, grado: 'letal' },
  { hasta: 16, grado: 'jefe' },
  { hasta: Infinity, grado: 'jefeMayor' },
]);

/** Rareza del SRD → rareza de siete grados del motor. */
export const MAPA_RAREZA = Object.freeze({
  common: 'comun',
  uncommon: 'fino',
  rare: 'superior',
  'very rare': 'arcano',
  legendary: 'legendario',
  artifact: 'mitico',
  varies: 'comun',
});

/**
 * Coste en maná por nivel de conjuro.
 * Progresión propia: no lineal, para que los conjuros altos sean decisiones y
 * no rutina.
 */
export const COSTE_MANA = Object.freeze([1, 3, 6, 10, 15, 22, 30, 40, 52, 66]);

/** Escuela de magia del SRD → categoría de glifo del motor. */
export const MAPA_ESCUELA = Object.freeze({
  abjuration: 'proteccion',
  conjuration: 'invocacion',
  divination: 'videncia',
  enchantment: 'dominio',
  evocation: 'fuerza',
  illusion: 'engano',
  necromancy: 'umbral',
  transmutation: 'mutacion',
});

/** Condición del SRD → estado alterado del motor. */
export const MAPA_ESTADOS = Object.freeze({
  blinded: 'cegado',
  charmed: 'dominado',
  deafened: 'ensordecido',
  frightened: 'aterrado',
  grappled: 'apresado',
  incapacitated: 'incapacitado',
  invisible: 'invisible',
  paralyzed: 'paralizado',
  petrified: 'petrificado',
  poisoned: 'envenenado',
  prone: 'derribado',
  restrained: 'inmovilizado',
  stunned: 'aturdido',
  unconscious: 'inconsciente',
  exhaustion: 'agotado',
});

/* ═══════════════════════════════════════════════════════════════════════════
   DETECCIÓN DE FORMATO
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Identifica de qué proyecto procede un volcado.
 *
 * 5e-bits usa `index` y objetos anidados con `{ index, name, url }`.
 * Open5e usa `slug` y campos planos en snake_case.
 *
 * @param {Object} entrada
 * @returns {'5e-bits'|'open5e'|'desconocido'}
 */
export function detectarFormato(entrada) {
  if (!entrada || typeof entrada !== 'object') return 'desconocido';
  if ('index' in entrada && 'url' in entrada) return '5e-bits';
  if ('slug' in entrada) return 'open5e';
  if ('index' in entrada) return '5e-bits';
  return 'desconocido';
}

/* ═══════════════════════════════════════════════════════════════════════════
   CONJUROS
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Convierte un conjuro del SRD en un glifo del motor.
 *
 * @param {Object} crudo Entrada del volcado.
 * @returns {Object|null} Glifo, o null si la entrada es inservible.
 */
export function convertirConjuro(crudo) {
  if (!crudo?.name) return null;

  const formato = detectarFormato(crudo);
  const nivel = Number(crudo.level ?? crudo.level_int ?? 0);
  const escuelaCruda = String(
    crudo.school?.name ?? crudo.school ?? '',
  ).toLowerCase();

  const descripcion = Array.isArray(crudo.desc)
    ? crudo.desc.join('\n\n')
    : String(crudo.desc ?? crudo.description ?? '');

  const orden = Array.isArray(crudo.higher_level)
    ? crudo.higher_level.join('\n\n')
    : String(crudo.higher_level ?? '');

  return {
    refId: crudo.index ?? crudo.slug ?? slug(crudo.name),
    nombre: crudo.name,
    nivel,
    costeMana: COSTE_MANA[Math.min(nivel, COSTE_MANA.length - 1)],
    categoria: MAPA_ESCUELA[escuelaCruda] ?? 'fuerza',

    // El tiempo de lanzamiento decide si el glifo consume el turno completo.
    tiempoLanzamiento: crudo.casting_time ?? '1 acción',
    accionCompleta: !/bonus|reacción|reaction/i.test(String(crudo.casting_time ?? '')),

    alcance: crudo.range ?? 'Toque',
    duracion: crudo.duration ?? 'Instantánea',
    concentracion: Boolean(crudo.concentration),
    ritual: Boolean(crudo.ritual),

    componentes: {
      verbal: Boolean(crudo.components?.includes?.('V')),
      somatico: Boolean(crudo.components?.includes?.('S')),
      material: Boolean(crudo.components?.includes?.('M')),
      descripcionMaterial: crudo.material ?? null,
    },

    descripcion,
    aNivelSuperior: orden || null,

    // Daño, si el conjuro lo declara. El motor usa notación propia de dados.
    dano: _extraerDanoConjuro(crudo),

    // Etiquetas que el director puede aprovechar para narrar.
    etiquetas: _etiquetasConjuro(crudo, descripcion),

    _fuente: 'srd',
    _formato: formato,
  };
}

/**
 * @param {Object} crudo
 * @returns {{notacion: string, tipo: string}|null}
 * @private
 */
function _extraerDanoConjuro(crudo) {
  const bloque = crudo.damage;
  if (!bloque) return null;

  const tipo = bloque.damage_type?.name ?? bloque.damage_type ?? 'fuerza';

  // 5e-bits: damage_at_slot_level o damage_at_character_level.
  const porNivel = bloque.damage_at_slot_level ?? bloque.damage_at_character_level;
  if (porNivel && typeof porNivel === 'object') {
    const primero = Object.values(porNivel)[0];
    return { notacion: String(primero), tipo: String(tipo).toLowerCase(), escala: porNivel };
  }

  if (typeof bloque === 'string') return { notacion: bloque, tipo: 'fuerza' };
  return null;
}

/**
 * Extrae etiquetas útiles a partir del texto del conjuro. Permite que el motor
 * sepa que algo cura, invoca o teletransporta sin leer la prosa entera.
 *
 * @param {Object} crudo
 * @param {string} descripcion
 * @returns {string[]}
 * @private
 */
function _etiquetasConjuro(crudo, descripcion) {
  const texto = `${crudo.name} ${descripcion}`.toLowerCase();
  const etiquetas = [];

  const reglas = [
    [/cura|sana|restaura.*(vida|puntos de golpe)|heal/, 'curacion'],
    [/invoca|conjura|summon/, 'invocacion'],
    [/teletransport|teleport/, 'teletransporte'],
    [/ilusión|ilusion|illusion/, 'ilusion'],
    [/detecta|revela|detect/, 'deteccion'],
    [/protege|escudo|barrera|shield/, 'proteccion'],
    [/vuela|vuelo|fly/, 'movimiento'],
    [/muerto|no muerto|undead/, 'umbral'],
  ];

  for (const [patron, etiqueta] of reglas) {
    if (patron.test(texto)) etiquetas.push(etiqueta);
  }

  if (crudo.concentration) etiquetas.push('concentracion');
  if (crudo.ritual) etiquetas.push('ritual');

  return etiquetas;
}

/* ═══════════════════════════════════════════════════════════════════════════
   CRIATURAS
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Convierte una criatura del SRD en un enemigo del motor.
 *
 * Los ajustes importantes son dos: la clase de armadura se descompone en
 * defensa más reducción de daño, y el desafío se traduce a un grado de amenaza
 * de los siete que maneja el motor.
 *
 * @param {Object} crudo
 * @returns {Object|null}
 */
export function convertirCriatura(crudo) {
  if (!crudo?.name) return null;

  const cr = _parsearDesafio(crudo.challenge_rating ?? crudo.cr ?? 0);
  const grado = MAPA_AMENAZA.find((m) => cr <= m.hasta)?.grado ?? 'normal';

  // La clase de armadura del SRD mezcla esquiva y blindaje. Aquí se separa:
  // lo que supera la defensa base se reparte entre defensa y reducción.
  const ca = Number(crudo.armor_class?.[0]?.value ?? crudo.armor_class ?? 10);
  const exceso = Math.max(0, ca - COMBATE.defensaBase);
  const reduccion = Math.min(Math.floor(exceso / 3), 5);
  const defensa = COMBATE.defensaBase + (exceso - reduccion);

  const atributos = {};
  for (const [claveSRD, claveNucleo] of Object.entries(MAPA_ATRIBUTOS)) {
    if (crudo[claveSRD] !== undefined) atributos[claveNucleo] = Number(crudo[claveSRD]);
  }

  return {
    refId: crudo.index ?? crudo.slug ?? slug(crudo.name),
    nombre: crudo.name,
    tipo: crudo.type ?? 'humanoide',
    tamano: _traducirTamano(crudo.size),

    nivel: Math.max(1, Math.round(cr)),
    amenaza: grado,
    xp: PROGRESION.xpPorAmenaza[grado] ?? 45,

    vida: Number(crudo.hit_points ?? crudo.hp ?? 10),
    defensa,
    reduccionDano: reduccion,

    atributos,

    // Ataques convertidos a la notación del motor.
    ataques: _convertirAcciones(crudo.actions ?? []),
    habilidadesEspeciales: _convertirAcciones(crudo.special_abilities ?? crudo.special_abilities ?? []),
    accionesLegendarias: _convertirAcciones(crudo.legendary_actions ?? []),

    resistencias: _listaTexto(crudo.damage_resistances),
    inmunidades: _listaTexto(crudo.damage_immunities),
    vulnerabilidades: _listaTexto(crudo.damage_vulnerabilities),
    inmunidadesEstado: _listaTexto(crudo.condition_immunities)
      .map((c) => MAPA_ESTADOS[String(c).toLowerCase()] ?? c),

    velocidad: crudo.speed ?? {},
    sentidos: crudo.senses ?? {},
    idiomas: crudo.languages ?? '',

    // Resumen breve que se le pasa al director para que sepa narrarlo.
    promptLore: _resumenCriatura(crudo, grado),

    // Los jefes no huyen; el resto sí puede.
    huye: grado !== 'jefe' && grado !== 'jefeMayor',

    _fuente: 'srd',
  };
}

/**
 * @param {*} valor
 * @returns {number}
 * @private
 */
function _parsearDesafio(valor) {
  if (typeof valor === 'number') return valor;
  const texto = String(valor);
  if (texto.includes('/')) {
    const [a, b] = texto.split('/').map(Number);
    return b ? a / b : 0;
  }
  return Number(texto) || 0;
}

/**
 * @param {string} tamano
 * @returns {string}
 * @private
 */
function _traducirTamano(tamano) {
  const mapa = {
    Tiny: 'diminuto', Small: 'pequeno', Medium: 'mediano',
    Large: 'grande', Huge: 'enorme', Gargantuan: 'colosal',
  };
  return mapa[tamano] ?? 'mediano';
}

/**
 * Convierte acciones y ataques al formato del motor.
 * @param {Array} acciones
 * @returns {Array<Object>}
 * @private
 */
function _convertirAcciones(acciones) {
  if (!Array.isArray(acciones)) return [];

  return acciones.map((a) => {
    const descripcion = Array.isArray(a.desc) ? a.desc.join(' ') : String(a.desc ?? '');
    const dano = a.damage?.[0];

    return {
      nombre: a.name ?? 'Ataque',
      descripcion,
      bonoAtaque: Number(a.attack_bonus ?? 0),
      dano: dano
        ? {
            notacion: dano.damage_dice ?? '1d6',
            tipo: String(dano.damage_type?.name ?? dano.damage_type ?? 'contundente').toLowerCase(),
          }
        : null,
      // Un ataque con recarga no está disponible cada ronda.
      recarga: /recharge|recarga/i.test(a.name ?? '') ? 'aleatoria' : null,
      alcance: /ranged|distancia/i.test(descripcion) ? 'distancia' : 'cuerpo',
    };
  });
}

/**
 * @param {*} valor
 * @returns {string[]}
 * @private
 */
function _listaTexto(valor) {
  if (!valor) return [];
  if (Array.isArray(valor)) return valor.map(String);
  return String(valor).split(/,\s*/).filter(Boolean);
}

/**
 * Resumen de una criatura para el director de juego.
 * @param {Object} crudo
 * @param {string} grado
 * @returns {string}
 * @private
 */
function _resumenCriatura(crudo, grado) {
  const partes = [
    `${crudo.name}: criatura de tipo ${crudo.type ?? 'desconocido'}, tamaño ${_traducirTamano(crudo.size)}`,
    `amenaza ${grado}`,
  ];
  if (crudo.alignment) partes.push(`tendencia ${crudo.alignment}`);
  if (crudo.languages) partes.push(`habla: ${crudo.languages}`);
  return partes.join('. ') + '.';
}

/* ═══════════════════════════════════════════════════════════════════════════
   OBJETOS
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Convierte equipo u objeto mágico del SRD.
 *
 * @param {Object} crudo
 * @returns {Object|null}
 */
export function convertirObjeto(crudo) {
  if (!crudo?.name) return null;

  const rarezaCruda = String(crudo.rarity?.name ?? crudo.rarity ?? 'common').toLowerCase();
  const rareza = MAPA_RAREZA[rarezaCruda] ?? 'comun';

  const descripcion = Array.isArray(crudo.desc)
    ? crudo.desc.join('\n\n')
    : String(crudo.desc ?? crudo.description ?? '');

  // El SRD expresa el precio en monedas de distinto metal; se normaliza a oro.
  const coste = crudo.cost
    ? _normalizarPrecio(crudo.cost)
    : Math.round((OBJETOS.rarezas[rareza]?.multiplicador ?? 1) * 10);

  return {
    refId: crudo.index ?? crudo.slug ?? slug(crudo.name),
    nombre: crudo.name,
    categoria: _categoriaObjeto(crudo),
    rareza,
    peso: Number(crudo.weight ?? 1),
    valor: coste,
    descripcion,

    // Armas y armaduras aportan estadísticas de combate.
    dano: crudo.damage
      ? {
          notacion: crudo.damage.damage_dice ?? '1d6',
          tipo: String(crudo.damage.damage_type?.name ?? 'contundente').toLowerCase(),
        }
      : null,

    armadura: crudo.armor_class
      ? {
          base: Number(crudo.armor_class.base ?? 10),
          aplicaDestreza: crudo.armor_class.dex_bonus !== false,
          maxDestreza: crudo.armor_class.max_bonus ?? null,
        }
      : null,

    propiedades: (crudo.properties ?? []).map((p) => p.name ?? p),
    requiereSintonia: Boolean(crudo.requires_attunement),
    consumible: /poción|pocion|potion|pergamino|scroll/i.test(crudo.name),

    durabilidadMax: OBJETOS.durabilidad.max,
    apilable: /municion|ammunition|racion|ration/i.test(String(crudo.equipment_category?.name ?? '')),

    _fuente: 'srd',
  };
}

/**
 * @param {Object} coste
 * @returns {number} Valor en oro.
 * @private
 */
function _normalizarPrecio(coste) {
  const cantidad = Number(coste.quantity ?? 0);
  const factores = { cp: 0.01, sp: 0.1, ep: 0.5, gp: 1, pp: 10 };
  return Math.round(cantidad * (factores[coste.unit] ?? 1) * 100) / 100;
}

/**
 * @param {Object} crudo
 * @returns {string}
 * @private
 */
function _categoriaObjeto(crudo) {
  const cat = String(crudo.equipment_category?.name ?? crudo.type ?? '').toLowerCase();
  if (/weapon|arma/.test(cat)) return 'arma';
  if (/armor|armadura|shield|escudo/.test(cat)) return 'armadura';
  if (/potion|poción|pocion/.test(cat)) return 'consumible';
  if (/ring|anillo|wondrous|maravilloso|rod|vara|staff|bastón|wand|varita/.test(cat)) return 'magico';
  if (/tool|herramienta|gear|equipo/.test(cat)) return 'utiles';
  return 'general';
}

/* ═══════════════════════════════════════════════════════════════════════════
   CONVERSIÓN MASIVA
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Convierte un volcado completo, descartando las entradas defectuosas en vez
 * de abortar. Un archivo con tres registros corruptos entre trescientos debe
 * darte doscientos noventa y siete objetos, no un error.
 *
 * @param {Array<Object>} volcado
 * @param {'conjuros'|'criaturas'|'objetos'} tipo
 * @returns {{entradas: Record<string, Object>, convertidas: number, descartadas: number}}
 *
 * @example
 * import spells from './packs/srd/spells.json' with { type: 'json' };
 * const { entradas } = convertirVolcado(spells, 'conjuros');
 */
export function convertirVolcado(volcado, tipo) {
  const conversores = {
    conjuros: convertirConjuro,
    criaturas: convertirCriatura,
    objetos: convertirObjeto,
  };

  const conversor = conversores[tipo];
  if (!conversor) {
    log.aviso(`Tipo de volcado desconocido: "${tipo}"`);
    return { entradas: {}, convertidas: 0, descartadas: 0 };
  }

  const lista = Array.isArray(volcado) ? volcado : Object.values(volcado ?? {});
  const entradas = {};
  let descartadas = 0;

  for (const crudo of lista) {
    try {
      const convertido = conversor(crudo);
      if (convertido?.refId) entradas[convertido.refId] = convertido;
      else descartadas++;
    } catch {
      descartadas++;
    }
  }

  const convertidas = Object.keys(entradas).length;
  log.info(`Volcado ${tipo}: ${convertidas} convertidas, ${descartadas} descartadas`);

  return { entradas, convertidas, descartadas };
}

export default {
  detectarFormato,
  convertirConjuro,
  convertirCriatura,
  convertirObjeto,
  convertirVolcado,
  MAPA_ATRIBUTOS,
  MAPA_AMENAZA,
  MAPA_RAREZA,
  MAPA_ESTADOS,
  COSTE_MANA,
};
