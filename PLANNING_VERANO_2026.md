# Planning Verano 2026 — Kortline

**Objetivo:** llegar a v3.0.0 (Firebase) antes de que acabe el verano.  
**Periodo:** junio – septiembre 2026.  
**Desarrollador:** Mario Nadal Ara.

---

## Visión del verano

```
v1.0.2 (ahora)
    │
    ├── v1.1.0 — B-drag fix          ~1 sesión
    │
    ├── v2.0.0 — Marcador live       ~4-6 sesiones
    │       (desde rama v2-live)
    │
    └── v3.0.0 — Firebase            ~6-10 sesiones
            (desde rama v3-firebase)
```

La v1.1 es opcional pero recomendable: arregla un bug conocido antes de añadir complejidad.  
La v2 es prerequisito técnico de v3 (define la estructura de datos de partidos en vivo).

---

## Fase 0 — Decisión Firebase (ANTES de escribir código)

> ⚠️ Esta decisión bloquea todo lo demás de v3. Hacerla bien ahora ahorra refactors.

### Firestore vs Realtime Database

| Criterio | Firestore | Realtime Database |
|---|---|---|
| Consultas complejas | ✅ Soporta filtros, índices, colecciones | ❌ Solo árbol JSON, consultas limitadas |
| Tiempo real | ✅ Sí (listeners) | ✅ Sí (mejor latencia en updates simples) |
| Offline (PWA) | ✅ Persistencia offline nativa | ⚠️ Básica |
| Precio | Por lectura/escritura/doc | Por ancho de banda |
| Escalar a múltiples equipos | ✅ Colecciones anidadas limpias | ⚠️ Requiere diseño cuidadoso del árbol |
| Migraciones de schema | ✅ Más fácil (documentos flexibles) | ⚠️ Todo en un árbol, harder to evolve |
| Complejidad de reglas de seguridad | Media | Media |

**Recomendación preliminar:** Firestore, por el soporte offline en PWA y la facilidad de escalar a múltiples equipos/temporadas. Pero Mario debe confirmar.

### Decisión de modelo de datos (Firestore)
```
/clubs/{clubId}
  /teams/{teamId}
  /players/{playerId}
  /sessions/{sessionId}
  /matches/{matchId}
    /events/{eventId}
  /config
```

### Acción
- [ ] Mario confirma: **Firestore o Realtime Database**
- [ ] Definir modelo de datos final antes de tocar código

---

## Fase 1 — v1.1.0: B-drag (bug drag-to-dismiss)

**Rama:** `main` (hotfix)  
**Tamaño:** pequeño, ~1 sesión  
**Versión:** v1.1.0

### Qué hay que hacer
El `.mhandle` (tirador de cierre de modales) existe en el HTML pero el gesto táctil no está implementado.  
Hay que añadir los event listeners de `touchstart` / `touchmove` / `touchend` en todos los modales `.modal` y overlays fullscreen.

### Criterio de "done"
- [ ] Funciona en iOS Safari (PWA instalada)
- [ ] Funciona en Android Chrome (PWA instalada)
- [ ] No rompe el cierre con tap en el backdrop
- [ ] No interfiere con el scroll interno del modal
- [ ] CACHE_VERSION bumpeada
- [ ] Los 4 documentos entregados

### Riesgos
- El scroll interno del modal puede interferir con el drag. Solución: detectar si el scroll está en el top antes de activar el dismiss.

---

## Fase 2 — v2.0.0: Marcador en vivo

**Rama:** `v2-live` → merge a `main` cuando esté listo  
**Tamaño:** mediano-grande, ~4-6 sesiones  
**Versión:** v2.0.0

### Qué hay que hacer
La rama `v2-live` ya tiene el marcador live implementado parcialmente (parte de index.html v1.8.24). Hay que:

1. **Revisar el estado actual de `v2-live`** — ver qué está implementado y qué falta.
2. **Validar flujo FIBA 2024:**
   - Faltas personales por jugador (límite 5 → exclusión)
   - Faltas de equipo por cuarto (límite 4 → bonus/doble bonus)
   - Tiempos muertos (2 en primera mitad, 3 en segunda, 1 en prórroga)
   - Quinteto en pista: 5 jugadores activos
   - Sustituciones durante T.M. o dead ball
3. **Migración de datos de `matches`** — v2 añade campos nuevos al objeto de partido (eventos live, quinteto, TMs usados). Necesita función de migración automática.
4. **Validación en dispositivo real** — iOS + Android, partido completo.

### Criterio de "done"
- [ ] Scoreboard live funciona en iOS Safari y Android Chrome
- [ ] Faltas FIBA 2024 correctas (personal + equipo + bonus)
- [ ] Tiempos muertos contados correctamente
- [ ] Quinteto visible y editable durante el partido
- [ ] Migración automática de `matches` existentes sin pérdida de datos
- [ ] No hay regresiones en el resto de la app (asistencias, estadísticas, export)
- [ ] Probado en partido real o simulación completa
- [ ] CACHE_VERSION bumpeada
- [ ] Los 4 documentos entregados

