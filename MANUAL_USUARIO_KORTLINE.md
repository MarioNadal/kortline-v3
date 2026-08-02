# Kortline — Manual de Usuario

**Versión 1.0.0** · _De la pista al dato_

> 🏀 Kortline es la PWA del **CB Jaca** para gestionar asistencia, partidos y estadísticas avanzadas desde el banquillo. Funciona offline en cualquier móvil, no necesita servidor y todos los datos viven en tu navegador. Diseño dark, mobile-first, paleta naranja `#F06318` y navy `#070f1e`.

---

## Tabla de contenidos

1. [Bienvenida y filosofía](#1-bienvenida-y-filosofía)
2. [Primeros pasos](#2-primeros-pasos)
3. [Pantalla HOY](#3-pantalla-hoy)
4. [Gestión de equipos y plantilla](#4-gestión-de-equipos-y-plantilla)
5. [Lesiones 🚑](#5-lesiones-)
   - 5.5 [Incidencias ⚠️](#55-incidencias-️)
6. [Pase de lista (entrenamiento)](#6-pase-de-lista-entrenamiento)
7. [Día de partido](#7-día-de-partido)
8. [Shot Chart](#8-shot-chart)
9. [Estadísticas](#9-estadísticas)
10. [Backup y datos](#10-backup-y-datos)
11. [Tips Pro](#11-tips-pro)
12. [Resolución de problemas](#12-resolución-de-problemas)

---

## 1. Bienvenida y filosofía

Kortline cubre el ciclo completo de un equipo de baloncesto amateur:

- **Diario**: pase de lista, valoraciones, ejercicios.
- **Semanal**: convocatorias, calendario.
- **Partido**: convocatoria, resultado por cuartos editable, estadísticas post-partido.
- **Temporada**: stats agregadas, riesgo FEB.
- **Compartir**: WhatsApp, exportar PDF/Excel, JSON de backup.

Todo en un **único archivo HTML** que vive en tu móvil. Sin servidor. Sin cuentas. Tus datos son tuyos.

---

## 2. Primeros pasos

### 2.1 Instalación como app

Kortline funciona desde el navegador, pero te recomendamos instalarla como PWA para acceso rápido y modo offline:

| Sistema | Cómo |
|---------|------|
| **iOS** (Safari) | Compartir → **Añadir a pantalla de inicio** |
| **Android** (Chrome) | Menú ⋮ → **Añadir a pantalla de inicio** o **Instalar aplicación** |

La primera vez que abras Kortline en cada plataforma verás un pop-up con el paso a paso.

> **🆕 v1.8.4 · Modo offline real.** Tras abrir Kortline una vez con red, la app queda cacheada en el dispositivo. Si en el banquillo no hay cobertura, recargar sigue funcionando: el partido en vivo, el pase de lista y los datos guardados están disponibles offline. La app se actualiza sola cuando vuelves a tener red.

> **📱 Orientación del móvil.** Kortline está pensada en vertical para todas sus pantallas. Si giras el móvil verás un overlay 📱 "Pon el móvil en vertical" — vuelve a vertical y todo continúa donde lo dejaste.

### 2.2 Configuración del club

Pulsa el **logo** arriba a la izquierda para abrir ⚙️ **Ajustes del club**.

| Campo | Para qué |
|-------|----------|
| **Logo** | Imagen personalizada del club (recomendado: cuadrado, fondo transparente) |
| **Nombre del club** | Aparece en encabezados, mensajes, exports y como **título de HOY** (v1.6.12) |
| **Abreviatura** | Versión corta para WhatsApp (`CB JACA`) |
| **Lema / cierre** | Texto opcional al final de las convocatorias (`¡Vamos FamiliaCBJaca! 🏀`) |
| **Umbral riesgo FEB** | % de asistencia mínimo (estándar 75%) |

### 2.3 Seguimiento avanzado del entrenamiento

Sección **🎯 Seguimiento avanzado** con 4 toggles. Activa solo lo que vas a usar — cuanto menos, más rápido el pase de lista:

| Toggle | Para qué |
|--------|----------|
| 📋 **Ejercicios de la sesión** | Campo libre para anotar el plan del día |
| 📷 **Foto del entrenamiento** | Una foto por sesión (con compresión adaptativa, v1.8.1) |
| ⭐ **Valoración colectiva** | Puntúa 1-10 cómo ha entrenado el equipo |
| 👤 **Valoración individual** | Puntúa 1-10 ★ a cada jugador presente |

> 💡 Si activas las dos valoraciones, la colectiva se calcula **automáticamente** como media de las individuales (v1.6.8). Mantén pulsado ✏️ ~1s para editar manual.

---

## 3. Pantalla HOY

La pantalla de inicio. Muestra solo lo del día actual.

```
┌─────────────────────────────────────┐
│ [logo]  CB JACA          [N HOY]    │   ← v1.6.12
│         Hoy · sábado, 25 abril       │
├─────────────────────────────────────┤
│                                     │
│  🏀 PARTIDOS                        │
│  ┌─────────────────────────────┐    │
│  │ Sénior  vs  Bilbao          │    │
│  │ 20:00 · 🟢 Casa             │    │
│  │ [✏️ Anotar partido] [📋]    │    │
│  └─────────────────────────────┘    │
│                                     │
│  🏋️ ENTRENAMIENTOS                  │
│  ┌─────────────────────────────┐    │
│  │ Sub-16 · 19:30      Pasada  │    │
│  │ 92% · 12 PRES · 0 AUSE      │    │
│  │ [✏️ Editar lista]    [📤]   │    │
│  └─────────────────────────────┘    │
│                                     │
│                            ┌─────┐  │   ← FAB v1.6.12
│                            │  +  │  │
│  [🏠 HOY] [👥 EQ] [📊 STATS] └─────┘  │
└─────────────────────────────────────┘
```

### 3.1 Título con el nombre del club

Si tu club no es "Kortline" en Ajustes, el título grande del header pasa a ser **el nombre del club** y la fecha queda en sub-línea. Si no, "Hoy · fecha".

### 3.2 Botón ➕ flotante (FAB) — actividad sorpresa

Esquina inferior derecha. Para crear actividades **fuera del horario habitual** del equipo:

- 🏋️ **Entrenamiento sorpresa** — refuerzos, sesiones extra, recuperaciones. Lleva al pase de lista de hoy.
- 🏆 **Partido sorpresa** — amistosos, copa, calendario fuera de liga. Abre el modal de crear partido con fecha = hoy.

Si tienes un solo equipo, salta directo. Si tienes varios, picker con flecha ← para volver al menú principal.

---

## 4. Gestión de equipos y plantilla

### 4.1 Crear un equipo

**Equipos** → **＋**:

- **Nombre** — se guarda siempre en MAYÚSCULAS aunque escribas en minúsculas (v1.6.9).
- **Categoría** — afecta a defaults: nº de cuartos, duración, "reloj se para con falta" (sénior/junior/cadete = ON, 3x3 = OFF).
- **Entrenador/es** — uno o varios.
- **Días + horarios** — escribe la hora y el día se marca solo (v1.6.1).
- **Color** — paleta oficial Kortline para el equipo.

### 4.2 Plantilla de jugadores

Dentro del equipo → **＋ Añadir jugador**.

| Campo | Notas |
|-------|-------|
| **Foto/avatar** | Opcional; aparece junto al dorsal en plantilla y pase de lista |
| **Nombre** | Si empieza con inicial (`I. Javier Rodríguez`), el cortado en cards muestra "Javier" no "I." (v1.6.15) |
| **Dorsal** | Botones `−/+` para ajustar con el pulgar; sugerencia automática del próximo libre |
| **Posición** | Texto libre |
| **Notas** | Texto libre |

Los jugadores se ordenan por **dorsal ascendente**; los sin número van al final.

### 4.3 Acciones por fila de jugador

Cada fila tiene cuatro botones:

- ✏️ **Editar** — datos básicos (foto, nombre, dorsal, posición, notas).
- 🚑 **Lesión** — gris si sano, rojo si lesionado (ver sección 5).
- ⚠️ **Incidencias** — gris si no tiene ninguna, ámbar con contador si tiene (ver sección 5.5, rama `feat/incidencias-jugador`).
- 🗑 **Eliminar** — pide confirmación.

---

## 5. Lesiones 🚑

Flujo dedicado para que el % de asistencia no penalice al lesionado y el historial quede completo.

### 5.1 Dar de baja

Pulsa **🚑** en un jugador sano. Modal **Nueva lesión**:

1. **Fecha de inicio** — por defecto hoy.
2. **Origen** — chips rápidos: 🏀 Entreno · 🏆 Partido · 🌐 Fuera · ❔ Desconocido. Si entreno o partido, dropdown con las 24 sesiones más recientes.
3. **Notas** — tipo, zona, semanas estimadas.

Al guardar:
- Punto rojo animado sobre el dorsal en plantilla y pase de lista.
- Badge `🚑 10/04 (6d)` en la fila (formato compacto, v1.6.7).
- **Backfill automático**: las sesiones desde la fecha de inicio quedan auto-justificadas con motivo `🤕 Lesión` y etiqueta `AUTO`.
- **Snapshot FEB**: se congela el % de asistencia previo. Si ya estaba en riesgo, sigue apareciendo en alertas con su % congelado.

### 5.2 Estado lesionado en el pase de lista

- Junto al nombre aparece 🚑.
- El estado se marca como `Excused` con motivo `🤕 Lesionado/a` y etiqueta gris `AUTO`.
- Solo se muestra como lesionado en fechas **iguales o posteriores** a la fecha de inicio (v1.6.7 · `isInjuredOn`).

### 5.3 Dar de alta

Pulsa **🚑** en un lesionado. Mini-modal con resumen (días, origen, nota) y tres acciones:

- ✅ **Dar de alta médica** — un solo toque. Hoy queda como fecha de alta.
- ✏️🚑 **Editar datos de la lesión**.
- **Cerrar**.

Tras el alta:
- Backfill final hasta la fecha del alta.
- Lesión archivada en `injuryHistory[]` con start, end, días, origen, etc.
- El jugador vuelve a estar sano y entra de nuevo en el cómputo normal de asistencia.

### 5.4 Historial de lesiones

Dentro del modal de jugador, un panel desplegable muestra el histórico (cuántas, días totales, orígenes). Útil para detectar patrones.

### 5.5 Incidencias ⚠️

Registro de normas incumplidas (puntualidad, material, actitud, convivencia...), separado de Lesiones — esto es disciplinario, no médico. Basado en el sistema de escalado de `Mandamientos_CBJaca_2026-2027.docx`.

**Ver incidencias / añadir una nueva**

Pulsa **⚠️** en la fila del jugador. Se abre la lista de incidencias del jugador (vacía la primera vez) con un botón **⚠️ Nueva incidencia**.

**Registrar una incidencia**

1. **Fecha** — por defecto hoy.
2. **Categoría** — chips: ⏰ Puntualidad · 🎒 Material · 😤 Actitud · 🤝 Convivencia · ❔ Otro.
3. **Qué norma se incumplió** — texto libre corto.
4. **Consecuencia aplicada** — viene prerrellenada automáticamente según el nivel de escalado del jugador, y es editable:
   - **1ª vez** → aviso verbal directo del entrenador.
   - **2ª vez** → aviso a la familia + reducción de minutos en el siguiente partido.
   - **3ª vez** → banquillo en el siguiente partido + reunión con jugador y familia.
   - **Reincidencia grave** → se valora la continuidad con dirección deportiva.

El nivel se calcula solo contando las incidencias previas del jugador — no hace falta indicarlo a mano.

**Editar o borrar**

Desde la lista de incidencias, cada tarjeta tiene ✏️ Editar y 🗑 Borrar. Editar permite corregir fecha, categoría, nota o consecuencia sin cambiar el nivel ya asignado (para no romper el histórico de escalado). Borrar pide confirmación.

**Pendiente:** vista de repaso semanal del equipo y MVP semanal — todavía no implementado en esta rama.

---

## 6. Pase de lista (entrenamiento)

Pantalla a la que vas desde HOY → **📋 Pasar lista** o desde un equipo.

```
┌─────────────────────────────────────┐
│ ←  Pase de Lista          [📤]      │
│    SÉNIOR TEST                       │
├─────────────────────────────────────┤
│  ‹  lun, 27 abr  ›    [HOY]          │
├─────────────────────────────────────┤
│  ┌─PRES─┐ ┌─AUSE─┐ ┌─TARD─┐ ┌─JUST─┐ │   ← contadores
│  │  10  │ │   1  │ │   1  │ │   2  │ │     clicables (filtro)
│  └──────┘ └──────┘ └──────┘ └──────┘ │
│                                     │
│  ↺ Resetear a presentes  (si hay cambios)
│                                     │
│  ┌─#4 Carlos    ✓ Presente    [✓] ─┐│
│  │ #5 Diego     ✗ Ausente     [✗] ││
│  │ #6 Eva 🚑    ◎ Justificado [◎] ││
│  │ ...                             ││
│  └─────────────────────────────────┘│
│                                     │
│  📋 Ejercicios del entrenamiento     │
│  📝 Notas del entrenador             │
│                                     │
│  ┌────────────────────────┐ ┌─────┐ │
│  │ 💾 Autoguardado activo │ │ 📤  │ │
│  └────────────────────────┘ └─────┘ │
└─────────────────────────────────────┘
```

### 6.1 Estados de asistencia

Toca el botón derecho de cada jugador para ciclar:

| Estado | Icono | Color |
|--------|-------|-------|
| **Presente** | ✓ | Verde |
| **Ausente** | ✗ | Rojo |
| **Tarde** | ⏱ | Amarillo |
| **Justificado** | ◎ | Gris |

Para justificados, pulsa `+ Motivo` para añadir la razón (enfermedad, lesión, examen, etc.) — quedan reflejados en exports y stats.

### 6.2 Contadores clicables (filtro rápido)

Las 4 cajas **PRES / AUSE / TARD / JUST** son botones. Pulsa para filtrar la lista a solo ese estado. La caja activa se resalta con ✓ y un banner indica el filtro. **✕ Todos** lo quita. Los contadores con valor 0 no son clicables. El filtro es **efímero** — se borra al cambiar de fecha o salir.

### 6.3 Reset rápido

Si has tocado por error, aparece un enlace discreto **↺ Resetear a presentes** arriba a la derecha (solo si hay cambios). Pide confirmación antes de aplicar.

### 6.4 Autoguardado del pase de lista (v1.6.11)

**No hay botón Guardar.** Todo se autoguarda al instante:

- Asistencia, justificaciones, valoración colectiva e individual, foto → guardado al toque.
- Notas y ejercicios → debounce de **0,8 segundos** después de dejar de escribir.

Donde antes estaba el botón Guardar, ahora hay una caja verde con **💾 Autoguardado activo**. Cada vez que persiste cambios parpadea a **✓ Guardado** durante 1,5 s. A su lado el botón circular verde 📤 para compartir por WhatsApp.

Si sales de la pantalla antes de que se complete el debounce (← atrás, HOY, cambio de fecha, navbar, 📤 compartir), Kortline vuelca el borrador al instante. **No pierdes nada.**

### 6.5 Foto del entrenamiento (v1.8.1)

Pulsa la caja **📷 Añadir foto** y elige desde cámara o galería del móvil. Kortline aplica **compresión adaptativa**:

| Intento | Lado máx | Calidad JPEG | Tamaño aprox |
|---------|----------|--------------|--------------|
| 1 | 600 px | 0.70 | ~80–120 KB |
| 2 | 480 px | 0.65 | ~50–80 KB |
| 3 | 400 px | 0.55 | ~30–50 KB |
| 4 | 320 px | 0.45 | ~20–30 KB |
| 5 | 240 px | 0.40 | ~10–15 KB |

Toast `⏳ Procesando foto…` mientras comprime y al final `📷 Foto guardada (~85 KB)` indicando el nivel real. Si no cabe ni con el nivel 5: toast `⚠️ Sin espacio. Borra fotos antiguas o exporta backup` y se mantiene la foto anterior.

### 6.6 Valoración colectiva inteligente (v1.6.8)

Si tienes activadas **ambas** valoraciones (colectiva + individual), la colectiva se calcula como **media de las individuales**. Badge verde `🔗 Auto`.

Para editar manual: **mantén pulsado** el botón ✏️ ~1 s. Anillo naranja se va llenando. Estrellas desbloqueadas → tocas. Badge naranja `✏️ Manual` + botón verde `🔗 Volver a modo automático`.

### 6.7 Aviso de cambios sin guardar (v1.6.10)

El sistema de **dirty tracking** se mantiene en notas del partido y modales CRUD (equipo, jugador, lesión, partido, ajustes). Si intentas salir con cambios sin guardar:

> ⚠️ Cambios sin guardar
>
> [💾 Guardar y salir]
> [🗑 Descartar y salir]
> [✏️ Seguir editando]

> El pase de lista NO usa este aviso desde v1.6.11 — está autoguardado.

---

## 7. Día de partido

### 7.1 Crear un partido

Equipo → **Partidos** → **＋ Añadir partido**:

- **Rival** (obligatorio).
- **Fecha** y **hora**.
- **Campo**: 🏠 Casa / ✈️ Fuera / ⚖️ Neutral.
- **Pabellón** (opcional).
- **Formato del partido** — nº de cuartos y minutos por cuarto. Default según categoría.
- **Toggles** — varios:

| Toggle | Defecto | Para qué |
|--------|---------|----------|
| 📊 Estadísticas del rival | OFF | Permite anotar stats post-partido jugador a jugador del rival (requiere registrar sus jugadores) |
| 👥 Solo stats del equipo | OFF | No registra stats individuales, solo totales |
| ⏱ Reloj se para con falta | Según categoría | FIBA: el reloj se detiene siempre que se pita una falta. También se para automáticamente en cada sustitución y tiempo muerto |
| 🎯 Modo Shot Chart <sup>PRO</sup> | OFF | Cada tiro de campo (+2/+3, anotado o fallado) abre la cancha para tocar la zona exacta. Genera el mapa de tiros del partido |

> Estos toggles configuran el **partido en vivo** (sección 7.4). Si no activas el live game, el partido se sigue pudiendo anotar a mano desde el detalle (sección 7.3).

### 7.2 Convocatoria

Tras crear partido o pulsando **✏️ Editar** sobre la convocatoria existente, se abre el wizard de **CONVOCATORIA · Equipo + Rival**. Dos pasos (rival opcional).

#### Paso 1 — Nuestro equipo

```
┌─────────────────────────────────────┐
│  CONVOCATORIA            [1/2]       │
│  Bilbao · sábado, 25 abr             │
│  [👥 CASADEMONT TEST] [🔴 Bilbao]    │
├─────────────────────────────────────┤
│  👥 Nuestro equipo                   │
│  6 convocados · 5 titulares          │
│  Toca para convocar · ⭐ titular · (C)│
│                                     │
│  ┌─────────────────────────────────┐ │   ← Banner v1.7.7
│  │ © Capitán: #4 Carlos Uno        │ │
│  │ Dirige al equipo si te expulsan  │ │
│  └─────────────────────────────────┘ │
│                                     │
│  ┌─[✓] #4 Carlos    [⭐] [(C)] ────┐│
│  │  [✓] #5 Diego    [⭐] [(C)]    ││
│  │  [ ] #11 Eva                     ││
│  │  ...                             ││
│  └─────────────────────────────────┘│
│                                     │
│  [Siguiente: Bilbao →]               │
│  [✅ Listo — ir al partido]           │
└─────────────────────────────────────┘
```

**Botones laterales en cada fila:**

- **⭐ Titular** — solo si el jugador está convocado. Máximo 5.
- **(C) Capitán** — solo si convocado. Máximo 1 (al pulsar otro, el anterior pierde la C).

**Banner del capitán prominente (v1.7.7):**

- 🟢 Verde si designado: `© Capitán: #X Nombre · Dirige al equipo si el entrenador es expulsado`.
- 🟡 Amarillo si no: `⚠️ Sin capitán designado · FIBA: pulsa (C) junto a un convocado`.

**Convocatoria fluida (v1.7.6):** al tocar jugadores, **el scroll se mantiene** donde estaba (refresh in-place de cada fila, no redibujado del modal completo).

#### Validaciones al pulsar "✅ Listo"

Se comprueba en cadena (v1.7.7):

| Caso | Tipo | Mensaje |
|------|------|---------|
| 0 convocados | 🔒 Bloqueante | "Sin convocados — no puedes empezar el partido" |
| < 5 convocados | 🔒 Bloqueante | "Solo X convocados — FIBA exige 5 en pista" |
| < 5 titulares | ⚠️ Aviso | "Faltan titulares (X/5)" + opción "Continuar igual (no recomendado)" |
| Sin capitán | ⚠️ Aviso | "Sin capitán designado · FIBA: dirige si te expulsan" + "Continuar igual" |

Los **bloqueantes** no permiten seguir. Los **avisos** sí — puedes ignorarlos conscientemente con el botón gris.

#### Paso 2 — Rival (opcional)

Si activaste 📊 Estadísticas del rival, añade aquí los dorsales y nombres del rival. Es lo que permite anotar stats individuales del rival (puntos, faltas, etc.) en el detalle del partido al terminar.

### 7.3 Anotar el partido (resultado por cuartos)

En v1.0.0 el partido se anota a mano desde el detalle del partido. El botón "✏️ Anotar partido" de la home (o "📋 Editar" desde la card del partido) lleva al detalle, donde encuentras:

```
┌─────────────────────────────────────┐
│  ←  Detalle del partido      [📤]   │
│     CB JACA vs BILBAO                │
│     sábado, 25 abr · 20:00           │
├─────────────────────────────────────┤
│  📋 Convocatoria  → [Editar]         │
│                                     │
│  🏀 RESULTADO POR CUARTOS            │
│  ┌───┬───┬───┬───┬───────┐          │
│  │Q1 │Q2 │Q3 │Q4 │ TOTAL │          │
│  │ - │ + │   │   │       │          │
│  │ 8 │16 │14 │12 │  50   │ ← Local  │
│  │   │   │   │   │       │          │
│  │ - │ + │   │   │       │          │
│  │10 │14 │12 │11 │  47   │ ← Rival  │
│  └───┴───┴───┴───┴───────┘          │
│                                     │
│  ➕ Añadir prórroga                  │
│                                     │
│  📝 Notas del partido                │
│                                     │
│  📊 Estadísticas post-partido        │
└─────────────────────────────────────┘
```

#### 7.3.1 Resultado por cuartos

Cada cuarto tiene un stepper +/− por equipo (nuestro y rival). Tres formas de introducir los puntos:

- **Botón +** suma uno al cuarto.
- **Botón −** resta uno.
- **Tocar el número** abre teclado para escribir el valor directo.

El total se calcula automáticamente al pie de cada columna. Si el partido termina en empate puedes pulsar **➕ Añadir prórroga** para sumar OT1, OT2… con el mismo stepper.

> 💡 Si tenías partidos de versiones anteriores con datos del seguimiento en vivo, el resultado por cuartos aparecerá rellenado automáticamente desde esos datos. Aún así puedes corregir cualquier valor a mano.

#### 7.3.2 Estadísticas post-partido

Debajo del resultado encontrarás la sección de estadísticas individuales. Por cada jugador convocado puedes anotar:

- Puntos (1, 2 y 3 anotados / intentados).
- Rebotes (ofensivos y defensivos).
- Asistencias, robos, tapones, pérdidas.
- Faltas (personales, técnicas, antideportivas, descalificantes).

Los totales por equipo se calculan automáticamente. Estas estadísticas alimentan la pantalla **📊 Stats** del equipo (sección 9).

#### 7.3.3 Notas del partido

Campo libre para escribir el resumen del partido, comentarios sobre el rival, ajustes tácticos, etc. Se guarda con el patrón de dirty tracking habitual: si sales con cambios sin guardar verás el aviso.

#### 7.3.4 Compartir el partido

Botón **📤** en el header del detalle. Genera un mensaje de WhatsApp con el marcador, los parciales por cuarto y un mini-resumen de la convocatoria.

> Esto es el flujo **manual** (anotar a mano al terminar). Si prefieres seguir el partido en directo desde el banquillo — marcador, faltas, sustituciones, tiempos muertos, shot chart — usa el **partido en vivo** de la sección 7.4. Ambos flujos son compatibles: lo anotado en vivo rellena automáticamente el resultado por cuartos de esta pantalla.

### 7.4 Partido en vivo (marcador en directo)

Si al crear el partido activaste los toggles de la sección 7.1, en la home verás el botón **▶ Empezar partido** en lugar de "✏️ Anotar partido". Te lleva directo al marcador en vivo tras confirmar la convocatoria.

#### 7.4.1 Marcador y reloj

El reloj del cuarto se controla con ▶/⏸. Si activaste ⏱ *Reloj se para con falta*, se para solo cada vez que pitas una falta — y **siempre** se para automáticamente al hacer una sustitución o pedir un tiempo muerto, aunque el toggle esté desactivado. Puedes rebobinar o reiniciar el reloj del cuarto si te equivocas.

#### 7.4.2 Faltas y bonus

Cada falta se asigna a un jugador (o al equipo, si no tienes plantilla del rival registrada — ver 7.4.5) y puede ser personal, técnica, antideportiva o descalificante. A partir de la **5ª falta de equipo en el cuarto** entráis en bonus FIBA: la siguiente falta del rival da automáticamente 2 tiros libres, y verás un aviso en pantalla.

Al pitar una falta se abre el selector de **tiros libres**: eliges quién tira (si hay rival registrado) y cuántos tiros (0/1/2/3), con el número sugerido ya marcado según el tipo de falta y si hay bonus.

#### 7.4.3 Sustituciones

Se hacen con balón muerto. Si el reloj estaba corriendo al confirmar el cambio, Kortline **lo para automáticamente** y te avisa — no hace falta acordarse de pausarlo antes de sustituir.

#### 7.4.4 Descalificación automática

Un jugador queda descalificado al llegar a 5 faltas personales, 2 técnicas, 2 antideportivas, o la combinación de 1 técnica + 1 antideportiva. En ese momento se abre un aviso **obligatorio** (no se puede cerrar sin elegir) para sacarlo y meter a un jugador del banquillo que no esté también descalificado. Si el banquillo está agotado, puedes confirmar seguir con menos jugadores en pista.

#### 7.4.5 Modo equipo (sin plantilla del rival)

Si no registraste los jugadores del rival en la convocatoria, las canastas y faltas del rival se anotan como acciones de equipo genéricas ("Equipo, sin jugador concreto"). Kortline sabe distinguir si estás mirando la pestaña de tu equipo o la del rival y suma la falta o los puntos al lado correcto — no hace falta cambiar de pantalla para anotar al rival.

#### 7.4.6 Tiempos muertos

Botón ⏱ Tiempo Muerto: elige qué equipo lo pide. El límite es de **2 tiempos muertos por mitad** y **1 por prórroga** (regla FIBA); el botón se desactiva solo cuando se agotan. Al confirmarlo se para el reloj y aparece un aviso de cuenta atrás de 60 segundos.

#### 7.4.7 Shot Chart

Con el toggle 🎯 Modo Shot Chart activado, cada vez que anotas un tiro de campo (entre o falle) se abre la cancha para tocar la zona exacta donde se ha tirado — jugador a jugador o en modo equipo. Con esto Kortline construye el mapa de tiros del partido (ver sección 8).

#### 7.4.8 Estadísticas en directo

Botón 📊 en el marcador: abre la tabla de estadísticas del partido en tiempo real, con toggle para ver tu equipo o el rival. Si giras el móvil durante el partido en vivo, la pantalla pasa automáticamente a modo lectura de estadísticas a pantalla completa — el resto de la app funciona solo en vertical, pero el live game permite este modo horizontal de consulta.

Al terminar el partido, todo lo anotado en vivo (resultado por cuartos, estadísticas, faltas) queda disponible igual que si lo hubieras introducido a mano en la sección 7.3.

---

## 8. Shot Chart

El mapa de tiros por zona está disponible durante el **partido en vivo** (sección 7.4.7), activando el toggle 🎯 Modo Shot Chart al crear el partido.

Cada vez que anotas un tiro de campo (+2 o +3, entre o falle) se abre la cancha: toca la zona exacta donde se ha producido el tiro para registrarlo. Funciona tanto para tiros de un jugador concreto como en modo equipo (sección 7.4.5, cuando no tienes plantilla del rival registrada).

El mapa resultante — zonas más calientes, porcentaje de acierto por zona — se puede consultar desde el resumen del partido al terminar, y de forma agregada en la pantalla de Estadísticas (sección 9) si tienes varios partidos con datos de shot chart.

> Si no activas el toggle, el partido se sigue pudiendo anotar con total normalidad (a mano o en vivo) — el shot chart es un extra opcional, no obligatorio.

## 9. Estadísticas

### 9.1 Stats por partido (post-partido)

En v1.0.0 las estadísticas se introducen al terminar el partido, desde el detalle. Por cada jugador convocado puedes anotar:

| Columna | Qué es |
|---------|--------|
| **PTS** | Puntos totales (1×p1m + 2×p2m + 3×p3m) |
| **T2 / T3 / TL** | Anotados / Intentos |
| **RO / RD** | Rebotes ofensivos / defensivos |
| **AST / ROB / TAP / PER** | Asistencias / Robos / Tapones / Pérdidas |
| **F** | Faltas (personales, técnicas, antideportivas, descalificantes) |

Los totales por equipo se calculan automáticamente. Si tenías partidos antiguos con datos del seguimiento en vivo, esas estadísticas siguen visibles y editables a mano.

> Métricas avanzadas como minutos jugados (MIN), +/- y eFG% requieren el tracking de sustituciones en tiempo real, que llegará con la v2.0. En v1.0.0 sólo se trabajan los counters básicos.

### 9.2 Pantalla de estadísticas globales

**Equipo → 📊 Stats**:

- **Tarjetas por jugador** — % asistencia, sesiones jugadas, racha, valoración media.
- **Riesgo FEB** — jugadores por debajo del umbral (75% por defecto, configurable) marcados con ⚠️. Lesionados aparecen con `🚑 lesionado desde fecha · congelado`.
- **Filtros**: Todos / ⚠️ Riesgo / 🔥 Racha mala.
- **Gráficos** — tendencia 24 últimas sesiones.
- **Exports** — PDF (con marcado de riesgo) y Excel (4 hojas: Resumen, Mensual con media ponderada, Sesiones, Lesiones).

> 💡 El export respeta el filtro activo. Si tienes "⚠️ Riesgo" puesto, el PDF/Excel solo lleva esos jugadores.

---

## 10. Backup y datos

### 10.1 Filosofía honesta

Kortline guarda todo en `localStorage` del navegador. Eso significa que **si limpias la caché del navegador, pierdes todo**. La única forma segura de proteger tus datos es **exportar el JSON manualmente y guardarlo**:

- Drive / Dropbox / iCloud
- Email a ti mismo
- Pendrive físico

> 💾 Aviso visible en HOY: si nunca has exportado, aparece banner amarillo `Sin backup reciente`.

### 10.2 Exportar / Importar

⚙️ Ajustes → 💾 Copia de seguridad:

- **⬇️ Exportar** — descarga `kortline-backup-{fecha}.json` con TODO (equipos, jugadores, sesiones, partidos, eventos, fotos, shots, configuración, logo).
- **⬆️ Importar** — sube un JSON exportado anteriormente. **Sobreescribe** los datos actuales — exporta primero por si acaso.

### 10.3 Fin del autobackup duplicador (v1.8.3)

Hasta v1.8.2, cada `save()` duplicaba todos los datos en `cbj:autobackup` del mismo localStorage. Eso era una falsa seguridad (si limpias caché, también pierdes el autobackup) y consumía la mitad del espacio disponible — la primera foto subida ya no cabía.

**v1.8.3 elimina el autobackup automático.** Si tienes un autobackup viejo (residuo de versiones previas), aparece banner amarillo en Ajustes → Copia de seguridad:

> 🔄 Autobackup antiguo: **74 KB**
>
> v1.8.3 ya no genera autobackup duplicado. Si tu app va lenta o no caben fotos, bórralo aquí.

Con dos botones:

- **🔄 Restaurar** — usar el autobackup viejo (por si querías recuperar algo).
- **🗑 Borrar (libera 74 KB)** — limpia el autobackup. Tus datos reales no se tocan.

> 💡 Antes de borrar, exporta el JSON manualmente — ese es tu backup real.

---

## 11. Tips Pro

### 11.1 Convocatoria rápida

- Botones **Todos** / **Ninguno** arriba a la derecha del wizard.
- El **scroll se mantiene** al tocar jugadores.
- Si activas un jugador como **titular** sin querer, vuélvelo a tocar y se desactiva.
- **Capitán** se cambia tocando (C) en otra fila.

### 11.2 Anotar el partido sin perder tiempo

- Si el ritmo del partido es rápido, anota solo el resultado por cuartos al terminar cada cuarto — es lo que más se consulta luego.
- Las stats individuales (puntos por jugador, rebotes, asistencias) pueden esperar al post-partido, con la planilla en mano.
- El sync `live → manual` sigue activo: si tienes partidos antiguos con datos del seguimiento en vivo, el resultado por cuartos ya viene rellenado y puedes corregir lo que necesites.

### 11.3 Backup periódico

- Cada 2-3 semanas exporta el JSON desde ⚙️ Ajustes → 💾 Copia de seguridad.
- Guarda el archivo en Drive, Dropbox o email a ti mismo. El autobackup del navegador no es un respaldo real (si limpias caché, también se va).
- En septiembre, antes de empezar temporada nueva, exporta el JSON completo de la temporada anterior y archívalo.

---

## 12. Resolución de problemas

| Problema | Causa probable | Solución |
|----------|----------------|----------|
| **Foto da "Almacenamiento lleno"** | autobackup duplicador antiguo | Ajustes → Copia de seguridad → 🗑 Borrar autobackup antiguo |
| **El botón de la home dice "Anotar partido" en vez de "Empezar partido"** | los toggles de partido en vivo (7.1) no estaban activados al crear el partido | Edita el partido y activa ⏱/🎯, o crea uno nuevo con esos toggles ON para usar el marcador en directo (sección 7.4) |
| **Veo el botón 📍 Mapa de tiros pero está vacío** | partido sin shots registrados | Activa 🎯 Modo Shot Chart al crear el partido (sección 7.1) y regístralo durante el live game (sección 7.4.7) |
| **Carlos en stats aparece como "I."** | nombre empieza con inicial | Edita el jugador y separa el nombre: "Javier Rodríguez" en lugar de "I. Javier Rodríguez" |
| **No me reconoce el equipo al abrir la app** | autoasignación bloqueada | Entra a Equipos y selecciona el equipo; queda fijado para siguientes sesiones |
| **He girado el móvil y veo un overlay** | fuera del partido en vivo, toda la app es vertical | Vuelve a vertical y todo continúa donde lo dejaste. Solo el partido en vivo permite horizontal (para leer stats a pantalla completa) |
| **Pierdo cambios al cerrar el modal de un jugador** | el dirty tracking pide confirmación | Pulsa "💾 Guardar y salir" en el aviso de cambios sin guardar |

---

## Anexo: glosario de iconos

| Icono | Significado |
|-------|-------------|
| 🏀 | Partido |
| 🏋️ | Entrenamiento |
| 🚑 | Lesión (jugador) |
| 📋 | Pasar lista / convocatoria |
| 📷 | Foto del entrenamiento |
| 📤 | Compartir / exportar |
| 📥 | Descargar |
| ✏️ | Editar / anotar |
| ⚠️ | Aviso |
| ✓ ✗ | Anotado / Fallado |
| ⭐ | Titular |
| (C) | Capitán |
| 💾 | Autoguardado |
| 🔄 | Sincronizar / restaurar |
| 🗑 | Borrar |
| ↺ | Reset |

---

## Sobre esta versión

Este manual corresponde a **kortline-v2**, rama de desarrollo del marcador en vivo. Las próximas versiones añadirán:

- **v3.0.0** — sincronización en la nube con Firebase para colaboración entre varios coaches del mismo equipo.

Para detalles y plan, ver [`ROADMAP.md`](ROADMAP.md).

---

_Kortline · Hecho con 🧡 para CB Jaca_
_Desarrollado por Mario Nadal Ara_
