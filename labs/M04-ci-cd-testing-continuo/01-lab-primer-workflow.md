# Lab — Primer workflow

[← Página anterior](00-un-pipeline-de-pruebas.md) · [Siguiente página →](02-lab-e2e-en-el-pipeline.md)

Practicas el [workflow](../glosario/04-ci-cd.md#workflow) de GitHub Actions: sus
eventos, sus [jobs](../glosario/04-ci-cd.md#job) y sus steps. El
ejercicio es una función que valida contraseñas (`esContrasenaValida`) con cuatro pruebas de [Vitest](../glosario/01-fundamentos.md#vitest) que
ya pasan en tu terminal; tú escribes el workflow que las ejecuta solo en cada push y pull request, lo
ves en verde, lo pones en rojo con un cambio y compruebas cuándo se dispara y cuándo no.

### Objetivo

Comprender qué es un workflow de CI: cómo funciona, cómo debe ser, cómo se detectan sus debilidades y
cómo se mejora.

### Punto de partida

- Tu fork de `testing-automatizacion-agile-201` con un Codespace abierto sobre él (todo `git push` va a
  tu fork).
- Carpeta del ejercicio: [`ejercicios/M04-01-primer-workflow/`](../../ejercicios/M04-01-primer-workflow/README.md).
  No necesita aplicación ni puerto.
- No hay workflows en el repositorio: el de este lab lo creas tú. Si te pierdes, el fichero completo está
  en [`solucion/pruebas-unitarias.yml`](../../ejercicios/M04-01-primer-workflow/solucion/pruebas-unitarias.yml).

```bash
# Entra en la carpeta del ejercicio
cd ejercicios/M04-01-primer-workflow
```

### Qué está pasando

En un equipo, cada cambio que alguien sube puede romper algo que otro escribió. La
[integración continua](../glosario/01-fundamentos.md#integracion-continua) ejecuta las pruebas en cada cambio,
en una máquina neutral, y deja el resultado pegado al commit: nadie tiene que acordarse de lanzarlas y
nadie puede decir «en mi máquina pasaba».

| Pieza | Qué es |
|-------|--------|
| `src/contrasena.js` | La regla: al menos 8 caracteres (`LONGITUD_MINIMA`), una letra y un número |
| `tests/contrasena.test.js` | Cuatro pruebas de Vitest, una por cada borde de la regla |
| `.github/workflows/pruebas-unitarias.yml` | El workflow que escribes tú, en la **raíz** del repositorio |
| Pestaña **Actions** del fork | Donde GitHub muestra cada ejecución, sus jobs y sus logs |

### 1 — Ejecutar las pruebas en tu terminal

Lo primero es saber qué tiene que hacer el [runner](../glosario/04-ci-cd.md#runner): el mismo comando que tú. Si no pasa aquí, tampoco
pasará en CI.

```bash
# Ejecuta las pruebas y lista cada una (es el comando que pondrás en el workflow)
npx vitest run --reporter=verbose
```

**Resultado esperado** (los tiempos y la hora cambian en cada ejecución):

```text
 RUN  v5.1.0 /workspaces/testing-automatizacion-agile-201/ejercicios/M04-01-primer-workflow

 ✓ tests/contrasena.test.js > esContrasenaValida > acepta 8 caracteres con letras y números 2ms
 ✓ tests/contrasena.test.js > esContrasenaValida > rechaza 7 caracteres aunque tenga letras y números 0ms
 ✓ tests/contrasena.test.js > esContrasenaValida > rechaza una contraseña sin números 0ms
 ✓ tests/contrasena.test.js > esContrasenaValida > rechaza una contraseña sin letras 0ms

 Test Files  1 passed (1)
      Tests  4 passed (4)
   Start at  17:20:10
   Duration  136ms (transform 42%, import 32%, tests 14%, worker 12%)
```

Cuatro pruebas en verde. `npx vitest` encuentra Vitest en el `node_modules` de la raíz: en el runner
habrá que instalarlo antes con `npm ci`.

### 2 — Habilitar Actions en tu fork

GitHub desactiva Actions en los forks para que nadie ejecute workflows ajenos sin querer. Lo habilitas una
vez y vale para todo el módulo.

1. En el navegador, abre tu fork (`https://github.com/<tu-usuario>/testing-automatizacion-agile-201`).
2. Pulsa la pestaña **Actions**.
3. Si aparece el aviso **Workflows aren't being run on this forked repository**, pulsa
   **I understand my workflows, go ahead and enable them**.
4. Si en su lugar aparece **Get started with GitHub Actions** con plantillas sugeridas, Actions ya está
   habilitado: no pulses ninguna plantilla.

**Resultado esperado:** la pestaña **Actions** ya no muestra el aviso de forks.

Como el repositorio del curso no trae workflows, en un fork recién creado Actions suele estar ya
habilitado. Lo compruebas desde el terminal del Codespace:

```bash
# Permisos de Actions de tu fork ($GITHUB_REPOSITORY es usuario/repositorio en el Codespace)
gh api repos/$GITHUB_REPOSITORY/actions/permissions
```

```text
{"enabled":true,"allowed_actions":"all","sha_pinning_required":false}
```

`"enabled":true`: los workflows que subas se ejecutarán.

### 3 — Escribir el workflow

Creas el fichero que le dice a GitHub **cuándo** ejecutar (eventos), **dónde** (runner) y **qué**
(steps). Tiene que estar en `.github/workflows/` en la raíz del repositorio: GitHub no busca workflows en
ninguna otra carpeta.

```bash
# Desde la raíz del repositorio: crea la carpeta de workflows y abre el fichero en el editor
cd /workspaces/testing-automatizacion-agile-201
mkdir -p .github/workflows
code .github/workflows/pruebas-unitarias.yml
```

Pega este contenido y guarda:

```yaml
# Workflow del lab M04-01: ejecuta las pruebas unitarias en cada push y pull request.
# Va en .github/workflows/pruebas-unitarias.yml, en la raíz del repositorio.
name: Pruebas unitarias

# Cuándo se ejecuta: en cada push y en cada pull request que toque el ejercicio o el propio workflow
on:
  push:
    paths:
      - 'ejercicios/M04-01-primer-workflow/**'
      - '.github/workflows/pruebas-unitarias.yml'
  pull_request:
    paths:
      - 'ejercicios/M04-01-primer-workflow/**'
      - '.github/workflows/pruebas-unitarias.yml'

jobs:
  vitest:
    name: Vitest
    runs-on: ubuntu-latest
    steps:
      # 1. Trae el código del commit que ha disparado la ejecución
      - uses: actions/checkout@v7

      # 2. Instala Node 22 y guarda en caché la descarga de npm (clave: package-lock.json)
      - uses: actions/setup-node@v7
        with:
          node-version: 22
          cache: npm

      # 3. Instala las dependencias de la raíz, exactamente las del package-lock.json
      - run: npm ci

      # 4. Ejecuta las pruebas desde la carpeta del ejercicio
      - run: npx vitest run --reporter=verbose
        working-directory: ejercicios/M04-01-primer-workflow
```

**Resultado esperado:** el fichero existe y la extensión **GitHub Actions** de VS Code no marca nada en
rojo (si escribes mal una clave, por ejemplo `runs_on`, la subraya).

| Línea | Para qué |
|-------|----------|
| `on.push.paths` / `on.pull_request.paths` | Solo se ejecuta si el cambio toca el ejercicio o el workflow: el resto del repositorio no lo dispara |
| `runs-on: ubuntu-latest` | Una máquina Ubuntu nueva para cada ejecución: no hereda nada de la anterior |
| `actions/checkout@v7` | Sin este paso, la máquina está vacía: no hay código que probar |
| `actions/setup-node@v7` + `cache: npm` | Node 22 como en el Codespace; la caché acelera `npm ci` en las siguientes ejecuciones |
| `npm ci` | Instala lo que dice `package-lock.json`, sin resolver versiones nuevas: lo mismo cada vez |
| `working-directory` | El comando de pruebas corre en la carpeta del ejercicio, como en el paso 1 |

### 4 — Subir el workflow y verlo en verde

El push del fichero es un evento `push` que cumple el filtro `paths` (cambia el propio workflow), así que
dispara la primera ejecución.

```bash
# Registra el workflow y súbelo a tu fork
git add .github/workflows/pruebas-unitarias.yml
git commit -m "Añade el workflow de pruebas unitarias"
git push
```

**Resultado esperado** del commit (el identificador cambia):

```text
[main b13f12b] Añade el workflow de pruebas unitarias
 1 file changed, 35 insertions(+)
 create mode 100644 .github/workflows/pruebas-unitarias.yml
```

Abre la pestaña **Actions** del fork: aparece una ejecución de **[Pruebas unitarias](../glosario/01-fundamentos.md#prueba-unitaria)** con el mensaje del
commit. Ábrela, pulsa el job **Vitest** y despliega el step **Run npx vitest run --reporter=verbose**.

Desde el terminal del Codespace ves lo mismo con `gh` (los identificadores y tiempos cambian):

```bash
# Última ejecución y sus steps
gh run list --workflow pruebas-unitarias.yml --limit 1
gh run view --job=<ID del job que muestra gh run view>
```

```text
✓ Vitest in 30s (ID 134415921967)
  ✓ Set up job
  ✓ Run actions/checkout@v7
  ✓ Run actions/setup-node@v7
  ✓ Run npm ci
  ✓ Run npx vitest run --reporter=verbose
  ✓ Post Run actions/setup-node@v7
  ✓ Post Run actions/checkout@v7
  ✓ Complete job
```

Log del step **Run npx vitest run --reporter=verbose**:

```text
Run npx vitest run --reporter=verbose
npx vitest run --reporter=verbose
shell: /usr/bin/bash -e {0}

 RUN  v5.1.0 /home/runner/work/testing-automatizacion-agile-201/testing-automatizacion-agile-201/ejercicios/M04-01-primer-workflow

 ✓ tests/contrasena.test.js > esContrasenaValida > acepta 8 caracteres con letras y números 1ms
 ✓ tests/contrasena.test.js > esContrasenaValida > rechaza 7 caracteres aunque tenga letras y números 0ms
 ✓ tests/contrasena.test.js > esContrasenaValida > rechaza una contraseña sin números 0ms
 ✓ tests/contrasena.test.js > esContrasenaValida > rechaza una contraseña sin letras 0ms

 Test Files  1 passed (1)
      Tests  4 passed (4)
   Start at  22:25:23
   Duration  107ms (transform 55%, import 26%, tests 10%, worker 9%)
```

El log del step de Vitest es la misma salida del paso 1, ahora en una máquina que no es la tuya. Los
steps sin `name` toman como nombre el propio comando o la acción (`Run npm ci`).

### 5 — Romper una regla y ver el job en rojo

Un compañero decide que 8 caracteres son muchos y baja la longitud mínima a 6. El cambio parece
inofensivo, pero la prueba del borde (7 caracteres deben rechazarse) lo detecta. Cambia en
`src/contrasena.js` la línea `export const LONGITUD_MINIMA = 8;` por `export const LONGITUD_MINIMA = 6;`
y ejecuta primero en tu terminal.

```bash
# En la carpeta del ejercicio: las pruebas con la regla cambiada
cd ejercicios/M04-01-primer-workflow
npx vitest run --reporter=verbose
```

**Resultado esperado** (los tiempos y la hora cambian):

```text
 RUN  v5.1.0 /workspaces/testing-automatizacion-agile-201/ejercicios/M04-01-primer-workflow

 ✓ tests/contrasena.test.js > esContrasenaValida > acepta 8 caracteres con letras y números 1ms
 × tests/contrasena.test.js > esContrasenaValida > rechaza 7 caracteres aunque tenga letras y números 4ms
   → expected true to be false // Object.is equality
 ✓ tests/contrasena.test.js > esContrasenaValida > rechaza una contraseña sin números 0ms
 ✓ tests/contrasena.test.js > esContrasenaValida > rechaza una contraseña sin letras 0ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  tests/contrasena.test.js > esContrasenaValida > rechaza 7 caracteres aunque tenga letras y números
AssertionError: expected true to be false // Object.is equality

- Expected
+ Received

- false
+ true

 ❯ tests/contrasena.test.js:10:43
      8|
      9|   it('rechaza 7 caracteres aunque tenga letras y números', () => {
     10|     expect(esContrasenaValida('abcdef1')).toBe(false);
       |                                           ^
     11|   });
     12|

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯


 Test Files  1 failed (1)
      Tests  1 failed | 3 passed (4)
   Start at  17:19:49
   Duration  122ms (transform 43%, import 26%, tests 22%, worker 8%)
```

Vitest termina con código de salida 1. Eso es lo que el runner mira: un step cuyo comando acaba con un
código distinto de 0 falla, y con él el job. Ahora sube el cambio como lo haría ese compañero:

```bash
# Sube el cambio de la regla
git commit -am "Baja la longitud mínima de la contraseña a 6"
git push
```

**Resultado esperado** del commit (el identificador cambia):

```text
[main 1e15376] Baja la longitud mínima de la contraseña a 6
 1 file changed, 1 insertion(+), 1 deletion(-)
```

En **Actions**, la nueva ejecución termina con ✗. Dentro del job **Vitest**, el step de Vitest está en
rojo con el mismo error; los steps posteriores no se ejecutan.

Con `gh run view` del identificador de esa ejecución:

```text
X main Pruebas unitarias · 44190000329
Triggered via push less than a minute ago

JOBS
X Vitest in 28s (ID 134416540050)
  ✓ Set up job
  ✓ Run actions/checkout@v7
  ✓ Run actions/setup-node@v7
  ✓ Run npm ci
  X Run npx vitest run --reporter=verbose
  - Post Run actions/setup-node@v7
  ✓ Post Run actions/checkout@v7
  ✓ Complete job

ANNOTATIONS
X Process completed with exit code 1.
Vitest: .github#41
```

La anotación **Process completed with exit code 1.** es la que se ve en el resumen de la ejecución. El
log del step fallido trae el mismo error que tu terminal (`gh run view <ID> --log-failed` lo muestra
sin abrir el navegador).

Deja la regla como estaba (`LONGITUD_MINIMA = 8`) y súbela: la siguiente ejecución vuelve a verde.

```bash
# Restaura la regla y súbela
git commit -am "Vuelve a exigir 8 caracteres"
git push
```

### 6 — Comprobar el filtro `paths`

El filtro evita ejecutar las pruebas de este ejercicio cuando cambias otra parte del repositorio. Lo
compruebas con un cambio fuera de la carpeta: una línea al final del `README.md` de otro ejercicio, por
ejemplo el de la demo.

```bash
# Desde la raíz: un cambio que no toca ni el ejercicio ni el workflow
cd /workspaces/testing-automatizacion-agile-201
echo "" >> ejercicios/M04-00-un-pipeline-de-pruebas/README.md
git commit -am "Cambio fuera del ejercicio M04-01"
git push
```

**Resultado esperado:** en **Actions**, filtrando por el workflow **Pruebas unitarias** (lista de la
izquierda), no aparece ninguna ejecución nueva para ese commit.

Desde el terminal, la lista del workflow sigue terminando en el commit «Vuelve a exigir 8 caracteres»:

```bash
# Ejecuciones de este workflow: no hay ninguna para «Cambio fuera del ejercicio M04-01»
gh run list --workflow pruebas-unitarias.yml --limit 5
```

```text
completed	success	Vuelve a exigir 8 caracteres	Pruebas unitarias	main	push	44190135821	31s	2026-11-17T22:26:51Z
completed	failure	Baja la longitud mínima de la contraseña a 6	Pruebas unitarias	main	push	44190000329	32s	2026-11-17T22:26:00Z
completed	success	Añade el workflow de pruebas unitarias	Pruebas unitarias	main	push	44189822958	33s	2026-11-17T22:24:56Z
```

## Comprueba tu entendimiento

**El job lee el exit code**
Cambia la prueba `acepta 8 caracteres…` para que espere `false` y ejecuta, en la carpeta del ejercicio:

```bash
# Ejecuta las pruebas y muestra el código de salida del último comando
npx vitest run; echo "código de salida: $?"
```

→ Sale `código de salida: 1`: es el mismo código que pondría el job en rojo. Deja la prueba como estaba.

**Un workflow fuera de sitio no existe**
Mira en el explorador de VS Code dónde está tu fichero: `.github/workflows/pruebas-unitarias.yml` en la
raíz, no dentro de `ejercicios/`.
→ Si estuviera en `ejercicios/M04-01-primer-workflow/.github/workflows/`, GitHub no lo vería y no habría
ninguna ejecución.

## Investiga

Abre en el navegador la página de la acción `actions/setup-node`
(`https://github.com/actions/setup-node`) y busca en su `action.yml` qué entradas acepta: ¿qué hace
`cache-dependency-path` y cuándo te haría falta en este repositorio? Después, en el log del job **Vitest**,
despliega **Run actions/setup-node@v7** de la primera y de la segunda ejecución: en una pone que no
encuentra caché y en la otra que la restaura.

## Experimenta

Antes de probar, predice: si quitas el `working-directory` del step de pruebas, Vitest arranca en la raíz
del repositorio. ¿Cuántas pruebas ejecutará y pasará el job? Compruébalo sin gastar una ejecución de
Actions, lanzando lo mismo que haría el runner:

```bash
# Desde la raíz del repositorio: Vitest sin carpeta de ejercicio
cd /workspaces/testing-automatizacion-agile-201
npx vitest run
```

Vitest recoge todos los ficheros `*.test.js` y `*.spec.js` de todos los ejercicios del curso, incluidos los
de [Playwright](../glosario/02-e2e.md#playwright) y [Cypress](../glosario/02-e2e.md#cypress), que no son suyos y fallan al cargarse: el job se pondría en rojo por pruebas que
no tienen nada que ver con tu cambio. El `working-directory` (o una configuración con `include`) acota
qué suite es la de este workflow.

## Reto

### 1 — Las pruebas en dos versiones de Node

**La situación:** el equipo va a pasar de Node 22 a Node 24 y alguien propone esperar a hacerlo para
probar. Tú prefieres saber hoy si las pruebas pasan en las dos versiones, en cada push.

**Qué haces:** cambias el job `vitest` de tu workflow para que se ejecute dos veces, una con Node 22 y otra
con Node 24, y lo subes.

**Pistas:** `strategy.matrix` con una lista (`node: [22, 24]`); el valor se usa como
`${{ matrix.node }}` en `node-version` y en el `name` del job.

**Lo que buscas:** una ejecución con dos jobs en paralelo, `Vitest (Node 22)` y `Vitest (Node 24)`, los dos
en verde.

<details>
<summary>Ver solución</summary>

```yaml
jobs:
  vitest:
    name: Vitest (Node ${{ matrix.node }})
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node: [22, 24]
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: ${{ matrix.node }}
          cache: npm
      - run: npm ci
      - run: npx vitest run --reporter=verbose
        working-directory: ejercicios/M04-01-primer-workflow
```

```text
✓ main Pruebas unitarias · 44190243574
Triggered via push less than a minute ago

JOBS
✓ Vitest (Node 22) in 25s (ID 134417400479)
✓ Vitest (Node 24) in 27s (ID 134417401196)
```

La matriz multiplica el job por cada valor y los ejecuta a la vez: el tiempo total es el del más lento,
no la suma. Si uno falla, por defecto GitHub cancela los demás (`fail-fast: true`); con
`fail-fast: false` ves el resultado de todos. **La regla:** lo que no se prueba en CI no está soportado;
una matriz convierte «debería funcionar en Node 24» en un [check](../glosario/04-ci-cd.md#check).

</details>

## Errores frecuentes

| Síntoma | Causa probable | Cómo arreglarlo |
|---------|----------------|-----------------|
| Tras el push no aparece nada en **Actions** | Actions sin habilitar en el fork, o el fichero no está en `.github/workflows/` de la raíz | Paso 2; comprueba la ruta con `ls .github/workflows` desde la raíz |
| `git push` rechazado con «refusing to allow … to create or update workflow … without `workflows` permission» | El token con el que empujas no tiene permiso para tocar workflows | Crea el fichero desde la web del fork (**Add file** → **Create new file**, nombre `.github/workflows/pruebas-unitarias.yml`) y después `git pull` en el Codespace |
| `npm ci` falla con «The `npm ci` command can only install with an existing package-lock.json» | `npm ci` se ejecuta en la carpeta del ejercicio, que no tiene `package-lock.json` | `npm ci` va en la raíz; solo el step de pruebas lleva `working-directory` |
| El step de Vitest dice «No test files found» | `working-directory` apunta a otra carpeta | La ruta es relativa a la raíz del repositorio: `ejercicios/M04-01-primer-workflow` |
| Error de YAML «mapping values are not allowed here» | Sangría mezclada o tabuladores | YAML solo admite espacios; usa dos por nivel, como en el bloque del paso 3 |
| La ejecución no aparece al cambiar un fichero de otro ejercicio | Es el filtro `paths`, funciona como debe | Comprueba en `on.push.paths` qué carpetas disparan el workflow |

## Conclusiones

### Qué es un workflow de CI

Un fichero YAML versionado en `.github/workflows/` que dice ante qué eventos (`push`, `pull_request`) se
ejecuta, en qué runner y con qué steps. Cada ejecución arranca en una máquina limpia, ejecuta los mismos
comandos que tú y deja un check verde o rojo en el commit.

### Cómo debe ser

| Requisito | En el lab |
|-----------|-----------|
| Reproducible: instala lo que fija el lockfile | `npm ci` en la raíz, Node 22 fijado en `setup-node` |
| Ejecuta exactamente lo que ejecutas tú | `npx vitest run --reporter=verbose` en la carpeta del ejercicio |
| Falla cuando fallan las pruebas | Código de salida 1 de Vitest → step y job en rojo |
| Se dispara solo cuando toca | `paths` con el ejercicio y el propio workflow |

### Dónde se rompe y cómo lo has detectado

| Fallo | Cómo lo has visto | Qué provoca |
|-------|-------------------|-------------|
| Un cambio de regla sin revisar las pruebas | `LONGITUD_MINIMA = 6` → `rechaza 7 caracteres…` en rojo en local y en Actions | Si nadie mira el check, el cambio entra igual |
| La suite no está acotada | Experimenta: sin `working-directory`, Vitest recoge las pruebas de todo el repositorio | El job falla por pruebas ajenas al cambio, y el rojo deja de significar algo |
| Un filtro `paths` demasiado estrecho | Paso 6: un cambio fuera del filtro no dispara nada | Si el filtro olvida una carpeta de la que depende el código, sus cambios no se prueban |

### Cómo se perfecciona

Con una matriz de versiones (el reto), `timeout-minutes` para que un job colgado no consuma horas,
nombres en los steps para leer el log de un vistazo y, sobre todo, haciendo que el check decida: una
regla de la rama que exija el verde para fusionar (lab 05).

### En una frase

> 🔑 Un workflow convierte «acuérdate de pasar las pruebas» en un check que se ejecuta solo en cada
> cambio y que se pone en rojo cuando una prueba falla.
