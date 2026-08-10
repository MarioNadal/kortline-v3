"use strict";
const { loadApp, buildFixture, newReporter } = require("./harness");

// B-REASSIGN1: bug real reportado por el usuario -- "al mover una acción del
// historial, por ejemplo quien ha anotado un tiro libre, en vez de los
// convocados o los disponibles en ese momento en el partido usa toda la
// plantilla". openReassignLogModal() ofrecía pl(S.teamId) sin filtrar --
// jugadores que ni siquiera están convocados a ESTE partido aparecían como
// destino al reasignar una acción. Ahora se restringe a m.convocados, igual
// que el resto de pickers del partido en vivo (banquillo de sustitución,
// panel de tiempo muerto, "quién recibió la falta").
async function run() {
  const report = newReporter("reassign_log_convocados");
  const win = await loadApp();

  buildFixture(win, { convocados: ["p1", "p2", "p3", "p4", "p5"] });
  win.S.screen = "liveGame";
  win.liveGame();
  const match = win.mById(win.S.teamId, win.S.matchId);
  match.live.log = [{ pid: "p1", action: "p2m", pts: 2, q: 1, clockAt: 500, desc: "Ana García anota" }];
  match.live.stats = match.live.stats || {};
  match.live.stats.p1 = { p2m: 1, p2a: 0 };

  win.openReassignLogModal(0);
  const html = win.document.getElementById("m-reassign-log").innerHTML;

  // openReassignLogModal usa _shortName() (solo el primer nombre) en los
  // botones del picker.
  report.assert(html.includes("Bea"), "el picker de reasignar SÍ incluye a un convocado (p2, no fue quien anotó)");
  report.assert(html.includes("Cata") && html.includes("Dana") && html.includes("Eva"), "también incluye al resto de convocados (p3, p4, p5)");
  report.assert(!html.includes("Fina"), "el picker de reasignar NO incluye a un jugador de plantilla que NO está convocado a este partido (p6)");

  win.document.getElementById("m-reassign-log").remove();

  // La reasignación en sí sigue funcionando igual que antes (mueve stats y
  // reescribe la descripción del log) -- este fix es solo del picker.
  win.openReassignLogModal(0);
  win.reassignLogEntry(0, "p2");
  report.assert(match.live.stats.p2.p2m === 1, "reassignLogEntry sigue sumando la estadística al nuevo jugador");
  report.assert((match.live.stats.p1.p2m || 0) === 0, "reassignLogEntry sigue restando la estadística del jugador anterior");
  report.assert(match.live.log[0].pid === "p2", "reassignLogEntry sigue actualizando el pid de la entrada del log");

  return report.summary();
}

module.exports = { run };
