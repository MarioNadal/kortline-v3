# Tests · Kortline v3

Suite de regresión que ejecuta el `index.html` real dentro de [jsdom](https://github.com/jsdom/jsdom) y llama a las funciones reales de la app — las mismas que disparan los botones — sin necesidad de un navegador ni de tocar producción.

No sustituye probar en un móvil real antes de un partido importante, pero sí atrapa regresiones de lógica (reglas de baloncesto, validaciones, sincronización) en segundos, cada vez que se toca el código.

## Uso

```bash
cd tests
npm install   # solo la primera vez (instala jsdom)
npm test
```

Sale con código de salida `1` si algo falla — se puede enganchar a un hook de pre-commit o a CI más adelante.

## Qué cubre cada archivo

- **dq_guards** — un jugador descalificado (5 faltas / expulsión) no puede volver a pista por ninguna de las 3 vías de sustitución (`subPlayer`, `_tmPickIn` en tiempo muerto, `subRivalPlayer`).
- **min5_players** — no se puede arrancar el seguimiento en vivo con menos de 5 convocados; un partido ya en marcha no se bloquea si la convocatoria baja después.
- **dorsal_dupe** — dos jugadores de la misma plantilla no pueden compartir dorsal; editar el dorsal del propio jugador no cuenta como duplicado.
- **timeout_halves** — el límite de tiempos muertos por mitad se calcula bien tanto en formato de 4 cuartos como en formatos de otro número de periodos (p. ej. "Escuela", 6×8min), y en prórroga.
- **tl_pause_resume** — los 8 modales de tiros libres se pueden pausar y reanudar sin perder el tirador elegido, el número de TL, ni los aciertos ya marcados.
- **live_presence** — si dos dispositivos tienen abierto el seguimiento en vivo del mismo partido a la vez, el segundo ve un aviso; un latido propio o caducado no avisa; la sincronización a Firestore sigue ignorando reloj/latido para no generar ruido.
- **short_name** — dos jugadores que comparten la primera palabra del nombre se muestran de forma distinguible.

## Añadir un test nuevo

1. Crear `tests/mi_caso.test.js` que exporte `async function run()` devolviendo `report.summary()` (ver `harness.js` → `newReporter`).
2. `run-all.js` lo recoge solo con que el archivo termine en `.test.js` — no hace falta registrarlo en ningún sitio.
3. Si el test necesita leer/escribir una variable `let`/`const` de scope global de `index.html` que hoy no esté expuesta, añadir su nombre a `EXPOSED_GLOBALS` en `harness.js`.


## Pruebas a nivel usuario (Chromium)

Aparte de la suite de jsdom, `tests/e2e/` tiene dos pruebas que abren la app real en Chromium a tamaño de móvil. No forman parte de `npm test` (necesitan Playwright y Chromium). Todo en local: nunca tocan Firebase.

```bash
cd tests
npm ci --prefix cdn-mirror                      # una vez
node e2e/user_flow.e2e.js                       # un entrenador de principio a fin (15 pasos)
node e2e/monkey.e2e.js "Pixel 7"                # pulsa todos los botones de todas las pantallas
MONKEY_ROLE=entrenador node e2e/monkey.e2e.js   # lo mismo como entrenador de solo lectura
```

Para probar la copia de `/test/` en vez de la raíz: `KORTLINE_TEST_INDEX=test/index.html` delante.
