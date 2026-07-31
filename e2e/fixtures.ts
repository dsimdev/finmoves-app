import { test as base, expect, type Page } from "@playwright/test";

// Credenciales del usuario de prueba dedicado (Firebase de producción, uid propio y
// aislado). Nunca hardcodear: si faltan, los tests fallan temprano con un mensaje claro
// en vez de un timeout confuso en el formulario de login.
export function testCredentials() {
  const email = process.env.PLAYWRIGHT_TEST_EMAIL;
  const password = process.env.PLAYWRIGHT_TEST_PASSWORD;
  if (!email || !password) {
    throw new Error("Faltan PLAYWRIGHT_TEST_EMAIL / PLAYWRIGHT_TEST_PASSWORD en .env.local");
  }
  return { email, password };
}

export async function login(page: Page) {
  const { email, password } = testCredentials();
  await page.goto("/login");
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: /ingresar|sign in/i }).click();
  await expect(page).toHaveURL("/", { timeout: 15_000 });
}

// Swipe táctil hacia la izquierda sobre una fila para revelar el tacho (y opcionalmente
// el lápiz) — el borrado/editar de una fila no tienen botón directo, solo gesto (ver
// components/ui/SwipeToDelete.tsx: pointerEvents solo se habilita con la fila "abierta",
// que requiere pad >= PANEL_W/2 al soltar). Se dispara en varios pasos (no un solo salto)
// porque el primer touchmove con desplazamiento < 8px se descarta (detección de horizontal
// vs vertical) y el pad tiene fricción ×0.6 sobre el delta acumulado.
export async function swipeLeft(row: import("@playwright/test").Locator) {
  const box = await row.boundingBox();
  if (!box) throw new Error("No se pudo ubicar la fila para swipear");
  const y = box.y + box.height / 2;
  const startX = box.x + box.width - 10;
  await row.dispatchEvent("touchstart", { touches: [{ clientX: startX, clientY: y, identifier: 0 }] });
  const steps = 8;
  const totalDx = box.width - 30; // desplazamiento total: mucho más que PANEL_W (2×46), sobra margen
  for (let i = 1; i <= steps; i++) {
    const x = startX - (totalDx * i) / steps;
    await row.dispatchEvent("touchmove", { touches: [{ clientX: x, clientY: y, identifier: 0 }] });
  }
  await row.dispatchEvent("touchend", { changedTouches: [{ clientX: startX - totalDx, clientY: y, identifier: 0 }] });
}

// Borra (vía swipe) el movimiento cuya fila contiene `desc`. Usado como cleanup en tests
// que cargan datos de prueba: deja la cuenta como la encontraron.
export async function borrarMovimientoPorDescripcion(page: Page, desc: string) {
  const row = page.getByRole("button", { name: "Editar" }).filter({ hasText: desc });
  await expect(row).toBeVisible({ timeout: 10_000 });
  await swipeLeft(row);
  await page.getByRole("button", { name: "Eliminar" }).first().click();
  await page.getByRole("button", { name: "Sí, eliminar" }).click();
  await expect(row).not.toBeVisible({ timeout: 10_000 });
}

export const test = base;
export { expect };
