# Estudio ARCANVEIL · organigrama de agentes

33 agentes en 8 departamentos. Cada uno es un especialista real de su campo,
no un ayudante genérico con otro nombre.

Se invocan con la herramienta Agent (`subagent_type: nombre-del-agente`) o
pidiéndolos por su nombre. Trabajan sobre este repositorio.

---

## Por qué está montado así

Un estudio de videojuegos no es una lista de puestos: es una **cadena de
decisiones**. Lo que decide diseño condiciona lo que puede hacer ingeniería, y
lo que arte fija como estilo condiciona lo que diseño puede pedir. El
organigrama respeta esa cadena.

Tres reglas gobiernan a todos:

**1. Nadie decide fuera de su campo.** Un artista no rebalancea el combate y
un ingeniero no reescribe el tono narrativo. Si un agente ve un problema que
no le toca, lo señala y nombra a quién le corresponde.

**2. La visión manda sobre la opinión.** `director-creativo` custodia los
pilares del juego. Cualquier propuesta que los contradiga se rechaza aunque sea
buena idea en abstracto. Un juego coherente y modesto gana a uno brillante a
trozos.

**3. Lo que no se ejecuta no cuenta.** Ningún agente entrega una recomendación
sin decir cómo se comprueba. «Esto mejorará la retención» no vale; «esto
mejorará la retención y se mide con X, que hoy está en Y» sí.

---

## El organigrama

```
                        ┌──────────────────────┐
                        │  director-creativo   │  ← custodia los pilares
                        └──────────┬───────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              │                    │                    │
   ┌──────────┴─────────┐  ┌───────┴────────┐  ┌────────┴─────────┐
   │ productor-ejecutivo│  │ director-tecnico│  │  director-arte   │
   │  alcance y riesgo  │  │  arquitectura   │  │ ancla de estilo  │
   └──────────┬─────────┘  └───────┬────────┘  └────────┬─────────┘
              │                    │                    │
  ┌───────────┴──────────┐  ┌──────┴──────────┐  ┌──────┴──────────┐
  │      DISEÑO (6)      │  │ INGENIERÍA (6)  │  │    ARTE (4)     │
  │ sistemas             │  │ gameplay        │  │ conceptual      │
  │ combate              │  │ motor           │  │ personajes      │
  │ economia             │  │ graficos        │  │ entornos        │
  │ niveles              │  │ herramientas    │  │ ui              │
  │ narrativo            │  │ ia-narrativa    │  └─────────────────┘
  │ ux-juego             │  │ datos           │
  └──────────────────────┘  └─────────────────┘  ┌─────────────────┐
                                                 │   AUDIO (2)     │
  ┌──────────────────────┐  ┌─────────────────┐  │ director-audio  │
  │     CALIDAD (3)      │  │ PUBLICACIÓN (5) │  │ compositor      │
  │ funcional            │  │ marketing       │  └─────────────────┘
  │ balance              │  │ comunidad       │
  │ compatibilidad       │  │ localizacion    │  ┌─────────────────┐
  └──────────────────────┘  │ liveops         │  │   SOPORTE (3)   │
                            │ mercado         │  │ legal           │
                            └─────────────────┘  │ accesibilidad   │
                                                 │ seguridad       │
                                                 └─────────────────┘
```

---

## Catálogo

### Dirección
| Agente | Decide sobre | Llámalo cuando |
|---|---|---|
| `director-creativo` | pilares, tono, qué entra y qué no | dudes si algo «es de este juego» |
| `productor-ejecutivo` | alcance, riesgo, orden de trabajo | haya que recortar o priorizar |
| `director-tecnico` | arquitectura, deuda, decisiones técnicas | una decisión afecte a varios sistemas |

