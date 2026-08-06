"use strict";
const { loadApp, newReporter } = require("./harness");

// B-MAGG1: auditoría de exportación a PDF/Excel con datos límite. Bug real
// encontrado: tanto la pestaña "Partidos" en pantalla (stats()) como
// _matchAggRows() (compartida por exportMatchesPDF/exportMatchesExcel)
// hacían Object.entries(mm.live.stats) sin comprobar que existiera. Un
// partido en modo "solo equipo" (m.teamOnlyStats) pasa _hasMatchStats() por
// tener live.teamAgg, pero NUNCA rellena live.stats[pid] -- así que en
// cuanto un equipo tenía un solo partido así en la temporada (mezclado con
// partidos normales con seguimiento por jugador), tanto la pantalla como
// las dos exportaciones reventaban con "Cannot convert undefined or null to
// object" para TODO el equipo, no solo para ese partido.
async function run() {
  const report = newReporter("export_edge_cases");
  const win = await loadApp();
  // jsdom no implementa URL.createObjectURL (usado por jsPDF .save() y
  // XLSX.writeFile() para disparar la descarga) -- se mockea para poder
  // ejecutar las funciones reales hasta el final sin que el guardado en
  // disco (irrelevante aquí) tire la prueba abajo.
  win.URL.createObjectURL = () => "blob:mock";
  win.URL.revokeObjectURL = () => {};

  const noThrow = (label, fn) => {
    let threw = null;
    try {
      fn();
    } catch (e) {
      threw = e;
    }
    report.assert(!threw, label + (threw ? ` (lanzó: ${threw.message})` : ""));
  };

  win.S.teamId = "t1";
  win.S.teams = [{ id: "t1", name: "CB Jaca", category: "Infantil", coaches: [], color: "#f06318" }];
  win.S.players = { t1: [{ id: "p1", name: "Jugadora Uno", number: 4 }] };
  win.S.sessions = {};

  // ── Caso central del bug: un partido "solo equipo" mezclado con uno normal.
  win.S.matches = {
    t1: [
      { id: "m1", date: "2026-08-01", live: { stats: { p1: { p2m: 2, p2a: 1 } } } },
      { id: "m2", date: "2026-08-08", teamOnlyStats: true, live: { teamAgg: { p2m: 10, p2a: 5, ro: 3, to: 2 } } },
    ],
  };
  win.S.statsMonth = null;
  win.S.statsView = "matches";

  noThrow("stats() no lanza con un partido 'solo equipo' mezclado con uno normal", () => win.stats());
  noThrow("exportMatchesPDF no lanza con un partido 'solo equipo' mezclado", () => win.exportMatchesPDF());
  noThrow("exportMatchesExcel no lanza con un partido 'solo equipo' mezclado", () => win.exportMatchesExcel());

  // El partido normal (m1) SÍ debe seguir apareciendo en la agregación por
  // jugador -- el fix debe saltarse SOLO el partido sin live.stats, no
  // romper ni vaciar la agregación de los demás.
  const { rows } = win._matchAggRows();
  report.assert(rows.length === 1 && rows[0].p.id === "p1" && rows[0].a.pj === 1, "el partido normal (m1) sigue agregándose por jugador; el 'solo equipo' (m2) se salta sin más");

  // ── Caso: TODOS los partidos con stats son "solo equipo" (ninguna fila por jugador).
  win.S.matches = { t1: [{ id: "m2", date: "2026-08-08", teamOnlyStats: true, live: { teamAgg: { p2m: 10, p2a: 5 } } }] };
  noThrow("exportMatchesPDF con toast de aviso cuando NO hay filas por jugador (todos son 'solo equipo')", () => win.exportMatchesPDF());
  noThrow("exportTeamKPIsPDF sigue funcionando con partidos 'solo equipo' (usa teamAgg, no live.stats)", () => win.exportTeamKPIsPDF());
  noThrow("exportTeamKPIsExcel sigue funcionando con partidos 'solo equipo'", () => win.exportTeamKPIsExcel());

  // ── Casos generales de datos límite para exportPDF/exportExcel (temporada).
  win.S.matches = { t1: [] };

  win.S.players = { t1: [] };
  win.S.sessions = {};
  noThrow("exportPDF con equipo sin jugadores ni sesiones", () => win.exportPDF());
  noThrow("exportExcel con equipo sin jugadores ni sesiones", () => win.exportExcel());

  win.S.players = { t1: [{ id: "p1", name: "Jugadora Uno", number: 4 }] };
  win.S.sessions = { "t1_2026-08-01": { p1: "present" } };
  win.S.sf = "risk";
  noThrow("exportPDF con filtro de riesgo sin nadie en riesgo", () => win.exportPDF());
  noThrow("exportExcel con filtro de riesgo sin nadie en riesgo", () => win.exportExcel());
  win.S.sf = "all";

  win.S.players = { t1: [{ id: "p1", name: "", number: 0 }] };
  noThrow("exportPDF con jugador de dorsal 0 y nombre vacío", () => win.exportPDF());
  noThrow("exportExcel con jugador de dorsal 0 y nombre vacío", () => win.exportExcel());

  win.S.teams = [{ id: "t1", name: 'C.B. Jacetano "Los Increíbles" 2025/26 — Infantil A/B ÑÑÑ', category: "Infantil", coaches: [], color: "#f06318" }];
  noThrow("exportPDF con nombre de equipo con símbolos raros/tildes/emoji-unsafe", () => win.exportPDF());
  noThrow("exportExcel con nombre de equipo con símbolos raros/tildes", () => win.exportExcel());

  return report.summary();
}

module.exports = { run };
