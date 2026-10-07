# CLAUDE.md — Guía de Arquitectura del Proyecto

> Este archivo define CÓMO se construye este proyecto. Seguilo **antes** de escribir código, no después.
> Objetivo: que la estructura nazca correcta, en lugar de corregirla a posteriori.

---

## 0. Flujo de trabajo obligatorio

Antes de escribir cualquier código no trivial:

1. **Entender**: reformulá el requerimiento en 2–3 líneas. Si algo es ambiguo, preguntá.
2. **Ubicar**: decidí en qué **capa** y **módulo** vive cada pieza (ver §2). Nunca crees archivos "sueltos".
3. **Diseñar**: listá las clases/funciones nuevas, su responsabilidad (una frase cada una) y qué patrón GRASP/GoF justifica su existencia.
4. **Verificar el diseño** contra el checklist de §9 antes de implementar.
5. **Implementar** de adentro hacia afuera: dominio → casos de uso → adaptadores → UI.
6. **Probar**: tests unitarios del dominio y casos de uso como mínimo.
7. **Revisar**: pasá el checklist final (§9) y corregí antes de dar la tarea por terminada.

Si una tarea requiere romper una regla de esta guía, **detenete y explicá por qué** antes de hacerlo.

---

## 1. Principios rectores

- **Separación de responsabilidades**: cada módulo, clase y función tiene **una sola razón para cambiar**.
- **Dependencias hacia adentro**: el dominio no conoce frameworks, base de datos, HTTP ni UI.
- **Programar contra interfaces**, no contra implementaciones.
- **Composición sobre herencia**. Herencia solo para relaciones "es-un" reales y estables.
- **YAGNI + KISS**: no agregues patrones "por las dudas". Un patrón se usa cuando resuelve un problema presente.
- **DRY con criterio**: duplicar dos veces es aceptable; a la tercera, abstraé.
- **Explícito > implícito**: nombres claros, sin magia, sin efectos secundarios ocultos.

### SOLID (aplicación obligatoria)

| Principio | Regla práctica |
|---|---|
| **S** – Single Responsibility | Si describís la clase con "y", dividila. |
| **O** – Open/Closed | Nuevos comportamientos se agregan con nuevas clases (Strategy, polimorfismo), no con más `if/switch`. |
| **L** – Liskov | Una subclase nunca debe lanzar "no soportado" ni debilitar contratos del padre. |
| **I** – Interface Segregation | Interfaces chicas y específicas por cliente (`Reader`, `Writer`) en lugar de una gorda. |
| **D** – Dependency Inversion | Casos de uso dependen de **puertos** (interfaces); la infraestructura los implementa. |

---

## 2. Arquitectura en capas (Clean / Hexagonal)

```
┌────────────────────────────────────────────┐
│  Presentación (UI, controllers, CLI)        │  ← adaptadores de entrada
├────────────────────────────────────────────┤
│  Aplicación (casos de uso, DTOs, puertos)   │
├────────────────────────────────────────────┤
│  Dominio (entidades, value objects,         │  ← núcleo, sin dependencias
│  servicios de dominio, reglas de negocio)   │
├────────────────────────────────────────────┤
│  Infraestructura (DB, APIs externas,        │  ← adaptadores de salida
│  repositorios concretos, mensajería)        │
└────────────────────────────────────────────┘
Regla de dependencia: Presentación → Aplicación → Dominio ← Infraestructura
```

### Responsabilidades por capa

- **Dominio**: entidades con comportamiento (no anémicas), value objects inmutables, invariantes validadas en el constructor, eventos de dominio. **Prohibido**: imports de frameworks, ORM, HTTP, logging concreto.
- **Aplicación**: un caso de uso = una clase/función (`CrearPedido`, `CancelarSuscripcion`). Orquesta dominio + puertos. Define interfaces (puertos) como `PedidoRepository`, `NotificadorPort`. Recibe y devuelve DTOs, nunca entidades crudas hacia afuera.
- **Infraestructura**: implementa puertos (`PedidoRepositorySql`, `EmailNotificador`). Mapea entre modelos de persistencia y entidades de dominio.
- **Presentación**: valida formato de entrada, llama al caso de uso, transforma la respuesta. **Cero lógica de negocio.**

