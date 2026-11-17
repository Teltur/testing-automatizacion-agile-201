# Lab — Publicar artefactos

[← Página anterior](03-lab-reportes-html-y-allure.md) · [Siguiente página →](05-lab-puerta-de-calidad.md)

Practicas los [artefactos](../glosario/04-ci-cd.md#artefacto) de CI: los ficheros que un [job](../glosario/04-ci-cd.md#job) guarda para
que alguien los descargue cuando ya ha terminado. El ejercicio es una lista de tareas con tres pruebas de
[Playwright](../glosario/02-e2e.md#playwright) que generan un [reporte HTML](../glosario/04-ci-cd.md#reporte-html) y, si fallan, una traza. Partes de
un [workflow](../glosario/04-ci-cd.md#workflow) que sube el reporte… salvo cuando más falta hace, lo arreglas para que suba reporte y trazas
también cuando las pruebas fallan, y abres en tu Codespace la traza descargada.

### Objetivo

Comprender qué es un artefacto de CI: cómo funciona, cómo debe ser, cómo se detectan sus debilidades y
cómo se mejora.

### Punto de partida

- Tu fork del curso con un Codespace abierto y Actions habilitado (pestaña **Actions** → si aparece el
  aviso de forks, **I understand my workflows, go ahead and enable them**).
- Carpeta del ejercicio: [`ejercicios/M04-04-publicar-artefactos/`](../../ejercicios/M04-04-publicar-artefactos/README.md).
  La app escucha en el puerto **3404** y la arranca Playwright (`webServer`).
- Workflow de partida: [`artefactos.yml`](../../ejercicios/M04-04-publicar-artefactos/artefactos.yml).
  Solución: [`solucion/artefactos.yml`](../../ejercicios/M04-04-publicar-artefactos/solucion/artefactos.yml).

```bash
# Entra en la carpeta del ejercicio
cd ejercicios/M04-04-publicar-artefactos
```

### Qué está pasando

Cada job corre en una máquina que GitHub destruye al terminar. Todo lo que la suite escribe en disco
—el reporte HTML, las trazas, los pantallazos— desaparece con ella, salvo lo que el workflow **sube como
artefacto** con `actions/upload-artifact`. El artefacto queda asociado a la ejecución, se descarga desde la
web o con `gh run download` y caduca a los días que digas.

El detalle que lo decide todo: los steps se ejecutan **mientras los anteriores van bien**. Si el step de
pruebas falla, los siguientes se saltan… y el de subir el reporte también, salvo que lleve una condición
`if`.

| Condición | Cuándo se ejecuta el step |
|-----------|---------------------------|
| (ninguna) = `success()` | Solo si todos los anteriores han ido bien |
| `failure()` | Solo si alguno anterior ha fallado |
| `!cancelled()` | Siempre, salvo que alguien cancele la ejecución |
| `always()` | Siempre, incluso cancelada |

| Pieza | Qué es |
|-------|--------|
| `playwright.config.js` | Reporter `html` en `./playwright-report` y `trace: 'retain-on-failure'` (traza solo de lo que falla) |
| `artefactos.yml` | El workflow de partida: ejecuta las pruebas y sube el reporte, sin condición |

### 1 — Lo que deja la suite en disco

Ejecutas las pruebas en tu terminal y miras qué ficheros quedan: es lo que podría subirse como artefacto.

```bash
# Ejecuta la suite y lista lo que ha generado
npx playwright test
ls playwright-report test-results
```

**Resultado esperado** (los tiempos cambian):

```text
Running 3 tests using 1 worker

  ✓  1 [chromium] › tests/tareas.spec.js:7:1 › empieza sin tareas (203ms)
  ✓  2 [chromium] › tests/tareas.spec.js:12:1 › añade una tarea (153ms)
  ✓  3 [chromium] › tests/tareas.spec.js:19:1 › añade dos tareas en orden (191ms)

  3 passed (1.4s)
playwright-report:
index.html

test-results:
```

Con todo en verde, el reporte es un único `index.html` y `test-results/` está vacío: con
`retain-on-failure` no se guarda traza de lo que pasa.

### 2 — El workflow de partida en Actions

Copias el workflow de partida a la raíz y lo subes. Ábrelo antes en el editor: el último step sube
`ejercicios/M04-04-publicar-artefactos/playwright-report/` con el nombre `reporte-html`.

```bash
# Desde la raíz: copia el workflow de partida y súbelo
cd /workspaces/testing-automatizacion-agile-201
mkdir -p .github/workflows
cp ejercicios/M04-04-publicar-artefactos/artefactos.yml .github/workflows/artefactos.yml
git add .github/workflows/artefactos.yml
git commit -m "Workflow de artefactos (versión de partida)"
git push
```

**Resultado esperado:** en **Actions**, la ejecución de **Artefactos** termina en verde y, al final de la
página de la ejecución, la sección **Artifacts** lista `reporte-html` con su tamaño.

Desde el terminal, `gh run view` lista los artefactos al final (el identificador cambia):

```bash
# Resumen de la última ejecución del workflow de artefactos
gh run view $(gh run list --workflow artefactos.yml --limit 1 --json databaseId --jq '.[0].databaseId')
```

```text
✓ main Artefactos · 44191671719
Triggered via push less than a minute ago

JOBS
✓ E2E con reporte in 50s (ID 134422395422)

ARTIFACTS
reporte-html
```

En la página de la ejecución, la sección **Artifacts** muestra `reporte-html` con su tamaño (unos
190 KB) y la fecha en que caduca: sin `retention-days`, a los 90 días.

### 3 — Romper una prueba y ver qué se pierde

Ahora una prueba falla, que es justo cuando el reporte hace falta. En `tests/tareas.spec.js`, en la prueba
`añade dos tareas en orden`, cambia `toHaveText('2 tareas')` por `toHaveText('3 tareas')` y ejecuta en tu
terminal:

```bash
# En la carpeta del ejercicio: la suite con una prueba rota y lo que deja en disco
cd ejercicios/M04-04-publicar-artefactos
npx playwright test
find test-results -type f
```

**Resultado esperado** (recortado; los tiempos cambian):

```text
Running 3 tests using 1 worker

  ✓  1 [chromium] › tests/tareas.spec.js:7:1 › empieza sin tareas (146ms)
  ✓  2 [chromium] › tests/tareas.spec.js:12:1 › añade una tarea (175ms)
  ✘  3 [chromium] › tests/tareas.spec.js:19:1 › añade dos tareas en orden (3.3s)


  1) [chromium] › tests/tareas.spec.js:19:1 › añade dos tareas en orden ────────────────────────────

    Error: expect(locator).toHaveText(expected) failed

    Locator:  locator('#contador')
    Expected: "3 tareas"
    Received: "2 tareas"
    Timeout:  3000ms
    …

    attachment #2: trace (application/zip) ─────────────────────────────────────────────────────────
    test-results/tareas-añade-dos-tareas-en-orden-chromium/trace.zip
    Usage:

        npx playwright show-trace test-results/tareas-añade-dos-tareas-en-orden-chromium/trace.zip

    ────────────────────────────────────────────────────────────────────────────────────────────────

  1 failed
    [chromium] › tests/tareas.spec.js:19:1 › añade dos tareas en orden ─────────────────────────────
  2 passed (4.5s)
test-results/.last-run.json
test-results/tareas-añade-dos-tareas-en-orden-chromium/error-context.md
test-results/tareas-añade-dos-tareas-en-orden-chromium/trace.zip
```

En tu terminal tienes la traza. Sube el cambio y mira qué queda en Actions:

```bash
# Sube la prueba rota
git commit -am "Rompe una prueba para ver los artefactos"
git push
```

**Resultado esperado:** la ejecución termina en rojo; en el job, el step **Run npx playwright test** falla
y el step **Run actions/upload-artifact@v7** aparece **saltado** (icono gris). La sección **Artifacts** no
tiene nada: el reporte del fallo se ha perdido con la máquina.

Los steps del job, con `gh run view --job=<ID>` (o en la página del job):

```text
X E2E con reporte
  ✓ Set up job
  ✓ Run actions/checkout@v7
  ✓ Run actions/setup-node@v7
  ✓ Run npm ci
  ✓ Run npx playwright install --with-deps chromium
  X Run npx playwright test
  - Run actions/upload-artifact@v7
  - Post Run actions/setup-node@v7
  ✓ Post Run actions/checkout@v7
  ✓ Complete job

ANNOTATIONS
X Process completed with exit code 1.
```

El `-` delante de **Run actions/upload-artifact@v7** es el step saltado, y la ejecución no tiene sección
**Artifacts**: el reporte que explicaba el fallo se ha quedado en la máquina, que ya no existe.

### 4 — Subir el reporte pase lo que pase, y las trazas si algo falla

Sustituyes en `.github/workflows/artefactos.yml` el último step por estos dos:

```yaml
      # El reporte se sube siempre que el job no se haya cancelado: pasen o fallen las pruebas
      - name: Subir el reporte HTML
        if: ${{ !cancelled() }}
        uses: actions/upload-artifact@v7
        with:
          name: reporte-html
          path: ejercicios/M04-04-publicar-artefactos/playwright-report/ # ruta desde la raíz del repo
          retention-days: 7 # se borra a la semana (por defecto, 90 días)

      # Las trazas solo existen si algo ha fallado: se suben solo en ese caso
      - name: Subir las trazas de los fallos
        if: ${{ failure() }}
        uses: actions/upload-artifact@v7
        with:
          name: trazas
          path: ejercicios/M04-04-publicar-artefactos/test-results/
          retention-days: 7
```

| Línea | Para qué |
|-------|----------|
| `if: ${{ !cancelled() }}` | El reporte se sube tanto en verde como en rojo; no si cancelas la ejecución a mano |
| `if: ${{ failure() }}` | Las trazas solo existen cuando algo falla: no se sube un artefacto vacío en verde |
| `path:` desde la raíz | `upload-artifact` no usa el `working-directory` de los `run`: la ruta es siempre relativa a la raíz del repositorio |
| `retention-days: 7` | Los artefactos ocupan cuota de almacenamiento; uno de pruebas no hace falta guardarlo 90 días |

```bash
# Desde la raíz: sube el workflow corregido (la prueba sigue rota)
cd /workspaces/testing-automatizacion-agile-201
git commit -am "Sube reporte y trazas también cuando fallan las pruebas"
git push
```

**Resultado esperado:** la ejecución sigue en rojo (la prueba sigue rota), pero los dos steps de subida se
ejecutan y **Artifacts** lista `reporte-html` y `trazas`.

```text
X E2E con reporte in 43s
  ✓ Set up job
  ✓ Run actions/checkout@v7
  ✓ Run actions/setup-node@v7
  ✓ Run npm ci
  ✓ Run npx playwright install --with-deps chromium
  X Run npx playwright test
  ✓ Subir el reporte HTML
  ✓ Subir las trazas de los fallos
  - Post Run actions/setup-node@v7
  ✓ Post Run actions/checkout@v7
  ✓ Complete job
```

Log de **Subir las trazas de los fallos** (los identificadores y el resumen SHA256 cambian):

```text
Run actions/upload-artifact@v7
With the provided path, there will be 2 files uploaded
Artifact name is valid!
Uploading artifact: trazas.zip
Uploaded bytes 33615
Finished uploading artifact content to blob storage!
Artifact trazas has been successfully uploaded! Final size is 33615 bytes.
```

La sección **Artifacts** lista ahora `reporte-html` (unos 650 KB: el reporte de un fallo incluye la
traza) y `trazas` (unos 33 KB: `trace.zip` y `error-context.md`).

### 5 — Descargar el artefacto en el Codespace

Con GitHub CLI bajas el artefacto de la última ejecución del workflow sin pasar por el navegador. Primero
ves las ejecuciones y su identificador:

```bash
# Las últimas ejecuciones del workflow de artefactos
gh run list --workflow artefactos.yml --limit 3
```

```text
STATUS  TITLE                                       WORKFLOW    BRANCH  EVENT  ID           ELAPSED  AGE
X       Sube reporte y trazas también cuando fa...  Artefactos  main    push   44192658437  46s      about 1 minute ago
X       Rompe una prueba para ver los artefactos    Artefactos  main    push   44191864873  4m14s    about 6 minutes ago
✓       Workflow de artefactos (versión de part...  Artefactos  main    push   44191671719  52s      about 7 minutes ago
```

El `ID` de la primera fila es el de la última ejecución, la que tiene el artefacto `trazas`. La duración
de cada ejecución varía: la instalación de dependencias del sistema (`--with-deps`) puede tardar de
20 s a más de 3 minutos según el runner.

```bash
# Descarga el artefacto «trazas» de la ejecución indicada a la carpeta descargas/
gh run download <ID> --name trazas --dir descargas
find descargas -type f
```

```text
descargas/tareas-añade-dos-tareas-en-orden-chromium/trace.zip
descargas/tareas-añade-dos-tareas-en-orden-chromium/error-context.md
```

`gh run download` no escribe nada si todo va bien; `find` muestra los dos ficheros que subió el step.
`.last-run.json` no está: `upload-artifact` excluye los ficheros ocultos.

El artefacto tiene la misma estructura que tu `test-results/` local, sin `.last-run.json`:
`upload-artifact` deja fuera los ficheros ocultos salvo que pongas `include-hidden-files: true`.

### 6 — Abrir la traza descargada

La traza es un `zip` con cada acción, el DOM antes y después, la red y la consola. La abres con el Trace
Viewer servido por el puerto **9322**:

```bash
# Sirve el Trace Viewer con la traza descargada (Ctrl+C para pararlo)
npx playwright show-trace --host 0.0.0.0 --port 9322 "descargas/tareas-añade-dos-tareas-en-orden-chromium/trace.zip"
```

**Resultado esperado:**

```text

Listening on http://0.0.0.0:9322
```

En **Ports**, abre el **9322**. En la línea de tiempo pulsa el último paso, `Expect "toHaveText"`: la
pestaña **Error** dice `Expected: "3 tareas"` y `Received: "2 tareas"`, y la instantánea de la página
muestra las dos tareas y el contador `2 tareas`. Has diagnosticado el fallo del [runner](../glosario/04-ci-cd.md#runner) sin reproducirlo.
Para el servidor con `Ctrl+C`, devuelve la prueba a `toHaveText('2 tareas')` y súbela.

```bash
# Desde la raíz: prueba arreglada; la carpeta descargas no se versiona
cd /workspaces/testing-automatizacion-agile-201
rm -rf descargas
git commit -am "Arregla la prueba del contador"
git push
```

## Comprueba tu entendimiento

**El reporte HTML ya lleva la traza dentro**
Con la prueba rota, ejecuta la suite y mira el contenido del reporte:

```bash
# Ficheros del reporte HTML (sin los del visor)
find playwright-report -type f -not -path "*/trace/*"
```

→ Además de `index.html` aparecen en `playwright-report/data/` un `.zip` (la traza) y un `.md` (el
`error-context`), con nombres que cambian en cada ejecución: el reporte HTML incluye las trazas de los
fallos y su visor. El artefacto `trazas` es útil para abrirlas por separado o con otras herramientas.

**La ruta es desde la raíz**
Cambia en el step del reporte `path:` por `playwright-report/` (sin la carpeta del ejercicio), súbelo y
mira el log del step.
→ Aviso `No files were found with the provided path: playwright-report/. No artifacts will be uploaded.`
y ningún artefacto. Deja la ruta completa.

## Investiga

Abre el `action.yml` de `actions/upload-artifact` (`https://github.com/actions/upload-artifact`) y busca
`if-no-files-found`: ¿qué valores admite y cuál usarías para que el job falle si el reporte no se ha
generado? Busca también `compression-level`: un reporte HTML con trazas, ¿gana mucho comprimiéndose?

## Reto

### 1 — Un artefacto por ejecución, no uno que se pisa

**La situación:** en el pull request de un compañero el workflow se ejecuta varias veces (cada push). Al
descargar `reporte-html`, nadie sabe de qué intento es, y si dos jobs de una matriz subieran el mismo
nombre, el segundo fallaría por nombre duplicado.

**Qué haces:** cambias el `name` de los artefactos para que incluya el número de ejecución y el intento, y
lo subes.

**Pistas:** las expresiones `${{ github.run_number }}` y `${{ github.run_attempt }}` se pueden usar dentro
de `name:`.

**Lo que buscas:** en **Artifacts**, un nombre como `reporte-html-12-1` y, tras pulsar **Re-run jobs**,
`reporte-html-12-2` en el nuevo intento.

<details>
<summary>Ver solución</summary>

```yaml
      - name: Subir el reporte HTML
        if: ${{ !cancelled() }}
        uses: actions/upload-artifact@v7
        with:
          name: reporte-html-${{ github.run_number }}-${{ github.run_attempt }}
          path: ejercicios/M04-04-publicar-artefactos/playwright-report/
          retention-days: 7
```

Con el nombre nuevo y después de pulsar **Re-run jobs** en la misma ejecución:

```bash
# Artefactos de la última ejecución, tras el segundo intento
gh run view $(gh run list --workflow artefactos.yml --limit 1 --json databaseId --jq '.[0].databaseId')
```

```text
ARTIFACTS
reporte-html-4-2
trazas
```

`4` es el `run_number` (cuarta ejecución de **Artefactos**) y `2`, el intento. El artefacto del primer
intento (`reporte-html-4-1`) ya no está: al repetir una ejecución, GitHub sustituye los artefactos del
intento anterior. Por eso el número de intento en el nombre dice a qué intento corresponde lo que
descargas.

`run_number` cuenta las ejecuciones del workflow y `run_attempt` los [reintentos](../glosario/02-e2e.md#reintento) de la misma ejecución:
juntos identifican de qué intento es cada evidencia. **La regla:** una evidencia sin identificar no sirve
para diagnosticar; el nombre del artefacto dice de qué ejecución viene.

</details>

## Errores frecuentes

| Síntoma | Causa probable | Cómo arreglarlo |
|---------|----------------|-----------------|
| Con las pruebas en rojo no hay artefactos | El step de subida no tiene `if` y se salta | `if: ${{ !cancelled() }}` (o `always()`) |
| `No files were found with the provided path` | `path` relativo a la carpeta del ejercicio | La ruta va desde la raíz: `ejercicios/M04-04-publicar-artefactos/playwright-report/` |
| `Failed to CreateArtifact: … an artifact with this name already exists` | Dos steps o dos jobs suben el mismo `name` | Nombres distintos (reto) u `overwrite: true` |
| `gh run download` responde `no valid artifacts found to download` | El nombre no coincide o el artefacto ha caducado | `gh run view <ID>` lista los artefactos de la ejecución; mira `retention-days` |
| `gh: Resource not accessible by integration` | El token del Codespace no puede leer Actions | Descarga el artefacto desde la página de la ejecución (**Artifacts** → nombre) y súbelo al Codespace arrastrándolo al explorador |
| El [Trace Viewer](../glosario/02-e2e.md#trace-viewer) no abre en el navegador | Falta `--host 0.0.0.0` o el puerto no está reenviado | Usa el comando del paso 6 y abre el **9322** desde **Ports** |

## Conclusiones

### Qué es un artefacto de CI

Un conjunto de ficheros que un job sube con `actions/upload-artifact` antes de que su máquina desaparezca,
asociado a la ejecución, descargable desde la web o con `gh run download` y con fecha de caducidad.

### Cómo debe ser

| Requisito | En el lab |
|-----------|-----------|
| Se sube también cuando las pruebas fallan | `if: ${{ !cancelled() }}` en el reporte |
| Solo lo que aporta | Trazas solo con `failure()` y `trace: 'retain-on-failure'` |
| Ruta inequívoca | `path` desde la raíz del repositorio |
| Caduca | `retention-days: 7` |
| Identificable | Nombre con `run_number` y `run_attempt` (reto) |

### Dónde se rompe y cómo lo has detectado

| Fallo | Cómo lo has visto | Qué provoca |
|-------|-------------------|-------------|
| Step de subida sin condición | Paso 3: upload saltado y **Artifacts** vacío en la ejecución roja | Sin evidencias justo cuando hay que diagnosticar |
| Ruta relativa a `working-directory` | Comprueba: `No files were found with the provided path` | Un verde que no publica nada |
| Ficheros ocultos | Paso 5: el artefacto no trae `.last-run.json` | Lo que empieza por punto no se sube salvo `include-hidden-files: true` |

### Cómo se perfecciona

Con nombres de artefacto únicos por intento, `if-no-files-found: error` para que un reporte que no se ha
generado haga fallar el job, retenciones cortas, y publicando el reporte HTML como web (GitHub Pages) cuando
el equipo lo consulta a diario.

### En una frase

> 🔑 Un artefacto es la evidencia que sobrevive al runner, y tiene que subirse precisamente cuando las
> pruebas fallan: `if: ${{ !cancelled() }}`.
