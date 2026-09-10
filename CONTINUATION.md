# Kortline v3 — Contexto para continuar en otro chat

Este documento es el punto de partida para retomar el trabajo en Kortline v3 desde una conversación nueva (sin memoria de las anteriores). Está pensado para que lo lea Claude al principio de la sesión, o para pegarlo como instrucciones del proyecto en Claude.ai.

## Qué es esto

Kortline v3 es una PWA de gestión de equipos de baloncesto (asistencia, partidos en vivo, estadísticas, jugadores), de un solo archivo `index.html` (~10.700 líneas, vanilla JS, sin frameworks ni build step). La usa en producción un club real (**CB Jaca**), con ~5 entrenadores compartiendo la misma base de datos.

- **Repo:** `https://github.com/MarioNadal/kortline-v3` (rama `main`)
- **App real (producción):** `https://marionadal.github.io/kortline-v3/`
- **Copia de pruebas aislada (para probar desde el móvil sin tocar datos reales):** `https://marionadal.github.io/kortline-v3/test/` — mismo PIN, base de datos Firestore completamente distinta (`clubs/cbjaca-test`)
- **Backend:** Firebase Firestore compartido. `CLUB_ID = "cbjaca"` (constante en `index.html`). Auth = una única cuenta compartida (`club-cbjaca@kortline.app`); el "código del club" que teclean los entrenadores para entrar **es literalmente la contraseña de esa cuenta**, no un PIN numérico de verdad — puede llevar letras.
- **Versión actual desplegada:** revisar `sw.js` → `CACHE_VERSION` (formato `kortline-v3.0.0-dev.N`) y `index.html` → `const APP_VERSION` (deben coincidir en el número de build; si no coinciden, algo se desplegó a medias).

## Cómo arrancar en una sesión nueva

El sandbox no conserva el clon entre sesiones. Lo primero, siempre:

```bash
cd /tmp && git clone https://github.com/MarioNadal/kortline-v3.git
cd /tmp/kortline-v3/tests && npm install --silent
```

Luego lee este archivo (`CONTINUATION.md`, si está commiteado) y el `CHANGELOG.md` (las entradas más recientes están arriba) para ver qué se hizo últimamente.

## Flujo de trabajo establecido (seguirlo siempre)

1. **Reproducir/entender** el bug o la petición leyendo el código real (`grep`/`sed -n` sobre `index.html`, nunca asumir).
2. **Arreglar** editando `index.html` (y `sw.js` si hace falta) vía Python heredoc + `content.replace(old, new)` con `assert content.count(old)==1` antes de escribir — nunca editar a ciegas. Si el string-match falla por algún carácter raro (guiones largos, tildes), usar slicing por número de línea (`f.readlines()`) en vez de forzar el string.
3. **Testear en jsdom**: escribir/actualizar un archivo en `tests/*.test.js` usando el harness (`tests/harness.js`: `loadApp()`, `buildFixture()`, `newReporter()`). Los tests cargan el `index.html` real dentro de jsdom y llaman a las funciones reales de la app.
4. **Correr la suite completa** con `cd tests && node run-all.js`. **Ojo:** cada llamada a bash tiene un tope de 45s y la suite completa (22 archivos) puede no caber — si se corta, dividirla en 2-3 llamadas con un runner temporal que reciba una lista de archivos (ver patrón usado en el historial de commits: un script `_runsome.js` desechable que llama a `require(file).run()` por cada archivo pasado por argv).
5. **Solo si `index.html` o `sw.js` cambiaron:** subir el número de build en AMBOS a la vez —
   - `sw.js`: `const CACHE_VERSION = "kortline-v3.0.0-dev.N";`
   - `index.html`: `const APP_VERSION = "3.0.0-dev.N";` (cerca de `CLUB_ID`, sobre la línea 2088 a fecha de este documento)
   Si el cambio es solo de tests (sin tocar `index.html`/`sw.js`), no hace falta subir versión — decirlo explícitamente en el CHANGELOG ("Sin cambios en index.html/sw.js — no hace falta subir CACHE_VERSION").
6. **Actualizar `CHANGELOG.md`**: añadir una entrada nueva ARRIBA del todo (debajo de la cabecera), con fecha, siguiendo el formato ya usado (`### Añadido` / `### Corregido` / `### Investigado` / `### Probado (jsdom)` / `### Quitado`). Explicar el bug real con sus síntomas, no solo "se arregló X".
7. **Commit y push:**
   ```bash
   git add -A
   git commit -F /tmp/commitmsgN.txt   # usar un fichero temporal si el mensaje lleva comillas
   git push https://ghp_XXXXXXXX@github.com/MarioNadal/kortline-v3.git main
   ```
   El token de GitHub lo tiene que dar el usuario si no está ya en el entorno — **nunca mostrarlo en claro en la respuesta**, siempre redactarlo con `sed 's/ghp_[a-zA-Z0-9]*/***TOKEN***/g'` sobre la salida del push.
