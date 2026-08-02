# Kortline · Roadmap y estrategia de versiones

Documento vivo. Define **cómo se versiona Kortline, cómo se desarrolla en paralelo y dónde vive cada cosa en GitHub**. Es la referencia maestra; el resto de archivos (README, CHANGELOG, MANUAL) están subordinados a lo que aquí se decide.

Repositorio: [github.com/MarioNadal/kortline-app](https://github.com/MarioNadal/kortline-app)
URL desplegada de la rama estable: [marionadal.github.io/kortline-app/](https://marionadal.github.io/kortline-app/)

---

## 1 · Modelo de versionado

Kortline usa [Semantic Versioning 2.0.0](https://semver.org/lang/es/) **estricto** a partir de la primera estable pública:

```
MAJOR . MINOR . PATCH
  │       │       │
  │       │       └── bugfix sin cambios funcionales · no rompe localStorage
  │       └────────── feature nueva · compatible hacia atrás · no rompe localStorage
  └────────────────── cambio de fondo · puede romper localStorage o flujo de uso
```

Pre-releases: `2.0.0-beta.1`, `2.0.0-beta.2`, `3.0.0-alpha.1`…

**Reset semántico v1.8.24 → v1.0.0.** Toda la serie v1.8.x se considera *pre-release de desarrollo interno*. La primera versión estable pública del proyecto es **v1.0.0**. Es un salto excepcional y se documenta una sola vez en la cabecera del CHANGELOG. A partir de aquí no se vuelven a reescribir números: lo siguiente a v1.0.0 es v1.0.1 o v1.1.0, y nunca al revés.

---

## 2 · Ramas en GitHub

Tres ramas largas conviven en el repositorio. Cada una tiene un dueño semántico claro.

| Rama | Para qué | Despliegue | Quién la toca |
|---|---|---|---|
| `main` | Última versión estable publicada | GitHub Pages → URL pública | Solo merges de releases y hotfixes |
| `v2-live` | Desarrollo del marcador en vivo completo (futuro v2.0) | No (o preview opcional) | Iteración libre |
| `v3-firebase` | Migración a Firebase Realtime / nube (futuro v3.0) | No (preview opcional) | Iteración libre |

**`main` siempre apunta a la última versión publicada en GitHub Pages.** Hoy será v1.0.0; cuando v2.0 esté estable, se mergeará a main y main pasará a servir v2.0; igual para v3.0.

**`v2-live` y `v3-firebase` son ramas largas paralelas.** Parten de `main` en el punto en el que se crean y reciben de vez en cuando merges/cherry-picks de bugfixes de `main` para no quedar desincronizadas en el código común (modelos de datos, UI base, asistencia, equipos…).

### Ramas cortas

Para cualquier trabajo concreto se crea una rama corta que vive solo lo que dura el cambio:

- `hotfix/B-XX-descripcion` — bug urgente en la versión publicada. Se mergea a `main` y se cherry-pickea a `v2-live` y `v3-firebase`.
- `feat/nombre-feature` — feature nueva sobre `main` que vaya a una minor (v1.1.0, v1.2.0…). Se mergea a `main`.
- Para `v2-live` y `v3-firebase` se trabaja normalmente directo en la rama larga, no hace falta ramas cortas a menos que se quiera revisar un cambio antes de aplicarlo.

### Tags

Cada release crea un tag inmutable: `v1.0.0`, `v1.0.1`, `v1.1.0`, `v2.0.0-beta.1`, `v2.0.0`, etc. Los tags son la garantía de que **cualquier versión histórica queda accesible para siempre** desde GitHub: `github.com/MarioNadal/kortline-app/releases/tag/v1.0.0`.

Para cada tag se crea además un **GitHub Release** con notas pegadas del CHANGELOG.

---

## 3 · Planes por rama

### v1.x · Estable LTS · `main`

**Alcance.** Asistencia y entrenamientos · gestión de equipos · convocatorias · partidos con resultado final por cuarto introducido a mano · estadísticas post-partido editables por jugador · export/import JSON, Excel, PDF · PWA offline.

**Explícitamente fuera.** Marcador en vivo, scoreboard live, faltas en directo, tiempos muertos, quinteto en pista, acciones por jugador en tiempo real, modo banco, modo rápido.

**Por qué.** Para clubes (o coaches) que solo necesitan llevar el control de asistencia, convocatorias y resultados, sin la complejidad del live game. Más simple, más estable, menos puntos de fallo. Si más adelante el coach quiere live game, se actualiza a v2.

**Política de mantenimiento.** Bugfixes prioritarios indefinidamente. Mejoras menores compatibles (v1.1.0, v1.2.0…) hasta que v2.0 sea estable; a partir de ahí, solo bugfixes críticos en una eventual rama `v1-lts`.

### v2.x · Marcador en vivo completo · `v2-live`

**Punto de partida.** El index.html v1.8.24 actual, que ya tiene live game implementado y bastante pulido (scoreboard, faltas, T.M., quinteto, modo lectura landscape de stats, etc.). Se conserva intacto en la rama `v2-live`.

**Plan.** Acabar de pulir el live game existente: ergonomía de banquillo, fiabilidad de cadenas de eventos (asistencia, rebote, falta), confirmación de cuartos, edición de errores, deshacer última acción. Cuando esté blindado y testeado en partidos reales, mergear a `main` y publicar **v2.0.0**.

**Pre-releases.** Se etiquetan `v2.0.0-beta.1`, `beta.2`… para poder probarlas sin sobreescribir la estable v1.x en producción.

### v3.x · Datos en la nube · `v3-firebase`

**Plan.** Migrar el storage de `localStorage` a Firebase Realtime Database (o Firestore, a decidir). Multi-usuario (entrenador principal + ayudantes editando el mismo equipo desde dispositivos distintos), sincronización en tiempo real, copia automática en la nube. Mantener fallback offline-first (la app sigue funcionando sin red y sincroniza al recuperar conexión).

**Punto de partida.** Parte de `main` (o de `v2-live` si v2 ya está estable cuando arranquemos). Es un cambio mayor: cambia el modelo de datos, los identificadores, el flujo de autenticación.

**Riesgos a vigilar.** Coste de Firebase si crece el uso · privacidad de datos de menores (jugadores) · necesidad de plan de migración para usuarios que vengan de v1/v2 con datos en localStorage.

---

## 4 · Flujo de trabajo día a día

| Si Mario dice… | Trabajo en… | Bump de versión | Entrega |
|---|---|---|---|
| "Arregla bug X" en producción | `main` | PATCH (v1.0.0 → v1.0.1) | index.html + README + CHANGELOG + MANUAL + commit msg |
| "Añade feature Y al estable" | `main` | MINOR (v1.0.1 → v1.1.0) | index.html + README + CHANGELOG + MANUAL + commit msg |
| "Toca el live game" | `v2-live` | Pre-release (v2.0.0-beta.N) | index.html + README + CHANGELOG + commit msg |
| "Empieza Firebase" | `v3-firebase` | Pre-release (v3.0.0-alpha.N) | index.html + README + CHANGELOG + commit msg |

Cuando un bugfix en `main` afecte a código que también vive en `v2-live` o `v3-firebase`, se cherry-pickea el commit a la rama afectada y se hace un bump de pre-release allí.

---

## 5 · Documentación viva

Cuatro archivos viven en `main` y se actualizan en cada release:

- **`README.md`** — Overview del proyecto, link al manual, tabla compacta de versiones publicadas. Es lo primero que se lee al entrar al repo y lo primero que yo (Claude) leo al abrir una nueva conversación.
- **`CHANGELOG.md`** — Historial completo por versión en formato [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). El detalle largo de cada cambio vive aquí, no en el README.
- **`MANUAL_USUARIO_KORTLINE.md`** — Manual de usuario sincronizado con la última estable de `main`.
- **`ROADMAP.md`** — Este documento. Cambia rara vez; solo cuando cambia la estrategia.

En las ramas `v2-live` y `v3-firebase` el README y el CHANGELOG pueden tener entradas adicionales para reflejar el desarrollo de esas ramas (con etiqueta visible "**rama v2-live · no publicada**" o similar).

---

## 6 · Política de breaking changes

Un cambio rompe localStorage o flujo de uso → **MAJOR**. Esto incluye:

- Renombrar claves de `localStorage` (`cbj:m`, `cbj:p`, `cbj:s`, `cbj:t`…).
- Cambiar la forma de un objeto persistido (ej. añadir un campo obligatorio sin migración).
- Eliminar una pantalla que el usuario usa habitualmente.
- Pasar de localStorage a cloud (v3) **es** un MAJOR aunque haya migración automática.

Cuando se haga un MAJOR, **siempre hay que escribir migración**: leer el formato viejo de localStorage, transformarlo al nuevo y guardar, sin pedir al usuario que reexporte/importe. La única excepción son los pre-releases (alpha/beta), donde se acepta romper sin migración mientras el formato no esté estable.

---

## 7 · Despliegue

GitHub Pages sirve `main` automáticamente en [marionadal.github.io/kortline-app/](https://marionadal.github.io/kortline-app/). No hay pipeline de CI; el deploy es "merge a main → Pages refresca".

Para invalidar la PWA cacheada en clientes ya instalados, **cada release bumpea `CACHE_VERSION`** dentro del service worker (`sw.js`) y dentro de `index.html` (panel Acerca de + JSON export).

Si en algún momento se quiere desplegar `v2-live` en preview público, se hace creando un workflow de GitHub Actions que despliegue esa rama a una URL alternativa, o bien creando un repo espejo `kortline-app-v2-preview`. **No es necesario hoy.**

---

## 8 · Historial de decisiones

| Fecha | Decisión | Motivo |
|---|---|---|
| 2026-05-13 | Reset semántico v1.8.24 → v1.0.0 | Marcar oficialmente la primera estable pública. Toda la serie 1.8.x queda como pre-release de desarrollo interno. |
| 2026-05-13 | v1.0.0 sin live game, con resultados por cuarto manuales | Necesidad de una versión sin ambigüedad: el live game existente requiere más pulido y puede generar confusiones en partido real. El live game completo se reserva para v2.0. |
| 2026-05-13 | Tres ramas largas: `main` + `v2-live` + `v3-firebase` | Permitir desarrollo paralelo de live game (v2) y de migración a Firebase (v3) sin bloquear bugfixes de la estable. |
| 2026-05-13 | Un único despliegue público (main) por defecto | Evitar over-engineering. Los tags conservan el historial; si en el futuro hace falta tener v1 desplegada en paralelo a v2, se creará una rama LTS específica. |
