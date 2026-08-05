"use strict";
// Verifica que las estadisticas AGREGADAS de valoracion (no solo el stepper
// que las registra, ya cubierto en score_and_photo.test.js) salen bien
// calculadas: la media automatica de equipo a partir de las valoraciones
// individuales (_autoTeamScore), la media de temporada por jugador y de
// equipo en stats(), y la media de equipo en hist() -- y que estas dos
// ultimas coinciden entre si cuando no hay ningun filtro de mes aplicado
// (mismo patron de "auditar consistencia entre pantallas" ya usado para el
// bug de asistencia B-ATT1).
const { loadApp, buildFixture, newReporter } = require("./harness");

async function run() {
  const report = newReporter("score_stats_aggregation");
  const assert = (cond, msg) => report.assert(cond, msg);

  const win = await loadApp();
  buildFixture(win);
  win.S.cfg.features.teamScore = true;
  win.S.cfg.features.playerScore = true;

  // ── 3 sesiones con valoraciones individuales conocidas ──
  // Sesion 1: p1=8, p2=6  -> media = 7
  // Sesion 2: p1=10, p2=8, p3=6 -> media = 8
  // Sesion 3: p1=4 -> media = 4
  const dates = ["2026-07-01", "2026-07-08", "2026-07-15"];
  const scores = [
    { p1: 8, p2: 6 },
    { p1: 10, p2: 8, p3: 6 },
    { p1: 4 }
  ];
  dates.forEach((d, i) => {
    const k = win.sk("t1", d);
    const sess = { p1: "present", p2: "present", p3: "present" };
    Object.entries(scores[i]).forEach(([pid, v]) => { sess[pid + "_score"] = v; });
    win.S.sessions[k] = sess;
  });

  // ── _autoTeamScore: la media de equipo se recalcula bien a partir de las
  //    valoraciones individuales de ESA sesion (redondeada) ──
  dates.forEach((d, i) => {
    const k = win.sk("t1", d);
    const sess = { ...win.S.sessions[k] };
    delete sess._teamScoreManual; // modo automatico
    win._autoTeamScore(k, sess);
    const vals = Object.values(scores[i]);
    const expected = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
    assert(sess._teamScore === expected, `_autoTeamScore(${d}) calcula bien la media automática de esa sesión (${expected}, individual: ${vals.join(",")})`);
    win.S.sessions[k]._teamScore = sess._teamScore; // persistir para las siguientes comprobaciones
  });

  // ── stats(): media de temporada por JUGADOR ──
  win.S.teamId = "t1";
  win.S.statsMonth = null;
  win.S.screen = "stats";
  const statsHtml = win.stats();
  // p1: (8+10+4)/3 = 7.33 -> "7.3"
  assert(statsHtml.includes(">7.3<"), "stats(): la media de temporada de p1 (8,10,4 -> 7.3) sale correcta");
  // p2: (6+8)/2 = 7.0 -> "7.0"
  assert(statsHtml.includes(">7.0<"), "stats(): la media de temporada de p2 (6,8 -> 7.0) sale correcta");
  // p3: solo 6 -> "6.0"
  assert(statsHtml.includes(">6.0<"), "stats(): la media de temporada de p3 (solo 6 -> 6.0) sale correcta");

  // ── stats(): media de temporada del EQUIPO ──
  // teamScore por sesión (recalculado arriba): 7, 8, 4 -> media = 19/3 = 6.33 -> "6.3"
  assert(statsHtml.includes("Valoración media del equipo"), "stats() muestra el bloque de valoración media del equipo");
  assert(statsHtml.includes(">6.3<"), "stats(): la media de equipo de toda la temporada (7,8,4 -> 6.3) sale correcta");

  // ── hist(): la media de equipo coincide con la de stats() (sin filtro de mes) ──
  win.S.histMonth = null;
  win.S.screen = "hist";
  const histHtml = win.hist();
  assert(histHtml.includes("6.3★"), "hist(): la media de equipo (sin filtro de mes) coincide con la de stats() -- 6.3, no un número distinto");

  // ── Filtro de mes: stats() y hist() deben coincidir también filtrando ──
  // Todas las sesiones son de julio 2026, así que filtrar a ese mes no debe
  // cambiar el resultado (comprobación de que el filtro no rompe el cálculo).
  win.S.statsMonth = "2026-07";
  const statsHtmlFiltered = win.stats();
  assert(statsHtmlFiltered.includes(">6.3<"), "stats(): filtrando al mes en el que están todas las sesiones, la media de equipo no cambia (6.3)");

  win.S.histMonth = "2026-07";
  const histHtmlFiltered = win.hist();
  assert(histHtmlFiltered.includes("6.3★"), "hist(): idem, filtrando al mismo mes la media de equipo sigue siendo 6.3");

  // ── Un mes SIN sesiones de valoración no debe mostrar el bloque (no 0 falso) ──
  win.S.statsMonth = "2026-01";
  const statsHtmlEmpty = win.stats();
  assert(!statsHtmlEmpty.includes("Valoración media del equipo"), "stats(): un mes sin sesiones de valoración no muestra el bloque (nada de '0.0' engañoso)");

  return report.summary();
}

module.exports = { run };
if (require.main === module) {
  run().then(({ failed }) => process.exit(failed > 0 ? 1 : 0));
}
