/**
 * Pruebas basadas en PROPIEDADES (fast-check): en vez de unos pocos ejemplos, se comprueba que una regla vale para miles
 * de entradas generadas al azar (con semilla reproducible: si falla, fast-check imprime la semilla y el caso mínimo).
 * Cubren L-001 (dinero en centavos) y L-012 (máquina de estados). Los ejemplos concretos siguen en los otros tests.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  MAX_CENTAVOS_DB,
  MAX_MONTO_PESOS,
  aCentavos,
  aPesos,
  dentroDeRango,
  enPesos,
  subtotalCentavos,
} from '@/lib/money';
import { ESTADOS_FINALES, TRANSICIONES } from '@/lib/pedidos';

const MAX_CENTAVOS_MONTO = MAX_MONTO_PESOS * 100;
const centavos = fc.integer({ min: 0, max: MAX_CENTAVOS_MONTO });
const linea = fc.record({ precio: centavos, cantidad: fc.integer({ min: 1, max: 99 }) });

describe('dinero en centavos (propiedades)', () => {
  it('ida y vuelta: un importe con dos decimales vuelve a ser los mismos centavos', () => {
    fc.assert(
      fc.property(centavos, (c) => {
        expect(aCentavos(aPesos(c))).toBe(c);
      }),
      { numRuns: 5000 },
    );
  });

  it('un importe que el usuario escribe con decimales se convierte sin error de punto flotante', () => {
    // El usuario escribe "pesos,centavos": se arma el número como lo hace un formulario (parseFloat de un texto).
    fc.assert(
      fc.property(fc.integer({ min: 0, max: MAX_MONTO_PESOS }), fc.integer({ min: 0, max: 99 }), (pesos, cents) => {
        const escrito = parseFloat(`${pesos}.${String(cents).padStart(2, '0')}`);
        expect(aCentavos(escrito)).toBe(pesos * 100 + cents);
      }),
      { numRuns: 5000 },
    );
  });

  it('la media décima se redondea hacia arriba (1,005 → 101 centavos)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 100_000_000 }), (c) => {
        expect(aCentavos((2 * c + 1) / 200)).toBe(c + 1);
      }),
      { numRuns: 5000 },
    );
  });

  it('siempre devuelve un entero seguro', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: MAX_MONTO_PESOS, noNaN: true }), (pesos) => {
        expect(Number.isSafeInteger(aCentavos(pesos))).toBe(true);
      }),
      { numRuns: 5000 },
    );
  });

  it('el subtotal es aditivo y no depende del orden de las líneas', () => {
    fc.assert(
      fc.property(fc.array(linea, { maxLength: 30 }), fc.array(linea, { maxLength: 30 }), (a, b) => {
        expect(subtotalCentavos([...a, ...b])).toBe(subtotalCentavos(a) + subtotalCentavos(b));
        expect(subtotalCentavos([...a].reverse())).toBe(subtotalCentavos(a));
      }),
      { numRuns: 2000 },
    );
  });

  it('el subtotal de líneas enteras es un entero (nunca queda un residuo decimal)', () => {
    fc.assert(
      fc.property(fc.array(linea, { maxLength: 50 }), (lineas) => {
        expect(Number.isInteger(subtotalCentavos(lineas))).toBe(true);
      }),
      { numRuns: 2000 },
    );
  });

  it('dentroDeRango acepta exactamente los enteros hasta el máximo de la columna (en ambos signos)', () => {
    fc.assert(
      fc.property(fc.integer({ min: -3_000_000_000, max: 3_000_000_000 }), (c) => {
        expect(dentroDeRango(c)).toBe(Math.abs(c) <= MAX_CENTAVOS_DB);
      }),
      { numRuns: 5000 },
    );
    expect(dentroDeRango(0.5)).toBe(false);
    expect(dentroDeRango(Number.NaN)).toBe(false);
    expect(dentroDeRango(Infinity)).toBe(false);
  });

  it('el límite exacto de la columna entra y el siguiente no (en ambos signos)', () => {
    // Lo encontró el mutation testing: el generador al azar casi nunca cae justo en el borde (<= vs <).
    expect(dentroDeRango(2_147_483_647)).toBe(true);
    expect(dentroDeRango(-2_147_483_647)).toBe(true);
    expect(dentroDeRango(2_147_483_648)).toBe(false);
    expect(dentroDeRango(-2_147_483_648)).toBe(false);
  });

  it('un campo de dinero que no es un número no se convierte (null, texto, fecha)', () => {
    // Lo encontró el mutation testing: sin la comprobación de tipo, aPesos(null) daría 0 y se perdería el dato.
    const fecha = new Date('2026-10-07T12:00:00Z');
    expect(enPesos({ precio: null, total: '12', monto: fecha, propina: undefined })).toEqual({
      precio: null,
      total: '12',
      monto: fecha,
      propina: undefined,
    });
  });

  it('enPesos convierte solo los campos de dinero y deja el resto intacto', () => {
    fc.assert(
      fc.property(centavos, centavos, fc.integer({ min: 0, max: 1000 }), fc.string(), (precio, total, cantidad, nombre) => {
        const salida = enPesos({ precio, total, cantidad, nombre, anidado: { propina: precio } });
        expect(salida).toEqual({ precio: precio / 100, total: total / 100, cantidad, nombre, anidado: { propina: precio / 100 } });
      }),
      { numRuns: 2000 },
    );
  });

  it('enPesos conserva las fechas y los null, y trabaja sobre listas', () => {
    const fecha = new Date('2026-10-07T12:00:00Z');
    expect(enPesos({ creado: fecha, vacio: null })).toEqual({ creado: fecha, vacio: null });
    fc.assert(
      fc.property(fc.array(centavos, { maxLength: 20 }), (precios) => {
        expect(enPesos(precios.map((precio) => ({ precio })))).toEqual(precios.map((c) => ({ precio: c / 100 })));
      }),
      { numRuns: 1000 },
    );
  });
});

describe('máquina de estados del pedido (propiedades)', () => {
  const origenes = Object.keys(TRANSICIONES);
  const estados = new Set([...origenes, ...Object.values(TRANSICIONES).flat(), ...ESTADOS_FINALES]);

  it('un estado final nunca es origen de una transición', () => {
    for (const final of ESTADOS_FINALES) expect(origenes).not.toContain(final);
  });

  it('ninguna transición lleva a un estado que no existe ni a sí mismo', () => {
    for (const [origen, destinos] of Object.entries(TRANSICIONES)) {
      for (const destino of destinos) {
        expect(estados.has(destino)).toBe(true);
        expect(destino).not.toBe(origen);
      }
    }
  });

  it('desde cualquier estado abierto se puede llegar a "listo" por el camino permitido (sin callejones)', () => {
    fc.assert(
      fc.property(fc.constantFrom(...origenes), (origen) => {
        // Búsqueda en anchura: "listo" es alcanzable desde todo estado abierto.
        const visto = new Set([origen]);
        const cola = [origen];
        while (cola.length) {
          const actual = cola.shift()!;
          for (const siguiente of TRANSICIONES[actual] ?? []) {
            if (!visto.has(siguiente)) {
              visto.add(siguiente);
              cola.push(siguiente);
            }
          }
        }
        expect(visto.has('listo')).toBe(true);
      }),
    );
  });
});
