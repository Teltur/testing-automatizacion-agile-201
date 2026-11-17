// Comprueba que las herramientas del curso están instaladas y dice su versión.
// Uso: npm run verificar
import { execSync } from 'node:child_process';

const herramientas = [
  ['Node.js', 'node --version'],
  ['npm', 'npm --version'],
  ['Vitest', 'npx --no-install vitest --version'],
  ['Playwright', 'npx --no-install playwright --version'],
  ['Cypress', 'npx --no-install cypress --version --component package'],
  // Los binarios: el paquete puede estar y el navegador no (instalación cortada)
  ['Chromium', "ls -d ~/.cache/ms-playwright/chromium-* | head -1 | xargs basename"],
  ['Cypress app', 'npx --no-install cypress verify >/dev/null && echo verificado'],
  ['Newman', 'npx --no-install newman --version'],
  ['Prism', 'npx --no-install prism --version'],
  ['Allure', 'npx --no-install allure --version'],
  ['Docker', 'docker --version'],
  ['GitHub CLI', 'gh --version'],
];

let fallos = 0;
for (const [nombre, comando] of herramientas) {
  try {
    const salida = execSync(comando, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim().split('\n')[0];
    console.log(`OK     ${nombre.padEnd(11)} ${salida}`);
  } catch {
    fallos++;
    console.log(`FALTA  ${nombre.padEnd(11)} (no responde: ${comando})`);
  }
}
console.log(fallos ? `\n${fallos} herramienta(s) sin instalar` : '\nEntorno listo');
process.exit(fallos ? 1 : 0);
