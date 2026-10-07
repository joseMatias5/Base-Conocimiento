# Plantillas de documentación

## 1. ADR (decisión de arquitectura) — `docs/adr/NNNN-titulo.md`

```
# ADR-NNNN · [Título corto]
Fecha: AAAA-MM-DD · Estado: propuesta | aceptada | reemplazada por ADR-XXXX

## Contexto
[Qué problema hay y qué restricciones existen: usuarios, volumen, equipo, plazos.]

## Opciones consideradas
1. [Opción A] — pros / contras en ESTE contexto
2. [Opción B] — pros / contras en ESTE contexto

## Decisión
[Qué se eligió y por qué.]

## Consecuencias
[Qué hay que construir por haberlo elegido, qué se pierde, cuándo se reevalúa.]
```

## 2. Documento de cambio (un commit por grupo de hallazgos o por funcionalidad) — `docs/cambios/NN-nombre.md`

```
# [Título del cambio]

## Qué hace
[2–4 líneas.]

## Hallazgo / requerimiento (plantilla)
- **Qué pasaba / qué se pide:**
- **Gravedad / prioridad:** crítica | alta | media | baja
- **Cómo se reprodujo:** [pasos o test]
- **Arreglo / diseño:** [resumen]
- **Test:** `REGRESIÓN: ...` (archivo y nombre)

## Decisiones y por qué
[Alternativas descartadas.]

## Cambios visibles para el frontend
- Contrato de la API: [rutas, campos nuevos/cambiados/eliminados, códigos de error]
- Eventos en tiempo real: [formato]
- Comportamientos nuevos que la pantalla debe mostrar: [ej. mostrar `data.error`, manejar 409]
(Si no hay: "Ninguno").

## Verificación
tests: [resultado] · build: [resultado] · linter: [resultado] · probado a mano: [qué]

## Pendientes
[Lo que quedó fuera o no se pudo verificar.]
```

## 3. Lección aprendida — `docs/lecciones-aprendidas.md` (y generalizada en la base global)

```
### L-NNN · [Título]
- **Error:** qué pasó, con el síntoma real.
- **Regla:** qué hacer siempre (generalizada).
- **Cómo verificarlo:** el test o chequeo concreto.
- Origen: [proyecto, commit/hallazgo]
```

## 4. Matriz de permisos (test que falla si aparece una ruta sin clasificar)

| Ruta | Método | Roles permitidos | Test |
|---|---|---|---|
| `/api/productos` | GET | cualquier autenticado | sin sesión → 401 |
| `/api/productos` | POST | ADMIN | otro rol → 403 |
| ... | ... | ... | ... |
