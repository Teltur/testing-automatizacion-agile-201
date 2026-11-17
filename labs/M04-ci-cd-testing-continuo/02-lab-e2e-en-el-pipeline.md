# Lab — E2E en el pipeline

[← Página anterior](01-lab-primer-workflow.md) · [Siguiente página →](03-lab-reportes-html-y-allure.md)

Practicas las **pruebas E2E en CI**: qué necesita una suite de [Playwright](../glosario/02-e2e.md#playwright) para ejecutarse en una máquina
donde nadie ha arrancado la aplicación ni instalado navegadores. El ejercicio es un conversor de
temperaturas con tres pruebas que pasan si tú arrancas la app a mano; preparas su configuración para CI
(`webServer`, [reintentos](../glosario/02-e2e.md#reintento), `forbidOnly`) y escribes el [workflow](../glosario/04-ci-cd.md#workflow) que la ejecuta en GitHub Actions.

### Objetivo

Comprender qué es ejecutar pruebas E2E en CI: cómo funciona, cómo debe ser, cómo se detectan sus
debilidades y cómo se mejora.

### Punto de partida

- Tu fork del curso con un Codespace abierto y Actions habilitado (pestaña **Actions** → si aparece el
  aviso de forks, **I understand my workflows, go ahead and enable them**).
- Carpeta del ejercicio: [`ejercicios/M04-02-e2e-en-el-pipeline/`](../../ejercicios/M04-02-e2e-en-el-pipeline/README.md).
  La app (`app/server.mjs`) escucha en el puerto **3402** y responde `ok` en `/salud`.
- Solución: [`solucion/playwright.config.js`](../../ejercicios/M04-02-e2e-en-el-pipeline/solucion/playwright.config.js)
  y [`solucion/e2e.yml`](../../ejercicios/M04-02-e2e-en-el-pipeline/solucion/e2e.yml).

```bash
# Entra en la carpeta del ejercicio
cd ejercicios/M04-02-e2e-en-el-pipeline
```

### Qué está pasando

Una [prueba unitaria](../glosario/01-fundamentos.md#prueba-unitaria) solo necesita Node. Una prueba E2E necesita además **la aplicación en marcha** y **un
navegador**. En tu Codespace las dos cosas las pones tú (o ya estaban); el [runner](../glosario/04-ci-cd.md#runner) de CI es una máquina
recién creada que no tiene ninguna. Si la configuración de Playwright da por hecho que «alguien» ha
arrancado la app, en CI no hay nadie.

| En tu terminal | En el runner | Qué lo resuelve |
|----------------|--------------|-----------------|
| Arrancas la app en otro terminal | Nadie la arranca | `webServer` en `playwright.config.js` |
| Chromium instalado en el Codespace | Sin navegadores | `npx playwright install --with-deps chromium` o la [imagen oficial de Playwright](../glosario/04-ci-cd.md#imagen-de-playwright) |
| Muchos núcleos, nada más corriendo | Pocos núcleos compartidos | `workers: 1` en CI |
| Repites una prueba si falla por azar | Nadie repite | `retries: 2` en CI (y el reporte marca la prueba como inestable) |
| Un `test.only` para centrarte | Un `test.only` olvidado ejecutaría una sola prueba | `forbidOnly: true` en CI |

GitHub Actions define la variable de entorno `CI=true` en todos los [jobs](../glosario/04-ci-cd.md#job): la configuración la lee para
comportarse distinto en CI y en tu terminal.

### 1 — Ver la configuración de partida

Abre [`playwright.config.js`](../../ejercicios/M04-02-e2e-en-el-pipeline/playwright.config.js) en el
editor: tiene `baseURL` (`http://localhost:3402`) y un proyecto Chromium, y nada que arranque la app.

```js
// Configuración del lab M04-02 preparada para CI: arranca la app y se endurece cuando CI=true.
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  outputDir: './test-results', // evidencias dentro de la carpeta del ejercicio
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3402',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
```

### 2 — Ejecutar como lo haría el runner

Ejecutas las pruebas sin arrancar la app: es exactamente la situación del runner.

```bash
# Las pruebas, sin la app en marcha
npx playwright test
```

**Resultado esperado** (recortado: las tres pruebas fallan con el mismo error; los tiempos cambian):

```text
Running 3 tests using 1 worker

  ✘  1 [chromium] › tests/conversor.spec.js:7:1 › la página muestra el conversor (1.1s)
  ✘  2 [chromium] › tests/conversor.spec.js:12:1 › convierte 100 °C en 212 °F (1.1s)
  ✘  3 [chromium] › tests/conversor.spec.js:18:1 › convierte -40 °C en -40 °F (1.1s)


  1) [chromium] › tests/conversor.spec.js:7:1 › la página muestra el conversor ─────────────────────

    Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3402/
    Call log:
      - navigating to "http://localhost:3402/", waiting until "load"


      2 |
      3 | test.beforeEach(async ({ page }) => {
    > 4 |   await page.goto('/');
        |              ^
      5 | });
      6 |
      7 | test('la página muestra el conversor', async ({ page }) => {
        at /workspaces/testing-automatizacion-agile-201/ejercicios/M04-02-e2e-en-el-pipeline/tests/conversor.spec.js:4:14

    Error Context: test-results/conversor-la-página-muestra-el-conversor-chromium/error-context.md

  …

  3 failed
    [chromium] › tests/conversor.spec.js:7:1 › la página muestra el conversor ──────────────────────
    [chromium] › tests/conversor.spec.js:12:1 › convierte 100 °C en 212 °F ─────────────────────────
    [chromium] › tests/conversor.spec.js:18:1 › convierte -40 °C en -40 °F ─────────────────────────
```

`ERR_CONNECTION_REFUSED`: el navegador llega a `localhost:3402` y no hay nadie escuchando. No es un error
de la aplicación ni de las pruebas, es del **entorno**. Es lo primero que ve casi todo el mundo al llevar
una suite E2E a CI.

### 3 — Que la configuración arranque la app

Con `webServer`, Playwright arranca la app antes de las pruebas, espera a que una URL responda y la para
al terminar. Añade el bloque al final de `defineConfig`, después de `projects`:

```js
  // Arranca la app antes de las pruebas y espera a que responda /salud
  webServer: {
    command: 'node app/server.mjs',
    url: 'http://localhost:3402/salud',
    reuseExistingServer: !process.env.CI, // en local reutiliza la app si ya está arrancada
  },
```

```bash
# Las mismas pruebas: ahora Playwright arranca la app
npx playwright test
```

**Resultado esperado** (los tiempos cambian):

```text
Running 3 tests using 1 worker

  ✓  1 [chromium] › tests/conversor.spec.js:7:1 › la página muestra el conversor (155ms)
  ✓  2 [chromium] › tests/conversor.spec.js:12:1 › convierte 100 °C en 212 °F (181ms)
  ✓  3 [chromium] › tests/conversor.spec.js:18:1 › convierte -40 °C en -40 °F (124ms)

  3 passed (1.2s)
```

| Opción | Para qué |
|--------|----------|
| `command` | Cómo se arranca la app; se ejecuta en la carpeta de la configuración |
| `url` | Playwright espera a que responda con un 2xx o 3xx antes de lanzar la primera prueba |
| `reuseExistingServer: !process.env.CI` | En tu terminal, si la app ya está en marcha, la usa; en CI siempre arranca una nueva |

### 4 — Ajustes que solo se aplican en CI

El runner es otra máquina con otras reglas. Sustituye la configuración entera por esta, que lee `CI` para
endurecerse allí y seguir cómoda en tu terminal:

```js
// Configuración del lab M04-02 preparada para CI: arranca la app y se endurece cuando CI=true.
import { defineConfig, devices } from '@playwright/test';

const enCI = !!process.env.CI; // GitHub Actions define CI=true en todos los jobs

export default defineConfig({
  testDir: './tests',
  outputDir: './test-results', // evidencias dentro de la carpeta del ejercicio
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
    url: 'http://localhost:3402/salud',
    reuseExistingServer: !enCI, // en local reutiliza la app si ya está arrancada
  },
});
```

Lo pruebas como si fueras el runner, poniendo tú la variable:

```bash
# Simula el entorno de CI en tu terminal
CI=true npx playwright test
```

**Resultado esperado** (los tiempos cambian):

```text
Running 3 tests using 1 worker

  ✓  1 [chromium] › tests/conversor.spec.js:7:1 › la página muestra el conversor (139ms)
  ✓  2 [chromium] › tests/conversor.spec.js:12:1 › convierte 100 °C en 212 °F (151ms)
  ✓  3 [chromium] › tests/conversor.spec.js:18:1 › convierte -40 °C en -40 °F (125ms)

  3 passed (1.2s)
::notice title=🎭 Playwright Run Summary::  3 passed (1.2s)
```

La última línea la escribe el reporter `github`: en tu terminal es texto raro, pero en Actions esas líneas
`::notice` y `::error` se convierten en anotaciones del resumen de la ejecución.

### 5 — El workflow

Creas el workflow que instala dependencias y Chromium y lanza la suite. Créalo en la raíz del repositorio:

```bash
# Desde la raíz: crea el workflow y ábrelo en el editor
cd /workspaces/testing-automatizacion-agile-201
mkdir -p .github/workflows
code .github/workflows/e2e.yml
```

```yaml
name: E2E

on:
  push:
    paths:
      - 'ejercicios/M04-02-e2e-en-el-pipeline/**'
      - '.github/workflows/e2e.yml'
  pull_request:
    paths:
      - 'ejercicios/M04-02-e2e-en-el-pipeline/**'
      - '.github/workflows/e2e.yml'

jobs:
  playwright:
    name: Playwright
    runs-on: ubuntu-latest
    timeout-minutes: 15
    defaults:
      run:
        working-directory: ejercicios/M04-02-e2e-en-el-pipeline
    steps:
      - uses: actions/checkout@v7

      - uses: actions/setup-node@v7
        with:
          node-version: 22
          cache: npm

      # Dependencias de la raíz (incluye @playwright/test)
      - run: npm ci
        working-directory: .

      # Chromium y las librerías del sistema que necesita (el runner no los trae)
      - run: npx playwright install --with-deps chromium

      # La configuración del ejercicio arranca la app (webServer) y aplica los ajustes de CI
      - run: npx playwright test
```

| Paso | Por qué |
|------|---------|
| `timeout-minutes: 15` | Si algo se queda colgado (la app no arranca, un navegador no responde) el job muere a los 15 minutos y no a las 6 horas por defecto |
| `npx playwright install --with-deps chromium` | Descarga el Chromium de la versión exacta de `@playwright/test` y, con `--with-deps`, instala con `apt` las librerías del sistema que necesita |
| `npx playwright test` | Usa tu configuración: arranca la app con `webServer` y, como `CI=true`, aplica reintentos, un worker y `forbidOnly` |

### 6 — Subir y leer la ejecución

```bash
# Sube la configuración y el workflow
git add .github/workflows/e2e.yml ejercicios/M04-02-e2e-en-el-pipeline/playwright.config.js
git commit -m "E2E del conversor en GitHub Actions"
git push
```

En **Actions**, abre la ejecución de **E2E** y el job **Playwright**. Despliega
**Run npx playwright install --with-deps chromium** (descarga e instalación de paquetes) y
**Run npx playwright test** (la misma salida del paso 4).

El job **Playwright** termina en verde (los identificadores y tiempos cambian). Sus steps, con la
duración que muestra la página del job:

```text
✓ Playwright in 45s
  ✓ Set up job                                        1s
  ✓ Run actions/checkout@v7                           1s
  ✓ Run actions/setup-node@v7                         2s
  ✓ Run npm ci                                        19s
  ✓ Run npx playwright install --with-deps chromium   19s
  ✓ Run npx playwright test                           2s
  ✓ Post Run actions/setup-node@v7                    0s
  ✓ Post Run actions/checkout@v7                      0s
  ✓ Complete job                                      0s
```

Log del step **Run npx playwright test**:

```text
Running 3 tests using 1 worker

  ✓  1 [chromium] › tests/conversor.spec.js:7:1 › la página muestra el conversor (145ms)
  ✓  2 [chromium] › tests/conversor.spec.js:12:1 › convierte 100 °C en 212 °F (143ms)
  ✓  3 [chromium] › tests/conversor.spec.js:18:1 › convierte -40 °C en -40 °F (134ms)

  3 passed (1.3s)
##[notice]  3 passed (1.3s)
```

La línea `##[notice]` es la que escribe el reporter `github`: en el resumen de la ejecución aparece como
la anotación **🎭 Playwright Run Summary** con `3 passed (1.3s)`. Las pruebas tardan 2 s; casi todo el job
es preparar la máquina (`npm ci` y la instalación de Chromium).

> [!WARNING]
> Si copias a la carpeta del ejercicio el fichero `solucion/playwright.config.js` en vez de editar el tuyo,
> el job falla con `Error: Process from config.webServer was not able to start` y `Cannot find module
> '…/ejercicios/app/server.mjs'`: ese fichero lleva rutas `../` para ejecutarse desde `solucion/`.

Fíjate en la duración de cada step: la instalación de Chromium con sus dependencias suele pesar más que
las propias pruebas. Es el coste de partir de una máquina vacía.

## Comprueba tu entendimiento

**La app la arranca la configuración**
Comprueba que nada escucha en el 3402 y ejecuta las pruebas:

```bash
# Sin respuesta en el 3402… y aun así las pruebas pasan
curl -s http://localhost:3402/salud || echo "nadie escucha en el 3402"
npx playwright test
```

→ La primera línea dice `nadie escucha en el 3402` y las tres pruebas pasan: `webServer` arranca la app y
la para al terminar.

**`CI` cambia el comportamiento**
Ejecuta `npx playwright test` y `CI=true npx playwright test` y compara el final de la salida.
→ Solo con `CI=true` aparece la línea `::notice title=🎭 Playwright Run Summary::`.

## Experimenta

### Un `test.only` olvidado

Predice qué pasa en tu terminal y qué pasaría en CI si alguien deja `test.only` en una prueba. Cambia en
`tests/conversor.spec.js` `test('convierte 100 °C en 212 °F'` por `test.only('convierte 100 °C en 212 °F'`
y ejecuta las dos variantes:

```bash
# Sin CI: Playwright obedece al .only
npx playwright test
# Como en CI: forbidOnly lo prohíbe
CI=true npx playwright test
```

**Resultado esperado** de la primera (los tiempos cambian):

```text
Running 1 test using 1 worker

  ✓  1 [chromium] › tests/conversor.spec.js:12:6 › convierte 100 °C en 212 °F (195ms)

  1 passed (895ms)
```

**Resultado esperado** de la segunda:

```text
Error: item focused with '.only' is not allowed due to the 'forbidOnly' option in '../playwright.config.js': "conversor.spec.js convierte 100 °C en 212 °F"

   at conversor.spec.js:12

  10 | });
  11 |
> 12 | test.only('convierte 100 °C en 212 °F', async ({ page }) => {
     |      ^
  13 |   await page.getByLabel('Grados Celsius').fill('100');
  14 |   await page.getByRole('button', { name: 'Convertir' }).click();
  15 |   await expect(page.getByRole('status')).toHaveText('100 °C = 212 °F');
::error ::Error: item focused with '.only' is not allowed due to the 'forbidOnly' option in '../playwright.config.js': "conversor.spec.js convierte 100 °C en 212 °F"%0A%0A   at conversor.spec.js:12%0A%0A  10 | });%0A  11 |%0A> 12 | test.only('convierte 100 °C en 212 °F', async ({ page }) => {%0A     |      ^%0A  13 |   await page.getByLabel('Grados Celsius').fill('100');%0A  14 |   await page.getByRole('button', { name: 'Convertir' }).click();%0A  15 |   await expect(page.getByRole('status')).toHaveText('100 °C = 212 °F');

::notice title=🎭 Playwright Run Summary::
```

Sin `forbidOnly`, el job habría salido en verde con **una** prueba de tres: un verde que miente. Quita el
`.only`.

### Los reintentos en CI

Predice cuántas veces se ejecuta una prueba que falla siempre si `retries` vale 2. Cambia en la última
prueba el texto esperado `'-40 °C = -40 °F'` por `'-40 °C = 40 °F'` y ejecuta como en CI:

```bash
# Una prueba rota con los reintentos de CI
CI=true npx playwright test
```

**Resultado esperado** (primeras líneas; los tiempos cambian):

```text
Running 3 tests using 1 worker

  ✓  1 [chromium] › tests/conversor.spec.js:7:1 › la página muestra el conversor (122ms)
  ✓  2 [chromium] › tests/conversor.spec.js:12:1 › convierte 100 °C en 212 °F (175ms)
  ✘  3 [chromium] › tests/conversor.spec.js:18:1 › convierte -40 °C en -40 °F (5.2s)
  ✘  4 [chromium] › tests/conversor.spec.js:18:1 › convierte -40 °C en -40 °F (retry #1) (5.2s)
  ✘  5 [chromium] › tests/conversor.spec.js:18:1 › convierte -40 °C en -40 °F (retry #2) (5.4s)
```

y al final:

```text
  1 failed
    [chromium] › tests/conversor.spec.js:18:1 › convierte -40 °C en -40 °F ─────────────────────────
  2 passed (19.1s)
```

Tres intentos de unos 5 s cada uno (el `timeout` de `expect`): una prueba **rota** no se arregla
reintentando, solo cuesta más. Los reintentos sirven para que un fallo **ocasional** se vea como
`flaky` en lugar de tumbar el [pipeline](../glosario/04-ci-cd.md#pipeline), no para esconder errores. Deja el texto como estaba.

## Reto

### 1 — El job dentro de la imagen de Playwright

**La situación:** en tu pipeline, `npx playwright install --with-deps chromium` se repite en cada
ejecución. Un compañero propone ejecutar el job directamente dentro de la imagen oficial de Playwright, que
ya trae Node y los navegadores de la versión `1.65.1`.

**Qué haces:** creas un segundo workflow, `.github/workflows/e2e-contenedor.yml`, que lanzas a mano y cuyo
job corre en el contenedor `mcr.microsoft.com/playwright:v1.65.1-noble`. Comparas su duración con la del
workflow **E2E**.

**Pistas:** `on: workflow_dispatch` para lanzarlo con **Run workflow**; `container.image` en el job;
`options: --user 1001` (el usuario del runner, dueño de la carpeta de trabajo); sin `setup-node` ni
`playwright install`.

**Lo que buscas:** una ejecución en verde del job en contenedor, sin step de instalación de navegadores,
y su duración frente a la del workflow **E2E**.

<details>
<summary>Ver solución</summary>

[`solucion/e2e-contenedor.yml`](../../ejercicios/M04-02-e2e-en-el-pipeline/solucion/e2e-contenedor.yml):

```yaml
name: E2E en contenedor

on:
  workflow_dispatch:

jobs:
  playwright:
    name: Playwright (imagen oficial)
    runs-on: ubuntu-latest
    timeout-minutes: 15
    container:
      image: mcr.microsoft.com/playwright:v1.65.1-noble # misma versión que @playwright/test
      options: --user 1001 # el mismo usuario que el runner, dueño de la carpeta de trabajo
    defaults:
      run:
        working-directory: ejercicios/M04-02-e2e-en-el-pipeline
    steps:
      - uses: actions/checkout@v7
      - run: npm ci
        working-directory: .
      # Sin "playwright install": los navegadores ya están en la imagen
      - run: npx playwright test
```

```bash
# Sube el workflow y lánzalo a mano (también: Actions → E2E en contenedor → Run workflow)
git add .github/workflows/e2e-contenedor.yml
git commit -m "E2E en la imagen de Playwright"
git push
gh workflow run e2e-contenedor.yml
```

```text
✓ main E2E en contenedor · 44191327281
Triggered via workflow_dispatch about 1 minute ago

✓ Playwright (imagen oficial) in 1m12s
  ✓ Set up job                    1s
  ✓ Initialize containers         32s
  ✓ Run actions/checkout@v7       2s
  ✓ Run npm ci                    24s
  ✓ Run npx playwright test       2s
  ✓ Post Run actions/checkout@v7  0s
  ✓ Stop containers               7s
  ✓ Complete job                  0s
```

Dentro de **Initialize containers**, el runner descarga la imagen:

```text
/usr/bin/docker pull mcr.microsoft.com/playwright:v1.65.1-noble
v1.65.1-noble: Pulling from playwright
…
Status: Downloaded newer image for mcr.microsoft.com/playwright:v1.65.1-noble
```

Ya no hay step de instalación de navegadores, pero el job ha tardado **1m12s** frente a **45s** del
workflow **E2E**: descargar la imagen (32 s) cuesta más que instalar solo Chromium (19 s). La imagen
gana en reproducibilidad (mismas librerías del sistema que en tu contenedor de pruebas), no en velocidad.

El tiempo no desaparece: se mueve de instalar Chromium a descargar la imagen (*Initialize containers*).
Lo que se gana es que el entorno es **idéntico** en cada ejecución y en cualquier máquina que use la
misma imagen. **La regla:** la etiqueta de la imagen tiene que coincidir con la versión de
`@playwright/test`; si actualizas una, actualizas la otra.

</details>

## Errores frecuentes

| Síntoma | Causa probable | Cómo arreglarlo |
|---------|----------------|-----------------|
| `net::ERR_CONNECTION_REFUSED at http://localhost:3402/` | Nadie ha arrancado la app (en CI, nunca) | Paso 3: `webServer` en la configuración |
| `Error: Timed out waiting 60000ms from config.webServer.` | La app no arranca o `url` no responde (ruta o puerto equivocados) | Ejecuta el `command` a mano y prueba la `url` con `curl` |
| `browserType.launch: Executable doesn't exist at …/chromium_headless_shell-…` | El runner no tiene navegadores | Step `npx playwright install --with-deps chromium` antes de las pruebas |
| `Error: http://localhost:3402/salud is already used` en tu terminal con `CI=true` | Tienes la app arrancada en otro terminal y en CI no se reutiliza | Para la app (`Ctrl+C` en su terminal) o ejecuta sin `CI=true` |
| `item focused with '.only' is not allowed` | Un `test.only` olvidado y `forbidOnly` activo | Quita el `.only`; es la protección funcionando |
| El job tarda mucho en *Run npx playwright install --with-deps chromium* | Instala paquetes del sistema en cada ejecución | Es normal; el reto muestra la alternativa con la imagen oficial |

## Conclusiones

### Qué es ejecutar pruebas E2E en CI

Lanzar la suite de navegador en una máquina que no tiene nada: el workflow le pone Node, dependencias y
Chromium, y la configuración de Playwright arranca la aplicación y se adapta a CI leyendo `CI=true`.

### Cómo debe ser

| Requisito | En el lab |
|-----------|-----------|
| La suite no depende de que alguien arranque la app | `webServer` con `url: …/salud` |
| El runner tiene el navegador de la versión exacta | `npx playwright install --with-deps chromium` (o la imagen `v1.65.1-noble`) |
| CI es más estricto que tu terminal | `forbidOnly`, `retries: 2`, `workers: 1` solo con `CI` |
| El resultado se lee sin entrar en el log | Reporter `github`: resumen y anotaciones en la ejecución |
| Un cuelgue no consume horas | `timeout-minutes: 15` |

### Dónde se rompe y cómo lo has detectado

| Fallo | Cómo lo has visto | Qué provoca |
|-------|-------------------|-------------|
| App sin arrancar | Paso 2: `ERR_CONNECTION_REFUSED` en las tres pruebas | Todo rojo por el entorno, no por el código |
| `test.only` olvidado | Experimenta: 1 prueba de 3 en verde sin `CI`; error con `CI=true` | Sin `forbidOnly`, un verde falso en CI |
| Reintentos sobre una prueba rota | Experimenta: tres intentos de ~5 s y sigue en rojo | Más tiempo de pipeline sin arreglar nada |

### Cómo se perfecciona

Con la imagen oficial de Playwright para un entorno fijo (reto), reporte y trazas como [artefactos](../glosario/04-ci-cd.md#artefacto) para
diagnosticar sin reproducir (lab 04), y repartiendo la suite en varios jobs (`--shard`) cuando crece.

### En una frase

> 🔑 En CI nadie arranca nada por ti: la configuración levanta la app, el workflow pone el navegador y
> `CI=true` endurece las reglas.
