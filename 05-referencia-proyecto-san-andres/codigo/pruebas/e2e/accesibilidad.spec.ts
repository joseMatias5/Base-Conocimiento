import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { PIN, ingresarPin } from './ayudas';

/**
 * Accesibilidad automática (axe, WCAG A/AA) de las pantallas de entrada. Es un piso, no una auditoría completa: axe
 * solo detecta una parte de los problemas.
 *
 * Las violaciones que YA existían (medidas el 2026-10-07) se anotan abajo con su cantidad de elementos, para que la
 * prueba falle ante un problema nuevo o ante más elementos afectados, sin bloquear lo pendiente del frontend.
 * Al corregir una, bajar o quitar su entrada: la prueba también falla si hay MENOS de lo anotado (así la lista no
 * queda desactualizada). Ver docs/auditoria/commit-15-calidad-de-pruebas.md ("Cambios visibles para el frontend").
 */
type Conocidas = Record<string, number>;

const CONOCIDAS = {
  // 2026-10-07: sin violaciones conocidas (AT-36 cerrado: nombres accesibles, botón Power quitado y contraste AA).
  inicio: {},
  modalPin: {},
  comandas: {},
  cocina: {},
  // Por "viewport ruta" de /admin; lo que no aparece acá se espera sin violaciones. AT-38 (hallado el 2026-10-07 al ampliar
  // la prueba a Cocina y Administración): un <select> sin etiqueta en Caja e Historial (el filtro de período/usuario), y
  // zonas con scroll que no se pueden enfocar con el teclado en móvil (<main> de /admin y la tabla de Historial).
  // Al corregir una, borrar su entrada: la prueba también falla si hay MENOS de lo anotado.
  admin: {
    'escritorio /admin/caja': { 'select-name': 1 },
    'escritorio /admin/historial': { 'select-name': 1 },
    'movil /admin': { 'scrollable-region-focusable': 1 },
    'movil /admin/caja': { 'select-name': 1 },
    'movil /admin/historial': { 'scrollable-region-focusable': 1, 'select-name': 1 },
  } as Record<string, Conocidas>,
};

async function violaciones(page: Page): Promise<Conocidas> {
  // Las animaciones de entrada (fade-in de 0,3 s) bajan la opacidad: medir en medio daba contrastes que dependían
  // del momento. Se espera a las animaciones finitas; las infinitas (animate-pulse) no terminan nunca.
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .filter((a) => a.effect?.getComputedTiming().endTime !== Infinity)
      .every((a) => a.playState === 'finished')
  );
  const resultado = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  return Object.fromEntries(resultado.violations.map((v) => [v.id, v.nodes.length]));
}

test('pantalla de inicio: sin violaciones de accesibilidad distintas de las conocidas', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Restaurante San Andrés' })).toBeVisible();
  expect(await violaciones(page)).toEqual(CONOCIDAS.inicio);
});

test('modal del PIN: sin violaciones de accesibilidad distintas de las conocidas', async ({ page }) => {
  await ingresarPin(page, 'comandas', '12'); // abre el modal y deja el PIN a medias
  expect(await violaciones(page)).toEqual(CONOCIDAS.modalPin);
});

test('Comandas tras el ingreso del mozo: sin violaciones distintas de las conocidas', async ({ page }) => {
  await ingresarPin(page, 'comandas', PIN.MOZO);
  await expect(page).toHaveURL(/\/comandas$/);
  await page.waitForLoadState('networkidle');
  expect(await violaciones(page)).toEqual(CONOCIDAS.comandas);
});

test('Cocina tras el ingreso del cocinero: sin violaciones distintas de las conocidas', async ({ page }) => {
  await ingresarPin(page, 'cocina', PIN.COCINERO);
  await expect(page).toHaveURL(/\/cocina$/);
  await page.waitForLoadState('networkidle');
  expect(await violaciones(page)).toEqual(CONOCIDAS.cocina);
});

// Las ocho pantallas de Administración, con la sesión del administrador (AT-36 se cerró revisándolas a mano con axe;
// esta prueba lo mantiene cerrado). Una pantalla nueva de /admin va en esta lista.
const PANTALLAS_ADMIN = ['/admin', '/admin/caja', '/admin/costos', '/admin/historial', '/admin/inventario', '/admin/menu', '/admin/proveedores', '/admin/usuarios'];

for (const ruta of PANTALLAS_ADMIN) {
  test(`Administración ${ruta}: sin violaciones distintas de las conocidas`, async ({ page }) => {
    await ingresarPin(page, 'admin', PIN.ADMIN);
    await expect(page).toHaveURL(/\/admin$/);
    if (ruta !== '/admin') await page.goto(ruta);
    await page.waitForLoadState('networkidle');
    expect(await violaciones(page)).toEqual(CONOCIDAS.admin[`${test.info().project.name} ${ruta}`] ?? {});
  });
}
