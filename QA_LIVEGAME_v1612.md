# QA del seguimiento en vivo — Kortline v1.6.12 vs reglamento FIBA/FEB sénior amateur

**Fecha del informe:** 2026-04-27
**Categoría de referencia:** Sénior FEB amateur (4 cuartos × 10 min, reglas FIBA 2024-2025 sin desviaciones FEB significativas)
**Simulación realizada:** SÉNIOR TEST vs CB HUESCA TEST (datos sintéticos en Chrome PWA)

---

## 🔴 Críticos — desvíos claros del reglamento que afectan al partido

### B-38 · El reloj no se para con falta

**Comportamiento actual.** Al registrar una falta personal (`foul`) o técnica (`ftech`) en el live game, el reloj sigue corriendo. La función `liveAction` incrementa contadores y abre el modal de TL pero nunca toca `m.live.clockRunning`.

**Lo que dice la norma.** Regla FIBA 7.4: el reloj se detiene **siempre** que el árbitro pita una falta personal, no solo en los últimos 2 minutos del Q4/OT.

**Reproducción.** Iniciar reloj → cometer falta → modal de TL aparece pero el cronómetro de juego sigue avanzando.

**Propuesta.** En `liveAction` (línea ~5151) y `liveTeamAction` (línea ~5342), cuando `action==="foul"||action==="ftech"`, ejecutar también `m.live.clockRunning=false; clearInterval(_liveTimer); _liveTimer=null;`. Mostrar al lado del modal de TL un texto pequeño "⏱ Reloj detenido — pulsa ▶ para reanudar".

**Idea de Mario:** ajuste opcional por partido / categoría "el reloj se para con falta" (ON/OFF). Por defecto **ON** en sénior/junior/cadete; **OFF** en infantil/alevín y recreativo donde a veces el árbitro no para. Ver B-53 abajo.

---

### B-42 · Las faltas de equipo en prórroga se resetean a 0

**Comportamiento actual.** Al pulsar "Jugar OT" desde el prompt de empate, `activateOT()` añade un nuevo slot a `m.live.teamFouls` con valor `0`. La prórroga arranca con bonus en frío.

**Lo que dice la norma.** Regla FIBA 37.2: las faltas de equipo en prórroga **continúan** las del 4º cuarto, no se resetean. Si en Q4 había 4 faltas (próxima entra en bonus), en OT la **primera** falta ya tira TL.

**Reproducción confirmada.** Forcé Q4 con `teamFouls[3]=4`, llamé `activateOT()`. Resultado: `teamFouls=[9,0,0,4,0]` — el slot del OT (índice 4) empieza en 0 cuando debería ser 4.

**Propuesta.** En `activateOT()` (línea 2837-2838), arrastrar el contador del Q4 al primer OT, y de un OT a la siguiente:
```js
const lastIdx = m.live.teamFouls.length - 1;
const carryOver = m.live.teamFouls[lastIdx] || 0;
m.live.teamFouls.push(carryOver);
```
Igual con `rivalFouls`. **Atención**: no hay que resetear el contador del Q4, solo arrastrar su valor al inicio del OT.

---

### B-47 · 2 faltas técnicas no descalifican al jugador

**Comportamiento actual.** El check de descalificación mira solo `st.foul >= 5` (línea 5169). Las técnicas (`st.ftech`) y antideportivas no se acumulan al límite de descalificación, así que un jugador puede tener `foul=0, ftech=2` y seguir activo.

**Lo que dice la norma.** Regla FIBA 36-37: descalificación directa (sin posibilidad de seguir jugando) por:
- 5 faltas personales acumuladas, **o**
- 2 faltas técnicas en el partido, **o**
- 2 faltas antideportivas en el partido, **o**
- 1 técnica + 1 antideportiva, **o**
- 1 falta descalificante (D).

**Reproducción confirmada.** Carlos con `foul=1, ftech=2` la app lo trata como activo. Debería estar expulsado.