### Estructura de carpetas (por feature, luego por capa)

```
src/
  modules/
    <feature>/                 # ej: pedidos, usuarios, pagos
      domain/
        entities/
        value-objects/
        services/
        events/
        errors/
      application/
        use-cases/
        ports/                 # interfaces (repositorios, gateways)
        dto/
      infrastructure/
        persistence/
        external/
        mappers/
      presentation/
        controllers/  (o)  ui/components, ui/pages, ui/hooks
  shared/
    domain/                    # tipos base: Entity, ValueObject, Result
    infrastructure/            # logger, config, http client
    ui/                        # design system, componentes genéricos
  config/                      # composición / inyección de dependencias
tests/
  unit/  integration/  e2e/
```

- Un módulo **no importa** archivos internos de otro módulo; se comunica por su API pública (`index`) o por eventos.
- `shared/` solo contiene lo usado por **3 o más** módulos.
- La **composición de dependencias** (qué implementación va con qué puerto) ocurre en un único lugar: `config/` (Composition Root).

---

## 3. Patrones GRASP — cómo asignar responsabilidades

Usalos para decidir **qué clase hace qué**.

| Patrón | Pregunta que responde | Regla de aplicación |
|---|---|---|
| **Information Expert** | ¿Quién hace X? | Quien tiene los datos necesarios. `Pedido.calcularTotal()`, no `PedidoService.calcularTotal(pedido)`. |
| **Creator** | ¿Quién crea a B? | A crea a B si A contiene/agrega a B o tiene los datos para inicializarlo. `Pedido.agregarItem()` crea `ItemPedido`. |
| **Controller** | ¿Quién recibe el evento del sistema? | Un caso de uso / controller por operación del sistema. No pongas lógica en la UI ni en el endpoint. |
| **Low Coupling** | ¿Cómo reduzco el impacto del cambio? | Depender de interfaces, minimizar imports entre módulos, evitar cadenas `a.b().c().d()`. |
| **High Cohesion** | ¿Cómo mantengo las clases enfocadas? | Si una clase tiene métodos que no usan los mismos atributos, separala. |
| **Polymorphism** | ¿Cómo manejo variantes por tipo? | Reemplazá `switch(tipo)` por clases que implementan una interfaz común. |
| **Pure Fabrication** | ¿Dónde pongo algo que no encaja en el dominio? | Creá una clase artificial cohesiva: repositorios, mappers, servicios de infraestructura. |
| **Indirection** | ¿Cómo desacoplo dos elementos? | Introducí un intermediario: puertos/adaptadores, mediadores, eventos. |
| **Protected Variations** | ¿Cómo protejo el sistema de lo que cambia? | Encapsulá los puntos de variación (proveedores externos, reglas configurables) detrás de interfaces estables. |

---

## 4. Patrones GoF — cuándo usar cada uno

**Regla**: nombrá el patrón en el código solo si aporta claridad (`PagoStrategy`, `NotificacionFactory`). No fuerces patrones donde una función simple alcanza.

### Creacionales
| Patrón | Usalo cuando… | Evitalo cuando… |
|---|---|---|
| **Factory Method / Simple Factory** | La creación depende de un tipo o configuración (`crearProcesadorPago(metodo)`). | Hay una sola implementación. |
| **Abstract Factory** | Necesitás familias de objetos compatibles (temas de UI, proveedores cloud). | Hay una sola familia. |
| **Builder** | Objetos con muchos parámetros opcionales o construcción en pasos (queries, requests, entidades complejas en tests). | Menos de ~4 parámetros. |
| **Singleton** | Casi nunca. Preferí una única instancia registrada en el contenedor DI. | Siempre que sea posible — dificulta tests. |
| **Prototype** | Clonar objetos costosos de construir. | Objetos simples. |

