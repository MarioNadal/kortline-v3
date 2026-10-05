"use strict";
// v3.0.0-dev.86 · B-CONVONLYLIVE1: Mario, tras probar B-LIVECONVGUARD1 (dev.85):
// *"vale, entonces si se anota el partido normal no hay que poner la
// convocatoira anbtes, se hará directamente en el aprtiod. solo se pone la
// convocatoira para poner antes de ver el detalle del partido si se va a
// hacer seugimiento en vivo"*.
//
// Antes de este cambio, `saveMatchMeta()` abría SIEMPRE la convocatoria
// (`openConvSetup()`) justo al crear un partido nuevo, sea el modo que
// fuera -- contradecía esta idea. Confirmado con `AskUserQuestion`: el
// wizard automático solo tiene sentido para el modo "En directo" (y ahí,
// gracias a B-LIVECONVGUARD1, completarlo con 5+ convocados ya continúa
// directo a vivo); en "por cuartos"/"resultado final" se va directo al
// detalle del partido, sin convocatoria obligatoria -- se rellena cuando se
// quiera desde "✏️ Editar".
const { loadApp, buildFixture, newReporter } = require("./harness");

async function run() {
  const report = newReporter("match_create_conv_only_live");
  const assert = (cond, msg) => report.assert(cond, msg);
  const doc_ = (win) => win.document;

  // ═══ 1) Crear partido en modo "por cuartos" (default): NO abre la convocatoria, va directo al detalle ═══
  {
    const win = await loadApp();
    win.S.teamId = "t1";
    win.S.teams = [{ id: "t1", name: "Cadete Masculino", color: "#F06318" }];
    win.S.players = { t1: [] };
    win.S.matches = { t1: [] };
    win.S.screen = "matchList";
    win.render();
    win.openMatchModal(); // "Nuevo Partido", mid="m-add-match", modo por defecto "quarters"
    const doc = doc_(win);
    doc.getElementById("m-add-match-rival").value = "Rival Cuartos";
    win.saveMatchMeta("m-add-match", "");
    const m = win.S.matches.t1[0];
    assert(!!m, "el partido se crea de verdad");
    assert(m.matchMode === "quarters", "se crea con el modo por defecto 'por cuartos'");
    assert(!doc.getElementById("m-conv-setup"), "B-CONVONLYLIVE1: en modo 'por cuartos' NO se abre la convocatoria automáticamente");
    assert(win.S.screen === "matchDetail", "en su lugar, se va directo al detalle del partido recién creado");
    assert(win.S.matchId === m.id, "S.matchId apunta al partido recién creado");
    assert((m.convocados || []).length === 0, "la convocatoria se queda vacía -- no es obligatoria para este modo");
    const t = doc.querySelector(".toast");
    assert(!!t && t.textContent.includes("creado"), "se avisa con un toast de que el partido se creó (ya no lo anunciaba el wizard)");
  }

  // ═══ 2) Crear partido en modo "resultado final": mismo comportamiento que "por cuartos" ═══
  {
    const win = await loadApp();
    win.S.teamId = "t1";
    win.S.teams = [{ id: "t1", name: "Cadete Masculino", color: "#F06318" }];
    win.S.players = { t1: [] };
    win.S.matches = { t1: [] };
    win.S.screen = "matchList";
    win.render();
    win.openMatchModal();
    const doc = doc_(win);
    doc.getElementById("m-add-match-rival").value = "Rival Final";
    win.setMatchModeBtn("m-add-match", "final");
    win.saveMatchMeta("m-add-match", "");
    const m = win.S.matches.t1[0];
    assert(m.matchMode === "final", "se crea con el modo 'resultado final' elegido");
    assert(!doc.getElementById("m-conv-setup"), "tampoco abre la convocatoria en modo 'resultado final'");
    assert(win.S.screen === "matchDetail", "va directo al detalle del partido");
  }

  // ═══ 3) Crear partido en modo "En directo": SIGUE abriendo la convocatoria automáticamente ═══
  {
    const win = await loadApp();
    win.S.teamId = "t1";
    win.S.teams = [{ id: "t1", name: "Cadete Masculino", color: "#F06318" }];
    win.S.players = { t1: [{ id: "p1", name: "Jugadora Test", number: 4 }] };
    win.S.matches = { t1: [] };
    win.S.screen = "matchList";
    win.render();
    win.openMatchModal();
    const doc = doc_(win);
    doc.getElementById("m-add-match-rival").value = "Rival Directo";
    win.setMatchModeBtn("m-add-match", "live");
    win.saveMatchMeta("m-add-match", "");
    const m = win.S.matches.t1[0];
    assert(m.matchMode === "live", "se crea con el modo 'En directo' elegido");
    assert(!!doc.getElementById("m-conv-setup"), "B-CONVONLYLIVE1: en modo 'En directo' SIGUE abriéndose la convocatoria automáticamente, como antes");
    assert(win.S._pendingLiveAfterConv == null, "esta apertura es la del wizard normal de partido nuevo, no la del guard de B-LIVECONVGUARD1 -- no debe quedar marcada como pendiente de continuar a vivo");
  }

  // ═══ 4) Editar un partido existente (cualquier modo): sin cambios -- nunca abría la convocatoria y sigue sin hacerlo ═══
  {
    const win = await loadApp();
    const match = buildFixture(win, { matchMode: "quarters" });
    win.S.screen = "matchDetail";
    win.render();
    win.openMatchModal(match); // "Editar Partido", mid="m-edit-match"
    const doc = doc_(win);
    win.setMatchModeBtn("m-edit-match", "live");
    win.saveMatchMeta("m-edit-match", match.id);
    // Nota: la rama de edición de saveMatchMeta reconstruye el objeto del
    // partido con spread (no muta `match` en sitio), así que hay que volver
    // a leerlo de S.matches para ver el campo actualizado.
    const updated = win.S.matches.t1.find(x => x.id === match.id);
    assert(updated.matchMode === "live", "el modo se actualiza correctamente al editar");
    assert(!doc.getElementById("m-conv-setup"), "editar un partido existente nunca abre la convocatoria automáticamente, ni siquiera cambiando a modo 'En directo' -- sin cambios respecto a antes de este fix");
    assert(win.S.screen === "matchDetail", "editar se queda en matchDetail, como siempre");
  }

  return report.summary();
}

module.exports = { run };
if (require.main === module) { run().then(({ failed }) => process.exit(failed ? 1 : 0)); }
