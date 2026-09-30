"use strict";
// v3.0.0-dev.79 · B-DLS9: segunda de las tres funciones pedidas por Mario el
// mismo día (ver att_player_note.test.js para la primera) -- "dentro del
// contraataque de 11 poder editar personalizado donde esta cada jugador
// arrastandolo manteniendolo presionado y que se puedan mover", con el
// dorsal visible ("que salga el numero si lo tenemos que eso creo que
// estaba") y el orden guardado por equipo para la próxima sesión ("se
// guarda la personalizacion para el siguiente"). Aclarado con
// AskUserQuestion: el reordenado se aplica en los DOS sitios -- la pantalla
// de configuración (antes de arrancar) y la rejilla en vivo durante el
// ejercicio.
//
// Lo que NO se prueba aquí: el gesto de arrastre real (pointerdown en el
// tirador + pointermove sobre otra fila/tarjeta vía elementFromPoint) --
// igual que el long-press ya existente de _tsLongPressStart no tiene test
// propio, un entorno sin layout real (jsdom) no puede reproducir eso de
// verdad. Lo que SÍ se prueba es toda la lógica de ordenar/aplicar/persistir
// (_dlsOrderedIds/_dlsApplyTeamOrder/_dlsSaveTeamOrder), que el tirador y
// los data-pid existen en el HTML donde deben, y las funciones que
// "confirman un nuevo orden ya calculado" (_dlsSetupRerenderOrder/
// _dlsCommitLiveOrder), llamándolas directamente con un array de ids ya
// reordenado a mano -- exactamente lo que la parte de arrastre real haría
// por su cuenta en un navegador de verdad.
const { loadApp, newReporter } = require("./harness.js");

