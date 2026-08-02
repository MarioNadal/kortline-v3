# QA Regresión Kortline

Checklist de features críticas que **no pueden romperse** entre versiones. Se ejecuta antes de cerrar cada release. Si algún punto falla → bloqueante, no se sube hasta arreglar.

**Cómo usarlo**
- Antes de subir una nueva versión, Claude (o Mario) recorre la lista en Chrome con la URL desplegada.
- Marcar cada punto: ✅ pasa / ❌ falla / ⚠️ degradado / ⏭️ no aplica.
- Si hay fallos, anotar bug ID y arreglar antes de release.
- Después de release, repetir 1 vez más en producción.

**Versión última auditada**: v1.8.5 · 2026-04-30

---

## 1. Datos y persistencia

| # | Verificación | Cómo probar | Estado |
|---|---|---|---|
| 1.1 | App carga sin errores en consola | F12 → Console → recargar. No errores rojos. | ☐ |
| 1.2 | Datos persisten al recargar | Crear jugador → recargar → sigue ahí. | ☐ |
| 1.3 | Service worker registrado | F12 → Application → Service Workers → activated. | ☐ |
| 1.4 | App instalable como PWA | Chrome → menú → Instalar Kortline → se instala. | ☐ |
| 1.5 | Funciona offline | DevTools → Network → Offline → recargar → app carga. | ☐ |

## 2. Pantalla HOY

| # | Verificación | Cómo probar | Estado |
|---|---|---|---|
| 2.1 | Título "CB Jaca" visible arriba | Abrir HOY. | ☐ |
| 2.2 | FAB sorpresa funciona | Tap FAB naranja → muestra actividad random. | ☐ |
| 2.3 | Lista de actividades del día se muestra | Si hay entrenos/partidos hoy → aparecen. | ☐ |

## 3. Equipos y plantilla

| # | Verificación | Cómo probar | Estado |
|---|---|---|---|
| 3.1 | Crear equipo | Equipos → + → guardar → aparece. | ☐ |
| 3.2 | Crear jugador con dorsal y posición | Plantilla → + → guardar → aparece con dorsal. | ☐ |
| 3.3 | Foto de jugador se comprime y guarda | Editar jugador → subir foto → sin error de espacio (v1.8.1). | ☐ |
| 3.4 | Editar/borrar jugador | Funciona y persiste. | ☐ |

## 4. Lesiones

| # | Verificación | Cómo probar | Estado |
|---|---|---|---|
| 4.1 | Marcar jugador como lesionado | Aparece icono 🚑 y se excluye de pase de lista. | ☐ |
| 4.2 | Quitar lesión | El jugador vuelve disponible. | ☐ |

## 5. Pase de lista (entrenamiento)

| # | Verificación | Cómo probar | Estado |
|---|---|---|---|
| 5.1 | **Autoguardado al marcar asistencia** (v1.6.11) | Marcar jugador → recargar → sigue marcado. | ☐ |
| 5.2 | Subir foto en entrenamiento sin error de espacio (v1.8.3) | Crear sesión → subir foto → guarda OK. | ☐ |
| 5.3 | Notas de sesión se guardan | Escribir nota → recargar → persiste. | ☐ |

## 6. Convocatoria de partido

| # | Verificación | Cómo probar | Estado |
|---|---|---|---|
| 6.1 | **Validación: sin convocados → no avanza** | Pulsar Confirmar sin marcar a nadie → toast error. | ☐ |
| 6.2 | **Validación: <5 convocados → no avanza** | Marcar 4 → Confirmar → toast error. | ☐ |
| 6.3 | **Validación: sin titulares → no avanza** | Marcar convocados pero ningún titular → toast error. | ☐ |
| 6.4 | **Validación: sin capitán → no avanza** | Sin asignar (C) → Confirmar → toast error. | ☐ |
| 6.5 | **Banner capitán refresca al cambiar (v1.7.8)** | Asignar capitán → cambiar a otro → banner se actualiza. | ☐ |
| 6.6 | Capitán único | No se pueden tener 2 capitanes simultáneos. | ☐ |

## 7. Live Game · FIBA

