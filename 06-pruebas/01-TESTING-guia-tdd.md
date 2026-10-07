# TESTING.md — Guía de Pruebas y Desarrollo Guiado por Pruebas (TDD)

> Complementa a `CLAUDE.md`. Define **cómo y cuándo** escribir pruebas mientras se desarrolla.
> TDD es una **herramienta**, no un dogma: usala donde aporta valor y combinala con pruebas escritas junto al código en el resto.
> Regla de oro: **ningún cambio de comportamiento se da por terminado sin sus pruebas.**

---

## 1. Qué es TDD

El Desarrollo Guiado por Pruebas (*Test-Driven Development*) consiste en escribir una prueba automatizada **antes** de la funcionalidad que la hace pasar. Nació dentro de *Extreme Programming* (XP) y se basa en ciclos muy cortos.

### El ciclo Rojo → Verde → Refactor

```
   ┌──────────┐      ┌──────────┐      ┌──────────────┐
   │  🔴 ROJO  │ ───► │ 🟢 VERDE  │ ───► │ 🔵 REFACTOR   │ ──┐
   │ test que │      │ código    │      │ mejorar sin  │   │
   │  falla   │      │ mínimo    │      │ romper tests │   │
   └──────────┘      └──────────┘      └──────────────┘   │
        ▲                                                   │
        └───────────────────────────────────────────────────┘
```

1. **Rojo**: escribí una prueba pequeña que describa **un** comportamiento nuevo. Ejecutala y confirmá que **falla por el motivo correcto**.
2. **Verde**: escribí el **código mínimo** para que pase. No anticipes casos futuros.
3. **Refactor**: limpiá nombres, eliminá duplicación y aplicá los patrones de `CLAUDE.md`, con todas las pruebas en verde.

### Las tres leyes (versión estricta)
1. No escribir código de producción sin una prueba que falle.
2. No escribir más prueba de la necesaria para que falle.
3. No escribir más código de producción del necesario para que pase.

> En este proyecto, estas leyes son **obligatorias solo en los casos de §3.1**. En el resto se aplican como guía.

---

## 2. Por qué nos importa (y sus costos)

**Beneficios**
- Requisitos más claros: la prueba obliga a definir qué debe pasar antes de cómo.
- Diseño más simple y desacoplado: el código difícil de probar suele estar mal diseñado.
- Red de seguridad para refactorizar y menos tiempo de depuración.
- Las pruebas sirven como **documentación ejecutable**.

**Costos a gestionar**
- Más código que mantener (las pruebas también son código).
- Arranque más lento al inicio de una funcionalidad.
- **Falsa confianza**: muchas pruebas no significa buenas pruebas.
- Pruebas acopladas a la implementación que se rompen con cada refactor.

---

## 3. Modo de trabajo pragmático

### 3.1 Cuándo aplicar TDD estricto (test-first)
- **Reglas de negocio y lógica de dominio** (entidades, value objects, servicios de dominio).
- **Casos de uso** de la capa de aplicación.
- **Corrección de bugs**: primero una prueba que **reproduzca el bug** y falle; luego el arreglo. Obligatorio siempre.
- Algoritmos, cálculos, validaciones, transformaciones de datos, máquinas de estado.
- Requisitos claros con entradas y salidas bien definidas.

### 3.2 Cuándo escribir las pruebas junto al código o justo después (test-after)
- **Exploración / spikes**: código experimental para aprender una API o validar una idea. Se descarta o se reescribe con pruebas antes de integrarlo.
- **Adaptadores de infraestructura** (repositorios, clientes HTTP): se prueban con pruebas de integración tras implementarlos.
- **UI y layout**: primero se construye el componente; después se prueba su comportamiento (no su aspecto pixel a pixel).
- Código generado, configuración, *glue code* trivial.

### 3.3 Qué no merece prueba propia
- Getters/setters triviales, constructores sin lógica, DTOs sin comportamiento.
- Código de terceros (se prueba **nuestra integración** con él, no la librería).
- Detalles privados de implementación: se prueban **a través del comportamiento público**.

### 3.4 Flujo por tarea (para Claude Code)
1. Identificá los **comportamientos** que la tarea agrega o cambia y listalos como casos de prueba (nombres en lenguaje de negocio).
2. Clasificá cada uno: ¿TDD estricto (§3.1) o test-after (§3.2)?
3. Para los de TDD: ciclo Rojo → Verde → Refactor, **un comportamiento a la vez**.
4. Para el resto: implementá y escribí las pruebas **antes de dar la tarea por terminada**.
5. Ejecutá **toda** la suite, no solo las pruebas nuevas.
6. Pasá el checklist de §11.

