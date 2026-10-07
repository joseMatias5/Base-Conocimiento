# Commit 8 — Eliminación de `temp.tsx`

`chore(repo): eliminar temp.tsx, copia sin uso de la pantalla de Comandas`

**Archivos principales:** `temp.tsx` (eliminado).

---

## Hallazgo AT-17 (completo) — Residuos del repositorio

**Ubicación:** Repositorio | Raíz | `temp.tsx`
**Tipo:** Mantenibilidad
**Descripción:** Archivo de 720 líneas en UTF-16, agregado junto con `CLAUDE_HANDOFF.md` (commit `7dcae43`) y que ningún archivo importa.

**Evidencia simplificada:**
```text
temp.tsx  → export default function ComandasPage()   (copia antigua de src/app/comandas/page.tsx)
          → único código propio: getTableLayout() / colIdx(), la grilla de mesas anterior al plano del salón
```

**Problema identificado:** Parece código vivo pero no lo es. Además, al estar en UTF-16, las herramientas que leen
el repositorio (linter, búsquedas, el grafo de conocimiento) lo interpretan como un archivo con errores de sintaxis.

**Consecuencias:**
- Confusión al buscar dónde está la pantalla de Comandas (aparecen dos `ComandasPage`).
- Ruido en búsquedas y análisis estáticos.

**Principios afectados:**
- Higiene del repositorio.

**Recomendación (aplicada):** Eliminarlo. La grilla de mesas que contenía fue reemplazada por el plano del salón.
Si alguna vez hiciera falta, se recupera del historial:
```bash
git show 7dcae43:temp.tsx > temp.tsx
```
**Impacto:** Bajo
**Esfuerzo estimado:** Muy Bajo

---

## Cambios visibles para el frontend
Ninguno: el archivo no estaba referenciado.

## Cómo verificar
```bash
npm test
npm run build
```