### Estructurales
| Patrón | Usalo cuando… |
|---|---|
| **Adapter** | Integrás una librería/API externa: la envolvés detrás de un puerto propio. **Obligatorio para toda dependencia externa.** |
| **Facade** | Simplificás un subsistema complejo para sus clientes (API pública de un módulo). |
| **Decorator** | Agregás comportamiento transversal sin modificar la clase: caché, logging, reintentos, métricas. |
| **Composite** | Estructuras de árbol tratadas uniformemente (menús, categorías, componentes UI anidados). |
| **Proxy** | Control de acceso, carga diferida, caché remoto. |
| **Bridge** | Dos dimensiones que varían independientemente (ej: tipo de notificación × canal). |

### De comportamiento
| Patrón | Usalo cuando… |
|---|---|
| **Strategy** | Algoritmos intercambiables (cálculo de envío, descuentos, métodos de pago). Primer reemplazo de `if/switch` por tipo. |
| **Observer / Eventos de dominio** | Un cambio debe notificar a otros sin acoplarlos (`PedidoConfirmado` → email, stock, analytics). |
| **Command** | Encapsular operaciones: colas, deshacer/rehacer, auditoría. Los casos de uso pueden modelarse así. |
| **State** | Un objeto cambia de comportamiento según su estado (pedido: pendiente → pagado → enviado). Reemplaza condicionales de estado. |
| **Template Method** | Un algoritmo con pasos fijos y algunos variables. Preferí Strategy si podés usar composición. |
| **Chain of Responsibility** | Pipelines de validación, middlewares, manejadores en cadena. |
| **Mediator** | Muchos componentes que se comunican entre sí (formularios complejos, coordinación de UI). |
| **Iterator / Visitor** | Recorrer u operar sobre estructuras complejas sin exponer su interior. |

### Patrones arquitectónicos complementarios
- **Repository**: acceso a persistencia por agregado, devuelve entidades de dominio.
- **Unit of Work**: transacciones que abarcan varios repositorios.
- **DTO + Mapper**: frontera entre capas; nunca expongas entidades o modelos ORM hacia la UI/API.
- **Dependency Injection**: por constructor, siempre. Nada de `new` de servicios dentro de lógica de negocio.
- **Result/Either**: para errores de negocio esperados en lugar de excepciones.

---

## 5. Arquitectura Responsive (Frontend)

### Principios
- **Mobile-first**: estilos base para móvil; se agregan breakpoints con `min-width`.
- **Layout fluido**: unidades relativas (`rem`, `%`, `fr`, `clamp()`, `vw/vh`). Evitá anchos fijos en `px` para contenedores.
- **CSS Grid** para layouts de página, **Flexbox** para alineación de componentes.
- **Container queries** cuando el componente debe adaptarse a su contenedor y no al viewport.
- **Imágenes responsivas**: `srcset`/`sizes`, `aspect-ratio`, `loading="lazy"`, formatos modernos.
- **Tipografía fluida** con `clamp()`.
- **Targets táctiles** ≥ 44×44 px; nada que dependa solo de `hover`.

### Breakpoints (tokens únicos, no números mágicos)
```
sm: 640px   md: 768px   lg: 1024px   xl: 1280px   2xl: 1536px
```
Definilos **una sola vez** en el sistema de diseño y referencialos por nombre.

### Design System / Tokens
- Colores, espaciados, tipografías, radios, sombras y breakpoints viven en **tokens** (`shared/ui/tokens`). Prohibido hardcodear valores en componentes.
- Soporte de **modo claro/oscuro** vía tokens.

### Arquitectura de componentes
- **Atomic Design**: `atoms` → `molecules` → `organisms` → `templates` → `pages`.
- **Contenedor / Presentacional**: los componentes de UI reciben props y renderizan; la lógica y el acceso a datos van en hooks/servicios/containers.
- Componentes **pequeños** (< ~150 líneas); si crecen, extraé subcomponentes o hooks.
- El estado vive lo más **cerca posible** de donde se usa; estado global solo para lo realmente global (sesión, tema, carrito).
- La UI **nunca** llama directo a `fetch`/HTTP: pasa por un servicio o hook del módulo (Adapter).

### Accesibilidad y rendimiento (parte del "hecho")
- HTML semántico, `alt` en imágenes, labels en inputs, foco visible, contraste AA, navegación por teclado.
- Code splitting por ruta, lazy loading de componentes pesados, sin layout shift (reservar espacio).

