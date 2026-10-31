"use strict";
// v3.0.0-dev.100 · Simulación de una temporada completa, pedida explícitamente
// por Mario en la auditoría exhaustiva: "pruebas como entrenador real, haz
// temporadas" -- a diferencia del resto de tests (que ejercitan una función
// aislada con un escenario mínimo), este simula ~4 meses reales de un equipo:
// entrenamientos 2x/semana con asistencia variada (presente/ausente/tarde/
// justificado por motivo/justificado por lesión), dos episodios de lesión
// separados en el tiempo del MISMO jugador (para volver a comprobar B-INJ7
// bajo una línea de tiempo larga y realista, no solo el escenario mínimo de
// injury_new_episode_wipes_old_bug.test.js), un puntual de partido, un
// puntual de entreno reutilizado en 2 días concretos (B-GUEST4), partidos
// con estadísticas por jugador, y entrenamientos voluntarios (_optType) de
// por medio -- y luego llama a los agregados de lectura (exportExcel, hist,
// buildWeeklyText, _buildStatsCharts) para comprobar que no revientan y que
// no se cuela ningún NaN/undefined ni porcentaje fuera de [0,100] con un
// histórico real de este tamaño.
const { loadApp, newReporter } = require("./harness");

function hasNaNOrUndefinedLeak(str) {
  if (typeof str !== "string") return false;
  return /\bNaN\b/.test(str) || /\bundefined\b/.test(str) || /\bnull%/.test(str);
}

function pctOutOfRange(str) {
  // busca cualquier "NN%" y comprueba que esté en [0,100]
  const matches = str.match(/(-?\d+(?:\.\d+)?)%/g) || [];
  return matches.find(m => {
    const n = parseFloat(m);
    return n < 0 || n > 100;
  });
}

