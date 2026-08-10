"use strict";
const { loadApp, buildFixture, newReporter } = require("./harness");

// B-DQ5 (continuación): tras arreglar _isDQ() para que también descalifique
// por 5 faltas combinando personales con técnicas/antideportivas, el aviso
// de "un jugador está a una falta de la descalificación" (antes fijo en
// "4ª falta personal", mirando solo st.foul) se quedó desalineado -- un
// jugador con 3 personales + 1 técnica está tan cerca de la
// descalificación como uno con 4 personales puras, pero antes no recibía
// ningún aviso. _foulTroubleMsg() unifica el criterio para ambas ramas
// (nuestro equipo / rival) en un único sitio.
async function run() {
  const report = newReporter("foul_trouble_warning");
  const win = await loadApp();

  report.assert(win._foulTroubleMsg({ foul: 4, ftech: 0, funsport: 0 }) === "4ª falta personal", "4 personales puras: aviso 'personal' de siempre");
  report.assert(win._foulTroubleMsg({ foul: 3, ftech: 1, funsport: 0 }) === "4 faltas en total (a una de la descalificación)", "3 personales + 1 técnica: SÍ avisa (antes no avisaba nunca)");
  report.assert(win._foulTroubleMsg({ foul: 3, ftech: 0, funsport: 1 }) === "4 faltas en total (a una de la descalificación)", "3 personales + 1 antideportiva: SÍ avisa");
  report.assert(win._foulTroubleMsg({ foul: 3, ftech: 0, funsport: 0 }) === null, "3 faltas en total: no avisa todavía");
  report.assert(win._foulTroubleMsg({ foul: 5, ftech: 0, funsport: 0 }) === null, "5 faltas en total: ya no es el aviso de '4', es descalificación (lo gestiona _isDQ, no este helper)");
  report.assert(win._foulTroubleMsg(null) === null, "sin stats todavía: no avisa (defensivo)");

  // Extremo a extremo: 3 personales + 1 técnica sobre un jugador en pista
  // debe disparar el toast de aviso (y NO la descalificación todavía).
  const match = buildFixture(win, {});
  win.S.screen = "liveGame";
  win.liveGame();
  const m = win.mById(win.S.teamId, win.S.matchId);
  const p1 = match.convocados[0];
  win.liveAction(p1, "foul", 0);
  win.liveAction(p1, "foul", 0);
  win.liveAction(p1, "foul", 0);
  win.liveAction(p1, "ftech", 0);
  report.assert(win._isDQ(m.live.stats[p1]) === false, "3 personales + 1 técnica en vivo: todavía NO descalificado (4 en total)");
  report.assert(!win.document.getElementById("m-dqsub"), "3 personales + 1 técnica en vivo: no se abre el modal de sustitución forzosa todavía");

  return report.summary();
}

module.exports = { run };
