import { test, expect } from "./fixtures";
import { login, borrarMovimientoPorDescripcion, swipeLeft } from "./fixtures";

// Smoke E2E del circuito más crítico: login + alta de un movimiento. Corre contra el
// Firebase de producción real con un usuario de prueba dedicado (uid propio, aislado del
// resto). La descripción con prefijo E2E_ deja el movimiento identificable para limpieza
// manual si hiciera falta.

test("login y alta de un gasto simple", async ({ page }) => {
  await login(page);

  await page.goto("/movements");
  await page.getByRole("button", { name: "Nuevo movimiento" }).click();

  // Tipo Gasto ya viene seleccionado por defecto; completar categoría, monto y descripción.
  const dialog = page.getByRole("dialog", { name: "Nuevo movimiento" });
  await dialog.getByRole("button", { name: "Comida", exact: true }).click();

  await dialog.locator('input[type="number"]').fill("123");
  const desc = `E2E_${Date.now()}`;
  await dialog.getByRole("combobox").fill(desc);

  await dialog.getByRole("button", { name: "Guardar", exact: true }).click();

  // El alta es optimista: aparece en la lista sin recargar. La fila entera es un botón
  // "Editar" (aria-label fijo) que contiene el texto de la descripción.
  await expect(page.getByRole("button", { name: "Editar" }).filter({ hasText: desc })).toBeVisible({ timeout: 10_000 });

  await borrarMovimientoPorDescripcion(page, desc);
});

test("editar un movimiento existente: monto, descripción y medio de pago", async ({ page }) => {
  await login(page);
  await page.goto("/movements");

  // Alta de un movimiento propio para este test (no se edita data ajena de la cuenta).
  await page.getByRole("button", { name: "Nuevo movimiento" }).click();
  const addDialog = page.getByRole("dialog", { name: "Nuevo movimiento" });
  await addDialog.getByRole("button", { name: "Transporte", exact: true }).click();
  await addDialog.locator('input[type="number"]').fill("50");
  const descOriginal = `E2E_edit_${Date.now()}`;
  // El campo Descripción es un input[type=text] simple; solo tiene `list=` (combobox) cuando
  // hay descripciones previas para autocompletar en esa categoría. Es el primero (antes de
  // Observaciones) en el orden del form.
  await addDialog.locator('input[type="text"]').first().fill(descOriginal);
  await addDialog.getByRole("button", { name: "Guardar", exact: true }).click();

  const row = page.getByRole("button", { name: "Editar" }).filter({ hasText: descOriginal });
  await expect(row).toBeVisible({ timeout: 10_000 });

  // Swipe para revelar lápiz+tacho: SwipeToDelete envuelve la fila en 2 divs intermedios
  // (touch handlers + wrapper de animación) antes del rootRef que también contiene el panel
  // de acciones — hay que subir 3 niveles, no 1. El lápiz tiene el MISMO aria-label "Editar"
  // que la fila-botón; se distingue por ser el PRIMERO en orden de documento (el panel de
  // acciones se renderiza antes que el contenido).
  await swipeLeft(row);
  const swipeContainer = row.locator("xpath=../../..");
  await swipeContainer.getByRole("button", { name: "Editar" }).first().click();

  // CenterCard (a diferencia de BottomSheet) no tiene role="dialog": se ancla por el título
  // visible. Solo hay UN modal abierto a la vez, así que los campos se ubican en toda la
  // página sin necesitar scope (mismo patrón que ya funciona en el alta).
  await expect(page.getByText("Editar movimiento")).toBeVisible();

  const descNueva = `E2E_edit_${Date.now()}_v2`;
  await page.locator('input[type="number"]').fill("75");
  await page.locator('input:not([type])').first().fill(descNueva); // Descripción: <input> sin type explícito
  await page.getByRole("button", { name: "Débito", exact: true }).click();

  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page.getByText("Editar movimiento")).not.toBeVisible();

  // La fila refleja los cambios sin recargar (actualización optimista).
  const rowEditada = page.getByRole("button", { name: "Editar" }).filter({ hasText: descNueva });
  await expect(rowEditada).toBeVisible({ timeout: 10_000 });
  await expect(rowEditada.getByText("-$75,00")).toBeVisible();

  await borrarMovimientoPorDescripcion(page, descNueva);
});
