# Laboratorios de validación

Proyectos pequeños que convierten recetas "investigadas" en recetas **probadas**. Ciclo: construir → probar contra el motor real →
registrar la lección → marcar el documento como "validado en laboratorio". No tocan ningún proyecto real.

| Lab | Tema | Estado |
|---|---|---|
| 1 `lab1-postgres-concurrencia` | PostgreSQL real: concurrencia, bloqueos, SERIALIZABLE, Outbox, idempotencia, SKIP LOCKED | **Validado 2026-10-07** · 12/12 tests |
| 2 `lab2-csharp-cobros` | El mismo dominio en C# / .NET 8: capas, Npgsql, xUnit, API | **Validado 2026-10-07** · 13/13 tests |
| 3 `lab3-respaldo-ci` | Respaldo/restauración reales y pipeline local | **Cerrado en lo posible 2026-10-07** · 5/5 tests y pipeline local verde; YAML y `dotnet publish` verificados; GitHub Actions y la imagen Docker solo se pueden ejecutar con remoto y Docker (pendiente externo) |
| 4 `lab4-frontend-seguridad` | Frontend con e2e (escritorio y móvil), axe, seguridad básica | **Validado 2026-10-07** · 28/28 tests dos veces; encontró 4 errores reales (L-069…L-072) |

**Resultado global:** 58 tests propios verdes (12 + 13 + 5 + 28). Siguen sin probarse: GitHub Actions y Docker (escritos, no ejecutados), `pg_dump`/WAL, Python/Java/Go, pruebas de penetración reales y despliegue en la nube.

## Lab 1: cómo correrlo
```
cd 08-laboratorios/lab1-postgres-concurrencia
npm install
npm test
```
Levanta un PostgreSQL 18 embebido (paquete `embedded-postgres`, sin instalación en el sistema) en una carpeta temporal y puerto aleatorio,
y lo detiene al terminar. `node_modules/` no se sube a git.

## Lab 2: cómo correrlo
Requiere haber hecho `npm install` en el Lab 1 (usa sus binarios de PostgreSQL) y tener .NET 8:
```
cd 08-laboratorios/lab2-csharp-cobros
dotnet test
```