### Riesgos
- Complejidad de la lógica de faltas FIBA. Mitigar: implementar con prompts explícitos al entrenador, no auto-decidir.
- El estado del partido en v2-live puede haber divergido de main. Primera tarea: diff y alineación.

---

## Fase 3 — v3.0.0: Firebase

**Rama:** `v3-firebase` (nueva, basada en el main post-v2)  
**Tamaño:** grande, ~6-10 sesiones  
**Versión:** v3.0.0

### Prerequisitos
- [ ] v2.0.0 publicada y estable (la estructura de datos de partidos live debe estar definida antes de migrar a Firestore)
- [ ] Decisión Firebase confirmada (Fase 0)
- [ ] Cuenta Firebase configurada y proyecto creado

### Qué hay que hacer

#### 3.1 Setup Firebase
- Crear proyecto en Firebase Console
- Activar Firestore (o Realtime DB según decisión)
- Configurar autenticación (mínimo: anónimo + Google)
- Definir reglas de seguridad básicas

#### 3.2 Capa de abstracción de datos
Crear un módulo JS dentro del `index.html` que abstraiga el storage:
```js
// En lugar de llamar directamente a localStorage:
// storage.get('cbj:p') → jugadores
// storage.set('cbj:p', data)
// La implementación puede ser localStorage o Firebase según cfg
```
Esto permite la transición gradual y facilita tests manuales.

#### 3.3 Migración de localStorage a Firestore
- Función de migración one-shot al primer login
- Subir todos los datos existentes (`cbj:t`, `cbj:p`, `cbj:s`, `cbj:m`, `cbj:ev`, `cbj:cfg`) a Firestore
- Mantener localStorage como fallback offline

#### 3.4 Autenticación
- Login mínimo viable: Google (un tap en móvil)
- Opción sin cuenta para quien no quiera crear perfil (modo local, sin sync)
- Lógica: si no hay sesión → localStorage solamente; si hay sesión → Firestore + sync

#### 3.5 Multiusuario (scope mínimo para v3)
- Un club, un administrador (el entrenador), puede invitar a otros (asistentes, stats)
- Los invitados pueden ver pero no modificar (permisos básicos)
- El share por WhatsApp puede convertirse en un enlace de visualización

#### 3.6 Modo offline en PWA
- Firestore tiene persistencia offline nativa para web — activarla
- Cola de escrituras cuando no hay conexión, sync al reconectar

### Criterio de "done"
- [ ] Login con Google funciona en iOS y Android
- [ ] Todos los datos migran de localStorage a Firestore sin pérdida
- [ ] La app funciona offline y sincroniza al reconectar
- [ ] Un segundo dispositivo con la misma cuenta ve los mismos datos
- [ ] Modo sin cuenta (localStorage) sigue funcionando para quien no quiera Firebase
- [ ] Reglas de seguridad en Firestore: usuario solo accede a sus propios datos
- [ ] CACHE_VERSION bumpeada
- [ ] Los 4 documentos entregados + nuevo documento de arquitectura Firebase

### Riesgos
| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| Complejidad del modelo de datos Firestore | Alta | Diseñar el modelo antes de escribir código (Fase 0) |
| Romper localStorage para usuarios sin cuenta | Media | La capa de abstracción (3.2) lo previene |
| Coste Firebase por lecturas/escrituras | Baja | Plan Spark (gratuito) es suficiente para un club |
| Reglas de seguridad permisivas | Media | Revisar con el simulador de Firestore antes de publicar |
| Compatibilidad iOS PWA con Firebase Auth | Media | Probar early con Google Sign-In en Safari iOS |

---

## Calendario tentativo

| Mes | Fase | Hito |
|---|---|---|
| Junio 2026 | 0 + 1 | Decisión Firebase tomada + v1.1.0 publicada |
| Julio 2026 | 2 (primera mitad) | v2-live revisada y en pruebas |
| Agosto 2026 | 2 (final) + 3 (inicio) | v2.0.0 publicada + setup Firebase |
| Septiembre 2026 | 3 | v3.0.0 publicada |

> El calendario es orientativo. Si v2 es más compleja de lo esperado, v3 se pospone.  
> Más vale v2.0.0 sólida que v3.0.0 con deuda técnica.

---

## Sesión de inicio de cualquier fase

Al empezar una sesión de trabajo en Cowork, decir:

> *"Vamos a trabajar en [v1.1 / v2 / v3]. Aquí está el index.html actual: [pegar archivo]"*

Claude leerá el archivo antes de hacer cualquier cambio.

---

## Estado de este documento

Creado: 2026-06-08  
Actualizar cuando: se completa una fase, cambia la decisión de Firebase, o aparece un nuevo riesgo relevante.
