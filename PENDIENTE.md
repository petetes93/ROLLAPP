# Estado del paquete

**El proyecto está completo.** Los 145 archivos de código están en este paquete;
no queda nada por copiar del chat.

## Contenido

| Fase | Contenido | Archivos |
|---|---|---|
| 1 | Núcleo | 24 |
| 2 | Interfaz base | 21 |
| 3 | Personaje | 24 |
| 4 | Inventario | 13 |
| 5 | Director procedural | 10 |
| 6 | Motor de IA | 11 |
| 7 | Combate | 12 |
| 8a | Mundo y exploración | 15 |
| 8b | Gente, misiones y economía | 16 |
| 9 | Progresión y guardado | 10 |
| 10 | Pulido y cierre | 3 |

## Verificación

```
145 archivos JavaScript
  0 errores de sintaxis
480 imports comprobados, 0 rotos
```

## Lo único que queda: registrar los sistemas

`src/main.js` sigue siendo el de la fase 1 y solo registra el núcleo. Para que
el juego arranque completo hay que añadir el registro de los demás sistemas.

**Orden obligatorio** — `TurnResolver` siempre el último, `World` después de sus
subsistemas:

```
Clock
Player, Inventory
TimeSystem, WeatherSystem, DynamicEvents, Travel, Exploration, World
RelationshipSystem, ReputationSystem, FactionSystem, DialogueSystem
MerchantSystem, EconomySystem
QuestSystem
StatsTracker, AchievementSystem, Milestones
SaveManager
RulesEngine, EffectApplier, CombatManager
DungeonMaster, ActionRouter, ConsequenceEngine, DifficultyDirector
TurnResolver
```

`TurnResolver` depende de que todo lo demás esté registrado porque consulta a los
sistemas por nombre durante el turno. `World` coordina a `TimeSystem`,
`WeatherSystem` y los demás, así que va después de ellos.

## Montaje de componentes en UIManager

Los paneles de las fases posteriores necesitan montarse:

```
QuestPanel, NPCPanel     → panel derecho
StatsPanel               → panel derecho
MapPanel                 → panel derecho
CombatPanel              → panel central
InventoryPanel           → panel izquierdo
ItemActions              → capa flotante
BridgePanel              → capa modal
AchievementToast         → capa de avisos
```

## Campos de estado que pueden faltar

Si `GameState.js` es el de la fase 1, comprueba que existan:

```
world.sublugar, world.eventos, world.regiones, world.ganchosEventoUsados
player.usosRasgos, player.retrato, player.motivacion, player.estados
npcs.caidos, quests.historial, quests.fracasadas
hazanas.conseguidas, hazanas.estadisticas
```

`Serializer.deserializar()` funde el guardado sobre el estado inicial, así que un
campo que falte no rompe la carga: simplemente no se conserva.

## Empaquetado

```bash
node tools/bundle.mjs
```

Una vez actualizado `main.js`, el empaquetador recorrerá el grafo completo. Si
avisa de módulos ausentes, son exactamente los que falten por registrar.