### Diseño
| Agente | Decide sobre | Llámalo cuando |
|---|---|---|
| `disenador-sistemas` | reglas, bucles, progresión | diseñes una mecánica nueva |
| `disenador-combate` | encuentros, tácticas, dificultad | el combate sea trivial o injusto |
| `disenador-economia` | precios, botín, inflación | el oro sobre o falte |
| `disenador-niveles` | mapa, ritmo espacial, conexiones | añadas lugares o rutas |
| `disenador-narrativo` | historia, voz, diálogo, lore | escribas texto de juego |
| `disenador-ux-juego` | HUD, onboarding, legibilidad | el jugador no entienda qué hacer |

### Arte
| Agente | Decide sobre | Llámalo cuando |
|---|---|---|
| `director-arte` | ancla de estilo, coherencia | dudes si una pieza encaja |
| `artista-conceptual` | exploración visual, variantes | busques dirección, no acabado |
| `artista-personajes` | retratos, criaturas, siluetas | generes o revises personajes |
| `artista-entornos` | paisajes, atmósfera, color | generes o revises lugares |
| `artista-ui` | iconos, marcos, jerarquía visual | toques la interfaz |

### Audio
| Agente | Decide sobre | Llámalo cuando |
|---|---|---|
| `director-audio` | paisaje sonoro, mezcla | planifiques el audio |
| `compositor` | música adaptativa, temas | necesites música por estado |

### Ingeniería
| Agente | Decide sobre | Llámalo cuando |
|---|---|---|
| `ingeniero-gameplay` | sistemas de juego en código | implementes una mecánica |
| `ingeniero-motor` | rendimiento, bucle, estado | algo vaya lento o se cuelgue |
| `ingeniero-graficos` | render, SVG, canvas, WebGL | toques la capa de dibujo |
| `ingeniero-herramientas` | pipelines, generadores, build | automatices trabajo repetido |
| `ingeniero-ia-narrativa` | prompts, proveedores, coste | trabajes con el director de IA |
| `ingeniero-datos` | telemetría, métricas, eventos | quieras medir algo |

### Calidad
| Agente | Decide sobre | Llámalo cuando |
|---|---|---|
| `qa-funcional` | bugs, regresión, cobertura | antes de publicar |
| `qa-balance` | curvas, dificultad percibida | sospeches de los números |
| `qa-compatibilidad` | navegadores, dispositivos | vayas a soportar algo nuevo |

### Publicación
| Agente | Decide sobre | Llámalo cuando |
|---|---|---|
| `marketing` | posicionamiento, ficha, tráiler | prepares un lanzamiento |
| `community-manager` | comunidad, feedback, crisis | haya jugadores que atender |
| `localizacion` | idiomas, culturalización | quieras salir del español |
| `liveops-monetizacion` | retención, eventos, ingresos | el juego deba vivir tras salir |
| `analista-mercado` | competencia, audiencia, nicho | decidas a quién te diriges |

### Soporte
| Agente | Decide sobre | Llámalo cuando |
|---|---|---|
| `legal-licencias` | IP, SRD, fuentes, assets | uses algo que no creaste |
| `accesibilidad` | WCAG, daltonismo, motricidad | quieras que lo juegue todo el mundo |
| `seguridad` | XSS, datos, dependencias | manejes datos o claves |

---

## Cómo se usan bien

**Uno cada vez, para decidir.** Un agente que responde una pregunta concreta
vale más que cinco opinando a la vez.

**En cadena, para construir.** El orden natural es
`director-creativo` → `disenador-*` → `ingeniero-*` → `qa-*`. Saltarse el
primero produce features que nadie pidió; saltarse el último, features que no
funcionan.

**En paralelo, para auditar.** Antes de publicar, lanzar a la vez
`qa-funcional`, `accesibilidad`, `seguridad` y `legal-licencias` sobre el mismo
build cubre cuatro riesgos distintos sin que se estorben.

**Nunca para evitar decidir.** Estos agentes informan. La decisión sigue siendo
tuya, y un agente que te diga lo que quieres oír no está haciendo su trabajo.
