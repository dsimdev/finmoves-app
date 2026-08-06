import { test, expect } from "./fixtures";
import { login } from "./fixtures";

// Badge de "ritmo necesario" en la meta de ahorro propia: si la meta tiene fecha y el ritmo
// actual no alcanza para llegar a tiempo, muestra cuánto más hace falta ahorrar por período.
// Silencio si no hay fecha o si el ritmo ya alcanza — solo se prueba el caso "atrasado", que
// es fácil de forzar con una fecha muy próxima y un monto alto.

test("el badge de ritmo necesario aparece con una meta de fecha próxima e imposible al ritmo actual", async ({ page }) => {
  await login(page);

  await page.goto("/settings/investment");
  // "Meta de ahorro" (exact) es el título de la sección propia; hay otro texto parecido en la
  // sección FX ("meta de aho..." dentro de una frase), por eso exact:true. 3 niveles arriba
  // del label está la card completa (1 input number, 1 input date, 1 botón guardar).
  const goalTitle = page.getByText("Meta de ahorro", { exact: true });
  await expect(goalTitle).toBeVisible({ timeout: 15_000 });
  const goalSection = goalTitle.locator("xpath=../../..");
  const montoInput = goalSection.locator('input[type="number"]');
  const fechaInput = goalSection.locator('input[type="date"]');
  const saveBtn = goalSection.locator("button").first();

  try {
    // Monto muy alto + fecha de mañana: imposible de alcanzar al ritmo real → fuerza atraso.
    // El monto varía con Date.now() para garantizar "dirty" sin importar el valor que haya
    // quedado de una corrida anterior (mismo día → misma fecha "mañana" en dos corridas).
    await montoInput.fill(String(900_000_000 + (Date.now() % 90_000_000)));
    const mañana = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    await fechaInput.fill(mañana);
    await expect(saveBtn).toBeEnabled({ timeout: 5_000 });
    await saveBtn.click();
    await expect(saveBtn).toBeDisabled({ timeout: 10_000 });

    await page.goto("/investments");
    await expect(page.getByText(/Necesitás .* más por período para llegar el/)).toBeVisible({ timeout: 10_000 });
  } finally {
    // Cleanup: vaciar monto y fecha.
    await page.goto("/settings/investment");
    await expect(goalTitle).toBeVisible({ timeout: 15_000 });
    await montoInput.fill("");
    await fechaInput.fill("");
    if (await saveBtn.isEnabled()) {
      await saveBtn.click();
      await expect(saveBtn).toBeDisabled({ timeout: 10_000 });
    }
  }
});