async function run() {
  const win = await loadApp();
  const report = newReporter("dls_drag_reorder");
  const { document } = win;

  win.S.teamId = "t1";
  win.S.teams = [{ id: "t1", name: "Infantil A", category: "Infantil", coaches: [] }];
  win.S.players = {
    t1: [
      { id: "p1", name: "Ana", number: 4 },
      { id: "p2", name: "Bea", number: 5 },
      { id: "p3", name: "Cata", number: 6 }
    ]
  };
  win.S.drills = { t1: [{ id: "d1", name: "Contraataque de 11", category: "transition", dlsType: "b11" }] };
  win.S.matches = { t1: [] };
  win.S.events = { t1: [] };
  win.S.sessions = {};
  win.S.drillLive = {};
  win.S.date = "2026-09-30";
  win.S.cfg.features.exercises = true;

  // ── _dlsOrderedIds: reordena según el array de referencia, deja al final (en su orden de llegada) lo que no esté en él ──
  report.assert(win._dlsOrderedIds(["p1", "p2", "p3"], ["p3", "p1"]).join(",") === "p3,p1,p2", "_dlsOrderedIds: los ids presentes en 'order' van primero y en ese orden exacto; el resto se queda al final");
  report.assert(win._dlsOrderedIds(["p1", "p2"], []).join(",") === "p1,p2", "_dlsOrderedIds: sin orden guardado (array vacío), no cambia nada");
  report.assert(win._dlsOrderedIds(["p1", "p2"], null).join(",") === "p1,p2", "_dlsOrderedIds: con 'order' null (nunca se ha guardado nada aún) tampoco cambia nada");

  // ── _dlsApplyTeamOrder: usa t.dlsOrder del equipo actual (S.teamId) ──
  const asIds = arr => arr.map(p => p.id).join(",");
  const rosterByNumber = [win.S.players.t1[0], win.S.players.t1[1], win.S.players.t1[2]]; // p1,p2,p3 (orden de dorsal)
  report.assert(asIds(win._dlsApplyTeamOrder(rosterByNumber)) === "p1,p2,p3", "_dlsApplyTeamOrder: sin dlsOrder guardado en el equipo, no toca el orden recibido");
  win.S.teams[0].dlsOrder = ["p3", "p1"];
  report.assert(asIds(win._dlsApplyTeamOrder(rosterByNumber)) === "p3,p1,p2", "_dlsApplyTeamOrder: con dlsOrder guardado, reordena -- p2 (no está en el orden guardado) se queda al final");
  delete win.S.teams[0].dlsOrder;

  // ── _dlsSaveTeamOrder: persiste en el equipo, y descarta los ids de "jugador nuevo" sueltos de una sesión (tmp_...) ──
  win._dlsSaveTeamOrder(["p2", "tmp_abc123", "p1", "p3"]);
  report.assert(win.S.teams[0].dlsOrder.join(",") === "p2,p1,p3", "_dlsSaveTeamOrder: guarda el orden en team.dlsOrder, sin los ids temporales (tmp_...) -- no existen fuera de esa sesión concreta");

  // ── _dlsActiveRoster(): con el orden ya guardado arriba, la pantalla de configuración debe listar a los jugadores en ESE orden ──
  report.assert(asIds(win._dlsActiveRoster()) === "p2,p1,p3", "B-DLS9: _dlsActiveRoster() aplica el orden personalizado del equipo, no el orden por dorsal");

  // ── Un jugador NUEVO (no arrastrado nunca) aparece al final, nunca se pierde ──
  win.S.players.t1.push({ id: "p4", name: "Dana", number: 8 });
  report.assert(asIds(win._dlsActiveRoster()) === "p2,p1,p3,p4", "B-DLS9: un jugador que todavía no está en el orden guardado se añade al final -- nunca desaparece de la lista");

  // ── El tirador de arrastre existe en la pantalla de configuración, uno por fila, con el pid correcto ──
  win.S.screen = "team";
  win.openDlsSetupModal("d1");
  report.assert(!!document.getElementById("m-dls-setup"), "openDlsSetupModal() abre el modal");
  let rosterList = document.getElementById("dls-roster-list");
  let rows = [...rosterList.querySelectorAll("[data-pid]")];
  report.assert(rows.map(r => r.dataset.pid).join(",") === "p2,p1,p3,p4", "la lista del setup respeta el orden personalizado del equipo (con el nuevo jugador al final)");
  report.assert(rosterList.querySelectorAll(".dls-drag-handle").length === 4, "B-DLS9: cada fila del setup lleva su propio tirador de arrastre (.dls-drag-handle)");
  const handle = rosterList.querySelector('[data-pid="p1"] .dls-drag-handle');
  report.assert(!!handle && handle.getAttribute("onpointerdown").includes("'p1'") && handle.getAttribute("onpointerdown").includes("#dls-roster-list") && handle.getAttribute("onpointerdown").includes("'setup'"), "el tirador de Ana referencia su propio pid, la lista del setup y el modo 'setup'");
  report.assert(handle.getAttribute("onclick") === "event.stopPropagation()", "el tirador no dispara el toggle de selección de la fila (stopPropagation en su propio click)");

  // ── Confirmar un nuevo orden ya "calculado" (lo que haría el arrastre real al soltar) ──
  win._dlsSetupRerenderOrder(["p4", "p3", "p2", "p1"]);
  rosterList = document.getElementById("dls-roster-list");
  rows = [...rosterList.querySelectorAll("[data-pid]")];
  report.assert(rows.map(r => r.dataset.pid).join(",") === "p4,p3,p2,p1", "_dlsSetupRerenderOrder repinta la lista en el orden exacto dado");
  report.assert(rosterList.innerHTML.includes("Ana") && rosterList.innerHTML.includes("conv-cb on"), "tras repintar, la selección de jugadores (marcados por defecto) se conserva -- no se pierde nada al reordenar");
  // Esto solo repinta -- todavía NO se ha guardado en el equipo (eso lo hace _dlsSaveTeamOrder al soltar, como en el setup real)
  report.assert(win.S.teams[0].dlsOrder.join(",") === "p2,p1,p3", "_dlsSetupRerenderOrder NO persiste por sí sola -- solo es el feedback visual mientras se arrastra");
  win._dlsSaveTeamOrder(["p4", "p3", "p2", "p1"]);
  report.assert(win.S.teams[0].dlsOrder.join(",") === "p4,p3,p2,p1", "al 'soltar' (_dlsSaveTeamOrder), el nuevo orden sí queda guardado para la próxima vez");

  // ── El dorsal se sigue mostrando en la lista del setup (Mario: "que salga el numero si lo tenemos que eso creo que estaba") ──
  report.assert(rosterList.innerHTML.includes("#4") && rosterList.innerHTML.includes("#5") && rosterList.innerHTML.includes("#6") && rosterList.innerHTML.includes("#8"), "B-DLS9: el dorsal de cada jugador se sigue mostrando en la lista del setup");

  // ── Arrancar la sesión: el orden de b.players sigue el orden guardado del equipo (no el de dorsal) ──
  win._dlsToggleAll(true);
  document.getElementById("dls-minutes").value = "10";
  win.startDls();
  const b = win._dls();
  report.assert(!!b, "startDls() crea la sesión");
  report.assert(b.players.map(p => p.id).join(",") === "p4,p3,p2,p1", "B-DLS9: la sesión que arranca hereda el orden personalizado del equipo, no el orden por dorsal");

  // ── La rejilla en vivo también lleva el tirador, con el pid y el contenedor correctos ──
  let liveHtml = win._dlsLiveCardsHtml(b, b.players);
  report.assert((liveHtml.match(/class="dls-drag-handle"/g) || []).length === 4, "B-DLS9: cada tarjeta de la rejilla en vivo lleva su propio tirador");
  report.assert(liveHtml.includes("_dlsDragHandlePointerDown(event,'p4','#dls-live-grid','live')"), "el tirador de la primera tarjeta (Dana, p4) referencia la rejilla en vivo y el modo 'live'");
  report.assert(liveHtml.includes("#4") && liveHtml.includes("#8"), "B-DLS9: el dorsal también se sigue mostrando en la rejilla en vivo");

  // ── screenDlsLive() usa ese mismo helper y expone el contenedor con id="dls-live-grid" ──
  win.navTo("dlsLive");
  win.render();
  const grid = document.getElementById("dls-live-grid");
  report.assert(!!grid, "screenDlsLive() pinta la rejilla dentro de un contenedor con id='dls-live-grid' (necesario para poder repintar solo la rejilla al arrastrar)");
  report.assert([...grid.querySelectorAll("[data-pid]")].map(r => r.dataset.pid).join(",") === "p4,p3,p2,p1", "la rejilla en vivo respeta el mismo orden que la sesión");

  // ── Confirmar un nuevo orden en vivo (lo que haría _dlsDragPointerUp al soltar) ──
  win._dlsCommitLiveOrder(["p1", "p2", "p3", "p4"]);
  const b2 = win._dls();
  report.assert(b2.players.map(p => p.id).join(",") === "p1,p2,p3,p4", "_dlsCommitLiveOrder reordena b.players DE VERDAD para la sesión en curso");
  report.assert(win.S.teams[0].dlsOrder.join(",") === "p1,p2,p3,p4", "B-DLS9: el nuevo orden confirmado en vivo también se guarda para el equipo (la próxima sesión ya nacerá así)");

  // ── El selector rápido de "¿quién ha hecho X?" hereda el nuevo orden sin tocar nada ahí (ya usa b.players tal cual, B-DLS5) ──
  win.dlsRebound();
  const pickerHtml = document.getElementById("m-dls-picker").innerHTML;
  const pickerOrder = [...pickerHtml.matchAll(/data-pid="(p\d)"/g)].map(m => m[1]);
  report.assert(pickerOrder.join(",") === "p1,p2,p3,p4", "B-DLS9: el selector rápido en vivo (_dlsOpenPicker) hereda el nuevo orden automáticamente, porque ya lee b.players tal cual");
  win._dlsCancelChain();

  // ── Seguridad: _dlsCommitLiveOrder con un array que no cuadra (por si algo raro pasara durante el arrastre) no toca nada ──
  win._dlsCommitLiveOrder(["p1", "p2"]); // le faltan dos jugadores de la sesión real
  const b3 = win._dls();
  report.assert(b3.players.map(p => p.id).join(",") === "p1,p2,p3,p4", "_dlsCommitLiveOrder no aplica un orden que no incluye exactamente a los mismos jugadores de la sesión -- por seguridad, no toca nada en ese caso");

  return report.summary();
}

module.exports = { run };
if (require.main === module) {
  run().then(({ failed }) => process.exit(failed ? 1 : 0));
}