---

## 6. Manejo de errores, validación y logging

- **Validar en los bordes**: formato en presentación; **invariantes de negocio en el dominio**.
- Errores de dominio tipados (`StockInsuficienteError`), no `Error("algo salió mal")`.
- Errores esperados → `Result`/valor de retorno; errores inesperados → excepciones capturadas en un handler global.
- Nunca silenciar errores (`catch {}` vacío prohibido).
- Logging estructurado a través de un puerto `Logger`; nunca loguear datos sensibles.

---

## 7. Testing

> La guía completa (TDD, niveles de prueba, dobles, antipatrones y checklist) está en **`TESTING.md`**. Leela antes de escribir pruebas.

- **Pirámide**: muchos unitarios (dominio, casos de uso), algunos de integración (repositorios, adaptadores), pocos e2e (flujos críticos).
- Los casos de uso se prueban con **dobles** de los puertos (fakes/mocks) — esto solo es posible si se respetó DIP.
- Nombres descriptivos: `deberia_rechazar_pedido_cuando_no_hay_stock`.
- Patrón **Arrange–Act–Assert**. Usá Builders/Object Mothers para datos de prueba.
- Tests de UI: comportamiento visible para el usuario y en al menos un viewport móvil y uno desktop.

---

## 8. Convenciones de código

- Nombres en el lenguaje del negocio (**lenguaje ubicuo**), consistentes en todo el código.
- Clases/tipos: `PascalCase` · funciones/variables: `camelCase` (o la convención del lenguaje) · constantes: `UPPER_SNAKE_CASE`.
- Funciones cortas (idealmente < 20 líneas), un nivel de abstracción por función, máx. ~3 parámetros (si no, objeto/DTO).
- Preferir inmutabilidad; evitar estado mutable compartido.
- Sin números ni strings mágicos: constantes o enums.
- Comentarios explican el **por qué**, no el qué.

### Antipatrones prohibidos
- God Class / God Service (clases que lo hacen todo).
- Modelo de dominio anémico con toda la lógica en "services".
- Lógica de negocio en controllers, componentes UI o queries SQL.
- `switch`/`if` por tipo repetido en varios lugares (→ Polymorphism/Strategy).
- Dependencias circulares entre módulos.
- Acceso directo a la base de datos o APIs externas desde dominio o UI.
- Singletons globales con estado.
- Copiar y pegar lógica entre módulos.

---

## 9. Checklist (antes de implementar y antes de terminar)

**Diseño**
- [ ] Cada archivo nuevo está en la capa y módulo correctos.
- [ ] El dominio no importa nada de infraestructura ni frameworks.
- [ ] Cada clase tiene una responsabilidad describible en una frase.
- [ ] La responsabilidad se asignó con GRASP (Expert, Creator, Controller…).
- [ ] Los puntos de variación están detrás de interfaces (Protected Variations).
- [ ] Los patrones GoF usados resuelven un problema real y presente.
- [ ] Toda dependencia externa está envuelta en un Adapter.

**UI / Responsive**
- [ ] Mobile-first, sin anchos fijos, probado en móvil, tablet y desktop.
- [ ] Usa tokens del design system; sin valores hardcodeados.
- [ ] Componentes presentacionales sin lógica de negocio ni llamadas HTTP.
- [ ] Accesibilidad básica cumplida.

**Calidad**
- [ ] Tests unitarios de dominio y casos de uso pasando.
- [ ] Errores manejados y tipados; sin `catch` vacíos.
- [ ] Sin antipatrones de §8.
- [ ] Linter, formateador y type-checker sin errores.

---

## 10. Cuando haya dudas

1. Priorizá **legibilidad y simplicidad** sobre el patrón "más elegante".
2. Si dos opciones son válidas, elegí la que **reduce acoplamiento**.
3. Si una decisión es significativa (nueva tecnología, cambio de capa, nuevo módulo), documentala en `docs/adr/NNNN-titulo.md` con: contexto, opciones, decisión y consecuencias.
4. Ante ambigüedad en requerimientos: **preguntá antes de asumir**.