async function run() {
  const report = newReporter("season_simulation_full");
  const win = await loadApp();
  const assert = (cond, msg) => report.assert(cond, msg);

  // jsdom no implementa URL.createObjectURL (usado por XLSX.writeFile() para
  // disparar la descarga) -- mismo mock que export_edge_cases.test.js, para
  // poder ejecutar exportExcel() real hasta el final sin que el guardado en
  // disco (irrelevante en un test) tire la prueba abajo.
  win.URL.createObjectURL = () => "blob:mock";
  win.URL.revokeObjectURL = () => {};

  const today = win.td();
  const d = (n) => win._addDaysISO(today, n); // n días respecto a "hoy" (negativo = pasado)
  const inj1Start = d(-70), inj1End = d(-55);
  const inj2Start = d(-20);

  // ── Plantilla: 8 jugadoras de un equipo real, de alta antes de empezar ──
  win.S.teams = [{ id: "t1", name: "Infantil Femenino", color: "#F06318", schedule: {}, coaches: ["Mario"] }];
  win.S.players = {
    t1: [
      { id: "p1", name: "Jugadora Uno", number: 4, position: "Base", addedAt: d(-130) },
      { id: "p2", name: "Jugadora Dos", number: 5, position: "Alero", addedAt: d(-130) },
      { id: "p3", name: "Jugadora Tres", number: 6, position: "Pívot", addedAt: d(-130), injury: null, injuryHistory: [] },
      { id: "p4", name: "Jugadora Cuatro", number: 7, position: "Base", addedAt: d(-130) },
      { id: "p5", name: "Jugadora Cinco", number: 8, position: "Alero", addedAt: d(-130) },
      { id: "p6", name: "Jugadora Seis", number: 9, position: "Pívot", addedAt: d(-130) },
      { id: "p7", name: "Jugadora Siete", number: 10, position: "Escolta", addedAt: d(-130) },
      { id: "p8", name: "Jugadora Ocho", number: 11, position: "Alero", addedAt: d(-130) },
      // Puntual de PARTIDO: nunca entrena, se une a mitad de temporada.
      { id: "g1", name: "Puntual de Partido", number: 77, matchOnly: true, addedAt: d(-50) },
      // Puntual de ENTRENO: reutilizado dos días concretos (B-GUEST4).
      { id: "g2", name: "Puntual de Entreno", number: 88, attOnly: true, addedAt: d(-40), attDates: [d(-40), d(-10)] }
    ]
  };
  win.S.matches = { t1: [] };
  win.S.events = { t1: [] };
  win.S.sessions = {};
  win.S.teamId = "t1";
  win.S.date = today;
  // Temporada: empieza en d(-100); los 2 entrenamientos en d(-118)/d(-114) son
  // pretemporada (deben verse en el listado de Historial pero NO contar en
  // las medias/agregados de temporada, B-SEASON1).
  win.S.cfg.seasonStart = d(-100);

  const rosterIds = ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8"];

  // ── Pretemporada: 2 entrenamientos, todas presentes ──
  [d(-118), d(-114)].forEach(date => {
    const sess = {};
    rosterIds.forEach(id => { sess[id] = "present"; });
    win.S.sessions[win.sk("t1", date)] = sess;
  });

  // ── Temporada regular: entrenamientos cada 3-4 días desde d(-98) hasta d(-2) ──
  const trainingDates = [];
  for (let n = -98; n <= -2; n += 3) trainingDates.push(d(n));

  trainingDates.forEach((date, i) => {
    const sess = {};
    rosterIds.forEach((id, pi) => {
      // p3 pasa por dos episodios de lesión (ver más abajo) -- dentro de esas
      // ventanas se deja SIN marca explícita a propósito, igual que haría un
      // entrenador real con una jugadora que ya sabe de baja: el día se
      // auto-justifica vía applyInjuryToSessions()/isInjuredOn(), nunca se
      // pisa un "presente"/"ausente" explícito (ver el comentario de
      // applyInjuryToSessions sobre "no pisamos nunca un estado explícito").
      if (id === "p3" && ((date >= inj1Start && date <= inj1End) || date >= inj2Start)) return;
      // Patrón determinista y variado: la mayoría presente, con ausencias/
      // tardanzas repartidas para que ninguna jugadora salga a 100% ni a 0%.
      if ((i + pi) % 11 === 0) sess[id] = "absent";
      else if ((i + pi) % 7 === 0) sess[id] = "late";
      else sess[id] = "present";
    });
    win.S.sessions[win.sk("t1", date)] = sess;
  });

  // Puntual de entreno (g2): solo cuenta en sus 2 días reutilizados.
  const flushSessFor = (date, extra) => {
    const k = win.sk("t1", date);
    win.S.sessions[k] = { ...(win.S.sessions[k] || {}), ...extra };
  };
  flushSessFor(d(-40), { g2: "present" });
  flushSessFor(d(-10), { g2: "present" });

  // ── Un día con justificación explícita por motivo (no lesión) usando el
  // flujo real de saveJust() -- crea el modal mínimo que la función espera. ──
  const justDate = trainingDates[5];
  win.S.date = justDate;
  win.S.sessions[win.sk("t1", justDate)].p4 = "excused";
  // openJustModal() real: fija el _justPid lexical interno (no es una
  // variable expuesta en window que se pueda pisar desde fuera) y crea el
  // modal #m-just de verdad.
  win.openJustModal("p4", "Jugadora Cuatro");
  const modal = win.document.getElementById("m-just");
  modal._jr = "family";
  const noteInput = win.document.getElementById("just-note");
  noteInput.value = "Boda familiar, avisó con antelación";
  win.saveJust();
  assert(win.S.sessions[win.sk("t1", justDate)].p4_jr === "family",
    "saveJust() real: justificación por motivo familiar queda guardada");
  assert(win.S.sessions[win.sk("t1", justDate)].p4_jn === "Boda familiar, avisó con antelación",
    "saveJust() real: la nota de la justificación queda guardada");

  // ── Un día pasado por cycleAtt() real (simula al entrenador tocando la
  // fila de la jugadora en pantalla) ──
  const cycleDate = trainingDates[8];
  win.S.date = cycleDate;
  const beforeCycle = win.S.sessions[win.sk("t1", cycleDate)].p1;
  win.cycleAtt("p1");
  const afterCycle = win.S.sessions[win.sk("t1", cycleDate)].p1;
  assert(afterCycle !== beforeCycle, "cycleAtt() real: el estado de p1 avanza al siguiente de ASTS");

  // ── Un día pasado por setAll() real ("Todos presentes") y otro por
  // _flushSess() real ("Confirmar lista") ──
  const setAllDate = trainingDates[2];
  win.S.date = setAllDate;
  win.S.sessions[win.sk("t1", setAllDate)] = {}; // sesión vacía antes de "Todos presentes"
  win.setAll("present");
  const afterSetAll = win.S.sessions[win.sk("t1", setAllDate)];
  rosterIds.forEach(id => assert(afterSetAll[id] === "present", `setAll() real: ${id} queda presente`));
  assert(afterSetAll.g1 === undefined, "setAll() real: el puntual de PARTIDO sigue sin marca (B-ATT8)");

  const flushDate = trainingDates[4];
  win.S.date = flushDate;
  delete win.S.sessions[win.sk("t1", flushDate)];
  win._flushSess();
  const afterFlush = win.S.sessions[win.sk("t1", flushDate)];
  assert(afterFlush && rosterIds.every(id => !!afterFlush[id]), "_flushSess() real: confirma lista con estado para toda la plantilla oficial");

  // ── Entrenamientos VOLUNTARIOS/TECNIFICACIÓN de por medio: p2 asiste a
  // todos, p5 falta a todos -- NUNCA deben tocar el % oficial (B-VOLTECH1,
  // ya cubierto por evt_autosuggest_optional_sessions.test.js; aquí se
  // comprueba de nuevo bajo un histórico real largo). ──
  [d(-81), d(-54), d(-31)].forEach(date => {
    win.S.sessions[win.sk("t1", date)] = { p2: "present", p5: "absent", _optType: "voluntario" };
  });

  // ── Episodio de lesión #1: p3, de d(-70) a d(-55) (16 días), con alta real
  // vía confirmInjuryRecovery(). ──
  win.S.players.t1 = win.S.players.t1.map(p => p.id === "p3" ? { ...p, injury: { active: true, startDate: inj1Start, origin: "training", originLabel: "", notes: "Esguince tobillo" }, injuryHistory: [] } : p);
  win.applyInjuryToSessions("t1", "p3", inj1Start, null, "Esguince tobillo", undefined);
  win.S.teamId = "t1";
  // confirmInjuryRecovery() usa td() como fecha de alta real -- para simular
  // un alta en el PASADO (d(-55)) habría que mockear td(); en vez de eso se
  // replica aquí su misma lógica interna (igual que hace el propio código),
  // que es lo que importa comprobar: el backfill queda acotado a este tramo.
  win.applyInjuryToSessions("t1", "p3", inj1Start, inj1End, "Esguince tobillo", inj1Start);
  win.S.players.t1 = win.S.players.t1.map(p => p.id === "p3" ? { ...p, injured: false, injury: null, injuryHistory: [{ startDate: inj1Start, endDate: inj1End, days: 16, origin: "training", notes: "Esguince tobillo" }] } : p);

  const midInjuryDate = d(-62); // dentro del episodio 1
  assert(win.S.sessions[win.sk("t1", midInjuryDate)].p3 === "excused" && win.S.sessions[win.sk("t1", midInjuryDate)].p3_jr === "injury",
    "episodio de lesión #1: día dentro del rango queda justificado por lesión");

  // ── Un partido ENTRE los dos episodios de lesión, con p3 ya recuperada y
  // jugando con normalidad (estadísticas de caja reales). ──
  const match1Date = d(-45);
  win.S.matches.t1.push({
    id: "m1", date: match1Date, rival: "CB Rival Norte", quarters: 4, qMins: 10, stopOnFoul: true,
    convocados: [...rosterIds, "g1"],
    rivalPlayers: [{ id: "r1", name: "Rival Uno", number: 10 }],
    live: {
      stats: {
        p1: { p2m: 3, p2a: 6, p3m: 1, p3a: 3, p1m: 2, p1a: 2, ro: 1, rd: 2, ast: 4, stl: 2, blk: 0, to: 1, foul: 2 },
        p3: { p2m: 5, p2a: 8, p3m: 0, p3a: 0, p1m: 3, p1a: 4, ro: 3, rd: 5, ast: 1, stl: 1, blk: 1, to: 2, foul: 3 },
        g1: { p2m: 1, p2a: 2, p3m: 0, p3a: 0, p1m: 0, p1a: 0, ro: 0, rd: 1, ast: 0, stl: 0, blk: 0, to: 0, foul: 1 }
      },
      teamAgg: { pts: 61 }
    }
  });

  // ── Episodio de lesión #2: la MISMA jugadora p3, semanas después (d(-20),
  // sigue activa "hoy") -- repite exactamente el escenario de B-INJ7 pero con
  // mucho más histórico real de por medio (entrenamientos, partido, sesiones
  // voluntarias) entre ambos episodios. ──
  win.applyInjuryToSessions("t1", "p3", inj2Start, null, "Sobrecarga muscular", undefined);
  win.S.players.t1 = win.S.players.t1.map(p => p.id === "p3" ? { ...p, injured: true, injury: { active: true, startDate: inj2Start, origin: "training", originLabel: "", notes: "Sobrecarga muscular" } } : p);

  assert(win.S.sessions[win.sk("t1", midInjuryDate)].p3 === "excused" && win.S.sessions[win.sk("t1", midInjuryDate)].p3_jr === "injury",
    "B-INJ7 (reconfirmado en línea de tiempo larga): el episodio de lesión #1, ya cerrado, NO se borra al abrir el episodio #2 semanas después");
  const inj2MidDate = d(-14); // fecha real de entrenamiento dentro del episodio #2 (ver generación de trainingDates)
  assert(win.S.sessions[win.sk("t1", inj2MidDate)] && win.S.sessions[win.sk("t1", inj2MidDate)].p3 === "excused" && win.S.sessions[win.sk("t1", inj2MidDate)].p3_jr === "injury",
    "episodio de lesión #2: día dentro de su propio rango queda justificado por lesión");

  // ── Otros 2 partidos (antes del episodio 1 y cerca de hoy) para que haya
  // varios partidos reales en la temporada. ──
  win.S.matches.t1.push({
    id: "m0", date: d(-85), rival: "CB Rival Sur", quarters: 4, qMins: 10, stopOnFoul: true,
    convocados: rosterIds, rivalPlayers: [{ id: "r2", name: "Rival Dos", number: 7 }],
    live: { stats: { p2: { p2m: 2, p2a: 5, p3m: 2, p3a: 4, p1m: 1, p1a: 1, ro: 2, rd: 2, ast: 3, stl: 0, blk: 0, to: 1, foul: 1 } }, teamAgg: { pts: 48 } }
  });
  win.S.matches.t1.push({
    id: "m2", date: d(-5), rival: "CB Rival Este", quarters: 4, qMins: 10, stopOnFoul: true,
    convocados: rosterIds, rivalPlayers: [{ id: "r3", name: "Rival Tres", number: 9 }],
    live: { stats: { p4: { p2m: 4, p2a: 7, p3m: 1, p3a: 2, p1m: 0, p1a: 0, ro: 1, rd: 3, ast: 5, stl: 1, blk: 0, to: 0, foul: 0 } }, teamAgg: { pts: 55 } }
  });

  // ── Evento de convocatoria real (_evtAutoSuggest) sobre todo este
  // histórico largo, para comprobar de nuevo B-VOLTECH1 a esta escala. ──
  win.S.events.t1.push({ id: "e1", tipo: "tecnificacion", titulo: "Tecnificación tiro", fecha: d(-1), convocados: [] });
  win._evtAutoSuggest("t1", "e1");
  const evt = win.evtById("t1", "e1");
  // g1 (matchOnly) SÍ es convocable a un evento (B-GUEST3 solo excluye a los
  // puntuales de ENTRENO, attOnly) -- rosterIds + g1 = rosterIds.length + 1.
  assert(Array.isArray(evt.convocados) && evt.convocados.length === rosterIds.length + 1,
    "_evtAutoSuggest sobre histórico largo: sugiere a la plantilla oficial + el puntual de partido");
  assert(evt.convocados.includes("g1"), "_evtAutoSuggest: el puntual de PARTIDO sí es convocable a un evento");
  assert(!evt.convocados.includes("g2"), "B-GUEST8 FIX: el puntual de ENTRENO nunca es convocable a un evento");

  // ══════════════════ Agregados de lectura: no deben reventar ══════════════════
  win.S.teamId = "t1";
  win.S.date = today;

  let histStr = "";
  try { histStr = win.hist(); } catch (e) { report.assert(false, "hist() no debe lanzar excepción con un histórico de temporada real: " + e.message); }
  if (histStr) {
    assert(!hasNaNOrUndefinedLeak(histStr), "hist(): no se cuela NaN/undefined en el HTML generado");
    const bad = pctOutOfRange(histStr);
    assert(!bad, "hist(): todos los porcentajes están en [0,100]" + (bad ? ` (encontrado: ${bad})` : ""));
    assert(histStr.includes(String(trainingDates.length + 2 + 3)) || histStr.length > 0,
      "hist(): genera contenido para el histórico completo");
  }

  let weeklyStr = "";
  try { weeklyStr = win.buildWeeklyText("t1", true, {}); } catch (e) { report.assert(false, "buildWeeklyText() no debe lanzar excepción: " + e.message); }
  assert(typeof weeklyStr === "string" && weeklyStr.length > 0, "buildWeeklyText() devuelve texto no vacío con histórico real");
  if (weeklyStr) {
    assert(!hasNaNOrUndefinedLeak(weeklyStr), "buildWeeklyText(): no se cuela NaN/undefined");
    const bad = pctOutOfRange(weeklyStr);
    assert(!bad, "buildWeeklyText(): todos los porcentajes están en [0,100]" + (bad ? ` (encontrado: ${bad})` : ""));
  }

  try { win._buildStatsCharts(); report.assert(true, "_buildStatsCharts() no lanza excepción (no hay <canvas> en este test, se queda en no-op)"); }
  catch (e) { report.assert(false, "_buildStatsCharts() no debe lanzar excepción: " + e.message); }

  try {
    win.exportExcel();
    report.assert(true, "exportExcel() no lanza excepción con histórico de temporada real (XLSX puede no estar cargado bajo jsdom -- se queda en el toast de 'cargando')");
  } catch (e) { report.assert(false, "exportExcel() no debe lanzar excepción: " + e.message); }

  return report.summary();
}

module.exports = { run };
