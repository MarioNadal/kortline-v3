# Kortline

PWA de asistencia del CB Jaca: los entrenadores pasan lista y comparten notas de entrenamiento.
Repo: github.com/MarioNadal/kortline-v3

## Estado
- v1 en pruebas
- v2: marcador en directo
- v3: datos en Firestore (plan gratuito de Firebase)

## Reglas
- Mario dirige y decide el modelo de datos; Claude escribe la mayor parte del código. Explica cada cambio en dos o tres líneas.
- No cambies de base de datos sin preguntar. Cuida el número de lecturas y escrituras para no salir del plan gratuito.
- Hay datos de jugadores menores: guarda solo lo necesario y que las reglas de seguridad de Firestore limiten el acceso a los entrenadores.
- Cambios pequeños, en ramas, con PR y descripción en español.
- Nunca subas claves, tokens ni ficheros de configuración con secretos.
