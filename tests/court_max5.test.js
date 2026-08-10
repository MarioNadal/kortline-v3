"use strict";
const { loadApp, buildFixture, newReporter } = require("./harness");

// B-COURT6: revisión de diseño/robustez desde perspectiva de entrenador de
// día a día. subPlayer(inId, null) ("entrada directa" cuando "hay hueco en
// pista") empujaba al jugador a m.live.onCourt sin comprobar cuántos había
// ya -- el botón "→ Pista" solo se pinta cuando onCourt.length<5, pero eso
// es solo una comprobación EN EL RENDER. Un doble toque antes de repintar
// (tablet lenta en la cancha, red de eventos con lag) podía dejar 6
// jugadores "en pista" a la vez, corrompiendo minutos jugados y +/-. Mismo
// patrón que B-ADV2 (descalificado que volvía a pista) -- ese caso ya tenía
// defensa dentro de la función, este no.
async function run() {
  const report = newReporter("court_max5");
  const win = await loadApp();

  const match = buildFixture(win, {});
  win.S.screen = "liveGame";
  win.liveGame();
  const m = win.mById(win.S.teamId, win.S.matchId);

  report.assert(m.live.onCourt.length === 5, "de partida hay 5 jugadoras en pista (setup normal)");

  const bench = match.convocados.find((id) => !m.live.onCourt.includes(id));
  win.subPlayer(bench, null);

  report.assert(m.live.onCourt.length === 5, "subPlayer(id,null) con la pista ya a 5 NO añade una 6ª jugadora");
  report.assert(!m.live.onCourt.includes(bench), "la jugadora del banquillo NO entra si ya no hay hueco");

  return report.summary();
}

module.exports = { run };
