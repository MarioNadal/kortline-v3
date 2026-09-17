"use strict";
// v3.0.0-dev.65 · B-DELT1: encontrado en la misma tanda de pruebas de casos
// raros del día a día que B-DELP1 (ver roster_delete_cleanup.test.js). El
// propio texto de confirmación de "Eliminar equipo" dice "se borrarán todos
// los jugadores, entrenamientos y partidos", y el código SÍ limpiaba
// jugadores/sesiones/partidos -- pero se dejaba fuera S.events (eventos y
// convocatorias sueltas), S.drills (catálogo de ejercicios del equipo),
// S.drillLive (su historial de estadísticas en vivo, B-DLS1) y
// S.trainingNotes (notas de entreno diarias). Nada de esto vuelve a
// aparecer en ningún sitio una vez borrado el equipo (los ids de equipo son
// aleatorios, nunca se reutilizan) -- simplemente se queda huérfano para
// siempre, ocupando espacio real en Firestore/localStorage. Un caso
// plausible: un club borra un equipo al final de temporada (sube de
// categoría, se fusiona con otro, deja de existir) después de haber usado
// el catálogo de ejercicios, las notas de entreno y algún evento suelto
// durante el curso.
const { loadApp, newReporter } = require("./harness");

async function run() {
  const report = newReporter("team_delete_cleanup");
  const assert = (cond, msg) => report.assert(cond, msg);

  const win = await loadApp();
  win.S.teamId = "t1";
  win.S.teams = [{ id: "t1", name: "Equipo a Extinguir", color: "#F06318" }];
  win.S.players = { t1: [{ id: "p1", name: "Uno", number: 4 }] };
  win.S.sessions = { "t1_2026-09-01": { p1: "present" } };
  win.S.matches = { t1: [{ id: "m1", rival: "Rival", convocados: ["p1"] }] };
  win.S.events = { t1: [{ id: "e1", tipo: "tecnificacion", convocados: ["p1"] }] };
  win.S.drills = { t1: [{ id: "d1", name: "Contraataque", liveStats: true }] };
  win.S.drillLive = { t1: { d1: [{ date: "2026-09-01", actions: [] }] } };
  win.S.trainingNotes = { "t1_2026-09-01": { habitos: [], observaciones: [], focoSemana: "Defensa" } };

  win.delTeam();
  const typedEl = win.document.getElementById("m-confirm-typed");
  assert(!!typedEl, "delTeam() abre la confirmación tipografiada de siempre");
  const input = win.document.getElementById("confirm-typed-input");
  input.value = "equipo a extinguir";
  input.dispatchEvent(new win.Event("input"));
  win.document.getElementById("confirm-typed-btn").click();

  assert(!win.S.teams.some(t => t.id === "t1"), "el equipo desaparece de S.teams");
  assert(!win.S.players.t1, "los jugadores del equipo se borran (comportamiento ya existente)");
  assert(!Object.keys(win.S.sessions).some(k => k.startsWith("t1_")), "las sesiones de asistencia del equipo se borran (comportamiento ya existente)");
  assert(!win.S.matches.t1, "los partidos del equipo se borran (comportamiento ya existente)");

  assert(!win.S.events.t1, "los eventos/convocatorias sueltas del equipo también se borran (antes se quedaban huérfanos)");
  assert(!win.S.drills.t1, "el catálogo de ejercicios del equipo también se borra (antes se quedaba huérfano)");
  assert(!win.S.drillLive.t1, "el historial de estadísticas en vivo de ejercicios también se borra (antes se quedaba huérfano)");
  assert(!Object.keys(win.S.trainingNotes).some(k => k.startsWith("t1_")), "las notas de entreno del equipo también se borran (antes se quedaban huérfanas)");

  return report.summary();
}

module.exports = { run };
if (require.main === module) {
  run().then(({ failed }) => process.exit(failed > 0 ? 1 : 0));
}
