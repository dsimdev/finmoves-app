import { defineConfig, devices } from "@playwright/test";

// E2E mínimo contra el Firebase de producción real, con un usuario de prueba dedicado
// (PLAYWRIGHT_TEST_EMAIL/PLAYWRIGHT_TEST_PASSWORD en .env.local, nunca en el repo). No hay
// staging: los tests corren contra datos propios de ese uid, aislados del resto de usuarios.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // un solo usuario de prueba: tests en paralelo pisarían su propio estado
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    // Mobile: la app es mobile-first (BottomSheet/CenterCard); el layout desktop
    // (components/desktop/*) es una vista separada, fuera del alcance de este E2E.
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