8. **Si `index.html`/`sw.js` cambiaron, regenerar `/test/`:**
   ```bash
   bash scripts/build-test-deploy.sh
   git add -A test/ && git commit -m "Chore: sincronizar /test/ con dev.N (...)" 
   git push ...
   ```
   Si se te olvida este paso, la copia de pruebas del móvil se queda desactualizada respecto a producción (los datos siguen aislados igual, pero el código no).

## El patrón de bug más rentable en esta app

Repetidas veces (asistencia, insignia BONUS, mapa de tiro rival/nuestro) el bug real ha sido: **el mismo cálculo está reimplementado en varios sitios de la app, y al menos una de las copias está mal o desactualizada** (p.ej. una pantalla respeta la fecha de alta del jugador y otras tres no; un sitio etiqueta el tiro con el pid correcto y otro no). Cuando el usuario reporta "esto no cuadra" o "aquí sale distinto que allí", la primera sospecha razonable es esta — buscar todas las reimplementaciones del mismo dato (`grep` por el nombre del campo, p.ej. `_teamScore`, `_photo`, `addedAt`) y comparar si coinciden.

## Convenciones de código a mantener

- Nombres de fix con prefijo `B-XXX#` en comentarios (`v1.8.36 · B-SCORE1: ...`) explicando el POR QUÉ del cambio, no solo el qué — el código ya tiene docenas de estos, seguir el estilo.
- `let`/`const` de scope global en `index.html` **no** se exponen como `window.X` automáticamente (solo las `function` declaradas sí). Si un test nuevo necesita leer/escribir una variable `let`/`const` de scope global que no sea una función, hay que añadirla a `EXPOSED_GLOBALS`/`EXPOSED_LIVE_BINDINGS` en `tests/harness.js`.
- Un lightbox/modal nuevo sigue el patrón ya usado en todo el archivo: `document.getElementById(id)?.remove()` → crear `div` con `id`, `position:fixed` a pantalla completa, `onclick` en el fondo para cerrar → `document.body.appendChild(el)`.
- Nunca usar `localStorage`/`sessionStorage` como fuente de verdad para datos compartidos entre entrenadores — eso es lo que hace Firestore. `localStorage` solo para preferencias puramente locales del dispositivo (nombre del entrenador en ese móvil, filtros de UI, etc.).

## Qué se hizo en la sesión más reciente (resumen, ver CHANGELOG.md para detalle)

De más antiguo a más reciente: pantalla Hoy ordenada por hora + barra de próximo entreno · insignia BONUS corregida (5 faltas, no 4) · jugadores puntuales/invitados (para partidos y entrenos, cuentan en stats de temporada) · asistencia media corregida para respetar fecha de alta del jugador · copia de pruebas aislada en `/test/` · orden local/visitante corregido al anotar el marcador manual · mapa de tiro separa ahora el rival (solo importa ese partido) de nuestro equipo (temporada) · se quitó la copia de seguridad manual (export/import JSON), redundante y arriesgada con Firestore como fuente de verdad · la versión visible en Ajustes ya no está clavada en "1.0.0" · valoración 1-10 con stepper +/- en vez de 10 estrellas diminutas · vista previa de foto de entrenamiento (antes no se podía volver a ver) · verificación de que las estadísticas agregadas de valoración calculan bien · auditoría de Incidencias (sin bugs, solo le faltaba cobertura) · el campo del código de club forzaba teclado numérico y no dejaba escribir letras (arreglado).

**Estado al cerrar la sesión dev.53 (2026-09-10):** dos bugs reales arreglados que habían quedado pendientes de la sesión anterior sin llegar a documentarse aquí: (1) `save()` no escribía `"cbj:drills"` en `localStorage` (a diferencia de `load()`/`_persistLocalCacheOnly()`), así que una edición offline del catálogo de ejercicios se podía perder si se refrescaba la página antes de sincronizar con Firestore — arreglado siguiendo el mismo patrón que `sessions`/`events`/`trainingNotes`; (2) `openActionPicker()` (el modal "¿Quién?" del partido en vivo) ignoraba `m.live.activeTeam` y siempre ofrecía nuestra propia plantilla, así que con la plantilla del rival completa (modo individual) cualquier acción tocada en la pestaña Rival — no solo faltas, también puntos/rebotes/robos/etc — abría el picker con nuestras jugadoras en vez de las del rival; la sospecha original solo apuntaba a faltas, la investigación confirmó que el hueco era más amplio. Ver CHANGELOG.md (entrada `dev.53`) para el detalle completo.