**Propuesta.** Añadir helper `_isDQ(st)` y usarlo en lugar de `st.foul>=5` en todos los puntos donde se evalúa descalificación (línea 4550, 4573, 4576, 5169):
```js
function _isDQ(st){
  if(!st)return false;
  if((st.foul||0)>=5)return true;
  if((st.ftech||0)>=2)return true;
  if((st.funsport||0)>=2)return true;
  if(((st.ftech||0)+(st.funsport||0))>=2)return true;
  if((st.fdq||0)>=1)return true;
  return false;
}
```
Esto requiere también introducir tipos `funsport` y `fdq` (ver B-50 abajo).

---

### B-48 · La falta técnica de equipo en modo team-only cuenta doble

**Comportamiento actual.** En `liveTeamAction` (línea ~5342-5350), cuando `action==="ftech"`, el contador `m.live.teamFouls[qi]` se incrementa **dos veces**: una en el bloque `if(foul||ftech)` y otra en el bloque adicional `if(action==="ftech")`.

**Lo que dice la norma.** Una falta técnica cuenta como 1 falta de equipo (igual que una personal).

**Reproducción confirmada.** Modo team-only activado, `teamFouls[0]=7` antes, llamé `liveTeamAction('ftech',0)`, resultado `teamFouls[0]=9` (incremento de 2). Esperado: 8.

**Propuesta.** Eliminar la línea 5350 (`if(action==="ftech")live.teamFouls[qi]=(live.teamFouls[qi]||0)+1;`) — es código duplicado heredado de algún refactor anterior.

---

## 🟡 Importantes — impacto medio o decisión configurable

### B-44 · Descansos entre cuartos por debajo del reglamento

**Comportamiento actual.** En la función `tickClock` (línea ~486):
- Q1↔Q2 y Q3↔Q4 = **60 s** (1 min)
- Medio tiempo (Q2↔Q3) = **600 s** (10 min)

**Lo que dice la norma.** Regla FIBA 8.7:
- Entre 1º-2º y 3º-4º cuarto = **2 min**
- Medio tiempo = **15 min**
- Antes de OT = **2 min** (igual que entre cuartos)

**Comentario del README v1.5.0.** "Tiempos FEB amateur: Q1↔Q2 y Q3↔Q4 = 1 min, medio tiempo = 10 min". Esta decisión no está en el reglamento oficial sénior — la FEB sigue FIBA estricto. Probablemente vino de prácticas de gimnasio (tiempos cortos para que no se enfríe el equipo).

**Propuesta.** Dos caminos:
1. **Mínimo:** ajustar a los tiempos FIBA oficiales (2 min y 15 min). Es lo correcto.
2. **Mejor:** configurable por partido en el modal de creación (`Tiempos de descanso`: estándar FIBA / cortos / personalizados). Default según categoría.

---

### B-46 · El display de TMs en prórroga muestra "0 usados" aunque se hayan gastado

**Comportamiento actual.** `_tmCounts(live)` (línea 714-723) solo entiende H1 (Q1+Q2) y H2 (Q3+Q4). Para periodos `q>=5` (OT) devuelve `ourUsed=0` y `rivUsed=0` siempre, ignorando los TMs ya consumidos en ese OT.

**Reproducción confirmada.** En OT pedí 1 TM (`our[4]=1`). El segundo intento se rechaza correctamente (la lógica del límite SÍ funciona) pero los counts del overlay siguen mostrando `ourUsed: 0`. Confuso para el usuario.

**Propuesta.** Generalizar `_tmCounts` para periodos OT:
```js
function _tmCounts(live){
  const q=live.q||1;
  const to=live.timeouts||{our:[],rival:[]};
  const isH1=q<=2, isH2=q>=3&&q<=4, isOT=q>=5;
  let ourUsed, rivUsed, limit;
  if(isH1){ ourUsed=(to.our[0]||0)+(to.our[1]||0); rivUsed=(to.rival[0]||0)+(to.rival[1]||0); limit=2; }
  else if(isH2){ ourUsed=(to.our[2]||0)+(to.our[3]||0); rivUsed=(to.rival[2]||0)+(to.rival[3]||0); limit=3; }
  else { ourUsed=to.our[q-1]||0; rivUsed=to.rival[q-1]||0; limit=1; }
  return { ourUsed, rivUsed, ourRem:Math.max(0,limit-ourUsed), rivRem:Math.max(0,limit-rivUsed), limit, isH1, isH2, isOT };
}
```