---

## 4. Estrategia: niveles de prueba

### Pirámide de pruebas (referencia principal)

```
            ▲   pocas · lentas · caras
           ╱ ╲
          ╱E2E╲          Flujos críticos de usuario
         ╱─────╲
        ╱Integr.╲        Adaptadores, BD, APIs, contratos
       ╱─────────╲
      ╱ Unitarias ╲      Dominio + casos de uso
     ╱─────────────╲
            ▼   muchas · rápidas · baratas
```

| Nivel | Qué prueba | Capa (ver `CLAUDE.md`) | Dependencias |
|---|---|---|---|
| **Unitarias** | Una unidad de comportamiento aislada | Dominio, Aplicación | En memoria; dobles para los puertos |
| **Integración** | Un punto de integración real a la vez | Infraestructura | BD real (contenedor/test DB), servidor HTTP simulado |
| **Contrato** | Que proveedor y consumidor de una API respeten el acuerdo | Fronteras entre servicios | Contratos dirigidos por el consumidor (ej. Pact) |
| **Componente UI** | Comportamiento visible de un componente | Presentación | DOM de prueba, servicios simulados |
| **E2E** | Un recorrido completo de usuario | Todo el sistema | Entorno desplegado |
| **Aceptación (ATDD/BDD)** | Criterios de aceptación del negocio | Todo / casos de uso | Escenarios *Given-When-Then* |

**Proporción orientativa**: ~70% unitarias, ~20% integración/componentes, ~10% E2E.
En frontends con mucha integración entre componentes, se acepta el modelo **Testing Trophy** (más peso en pruebas de integración de componentes), siempre que sigan siendo rápidas.

**Evitá duplicar**: si una regla ya está cubierta por una prueba unitaria, el E2E verifica el recorrido, no vuelve a probar cada regla.

### Unitarias "sociables" vs "solitarias"
- **Sociables** (preferidas para el dominio): usan colaboradores reales cuando son rápidos y deterministas (otras entidades, value objects).
- **Solitarias**: reemplazan colaboradores por dobles. Se usan en **fronteras** (puertos hacia BD, red, reloj, aleatoriedad, servicios externos).

---

## 5. Escuelas de TDD

| | **Chicago / Clásica (Inside-Out)** | **Londres / Mockista (Outside-In)** |
|---|---|---|
| Punto de partida | Dominio, hacia afuera | Caso de uso o endpoint, hacia adentro |
| Dobles de prueba | Pocos, solo en fronteras | Muchos, para definir colaboradores |
| Verificación | De **estado** (resultado) | De **interacción** (llamadas) |
| Ventaja | Pruebas robustas ante refactor | Descubre interfaces y diseño desacoplado |
| Riesgo | Diseño menos modular si no se cuida | Pruebas frágiles acopladas a la implementación |

**Decisión del proyecto**: enfoque **híbrido**.
- Outside-In para **descubrir** puertos e interfaces de un caso de uso nuevo.
- Chicago para el **dominio**: verificación de estado y colaboradores reales.
- Verificación de interacción (mocks) **solo** cuando el efecto observable es la llamada en sí (ej. "se envió un email", "se publicó un evento").

---

## 6. Dobles de prueba (Test Doubles)

| Tipo | Qué hace | Cuándo usarlo |
|---|---|---|
| **Dummy** | Se pasa pero nunca se usa | Completar parámetros obligatorios |
| **Stub** | Devuelve respuestas predefinidas | Controlar entradas indirectas (ej. un repositorio que devuelve un usuario) |
| **Spy** | Stub que además registra cómo fue llamado | Verificar llamadas sin un framework de mocks |
| **Mock** | Tiene expectativas preprogramadas y falla si no se cumplen | Cuando la **interacción** es el resultado esperado |
| **Fake** | Implementación funcional simplificada | Repositorios en memoria, reloj controlable. **Preferido para puertos.** |

