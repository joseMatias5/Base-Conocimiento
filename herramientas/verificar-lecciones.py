"""Verifica la numeración de LECCIONES-APRENDIDAS.md y las referencias L-xxx del resto de la base.

Uso:  python -I D:\\BaseConocimiento\\herramientas\\verificar-lecciones.py
Salida: siguiente número libre y, si algo está mal, la lista de problemas (código de salida 1).
Comprueba: (1) encabezados `### L-nnn` sin repetir, (2) toda referencia `L-nnn` de los .md apunta a una lección
existente (las carpetas de laboratorios y del proyecto de referencia tienen su propia numeración y se omiten).
"""
import re
import sys
from collections import Counter
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
ARCHIVO = RAIZ / "01-fundamentos" / "LECCIONES-APRENDIDAS.md"
OMITIR = ("node_modules", "bin", "obj", ".git", "05-referencia-proyecto-san-andres", "07-grafos")

texto = ARCHIVO.read_text(encoding="utf-8")
numeros = [int(n) for n in re.findall(r"(?m)^### L-(\d+)\b", texto)]
problemas = []

for n, veces in sorted(Counter(numeros).items()):
    if veces > 1:
        problemas.append(f"L-{n:03d} aparece {veces} veces como encabezado")

existentes = set(numeros)
for md in RAIZ.rglob("*.md"):
    partes = md.relative_to(RAIZ).parts
    if any(p in OMITIR for p in partes) or md == ARCHIVO:
        continue
    for m in re.finditer(r"\bL-(\d{3})\b", md.read_text(encoding="utf-8", errors="ignore")):
        if int(m.group(1)) not in existentes:
            problemas.append(f"{'/'.join(partes)} cita L-{m.group(1)}, que no existe")

print(f"Lecciones: {len(existentes)} (de L-{min(existentes):03d} a L-{max(existentes):03d})")
print(f"Siguiente numero libre: L-{max(existentes) + 1:03d}")
if problemas:
    print("PROBLEMAS:")
    for p in dict.fromkeys(problemas):
        print(" -", p)
    sys.exit(1)
print("OK: sin repetidos ni referencias rotas")