---

### B-49 · No hay aviso visual cuando el bonus se activa por primera vez

**Comportamiento actual.** Al cometer la 5ª falta de equipo (la primera que tira TL en bonus), el modal de TL abre con 2 TL preseleccionados pero no hay un toast / banner que diga "esta falta entra en bonus".

**Por qué importa.** Si el anotador no se da cuenta, puede saltar el modal pensando que era una falta de equipo "normal" sin TL. La 5ª falta y siguientes deben tirar TL incluso aunque no sean en lanzamiento.

**Propuesta.** Detectar el cambio teamFouls 4→5 en `liveAction` y mostrar antes del modal:
```js
if(prev<5 && live.teamFouls[qi]>=5){
  toast("⚠️ Bonus — esta falta tira 2 TL");
}
```

---

### B-50 · No existen las faltas antideportiva ni descalificante como acciones diferenciadas

**Comportamiento actual.** Solo hay `foul` (personal) y `ftech` (técnica) en el ACTPAD del seleccionado.

**Lo que dice la norma.**
- **Antideportiva (U):** 2 TL + posesión para el rival. Acumular 2 = descalificación.
- **Descalificante (D):** 2 TL + posesión + expulsión inmediata + parte de árbitros.

**Propuesta.** Añadir dos botones más en el ACTPAD bajo la categoría 🤚 Faltas:
- `funsport` "ANT" Antideportiva → 2 TL + posesión, cuenta para DQ.
- `fdq` "DESC" Descalificante → 2 TL + posesión + DQ inmediato.

Cada uno suma a `teamFouls` igual que las otras. Se actualiza `_isDQ()` (ver B-47) para contemplarlas.

---

## 🟢 Nice-to-have y decisiones de UX

### B-51 · Default de TL en falta técnica = 2 (en FIBA actual = 1)

**Estado.** En `openFoulTLModal` y `openTeamTLModal` el default es `defaultTL = isTech ? 2 : 2;` (siempre 2).

**Lo que dice la norma.** Desde la actualización FIBA 2017, una falta técnica = **1 TL** + posesión. Antes eran 2.

**Propuesta.** Cambiar a `defaultTL = isTech ? 1 : 2;`. El usuario puede ajustar manualmente si su liga aplica reglas distintas.

---

### B-52 · Badge BONUS aparece desde la 4ª falta — semántica ambigua

**Estado.** El badge "BONUS" se muestra cuando `teamFouls >= 4`, lo que ocurre **tras** registrar la 4ª falta (la 5ª aún no ha pasado).

**Discusión.** Funciona como aviso predictivo ("la próxima será TL") pero el wording "BONUS" sugiere "ya estamos en bonus". Si lo interpretamos estricto, el bonus se activa **a la 5ª** falta inclusive — entonces el badge debería aparecer desde teamFouls>=5.

**Propuesta.**
- Opción A (mínima): renombrar el badge a "PRÓX = TL" cuando teamFouls=4 y "BONUS" cuando >=5.
- Opción B: dejarlo como está y aclararlo en el manual de usuario (más simple).

---

### B-53 · Ajuste configurable "El reloj se para con falta" (idea de Mario)

**Propuesta de Mario.** Añadir en el modal de creación de partido (o en ⚙️ Ajustes del club) un toggle "🛑 Reloj se para con falta" que, cuando está ON, hace lo del fix B-38 automático.

**Default sugerido por categoría:**
- Sénior, Junior, Cadete → **ON** (FIBA estricto)
- Infantil, Alevín → **ON** (siguen FIBA en mini-básket)
- 3x3 → **OFF** (no aplica, el reloj funciona distinto)
- Otro / recreativo → configurable, default OFF

