# Auditoría completa de Kortline v3 · 2026-11-12

**Versión auditada:** `3.0.0-dev.113` → sale de esta auditoría como **`3.0.0-dev.114`**.
**Alcance:** toda la app (`index.html`, `sw.js`, reglas, scripts, tests), como profesional (código, datos, seguridad) y como usuario real (Chromium a tamaño de móvil, pulsando botones).
**Condición:** la app está en uso real. No se ha tocado ninguna base de datos: todas las pruebas son en local, sin conexión a Firebase.

---

## 1. Cómo se ha probado

| Prueba | Qué hace | Resultado final |
|---|---|---|
| Suite de regresión (jsdom) | 101 archivos, llama a las funciones reales de la app | **2061 OK / 0 fallos** en la raíz y en `/test/` |
| `tests/e2e/user_flow.e2e.js` | Un entrenador de principio a fin: equipo, jugadoras, pasar lista, voluntario, puntual, tecnificación, partido, estadísticas, compartir | **15/15**, 0 errores de JavaScript |
| `tests/e2e/monkey.e2e.js` (nueva) | Con una temporada completa de datos, **pulsa uno por uno todos los botones** de 24 pantallas y de las ventanas que abren | **1.269 botones**, 0 errores, 0 textos rotos, nada se sale de pantalla (Pixel 7, iPhone SE y Galaxy S8) |
| `monkey` en modo "solo lectura" (nueva) | Un entrenador que solo puede **ver** un equipo pulsa todo (474 botones, incluido un directo en marcha) y se comprueba que no cambia ningún dato | **0 cambios** (antes de los arreglos: 60 botones se saltaban el permiso) |

La prueba mono no cubre: escribir en formularios campo a campo, exportar PDF/Excel hasta el archivo final, ni la sincronización real entre dos móviles (eso solo se puede probar en `/test/` con dos dispositivos).

---

## 2. Fallos encontrados y arreglados en dev.114

### 2.1 Permisos: quien solo podía ver un equipo podía cambiarlo (B-PERM2) — importante

Con los roles activados, un entrenador o director deportivo con un equipo en "solo ver" podía, desde unos **60 botones**, cambiar datos de ese equipo: valoraciones del entrenamiento, marcador por cuartos, prórroga, asistencia al partido, y en el directo el reloj, los cambios, tiempos muertos, tiros libres, deshacer, cambiar de cuarto o terminar el partido. Solo estaban protegidas las acciones principales (pasar lista, anotar una canasta, editar plantilla).

Además, **solo por abrir** un partido en directo de un equipo que no podía editar, su móvil:
- dejaba el aviso de "estoy registrando este partido" (al anotador real le salía un aviso falso de "otro dispositivo está registrando");
- reescribía el marcador por cuartos del partido, con lo que podía subir a la nube **su copia, más vieja, del partido entero** encima de la del anotador.

Arreglo: cada acción de edición empieza ahora con la misma comprobación de permiso (marcadas `B-PERM2` en el código), y quien solo mira ya no escribe nada en el partido. Sin roles activados no cambia nada.

Límite que sigue existiendo: los permisos se comprueban en la app, no en el servidor. Alguien con el código del club y conocimientos técnicos puede saltárselos (ver 4.1).

### 2.2 Error al abrir Gráficas (B-CHART1)

Si la pantalla de Gráficas se repintaba dos veces seguidas (doble toque, o un cambio de otro entrenador que llegaba de la nube en ese momento), Chart.js lanzaba "Canvas is already in use". Era un error real de JavaScript que además se guardaba en el registro de errores de Firestore. Arreglado.

### 2.3 "Copiar" en Compartir evento / Compartir resultado

Dos botones "📋 Copiar" llamaban al portapapeles sin controlar el fallo: si el móvil lo denegaba, no pasaba nada y no avisaba. Ahora usan el mismo copiado con alternativa que el resto de la app.

### 2.4 "Invalid Date" en la ficha de lesión

Una fecha vacía o rota en el historial de lesiones se veía como "Invalid Date → Invalid Date". Ahora se muestra "—".

### 2.5 Limpieza

- Había dos funciones con el mismo nombre (`_refreshLiveStatsModal`); la primera nunca se ejecutaba. Quitada.

---

## 3. Lo que NO se ha tocado hoy, a propósito

La app está en producción y tiene que estar disponible esta tarde. Estos cambios son buenos, pero no para hacerlos con prisa:

- **Partir `index.html` en módulos.** Ver 5.1.
- **Borrar las 12 funciones que ya no usa nadie** (`_hasManualQ`, `autoSaveQ`, `delRivalPlayer`, `goAtt`, `openRivalPlayerModal`, `saveAtt`, `saveMatchScore`, `selectLivePid`, `setClockMins`, `setTeamTLMakes`, `sparkline`, `toggleInjActive`). No hacen daño; se quitan en la modularización.
- **Comprobación de integridad (SRI) de las librerías externas.** Un hash mal puesto deja la app sin cargar; hay que calcularlo contra el CDN real y probarlo en `/test/`.

---

## 4. Riesgos que siguen abiertos (por prioridad)