| # | Verificación | Cómo probar | Estado |
|---|---|---|---|
| 7.1 | **Cuartos futuros bloqueados con 🔒 (v1.7.9)** | Empezar partido → Q2/Q3/Q4 grises con candado. | ☐ |
| 7.2 | **"Continuar partido" funciona desde la 1ª vez (v1.7.9)** | Cerrar partido en curso → reabrir → continúa donde estaba. | ☐ |
| 7.3 | **Faltas equipo: 5ª en cuarto → bonus** (v1.7.4) | Acumular 5 faltas equipo → siguiente falta = 2TL. | ☐ |
| 7.4 | **5 faltas personales → DQ automático** | Jugador con 5 faltas → sale forzosamente. | ☐ |
| 7.5 | **DQ sub modal espera a TL** | Si DQ ocurre durante TL → modal sub aparece después. | ☐ |
| 7.6 | **Reloj con falta** | Falta personal en últimos 2 min Q4 → 2TL. | ☐ |
| 7.7 | **Prórroga (OT)** | Empate al final de Q4 → opción de OT. | ☐ |
| 7.8 | **TL fallado por defecto** | Modal TL → primer toque NO es anotar, es fallar. | ☐ |
| 7.9 | **Quinteto titular automático al iniciar** | Pulsar Iniciar partido → 5 titulares en pista. | ☐ |
| 7.10 | **Tap en jugador en pista → modal sustitución** | Tap card en pista → opciones de cambio (no "ENTRA"). | ☐ |
| 7.11 | **ACTPAD: 8 botones en filas de 4** (v1.7.x) | AST/ROB/TAP/PER + FALT/TÉC/ANT/DESC visibles. | ☐ |
| 7.12 | **Score, faltas y reloj se sincronizan** | Anotar canasta → marcador sube → persiste al recargar. | ☐ |
| 7.13 | **Confirmación al cambiar a cuarto pasado (v1.8.5)** | En Q3, tocar pestaña Q1 → modal "¿Editar Q1?" → Cancelar mantiene Q3. | ☐ |
| 7.14 | **Toast al cruzar 5ª falta equipo (v1.8.5)** | Hacer 5 faltas equipo en un cuarto → toast "🚨 BONUS activo" una sola vez. | ☐ |
| 7.15 | **Modo rápido omite chainings (v1.8.5)** | Activar toggle en Ajustes → anotar canasta → NO pregunta asistencia. | ☐ |
| 7.16 | **Selector equipo con dot color + abreviatura (v1.8.5)** | Live con rival → toggle muestra punto de color y abreviatura/_teamShort. | ☐ |

## 8. Shot Chart Pro

| # | Verificación | Cómo probar | Estado |
|---|---|---|---|
| 8.1 | **Captura por zona desde live** (v1.7.x) | Anotar canasta → tap zona en cancha → guarda con coords. | ☐ |
| 8.2 | **"Mantener" mantiene zona consistente** (v1.7.4) | Reabrir cancha → coords coinciden con valor. | ☐ |
| 8.3 | **Mapa puntos por jugador en partido** | Stats jugador en partido → pestaña Shot Chart. | ☐ |
| 8.4 | **Mapa heatmap por jugador toda temporada** (v1.8.2) | Stats globales jugador → heatmap con %. | ☐ |
| 8.5 | **Exportar PNG (WhatsApp share)** (v1.8.2) | Pulsar exportar → comparte PNG nativo si soporta. | ☐ |

## 9. Estadísticas

| # | Verificación | Cómo probar | Estado |
|---|---|---|---|
| 9.1 | **MIN jugados se calculan correctamente** (v1.8.0) | Jugador 5 min en pista → MIN ≈ 5:00. | ☐ |
| 9.2 | **+/- por jugador** (v1.8.0) | Mientras está en pista → +/- refleja diferencia. | ☐ |
| 9.3 | **EFF y eFG%** (v1.8.0) | Stats panel → EFF y eFG% calculados. | ☐ |
| 9.4 | **Stats partido se guardan al cerrar** | Cerrar partido → reabrir stats → datos correctos. | ☐ |

## 10. Backup y datos

| # | Verificación | Cómo probar | Estado |
|---|---|---|---|
| 10.1 | **Sin autoBackup duplicador (v1.8.3)** | Settings → ver tamaño de `cbj:autobackup` ≈ 0 o no existe. | ☐ |
| 10.2 | **Exportar JSON manual** | Settings → Exportar → descarga .json válido. | ☐ |
| 10.3 | **Importar JSON manual** | Settings → Importar → restaura datos. | ☐ |
| 10.4 | **Limpiar autobackup viejo (v1.8.3)** | Settings → botón limpiar → libera espacio. | ☐ |

## 11. UX general

| # | Verificación | Cómo probar | Estado |
|---|---|---|---|
| 11.1 | Paleta naranja `#F06318` / navy `#070f1e` consistente | Sin colores raros. | ☐ |
| 11.2 | No emojis sobrecargados | Solo los del diseño definido. | ☐ |
| 11.3 | Spanish en todas las cadenas | Sin "Save" o "Cancel" en inglés. | ☐ |
| 11.4 | Scroll preserva posición tras updates | Editar jugador en lista larga → vuelve al mismo punto. | ☐ |
| 11.5 | Toasts aparecen y se autodestruyen | Acciones disparan toast verde/rojo. | ☐ |

---

## Protocolo de release

1. **Ejecutar regresión en local** (`/Kortline/index.html` con server simple).
2. **Subir a GitHub Pages** con commit semántico.
3. **Repetir regresión en URL de producción** con Chrome MCP.
4. **Si todo ✅ → cerrar versión** entregando index.html + README.md + MANUAL_USUARIO_KORTLINE.md.
5. **Si algún ❌ → bug bloqueante**, no se considera release.

## Cómo añadir nuevos puntos

Cada vez que se cierre un bug que **podría reintroducirse**, añadir aquí una fila con la versión que lo arregló entre paréntesis. Así crece el escudo contra regresiones.

---

*Kortline · QA Regresión · Hecho con 🧡 para CB Jaca*
