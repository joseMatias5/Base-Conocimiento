# Graph Report - conocimiento  (2026-10-06)

## Corpus Check
- 2 files · ~3,060 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 49 nodes · 121 edges · 8 communities (2 shown, 6 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 4 edges (avg confidence: 0.75)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Funcionalidad y pruebas
- Calidad, entrega y cierre
- Dominio: dinero y datos
- Proceso de trabajo
- Seguridad desde el esqueleto
- Concurrencia e integridad
- C. Seguridad
- L-031 Validación de entrada que rompe el

## God Nodes (most connected - your core abstractions)
1. `Lecciones aprendidas` - 42 edges
2. `Fase 2 · Esqueleto con la infraestructura que después cuesta agregar` - 14 edges
3. `Guía para construir una app robusta` - 10 edges
4. `Fase 4 · Pruebas` - 10 edges
5. `C. Seguridad` - 9 edges
6. `F. Proceso de trabajo` - 9 edges
7. `Fase 1 · Modelo de dominio` - 8 edges
8. `E. Tests` - 6 edges
9. `Fase 3 · Funcionalidad, una por una` - 6 edges
10. `A. Dinero y cálculos de negocio` - 5 edges

## Surprising Connections (you probably didn't know these)
- `Base de conocimiento global (README)` --references--> `Lecciones aprendidas`  [EXTRACTED]
  README.md → LECCIONES-APRENDIDAS.md
- `Base de conocimiento global (README)` --references--> `Guía para construir una app robusta`  [EXTRACTED]
  README.md → GUIA-APP-ROBUSTA.md
- `Al cerrar cada bloque de trabajo` --references--> `Lecciones aprendidas`  [EXTRACTED]
  GUIA-APP-ROBUSTA.md → LECCIONES-APRENDIDAS.md
- `Fase 0 · Entender antes de escribir código` --references--> `Lecciones aprendidas`  [EXTRACTED]
  GUIA-APP-ROBUSTA.md → LECCIONES-APRENDIDAS.md
- `Guía para construir una app robusta` --references--> `Lecciones aprendidas`  [EXTRACTED]
  GUIA-APP-ROBUSTA.md → LECCIONES-APRENDIDAS.md

## Hyperedges (group relationships)
- **Seguridad desde el esqueleto** — guia_app_robusta_fase_2, lecciones_aprendidas_l_020, lecciones_aprendidas_l_021, lecciones_aprendidas_l_022, lecciones_aprendidas_l_023, lecciones_aprendidas_l_024, lecciones_aprendidas_l_025 [EXTRACTED 1.00]
- **Verificar contra lo real** — lecciones_aprendidas_l_013, lecciones_aprendidas_l_030, lecciones_aprendidas_l_041, lecciones_aprendidas_l_050, lecciones_aprendidas_l_056, lecciones_aprendidas_l_057 [INFERRED 0.75]
- **Integridad transaccional de estados** — lecciones_aprendidas_l_010, lecciones_aprendidas_l_011, lecciones_aprendidas_l_012, lecciones_aprendidas_l_013, lecciones_aprendidas_l_004 [INFERRED 0.85]

## Communities (8 total, 6 thin omitted)

### Community 0 - "Funcionalidad y pruebas"
Cohesion: 0.43
Nodes (3): Fase 3 · Funcionalidad, una por una, Fase 4 · Pruebas, E. Tests

### Community 1 - "Calidad, entrega y cierre"
Cohesion: 0.38
Nodes (6): Al cerrar cada bloque de trabajo, Fase 0 · Entender antes de escribir código, Fase 5 · Calidad y seguridad antes de entregar, Fase 6 · Entrega, Guía para construir una app robusta, Base de conocimiento global (README)

## Knowledge Gaps
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Lecciones aprendidas` connect `Concurrencia e integridad` to `Funcionalidad y pruebas`, `Calidad, entrega y cierre`, `Dominio: dinero y datos`, `Proceso de trabajo`, `Seguridad desde el esqueleto`, `C. Seguridad`, `L-031 Validación de entrada que rompe el`?**
  _High betweenness centrality (0.745) - this node is a cross-community bridge._
- **Why does `Guía para construir una app robusta` connect `Calidad, entrega y cierre` to `Funcionalidad y pruebas`, `Dominio: dinero y datos`, `Seguridad desde el esqueleto`, `Concurrencia e integridad`?**
  _High betweenness centrality (0.080) - this node is a cross-community bridge._
- **Why does `Fase 2 · Esqueleto con la infraestructura que después cuesta agregar` connect `Seguridad desde el esqueleto` to `Funcionalidad y pruebas`, `Calidad, entrega y cierre`, `Dominio: dinero y datos`, `Concurrencia e integridad`, `C. Seguridad`, `L-031 Validación de entrada que rompe el`?**
  _High betweenness centrality (0.058) - this node is a cross-community bridge._