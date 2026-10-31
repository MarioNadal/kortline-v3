"use strict";
// v3.0.0-dev.101 · B-ROLES1 + B-MANUALSTATS1: simulación realista combinando
// AMBAS funciones nuevas de esta sesión -- un club con 3 equipos, 3
// entrenadores con roles distintos y un director deportivo, a lo largo de
// una semana con entrenamientos, un partido manual (sin directo) y un
// intento de "fisgoneo" entre equipos. El objetivo es cazar bugs de
// INTERACCIÓN entre ambas features que los tests unitarios de cada una por
// separado (roles_permissions.test.js, manual_match_stats.test.js) no
// verían -- por ejemplo, que un entrenador sin acceso a un equipo no pueda
// colarse sus estadísticas de partido por la puerta de atrás, o que el
// director deportivo SÍ pueda consultar (solo lectura) lo que anotó el
// entrenador de otro equipo.
const { loadApp, newReporter } = require("./harness");

async function run() {
  const report = newReporter("roles_and_manual_stats_integration");
  const win = await loadApp();
  const document = win.document;
  const assert = (cond, msg) => report.assert(cond, msg);
  const today = win.td();

  // ── Club con 3 equipos: Cadete (Ana), Infantil (Bea), Senior (sin
  // entrenador fijo, lo lleva el director deportivo Carlos) ──
  win.S.teams = [
    { id: "cadete", name: "Cadete Masculino", color: "#F06318", schedule: {} },
    { id: "infantil", name: "Infantil Femenino", color: "#1a6fc4", schedule: {} },
    { id: "senior", name: "Senior A", color: "#22c55e", schedule: {} }
  ];
  win.S.players = {
    cadete: [{ id: "c1", name: "Cadete Uno", number: 4, addedAt: "2026-07-01" }, { id: "c2", name: "Cadete Dos", number: 5, addedAt: "2026-07-01" }],
    infantil: [{ id: "i1", name: "Infantil Una", number: 6, addedAt: "2026-07-01" }],
    senior: [{ id: "s1", name: "Senior Uno", number: 7, addedAt: "2026-07-01" }, { id: "s2", name: "Senior Dos", number: 8, addedAt: "2026-07-01" }]
  };
  win.S.matches = {}; win.S.events = {}; win.S.sessions = {};
  win.S.cfg.coaches = [
    { id: "ana", name: "Ana", role: "entrenador", teamsEdit: ["cadete"], teamsView: [] },
    { id: "bea", name: "Bea", role: "entrenador", teamsEdit: ["infantil"], teamsView: [] },
    { id: "carlos", name: "Carlos", role: "director_deportivo", teamsEdit: ["senior"], teamsView: [] },
    { id: "mario", name: "Mario", role: "superadmin", teamsEdit: [], teamsView: [] }
  ];

  // ════════════════════════════════════════════════════════════════
  // Lunes: Ana pasa lista a su equipo (Cadete) con normalidad.
  // ════════════════════════════════════════════════════════════════
  win._setCurrentCoachId("ana");
  win.S.teamId = "cadete"; win.S.date = today;
  win.cycleAtt("c1"); win.cycleAtt("c2");
  assert(win.S.sessions[win.sk("cadete", today)].c1 === "absent" && win.S.sessions[win.sk("cadete", today)].c2 === "absent",
    "Ana pasa lista con normalidad en SU equipo (Cadete)");

  // -- Ana intenta "fisgonear" el equipo de Bea (Infantil), al que no tiene
  // ningún acceso -- ni ver ni editar. --
  win.S.teamId = "infantil"; win.S.screen = "team";
  document.querySelectorAll(".toast").forEach(e => e.remove());
  win.render();
  assert(win.S.screen === "equipos", "Ana NUNCA puede entrar a la pantalla del equipo de Bea -- render() la redirige");
  win.S.teamId = "infantil"; // forzado a mano, simulando un intento directo de escritura
  win.cycleAtt("i1");
  assert(win.S.sessions[win.sk("infantil", today)] === undefined,
    "Ana no puede marcar asistencia en Infantil ni forzando S.teamId a mano -- _requireEdit corta en cycleAtt()");

  // ════════════════════════════════════════════════════════════════
  // Martes: Carlos (director deportivo) entrena a Senior Y revisa de pasada
  // el equipo de Ana (Cadete) en solo lectura -- puede VER, no editar.
  // ════════════════════════════════════════════════════════════════
  win._setCurrentCoachId("carlos");
  win.S.teamId = "senior"; win.S.date = today;
  win.cycleAtt("s1");
  assert(win.S.sessions[win.sk("senior", today)].s1 === "absent", "Carlos SÍ puede marcar asistencia en Senior (su equipo)");

  win.S.teamId = "cadete"; win.S.screen = "team";
  win.render();
  assert(win.S.screen === "team", "Carlos SÍ puede entrar a ver Cadete (director deportivo ve TODOS los equipos)");
  const teamHtmlCarlos = win.team();
  assert(teamHtmlCarlos.includes("Cadete Uno") || teamHtmlCarlos.includes("Cadete"),
    "Carlos ve de verdad la plantilla de Cadete al entrar");
  win.cycleAtt("c1"); // ya estaba "absent" (Ana lo dejó así) -- si a Carlos se le dejara, pasaría a "late"
  const sessCadeteAfterCarlos = win.S.sessions[win.sk("cadete", today)];
  assert(sessCadeteAfterCarlos.c1 === "absent", "Carlos NO puede tocar la asistencia de Cadete -- sigue como la dejó Ana (absent), cycleAtt() no hizo nada");

  // ════════════════════════════════════════════════════════════════
  // Miércoles: partido de Senior sin seguimiento en vivo -- Carlos anota
  // las estadísticas del Q1 a mano desde el papel del anotador.
  // ════════════════════════════════════════════════════════════════
  const match = {
    id: "mSenior1", rival: "Rival Senior", date: today, quarters: 4, qMins: 10,
    location: "home", matchMode: "quarters", convocados: ["s1", "s2"], titulares: [], capitan: null,
    q: [22, 19, null, null, null, null, null, null], notes: ""
  };
  win.S.matches.senior = [match];
  win.S.teamId = "senior"; win.S.matchId = "mSenior1";
  win.openManualStatsModal(0);
  assert(!!document.getElementById("m-manual-stats"), "Carlos puede abrir el formulario de estadísticas de SU partido (Senior)");
  function setInput(pid, k, v) {
    const row = document.querySelector(`#m-manual-stats tr[data-ms-pid="${pid}"]`);
    const inp = row && row.querySelector(`[data-k="${k}"]`);
    if (inp) { inp.value = String(v); inp.dispatchEvent(new win.Event("input", { bubbles: true })); }
  }
  setInput("s1", "min", 10); setInput("s1", "p2m", 5); setInput("s1", "p2a", 8);
  setInput("s2", "min", 9); setInput("s2", "p3m", 3); setInput("s2", "p3a", 6);
  win.saveManualStatsQuarter(0);
  assert(match.manualStats.byQuarter[0].s1.p2m === 5 && match.manualStats.byQuarter[0].s2.p3m === 3,
    "Carlos guarda las estadísticas del Q1 de Senior correctamente");

  // -- Ana, que no tiene NINGÚN acceso a Senior, no puede tocar esas
  // estadísticas aunque fuerce S.teamId/S.matchId a mano. --
  win._setCurrentCoachId("ana");
  win.S.teamId = "senior"; win.S.matchId = "mSenior1";
  document.getElementById("m-manual-stats")?.remove();
  const q0Before = JSON.stringify(match.manualStats.byQuarter[0]);
  win.openManualStatsModal(0);
  setInput("s1", "p3m", 9); // intento de manipular, si el modal se abriera
  win.saveManualStatsQuarter(0);
  assert(JSON.stringify(match.manualStats.byQuarter[0]) === q0Before,
    "Ana no puede alterar las estadísticas del partido de Senior (sin acceso a ese equipo) -- saveManualStatsQuarter() lo bloquea");
  document.getElementById("m-manual-stats")?.remove();

  // ════════════════════════════════════════════════════════════════
  // Jueves: Mario (superadmin) revisa Stats del club -- debe ver TODOS los
  // equipos, incluido el partido manual de Senior ya integrado en Stats.
  // ════════════════════════════════════════════════════════════════
  win._setCurrentCoachId("mario");
  win.S.screen = "equipos";
  const eqHtmlMario = win.equiposScreen();
  assert(eqHtmlMario.includes("Cadete Masculino") && eqHtmlMario.includes("Infantil Femenino") && eqHtmlMario.includes("Senior A"),
    "Mario (superadmin) ve los 3 equipos sin excepción");
  assert(eqHtmlMario.includes("openTeamModal()"), "Mario (superadmin) SÍ tiene el botón ＋ de crear equipo");

  win.S.teamId = "senior";
  win.S.statsMonth = "";
  const aggSenior = win._matchAggRows();
  assert(aggSenior.matchList.length === 1, "El partido manual de Senior aparece en el agregado de Stats para Mario, igual que para Carlos");
  const s2Row = aggSenior.rows.find(r => r.p.id === "s2");
  assert(s2Row && s2Row.a.pts === 9, "Stats agregadas: s2 (3 triples en Q1 = 9 puntos) se ve correctamente desde Mario");

  // -- Por último: Mario desactiva los permisos del todo (vacía la lista) y
  // comprueba que TODOS recuperan acceso total -- ninguna de las
  // restricciones de esta semana debe quedar "pegada". --
  win.S.cfg.coaches = [];
  win._setCurrentCoachId("ana");
  assert(win._canEditTeam("infantil") === true && win._canEditTeam("senior") === true,
    "Tras desactivar los permisos por completo, Ana recupera acceso total a TODOS los equipos (comportamiento de siempre)");

  return report.summary();
}

module.exports = { run };
