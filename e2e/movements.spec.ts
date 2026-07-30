import { test, expect } from "./fixtures";
import { login } from "./fixtures";

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
  const rowHandle = page.getByRole("button", { name: "Editar" }).filter({ hasText: desc });
  await expect(rowHandle).toBeVisible({ timeout: 10_000 });

  // Cleanup: swipe hacia la izquierda sobre la fila (gesto táctil real; el borrado no tiene
  // botón directo) para revelar el tacho y borrar el movimiento de prueba.
  const box = await rowHandle.boundingBox();
  if (!box) throw new Error("No se pudo ubicar la fila del movimiento creado para limpiarla");
  const y = box.y + box.height / 2;
  const startX = box.x + box.width - 10;
  const endX = box.x + 20;
  await rowHandle.dispatchEvent("touchstart", { touches: [{ clientX: startX, clientY: y, identifier: 0 }] });
  await rowHandle.dispatchEvent("touchmove", { touches: [{ clientX: endX, clientY: y, identifier: 0 }] });
  await rowHandle.dispatchEvent("touchend", { changedTouches: [{ clientX: endX, clientY: y, identifier: 0 }] });

  await page.getByRole("button", { name: "Eliminar" }).first().click();
  await page.getByRole("button", { name: "Sí, eliminar" }).click();
  await expect(rowHandle).not.toBeVisible({ timeout: 10_000 });
});
