# Lab — Preparar el entorno

[← Página anterior](00-testing-en-agile-y-devops.md) · [Siguiente página →](02-una-funcionalidad-tres-niveles.md)

En este lab practicas qué es un **[entorno de pruebas reproducible](../glosario/01-fundamentos.md#entorno-reproducible)**: creas tu Codespace a partir de
tu fork del curso, compruebas que todas las herramientas responden y ejecutas una [suite de humo](../glosario/01-fundamentos.md#prueba-de-humo)
mínima (`ejercicios/M01-01-preparar-el-entorno/`) con una [prueba unitaria](../glosario/01-fundamentos.md#prueba-unitaria) de [Vitest](../glosario/01-fundamentos.md#vitest) y una prueba
de navegador de [Playwright](../glosario/02-e2e.md#playwright). Al final ves el navegador automatizado en el escritorio remoto.

### Objetivo

Comprender qué es un entorno de pruebas reproducible: cómo funciona, cómo debe ser, cómo se
detectan sus debilidades y cómo se mejora.

### Punto de partida

- Una cuenta de GitHub y el fork del repositorio del curso en tu cuenta (botón **Fork** en
  `https://github.com/my-it-labs/testing-automatizacion-agile-201`).
- Nada instalado en tu equipo: todo corre en GitHub Codespaces, en el navegador.
- Ejercicio: `ejercicios/M01-01-preparar-el-entorno/`, con la página `app/public/index.html`, la
  función `src/saludo.js` y las pruebas `pruebas/humo.test.js` y `pruebas/humo.spec.js`.

### Qué está pasando

Una prueba que pasa en un portátil y falla en otro no sirve para decidir nada. Para que el
resultado dependa solo del código, todas las personas del equipo y el [pipeline](../glosario/04-ci-cd.md#pipeline) de CI tienen que
ejecutar las pruebas con las **mismas versiones** de Node.js, de las librerías y de los navegadores.
Eso es un entorno reproducible, y en este curso lo define un fichero: `.devcontainer/devcontainer.json`.

| En un proyecto real | En este laboratorio |
|---------------------|---------------------|
| Cada persona instala Node, navegadores y librerías a mano, cada uno con su versión | El devcontainer fija la imagen (Node 22) y `package.json` fija las versiones exactas |
| «En mi máquina funciona» | El Codespace es igual para todos los alumnos |
| Una prueba de humo comprueba que un despliegue está vivo antes de probar en serio | `npm run verificar` y la suite de humo comprueban que el entorno está vivo |
| Para ver un navegador automatizado hace falta un escritorio | El Codespace trae un escritorio remoto (noVNC) en el puerto 6080 |

Una **prueba de humo** es la comprobación más pequeña que dice si merece la pena seguir: si ni
siquiera arranca, no tiene sentido ejecutar el resto.

### 1 — Crear el Codespace desde tu fork

Vas a levantar el entorno de trabajo: una máquina en la nube con el repositorio, Node.js, los
navegadores y todas las herramientas del curso ya instaladas.

1. Abre tu fork en GitHub: `https://github.com/<tu-usuario>/testing-automatizacion-agile-201`.
2. Pulsa el botón verde **Code**.
3. Elige la pestaña **Codespaces**.
4. Pulsa **Create codespace on main**.

**Resultado esperado:** se abre una pestaña nueva con VS Code en el navegador. VS Code aparece
antes de que el entorno esté instalado: el terminal sigue mostrando la instalación de dependencias
(`scripts/instalar-entorno.sh`, lanzado por el devcontainer: `npm ci`, Chromium y Cypress) durante
unos minutos. Espera a que termine con estas líneas:

```text
Entorno listo. Compruébalo con: npm run verificar
Running the postStartCommand from devcontainer.json...
bash scripts/red-docker-codespace.sh || true
Redes de Compose abiertas: los contenedores ya se ven entre sí.
```

La última la escribe el script que arregla la red de Docker del Codespace (lo necesitarán los labs
con contenedores); en algunos Codespaces dice en su lugar que no hace falta nada.

> [!TIP]
> El Codespace se conserva. Para volver otro día: **Code** → **Codespaces** y pulsa su nombre en
> la lista, en lugar de crear uno nuevo.

### 2 — Comprobar las herramientas

Antes de escribir ninguna prueba, compruebas que cada herramienta del curso está instalada y
responde. Es la prueba de humo del entorno.

```bash
# Pregunta su versión a cada herramienta del curso (ficha: labs/comandos-lab.md#verificar)
npm run verificar
```

Ficha del comando: [`npm run verificar`](../comandos-lab.md#verificar).

**Resultado esperado** (los números de versión pueden variar en Node, npm, Docker y GitHub CLI):

```text
> verificar
> node scripts/verificar-entorno.mjs

OK     Node.js     v22.23.5
OK     npm         10.9.9
OK     Vitest      vitest/5.1.0 linux-x64 node-v22.23.5
OK     Playwright  Version 1.65.1
OK     Cypress     16.3.0
OK     Chromium    chromium-1255
OK     Cypress app verificado
OK     Newman      6.2.3
OK     Prism       5.16.0
OK     Allure      3.33.0
OK     Docker      Docker version 29.9.3-1, build 5457199aa57c45e990c59c89cab5f02b817238d7
OK     GitHub CLI  gh version 2.104.0 (2026-11-12)

Entorno listo
```

Cada línea `OK` es una herramienta que ha respondido con su versión. `Chromium` y `Cypress app` comprueban además que los navegadores están descargados: el paquete puede estar instalado y el navegador no, si la instalación se cortó. Vitest, Playwright, [Cypress](../glosario/02-e2e.md#cypress),
[Newman](../glosario/03-apis.md#newman), [Prism](../glosario/03-apis.md#prism) y [Allure](../glosario/04-ci-cd.md#allure) tienen la versión exacta de `package.json`: es lo que hace que tu resultado
sea igual al de cualquier compañero. Si alguna línea dice `FALTA`, mira «Errores frecuentes».

<details>
<summary>Qué hace por dentro (<code>scripts/verificar-entorno.mjs</code>)</summary>

```js
// Para cada herramienta, ejecuta su comando de versión y muestra la primera línea
for (const [nombre, comando] of herramientas) {
  try {
    const salida = execSync(comando).toString().trim().split('\n')[0];
    console.log(`OK     ${nombre.padEnd(11)} ${salida}`);
  } catch {
    fallos++;                       // la herramienta no responde
    console.log(`FALTA  ${nombre.padEnd(11)} …`);
  }
}
process.exit(fallos ? 1 : 0);       // 1 si falta algo
```

</details>

### 3 — Leer la suite de humo

Antes de ejecutarla, abres la suite para saber qué comprueba. En el explorador de VS Code abre:

- [`ejercicios/M01-01-preparar-el-entorno/src/saludo.js`](../../ejercicios/M01-01-preparar-el-entorno/src/saludo.js): una función `saludar(nombre)` que devuelve `Hola, <nombre>`.
- [`ejercicios/M01-01-preparar-el-entorno/pruebas/humo.test.js`](../../ejercicios/M01-01-preparar-el-entorno/pruebas/humo.test.js): la prueba unitaria.
- [`ejercicios/M01-01-preparar-el-entorno/pruebas/humo.spec.js`](../../ejercicios/M01-01-preparar-el-entorno/pruebas/humo.spec.js): la prueba de navegador.

La unitaria llama a la función y compara el resultado:

```js
expect(saludar('Ada')).toBe('Hola, Ada');
```

La de navegador abre la página y busca su encabezado por su rol, como lo vería un usuario:

```js
await page.goto('/');
await expect(page.getByRole('heading', { name: 'Entorno de pruebas listo' })).toBeVisible();
```

Los ficheros `vitest.config.js` y `playwright.config.js` dicen a cada herramienta qué ficheros
son suyos: Vitest ejecuta los `*.test.js` y Playwright los `*.spec.js`. La configuración de
Playwright, además, arranca la página (`node app/server.mjs`, puerto 3101) antes de las pruebas.

### 4 — Ejecutar la prueba unitaria

Compruebas que Node y Vitest ejecutan una prueba de verdad, no solo que están instalados.

```bash
# Entra en la carpeta del ejercicio
cd ejercicios/M01-01-preparar-el-entorno
# Ejecuta las pruebas unitarias una vez (sin modo vigilancia)
npx vitest run
```

**Resultado esperado** (la hora y los milisegundos cambian en cada ejecución):

```text
 RUN  v5.1.0 /workspaces/testing-automatizacion-agile-201/ejercicios/M01-01-preparar-el-entorno

 ✓ pruebas/humo.test.js > saludar > devuelve el saludo con el nombre 2ms

 Test Files  1 passed (1)
      Tests  1 passed (1)
   Start at  17:19:36
   Duration  139ms (import 44%, transform 26%, worker 16%, tests 14%)
```

| Parte | Qué dice |
|-------|----------|
| `✓ pruebas/humo.test.js > saludar > devuelve…` | Fichero › bloque `describe` › prueba `it`, y que ha pasado |
| `2ms` | Lo que ha tardado esa prueba |
| `Tests  1 passed (1)` | Pasadas sobre el total |
| `Duration  139ms` | Lo que ha tardado todo, incluida la preparación de Vitest |

### 5 — Ejecutar la prueba de navegador

Ahora compruebas lo más frágil del entorno: que Playwright arranca Chromium, que la aplicación
levanta y que el navegador la lee.

```bash
# Ejecuta las pruebas de navegador (Playwright arranca la app en el puerto 3101)
npx playwright test
```

**Resultado esperado** (los tiempos cambian en cada ejecución):

```text
Running 1 test using 1 worker

  ✓  1 [chromium] › pruebas/humo.spec.js:4:1 › la página de humo muestra su encabezado (163ms)

  1 passed (821ms)
```

`[chromium]` es el navegador del proyecto configurado y `pruebas/humo.spec.js:4:1` la línea donde
empieza la prueba. No has tenido que arrancar el servidor: lo ha hecho el bloque `webServer` de
`playwright.config.js` y lo ha parado al terminar.

### 6 — Abrir el escritorio remoto

Las pruebas se ejecutan sin ventana (*headless*). Para verlas, el Codespace trae un escritorio
remoto en el navegador.

1. En VS Code abre la pestaña **Ports** (Puertos), junto a **Terminal**.
2. En la fila del puerto **6080** (Escritorio (noVNC)), pulsa el icono del globo (**Open in Browser**).
3. En la página de noVNC pulsa **Connect**.
4. En **Password** escribe `curso` y pulsa **Send Credentials**.

**Resultado esperado:** un escritorio Linux vacío en una pestaña del navegador. Déjalo abierto al
lado de VS Code.

### 7 — Ver el navegador automatizado

Ejecutas la misma prueba con ventana (`--headed`) y una pausa de un segundo entre acciones, para
seguir con la vista lo que hace Playwright en el escritorio que acabas de abrir.

```bash
# SLOWMO: milisegundos de pausa entre acciones (lo lee playwright.config.js)
# --headed: abre la ventana del navegador en el escritorio remoto
SLOWMO=1000 npx playwright test --headed
```

**Resultado esperado** (en el terminal; los tiempos cambian):

```text
Running 1 test using 1 worker

  ✓  1 [chromium] › pruebas/humo.spec.js:4:1 › la página de humo muestra su encabezado (1.5s)

  1 passed (2.8s)
```

En la pestaña de noVNC se abre Chromium, carga «Entorno de pruebas listo» y se cierra. La prueba
ha tardado más (1.5s frente a 163ms) solo por la pausa: el resultado es el mismo con ventana o sin ella.

## Comprueba tu entendimiento

**La prueba de navegador detecta un cambio en la página**
Cambia en `app/public/index.html` el texto `<h1>Entorno de pruebas listo</h1>` por `<h1>Entorno roto</h1>` y ejecuta:

```bash
# Ejecuta la prueba de navegador con la página cambiada
npx playwright test
```

→ La prueba falla después de esperar 5 segundos:

```text
  ✘  1 [chromium] › pruebas/humo.spec.js:4:1 › la página de humo muestra su encabezado (5.1s)

    Error: expect(locator).toBeVisible() failed

    Locator: getByRole('heading', { name: 'Entorno de pruebas listo' })
    Expected: visible
    Timeout: 5000ms
    Error: element(s) not found
```

Playwright no falla al instante: reintenta la [aserción](../glosario/01-fundamentos.md#asercion) hasta 5 segundos por si la página aún no
ha terminado de pintarse. Vuelve a dejar el texto original.

## Experimenta

Predice qué dirá Vitest si `saludar` olvida la coma. En `src/saludo.js` cambia
`` `Hola, ${nombre}` `` por `` `Hola ${nombre}` `` y ejecuta:

```bash
# Ejecuta la unitaria con la función cambiada
npx vitest run
```

```text
 × pruebas/humo.test.js > saludar > devuelve el saludo con el nombre 5ms
   → expected 'Hola Ada' to be 'Hola, Ada' // Object.is equality

 FAIL  pruebas/humo.test.js > saludar > devuelve el saludo con el nombre
AssertionError: expected 'Hola Ada' to be 'Hola, Ada' // Object.is equality

Expected: "Hola, Ada"
Received: "Hola Ada"
```

A diferencia de la prueba de navegador, la unitaria falla en milisegundos y enseña el valor
esperado y el recibido, carácter a carácter. Restaura la coma.

## Reto

### 1 — Que la suite de humo vigile también el título

**La situación:** la página de humo tiene el título `Entorno de pruebas` (la etiqueta `<title>`,
el texto de la pestaña del navegador). Un compañero borra esa etiqueta al tocar el HTML y la suite
sigue en verde, porque solo mira el encabezado.

**Qué haces:** añade en `pruebas/humo.spec.js` una segunda prueba que abra la página y compruebe
su título. Ejecuta `npx playwright test`, después borra la línea `<title>` de
`app/public/index.html` y vuelve a ejecutar.

**Pistas:** la aserción `toHaveTitle` se aplica a `page`, no a un [localizador](../glosario/02-e2e.md#localizador):
`await expect(page).toHaveTitle('…')`.

**Lo que buscas:** dos pruebas en verde con la página intacta, y la nueva en rojo sin el título.

<details>
<summary>Ver solución</summary>

```js
// Reto: la suite de humo también falla si la página pierde su título.
test('la página de humo tiene título', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Entorno de pruebas');
});
```

Con la página intacta:

```text
Running 2 tests using 1 worker

  ✓  1 [chromium] › solucion/pruebas/humo.spec.js:4:1 › la página de humo muestra su encabezado (161ms)
  ✓  2 [chromium] › solucion/pruebas/humo.spec.js:10:1 › la página de humo tiene título (101ms)

  2 passed (930ms)
```

La solución completa está en `solucion/` y se ejecuta con:

```bash
# Ejecuta la suite de la solución con su propia configuración
npx playwright test --config solucion/playwright.config.js
```

Una prueba de humo debe ser pequeña, pero tiene que mirar lo que de verdad indica que el sistema
está sano; en un despliegue real serían la página de inicio, el login o un endpoint de salud.
**La regla:** una prueba solo protege lo que comprueba; lo que no tiene aserción puede romperse en silencio.

</details>

## Errores frecuentes

| Síntoma | Causa probable | Cómo arreglarlo |
|---------|----------------|-----------------|
| `npm run verificar` muestra alguna línea `FALTA` | La instalación del Codespace no terminó o falló | Reinstala con `bash scripts/instalar-entorno.sh` (ver el bloque de abajo) y vuelve a verificar |
| `Executable doesn't exist at …/chromium…` | Faltan los navegadores de Playwright | Instálalos con `npx playwright install chromium` (bloque de abajo) |
| Se ejecutan pruebas de otros ejercicios, o Playwright no encuentra la página | Has lanzado el comando desde la raíz del repositorio, no desde la carpeta del ejercicio | Entra con `cd ejercicios/M01-01-preparar-el-entorno` (bloque de abajo) |
| `--headed` falla con `Looks like you launched a headed browser without having a XServer running` | El terminal no ve el escritorio remoto | Comprueba la variable con `echo $DISPLAY` (debe ser `:1`); si está vacía, crea un terminal nuevo |
| noVNC no conecta | El puerto 6080 no se ha abierto aún | Espera a que termine el arranque del Codespace y recarga la pestaña **Ports** |

```bash
# Reinstala las dependencias del curso (lo mismo que se hace al crear el Codespace)
bash scripts/instalar-entorno.sh
```

```bash
# Descarga el navegador Chromium que usa Playwright
npx playwright install chromium
```

```bash
# Entra en la carpeta del ejercicio (desde la raíz del repositorio)
cd ejercicios/M01-01-preparar-el-entorno
```

```bash
# Muestra a qué escritorio envían las ventanas los programas de este terminal
echo $DISPLAY
```

## Conclusiones

### Qué es un entorno de pruebas reproducible

Un entorno donde las mismas pruebas sobre el mismo código dan el mismo resultado, se ejecuten donde
se ejecuten. Se consigue **describiendo el entorno como código** (`devcontainer.json`, versiones
exactas en `package.json`) en lugar de instalarlo a mano.

### Cómo debe ser

| Requisito | En el lab |
|-----------|-----------|
| Versiones fijadas | Vitest 5.1.0 y Playwright 1.65.1 en todas las máquinas, según `npm run verificar` |
| Se comprueba solo | `npm run verificar` termina en `Entorno listo` o dice qué falta |
| Tiene una prueba de humo | Una unitaria y una de navegador, en verde en menos de un segundo cada una |
| Arranca lo que necesita | `webServer` levanta la app en el puerto 3101 y la para al terminar |
| Permite observar | Escritorio noVNC en el 6080 y `--headed` para ver el navegador |

### Dónde se rompe y cómo lo has detectado

| Fallo | Cómo lo has visto | Qué provoca |
|-------|-------------------|-------------|
| Falta una herramienta | Línea `FALTA` en `npm run verificar` | Las pruebas no pueden ni empezar |
| La página cambia | La prueba de navegador falla a los 5 s con `element(s) not found` | Feedback lento: espera al timeout |
| La función cambia | La unitaria falla en 5ms con el valor esperado y el recibido | Feedback inmediato y preciso |
| Algo sin aserción se rompe | El título desaparece y la suite sigue en verde | Fallos que nadie ve |

### Cómo se perfecciona

En un equipo real, el mismo devcontainer se usa en local y la misma imagen en CI, y el pipeline
empieza por la suite de humo para no gastar tiempo en el resto si el entorno no arranca. Las
versiones se actualizan a propósito, en un pull request propio, nunca porque alguien instaló otra.

### En una frase

> 🔑 Si el entorno no es reproducible, un fallo puede ser del código o de la máquina; con el
> entorno descrito como código, un fallo es siempre del código.
