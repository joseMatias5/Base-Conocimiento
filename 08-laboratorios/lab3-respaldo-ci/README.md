# Lab 3 · Respaldo, restauración y pipeline

| Pieza | Estado |
|---|---|
| Respaldo **lógico** (JSON por tabla + manifiesto con SHA-256, foto consistente `REPEATABLE READ`) y restauración verificada | **Probado** (5 tests) |
| Respaldo **físico en frío** (copiar el directorio de datos con el servidor detenido) + restauración tras desastre | **Probado** |
| Respaldo rechazado si el manifiesto no coincide, antes de escribir nada | **Probado** |
| Pipeline local `npm run ci` (Lab 1 → build Lab 2 → tests Lab 2 → Lab 3), falla rápido | **Ejecutado: PIPELINE VERDE** |
| `.github/workflows/ci.yml` | Sintaxis YAML válida (verificada); **NO ejecutado en GitHub** (sin remoto). Corre en el primer push: revisar ahí el resultado |
| `Dockerfile.lab2-api` | Etapa de compilación verificada con `dotnet publish -c Release` (genera `Api.dll`); imagen **NO construida** (sin Docker en este equipo) |
| `pg_dump` / `pg_basebackup` / WAL / recuperación a un punto en el tiempo | **No probado**: el PostgreSQL embebido no trae esas herramientas |

Correr: `npm install` (y en el Lab 1 también) y luego `npm test` o `npm run ci`.
