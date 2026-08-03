"use strict";
const { loadApp, buildFixture, newReporter } = require("./harness");

async function run() {
  const report = newReporter("min5_players");

  // Caso 1: menos de 5 convocados -> liveGame() debe bloquear y NO crear m.live
  {
    const win = await loadApp();
    const match = buildFixture(win, { convocados: ["p1", "p2", "p3"] });
    win.liveGame();
    report.assert(!match.live, "liveGame() no inicializa m.live con solo 3 convocados");
    report.assert(win.S.screen === "matchDetail", "liveGame() redirige a matchDetail si faltan convocados");
  }

  // Caso 2: 0 convocados (partido recien creado, convocatoria saltada)
  {
    const win = await loadApp();
    const match = buildFixture(win, { convocados: [] });
    win.liveGame();
    report.assert(!match.live, "liveGame() no inicializa m.live con 0 convocados");
  }

  // Caso 3: exactamente 5 convocados -> SI debe arrancar (no regresion)
  {
    const win = await loadApp();
    const match = buildFixture(win, { convocados: ["p1", "p2", "p3", "p4", "p5"] });
    win.liveGame();
    report.assert(!!match.live, "liveGame() SI inicializa m.live con exactamente 5 convocados");
    report.assert((match.live.onCourt || []).length === 5, "el quinteto inicial tiene 5 jugadores");
  }

  // Caso 4: partido YA en marcha (m.live existe) con menos de 5 convocados
  // actuales (p.ej. tras alguna baja) no debe bloquear la visualizacion.
  {
    const win = await loadApp();
    const match = buildFixture(win, { convocados: ["p1", "p2", "p3", "p4", "p5"] });
    win.liveGame();
    report.assert(!!match.live, "partido arranca con 5 convocados");
    match.convocados = ["p1", "p2", "p3"];
    win.liveGame();
    report.assert(!!match.live, "un partido YA en marcha no se bloquea aunque la convocatoria actual baje de 5 (solo se bloquea el arranque)");
  }

  return report.summary();
}

module.exports = { run };
