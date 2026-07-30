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

export const test = base;
export { expect };
