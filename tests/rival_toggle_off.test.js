"use strict";
// B-RIVAL2: bug real reportado por el usuario -- "el equipo rival no es el
// tuyo, es el otro, aunque el equipo rival sea el local... si quito los
// datos del rival solo me deja hacer los del local, y no es así, es los de
// tu equipo aunque sea visitante". Dos causas encontradas y arregladas:
//
// 1) _buildLiveStatsHtml() y openLandscapeStats() calculaban "¿rival
//    activado?" a partir de si YA había jugadores rivales en la plantilla
//    (m.rivalPlayers.length>0), no del interruptor m.rivalStatsEnabled --
//    así que en cuanto se añadía plantilla rival (necesario para anotar),
//    desactivar el interruptor después no tenía ningún efecto visible ahí.
//
// 2) Si el entrenador estaba viendo/anotando al rival (live.activeTeam
//    ='rival') y DESPUÉS desactivaba el interruptor, los botones para
//    volver a 'our' desaparecen (dependen de rivalEnabled) -- dejando la
//    pantalla atascada mostrando y anotando al RIVAL (que, jugando fuera,
//    es "el local") sin ninguna forma de volver al equipo propio.
const { loadApp, buildFixture, newReporter } = require("./harness");

async function run() {
  const report = newReporter("rival_toggle_off");
  const assert = (cond, msg) => report.assert(cond, msg);
  const win = await loadApp();

  // Partido JUGANDO FUERA (location:"away") -- el rival es "el local".
  const rivalPlayers = [1, 2, 3, 4, 5].map((n) => ({ id: "r" + n, name: "Rival " + n, number: n }));
  const match = buildFixture(win, { location: "away", rivalStatsEnabled: true, rivalPlayers });
  win.S.screen = "liveGame";
  win.liveGame(); // inicializa m.live

  // El entrenador cambia a la pestaña Rival para anotarle.
  win.setActiveTeam("rival");
  assert(match.live.activeTeam === "rival", "setActiveTeam('rival') deja activeTeam en 'rival'");

  const builtBefore = win._buildLiveStatsHtml(win.S.teamId, "m1");
  assert(builtBefore.rivalEnabled === true, "_buildLiveStatsHtml: con el interruptor ON, rivalEnabled es true");

  // ── El entrenador desactiva "Registrar datos del rival" a mitad de partido ──
  match.rivalStatsEnabled = false;

  // _buildLiveStatsHtml y openLandscapeStats ANTES del fix seguían dando
  // rivalEnabled=true aquí porque m.rivalPlayers seguía teniendo 5
  // jugadores -- el interruptor no tenía ningún efecto.
  const builtAfter = win._buildLiveStatsHtml(win.S.teamId, "m1");
  assert(builtAfter.rivalEnabled === false, "_buildLiveStatsHtml: tras desactivar el interruptor, rivalEnabled es false aunque m.rivalPlayers siga teniendo 5 jugadores");

  // Re-renderizar la pantalla en vivo: debe normalizar activeTeam de vuelta
  // a 'our' -- ya no hay forma de elegir 'rival' (los botones dependen de
  // rivalEnabled), así que no puede quedarse atascada en 'rival'.
  const html = win.liveGame();
  assert(match.live.activeTeam === "our", "tras desactivar el interruptor y re-renderizar, activeTeam vuelve a 'our' (ya no atascado en 'rival')");
  assert(!html.includes("setActiveTeam('rival')"), "sin seguimiento de rival, no se ofrece ningún botón para cambiar a 'rival'");
  assert(!html.includes("setActiveTeam('our')"), "sin seguimiento de rival, tampoco se muestra el selector our/rival (no hace falta, solo hay un lado)");

  return report.summary();
}

module.exports = { run };