**Reglas**
- **Solo doblá lo que es tuyo**: dobles para **puertos** propios (`PedidoRepository`), no para librerías externas. Las librerías se envuelven en un Adapter (ver `CLAUDE.md`) y ese adaptador se prueba con integración.
- Preferí **Fakes** antes que mocks con muchas expectativas.
- Nunca dobles el sujeto bajo prueba ni value objects.
- Si una prueba necesita más de 3–4 dobles, es una **señal de diseño**: la clase tiene demasiadas responsabilidades.
- Inyección de dependencias por constructor, siempre: es lo que hace posible usar dobles.

---

## 7. Cómo escribir buenas pruebas

### Principios F.I.R.S.T.
- **Fast** (rápidas): las unitarias corren en milisegundos.
- **Independent** (independientes): ninguna depende del orden ni del estado que dejó otra.
- **Repeatable** (repetibles): mismo resultado en cualquier máquina; sin red, reloj real ni aleatoriedad sin semilla.
- **Self-validating** (autoverificables): pasan o fallan solas, sin inspección manual.
- **Timely** (oportunas): se escriben antes o junto con el código, no "algún día".

### Estructura: Arrange – Act – Assert (o Given – When – Then)
```text
test "debería rechazar el pedido cuando no hay stock suficiente":
    // Arrange (Given)
    producto = unProducto().conStock(2).build()
    pedido   = unPedido().conItem(producto, cantidad = 5).build()

    // Act (When)
    resultado = confirmarPedido.ejecutar(pedido)

    // Assert (Then)
    esperar(resultado).esError(StockInsuficiente)
```

### Reglas de redacción
- **Un comportamiento por prueba**: puede haber varias aserciones si verifican el mismo comportamiento.
- **Nombres que cuentan una historia**: `deberia_<resultado>_cuando_<condicion>`, en lenguaje de negocio.
- **Probá comportamiento, no implementación**: aserciones sobre resultados y efectos observables, no sobre métodos privados ni el orden interno de llamadas.
- **Sin lógica en las pruebas**: nada de `if`, bucles ni cálculos que repliquen el código de producción. Valores esperados **literales**.
- **Datos de prueba legibles**: usá *Test Data Builders* u *Object Mothers* (`unUsuario().admin().build()`) con valores por defecto válidos.
- **Mensajes de fallo claros**: al fallar, la prueba debe decir qué se esperaba y qué ocurrió.
- **Determinismo**: inyectá reloj, generador de IDs y aleatoriedad como dependencias.
- El código de prueba se mantiene con la **misma calidad** que el de producción: refactorizalo también.

### Casos que siempre hay que considerar
- Camino feliz.
- Valores límite (0, 1, máximo, máximo+1, vacío, nulo).
- Entradas inválidas y errores de negocio esperados.
- Errores de infraestructura (timeout, BD caída) en los adaptadores.
- Concurrencia o idempotencia cuando aplique (pagos, reintentos).

---

## 8. Pruebas por capa (alineadas con `CLAUDE.md`)

| Capa | Tipo | Qué verificar | Dobles |
|---|---|---|---|
| **Dominio** | Unitaria (TDD estricto) | Invariantes, cálculos, transiciones de estado, eventos emitidos | Ninguno |
| **Aplicación** | Unitaria (TDD estricto) | Orquestación del caso de uso, errores de negocio, efectos en puertos | Fakes/stubs de puertos; mocks solo para efectos salientes |
| **Infraestructura** | Integración | Mapeo y queries reales, serialización, manejo de errores externos | BD de prueba real, servidor HTTP simulado |
| **Presentación (API)** | Integración ligera | Validación de entrada, códigos HTTP, formato de respuesta | Casos de uso simulados |
| **Presentación (UI)** | Componente | Lo que el usuario ve y hace: render, interacción, estados de carga/error/vacío | Servicios/hooks simulados |
| **Sistema** | E2E | Flujos críticos de punta a punta | Ninguno |

### UI y responsive
- Consultá elementos **como lo haría el usuario**: por rol, label o texto visible; no por clases CSS ni estructura interna.
- Probá los estados: carga, vacío, error, éxito.
- Los E2E de flujos críticos se ejecutan en **al menos un viewport móvil y uno de escritorio**.
- Accesibilidad: incluí verificaciones automáticas (axe o similar) en los componentes principales.
- Las pruebas de regresión visual (capturas) solo para componentes del design system, con tolerancia definida.

---

## 9. Antipatrones a evitar

