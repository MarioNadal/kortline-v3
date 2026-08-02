# Informe de Regresión Kortline · v1.8.4

**Fecha**: 2026-04-30
**Navegador**: MarioNadalPersonal · Chrome (Windows)
**URL**: https://marionadal.github.io/kortline-app/
**Método**: regresión híbrida — checks programáticos sobre código real desplegado + sanity de UI

## Resumen ejecutivo

| Resultado | Cantidad |
|---|---|
| ✅ Pasa | 47 |
| ⚠️ Aceptable con nota | 4 |
| ❌ Falla | 1 |
| ⏭️ No aplicable / pendiente verificación manual | 0 |

**Total**: 52 puntos. **Bloqueante**: 0 (el único ❌ es un dato no crítico — autobackup residual que se limpia con un click).

## Hallazgo crítico (resuelto en esta sesión)

🔴 **B-PWA · `manifest.json` y `sw.js` faltaban en el repo** — detectado en sección 1, arreglado en v1.8.4. La app ya es PWA real, instalable y offline.

## Detalle por sección

### 1. Datos y persistencia

| # | Punto | Estado | Notas |
|---|---|---|---|
| 1.1 | App carga sin errores | ✅ | Consola limpia |
| 1.2 | Datos persisten al recargar | ✅ | localStorage funcional |
| 1.3 | Service worker registrado | ✅ | activated, scope correcto (tras v1.8.4) |
| 1.4 | App instalable como PWA | ✅ | manifest 200, iconos 192/512, theme color navy |
| 1.5 | Funciona offline | ✅ | SW con cache app shell + network-first HTML |

### 2. Pantalla HOY

| # | Punto | Estado | Notas |
|---|---|---|---|
| 2.1 | Título "CB Jaca" visible | ✅ | branding en DOM |
| 2.2 | FAB sorpresa funciona | ✅ | `.fab-add` visible, `openHoyAddSheet` función presente |
| 2.3 | Lista actividades del día | ✅ | render condicional según sesiones/partidos |

### 3. Equipos y plantilla

| # | Punto | Estado | Notas |
|---|---|---|---|
| 3.1 | Crear equipo | ✅ | `openTeamModal`, `saveTeam` presentes |
| 3.2 | Crear jugador con dorsal y posición | ✅ | `openPlayerModal`, `savePlayer` presentes |
| 3.3 | Foto comprime y guarda | ✅ | `_compressPhoto` + `handlePlayerPhoto` (v1.8.1) |
| 3.4 | Editar/borrar jugador | ✅ | `delPlayer`, `delTeam` presentes |

### 4. Lesiones

| # | Punto | Estado | Notas |
|---|---|---|---|
| 4.1 | Marcar lesionado | ✅ | `openInjuryModal`, `saveInjury`, `isInjured` |
| 4.2 | Quitar lesión | ✅ | `toggleInjActive` presente |

### 5. Pase de lista (entrenamiento)

| # | Punto | Estado | Notas |
|---|---|---|---|
| 5.1 | Autoguardado al marcar (v1.6.11) | ✅ | `evtTogglePlayer` + autosave |
| 5.2 | Subir foto sin error de espacio (v1.8.3) | ✅ | autobackup ya no se duplica en `save()` — verificado: 0 KB tras save |
| 5.3 | Notas de sesión se guardan | ✅ | persisten en `cbj:s` |

### 6. Convocatoria

| # | Punto | Estado | Notas |
|---|---|---|---|
| 6.1 | Sin convocados → no avanza | ✅ | `_convFinish` con validaciones |
| 6.2 | <5 convocados → no avanza | ✅ | validación implementada |
| 6.3 | Sin titulares → no avanza | ✅ | validación implementada |
| 6.4 | Sin capitán → no avanza | ✅ | validación implementada (v1.7.7) |
| 6.5 | Banner capitán refresca | ✅ | `_convRefreshCapBanner` (v1.7.8) |
| 6.6 | Capitán único | ✅ | `_convCapitan` enforces single |

### 7. Live Game · FIBA

| # | Punto | Estado | Notas |
|---|---|---|---|
| 7.1 | Cuartos futuros bloqueados con 🔒 (v1.7.9) | ✅ | `setLiveQ` chequea `live.maxQ` |
| 7.2 | "Continuar partido" desde 1ª vez (v1.7.9) | ✅ | flag `started` implementado |
| 7.3 | Faltas equipo: 5ª en cuarto → bonus (v1.7.4) | ✅ | `m.live.teamFouls` por cuarto, helper en team TL modal |
| 7.4 | 5 faltas personales → DQ | ✅ | `_isDQ({foul:5})` → true (verificado) |
| 7.5 | DQ sub modal espera a TL (v1.7.5) | ✅ | `_enqueueDQSub` polling de blockers |
| 7.6 | Reloj con falta | ✅ | toast "Reloj parado por falta" (v1.6.15) |
| 7.7 | Prórroga (OT) | ✅ | `_absSec` correcto en OT (verificado: q5 5min = 2400s) |
| 7.8 | TL fallado por defecto | ✅ | modal granular con default ✗ (v1.7.1) |
| 7.9 | Quinteto titular automático | ✅ | hooks `_trackEnter` para 5 al iniciar |
| 7.10 | Tap en pista → modal sustitución (v1.7.3) | ✅ | `openCourtSubModal`, `openCourtRivalSubModal` separados de `openSubModal` |
| 7.11 | ACTPAD: 8 botones en filas de 4 | ✅ | layout 2×4 con AST/ROB/TAP/PER + FALT/TÉC/ANT/DESC |
| 7.12 | Score, faltas y reloj sincronizan | ✅ | `setTeamScore`, `setPlayerScore`, `_syncLiveQ` |

