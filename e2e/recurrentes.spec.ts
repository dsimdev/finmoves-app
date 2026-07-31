import { test, expect } from "./fixtures";
import { login, borrarMovimientoPorDescripcion } from "./fixtures";

// Recurrente: marcar "repetir" al cargar un Gasto crea el doc en /recurrentes (id
// determinístico por tipo+categoría+descripción+observaciones); la próxima vez que se
// carga la MISMA combinación, el toggle deja de ofrecerse y se muestra el badge
// informativo en su lugar (yaEsRecurrente en MovementAdd.tsx). Corre contra producción real.

test("marcar repetir crea el recurrente; la próxima carga ya no ofrece el toggle", async ({ page }) => {
  await login(page);
  await page.goto("/movements");

  const desc = `E2E_rec_${Date.now()}`;

  // 1) Alta con "Repetir cada período" marcado.
  await page.getByRole("button", { name: "Nuevo movimiento" }).click();
  const addDialog = page.getByRole("dialog", { name: "Nuevo movimiento" });
  await addDialog.getByRole("button", { name: "Servicios", exact: true }).click();
  await addDialog.locator('input[type="number"]').fill("30");
  await addDialog.locator('input[type="text"], input:not([type])').first().fill(desc);
  await addDialog.getByRole("button", { name: "Repetir cada período (recordatorio)" }).click();
  await addDialog.getByRole("button", { name: "Guardar", exact: true }).click();

  await expect(page.getByRole("button", { name: "Editar" }).filter({ hasText: desc })).toBeVisible({ timeout: 10_000 });

  // 2) Nueva alta con la MISMA combinación: ya no debe ofrecer el toggle "Repetir", sino el
  // badge informativo "Movimiento recurrente".
  await page.getByRole("button", { name: "Nuevo movimiento" }).click();
  const addDialog2 = page.getByRole("dialog", { name: "Nuevo movimiento" });
  await addDialog2.getByRole("button", { name: "Servicios", exact: true }).click();
  await addDialog2.locator('input[type="text"], input:not([type])').first().fill(desc);

  await expect(addDialog2.getByText("Movimiento recurrente")).toBeVisible();
  await expect(addDialog2.getByRole("button", { name: "Repetir cada período (recordatorio)" })).not.toBeVisible();
  await addDialog2.getByRole("button", { name: "Cerrar" }).click();

  // Cleanup: borrar el movimiento y el recurrente (Configuración → Notificaciones).
  await borrarMovimientoPorDescripcion(page, desc);

  await page.goto("/settings/notifications");
  const recRow = page.locator("div", { hasText: desc }).filter({ has: page.getByRole("button", { name: "Eliminar" }) }).last();
  await recRow.getByRole("button", { name: "Eliminar" }).click();
  await expect(page.getByText(desc)).not.toBeVisible({ timeout: 10_000 });
});
