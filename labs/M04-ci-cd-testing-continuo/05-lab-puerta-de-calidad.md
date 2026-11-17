# Lab — Puerta de calidad

[← Página anterior](04-lab-publicar-artefactos.md) · [Siguiente página →](06-lab-pruebas-en-contenedores.md)

Practicas la [puerta de calidad](../glosario/04-ci-cd.md#puerta-de-calidad) (*quality gate*): una regla
que impide fusionar un cambio si su [check](../glosario/04-ci-cd.md#check) de pruebas no está en verde. El ejercicio es un panel de pedidos
con seis pruebas de [Playwright](../glosario/02-e2e.md#playwright), dos etiquetadas `@smoke` y cuatro más lentas. Separas la [suite rápida](../glosario/04-ci-cd.md#suite-rapida-y-nocturna), que
decide cada pull request, de la completa, que corre por la noche, y conviertes el check rápido en
obligatorio con un [ruleset](../glosario/04-ci-cd.md#ruleset) en tu fork.

### Objetivo

Comprender qué es una puerta de calidad: cómo funciona, cómo debe ser, cómo se detectan sus debilidades y
cómo se mejora.

### Punto de partida

- Tu fork del curso con un Codespace abierto y Actions habilitado (pestaña **Actions** → si aparece el
  aviso de forks, **I understand my [workflows](../glosario/04-ci-cd.md#workflow), go ahead and enable them**).
- Permisos de administración en tu fork (lo son por defecto: el fork es tuyo).
- Carpeta del ejercicio: [`ejercicios/M04-05-puerta-de-calidad/`](../../ejercicios/M04-05-puerta-de-calidad/README.md).
  La app escucha en el puerto **3405**: usuario `ana`, contraseña `secreta`.
- Solución: [`solucion/calidad-pr.yml`](../../ejercicios/M04-05-puerta-de-calidad/solucion/calidad-pr.yml) y
  [`solucion/suite-nocturna.yml`](../../ejercicios/M04-05-puerta-de-calidad/solucion/suite-nocturna.yml).

```bash
# Entra en la carpeta del ejercicio
cd ejercicios/M04-05-puerta-de-calidad
```

### Qué está pasando

Un check en rojo que no impide nada es una opinión. La puerta de calidad lo convierte en una condición: la
rama `main` solo acepta cambios por pull request y solo si el check exigido ha pasado. Eso tiene un coste:
si la suite que hace de puerta tarda mucho, el equipo espera en cada pull request (o empieza a buscar cómo
saltársela). Por eso se reparte:

| Suite | Cuándo | Qué lleva | En el ejercicio |
|-------|--------|-----------|-----------------|
| Rápida (*smoke*) | Cada pull request: es la puerta | Lo mínimo para saber que la app sirve | 2 pruebas `@smoke`: portada y acceso |
| Completa | Cada noche (`schedule`) y a mano (`workflow_dispatch`) | Todo, incluidas las lentas | 6 pruebas: errores de acceso e informes que tardan 2 y 3 s |

En GitHub, la regla se configura en un **ruleset** de la rama (la versión moderna de *branch protection*).

### 1 — Medir la suite completa

Ejecutas todas las pruebas para saber cuánto cuesta la suite entera.

```bash
# La suite completa
npx playwright test
```

**Resultado esperado** (los tiempos cambian):

```text
Running 6 tests using 1 worker

  ✓  1 [chromium] › tests/panel.spec.js:11:1 › la portada carga @smoke (92ms)
  ✓  2 [chromium] › tests/panel.spec.js:16:1 › ana inicia sesión @smoke (122ms)
  ✓  3 [chromium] › tests/panel.spec.js:22:1 › una contraseña incorrecta no deja entrar (103ms)
  ✓  4 [chromium] › tests/panel.spec.js:28:1 › un usuario desconocido no deja entrar (103ms)
  ✓  5 [chromium] › tests/panel.spec.js:33:1 › genera el informe mensual (2.5s)
  ✓  6 [chromium] › tests/panel.spec.js:39:1 › genera el informe anual (3.4s)

  6 passed (6.9s)
```

Las dos pruebas de informes se llevan casi todo el tiempo. En un proyecto real son cientos de pruebas y
minutos u horas, pero la proporción es la misma: unas pocas pruebas lentas dominan.

### 2 — Separar la suite rápida por etiqueta

Abre [`tests/panel.spec.js`](../../ejercicios/M04-05-puerta-de-calidad/tests/panel.spec.js): las dos
primeras pruebas llevan `{ tag: '@smoke' }`. Con `--grep` eliges por etiqueta; con `--list` ves qué
entraría sin ejecutarlo.

```bash
# Qué pruebas forman la suite rápida y cuáles quedan fuera
npx playwright test --grep @smoke --list
npx playwright test --grep-invert @smoke --list
```

**Resultado esperado:**

```text
Listing tests:
  [chromium] › panel.spec.js:11:1 › la portada carga
  [chromium] › panel.spec.js:16:1 › ana inicia sesión
Total: 2 tests in 1 file
Listing tests:
  [chromium] › panel.spec.js:22:1 › una contraseña incorrecta no deja entrar
  [chromium] › panel.spec.js:28:1 › un usuario desconocido no deja entrar
  [chromium] › panel.spec.js:33:1 › genera el informe mensual
  [chromium] › panel.spec.js:39:1 › genera el informe anual
Total: 4 tests in 1 file
```

```bash
# La suite rápida
npx playwright test --grep @smoke
```

**Resultado esperado** (los tiempos cambian):

```text
Running 2 tests using 1 worker

  ✓  1 [chromium] › tests/panel.spec.js:11:1 › la portada carga @smoke (102ms)
  ✓  2 [chromium] › tests/panel.spec.js:16:1 › ana inicia sesión @smoke (123ms)

  2 passed (837ms)
```

Menos de un segundo frente a casi siete. Eso es lo que esperará cada pull request.

### 3 — El workflow de la suite rápida

Creas en la raíz `.github/workflows/calidad-pr.yml`. A propósito **no** lleva filtro `paths`: un check
obligatorio tiene que ejecutarse en todos los pull requests a `main`, o los que no toquen el ejercicio se
quedarían esperando un check que nunca llega.

```bash
# Desde la raíz: crea el workflow y ábrelo
cd /workspaces/testing-automatizacion-agile-201
mkdir -p .github/workflows
code .github/workflows/calidad-pr.yml
```

```yaml
name: Calidad PR

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  suite-rapida:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    defaults:
      run:
        working-directory: ejercicios/M04-05-puerta-de-calidad
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 22
          cache: npm
      - run: npm ci
        working-directory: .
      - run: npx playwright install --with-deps chromium
      # Solo las pruebas etiquetadas @smoke: respuesta rápida en cada pull request
      - run: npx playwright test --grep @smoke
```

El nombre del check será el del [job](../glosario/04-ci-cd.md#job), `suite-rapida`. Súbelo a `main` para que GitHub lo ejecute una vez y
lo conozca (el buscador de checks del ruleset solo ofrece los que se han ejecutado recientemente):

```bash
# Sube el workflow de la suite rápida
git add .github/workflows/calidad-pr.yml
git commit -m "Suite rápida como check de pull request"
git push
```

**Resultado esperado:** en **Actions**, una ejecución de **Calidad PR** en verde con el job `suite-rapida`.

```text
✓ main Calidad PR · 44194179206
Triggered via push about 1 minute ago

JOBS
✓ suite-rapida in 51s
```

Log del step **Run npx playwright test --grep @smoke** (los tiempos cambian):

```text
Running 2 tests using 1 worker

  ✓  1 [chromium] › tests/panel.spec.js:11:1 › la portada carga @smoke (144ms)
  ✓  2 [chromium] › tests/panel.spec.js:16:1 › ana inicia sesión @smoke (156ms)

  2 passed (1.3s)
```

Solo corren las dos pruebas `@smoke`: la suite que hará de puerta tarda un segundo y medio.

### 4 — Crear el ruleset de `main`

Ahora la regla. En la web de tu fork:

1. Pulsa **Settings** → en el menú de la izquierda, **Rulesets** (dentro de *Code, planning, and automation*).
2. Pulsa **New ruleset** → **New branch ruleset**.
3. En **Ruleset Name**, escribe `main protegida`.
4. En **Enforcement status**, elige **Active**.
5. En **Target branches**, pulsa **Add target** → **Include default branch**.
6. En **Branch rules**, marca **Require a pull request before merging** (deja **Required approvals** en
   `0`: trabajas solo).
7. Marca **Require status checks to pass**, pulsa **Add checks**, escribe `suite-rapida` y selecciónalo.
8. Pulsa **Create**.

**Resultado esperado:** la lista de rulesets muestra `main protegida` como **Active** y aplicada a la rama
por defecto.

El formulario **New branch ruleset**, de arriba abajo, con lo que hay que tocar:

| Sección | Qué pones |
|---------|-----------|
| **Ruleset Name** | `main protegida` |
| **Enforcement status** | **Active** (por defecto viene **Disabled**) |
| **Target branches** → **Add target** | **Include default branch** (aparece `Include: Default`) |
| **Branch rules** → **Require a pull request before merging** | Marcado; **Required approvals** se queda en `0` |
| **Branch rules** → **Require status checks to pass** → **Add checks** | Escribe `suite-rapida` y elige la entrada **suite-rapida** marcada **GitHub Actions** |

**Restrict deletions** y **Block force pushes** ya vienen marcados: déjalos. Al pulsar **Create**, GitHub
puede pedirte que confirmes tu identidad (**Confirm access**) con tu contraseña o tu passkey. Después, la
lista **Rulesets** muestra `main protegida` como activo.

> [!TIP]
> Si **Add checks** no encuentra `suite-rapida`, es que todavía no se ha ejecutado en tu fork: vuelve al
> paso 3 y comprueba que la ejecución de **Calidad PR** terminó.

> [!NOTE]
> A partir de ahora `git push` directo a `main` se rechaza: los cambios entran por pull request. Si quieres
> recuperar el push directo al terminar el lab, pon el ruleset en **Disabled**.

### 5 — Un pull request que rompe la suite rápida

Un compañero cambia el saludo de la app sin mirar las pruebas. Lo reproduces en una rama: en
`app/public/index.html` cambia `'Hola, ana'` por `'Bienvenida, ana'` y ejecuta la suite rápida:

```bash
# Rama para el cambio y la suite rápida en local
git switch -c romper-smoke
cd ejercicios/M04-05-puerta-de-calidad
npx playwright test --grep @smoke
```

**Resultado esperado** (los tiempos cambian):

```text
Switched to a new branch 'romper-smoke'
Running 2 tests using 1 worker

  ✓  1 [chromium] › tests/panel.spec.js:11:1 › la portada carga @smoke (208ms)
  ✘  2 [chromium] › tests/panel.spec.js:16:1 › ana inicia sesión @smoke (5.3s)


  1) [chromium] › tests/panel.spec.js:16:1 › ana inicia sesión @smoke ──────────────────────────────

    Error: expect(locator).toHaveText(expected) failed

    Locator:  getByRole('alert')
    Expected: "Hola, ana"
    Received: "Bienvenida, ana"
    Timeout:  5000ms
    …

  1 failed
    [chromium] › tests/panel.spec.js:16:1 › ana inicia sesión @smoke ───────────────────────────────
  1 passed (6.7s)
```

Súbelo y abre el pull request **contra el `main` de tu fork** (no contra el repositorio del curso):

```bash
# Sube la rama y abre el pull request en tu propio fork
git commit -am "Cambia el saludo del panel"
git push -u origin romper-smoke
gh pr create --repo "$GITHUB_REPOSITORY" --base main --head romper-smoke \
  --title "Cambia el saludo del panel" --body "Lab M04-05: rompe la suite rápida"
```

`$GITHUB_REPOSITORY` lo define el Codespace con `<tu-usuario>/testing-automatizacion-agile-201`; sin
`--repo`, `gh` propondría abrir el pull request contra el repositorio original.

```text
https://github.com/<tu-usuario>/testing-automatizacion-agile-201/pull/2
```

`gh pr create` solo imprime la URL del pull request; el número depende de cuántos hayas abierto antes.

Abre la URL. Al terminar el check, la caja de fusión muestra `suite-rapida` en rojo como **Required** y el
botón de fusionar bloqueado.

La caja de fusión del pull request, cuando el check termina:

```text
All checks have failed
1 failing check

Calidad PR / suite-rapida (pull_request)    Failing after 1m    Required

[ Merge pull request ]   (deshabilitado)
Merging is blocked due to failing merge requirements
```

Lo mismo desde el terminal:

```bash
# El check y el intento de fusionar
gh pr checks 2 --repo "$GITHUB_REPOSITORY"
gh pr merge 2 --repo "$GITHUB_REPOSITORY" --merge
```

```text
Some checks were not successful
0 cancelled, 1 failing, 0 successful, 0 skipped, and 0 pending checks

   NAME                                    DESCRIPTION  ELAPSED  URL
X  Calidad PR/suite-rapida (pull_request)               1m1s     https://github.com/…
X Pull request <tu-usuario>/testing-automatizacion-agile-201#2 is not mergeable: the base branch policy prohibits the merge.
To have the pull request merged after all the requirements have been met, add the `--auto` flag.
To use administrator privileges to immediately merge the pull request, add the `--admin` flag.
```

`Required` es la etiqueta que pone el ruleset. La última línea avisa de que, como dueño del fork, podrías
saltarte la regla con `--admin`: en un equipo real ese permiso lo tiene muy poca gente.

### 6 — Arreglar y fusionar

El arreglo correcto depende de quién tenga razón. Aquí el saludo nuevo es el bueno: actualizas la prueba
(`toHaveText('Bienvenida, ana')` en `tests/panel.spec.js`) y subes a la misma rama.

```bash
# En la carpeta del ejercicio: la prueba con el saludo nuevo, en local y al pull request
npx playwright test --grep @smoke
git commit -am "Actualiza la prueba al saludo nuevo"
git push
```

**Resultado esperado:** en local, `2 passed`. En el pull request, el check se vuelve a ejecutar, queda en
verde y el botón **Merge pull request** se habilita. Fusiona.

```text
All checks have passed
1 successful check

Calidad PR / suite-rapida (pull_request)    Successful in 43s    Required

[ Merge pull request ]   (habilitado)
```

El check se ha vuelto a ejecutar con el push a la rama (`gh pr checks 2` dice `All checks were
successful`) y el botón ya fusiona. Pulsa **Merge pull request** → **Confirm merge**.

```bash
# Vuelve a main y trae la fusión
git switch main
git pull
```

### 7 — La suite completa, por la noche y a mano

La suite completa no hace de puerta, pero tiene que ejecutarse. Creas `.github/workflows/suite-nocturna.yml`
con un evento programado y otro manual. Como `main` ya no admite push directo, lo subes con un pull
request.

```bash
# Rama, workflow nocturno y pull request
git switch -c suite-nocturna
code .github/workflows/suite-nocturna.yml
```

```yaml
name: Suite nocturna

on:
  schedule:
    - cron: '0 3 * * *' # todos los días a las 03:00 UTC (solo en la rama por defecto)
  workflow_dispatch: # botón «Run workflow» para lanzarla a mano

jobs:
  suite-completa:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    defaults:
      run:
        working-directory: ejercicios/M04-05-puerta-de-calidad
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 22
          cache: npm
      - run: npm ci
        working-directory: .
      - run: npx playwright install --with-deps chromium
      # Todas las pruebas, con y sin etiqueta
      - run: npx playwright test
```

```bash
# Sube la rama, abre el pull request y fusiónalo cuando suite-rapida esté en verde
git add .github/workflows/suite-nocturna.yml
git commit -m "Suite completa nocturna"
git push -u origin suite-nocturna
gh pr create --repo "$GITHUB_REPOSITORY" --base main --head suite-nocturna --fill
gh pr merge --repo "$GITHUB_REPOSITORY" suite-nocturna --merge
```

Una vez en `main`, lánzala a mano: en **Actions** → **Suite nocturna** → **Run workflow** → **Run workflow**,
o desde el terminal:

```bash
# Lanza la suite completa ahora, sin esperar a las 03:00 UTC
gh workflow run suite-nocturna.yml --repo "$GITHUB_REPOSITORY"
```

`gh pr merge` y `gh workflow run` no imprimen nada cuando terminan bien. Comprueba la fusión y la
ejecución lanzada a mano:

```bash
# Estado del pull request y última ejecución de la suite nocturna
gh pr view suite-nocturna --repo "$GITHUB_REPOSITORY" --json state --jq .state
gh run list --workflow suite-nocturna.yml --repo "$GITHUB_REPOSITORY" --limit 1
```

```text
MERGED
completed	success	Suite nocturna	Suite nocturna	main	workflow_dispatch	44195251166	3m13s	2026-11-17T22:59:17Z
```

El evento es `workflow_dispatch` (lanzada a mano). Log del step **Run npx playwright test** (los tiempos
cambian):

```text
Running 6 tests using 1 worker

  ✓  1 [chromium] › tests/panel.spec.js:11:1 › la portada carga @smoke (100ms)
  ✓  2 [chromium] › tests/panel.spec.js:16:1 › ana inicia sesión @smoke (113ms)
  ✓  3 [chromium] › tests/panel.spec.js:22:1 › una contraseña incorrecta no deja entrar (107ms)
  ✓  4 [chromium] › tests/panel.spec.js:28:1 › un usuario desconocido no deja entrar (104ms)
  ✓  5 [chromium] › tests/panel.spec.js:33:1 › genera el informe mensual (2.4s)
  ✓  6 [chromium] › tests/panel.spec.js:39:1 › genera el informe anual (3.4s)

  6 passed (8.7s)
```

Las dos pruebas de informes (casi 6 s entre las dos) son las que se quedan fuera de la suite rápida.

## Comprueba tu entendimiento

**La puerta no admite atajos**
Desde `main`, intenta subir un cambio directamente:

```bash
# Un commit vacío directo a main
git switch main
git commit --allow-empty -m "Atajo directo a main"
git push
```

→ El push se rechaza (`GH013: Repository rule violations found`, con el motivo de la regla). Deshaz el
commit local:

```bash
# Vuelve main al estado del fork
git reset --hard origin/main
```

```text
remote: error: GH013: Repository rule violations found for refs/heads/main.
remote: Review all repository rules at https://github.com/<tu-usuario>/testing-automatizacion-agile-201/rules?ref=refs%2Fheads%2Fmain
remote:
remote: - Changes must be made through a pull request.
remote:
remote: - Required status check "suite-rapida" is expected.
remote:
 ! [remote rejected] main -> main (push declined due to repository rule violations)
```

GitHub lista cada regla que el push incumple: no viene de un pull request y no trae el check exigido.

**La etiqueta decide la suite**
Quita `{ tag: '@smoke' }, ` de `la portada carga` y lista la suite rápida:

```bash
# Qué queda en la suite rápida
npx playwright test --grep @smoke --list
```

→ Solo queda `ana inicia sesión` y `Total: 1 test in 1 file`. Vuelve a poner la etiqueta.

## Investiga

En **Actions** → **Suite nocturna**, mira el evento de cada ejecución (`schedule` o `workflow_dispatch`).
Después busca en la documentación de GitHub Actions («Events that trigger workflows» → `schedule`) qué pasa
con los workflows programados de un repositorio público sin actividad durante 60 días, y por qué la hora
real de ejecución puede retrasarse respecto al `cron`.

## Experimenta

Predice qué verás en un pull request que solo cambia un fichero de otro módulo si `calidad-pr.yml`
tuviera un filtro `paths` con la carpeta del ejercicio. Añade el filtro en una rama, abre un pull request
que cambie solo `ejercicios/M04-00-un-pipeline-de-pruebas/README.md` y mira la caja de fusión.

La caja de fusión de ese pull request:

```text
Some checks haven't completed yet
1 expected, 4 successful checks

suite-rapida    Expected — Waiting for status to be reported    Required
Demo pipeline / Unitarias (Node 22) (pull_request)    Successful in 27s
…

[ Merge pull request ]   (deshabilitado)
```

Los checks de otros workflows pasan, pero `suite-rapida` no se ha ejecutado (el cambio no toca la carpeta
del filtro) y la regla lo sigue esperando.

El check obligatorio nunca llega y el pull request queda bloqueado para siempre. Cierra ese pull request
sin fusionarlo.

## Reto

### 1 — Un `@smoke` que de verdad protege

**La situación:** un compañero propone etiquetar como `@smoke` también `genera el informe anual` «porque es
lo que más usan los clientes». La suite rápida pasaría de menos de 1 s a más de 4 s.

**Qué haces:** en lugar de esa prueba lenta, añades a la suite rápida una prueba que compruebe que el panel
de informes aparece tras iniciar sesión (los botones **Informe mensual** e **Informe anual** visibles), sin
generar ningún informe. La etiquetas `@smoke` y mides.

**Pistas:** reutiliza la función `entrar(page, usuario, clave)`; `toBeVisible()` sobre
`getByRole('button', { name: … })`.

**Lo que buscas:** `npx playwright test --grep @smoke` con 3 pruebas en verde y un total que siga por
debajo de 1,5 s.

<details>
<summary>Ver solución</summary>

```js
test('tras entrar se ven los informes', { tag: '@smoke' }, async ({ page }) => {
  await entrar(page, 'ana', 'secreta');
  await expect(page.getByRole('button', { name: 'Informe mensual' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Informe anual' })).toBeVisible();
});
```

```bash
# La suite rápida con la prueba nueva (añadida al final del fichero)
npx playwright test --grep @smoke
```

Salida (los tiempos cambian):

```text
Running 3 tests using 1 worker

  ✓  1 [chromium] › tests/panel.spec.js:11:1 › la portada carga @smoke (101ms)
  ✓  2 [chromium] › tests/panel.spec.js:16:1 › ana inicia sesión @smoke (116ms)
  ✓  3 [chromium] › tests/panel.spec.js:45:1 › tras entrar se ven los informes @smoke (108ms)

  3 passed (955ms)
```

La prueba nueva protege lo que importa en cada pull request (que la función existe y se llega a ella) sin
pagar la espera del informe, que la suite nocturna sí comprueba entera. **La regla:** la suite que hace de
puerta mide «¿se puede usar?» en segundos; el «¿hace todo bien?» lento va a la completa.

</details>

## Errores frecuentes

| Síntoma | Causa probable | Cómo arreglarlo |
|---------|----------------|-----------------|
| `suite-rapida` no aparece en **Add checks** | El job aún no se ha ejecutado en el repositorio | Paso 3: súbelo a `main` y espera a que termine antes de crear el ruleset |
| `gh pr create` abre el pull request contra el repositorio del curso | Sin `--repo`, `gh` elige el repositorio original del fork | `--repo "$GITHUB_REPOSITORY" --base main` |
| El pull request se queda en **Expected — Waiting for status to be reported** | El workflow requerido no se ejecuta para ese pull request (filtro `paths` o `branches`) | Un check obligatorio no lleva filtro `paths` |
| `git push` a `main` rechazado con `GH013: Repository rule violations found` | Es el ruleset funcionando | Trabaja en una rama y entra por pull request |
| La suite nocturna no se ha ejecutado a las 03:00 | `schedule` solo corre en la rama por defecto, puede retrasarse y se desactiva tras 60 días sin actividad | Lánzala con **Run workflow** o `gh workflow run`; revisa que el workflow esté en `main` |
| La prueba nueva no entra en la suite rápida | La etiqueta va en el segundo argumento: `test('…', { tag: '@smoke' }, async …)` | Revisa la posición del objeto `{ tag }` |

## Conclusiones

### Qué es una puerta de calidad

Una regla del repositorio que hace del resultado de las pruebas una condición para integrar: en GitHub, un
ruleset de `main` que exige pull request y el check `suite-rapida` en verde.

### Cómo debe ser

| Requisito | En el lab |
|-----------|-----------|
| Obligatoria, sin atajos | Ruleset **Active** sobre la rama por defecto; push directo rechazado |
| Rápida | 2 pruebas `@smoke` en menos de 1 s frente a 6 en casi 7 s |
| Siempre presente | `calidad-pr.yml` sin `paths`: se ejecuta en todo pull request a `main` |
| Con la suite completa en otro momento | `suite-nocturna.yml` con `schedule` y `workflow_dispatch` |

### Dónde se rompe y cómo lo has detectado

| Fallo | Cómo lo has visto | Qué provoca |
|-------|-------------------|-------------|
| Check informativo, no obligatorio | Antes del ruleset, el rojo no bloqueaba nada | Se fusiona con pruebas rotas |
| Check obligatorio con filtro `paths` | Experimenta: **Waiting for status to be reported** | Pull requests bloqueados para siempre |
| Suite rápida que engorda | Reto: la prueba del informe anual multiplicaría el tiempo | El equipo espera o desactiva la puerta |

### Cómo se perfecciona

Con más de un check requerido (unitarias + smoke E2E), aprobaciones obligatorias en equipo, la suite completa
avisando de sus fallos (incidencia o mensaje al canal del equipo) y revisando qué pruebas merecen estar en
`@smoke` cuando cambia la aplicación.

### En una frase

> 🔑 Una puerta de calidad convierte el check en una condición para fusionar, y solo funciona si la suite
> que la guarda es rápida y se ejecuta en todos los pull requests.