| Antipatrón | Síntoma | Solución |
|---|---|---|
| **Prueba que nunca falló** | Se escribió después y pasa siempre | Verificá que falle rompiendo el código a propósito |
| **Pruebas frágiles** | Se rompen con cada refactor sin cambio de comportamiento | Probar comportamiento público, no implementación |
| **Exceso de mocks** | Más configuración de mocks que lógica | Fakes, pruebas sociables, revisar el diseño |
| **Pruebas dependientes** | Fallan según el orden de ejecución | Estado propio por prueba; limpiar en setup/teardown |
| **Lógica en la prueba** | `if`/bucles/cálculos en el test | Valores esperados literales; parametrizar casos |
| **Prueba gigante** | Muchos comportamientos en un solo test | Dividir: un comportamiento por prueba |
| **Pruebas lentas** | La suite tarda minutos y nadie la corre | Mover lógica a unitarias; aislar la integración |
| **Pruebas intermitentes (flaky)** | Pasan o fallan al azar | Eliminar sleeps, reloj real, red y dependencias de orden. Nunca ignorarlas: arreglar o poner en cuarentena con ticket |
| **Perseguir el 100% de cobertura** | Pruebas sin aserciones útiles | La cobertura es un indicador, no un objetivo |
| **Comentar o saltear pruebas que fallan** | `skip` sin motivo | Prohibido salvo con ticket y justificación |

---

## 10. Métricas y automatización

- **Cobertura** orientativa: dominio y casos de uso **≥ 90%**; global **≥ 80%**. Revisá también la **cobertura de ramas**, no solo de líneas.
- **Mutation testing** (Stryker, PIT, mutmut, etc.) de forma periódica sobre el dominio: mide si las pruebas detectan cambios en el código, que es lo que de verdad importa.
- **Property-based testing** (fast-check, Hypothesis, jqwik, etc.) para lógica con muchas combinaciones de entrada: parsers, cálculos, serialización.
- **CI**: toda la suite corre en cada push/PR; ningún merge con pruebas en rojo.
- Ejecución local rápida: las unitarias deben correr en segundos para usarse en modo *watch*.
- Organización:
  ```
  tests/
    unit/          # espejo de src/modules/<feature>/domain y application
    integration/   # adaptadores de infraestructura y API
    e2e/           # flujos críticos de usuario
    support/       # builders, fakes, fixtures compartidos
  ```
  (O pruebas junto al archivo, `*.test.*` / `*_test.*`, si es la convención del stack. Elegí una y mantenela.)

---

## 11. Checklist antes de dar una tarea por terminada

- [ ] Cada comportamiento nuevo o modificado tiene al menos una prueba.
- [ ] Todo bug corregido tiene una prueba que lo reproducía y ahora pasa.
- [ ] La lógica de dominio y los casos de uso se hicieron con TDD (§3.1).
- [ ] Las pruebas nuevas **fallaron** al menos una vez por el motivo correcto.
- [ ] Se cubren el camino feliz, los límites y los errores esperados.
- [ ] Los nombres describen el comportamiento en lenguaje de negocio.
- [ ] Sin lógica, sin dependencias de orden, sin red ni reloj real en las unitarias.
- [ ] Los dobles se usan solo en puertos propios; se prefieren Fakes.
- [ ] Los cambios en UI tienen pruebas de componente; los flujos críticos tienen E2E en móvil y escritorio.
- [ ] La suite **completa** pasa localmente.
- [ ] Ninguna prueba fue salteada o comentada sin justificación.

---

## Fuentes y lecturas recomendadas

- IBM — [¿Qué es el desarrollo basado en pruebas (TDD)?](https://www.ibm.com/mx-es/think/topics/test-driven-development)
- Codurance — [Guía completa del desarrollo guiado por pruebas (TDD)](https://www.codurance.com/es/guia-completa-desarrollo-guiado-por-pruebas-tdd)
- Ham Vocke (martinfowler.com) — [The Practical Test Pyramid](https://martinfowler.com/articles/practical-test-pyramid.html)
- Microsoft Engineering Playbook — [Mocking in Unit Tests](https://microsoft.github.io/code-with-engineering-playbook/automated-testing/unit-testing/mocking/)
- Kent C. Dodds — [Write tests. Not too many. Mostly integration.](https://kentcdodds.com/blog/write-tests) y [The Testing Trophy and Testing Classifications](https://kentcdodds.com/blog/the-testing-trophy-and-testing-classifications)
- Kent Beck — *Test-Driven Development: By Example* (libro)
- Steve Freeman y Nat Pryce — *Growing Object-Oriented Software, Guided by Tests* (libro, escuela de Londres)
