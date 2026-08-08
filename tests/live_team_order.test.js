"use strict";
// v3.0.0-dev.43 · B-TOGGLE1 (reportado por el usuario, mensaje textual:
// "sigue estando mal el orden cuando un equipo es visitante a la hora de
// darle para anotar sus estadisticas debe estar en el lado derecho del
// visitante no en el de la izquierda siempre por ser de los nuestros...
// dentro de un partido en vivo hablo cuando a los dos equipos se le anotan
// las estadisticas"). Los selectores de "a qué equipo le estoy anotando"
// dentro del partido en vivo (el toggle grande de nuestro equipo/rival, las
// pestañas de la tabla de stats inline, el modal de stats 📊, y la vista
// landscape a pantalla completa) ponían SIEMPRE nuestro equipo primero
// (izquierda), sin importar el campo -- distinto del criterio ya acordado
// con el usuario para todo lo demás (marcador, cuartos): Local siempre
// primero/izquierda. Ahora estos 4 selectores seleccionan también el rival
// primero cuando jugamos fuera (porque el rival es el local), igual que el
// marcador.
const { loadApp, buildFixture, newReporter } = require("./harness");

function idxOf(html, needle) { return html.indexOf(needle); }

async function run() {
  const report = newReporter("live_team_order");
  const assert = (cond, msg) => report.assert(cond, msg);

  // ═══ 1) Toggle grande "equipo activo" + pestañas de stats en liveGame() ═══
  for (const loc of ["home", "away"]) {
    const win = await loadApp();
    buildFixture(win, { location: loc, rivalStatsEnabled: true });
    win.S.screen = "liveGame";
    const html = win.liveGame();

    const iOurToggle = idxOf(html, "setActiveTeam('our')");
    const iRivToggle = idxOf(html, "setActiveTeam('rival')");
    const iOurTab = idxOf(html, "setStatsView('our')");
    const iRivTab = idxOf(html, "setStatsView('rival')");
    assert(iOurToggle !== -1 && iRivToggle !== -1, `[${loc}] liveGame() renderiza el toggle de equipo activo`);
    assert(iOurTab !== -1 && iRivTab !== -1, `[${loc}] liveGame() renderiza las pestañas de stats`);

    if (loc === "home") {
      assert(iOurToggle < iRivToggle, "en casa, el botón de NUESTRO equipo va primero en el toggle (somos locales)");
      assert(iOurTab < iRivTab, "en casa, la pestaña de NUESTRO equipo va primera en las stats");
    } else {
      assert(iRivToggle < iOurToggle, "fuera, el botón del RIVAL va primero en el toggle (el rival es local)");
      assert(iRivTab < iOurTab, "fuera, la pestaña del RIVAL va primera en las stats (el rival es local)");
    }
  }

  // ═══ 2) Modal de stats en vivo (📊) ═══
  for (const loc of ["home", "away"]) {
    const win = await loadApp();
    buildFixture(win, { location: loc, rivalStatsEnabled: true });
    win.S.screen = "liveGame";
    win.liveGame();
    win.openLiveStatsModal();
    const html = win.document.getElementById("m-livestats").innerHTML;
    const iOur = idxOf(html, "_refreshLiveStatsModal('our')");
    const iRiv = idxOf(html, "_refreshLiveStatsModal('rival')");
    assert(iOur !== -1 && iRiv !== -1, `[${loc}] openLiveStatsModal() renderiza el toggle`);
    if (loc === "home") assert(iOur < iRiv, "en casa, el modal de stats pone nuestro equipo primero");
    else assert(iRiv < iOur, "fuera, el modal de stats pone al rival (local) primero");
  }

  // ═══ 3) Vista landscape a pantalla completa ═══
  for (const loc of ["home", "away"]) {
    const win = await loadApp();
    buildFixture(win, { location: loc, rivalStatsEnabled: true });
    win.S.screen = "liveGame";
    win.liveGame();
    win.openLandscapeStats();
    const html = win.document.getElementById("ls-overlay").innerHTML;
    const iOur = idxOf(html, 'id="ls-tab-our"');
    const iRiv = idxOf(html, 'id="ls-tab-riv"');
    assert(iOur !== -1 && iRiv !== -1, `[${loc}] openLandscapeStats() renderiza las pestañas`);
    if (loc === "home") assert(iOur < iRiv, "en casa, la vista landscape pone nuestro equipo primero");
    else assert(iRiv < iOur, "fuera, la vista landscape pone al rival (local) primero");
  }

  return report.summary();
}

module.exports = { run };