**Estado al cerrar esta sesión (2026-09-10, dev.54):** bug real de sincronización entre dispositivos (B-SYNCATT1), reportado por el usuario: pasar asistencia de un equipo que otro dispositivo no tenía abierto en pantalla no llegaba a ese otro dispositivo hasta que alguien entraba en ese equipo concreto. Causa: los listeners de Firestore por equipo (`_attachTeamListeners`) solo escuchaban al equipo actualmente en pantalla en cada dispositivo (`S.teamId`), reconectándose a otro equipo en cada navegación — nada escuchaba a los equipos que ese dispositivo no tuviera abiertos. Se separó la asistencia (`sessions`) y las notas de entrenamiento (`trainingNotes`, mismo mecanismo) del resto de colecciones por equipo: ahora se escuchan en tiempo real para TODOS los equipos del club a la vez desde que se entra en la app (`_attachSessionListeners`/`_syncSessionListeners`, nuevas — se reconectan solas cuando se da de alta o de baja un equipo), sin esperar a que nadie navegue hasta ese equipo. El resto de colecciones por equipo (jugadoras, partidos, eventos, ejercicios) se queda igual que antes — por equipo, bajo demanda — porque no era el problema reportado y ampliarlo también habría multiplicado el número de listeners abiertos sin necesidad. Se añadió además un mock mínimo de Firestore al harness de tests (`loadApp({firebase})`, nuevo parámetro opcional en `tests/harness.js` — quita las etiquetas `<script>` del SDK real antes de cargar `index.html` en jsdom, para no depender de red ni arriesgarse a tocar el proyecto real) que permite por primera vez testear esta ruta de sincronización, antes sin ninguna cobertura (`tests/session_sync_all_teams.test.js`, 12 comprobaciones nuevas). Ver CHANGELOG.md (entrada `dev.54`) para el detalle completo. Todo publicado en `main` y sincronizado en `/test/`. Testeado (632/632 en 49 archivos, tras un commit de solo-tests que amplió `session_sync_all_teams.test.js` a petición del usuario). Sin bugs conocidos pendientes.

**Estado al cerrar esta sesión (2026-09-10, dev.55):** petición del usuario (no un bug): que la pretemporada (antes del 14/09 este año) no cuente en las estadísticas de asistencia, sin perder el registro día a día. Nueva fecha configurable `S.cfg.seasonStart` en Ajustes → Estadísticas ("Inicio de temporada"), vacía/`null` por defecto (ningún club se ve afectado sin configurarla explícitamente — se probó primero con "2026-09-14" como valor por defecto en `DEFAULT_CFG` y rompió 16 tests existentes cuyas fechas de fixture quedaban "antes de temporada" sin querer, así que se descartó esa idea: el usuario tiene que ponerla él mismo en Ajustes). Nuevo punto único `_isDateInSeason(date)`, aplicado en `_sessForPlayer` (de donde beben casi todos los cálculos de % vía `_countAtt`) y explícitamente en los pocos sitios que no pasan por ahí: `computeInjurySnapshot`, la media mensual de Historial (el día a día se queda sin tocar a propósito), las gráficas de Estadísticas y los exports PDF/Excel. Mismo patrón de "punto único" que ya se usó para la fecha de alta del jugador (`_isPlayerActiveOn`, B-GUEST3) — evita reabrir el mismo bug de reimplementaciones sueltas desincronizadas que esta app ya sufrió antes. Ver CHANGELOG.md (entrada `dev.55`) para el detalle completo, incluidos los matices de qué SÍ se excluye (% de temporada, riesgo FEB, racha, gráficas, resumen semanal, exports) y qué NO (el registro de cada día concreto en Historial y en la hoja "Sesiones" del Excel, que siguen mostrando la realidad tal cual). Todo publicado en `main` y sincronizado en `/test/`. Testeado (652/652 en 50 archivos). Sin bugs conocidos pendientes.

## Dónde mirar si el usuario pide "sigue revisando"

Zonas de la app que ya han tenido una pasada de auditoría a fondo esta sesión (con tests): asistencia/fecha de alta, insignia BONUS, jugadores puntuales, orden local/visitante, mapa de tiro rival, backup/versión, valoración por estrellas, foto de entrenamiento, estadísticas agregadas de valoración, Incidencias, campo de login. Zonas de sesiones ANTERIORES (más antiguas, puede que valga la pena revisar si ha pasado tiempo o han cambiado cosas cerca): exportación PDF/Excel con datos límite, modo "solo equipo" en profundidad, prórroga (overtime), deshacer/rehacer de tiros libres en lote, textos compartidos por WhatsApp (`buildDailyText`, `buildWeeklyText`, `buildEventoText`, `mConvText`, `shareMatchResult`) — el último repaso completo de estos fue con `season_simulation.test.js`, pero no se ha vuelto a auditar específicamente desde que se añadieron jugadores puntuales, valoración con stepper y fotos.

## Notas sobre `ROADMAP.md`

El archivo `ROADMAP.md` del repo describe un modelo de versionado semántico (v1.0.0, ramas `v2-live`/`v3-firebase`, repo `kortline-app`) que **no coincide con la práctica real actual** (un solo repo `kortline-v3`, una sola rama `main`, versionado por contador `dev.N` sincronizado entre `CACHE_VERSION` y `APP_VERSION`). Es un documento desactualizado de una etapa anterior del proyecto — no tomarlo como referencia de cómo se versiona hoy; usar este `CONTINUATION.md` y el `CHANGELOG.md` en su lugar.
