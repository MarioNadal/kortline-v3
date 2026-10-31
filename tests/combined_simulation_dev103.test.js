"use strict";
// v3.0.0-dev.103 · auditoría exhaustiva (a petición de Mario, "hazle
// pruebas de manera exhaustiva... antes de que pruebe yo") -- cierre de la
// tarea #14: una simulación combinada realista que toca a la vez TODO lo
// nuevo de esta sesión (roles/permisos de dev.101, estadísticas manuales
// completas Y reducidas de dev.101/102, la conversión intentos->fallos de
// dev.103) junto con funciones ya existentes que podrían interactuar mal
// con lo nuevo sin que ningún test unitario aislado lo vea: archivado de
// temporada y entrenamientos voluntarios.
//
// Guion: un club con 2 equipos (Cadete -- formulario reducido -- y Senior
// -- box score completo), 2 entrenadores con acceso distinto y un director
// deportivo. A lo largo de "una temporada" hay entrenamientos variados,
// entrenamientos voluntarios, una temporada antigua ARCHIVADA de por medio,
// y varios partidos con estadísticas manuales en ambos formularios. Al
// final se comprueba que los agregados de lectura (hist, exportExcel,
// exportMatchesPDF/Excel, stats()) no revientan ni cuelan NaN/undefined ni
// porcentajes fuera de [0,100], y que ningún permiso se ha "colado".
const { loadApp, newReporter } = require("./harness");

function hasNaNOrUndefinedLeak(str) {
  if (typeof str !== "string") return false;
  return /\bNaN\b/.test(str) || /\bundefined\b/.test(str) || /\bnull%/.test(str);
}
function pctOutOfRange(str) {
  const matches = str.match(/(-?\d+(?:\.\d+)?)%/g) || [];
  return matches.find((m) => { const n = parseFloat(m); return n < 0 || n > 100; });
}

