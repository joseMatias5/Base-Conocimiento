# Prompt inicial para un proyecto nuevo

> Copiar, completar lo que se sepa y pegar. Lo que quede en blanco, Claude lo pregunta (máx. 4 preguntas, en una tanda).
> Cuanto más concreto (con ejemplos numéricos), menos rondas de corrección.

```
Quiero construir [NOMBRE]: [una frase de qué hace y para quién].

USUARIOS Y ROLES
- [rol 1]: puede [...]
- [rol 2]: puede [...]

ALCANCE DE LA V1
Sí: [lista de funciones]
No (por ahora): [lista]

REGLAS DE NEGOCIO (con ejemplos numéricos)
- [Ej.: una venta de 3 × $1.250,50 con 10 % de descuento da $3.376,35]
- [Ej.: el stock se descuenta al cobrar y se devuelve al anular]
- [Ej.: un pedido cobrado no se puede reabrir; se anula la venta]

DATOS
- Sensibles: [dinero / stock / personales]
- Datos existentes a migrar: [sí/no, formato]
- Volumen estimado: [filas/usuarios a 1 y 3 años]

DÓNDE CORRE
- [escritorio / LAN / nube], [N] usuarios simultáneos, [con/sin internet]
- Base de datos: [a tu criterio con justificación / fija: ...]
- Stack: [a tu criterio / fijo: ...]

EQUIPO
- Frontend: [lo hago yo / lo hace ...]. Carpetas del backend: [...]. Un cambio de contrato se avisa antes.

CÓMO TRABAJAR
- Lee primero D:\BaseConocimiento\ (README.md y lo que corresponda a la fase).
- Usa los plugins y skills que correspondan a cada fase (ver 01-fundamentos/HERRAMIENTAS-Y-PLUGINS.md); /code-review y /security-review son obligatorias antes de entregar.
- Sigue las fases 0 a 6 de GUIA-APP-ROBUSTA.md; no pases de fase sin cumplir su criterio de terminado.
- Elige la base de datos con 03-base-de-datos/01 y regístrala en un ADR.
- Cada funcionalidad: contrato de API → tests → implementación → pantalla → documento corto.
- Transacciones atómicas, ABM completo (alta, consulta paginada, modificación con versión, baja lógica o anulación).
- Cada bloque se cierra con tests, build, linter y tipos verdes, mostrando la salida.
- Al terminar: lista de pendientes y de lo que no pudiste verificar.
```

## Variantes cortas

**Agregar una funcionalidad a un proyecto existente**
```
Agregá [funcionalidad] a este proyecto. Antes de codear: leé CLAUDE.md, las lecciones relevantes y el código que vas a tocar.
Decime en 5 líneas el diseño (capa, módulo, transacciones, permisos, cambios de contrato) y esperá mi OK si hay decisiones con alternativas.
```

**Auditar un backend existente**
```
Auditá el backend de este proyecto con 03-base-de-datos/02 (transacciones) y 02-arquitectura/03 (API y seguridad).
Clasificá hallazgos por severidad, un commit por grupo, cada arreglo con test REGRESIÓN y documento en docs/auditoria/.
```

**Elegir base de datos**
```
Con estos requisitos [...] aplicá 03-base-de-datos/01-eleccion-de-base-de-datos.md y entregame un ADR con 2–3 opciones, decisión y condiciones de reevaluación.
```

## Qué hace que un prompt sea bueno (resumen)

1. **Reglas de negocio con números**, no con adjetivos ("calcula bien" no sirve; "3 × 1.250,50 − 10 % = 3.376,35" sí).
2. **Alcance cerrado:** qué entra y qué no.
3. **Restricciones técnicas reales:** dónde corre, cuántos usuarios, si hay datos previos.
4. **Criterio de terminado verificable:** tests, build y linter verdes con la salida a la vista.
5. **Quién toca qué:** carpetas por persona para no chocar.
