"use strict";
const { loadApp, buildFixture, newReporter } = require("./harness");

async function run() {
  const report = newReporter("undo_tl_batch");
  const win = await loadApp();
  const match = buildFixture(win, { rivalPlayers: [{ id: "r1", name: "Rival Uno", number: 10 }] });
  const assert = (cond, msg) => report.assert(cond, msg);
  win.liveGame();

  // Lote de 3 TL nuestros para p1: 2 aciertos, 1 fallo.
  win.openOurFoulTLModal(null, "foul");
  win.selectOurTLShooter("p1");
  win.setOurTLCount(3);
  win.confirmOurTL();
  win.setOurTLResult(0, true);
  win.setOurTLResult(1, true);
  // el 3o queda fallado por defecto
  win.confirmOurTLShoot("p1", 3);

  assert(match.live.stats.p1.p1m === 2 && match.live.stats.p1.p1a === 1, "lote de 3 TL guardado: 2 aciertos, 1 fallo");
  assert(match.live.qScores[0][0] === 2, "el marcador refleja los 2 puntos del lote de TL");
  const logIdx = match.live.log.length - 1;
  const entry = match.live.log[logIdx];
  assert(entry.total === 3 && entry.made === 2 && entry.missed === 1, "la entrada del log guarda total/made/missed del lote");

  // Deshacer con undoLiveAction (usa pop(), la ultima entrada del log)
  win.undoLiveAction();
  assert(match.live.stats.p1.p1m === 0 && match.live.stats.p1.p1a === 0, "undoLiveAction revierte EXACTAMENTE el lote (2 aciertos y 1 fallo), no solo 1");
  assert(match.live.qScores[0][0] === 0, "el marcador vuelve a 0 tras deshacer el lote completo");
  assert(match.live.log.length === logIdx, "la entrada se elimina del log tras deshacer");

  // Repetir el lote y esta vez reasignarlo a otro jugador (p2) desde el Historial.
  win.openOurFoulTLModal(null, "foul");
  win.selectOurTLShooter("p1");
  win.setOurTLCount(2);
  win.confirmOurTL();
  win.setOurTLResult(0, true);
  win.setOurTLResult(1, true);
  win.confirmOurTLShoot("p1", 2);
  const idx2 = match.live.log.length - 1;
  assert(match.live.stats.p1.p1m === 2, "segundo lote (2/2) guardado en p1");

  win.reassignLogEntry(idx2, "p2");
  assert(match.live.stats.p1.p1m === 0, "tras reasignar, p1 pierde los 2 aciertos del lote");
  assert(match.live.stats.p2.p1m === 2, "tras reasignar, p2 gana los 2 aciertos del lote completo (no solo 1)");
  assert(match.live.log[idx2].pid === "p2", "la entrada del log queda apuntando al nuevo jugador");
  assert(match.live.qScores[0][0] === 2, "el marcador no cambia al reasignar (los puntos siguen siendo del equipo)");

  // Borrado puntual (no el ultimo) via deleteLogEntry con indice explicito
  win.liveAction("p3", "p2m", 2); // añadimos una accion mas arriba en el log
  const idx3 = match.live.log.length - 1;
  win.deleteLogEntry(idx3);
  assert(match.live.stats.p3.p2m === 0, "deleteLogEntry por indice revierte correctamente una entrada que no es la ultima del log");

  return report.summary();
}

module.exports = { run };
