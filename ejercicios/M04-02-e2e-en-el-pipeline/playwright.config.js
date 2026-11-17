// Solución del lab M04-02: la configuración preparada para ejecutarse en CI.
// Ejecútala desde la carpeta del ejercicio: npx playwright test --config solucion/playwright.config.js
// (las rutas llevan ../ porque este fichero está en solucion/)
import { defineConfig, devices } from '@playwright/test';

const enCI = !!process.env.CI; // GitHub Actions define CI=true en todos los jobs

export default defineConfig({
  testDir: '../tests',
  outputDir: '../test-results', // evidencias dentro de la carpeta del ejercicio
  forbidOnly: enCI, // en CI, un test.only olvidado hace fallar la ejecución
  retries: enCI ? 2 : 0, // en CI, reintenta dos veces antes de dar una prueba por fallida
  workers: enCI ? 1 : undefined, // en CI, una prueba detrás de otra
  reporter: enCI ? [['list'], ['github']] : 'list', // en CI, además, anotaciones en el resumen del job
  use: {
    baseURL: 'http://localhost:3402',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Arranca la app antes de las pruebas y espera a que responda /salud
  webServer: {
    command: 'node app/server.mjs',
    cwd: '..', // la carpeta del ejercicio
    url: 'http://localhost:3402/salud',
    reuseExistingServer: !enCI, // en local reutiliza la app si ya está arrancada
  },
});