### 4.1 Una sola cuenta para todo el club — alto
El código del club es la contraseña de una cuenta compartida. Quien lo tenga puede leer y escribir todo, y los roles solo se comprueban en el móvil. No se puede quitar el acceso a un entrenador que se va sin cambiar el código a todos.
**Mejora:** una cuenta por entrenador (Firebase Auth) y permisos por equipo comprobados en las reglas de Firestore.

### 4.2 Dos entrenadores editando lo mismo a la vez — medio
Cada pase de lista y cada partido se guarda como un documento entero. Si dos móviles cambian **el mismo entrenamiento del mismo equipo** a la vez (o uno sin cobertura y otro con ella), el último que sube pisa al otro. Para el directo ya hay un aviso; para el pase de lista no.
**Mejora:** guardar solo los campos que cambian (jugador a jugador) en vez del documento entero.

### 4.3 `/test/` y producción se publican a la vez — medio
Las dos salen de `main`: fusionar una PR actualiza la app real en el mismo momento que la de pruebas. Probar en `/test/` no protege a producción.
**Mejora:** publicar `/test/` desde una rama propia y pasar a producción solo cuando esté aprobado.

### 4.4 Datos de menores y repositorio público — medio
Lesiones, incidencias y asistencia de menores exigen consentimiento de los tutores y política de privacidad. El repositorio es público: las copias de seguridad van cifradas, pero conviene hacerlo privado.

### 4.5 No se ve si algo está sin subir a la nube — medio
Si un móvil no consigue sincronizar, el entrenador no lo sabe: solo queda en la consola.
**Mejora:** un indicador pequeño de "☁️ pendiente de subir" / "✓ sincronizado".

### 4.6 Otros — bajo
- `xlsx` 0.18.5 tiene vulnerabilidades conocidas al **importar** archivos; la app solo exporta, así que hoy no aplica.
- El zoom está desactivado (`user-scalable=no`) y solo 4 botones tienen etiqueta para lectores de pantalla: mala accesibilidad.
- La copia de seguridad se hace una vez al día: lo borrado desde la app queda además en la papelera, pero un cambio erróneo (no un borrado) de hoy no tiene vuelta atrás hasta el backup de mañana.

---

## 5. Mejoras de código

### 5.1 Modularizar sin reescribir
`index.html` tiene 17.000 líneas y 668 funciones (la mayor, `liveGame`, 919 líneas). El fallo más repetido del proyecto es el mismo cálculo copiado en varios sitios, y los huecos de permisos de esta auditoría son el mismo patrón.

Plan por pasos, cada uno desplegable por separado y con la suite como red:
1. Añadir Vite, con `index.html` como única entrada y la salida en una carpeta que publica GitHub Pages. Sin cambios de comportamiento.
2. Sacar a módulos lo que no pinta pantalla: `sync.js` (lo más delicado, ya bien probado), `permissions.js`, `attendance.js`, `stats.js`, `live-engine.js`.
3. Sacar las pantallas una a una.
4. Sustituir los `onclick="..."` en texto por un único gestor de eventos con `data-action`: elimina de raíz los fallos de inyección y permite comprobar permisos en un solo sitio.

### 5.2 Un único punto para guardar con permiso
Hoy cada función comprueba su permiso. Con el paso 4 de arriba, la comprobación va en el gestor de eventos y es imposible olvidarla.

### 5.3 Pruebas
- Meter las dos pruebas de Chromium en GitHub Actions (hoy se lanzan a mano).
- Probar la sincronización contra el emulador de Firestore, con dos clientes a la vez.

### 5.4 Proceso
- Mensajes de commit descriptivos y un número de versión por cada cambio publicado.
- `ROADMAP.md` y `CONTINUATION.md` están desfasados (hablan de `kortline-app`, de 10.700 líneas y de subir con un token pegado en la URL). Hay que reescribirlos.

---

## 6. Mejoras para el usuario

Ordenadas por lo que más ayudaría en el día a día:

1. **Indicador de sincronización** (ver 4.5).
2. **Asistencia a voluntarios y tecnificaciones en Estadísticas y en Excel/PDF**, separada por tipo (hoy solo se ve en Hoy, Historial y la insignia de la plantilla, que además suma los dos tipos).
3. **Deshacer** tras borrar una sesión, un partido o un jugador (los datos ya van a la papelera; falta el botón para recuperarlos desde la app).
4. **Vista de la semana** además de "Hoy": qué toca cada día.
5. **Vista para familias** en solo lectura: convocatorias y horarios.
6. **Avisos** (notificaciones) de convocatoria y de "toca pasar lista".
7. **Buscador de jugador** en todo el club.
8. **Accesibilidad:** permitir zoom y etiquetar los botones de icono.
9. **Modo claro** para pabellones con mucha luz.

---

## 7. Pasar a app de tiendas

Es viable sin reescribir la app. En Android, empaquetando la PWA con Bubblewrap o PWABuilder (25 $ una vez). En iOS, envolviéndola con Capacitor (99 $ al año); Apple suele pedir alguna función nativa, como notificaciones. Requisito previo recomendado: 4.1 (cuentas por entrenador) y política de privacidad.
