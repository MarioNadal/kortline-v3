# Kortline frente a la competencia · 2026-11-13

Comparativa hecha a partir del conocimiento general del mercado, sin consultar las webs de cada producto: las funciones concretas pueden haber cambiado. Sirve para decidir qué añadir, no como estudio de mercado.

## Con quién se compara

| Tipo | Ejemplos | En qué son fuertes | En qué Kortline va por delante |
|---|---|---|---|
| Gestión de equipos | TeamSnap, Spond, SportEasy, Heja | Familias en la app, confirmación de asistencia, calendario, mensajes, cuotas | Estadística de baloncesto, reglas FIBA en directo, asistencia oficial con riesgo FEB, lesiones e incidencias |
| Estadística en directo | iScore Basketball, Easy Stats, GameChanger, StatMate | Anotación rápida, retransmisión, gráficos | Todo el día a día del club (asistencia, entrenamientos, voluntarios, convocatorias), trabajo offline y en español |
| Vídeo / análisis pro | Hudl, Synergy | Vídeo etiquetado, scouting | Precio (gratis), sencillez, cantera |
| Lo que se usa de verdad en clubes | Excel, WhatsApp, Google Forms | Todos lo saben usar | Todo lo anterior en un sitio y sin rehacer hojas |

## Hecho en esta revisión (dev.120–121)

- **Informe mensual por equipo** (PDF y WhatsApp): entrenamientos, asistencia por jugadora, quién está por debajo del umbral, voluntarios y tecnificaciones, partidos con resultados y máximas anotadoras, lesiones, incidencias y MVP. Es lo que las apps de gestión mandan como "resumen del mes".
- **"✋ Pedir un cambio"** desde el modo ver: prepara un mensaje para el superadmin (permiso de edición, corregir un dato u otra cosa) y lo envía por WhatsApp. No toca la base de datos.

## Lo que más valor añadiría (por prioridad)

1. **Las familias confirman la asistencia** ("Voy / No voy") a entrenos y partidos. Es la función estrella de Spond y TeamSnap y ahorra el "¿quién viene?" por WhatsApp. Necesita un acceso de solo lectura para familias (un enlace por equipo) y una colección nueva en Firestore. Es un cambio grande: hay que diseñarlo con cuidado por los datos de menores.
2. **Calendario exportable (.ics)**: los entrenos, partidos y eventos del equipo en el calendario del móvil de entrenadores y familias. Es pequeño y sin riesgo, porque solo genera un archivo.
3. **Bandeja de solicitudes dentro de la app**: la evolución de "Pedir un cambio". Que el superadmin vea las peticiones y las apruebe desde la app (por ejemplo, dar permiso de edición con un toque). Necesita una colección nueva y publicar reglas: hacerlo en `/test/` primero.
4. **Notificaciones**: "toca pasar lista", "te han convocado". Requiere instalar la app desde tienda (Capacitor) o Web Push, y un pequeño servidor.
5. **Resultado en directo para familias**: un enlace de solo lectura con el marcador que se actualiza solo (GameChanger lo tiene). Encaja bien con lo que ya existe.
6. **Indicador de sincronización** ("☁️ pendiente de subir" / "✓ al día"), para que nadie cierre la app con cambios sin subir.
7. **Plantillas de entrenamiento y catálogo de ejercicios compartido** entre equipos del club.
8. **Cuotas y pagos**: lo tienen casi todos los competidores, pero solo tiene sentido si el club cobra desde la app.

## Lo que NO conviene copiar

- Chat interno: el club ya vive en WhatsApp y competir con eso resta.
- Redes sociales o "muro" del equipo: distrae del uso real (pasar lista y partido).
