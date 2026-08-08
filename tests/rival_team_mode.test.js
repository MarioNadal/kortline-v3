"use strict";
// v3.0.0-dev.38 · B-RIVAL1: bug real reportado por el usuario -- si el
// rival no tiene jugadores registrados (o menos del mínimo de 5), la
// pantalla de partido en vivo seguía ofreciendo el panel de acciones
// INDIVIDUALES ("¿Quién?"), que solo conoce la plantilla propia -- así
// que una canasta o falta del rival podía acabar apuntada por error a un
// jugador nuestro. Debe pasar a modo equipo (como ya existe y funciona
// para "solo estadísticas de equipo") en cuanto ese lado no llega a 5
// jugadores, igual que exige FIBA para nuestro propio quinteto.
const { loadApp, buildFixture, newReporter } = require("./harness");

async function run() {
  const report = newReporter("rival_team_mode");
  const assert = (cond, msg) => report.assert(cond, msg);
  const win = await loadApp();

  // ── Caso A: rival SIN jugadores registrados ──
  const matchA = buildFixture(win, { rivalPlayers: [], rivalStatsEnabled: true });
  win.S.matchId = "m1";
  win.S.screen = "liveGame";
  win.liveGame(); // inicializa m.live
  win.setActiveTeam("rival");
  let html = win.liveGame();

  assert(html.includes("Modo equipo"), "con el rival sin jugadores, la pestaña Rival muestra el banner de Modo equipo");
  assert(!html.includes('openActionPicker('), "con el rival sin jugadores, NO se ofrece el picker individual (\"¿Quién?\") en la pestaña Rival");
  assert(html.includes("liveTeamAction("), "con el rival sin jugadores, se usan los botones genéricos de modo equipo (liveTeamAction)");

  // Registrar una canasta de 2 estando en la pestaña Rival
  const before = JSON.stringify(matchA.live.stats);
  win.liveTeamAction("p2m", 2);
  assert(matchA.live.qScores[0][1] === 2, "la canasta del rival suma al marcador RIVAL (columna [1])");
  assert((matchA.live.qScores[0][0] || 0) === 0, "la canasta del rival NO suma al marcador propio (columna [0])");
  assert(matchA.live.rivalTeamAgg && matchA.live.rivalTeamAgg.p2m === 1, "queda registrada en live.rivalTeamAgg.p2m");
  assert(JSON.stringify(matchA.live.stats) === before, "las estadísticas de NUESTROS jugadores (live.stats) no se tocan -- antes aquí era donde se colaba por error");

  // El resumen de stats en vivo debe reflejar el agregado, no "sin jugadores"
  const built = win._buildLiveStatsHtml(win.S.teamId, "m1");
  assert(!built.rival.includes("Sin jugadores del rival registrados"), "el resumen de stats en vivo NO dice 'sin jugadores' habiendo datos de equipo registrados");
  assert(built.rival.includes("RIVAL") && built.rival.includes("Modo equipo"), "el resumen de stats en vivo muestra la tabla agregada de equipo para el rival");

  // ── Caso B: rival con plantilla PARCIAL (3 de 5) -- mismo criterio ──
  const win2 = await loadApp();
  const matchB = buildFixture(win2, {
    rivalPlayers: [
      { id: "r1", name: "Rival Uno", number: 4 },
      { id: "r2", name: "Rival Dos", number: 5 },
      { id: "r3", name: "Rival Tres", number: 6 },
    ],
    rivalStatsEnabled: true,
  });
  win2.S.matchId = "m1";
  win2.S.screen = "liveGame";
  win2.liveGame();
  win2.setActiveTeam("rival");
  let htmlB = win2.liveGame();
  assert(htmlB.includes("Modo equipo"), "con 3/5 jugadores del rival (menos del mínimo FIBA), también se usa modo equipo");
  assert(!htmlB.includes('openActionPicker('), "con plantilla parcial del rival, tampoco se ofrece el picker individual");
  assert(htmlB.includes("Rival sin plantilla completa"), "el banner explica que es por plantilla incompleta del rival, no por el modo global de equipo");

  win2.liveTeamAction("foul", 0);
  assert((matchB.live.rivalFouls || [])[0] === 1, "una falta del rival en modo equipo (plantilla parcial) se cuenta igual");

  // ── Caso C: rival CON plantilla completa (5+) -- sigue en modo individual (no regresión) ──
  const win3 = await loadApp();
  const matchC = buildFixture(win3, {
    rivalPlayers: [
      { id: "r1", name: "Rival Uno", number: 4 }, { id: "r2", name: "Rival Dos", number: 5 },
      { id: "r3", name: "Rival Tres", number: 6 }, { id: "r4", name: "Rival Cuatro", number: 7 },
      { id: "r5", name: "Rival Cinco", number: 8 },
    ],
    rivalStatsEnabled: true,
  });
  win3.S.matchId = "m1";
  win3.S.screen = "liveGame";
  win3.liveGame();
  win3.setActiveTeam("rival");
  let htmlC = win3.liveGame();
  assert(!htmlC.includes("Modo equipo"), "con plantilla rival completa (5+), NO se fuerza el modo equipo");
  assert(htmlC.includes('openActionPicker('), "con plantilla rival completa, se mantiene el picker individual (comportamiento previo, sin regresión)");

  // ── Nuestro propio equipo nunca se ve afectado (siempre >=5 convocados) ──
  const win4 = await loadApp();
  const matchD = buildFixture(win4, { rivalPlayers: [], rivalStatsEnabled: true });
  win4.S.matchId = "m1";
  win4.S.screen = "liveGame";
  win4.liveGame(); // activeTeam por defecto = "our"
  let htmlD = win4.liveGame();
  assert(!htmlD.includes("Modo equipo"), "en la pestaña de NUESTRO equipo (rival sin jugadores) seguimos en modo individual con normalidad");
  assert(htmlD.includes('openActionPicker('), "el picker individual sigue disponible para nuestro propio equipo");

  return report.summary();
}

module.exports = { run };
