"use strict";
// v3.0.0-dev.83 · B-LIVECONFIRM1: Mario, tras probar el selector de modo de
// partido (B-MATCHMODE1), preguntó: *"pero si le doy a seguimiento en vivo
// sin querer ya no pudeo hacerlo por cuartos, borro y creo otro o como?"* --
// un toque accidental en "🔴 Seguimiento en vivo" entraba DIRECTAMENTE a
// liveGame(), que inicializa m.live sin ningún aviso, y una vez m.live
// existe el marcador por cuartos queda bloqueado en solo lectura para
// siempre en ese partido (sin ningún camino de vuelta atrás) -- la única
// salida real era borrar el partido y crear otro desde cero.
//
// Confirmado con AskUserQuestion: Mario eligió SOLO el aviso de confirmación
// antes de empezar (no un "cancelar directo" después de empezar). Este test
// cubre que ese aviso aparece la primera vez, que cancelarlo no inicializa
// nada, que confirmarlo sí entra al directo, y que "Continuar en vivo" (un
// directo ya empezado) sigue sin pedir nada de más.
const { loadApp, buildFixture, newReporter } = require("./harness");

async function run() {
  const report = newReporter("live_game_start_confirm");
  const assert = (cond, msg) => report.assert(cond, msg);
  const doc_ = (win) => win.document;

  // ═══ 1) Primera vez (sin m.live): startLiveGameConfirm() pide confirmación, NO entra directo ═══
  {
    const win = await loadApp();
    const match = buildFixture(win);
    win.S.screen = "matchDetail";
    win.render();
    win.startLiveGameConfirm();
    const doc = doc_(win);
    const dlg = doc.getElementById("m-confirm");
    assert(!!dlg, "startLiveGameConfirm(): sin m.live, muestra el diálogo de confirmación");
    assert(dlg.innerHTML.includes("seguimiento en vivo"), "el diálogo explica qué se va a empezar");
    assert(dlg.innerHTML.includes("bloqueado"), "el diálogo avisa de que el marcador por cuartos quedará bloqueado");
    assert(!match.live, "mientras el diálogo está abierto sin confirmar, m.live NO se ha inicializado todavía");
    assert(win.S.screen === "matchDetail", "tampoco se ha navegado a la pantalla de directo todavía");
  }

  // ═══ 2) Cancelar el diálogo: no pasa nada, m.live sigue sin existir ═══
  {
    const win = await loadApp();
    const match = buildFixture(win);
    win.S.screen = "matchDetail";
    win.render();
    win.startLiveGameConfirm();
    const doc = doc_(win);
    const cancelBtn = [...doc.querySelectorAll("#m-confirm button")].find(b => b.textContent.includes("Cancelar"));
    assert(!!cancelBtn, "el diálogo tiene un botón de Cancelar");
    cancelBtn.click();
    assert(!doc.getElementById("m-confirm"), "al cancelar, el diálogo se cierra");
    assert(!match.live, "al cancelar, m.live sigue sin existir -- el partido se queda exactamente como estaba");
    assert(win.S.screen === "matchDetail", "al cancelar, no se navega a ningún sitio");
  }

  // ═══ 3) Confirmar el diálogo: SÍ entra al directo y SÍ inicializa m.live ═══
  {
    const win = await loadApp();
    const match = buildFixture(win);
    win.S.screen = "matchDetail";
    win.render();
    win.startLiveGameConfirm();
    const doc = doc_(win);
    const confirmBtn = doc.querySelector("#m-confirm button");
    assert(confirmBtn.textContent.includes("Sí, empezar en directo"), "el primer botón del diálogo es el de confirmar, con el texto esperado");
    confirmBtn.click();
    assert(!doc.getElementById("m-confirm"), "al confirmar, el diálogo se cierra");
    assert(win.S.screen === "liveGame", "al confirmar, SÍ se navega a la pantalla de seguimiento en vivo");
    assert(!!match.live, "al confirmar, SÍ se inicializa m.live (igual que entrar directamente, sin cambiar ese comportamiento)");
  }

  // ═══ 4) Partido YA en directo ("Continuar en vivo"): sin diálogo, entra directo ═══
  {
    const win = await loadApp();
    const match = buildFixture(win);
    win.S.screen = "liveGame";
    win.liveGame(); // inicializa m.live de verdad (igual que live_score_readonly.test.js)
    win.S.screen = "matchDetail";
    win.render();
    win.startLiveGameConfirm();
    const doc = doc_(win);
    assert(!doc.getElementById("m-confirm"), "con m.live ya existente (\"Continuar en vivo\"), NO se pide confirmación de nuevo");
    assert(win.S.screen === "liveGame", "y se navega directo a la pantalla de seguimiento en vivo, como antes de este cambio");
  }

  // ═══ 5) El botón real de matchDetail() llama a la función correcta según el estado ═══
  {
    const win = await loadApp();
    buildFixture(win); // sin m.live
    win.S.screen = "matchDetail";
    const htmlNoLive = win.matchDetail();
    assert(htmlNoLive.includes("startLiveGameConfirm()"), "matchDetail(): sin directo empezado, el botón llama a startLiveGameConfirm() (con aviso)");
    assert(!htmlNoLive.includes("onclick=\"navTo('liveGame')\""), "matchDetail(): sin directo empezado, el botón NO salta directo a liveGame() sin preguntar");

    const win2 = await loadApp();
    buildFixture(win2);
    win2.S.screen = "liveGame";
    win2.liveGame(); // inicializa m.live de verdad
    win2.S.screen = "matchDetail";
    const htmlLive = win2.matchDetail();
    assert(htmlLive.includes("onclick=\"navTo('liveGame')\""), "matchDetail(): con el directo ya empezado (\"Continuar en vivo\"), el botón sigue yendo directo sin preguntar de más");
  }

  return report.summary();
}

module.exports = { run };
if (require.main === module) { run().then(({ failed }) => process.exit(failed ? 1 : 0)); }