Esto resuelve B-38 cubriendo a la vez los casos donde el árbitro no para el reloj (informal, recreativo).

---

### B-54 · Sin shot clock de 24 segundos

**Estado.** Kortline no implementa cronómetro de posesión (24"). En sénior y categorías superiores se requiere reglamentariamente.

**Discusión.** Es una funcionalidad bastante grande (hay que sincronizar con cambios de posesión, faltas defensivas que reinician a 14", etc.). Para una app de banquillo (no de mesa) puede no ser necesario. La mesa oficial usa otro dispositivo.

**Propuesta.** Mantener fuera del scope salvo que un club lo pida explícitamente.

---

### B-55 · Sin reglas especiales de "últimos 2 minutos" del Q4/OT

**Estado.** En Kortline el reloj se comporta igual durante todo el partido.

**Lo que dice la norma.** En los últimos 2 min del Q4/OT:
- El reloj **se para con canasta convertida** (no solo con falta).
- Restricciones especiales en TMs (qué equipo puede pedir).

**Propuesta.** Igual que B-54: no crítico para amateur, descartar a menos que se pida.

---

### B-56 · Aviso "30 segundos" no requerido por reglamento

**Estado.** Línea 460 de `tickClock`: `if(s===30) _clockAlert("⚡ 30 segundos");`. No es regla oficial.

**Discusión.** Útil al anotador como aviso. No es bug, no hay que cambiarlo. Sólo lo anoto para constancia.

---

## Resumen ejecutivo

| ID | Severidad | Título corto | Esfuerzo |
|----|-----------|--------------|----------|
| B-38 | 🔴 | Reloj no para con falta | Medio (2 puntos: implementación + ajuste B-53) |
| B-42 | 🔴 | Faltas de equipo en OT resetean | Bajo (3 líneas en `activateOT`) |
| B-47 | 🔴 | 2 técnicas no descalifican | Medio (helper `_isDQ` + 4 sitios) |
| B-48 | 🔴 | ftech de equipo cuenta doble | Trivial (borrar 1 línea) |
| B-44 | 🟡 | Descansos por debajo de FIBA | Bajo (cambiar 2 valores) o Medio (configurable) |
| B-46 | 🟡 | Display TM en OT engaña | Bajo (generalizar `_tmCounts`) |
| B-49 | 🟡 | Sin aviso al entrar en bonus | Bajo (toast en `liveAction`) |
| B-50 | 🟡 | Faltas antideportiva/descalificante | Medio (UI + lógica) |
| B-51 | 🟢 | Default TL técnica = 2 (era 1) | Trivial |
| B-52 | 🟢 | Wording BONUS confuso | Trivial |
| B-53 | 🟢 | Toggle "reloj para con falta" | Medio (UI + persistencia) |

**Mi recomendación para v1.6.13** (release pequeño, alta densidad de fixes):

1. **B-48** trivial, claro fix de bug.
2. **B-42** trivial, claro fix de bug.
3. **B-47** + **B-50** juntos (descalificación correcta + antideportivas/descalificantes).
4. **B-38** + **B-53** juntos: implementar parada con falta y dejarla configurable (default ON sénior).
5. **B-51** trivial.

Esto deja v1.6.13 muy completa contra reglamento FIBA. Lo demás (B-44, B-46, B-49, B-52, B-54, B-55, B-56) puede ir en v1.6.14 o después.

---

## Tests pasados y herramientas usadas

- **Web:** consultas a feb.es, fiba.basketball.
- **Código:** lectura de `tickClock`, `liveAction`, `liveTeamAction`, `_showOTPrompt`, `activateOT`, `_tmCounts`, `addTimeout`, función `liveGame` y modales de TL.
- **Simulación PWA:** Chrome conectado al perfil personal de Mario, datos de prueba (`SÉNIOR TEST` vs `CB HUESCA TEST`, 6 jugadores), partido sénior 4×10. Verificadas en vivo las consecuencias de cada bug 🔴.
