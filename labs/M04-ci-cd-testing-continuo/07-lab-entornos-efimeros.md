# Lab — Entornos efímeros

[← Página anterior](06-lab-pruebas-en-contenedores.md) · [Siguiente página →](../M05-buenas-practicas-ia/README.md)

Practicas el [entorno efímero](../glosario/04-ci-cd.md#entorno-efimero): un entorno completo que se crea
para una ejecución de pruebas y se destruye al terminar. El ejercicio es una API de libros sobre
PostgreSQL 17 con tres libros de [datos de semilla](../glosario/04-ci-cd.md#datos-de-semilla) y dos pruebas
de API que dan por hecho un entorno recién creado. Compruebas que pasan una vez, que la segunda ejecución
sobre el mismo entorno falla, y montas el ciclo crear → probar → destruir en tu terminal y en GitHub
Actions.

### Objetivo

Comprender qué es un entorno efímero: cómo funciona, cómo debe ser, cómo se detectan sus debilidades y cómo
se mejora.

### Punto de partida

- Codespace del curso abierto, con Docker.
- Carpeta del ejercicio: [`ejercicios/M04-07-entornos-efimeros/`](../../ejercicios/M04-07-entornos-efimeros/README.md).
  La API escucha en el puerto **3407**; la base de datos no se publica fuera de Compose. El proyecto de
  Compose se llama `m04-07`.
- La primera vez se descarga `postgres:17-alpine` y se construye la imagen de la API (`app/Dockerfile`).
- Solución: [`solucion/entorno-efimero.sh`](../../ejercicios/M04-07-entornos-efimeros/solucion/entorno-efimero.sh)
  y [`solucion/entorno-efimero.yml`](../../ejercicios/M04-07-entornos-efimeros/solucion/entorno-efimero.yml).

```bash
# Entra en la carpeta del ejercicio
cd ejercicios/M04-07-entornos-efimeros
```

### Qué está pasando

Las pruebas que escriben datos dejan rastro. En un entorno compartido (una preproducción que usa todo el
equipo), cada ejecución hereda lo que dejaron las anteriores: los recuentos cambian, los identificadores
avanzan y una prueba que pasaba ayer falla hoy sin que nadie haya tocado el código. Un entorno efímero lo
evita: cada ejecución parte del mismo estado conocido (la semilla) y nadie más lo toca.

| Pieza | Qué es |
|-------|--------|
| Servicio `db` | PostgreSQL 17 con sus datos en el volumen `datos` |
| `db/semilla.sql` | Crea la tabla `libros` e inserta tres libros; PostgreSQL lo ejecuta **solo si el volumen está vacío** |
| Servicio `api` | La API (`GET /libros`, `POST /libros`), construida desde `app/Dockerfile`, sana cuando habla con la base de datos |
| `tests/libros.spec.js` | Dos [pruebas de API](../glosario/01-fundamentos.md#prueba-de-api) con el cliente `request` de [Playwright](../glosario/02-e2e.md#playwright) (sin navegador) |

| Comando | Qué hace con el volumen `datos` |
|---------|---------------------------------|
| `docker compose up -d --wait` | Lo crea si no existe (y entonces se carga la semilla) |
| `docker compose down` | Borra contenedores y red; **el volumen se queda** |
| `docker compose down -v` | Borra contenedores, red **y volumen** |

### 1 — Crear el entorno

`--wait` deja el comando en espera hasta que todos los servicios están sanos: cuando vuelve, la API ya
responde y la base de datos tiene la semilla.

```bash
# Crea y arranca el entorno, y espera a que esté sano
docker compose up -d --wait
```

**Resultado esperado** (la primera vez, antes de estas líneas, aparece la construcción de la imagen `api`):

```text
 Network m04-07_default  Creating
 Network m04-07_default  Created
 Volume m04-07_datos  Creating
 Volume m04-07_datos  Created
 Container m04-07-db-1  Creating
 Container m04-07-db-1  Created
 Container m04-07-api-1  Creating
 Container m04-07-api-1  Created
 Container m04-07-db-1  Starting
 Container m04-07-db-1  Started
 Container m04-07-db-1  Waiting
 Container m04-07-db-1  Healthy
 Container m04-07-api-1  Starting
 Container m04-07-api-1  Started
 Container m04-07-api-1  Waiting
 Container m04-07-db-1  Waiting
 Container m04-07-db-1  Healthy
 Container m04-07-api-1  Healthy
```

`Volume m04-07_datos  Created`: volumen nuevo, así que PostgreSQL ha ejecutado la semilla. Lo ves en su
log:

```bash
# Las líneas del log de la base de datos que hablan de la semilla
docker compose logs db | grep -E 'initdb.d|CREATE TABLE|INSERT'
```

**Resultado esperado:**

```text
db-1  | /usr/local/bin/docker-entrypoint.sh: running /docker-entrypoint-initdb.d/semilla.sql
db-1  | CREATE TABLE
db-1  | INSERT 0 3
```

### 2 — Mirar los datos en crudo

Antes de probar, miras lo que devuelve la API: es el estado del que parten las pruebas.

```bash
# El catálogo tal como lo devuelve la API
curl -s http://localhost:3407/libros
```

**Resultado esperado:**

```text
[{"id":1,"titulo":"Cien años de soledad","autor":"Gabriel García Márquez"},{"id":2,"titulo":"La casa de los espíritus","autor":"Isabel Allende"},{"id":3,"titulo":"Rayuela","autor":"Julio Cortázar"}]
```

Tres libros, ids 1 a 3. Abre [`tests/libros.spec.js`](../../ejercicios/M04-07-entornos-efimeros/tests/libros.spec.js):
la primera prueba exige exactamente esos tres títulos y la segunda crea `Pedro Páramo` y espera que reciba el
id 4.

### 3 — Ejecutar las pruebas

```bash
# Las pruebas de la API sobre el entorno recién creado
npx playwright test
```

**Resultado esperado** (los tiempos cambian):

```text
Running 2 tests using 1 worker

  ✓  1 tests/libros.spec.js:5:1 › el catálogo empieza con los tres libros de la semilla (24ms)
  ✓  2 tests/libros.spec.js:16:1 › añade un libro y le da el id 4 (19ms)

  2 passed (427ms)
```

### 4 — Repetir sobre el mismo entorno

Es lo que pasa en un entorno compartido: la siguiente ejecución llega con los datos que dejó la anterior.

```bash
# Las mismas pruebas, otra vez, sin tocar el entorno
npx playwright test
```

**Resultado esperado** (recortado; los tiempos cambian):

```text
Running 2 tests using 1 worker

  ✘  1 tests/libros.spec.js:5:1 › el catálogo empieza con los tres libros de la semilla (29ms)
  ✘  2 tests/libros.spec.js:16:1 › añade un libro y le da el id 4 (39ms)


  1) tests/libros.spec.js:5:1 › el catálogo empieza con los tres libros de la semilla ──────────────

    Error: expect(received).toEqual(expected) // deep equality

    - Expected  - 0
    + Received  + 1

      Array [
        "Cien años de soledad",
        "La casa de los espíritus",
        "Rayuela",
    +   "Pedro Páramo",
      ]
    …

  2) tests/libros.spec.js:16:1 › añade un libro y le da el id 4 ────────────────────────────────────

    Error: expect(received).toEqual(expected) // deep equality

    - Expected  - 1
    + Received  + 1

      Object {
        "autor": "Juan Rulfo",
    -   "id": 4,
    +   "id": 5,
        "titulo": "Pedro Páramo",
      }
    …

  2 failed
    tests/libros.spec.js:5:1 › el catálogo empieza con los tres libros de la semilla ───────────────
    tests/libros.spec.js:16:1 › añade un libro y le da el id 4 ─────────────────────────────────────
```

El código no ha cambiado. Ha cambiado el **estado**: el libro de la primera ejecución sigue ahí y la
secuencia de ids ha avanzado. Las dos ejecuciones se han contaminado.

### 5 — Bajar el entorno sin borrar el volumen

Parece que basta con apagar y encender. Lo compruebas:

```bash
# Baja el entorno (sin -v), mira los volúmenes, súbelo y mira los datos
docker compose down
docker volume ls --filter name=m04-07
docker compose up -d --wait
curl -s http://localhost:3407/libros
```

**Resultado esperado** de `docker volume ls` y de `curl` (las líneas de `down` y `up` son como las del paso 1,
sin `Volume … Created`):

```text
DRIVER    VOLUME NAME
local     m04-07_datos
```

```text
[{"id":1,"titulo":"Cien años de soledad","autor":"Gabriel García Márquez"},{"id":2,"titulo":"La casa de los espíritus","autor":"Isabel Allende"},{"id":3,"titulo":"Rayuela","autor":"Julio Cortázar"},{"id":4,"titulo":"Pedro Páramo","autor":"Juan Rulfo"},{"id":5,"titulo":"Pedro Páramo","autor":"Juan Rulfo"}]
```

Contenedores nuevos, datos viejos: el volumen sobrevivió, y como no estaba vacío, PostgreSQL **no** volvió a
ejecutar la semilla. Ahí están los dos `Pedro Páramo` de las ejecuciones anteriores.

### 6 — Destruir de verdad y volver a crear

```bash
# Baja el entorno con sus volúmenes y comprueba que no queda ninguno
docker compose down -v
docker volume ls --filter name=m04-07
```

**Resultado esperado:**

```text
 Container m04-07-api-1  Stopping
 Container m04-07-api-1  Stopped
 Container m04-07-api-1  Removing
 Container m04-07-api-1  Removed
 Container m04-07-db-1  Stopping
 Container m04-07-db-1  Stopped
 Container m04-07-db-1  Removing
 Container m04-07-db-1  Removed
 Volume m04-07_datos  Removing
 Network m04-07_default  Removing
 Volume m04-07_datos  Removed
 Network m04-07_default  Removed
DRIVER    VOLUME NAME
```

```bash
# Ciclo completo: crear, probar, destruir
docker compose up -d --wait
npx playwright test
docker compose down -v
```

**Resultado esperado** de las pruebas (los tiempos cambian):

```text
Running 2 tests using 1 worker

  ✓  1 tests/libros.spec.js:5:1 › el catálogo empieza con los tres libros de la semilla (41ms)
  ✓  2 tests/libros.spec.js:16:1 › añade un libro y le da el id 4 (26ms)

  2 passed (581ms)
```

Repite el ciclo las veces que quieras: siempre `2 passed`. Cada ejecución tiene su base de datos, nacida de
la semilla y destruida al terminar.

### 7 — El mismo ciclo en GitHub Actions

En CI no hace falta Compose para la base de datos: un [job](../glosario/04-ci-cd.md#job) puede declarar **[contenedores de servicio](../glosario/04-ci-cd.md#contenedor-de-servicio)**
(`services:`) que GitHub arranca antes de los steps y destruye al terminar el job. Es un entorno efímero por
definición. La API se arranca con `webServer`, que la configuración solo activa con `CI=true`, y la semilla
se carga con `psql`, que viene instalado en el [runner](../glosario/04-ci-cd.md#runner).

Abre [`solucion/entorno-efimero.yml`](../../ejercicios/M04-07-entornos-efimeros/solucion/entorno-efimero.yml):

```yaml
jobs:
  api:
    name: API con PostgreSQL
    runs-on: ubuntu-latest
    timeout-minutes: 10

    # Contenedores de servicio: GitHub los arranca antes de los pasos y los borra al terminar el job
    services:
      db:
        image: postgres:17-alpine
        env:
          POSTGRES_USER: libros
          POSTGRES_PASSWORD: libros
          POSTGRES_DB: libros
        ports:
          - 5432:5432 # accesible desde el runner en localhost:5432
        options: >-
          --health-cmd "pg_isready -U libros -d libros"
          --health-interval 2s
          --health-timeout 2s
          --health-retries 15

    # Conexión a la base de datos para psql y para la API
    env:
      PGHOST: localhost
      PGUSER: libros
      PGPASSWORD: libros
      PGDATABASE: libros

    defaults:
      run:
        working-directory: ejercicios/M04-07-entornos-efimeros
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 22
          cache: npm
          cache-dependency-path: |
            package-lock.json
            ejercicios/M04-07-entornos-efimeros/app/package-lock.json

      # Datos de semilla: el mismo fichero que usa compose.yaml (psql viene en el runner)
      - name: Cargar la semilla
        run: psql -v ON_ERROR_STOP=1 -f db/semilla.sql

      - name: Instalar dependencias
        run: |
          npm ci
          npm ci --prefix ejercicios/M04-07-entornos-efimeros/app
        working-directory: .

      # Con CI=true, la configuración arranca la API (webServer); no hace falta navegador
      - name: Pruebas de la API
        run: npx playwright test
```

| Parte | Para qué |
|-------|----------|
| `services.db` con `options: --health-cmd …` | GitHub espera a que PostgreSQL esté sano antes del primer step |
| `ports: 5432:5432` + `PGHOST: localhost` | Los steps corren en el runner (no en un contenedor), así que llegan a la base de datos por `localhost` |
| `psql -f db/semilla.sql` | La misma semilla que en Compose: los dos entornos parten del mismo estado |
| `npm ci --prefix …/app` | La API usa el paquete `pg`, que solo está en el `package.json` de `app/` |
| Sin `playwright install` | Las pruebas solo usan `request`: no abren navegador |

```bash
# Desde la raíz: copia el workflow y súbelo (por pull request si main está protegida)
cd /workspaces/testing-automatizacion-agile-201
mkdir -p .github/workflows
cp ejercicios/M04-07-entornos-efimeros/solucion/entorno-efimero.yml .github/workflows/
git add .github/workflows/entorno-efimero.yml
git commit -m "Pruebas de la API con PostgreSQL efímero en CI"
git push
```

El job **API con PostgreSQL** termina en verde con estos steps:

```text
✓ API con PostgreSQL in 55s
  ✓ Set up job
  ✓ Initialize containers
  ✓ Run actions/checkout@v7
  ✓ Run actions/setup-node@v7
  ✓ Cargar la semilla
  ✓ Instalar dependencias
  ✓ Pruebas de la API
  ✓ Post Run actions/setup-node@v7
  ✓ Post Run actions/checkout@v7
  ✓ Stop containers
  ✓ Complete job
```

En **Initialize containers**, el runner baja la imagen, arranca el servicio y espera a su healthcheck
(los identificadores cambian; extracto):

```text
/usr/bin/docker pull postgres:17-alpine
Status: Downloaded newer image for postgres:17-alpine
/usr/bin/docker create --name …_postgres17alpine_… --network github_network_…
/usr/bin/docker start aa50674378d4…
aa50674378d4… Up Less than a second (health: starting)
healthy
```

**Cargar la semilla**:

```text
CREATE TABLE
INSERT 0 3
```

**Pruebas de la API**:

```text
Running 2 tests using 1 worker

  ✓  1 tests/libros.spec.js:5:1 › el catálogo empieza con los tres libros de la semilla (46ms)
  ✓  2 tests/libros.spec.js:16:1 › añade un libro y le da el id 4 (16ms)

  2 passed (726ms)
```

**Stop containers**, al final, imprime los logs de PostgreSQL y destruye el contenedor: la base de datos
de esta ejecución ya no existe.

Lanza el [workflow](../glosario/04-ci-cd.md#workflow) otra vez (**Actions** → **Entorno efímero** → **Run workflow**): vuelve a dar `2 passed`.
Cada job tiene su propia base de datos.

```bash
# Lanza otra ejecución y lista las dos últimas
gh workflow run entorno-efimero.yml --repo "$GITHUB_REPOSITORY"
gh run list --workflow entorno-efimero.yml --repo "$GITHUB_REPOSITORY" --limit 2
```

```text
completed	success	Entorno efímero	Entorno efímero	main	workflow_dispatch	44196568733	52s	2026-11-17T23:07:46Z
completed	success	Entorno efímero en CI	Entorno efímero	main	push	44196358757	58s	2026-11-17T23:06:27Z
```

Y en la segunda, otra vez:

```text
  ✓  1 tests/libros.spec.js:5:1 › el catálogo empieza con los tres libros de la semilla (29ms)
  ✓  2 tests/libros.spec.js:16:1 › añade un libro y le da el id 4 (14ms)

  2 passed (596ms)
```

El libro que añadió la primera ejecución no está: el id vuelve a ser 4 porque la base de datos es nueva.
(Mientras la ejecución está en curso, `gh run list` la muestra como `in_progress`.)

## Comprueba tu entendimiento

**La semilla solo se carga en un volumen vacío**
Levanta el entorno, deja que las pruebas añadan su libro, reinicia solo la base de datos y consulta
`/libros`:

```bash
# Reinicia solo la base de datos (y espera a que vuelva a estar sana) y mira el catálogo
docker compose up -d --wait
npx playwright test
docker compose restart db
docker compose up -d --wait
curl -s http://localhost:3407/libros
docker compose down -v
```

→ El catálogo sigue con 4 libros (el último, `Pedro Páramo`): reiniciar no es recrear. Solo `down -v` (o un volumen nuevo) vuelve a la
semilla.

**Nada queda en pie**
Después de un ciclo completo:

```bash
# Contenedores y volúmenes del proyecto
docker compose ps -a
docker volume ls --filter name=m04-07
```

→ Las dos listas, vacías salvo la cabecera.

## Investiga

Abre [`compose.yaml`](../../ejercicios/M04-07-entornos-efimeros/compose.yaml) y mira por qué `api` espera a
`db` (`depends_on: condition: service_healthy`) y por qué su propio `healthcheck` llama a `/salud`, que hace
`SELECT 1`. Después mira el log de la API durante un arranque:

```bash
# El log de la API durante el arranque
docker compose up -d --wait
docker compose logs api
docker compose down -v
```

¿Qué pasaría si `api` arrancara antes de que PostgreSQL aceptara conexiones y nadie lo comprobara?

## Reto

### 1 — Destruir pase lo que pase

**La situación:** un compañero automatiza el ciclo en una línea:
`docker compose up -d --wait && npx playwright test && docker compose down -v`. Funciona… hasta que una
prueba falla.

**Qué haces:** rompes una prueba (en `tests/libros.spec.js`, `id: 4` → `id: 40`), ejecutas su línea y miras
qué queda en pie. Después escribes un script que destruya el entorno **siempre**, también si las pruebas
fallan o pulsas `Ctrl+C`, y que salga con el código de las pruebas.

```bash
# La propuesta del compañero, con una prueba rota, y lo que queda después
docker compose up -d --wait && npx playwright test && docker compose down -v
docker compose ps
```

**Pistas:** en bash, `trap '…' EXIT` ejecuta un comando al salir del script por cualquier motivo; el
código de salida del script es el del último comando.

**Lo que buscas:** con la prueba rota, el script termina con código 1 y `docker compose ps -a` vacío; con la
prueba arreglada, dos ejecuciones seguidas dan `2 passed`.

<details>
<summary>Ver solución</summary>

Con la línea del compañero, `npx playwright test` falla, `&&` corta la cadena y `down -v` no se ejecuta:

```text
NAME           IMAGE                COMMAND                  SERVICE   CREATED         STATUS                   PORTS
m04-07-api-1   m04-07-api           "docker-entrypoint.s…"   api       6 seconds ago   Up 3 seconds (healthy)   0.0.0.0:3407->3407/tcp, [::]:3407->3407/tcp
m04-07-db-1    postgres:17-alpine   "docker-entrypoint.s…"   db        6 seconds ago   Up 6 seconds (healthy)   5432/tcp
```

El entorno sigue vivo con los datos de la ejecución fallida: la siguiente lo heredará.
[`solucion/entorno-efimero.sh`](../../ejercicios/M04-07-entornos-efimeros/solucion/entorno-efimero.sh):

```bash
#!/usr/bin/env bash
# Solución del reto del lab M04-07: crea el entorno, ejecuta las pruebas y lo destruye SIEMPRE.
# Uso, desde la carpeta del ejercicio: bash solucion/entorno-efimero.sh
set -u
cd "$(dirname "$0")/.." # la carpeta del ejercicio, se lance desde donde se lance

# Pase lo que pase a partir de aquí (pruebas en rojo, Ctrl+C), al salir se borra el entorno
trap 'echo "→ Destruyendo el entorno"; docker compose down -v' EXIT

echo "→ Creando el entorno"
docker compose up -d --wait || exit 1

echo "→ Ejecutando las pruebas"
npx playwright test # su código de salida es el del script
```

```bash
# Primero, recoge lo que dejó la línea del compañero; después, el script con la prueba rota
docker compose down -v
bash solucion/entorno-efimero.sh; echo "código de salida: $?"
docker compose ps -a
```

Final de la salida con la prueba rota:

```text
  1 failed
    tests/libros.spec.js:16:1 › añade un libro y le da el id 4 ─────────────────────────────────────
  1 passed (439ms)
→ Destruyendo el entorno
 Container m04-07-api-1  Stopping
 Container m04-07-api-1  Stopped
 Container m04-07-api-1  Removing
 Container m04-07-api-1  Removed
 Container m04-07-db-1  Stopping
 Container m04-07-db-1  Stopped
 Container m04-07-db-1  Removing
 Container m04-07-db-1  Removed
 Volume m04-07_datos  Removing
 Network m04-07_default  Removing
 Volume m04-07_datos  Removed
 Network m04-07_default  Removed
código de salida: 1
NAME      IMAGE     COMMAND   SERVICE   CREATED   STATUS    PORTS
```

Con la prueba arreglada (`id: 4`), el script da `2 passed (484ms)` y la segunda vez `2 passed (486ms)`:
ninguna ejecución ve los datos de otra. En CI, `services:` hace este `trap` por ti; con Compose en un
workflow, el equivalente es un step final con `if: ${{ always() }}` y `docker compose down -v`. **La regla:**
un entorno efímero solo lo es si su destrucción no depende de que las pruebas pasen.

</details>

## Errores frecuentes

| Síntoma | Causa probable | Cómo arreglarlo |
|---------|----------------|-----------------|
| Las pruebas pasan la primera vez y fallan después | El entorno no se destruye entre ejecuciones | `docker compose down -v` al terminar (o el script del reto) |
| Tras `down` y `up`, los datos siguen ahí | `down` sin `-v` conserva el volumen | `docker compose down -v` |
| He cambiado `db/semilla.sql` y no se aplica | La semilla solo corre con el volumen vacío | `docker compose down -v` y vuelve a crear |
| `dependency failed to start: container m04-07-api-1 is unhealthy` | La API no llega a la base de datos (variables `PG*` o `PGHOST` equivocados) | `docker compose logs api` para ver el error de conexión |
| `Bind for 0.0.0.0:3407 failed: port is already allocated` | Hay otro proceso o un entorno anterior en el 3407 | `docker compose down -v`; si persiste, busca quién lo usa con `ss -ltnp \| grep 3407` |
| En Actions, `psql: error: connection to server at "localhost" … failed` | Falta `ports: 5432:5432` en el servicio o el `env` `PG*` del job | Revisa `services.db.ports` y el bloque `env` del job |
| Desde el terminal `curl` responde, pero `api` no llega a `db` | Red de Docker del Codespace | `bash scripts/red-docker-codespace.sh` |

```bash
# Si los contenedores no se ven entre sí en el Codespace: abre las redes de Compose
bash scripts/red-docker-codespace.sh
```

## Conclusiones

### Qué es un entorno efímero

Un entorno completo (aquí API + PostgreSQL) que se crea para una ejecución desde un estado conocido —los
datos de semilla— y se destruye al terminar, de modo que ninguna ejecución hereda nada de otra.

### Cómo debe ser

| Requisito | En el lab |
|-----------|-----------|
| Parte siempre del mismo estado | `db/semilla.sql`, cargada con el volumen vacío o con `psql` en CI |
| Listo antes de probar | `up -d --wait` con `healthcheck` en `db` y en `api`; `services` con `--health-cmd` en CI |
| Se destruye entero, volúmenes incluidos | `docker compose down -v`; contenedores de servicio en CI |
| Se destruye pase lo que pase | `trap … EXIT` en el script; `if: ${{ always() }}` en un workflow |
| Aislado de otros | Proyecto `m04-07` con sus nombres; en CI, un servicio por job |

### Dónde se rompe y cómo lo has detectado

| Fallo | Cómo lo has visto | Qué provoca |
|-------|-------------------|-------------|
| Reutilizar el entorno | Paso 4: `Pedro Páramo` de más e id 5 en lugar de 4 | Pruebas que fallan sin cambios en el código |
| `down` sin `-v` | Paso 5: el volumen sobrevive y la semilla no se recarga | Parece un entorno nuevo, pero no lo es |
| Destrucción condicionada al éxito | Reto: con `&&`, el entorno queda vivo tras un fallo | La siguiente ejecución hereda los datos del fallo |

### Cómo se perfecciona

Con nombres de proyecto únicos por ejecución (`docker compose -p m04-07-$GITHUB_RUN_ID`) para ejecuciones en
paralelo, semillas pequeñas y versionadas junto a las pruebas, y llevando la idea a entornos de revisión por
pull request (la app desplegada en un entorno que nace con el PR y muere al cerrarlo).

### En una frase

> 🔑 Un entorno efímero hace repetible una ejecución: nace de la semilla, solo lo usa esa ejecución y se
> destruye con sus volúmenes aunque las pruebas fallen.
