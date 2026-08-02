# QA UX del seguimiento en vivo — Kortline v1.6.14

**Partido simulado:** Casademont Zaragoza vs Surne Bilbao (Liga Endesa, 7 feb 2026)
**PBP fuente:** [ACB Live](https://live.acb.com/es/partidos/casademont-zaragoza-vs-surne-bilbao-104708/jugadas) — ~160 jugadas, 4 cuartos + simulación de OT
**Configuración:** sénior 4×10, stats individuales activadas, stopOnFoul=ON, 12 jugadores convocados, 5 rivales registrados.

> Confirmado en la sesión: el hotfix de **B-42** (faltas Q4 → OT) y el **selector de medio tiempo** ya están en producción y funcionan correctamente.

---

## Fricciones encontradas en el live

### 🔴 F1 · El modal de Tiros Libres se abre tras CADA falta — incluso ofensivas y sin bonus

**Síntoma.** Cualquier `foul`/`ftech`/`funsport`/`fdq` dispara automáticamente `openFoulTLModal` (o `openTeamTLModal`) tras 120 ms. En el partido simulado se abrió el modal **31 veces**, de las cuales solo ~6 eran realmente faltas con TL. El resto requerían `Saltar sin asignar` + cierre — fricción acumulada importante.

**Casos en los que NO debería abrir modal:**
- Falta ofensiva (cambio de posesión, sin TL).
- Falta defensiva no en lanzamiento, equipo NO en bonus (cambio de posesión).
- Algunas técnicas de banquillo (pueden no tirar TL si la regla local lo dispone).

**Propuesta — modal "inteligente":**

1. Cuando teamFouls < 5 (no bonus) y el modal abre, el botón preseleccionado debe ser `Sin TL` en lugar de `2 TL`.
2. Cuando teamFouls ≥ 5 (bonus), preseleccionar `2 TL` y mostrar un banner verde "BONUS · esta falta tira TL".
3. Falta antideportiva/descalificante: preseleccionar `2 TL` siempre (regla FIBA).
4. Botón "Saltar sin asignar" con etiqueta más explícita: **"Sin tiros libres"** (azul/neutro), separado visualmente del Confirmar.

**Bonus**: añadir un toggle al hacer la falta "¿En lanzamiento? · ¿Ofensiva?" como pre-pregunta de 1 click que luego rellena el modal automáticamente. Quizá demasiado, decisión de Mario.

**Severidad.** Muy alta — esto es el mayor punto de fricción del live game.

---

### 🟡 F2 · Cards de jugador en pista muestran nombres truncados de forma rara

**Síntoma.** El nombre se trunca con `name.split(" ")[0]`. Para jugadores como **"I. Javier Rodríguez"** la card muestra **"I."** (solo la inicial), lo que es ilegible.

Misma cosa con apellidos compuestos: "Aitor González de Albéniz" mostraría "Aitor" (vale) pero "J. Pablo Sánchez" mostraría "J." (mal).

**Propuesta.** Heurístico de display:

```js
function _shortName(full){
  const parts=(full||"").trim().split(/\s+/).filter(Boolean);
  if(!parts.length) return "?";
  // Si el primer trozo es una inicial (1 letra o termina en .), usar el siguiente
  const first=parts[0];
  if(first.length<=2 || /\.$/.test(first)){
    return parts[1] || first;
  }
  return first;
}
```

Aplicar a court cards, bench cards, modal de TL, log del partido, exports. Lo mismo para nombres de equipo de 3+ palabras (ya truncas con `.slice(0,2)` en algunos sitios — revisar consistencia).

**Severidad.** Media. Confunde a primera vista especialmente con dorsales similares.

---

### 🟡 F3 · 2 toques por jugada (jugador → acción)

**Síntoma.** Para registrar cualquier acción: 1 toque en el jugador on-court + 1 toque en el botón de acción del ACTPAD. En 200 jugadas reales = ~400 toques. Manejable pero exigente para un anotador en partido real.

**Propuesta — modo "rápido":**

Una idea pequeña: que el ACTPAD **persista visible** después de tocar al jugador, hasta que toque "✕ cerrar" o cambie de jugador. Hoy ya es así, pero registrar una acción cierra el ACTPAD (auto-deselección de v1.6.0). Eso obliga a re-tocar al mismo jugador para su próxima acción (común: rebote → asistencia → robo de un mismo defensor en transición).

Dos modos a elegir en ⚙️ ajustes:
- **Modo cómodo (default actual)**: deselección tras cada acción.
- **Modo rápido**: el jugador queda seleccionado tras la acción; sólo se deselecciona al tocar otro jugador o el botón ✕.

**Severidad.** Baja-media. Es preferencia del usuario.

---

### 🟢 F4 · Otras observaciones menores

- **Selector de equipo on-court** (Casademont Te... / Surne Bilbao) es un toggle ancho. En móvil estrecho, los nombres largos quedan cortados con "...". Igual considerar dorsal grande + nombre corto.
- **Sin "deshacer última jugada"** visible: si te equivocas (toque de "+2" en lugar de "+3"), tienes que ir al log y borrar. En el calor del partido, un botón **↺ Deshacer** prominente sería oro.
- **Banner de aviso al entrar en bonus** (B-49 del informe anterior): sigue pendiente.
- **El reloj se para con falta** funciona perfecto — pero **falta una pista visual** de que se ha parado por la falta. Hoy el reloj simplemente cambia de ⏸ a ▶, sin explicar el porqué. Un toast sutil "⏱ Reloj parado por falta" durante 1 s sería claro.
- **Cuartos pasados** se pueden re-editar tocando la pestaña Q1/Q2/etc. Útil pero peligroso: si tocas Q1 sin querer, registras acciones en el cuarto equivocado. Idea: confirmación al cambiar a un cuarto que ya no es el actual.

---

## Cambio mayor #1 · Sección de faltas dedicada en el ACTPAD

### Lo que pides

Mover las 4 faltas (FALT, TÉC, ANT, DESC) fuera de la fila genérica y darles **su propia caja con título destacado**, igual que las cajas actuales de **⚡ PUNTOS** y **📦 REBOTES**.

### Diseño propuesto

Estructura del ACTPAD del jugador seleccionado (de arriba a abajo):

```
┌────────────────────────────────────┐
│ [#11] Santi Yusta · 12 pts · 1 falta│ ✕ cerrar │
├────────────────────────────────────┤
│ ⚡ PUNTOS                            │
│ +2  +3  +1                          │
│ ✗2  ✗3  ✗TL                         │
├────────────────────────────────────┤
│ 📦 REBOTES                          │
│ Ofen  Def                            │
├────────────────────────────────────┤
│ 🎯 OTROS                            │
│ AST  ROB  TAP  PER                  │
├────────────────────────────────────┤
│ 🤚 FALTAS  · F:5/4 BONUS            │
│ FALT  TÉC  ANT  DESC                │
└────────────────────────────────────┘
```

**Detalles:**

- Caja con borde rojizo/naranja propio (`rgba(245,158,11,.25)` o más rojo).
- Título "🤚 FALTAS" en mayúsculas con tracking.
- A la derecha del título, badge dinámico:
  - `F:0/4` cuando teamFouls < 4
  - `F:4/4 PRÓX BONUS` cuando teamFouls === 4 (aviso)
  - `F:5/4 BONUS` cuando teamFouls ≥ 5
- Los 4 botones más grandes (mismo tamaño que los de PUNTOS, no compactos).
- DESC visualmente más severo (rojo oscuro, casi negro).

**Esfuerzo.** Bajo. Solo es reorganizar el HTML y CSS del ACTPAD. La lógica no cambia.

---

## Cambio mayor #2 · Mapa de tiro "modo pro" tipo Swish / Basketball Stats Assistant

### Lo que pides

Una vista de cancha donde el anotador toca la zona donde se hizo el lanzamiento y se registra el tiro con coordenadas (x, y), pudiendo después generar mapa de calor / shot chart por jugador y por partido.

### Diseño propuesto

#### A · Activación

Toggle nuevo en el modal de creación de partido (junto a `Estadísticas del rival` y `Reloj se para con falta`):

> **🎯 Modo Shot Chart (avanzado)**
> Registra cada tiro con su zona en la cancha. Permite mapas de calor y % por zona.
> Default: OFF.

Cuando está ON, el flujo de tiro cambia (ver más abajo). Todo lo demás del live game sigue igual.

#### B · Flujo de registro de tiro

Hoy en modo normal: jugador → ACTPAD → "+2" o "+3" o "✗2" o "✗3".

En modo Shot Chart: jugador → ACTPAD → "+2"/"+3"/"✗2"/"✗3" abre **modal a pantalla completa con la cancha**:

```
        [   Cancha SVG   ]
        ┌─────────────────┐
        │   ◯◯◯◯◯◯◯◯◯◯  │  ← arco de 3 puntos
        │  ◯           ◯  │
        │  ◯  [aro]    ◯  │
        │  ◯           ◯  │
        │   ◯◯◯◯◯◯◯◯◯◯  │
        └─────────────────┘
        [+2 anotado] o [✗2 fallado] arriba según botón

        Pulsa donde se hizo el tiro
```

Al tocar la cancha: se registra el tiro con `(x,y)` en `live.shots[]` y se cierra el modal automáticamente. Beneficio extra: **detección automática de 2/3** (si el toque está fuera del arco de 3, lo cuenta como triple aunque hayas elegido +2 — o avisa "esto es un triple, ¿confirmar como triple?").

#### C · Modelo de datos

Estructura nueva en `m.live`:

```js
m.live.shots = [
  {pid:"p1", made:true, value:2, x:0.42, y:0.18, q:1, clockAt:558, ts:...},
  {pid:"p1", made:false, value:3, x:0.05, y:0.55, q:1, clockAt:520, ts:...},
  ...
]
```

`x` y `y` normalizados 0–1 (origen abajo izquierda). Esto desacopla del tamaño exacto del SVG.

Para retrocompat: los tiros sin `x,y` (registrados sin shot chart) se siguen mostrando en stats y log igual que hoy.

#### D · Visualización del mapa de calor

Nueva pantalla **📍 Mapa de tiros** accesible desde:
- El detalle del partido tras finalizar.
- La pantalla del jugador en estadísticas (filtrar por partido o agregado de temporada).

Muestra la cancha con todos los tiros registrados:
- 🟢 Punto verde: anotado de 2.
- 🔵 Punto azul: anotado de 3.
- ⚫ X gris: fallado.
- Filtros: `Equipo / Jugador X` · `Cuarto` · `Anotados / Fallados / Todos`.

Más adelante (no v1 del shot chart): **mapa de calor con zonas predefinidas** (esquinas, codos, top of the key, pintura, etc.) con % por zona.

#### E · Esfuerzo estimado

**Iteración 1 — MVP (v1.7.0):**
- Toggle por partido.
- SVG de la cancha (mitad campo, vertical, ~300 líneas).
- Modal de captura del toque.
- Persistencia en `m.live.shots`.
- Pantalla básica de mapa de tiros del partido.

**Iteración 2 — pro (v1.7.x):**
- Mapa de tiros agregado por jugador (toda temporada).
- Mapa de calor por zonas con %.
- Heurístico 2/3 automático.
- Exportar PNG del mapa para compartir.

**Tiempo estimado.** Iteración 1: ~3-4 horas de implementación + ~1 hora de pruebas. Iteración 2: similar.

#### F · Refs visuales

Apps de inspiración: **Swish** (más simple, foco en jugador), **Basketball Stats Assistant** (más completo, multi-equipo, exportación). Ambos usan media cancha vertical para mobile.

---

## Recomendación de roadmap

**v1.6.15** (release pequeño, alta densidad de fricciones resueltas):

1. **F1** · modal TL inteligente con default según bonus + banner BONUS.
2. **F2** · `_shortName` helper para nombres con inicial al inicio.
3. **Sección de faltas dedicada** (Cambio mayor #1) — visual cleanup del ACTPAD.
4. **Toast "⏱ Reloj parado por falta"** (parte de F4).

Esto es media tarde de trabajo y cierra todo lo de UX cotidiano.

**v1.7.0** · "Modo Pro Shot Chart" (Cambio mayor #2):

Iteración 1 del shot chart con MVP. Toggle por partido, captura del tiro, persistencia, pantalla básica de mapa.

**v1.7.1** · iteración 2 del shot chart (zonas, heatmap, exportar).

**Diferidos:**
- F3 modo rápido sin auto-deselección · esperar feedback uso real.
- F4 confirmación al cambiar de cuarto pasado.
- Botón "↺ Deshacer última jugada" prominente.

---

## Comodidad y usabilidad — veredicto

En el partido simulado de 160+ jugadas la app aguantó bien — **el cuello de botella es el modal de TL constante (F1)**, todo lo demás es secundario. Con F1 resuelto y la nueva sección de faltas, el live debería ir muy fluido para el típico anotador FEB amateur.

El shot chart es una adición ambiciosa pero cambia la liga de la app: la sitúa al nivel de Swish/BSA y le da un argumento de venta concreto frente a la libreta o Excel del entrenador veterano. Vale la pena hacerlo.
