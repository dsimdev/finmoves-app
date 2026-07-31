import { test, expect } from "./fixtures";
import { login, swipeLeft } from "./fixtures";

// Reserva FX (Compra USD) desde Inversión: circuito separado del alta normal de
// Movimientos — usa reserveMode (MovementAdd con TIPOS de reserva) y el detalle readOnly
// (MovementDetail con fxComoHeroe). Corre contra el Firebase de producción real.

test("cargar y borrar una compra de reserva USD desde Inversión", async ({ page }) => {
  await login(page);
  await page.goto("/investments");

  await page.getByRole("button", { name: "Historial USD" }).click();
  await page.getByRole("button", { name: "Reserva" }).click();

  const addDialog = page.getByRole("dialog", { name: "Reserva" });
  await expect(addDialog).toBeVisible();

  // Compra ya viene seleccionada por defecto (primer tipo de la lista en reserveMode).
  await addDialog.getByRole("button", { name: "Compra", exact: true }).click();

  // Grid: cantidad USD + cotización. Ambos son inputs number sin más distinción que el orden.
  const numberInputs = addDialog.locator('input[type="number"]');
  await numberInputs.nth(0).fill("10");
  await numberInputs.nth(1).fill("1000");

  await addDialog.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(addDialog).not.toBeVisible();

  // Vuelve a Movimientos (la reserva se lista ahí con tipo CompraUSD) para verificar y limpiar
  // — mismo mecanismo de swipe que el resto de la lista.
  await page.goto("/movements");
  const row = page.getByRole("button", { name: "Editar" }).filter({ hasText: "-$10.000,00" }).first();
  await expect(row).toBeVisible({ timeout: 10_000 });

  await swipeLeft(row);
  const swipeContainer = row.locator("xpath=../../..");
  await swipeContainer.getByRole("button", { name: "Eliminar" }).click();
  await page.getByRole("button", { name: "Sí, eliminar" }).click();
  await expect(row).not.toBeVisible({ timeout: 10_000 });
});
