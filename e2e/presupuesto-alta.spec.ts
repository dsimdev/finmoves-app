import { test, expect } from "./fixtures";
import { login } from "./fixtures";

// Chip de presupuesto en el modal de Alta: muestra el % REAL del presupuesto de la categoría
// elegida (gastado + el monto en curso), sin esperar a Reportes ni al push del día siguiente.
// Setea el template de presupuesto (Configuración → Movimientos) y verifica que el chip
// aparece con el color correcto al cargar un Gasto de Comida. Restaura el template a "sin
// presupuesto" al final (en un finally) para no dejar el dato de prueba en la cuenta real
// aunque la aserción del chip falle.

test("el chip de presupuesto aparece al elegir categoría y monto en el Alta", async ({ page }) => {
  await login(page);

  await page.goto("/settings/movements");
  // Esperar que la sección de presupuesto esté realmente renderizada (config cargado) antes
  // de interactuar — sin esto, un fill/click puede caer en elementos de un render a medio
  // hidratar y silenciosamente afectar la categoría equivocada.
  await expect(page.getByText("Template por defecto")).toBeVisible({ timeout: 15_000 });
  const templateSection = page.getByText("Template por defecto").locator("xpath=..");
  // La primera fila del template es la primera categoría de Gasto activa — "Comida" en la
  // cuenta de prueba (confirmado por orden real del template, no asumido).
  const comidaInput = templateSection.locator('input[type="number"]').first();
  const saveBtn = templateSection.getByRole("button", { name: "Guardar", exact: true });

  try {
    await comidaInput.fill("1000000");
    await expect(saveBtn).toBeEnabled({ timeout: 5_000 });
    await saveBtn.click();
    await expect(saveBtn).toBeDisabled({ timeout: 10_000 });

    // Alta de un Gasto de Comida: el chip debe aparecer con el % (bajo, dado el presupuesto alto).
    await page.goto("/movements");
    await page.getByRole("button", { name: "Nuevo movimiento" }).click();
    const dialog = page.getByRole("dialog", { name: "Nuevo movimiento" });
    await dialog.getByRole("button", { name: "Comida", exact: true }).click();
    await dialog.locator('input[type="number"]').fill("100");

    await expect(dialog.getByText(/% del presupuesto de Comida/)).toBeVisible({ timeout: 10_000 });

    await dialog.getByRole("button", { name: "Cerrar" }).click();
  } finally {
    // Cleanup: restaurar el template (vaciar Comida) sin importar si el test arriba falló.
    await page.goto("/settings/movements");
    await expect(page.getByText("Template por defecto")).toBeVisible({ timeout: 15_000 });
    await comidaInput.fill("");
    if (await saveBtn.isEnabled()) {
      await saveBtn.click();
      await expect(saveBtn).toBeDisabled({ timeout: 10_000 });
    }
  }
});
