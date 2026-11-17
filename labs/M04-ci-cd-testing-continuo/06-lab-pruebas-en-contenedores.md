# Lab — Pruebas en contenedores

[← Página anterior](05-lab-puerta-de-calidad.md) · [Siguiente página →](07-lab-entornos-efimeros.md)

Practicas el **entorno de pruebas en contenedor**: la aplicación y la suite, cada una en su contenedor,
orquestadas con [Docker Compose](../glosario/04-ci-cd.md#docker-compose). El ejercicio es un tablón de
avisos que dice qué máquina lo sirve y dos pruebas de [Playwright](../glosario/02-e2e.md#playwright) que se ejecutan en la
[imagen oficial de Playwright](../glosario/04-ci-cd.md#imagen-de-playwright). El `compose.yaml` de partida
tiene un error típico que encuentras y corriges; después lanzas lo mismo en GitHub Actions.

### Objetivo

Comprender qué es un entorno de pruebas en contenedor: cómo funciona, cómo debe ser, cómo se detectan sus
debilidades y cómo se mejora.

### Punto de partida

- Codespace del curso abierto, con Docker (`docker compose version` responde).
- Carpeta del ejercicio: [`ejercicios/M04-06-pruebas-en-contenedores/`](../../ejercicios/M04-06-pruebas-en-contenedores/README.md).
  La app escucha en el puerto **3406**. El proyecto de Compose se llama `m04-06`.
- La primera ejecución descarga las imágenes `node:22-alpine` y `mcr.microsoft.com/playwright:v1.65.1-noble`
  (esta última pesa unos 2,5 GB: tarda unos minutos).
- Solución: [`solucion/compose.yaml`](../../ejercicios/M04-06-pruebas-en-contenedores/solucion/compose.yaml) y
  [`solucion/contenedores.yml`](../../ejercicios/M04-06-pruebas-en-contenedores/solucion/contenedores.yml).

```bash
# Entra en la carpeta del ejercicio
cd ejercicios/M04-06-pruebas-en-contenedores
```

### Qué está pasando

«En mi máquina pasa» suele significar «mi máquina tiene otra versión de Node, de Chromium o de las
librerías del sistema». Un contenedor fija todo eso en una imagen con etiqueta: la misma imagen da el mismo
entorno en tu Codespace, en el [runner](../glosario/04-ci-cd.md#runner) de CI y en el portátil de un compañero.

| Pieza | Qué es |
|-------|--------|
| Servicio `tablon` | La app en la imagen `node:22-alpine`, con un `healthcheck` sobre `/salud` |
| Servicio `pruebas` | La imagen `mcr.microsoft.com/playwright:v1.65.1-noble`: Ubuntu, Node y los navegadores de Playwright 1.65.1 |
| Volumen `../..:/repo` | El repositorio entero montado en el contenedor de pruebas: tests, configuración y `node_modules` |
| `BASE_URL` | La URL que usan las pruebas; si no está, la configuración arranca la app en local |
| Red de Compose | Los servicios se ven entre sí **por su nombre** (`tablon`), no por `localhost` |

Dentro de un contenedor, `localhost` es **el propio contenedor**. Es el error más común al pasar pruebas a
contenedores, y el `compose.yaml` de partida lo tiene.

### 1 — La misma suite, en tu terminal

Ejecutas primero sin contenedores: la configuración arranca la app con `webServer` porque no hay
`BASE_URL`.

```bash
# La suite en el Codespace
npx playwright test
```

**Resultado esperado** (los tiempos cambian; en lugar de `<nombre de tu Codespace>` verás el nombre de tu
máquina):

```text
Running 2 tests using 1 worker

  ✓  1 [chromium] › tests/tablon.spec.js:3:1 › muestra el tablón con sus dos avisos (147ms)
  → Servido por <nombre de tu Codespace>
  ✓  2 [chromium] › tests/tablon.spec.js:9:1 › dice qué máquina lo sirve (86ms)

  2 passed (1.1s)
```

### 2 — Leer el `compose.yaml`

Abre [`compose.yaml`](../../ejercicios/M04-06-pruebas-en-contenedores/compose.yaml) en el editor:

```yaml
# Lab M04-06: la aplicación y las pruebas, cada una en su contenedor.
name: m04-06

services:
  # La aplicación bajo prueba, con la imagen oficial de Node
  tablon:
    image: node:22-alpine
    working_dir: /app
    volumes:
      - ./app:/app:ro
    command: node server.mjs
    init: true # un proceso init reenvía la señal de parada a node: se detiene al momento
    environment:
      PORT: 3406
    ports:
      - '3406:3406'
    healthcheck: # «sana» cuando /salud responde
      test: ['CMD', 'wget', '-qO-', 'http://localhost:3406/salud']
      interval: 2s
      timeout: 2s
      retries: 10

  # Las pruebas, con la imagen oficial de Playwright (Node + navegadores)
  pruebas:
    image: mcr.microsoft.com/playwright:v1.65.1-noble # misma versión que @playwright/test
    working_dir: /repo/ejercicios/M04-06-pruebas-en-contenedores
    volumes:
      - ../..:/repo # el repositorio entero: pruebas, configuración y node_modules
    environment:
      BASE_URL: http://localhost:3406
      PW_OUTPUT_DIR: /tmp/test-results
      CI: 'true'
    ipc: host # Chromium necesita memoria compartida
    command: npx playwright test
    depends_on:
      tablon:
        condition: service_healthy # no empieza hasta que la app está sana
```

| Línea | Para qué |
|-------|----------|
| `name: m04-06` | Nombre del proyecto: prefijo de contenedores y red; no choca con otros ejercicios |
| `healthcheck` + `depends_on: condition: service_healthy` | Las pruebas no empiezan hasta que la app responde: sin [esperas fijas](../glosario/02-e2e.md#espera-fija) |
| `image: …playwright:v1.65.1-noble` | La etiqueta coincide con `@playwright/test` 1.65.1: navegadores de esa versión |
| `PW_OUTPUT_DIR: /tmp/test-results` | Las evidencias se quedan dentro del contenedor: así no deja en tu carpeta ficheros de `root` |
| `ipc: host` | Chromium usa memoria compartida; con la de serie del contenedor puede quedarse sin ella |

`healthcheck` usa `localhost`, y ahí es correcto: se ejecuta **dentro** del contenedor `tablon`. En
`BASE_URL`, en cambio, `localhost` sería el contenedor `pruebas`.

### 3 — Ejecutar la suite en el contenedor

`docker compose run --rm pruebas` arranca lo que `pruebas` necesita (`tablon`, cuando está sano), ejecuta
su `command` y borra el contenedor de pruebas al terminar.

```bash
# La suite dentro del contenedor de Playwright
docker compose run --rm pruebas
```

**Resultado esperado** (recortado: las dos pruebas fallan igual):

```text
 Network m04-06_default  Creating
 Network m04-06_default  Created
 Container m04-06-tablon-1  Creating
 Container m04-06-tablon-1  Created
 Container m04-06-tablon-1  Starting
 Container m04-06-tablon-1  Started

Running 2 tests using 1 worker

  ✘  1 [chromium] › tests/tablon.spec.js:3:1 › muestra el tablón con sus dos avisos (1.1s)
  ✘  2 [chromium] › tests/tablon.spec.js:9:1 › dice qué máquina lo sirve (1.1s)


  1) [chromium] › tests/tablon.spec.js:3:1 › muestra el tablón con sus dos avisos ──────────────────

    Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3406/
    Call log:
      - navigating to "http://localhost:3406/", waiting until "load"
    …
        at /repo/ejercicios/M04-06-pruebas-en-contenedores/tests/tablon.spec.js:4:14

  …

  2 failed
    [chromium] › tests/tablon.spec.js:3:1 › muestra el tablón con sus dos avisos ───────────────────
    [chromium] › tests/tablon.spec.js:9:1 › dice qué máquina lo sirve ──────────────────────────────
```

La ruta del error es `/repo/…`: las pruebas corren dentro del contenedor. Y la app sí está en marcha:

```bash
# Estado de los servicios del proyecto
docker compose ps
```

**Resultado esperado** (los tiempos cambian):

```text
NAME              IMAGE            COMMAND                  SERVICE   CREATED         STATUS                   PORTS
m04-06-tablon-1   node:22-alpine   "docker-entrypoint.s…"   tablon    6 seconds ago   Up 6 seconds (healthy)   0.0.0.0:3406->3406/tcp, [::]:3406->3406/tcp
```

`tablon` está `healthy` y publicado en el 3406 del Codespace; desde tu terminal,
`http://localhost:3406` respondería. Desde el contenedor `pruebas`, `localhost:3406` es el propio
contenedor de pruebas, donde no escucha nadie.

### 4 — Apuntar al servicio por su nombre

En `compose.yaml`, cambia en el servicio `pruebas` la línea `BASE_URL: http://localhost:3406` por:

```yaml
      BASE_URL: http://tablon:3406 # el nombre del servicio en la red de Compose
```

```bash
# Otra vez la suite en el contenedor
docker compose run --rm pruebas
```

**Resultado esperado** (los tiempos y el identificador del contenedor cambian):

```text
 Container m04-06-tablon-1  Running

Running 2 tests using 1 worker

  ✓  1 [chromium] › tests/tablon.spec.js:3:1 › muestra el tablón con sus dos avisos (155ms)
  → Servido por 36b1fc965057
  ✓  2 [chromium] › tests/tablon.spec.js:9:1 › dice qué máquina lo sirve (111ms)

  2 passed (808ms)
```

`Container m04-06-tablon-1  Running`: la app seguía en marcha de la ejecución anterior. Ahora la sirve
`36b1fc965057`, el identificador del contenedor `tablon`, no tu Codespace.

### 5 — Todo de una vez, con el código de salida de las pruebas

`run --rm` borra el contenedor de pruebas pero deja la app levantada. Para CI interesa otra forma: levantar
todo, esperar a que termine `pruebas`, parar el resto y devolver **el código de salida de las pruebas**.
Primero bajas lo que hay:

```bash
# Para y borra los contenedores y la red del proyecto
docker compose down
```

**Resultado esperado:**

```text
 Container m04-06-tablon-1  Stopping
 Container m04-06-tablon-1  Stopped
 Container m04-06-tablon-1  Removing
 Container m04-06-tablon-1  Removed
 Network m04-06_default  Removing
 Network m04-06_default  Removed
```

```bash
# Levanta todo, termina cuando acaba «pruebas» y sale con su código
docker compose up --exit-code-from pruebas
echo "código de salida: $?"
```

**Resultado esperado** (los tiempos y los identificadores cambian):

```text
 Network m04-06_default  Creating
 Network m04-06_default  Created
 Container m04-06-tablon-1  Creating
 Container m04-06-tablon-1  Created
 Container m04-06-pruebas-1  Creating
 Container m04-06-pruebas-1  Created
Attaching to pruebas-1, tablon-1
tablon-1  | Tablón en http://localhost:3406 (máquina 9c579be37d31)
pruebas-1  | 
pruebas-1  | Running 2 tests using 1 worker
pruebas-1  | 
pruebas-1  |   ✓  1 [chromium] › tests/tablon.spec.js:3:1 › muestra el tablón con sus dos avisos (100ms)
pruebas-1  |   → Servido por 9c579be37d31
pruebas-1  |   ✓  2 [chromium] › tests/tablon.spec.js:9:1 › dice qué máquina lo sirve (84ms)
pruebas-1  | 
pruebas-1  |   2 passed (706ms)
pruebas-1 exited with code 0
Aborting on container exit...
 Container m04-06-pruebas-1  Stopping
 Container m04-06-pruebas-1  Stopped
 Container m04-06-tablon-1  Stopping
 Container m04-06-tablon-1  Stopped
tablon-1 exited with code 143
código de salida: 0
```

| Línea | Qué dice |
|-------|----------|
| `Attaching to pruebas-1, tablon-1` | Ves los logs de los dos servicios, con su prefijo |
| `pruebas-1 exited with code 0` | La suite ha pasado |
| `Aborting on container exit...` | `--exit-code-from` implica parar todo cuando termina `pruebas` |
| `tablon-1 exited with code 143` | La app ha recibido `SIGTERM` y ha salido al momento (gracias a `init: true`) |
| `código de salida: 0` | El de `pruebas`: es lo que verá el step de CI |

Los contenedores quedan parados, no borrados. Bórralos:

```bash
# Borra contenedores y red
docker compose down
```

### 6 — Lo mismo en GitHub Actions

El runner de GitHub trae Docker, así que el [job](../glosario/04-ci-cd.md#job) hace lo mismo que tú: instala `node_modules` (el contenedor
de pruebas lo monta con el repositorio), `up --exit-code-from pruebas` y `down` pase lo que pase.

```bash
# Desde la raíz: el workflow de la solución y el compose corregido, al fork
cd /workspaces/testing-automatizacion-agile-201
mkdir -p .github/workflows
cp ejercicios/M04-06-pruebas-en-contenedores/solucion/contenedores.yml .github/workflows/
git add .github/workflows/contenedores.yml ejercicios/M04-06-pruebas-en-contenedores/compose.yaml
git commit -m "Suite del tablón en Docker Compose, también en CI"
git push
```

Si tu `main` tiene un [ruleset](../glosario/04-ci-cd.md#ruleset) que exige pull request (lab 05), sube a una rama y abre el pull request.

Los steps del job:

```yaml
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 22
          cache: npm
      # node_modules de la raíz: el contenedor de pruebas lo monta con el repositorio
      - run: npm ci
        working-directory: .
      # Levanta la app, ejecuta las pruebas y devuelve el código de salida del servicio «pruebas»
      - run: docker compose up --exit-code-from pruebas
      # Apaga y borra los contenedores y la red, pase lo que pase
      - if: ${{ always() }}
        run: docker compose down
```

La ejecución de **Pruebas en contenedores** termina en verde. Log del step **Run docker compose up
--exit-code-from pruebas** (sin las líneas de descarga de capas; el identificador de la máquina y los
tiempos cambian):

```text
 Image mcr.microsoft.com/playwright:v1.65.1-noble Pulling
 Image node:22-alpine Pulling
 Image node:22-alpine Pulled
 Image mcr.microsoft.com/playwright:v1.65.1-noble Pulled
 Network m04-06_default Creating
 Network m04-06_default Created
 Container m04-06-tablon-1 Creating
 Container m04-06-tablon-1 Created
 Container m04-06-pruebas-1 Creating
 Container m04-06-pruebas-1 Created
Attaching to pruebas-1, tablon-1
 Container m04-06-tablon-1 Starting
 Container m04-06-tablon-1 Started
tablon-1  | Tablón en http://localhost:3406 (máquina bb96e352f083)
 Container m04-06-tablon-1 Healthy
 Container m04-06-pruebas-1 Starting
 Container m04-06-pruebas-1 Started
pruebas-1  |
pruebas-1  | Running 2 tests using 1 worker
pruebas-1  |
pruebas-1  |   ✓  1 [chromium] › tests/tablon.spec.js:3:1 › muestra el tablón con sus dos avisos (137ms)
pruebas-1  |   → Servido por bb96e352f083
pruebas-1  |   ✓  2 [chromium] › tests/tablon.spec.js:9:1 › dice qué máquina lo sirve (69ms)
pruebas-1  |
pruebas-1  |   2 passed (727ms)
 Compose Stopping Aborting on container exit...
pruebas-1 exited with code 0
 Container m04-06-pruebas-1 Stopping
 Container m04-06-pruebas-1 Stopped
 Container m04-06-tablon-1 Stopping
 Container m04-06-tablon-1 Stopped
tablon-1 exited with code 143
```

Y el del step **Run docker compose down**:

```text
 Container m04-06-pruebas-1 Removing
 Container m04-06-pruebas-1 Removed
 Container m04-06-tablon-1 Removing
 Container m04-06-tablon-1 Removed
 Network m04-06_default Removing
 Network m04-06_default Removed
```

Es la misma secuencia que en tu Codespace: `Healthy` antes de arrancar las pruebas, `exited with code 0`
de `pruebas` (el código que recoge el job) y `143` del tablón, que Compose para al terminar.

## Comprueba tu entendimiento

**El código de salida manda**
Rompe una prueba (en `tests/tablon.spec.js`, `toHaveCount(2)` → `toHaveCount(3)`) y ejecuta:

```bash
# Todo de una vez, con el código de salida de las pruebas; después, recoge
docker compose up --exit-code-from pruebas; echo "código de salida: $?"
docker compose down
```

→ `pruebas-1 exited with code 1` y, al final, `código de salida: 1`: el step de CI se pondría en rojo.
Deja la prueba como estaba.

**Nada de `root` en tu carpeta**
Tras una ejecución en contenedor, lista la carpeta:

```bash
# ¿Ha dejado el contenedor algo en la carpeta del ejercicio?
ls -la
```

→ No hay `test-results/`: las evidencias se escribieron en `/tmp` dentro del contenedor.

## Experimenta

Predice qué pasa si la etiqueta de la imagen no coincide con la versión de `@playwright/test`. Cambia en
`compose.yaml` `playwright:v1.65.1-noble` por `playwright:v1.64.1-noble` (la descarga es otra imagen de
unos 2,5 GB) y ejecuta:

```bash
# La suite con una imagen de otra versión de Playwright
docker compose up --exit-code-from pruebas
```

**Resultado esperado** (recortado):

```text
pruebas-1  |   ✘  1 [chromium] › tests/tablon.spec.js:3:1 › muestra el tablón con sus dos avisos (1ms)
pruebas-1  |   ✘  2 [chromium] › tests/tablon.spec.js:9:1 › dice qué máquina lo sirve (1ms)
pruebas-1  | 
pruebas-1  | 
pruebas-1  |   1) [chromium] › tests/tablon.spec.js:3:1 › muestra el tablón con sus dos avisos ──────────────────
pruebas-1  | 
pruebas-1  |     Error: browserType.launch: Executable doesn't exist at /ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell
pruebas-1  |     ╔════════════════════════════════════════════════════════╗
pruebas-1  |     ║ Looks like Playwright was just updated to 1.65.1.      ║
pruebas-1  |     ║ Please update docker image as well.                    ║
pruebas-1  |     ║ -  current: mcr.microsoft.com/playwright:v1.64.1-noble ║
pruebas-1  |     ║ - required: mcr.microsoft.com/playwright:v1.65.1-noble ║
pruebas-1  |     ║                                                        ║
pruebas-1  |     ║ <3 Playwright Team                                     ║
pruebas-1  |     ╚════════════════════════════════════════════════════════╝
…
pruebas-1 exited with code 1
```

Cada versión de Playwright espera los navegadores de su versión: la imagen trae los de la 1.64.1 y el
paquete pide los de la 1.65.1. Vuelve a `v1.65.1-noble`, baja el proyecto y, si quieres recuperar el
espacio, borra la imagen:

```bash
# Baja el proyecto y borra la imagen de la versión equivocada
docker compose down
docker image rm mcr.microsoft.com/playwright:v1.64.1-noble
```

## Reto

### 1 — Que las evidencias salgan del contenedor

**La situación:** cuando una prueba falla en el contenedor, la traza se queda en `/tmp/test-results` y
desaparece con él. Un compañero propone volver a escribirla en la carpeta montada, pero entonces los
ficheros serían de `root`.

**Qué haces:** haces que el contenedor de pruebas escriba las evidencias en `test-results/` de la carpeta
del ejercicio **con tu usuario**, rompes una prueba y compruebas que la traza aparece y que puedes borrarla
sin `sudo`.

**Pistas:** quita `PW_OUTPUT_DIR` del servicio y añade `user: '1000:1000'` (el usuario `node` del
Codespace) y `HOME: /tmp` en `environment` (npm necesita un directorio personal con permiso de
escritura). Usa `trace: 'retain-on-failure'` en la configuración. Tu identificador de usuario lo da:

```bash
# Identificador numérico de tu usuario en el Codespace
id -u
```

**Lo que buscas:** con una prueba rota, `ls -l test-results/*/` muestra `trace.zip` con tu usuario como
propietario, y `rm -rf test-results` funciona.

<details>
<summary>Ver solución</summary>

En el servicio `pruebas` de `compose.yaml`:

```yaml
    user: '1000:1000' # tu usuario del Codespace: los ficheros nuevos son tuyos
    environment:
      BASE_URL: http://tablon:3406
      HOME: /tmp # npm necesita un HOME con permiso de escritura
      CI: 'true'
```

Y en `playwright.config.js`, dentro de `use`: `trace: 'retain-on-failure'`.

```bash
# Con una prueba rota: ejecuta, mira las evidencias y bórralas sin sudo
docker compose run --rm pruebas
ls -l test-results/*/
rm -rf test-results
docker compose down
```

<!-- SALIDA-ACTIONS: en un Codespace real, salida de `id -u` y de `ls -l test-results/*/` tras la ejecución con user 1000:1000 (trace.zip propiedad de node) -->
```text
pendiente
```

En CI el usuario del runner es otro (`1001`): allí se usaría `user: '1001:1001'` o una variable. **La
regla:** un contenedor que escribe en una carpeta montada escribe con su usuario; fija el usuario o saca las
evidencias de otra forma (`docker compose cp`, un volumen), y sube después esa carpeta como [artefacto](../glosario/04-ci-cd.md#artefacto).

</details>

## Errores frecuentes

| Síntoma | Causa probable | Cómo arreglarlo |
|---------|----------------|-----------------|
| `net::ERR_CONNECTION_REFUSED at http://localhost:3406/` desde el contenedor | `localhost` es el contenedor de pruebas | `BASE_URL: http://tablon:3406` (nombre del servicio) |
| `net::ERR_SSL_PROTOCOL_ERROR at http://app:3406/` | Chromium fuerza HTTPS para `app` (y `dev`): son dominios de nivel superior con HSTS precargado | No llames `app` ni `dev` a un servicio que abre el navegador; aquí se llama `tablon` |
| `Executable doesn't exist at /ms-playwright/…` y «Please update docker image as well» | La etiqueta de la imagen no coincide con `@playwright/test` | Misma versión en `compose.yaml` y en `package.json` (aquí 1.65.1) |
| Desde el terminal `curl http://localhost:3406` responde, pero las pruebas en el contenedor no llegan a `tablon` | Red de Docker del Codespace (reglas legacy que bloquean las redes de Compose) | `bash scripts/red-docker-codespace.sh` y vuelve a ejecutar |
| `tablon-1 exited with code 137` y la parada tarda 10 s | `node` como proceso 1 ignora `SIGTERM` y Docker lo mata | `init: true` en el servicio |
| `rm: cannot remove 'test-results/…': Permission denied` | Un contenedor escribió como `root` en la carpeta montada | `sudo rm -rf test-results`; evítalo con `PW_OUTPUT_DIR` o `user:` (reto) |

```bash
# Si los contenedores no se ven entre sí en el Codespace: abre las redes de Compose
bash scripts/red-docker-codespace.sh
```

## Conclusiones

### Qué es un entorno de pruebas en contenedor

La app y la suite empaquetadas en imágenes con versión fija y orquestadas por Compose, de modo que el mismo
`docker compose up --exit-code-from pruebas` da el mismo resultado en tu Codespace y en el runner.

### Cómo debe ser

| Requisito | En el lab |
|-----------|-----------|
| Versiones fijas y coherentes | `node:22-alpine` y `playwright:v1.65.1-noble` con `@playwright/test` 1.65.1 |
| Las pruebas esperan a la app | `healthcheck` + `depends_on: condition: service_healthy` |
| Comunicación por nombre de servicio | `BASE_URL: http://tablon:3406` |
| El resultado es el código de salida de las pruebas | `--exit-code-from pruebas` → `código de salida: 0` |
| Se recoge todo al terminar | `docker compose down` (en CI con `if: ${{ always() }}`) |

### Dónde se rompe y cómo lo has detectado

| Fallo | Cómo lo has visto | Qué provoca |
|-------|-------------------|-------------|
| `localhost` dentro del contenedor | Paso 3: `ERR_CONNECTION_REFUSED` con la app `healthy` | Todo rojo con la app funcionando |
| Imagen de otra versión | Experimenta: «Please update docker image as well» | Ninguna prueba llega a abrir el navegador |
| Evidencias atrapadas en el contenedor | Reto: la traza se va con el contenedor | Fallos imposibles de diagnosticar |

### Cómo se perfecciona

Con una imagen propia de la app construida en el [pipeline](../glosario/04-ci-cd.md#pipeline) (la misma que se desplegará), la versión de la
imagen de Playwright derivada de `package.json` para que no se desincronicen, y las evidencias sacadas a una
carpeta con el usuario correcto y subidas como artefacto.

### En una frase

> 🔑 Un contenedor fija el entorno de pruebas, pero dentro de él `localhost` es él mismo: los servicios se
> llaman por su nombre y la imagen de Playwright lleva la versión del paquete.