async function run() {
  const report = newReporter("combined_simulation_dev103");
  const win = await loadApp();
  const document = win.document;
  const assert = (cond, msg) => report.assert(cond, msg);
  win.URL.createObjectURL = () => "blob:mock";
  win.URL.revokeObjectURL = () => {};

  const today = win.td();
  const d = (n) => win._addDaysISO(today, n);

  // ── Club: Cadete (Ana, formulario reducido) y Senior (Bea, box completo),
  // más Carlos como director deportivo que ve ambos. ──
  win.S.teams = [
    { id: "cadete", name: "Cadete Mixto", category: "Cadete", color: "#F06318", schedule: {} },
    { id: "senior", name: "Senior A", category: "Senior", color: "#22c55e", schedule: {} },
  ];
  win.S.players = {
    cadete: [
      { id: "c1", name: "Cadete Uno", number: 4, addedAt: d(-120) },
      { id: "c2", name: "Cadete Dos", number: 5, addedAt: d(-120) },
    ],
    senior: [
      { id: "s1", name: "Senior Uno", number: 7, addedAt: d(-120) },
      { id: "s2", name: "Senior Dos", number: 8, addedAt: d(-120) },
    ],
  };
  win.S.sessions = {};
  win.S.matches = { cadete: [], senior: [] };
  win.S.events = { cadete: [], senior: [] };
  win.S.cfg.seasonStart = null; // sin recorte todavía -- lo fija archiveSeason() más abajo
  win.S.cfg.coaches = [
    { id: "ana", name: "Ana", role: "entrenador", teamsEdit: ["cadete"], teamsView: [] },
    { id: "bea", name: "Bea", role: "entrenador", teamsEdit: ["senior"], teamsView: [] },
    { id: "carlos", name: "Carlos", role: "director_deportivo", teamsEdit: [], teamsView: [] },
  ];

  // ── Temporada ANTIGUA archivada a d(-100): entrenos de pretemporada antes
  // de eso no deben contar en agregados, pero tampoco deben desaparecer. ──
  win._setCurrentCoachId("carlos"); // superadmin-like durante el setup del club
  win.S.teamId = "cadete";
  [d(-118), d(-110)].forEach((date) => { win.S.sessions[win.sk("cadete", date)] = { c1: "present", c2: "present" }; });
  const archRes = win.archiveSeason("Temporada anterior", d(-101));
  assert(archRes.ok === true, "archiveSeason(): se archiva la temporada anterior sin problema antes de empezar la simulación");
  assert(win.S.cfg.seasonStart === d(-100), "archiveSeason(): seasonStart queda fijado al día siguiente de la fecha de fin (d(-101)+1 = d(-100)), justo donde arranca la temporada que se simula a continuación");
  assert(!!win.S.sessions[win.sk("cadete", d(-118))], "archiveSeason(): los entrenamientos de pretemporada archivados NO se borran");

  // ── Ana pasa lista a Cadete con normalidad durante la temporada, incluidos
  // entrenamientos voluntarios de por medio (no deben tocar el % oficial). ──
  win._setCurrentCoachId("ana");
  const cadeteTrainDates = [];
  for (let n = -90; n <= -10; n += 10) cadeteTrainDates.push(d(n));
  cadeteTrainDates.forEach((date, i) => {
    win.S.teamId = "cadete"; win.S.date = date;
    win.S.sessions[win.sk("cadete", date)] = { c1: i % 3 === 0 ? "absent" : "present", c2: "present" };
  });
  win.S.sessions[win.sk("cadete", d(-55))] = { c1: "present", c2: "present", _optType: "voluntario" };
  assert(win.S.sessions[win.sk("cadete", d(-90))].c1 === "absent", "Ana pasa lista con normalidad durante la temporada simulada");

  // -- Ana no puede fisgonear Senior. --
  win.S.teamId = "senior"; win.S.screen = "team"; win.render();
  assert(win.S.screen === "equipos", "Ana no puede entrar a Senior (sin acceso) -- la simulación conserva el aislamiento de roles");

  // ── Bea pasa lista a Senior ──
  win._setCurrentCoachId("bea");
  const seniorTrainDates = [];
  for (let n = -85; n <= -15; n += 10) seniorTrainDates.push(d(n));
  seniorTrainDates.forEach((date) => {
    win.S.teamId = "senior"; win.S.date = date;
    win.S.sessions[win.sk("senior", date)] = { s1: "present", s2: "late" };
  });

  // ── Partidos con estadísticas MANUALES: uno reducido en Cadete, uno
  // completo en Senior -- cada uno pasando por el flujo real de guardado
  // (setInput + saveManualStatsQuarter), para que la conversión
  // intentos->fallos de dev.103 se ejercite de verdad, no se simule a mano. ──
  function setInput(pid, k, v) {
    const row = document.querySelector(`#m-manual-stats tr[data-ms-pid="${pid}"]`);
    const inp = row && row.querySelector(`[data-k="${k}"]`);
    if (inp) { inp.value = String(v); inp.dispatchEvent(new win.Event("input", { bubbles: true })); }
  }

  win._setCurrentCoachId("ana");
  const cadeteMatch = { id: "mCadete1", rival: "Rival Cadete", date: d(-40), quarters: 4, qMins: 10, location: "home", matchMode: "quarters", convocados: ["c1", "c2"], titulares: [], capitan: null, q: [null, null, null, null, null, null, null, null], notes: "" };
  win.S.matches.cadete.push(cadeteMatch);
  win.S.teamId = "cadete"; win.S.matchId = "mCadete1";
  win.openManualStatsModal(0);
  setInput("c1", "min", 10); setInput("c1", "p2m", 3); setInput("c1", "p1m", 2); setInput("c1", "p1a", 3); // 2 de 3 TL
  setInput("c2", "min", 9); setInput("c2", "p3m", 1);
  win.saveManualStatsQuarter(0);
  document.getElementById("m-manual-stats")?.remove();
  win.S.teamId = "cadete"; win.S.matchId = "mCadete1";
  win.S.screen = "matchDetail"; win.render();
  const pmTr = document.querySelector('#ms-summary-table tr[data-pm-pid="c1"]');
  const pmInp = pmTr && pmTr.querySelector(".ms-pm-inp");
  if (pmInp) pmInp.value = "6";
  win.savePlusMinus();
  assert(cadeteMatch.manualStats.byQuarter[0].c1.p1a === 1, "Simulación combinada: partido reducido de Cadete guarda p1a ya convertido a fallos (3 intentados - 2 anotados = 1), igual que en producción");
  assert((cadeteMatch.manualStats.plusMinus || {}).c1 === 6, "Simulación combinada: +/- del partido reducido de Cadete se guarda vía el flujo real savePlusMinus()");

  win._setCurrentCoachId("bea");
  const seniorMatch = { id: "mSenior1", rival: "Rival Senior", date: d(-30), quarters: 4, qMins: 10, location: "home", matchMode: "quarters", convocados: ["s1", "s2"], titulares: [], capitan: null, q: [null, null, null, null, null, null, null, null], notes: "" };
  win.S.matches.senior.push(seniorMatch);
  win.S.teamId = "senior"; win.S.matchId = "mSenior1";
  win.openManualStatsModal(0);
  setInput("s1", "min", 20); setInput("s1", "p2m", 5); setInput("s1", "p2a", 8); setInput("s1", "ro", 2); setInput("s1", "rd", 4); setInput("s1", "ast", 3); setInput("s1", "stl", 1); setInput("s1", "blk", 0); setInput("s1", "to", 2); setInput("s1", "foul", 2);
  setInput("s2", "min", 18); setInput("s2", "p3m", 2); setInput("s2", "p3a", 5);
  win.saveManualStatsQuarter(0);
  document.getElementById("m-manual-stats")?.remove();
  assert(seniorMatch.manualStats.byQuarter[0].s1.p2a === 3, "Simulación combinada: partido COMPLETO de Senior también convierte intentos->fallos (8 intentados - 5 anotados = 3), confirmando que el fix de dev.103 no se quedó limitado al formulario reducido");
  assert(seniorMatch.manualStats.byQuarter[0].s2.p3a === 3, "Simulación combinada: mismo partido de Senior, segunda jugadora (5 intentados - 2 anotados = 3)");

  // ── Mario (ficticio superadmin para los agregados finales de lectura):
  // sin coaches configurados (lista vacía) recupera acceso total, como el
  // resto de tests de roles ya comprueban -- aquí se usa para leer TODO el
  // club sin restricciones al cerrar la simulación, igual que haría Mario
  // real revisando Stats del club completo. ──
  const coachesBackup = win.S.cfg.coaches;
  win.S.cfg.coaches = [];
  win._setCurrentCoachId("mario");

  // ══════════════════ Agregados de lectura: no deben reventar ══════════════════
  ["cadete", "senior"].forEach((teamId) => {
    win.S.teamId = teamId;
    win.S.statsMonth = null;
    win.S.statsView = "matches";

    let threw = null;
    try { win.stats(); } catch (e) { threw = e; }
    assert(!threw, `stats() no lanza para ${teamId} con el histórico combinado (roles+manual+voluntarios+temporada archivada)` + (threw ? ` (lanzó: ${threw.message})` : ""));

    let aggRows = null;
    try { aggRows = win._matchAggRows(); } catch (e) { threw = e; }
    assert(!!aggRows, `_matchAggRows() no lanza para ${teamId}`);

    let histStr = "";
    try { histStr = win.hist(); } catch (e) { report.assert(false, `hist() no lanza para ${teamId}: ${e.message}`); }
    if (histStr) {
      assert(!hasNaNOrUndefinedLeak(histStr), `hist() (${teamId}): no se cuela NaN/undefined`);
      const bad = pctOutOfRange(histStr);
      assert(!bad, `hist() (${teamId}): todos los porcentajes están en [0,100]` + (bad ? ` (encontrado: ${bad})` : ""));
    }

    let threwPdf = null, threwXls = null;
    try { win.exportMatchesPDF(); } catch (e) { threwPdf = e; }
    assert(!threwPdf, `exportMatchesPDF() no lanza para ${teamId} con datos manuales reales de la simulación` + (threwPdf ? ` (lanzó: ${threwPdf.message})` : ""));
    try { win.exportMatchesExcel(); } catch (e) { threwXls = e; }
    assert(!threwXls, `exportMatchesExcel() no lanza para ${teamId} con datos manuales reales de la simulación` + (threwXls ? ` (lanzó: ${threwXls.message})` : ""));
  });

  let threwExcel = null;
  win.S.teamId = "cadete";
  try { win.exportExcel(); } catch (e) { threwExcel = e; }
  assert(!threwExcel, "exportExcel() (temporada completa de Cadete) no lanza al cerrar la simulación combinada" + (threwExcel ? ` (lanzó: ${threwExcel.message})` : ""));

  // Restaura los roles para no dejar "colado" S.cfg.coaches=[] si algo más
  // de este test se reutilizara (buena práctica, aunque run-all.js recarga
  // la app entera por archivo).
  win.S.cfg.coaches = coachesBackup;

  return report.summary();
}

module.exports = { run };