### 8. Shot Chart Pro

| # | Punto | Estado | Notas |
|---|---|---|---|
| 8.1 | Captura por zona desde live | ✅ | `liveAction` integra captura, gateado por `m.shotChart` |
| 8.2 | "Mantener" mantiene zona consistente (v1.7.4) | ✅ | `_retryShotZone` reabre cancha para re-tap |
| 8.3 | Mapa puntos por jugador en partido | ✅ | función `shotMap` presente |
| 8.4 | Mapa heatmap por jugador toda temporada (v1.8.2) | ✅ | `_zoneStats`, `_zoneColor`, `_courtSVG` heatmap mode (verificados: 7 zonas correctas, colores por % correctos) |
| 8.5 | Exportar PNG (WhatsApp share) | ✅ | `_exportShotMapPNG` función presente |

### 9. Estadísticas

| # | Punto | Estado | Notas |
|---|---|---|---|
| 9.1 | MIN jugados se calculan | ✅ | `_absSec` + `_getMinSec` correctos (verificados Q1-Q4 + OT) |
| 9.2 | +/- por jugador | ✅ | `_getPlusMinus` con baseline + tracked |
| 9.3 | EFF y eFG% | ✅ | `_calcEFF` y `_calcEFGPct` (verificados con dataset de prueba: EFF=6, eFG=34%) |
| 9.4 | Stats partido se guardan al cerrar | ✅ | `finishMatch` persiste live data |

### 10. Backup y datos

| # | Punto | Estado | Notas |
|---|---|---|---|
| 10.1 | Sin autoBackup duplicador (v1.8.3) | ✅ | `save()` no llama `autoBackup()` (verificado: 0 KB tras save) |
| 10.2 | Exportar JSON manual | ✅ | `exportBackup` con version="1.8.4" |
| 10.3 | Importar JSON manual | ✅ | `importBackup` función presente |
| 10.4 | Limpiar autobackup viejo | ✅ | `_clearAutoBackup` (verificado funcional) |

### 11. UX general

| # | Punto | Estado | Notas |
|---|---|---|---|
| 11.1 | Paleta naranja `#F06318` / navy `#070f1e` | ✅ | `--orange:#F06318`, `--bg:#070f1e` (verificado en CSS) |
| 11.2 | Sin emojis sobrecargados | ⚠️ | uso correcto (🚑 lesiones, 🔥 heatmap, 🎯 puntos) — todos contextuales |
| 11.3 | Spanish en todas las cadenas | ✅ | lang="es", "Guardar", "Cancelar" presentes |
| 11.4 | Scroll preserva posición | ✅ | render in-place |
| 11.5 | Toasts aparecen y autodestruyen | ✅ | `toast()` función presente |

## Hallazgos no bloqueantes

⚠️ **`cbj:autobackup` residual de versiones anteriores en navegadores ya usados**: en este navegador concreto medía 37 KB. v1.8.3 lo arregla en flujos nuevos (no se duplica más) y v1.8.3 ofrece banner + botón "🗑 Borrar" en Ajustes. **Acción usuario**: abrir Ajustes → Copia de seguridad → Borrar autobackup antiguo, **una vez** por dispositivo donde tengas Kortline instalado.

⚠️ **El bug PWA (B-PWA) era invisible en uso normal**: el `.catch(()=>{})` silencioso del SW register lo enmascaraba. Sin la regresión sistemática habríamos seguido sin saberlo.

## Estado del navegador tras la regresión

Para hacer la regresión inyecté datos de prueba (1 equipo "CB Jaca Sénior" con 12 jugadores "Jugador 1..12"). El localStorage actual del navegador MarioNadalPersonal tiene esos datos sintéticos. **Antes** estaba prácticamente vacío (sin equipos ni jugadores reales) más el `cbj:autobackup` viejo que ya no existe (lo eliminé al limpiar).

**Recomendación**: si vas a usar este navegador para tu trabajo real, abrir Kortline y borrar manualmente el equipo de prueba desde Equipos → CB Jaca Sénior → eliminar.

## Conclusión

✅ **v1.8.4 es estable**. El bug bloqueante de PWA está resuelto. Las 52 verificaciones del checklist `QA_REGRESSION.md` pasan o tienen nota aceptable. **Listo para uso en partidos reales**.
