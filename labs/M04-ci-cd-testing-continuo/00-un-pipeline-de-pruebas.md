# Un pipeline de pruebas

[← Página anterior](README.md) · [Siguiente página →](01-lab-primer-workflow.md)

Esta demostración recorre la [integración continua](../glosario/01-fundamentos.md#integracion-continua) de
principio a fin con el ejemplo más pequeño posible: una función que suma un carrito, tres pruebas de
[Vitest](../glosario/01-fundamentos.md#vitest) y un [workflow](../glosario/04-ci-cd.md#workflow) de GitHub Actions que las ejecuta. Se ve qué
dispara la ejecución, cómo se leen sus [jobs](../glosario/04-ci-cd.md#job) y sus logs, y qué aparece en un pull request cuando una
prueba falla.

## Punto de partida

- Repositorio: tu fork de `testing-automatizacion-agile-201`, con un Codespace abierto sobre él.
- Ejercicio: [`ejercicios/M04-00-un-pipeline-de-pruebas/`](../../ejercicios/M04-00-un-pipeline-de-pruebas/README.md)
  (`src/carrito.js`, `tests/carrito.test.js` y el workflow `demo-pipeline.yml`).
- GitHub Actions habilitado en el fork. En un fork viene desactivado: en la pestaña **Actions** del
  repositorio, si aparece el aviso *Workflows aren't being run on this forked repository*, se pulsa
  **I understand my workflows, go ahead and enable them**.
- Para que GitHub ejecute el workflow, el fichero tiene que estar en `.github/workflows/` en la raíz del
  repositorio:

```bash
# Desde la raíz del repositorio: copia el workflow de la demo a la carpeta que lee GitHub
mkdir -p .github/workflows
cp ejercicios/M04-00-un-pipeline-de-pruebas/demo-pipeline.yml .github/workflows/
```

## Recorrido

### 1 — Las pruebas, en el terminal

Antes de llevar nada a CI, las pruebas tienen que pasar en local. `totalCarrito` suma precio × cantidad
de cada línea y redondea a céntimos; las pruebas cubren el carrito vacío, una multiplicación y el
redondeo (`0,1 × 3`, que en coma flotante no da exactamente `0,3`).

```bash
# Ejecuta las pruebas del ejercicio con el reporter que lista cada prueba
cd ejercicios/M04-00-un-pipeline-de-pruebas
npx vitest run --reporter=verbose
```

Salida (los tiempos y la hora cambian en cada ejecución):

```text
 RUN  v5.1.0 /workspaces/testing-automatizacion-agile-201/ejercicios/M04-00-un-pipeline-de-pruebas

 ✓ tests/carrito.test.js > totalCarrito > un carrito vacío suma 0 2ms
 ✓ tests/carrito.test.js > totalCarrito > multiplica precio por cantidad 0ms
 ✓ tests/carrito.test.js > totalCarrito > redondea a céntimos 0ms

 Test Files  1 passed (1)
      Tests  3 passed (3)
   Start at  17:20:10
   Duration  149ms (import 43%, transform 27%, tests 17%, worker 13%)
```

Este es exactamente el comando que ejecutará el [runner](../glosario/04-ci-cd.md#runner). Lo que cambia en CI no es la prueba, sino quién
la lanza y cuándo.

### 2 — El workflow

[`demo-pipeline.yml`](../../ejercicios/M04-00-un-pipeline-de-pruebas/demo-pipeline.yml) describe cuándo
se ejecuta, en qué máquina y con qué pasos:

```yaml
name: Demo pipeline

on:
  push:
    paths:
      - 'ejercicios/M04-00-un-pipeline-de-pruebas/**'
      - '.github/workflows/demo-pipeline.yml'
  pull_request:
    paths:
      - 'ejercicios/M04-00-un-pipeline-de-pruebas/**'
      - '.github/workflows/demo-pipeline.yml'

jobs:
  unitarias:
    name: Unitarias (Node ${{ matrix.node }})
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node: [22, 24]
    defaults:
      run:
        working-directory: ejercicios/M04-00-un-pipeline-de-pruebas
    steps:
      - name: Descargar el código
        uses: actions/checkout@v7

      - name: Instalar Node.js ${{ matrix.node }}
        uses: actions/setup-node@v7
        with:
          node-version: ${{ matrix.node }}
          cache: npm

      - name: Instalar dependencias
        run: npm ci
        working-directory: .

      - name: Ejecutar las pruebas unitarias
        run: npx vitest run
```

| Parte | Qué dice |
|-------|----------|
| `on: push` / `pull_request` + `paths` | Se ejecuta en cada push y en cada pull request, pero solo si cambian el ejercicio o el propio workflow |
| `jobs.unitarias` | Un job; con `strategy.matrix` se convierte en dos, uno con Node 22 y otro con Node 24, en paralelo |
| `runs-on: ubuntu-latest` | Cada job corre en una máquina Ubuntu recién creada por GitHub (el runner) |
| `defaults.run.working-directory` | Los `run` se ejecutan en la carpeta del ejercicio, salvo `npm ci`, que va en la raíz (`working-directory: .`) |
| `uses: actions/checkout@v7` | Una acción: trae el código del commit que disparó la ejecución |
| `uses: actions/setup-node@v7` con `cache: npm` | Instala Node y guarda en caché la descarga de npm para la próxima ejecución |
| `run: npm ci` | Instala las dependencias exactas de `package-lock.json` |
| `run: npx vitest run` | Las pruebas: si fallan, el comando termina con código 1 y el job queda en rojo |

### 3 — Un push dispara el workflow

Al hacer commit y push del workflow (y de cualquier cambio dentro del ejercicio), GitHub crea una
**ejecución** (*workflow run*). En la pestaña **Actions** del fork aparece en la lista con el mensaje del
commit, la rama, el evento (`push`) y un icono de estado: amarillo mientras corre, verde ✓ o rojo ✗ al
terminar.

```bash
# Desde la raíz del repositorio: registra el workflow y súbelo a tu fork
git add .github/workflows/demo-pipeline.yml
git commit -m "Añade el workflow de la demo"
git push
```

La misma lista se consulta desde el terminal con `gh run list` (la última columna es la hora del push; el
identificador cambia):

```bash
# Las últimas ejecuciones del fork
gh run list --limit 3
```

```text
completed	success	Añade el workflow de la demo	Demo pipeline	main	push	44190391275	39s	2026-11-17T22:28:28Z
completed	success	Pruebas en Node 22 y 24	Pruebas unitarias	main	push	44190243574	30s	2026-11-17T22:27:32Z
completed	success	Vuelve a exigir 8 caracteres	Pruebas unitarias	main	push	44190135821	39s	2026-11-17T22:26:51Z
```

Columnas: estado, conclusión, mensaje del commit, workflow, rama, evento, identificador, duración y hora.
Mientras corre, las dos primeras dicen `in_progress` y nada.

### 4 — Los jobs y sus logs

Al abrir la ejecución, la página muestra un resumen con el evento, la duración y un grafo con los
**jobs**. Por la matriz hay dos: `Unitarias (Node 22)` y `Unitarias (Node 24)`. Al pulsar uno se ve la
lista de **steps** con su duración; cada step se despliega y muestra su log, que es la misma salida que
en el terminal. GitHub añade steps propios al principio (*Set up job*) y al final (*Post …*, *Complete job*).

Desde el terminal, `gh run view` muestra lo mismo que la página: la ejecución, sus jobs y, con `--job`,
los steps de uno de ellos.

```bash
# Resumen de la última ejecución de la demo (el identificador sale de gh run list)
gh run view 44190391275
# Steps de un job concreto
gh run view --job=134417922869
```

```text
✓ main Demo pipeline · 44190391275
Triggered via push less than a minute ago

JOBS
✓ Unitarias (Node 22) in 26s (ID 134417922869)
✓ Unitarias (Node 24) in 36s (ID 134417923375)

✓ Unitarias (Node 22) in 26s (ID 134417922869)
  ✓ Set up job
  ✓ Descargar el código
  ✓ Instalar Node.js 22
  ✓ Instalar dependencias
  ✓ Ejecutar las pruebas unitarias
  ✓ Post Instalar Node.js 22
  ✓ Post Descargar el código
  ✓ Complete job
```

Y el log desplegado del step **Ejecutar las pruebas unitarias**:

```text
Run npx vitest run
npx vitest run
shell: /usr/bin/bash -e {0}

 RUN  v5.1.0 /home/runner/work/testing-automatizacion-agile-201/testing-automatizacion-agile-201/ejercicios/M04-00-un-pipeline-de-pruebas

 ✓ tests/carrito.test.js (3 tests) 3ms

 Test Files  1 passed (1)
      Tests  3 passed (3)
   Start at  22:28:53
   Duration  119ms (transform 53%, import 28%, worker 10%, tests 9%)
```

Los steps llevan el `name` que les da el workflow; GitHub añade *Set up job*, los *Post …* (limpieza de
cada acción) y *Complete job*. La ruta `/home/runner/work/…` es la copia del repositorio en el runner.

El log de *Ejecutar las [pruebas unitarias](../glosario/01-fundamentos.md#prueba-unitaria)* termina con el resumen de Vitest. Como el runner no es un
terminal interactivo, Vitest muestra solo el resumen (`Test Files  1 passed (1)`, `Tests  3 passed (3)`)
y no la lista de pruebas; con `--reporter=verbose` la mostraría como en el paso 1.

### 5 — El check en un pull request

El mismo workflow se dispara con `pull_request`. Para verlo, en una rama nueva se quita el redondeo de
`totalCarrito` (`return total;` en lugar de `return Math.round(total * 100) / 100;`). En el terminal, la
prueba del redondeo falla:

```bash
# En la carpeta del ejercicio, con el redondeo quitado
npx vitest run --reporter=verbose
```

Salida (los tiempos y la hora cambian en cada ejecución):

```text
 RUN  v5.1.0 /workspaces/testing-automatizacion-agile-201/ejercicios/M04-00-un-pipeline-de-pruebas

 ✓ tests/carrito.test.js > totalCarrito > un carrito vacío suma 0 2ms
 ✓ tests/carrito.test.js > totalCarrito > multiplica precio por cantidad 0ms
 × tests/carrito.test.js > totalCarrito > redondea a céntimos 6ms
   → expected 0.30000000000000004 to be 0.3 // Object.is equality

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  tests/carrito.test.js > totalCarrito > redondea a céntimos
AssertionError: expected 0.30000000000000004 to be 0.3 // Object.is equality

- Expected
+ Received

- 0.3
+ 0.30000000000000004

 ❯ tests/carrito.test.js:14:58
     12|
     13|   it('redondea a céntimos', () => {
     14|     expect(totalCarrito([{ precio: 0.1, cantidad: 3 }])).toBe(0.3);
       |                                                          ^
     15|   });
     16| });

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯


 Test Files  1 failed (1)
      Tests  1 failed | 2 passed (3)
   Start at  17:40:52
   Duration  134ms (transform 39%, tests 29%, import 23%, worker 8%)
```

Con esa rama subida y un pull request abierto contra `main` **del propio fork**, la página del pull
request muestra en su parte inferior la caja de **[checks](../glosario/04-ci-cd.md#check)**: una línea por job y evento
(`Demo pipeline/Unitarias (Node 22) (push)`, `… (pull_request)`, y las de Node 24) con su estado y un enlace
**Details** al log. El job en rojo dice, sin abrir ningún terminal, qué prueba ha fallado y por qué.

```bash
# Rama con el cambio, subida al fork y pull request contra el main del fork
git switch -c quitar-redondeo
git commit -am "Quita el redondeo del total"
git push -u origin quitar-redondeo
gh pr create --repo "$GITHUB_REPOSITORY" --base main --title "Quita el redondeo del total" --body "Demo M04-00"
```

La caja de checks dice **Some checks were not successful** y lista **cuatro** líneas, no dos: el push de
la rama `quitar-redondeo` dispara una ejecución (`push`) y abrir el pull request, otra (`pull_request`).
Desde el terminal:

```bash
# Estado de los checks del pull request (el número sale de gh pr create)
gh pr checks 1
```

```text
Some checks were not successful
2 cancelled, 2 failing, 0 successful, 0 skipped, and 0 pending checks

   NAME                                             DESCRIPTION  ELAPSED  URL
X  Demo pipeline/Unitarias (Node 22) (push)                      21s      https://github.com/…
X  Demo pipeline/Unitarias (Node 24) (pull_requ...               22s      https://github.com/…
-  Demo pipeline/Unitarias (Node 22) (pull_requ...               22s      https://github.com/…
-  Demo pipeline/Unitarias (Node 24) (push)                      25s      https://github.com/…
```

En cada ejecución falla un job y el otro aparece cancelado (`-`): con la matriz, en cuanto un job falla
GitHub cancela los demás (`fail-fast`). Al pulsar **Details** en una línea en rojo, el log del step de
pruebas:

```text
 RUN  v5.1.0 /home/runner/work/testing-automatizacion-agile-201/testing-automatizacion-agile-201/ejercicios/M04-00-un-pipeline-de-pruebas

 ❯ tests/carrito.test.js (3 tests | 1 failed) 7ms
   ❯ totalCarrito (3)
     ✓ un carrito vacío suma 0 1ms
     ✓ multiplica precio por cantidad 0ms
     × redondea a céntimos 4ms
 Test Files  1 failed (1)
      Tests  1 failed | 2 passed (3)

Error: AssertionError: expected 0.30000000000000004 to be 0.3 // Object.is equality

- Expected
+ Received

- 0.3
+ 0.30000000000000004

 ❯ tests/carrito.test.js:14:58

Error: Process completed with exit code 1.
```

Sin una regla en la rama, el botón de fusionar sigue disponible aunque el check esté en rojo: el check
informa, pero todavía no decide.

## Qué queda visto

- Un workflow es un fichero YAML versionado en `.github/workflows/`: evento (`on`), jobs, runner y steps.
- Cada push o pull request que cumple el filtro crea una ejecución; sus jobs corren en máquinas limpias
  y su log es la salida de los mismos comandos que en el terminal.
- El resultado llega al commit y al pull request como un check, con enlace al log.

El laboratorio [01 — Primer workflow](01-lab-primer-workflow.md) parte de un ejercicio distinto y se hace
sin haber seguido esta demostración. La pregunta que deja abierta: si el workflow se dispara con cada
push, **¿qué tiene que pasar en el workflow para que un error en las pruebas se vea en rojo y no se
pierda, y cómo evitas que se ejecute cuando cambias otra parte del repositorio?**
