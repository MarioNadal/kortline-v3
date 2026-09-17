"use strict";
// v3.0.0-dev.64 · B-GUEST6: bug real reportado por Mario -- al pulsar
// "Fusionar" en el modal de puntuales duplicados, aparecía una pantalla
// "detrás" que había que cancelar para poder pulsar bien el botón real de
// confirmación. Causa: m-guest-dupes usaba z-index:100000, por ENCIMA del
// techo real que usan _confirm()/_confirmTyped() (99999) para sus diálogos
// de confirmación -- así que el propio modal de duplicados tapaba (estando
// por delante en z-index) al diálogo "¿Fusionar N grupos?" que se abre
// encima de él, en vez de quedar por debajo como cualquier otro flujo de
// confirmación de la app. Este test fija que TODOS los modales que pueden
// encadenar un _confirm()/_confirmTyped() se queden estrictamente por debajo
// de su z-index, para que no se repita en otro modal futuro.
const { loadApp, buildFixture, newReporter } = require("./harness");

function zIndexOf(el) {
  const m = /z-index:\s*(\d+)/.exec(el.style.cssText || el.getAttribute("style") || "");
  return m ? parseInt(m[1], 10) : null;
}

async function run() {
  const report = newReporter("guest_dupes_zindex");
  const win = await loadApp();
  const assert = (cond, msg) => report.assert(cond, msg);

  win.S.teams = [{ id: "t1", name: "Cadete Masculino", color: "#F06318" }];
  // Dos entradas con el mismo nombre normalizado -> un grupo de duplicados.
  win.S.players = {
    t1: [
      { id: "g1", name: "Ivan Ara", number: null, guest: true, attOnly: true, addedAt: "2026-08-01" },
      { id: "g2", name: "Iván Ara", number: null, guest: true, attOnly: true, addedAt: "2026-08-08" }
    ]
  };
  win.S.sessions = {};
  win.S.teamId = "t1";

  // ── El techo real de z-index de la app es el de _confirm()/_confirmTyped() ──
  win._confirm("¿Seguro?", "Confirmar", () => {});
  const confirmZ = zIndexOf(win.document.getElementById("m-confirm"));
  win.document.getElementById("m-confirm")?.remove();
  assert(confirmZ === 99999, `_confirm() usa z-index 99999 (techo real de la app), salió ${confirmZ}`);

  // ── m-guest-dupes: debe quedar POR DEBAJO de ese techo ──
  win.openGuestDuplicatesModal();
  const dupesEl = win.document.getElementById("m-guest-dupes");
  assert(!!dupesEl, "openGuestDuplicatesModal() abre su modal con el grupo detectado");
  const dupesZ = zIndexOf(dupesEl);
  assert(dupesZ !== null && dupesZ < confirmZ, `m-guest-dupes (z-index ${dupesZ}) queda POR DEBAJO de _confirm() (${confirmZ}) -- antes era 100000, por ENCIMA`);

  // ── Encadenado real de extremo a extremo: pulsar "Fusionar" abre el
  //    _confirm() y este debe quedar visualmente por delante del modal de
  //    duplicados que lo invocó, no al revés. ──
  win._confirmMergeAllGuestDuplicates();
  const confirmEl = win.document.getElementById("m-confirm");
  assert(!!confirmEl, "_confirmMergeAllGuestDuplicates() abre el diálogo de confirmación real");
  const confirmZ2 = zIndexOf(confirmEl);
  const dupesZ2 = zIndexOf(win.document.getElementById("m-guest-dupes"));
  assert(confirmZ2 > dupesZ2, `el diálogo de confirmación (${confirmZ2}) queda por ENCIMA del modal de duplicados que sigue abierto detrás (${dupesZ2})`);

  // Confirmar de verdad -- la fusión debe seguir funcionando igual que antes.
  confirmEl.querySelector("button").click();
  assert(!win.document.getElementById("m-confirm"), "tras confirmar, el diálogo de confirmación se cierra");
  assert(!win.document.getElementById("m-guest-dupes"), "tras confirmar, el modal de duplicados también se cierra");
  assert(win.S.players.t1.length === 1, "la fusión real se sigue aplicando correctamente (2 entradas -> 1)");

  // ── m-guest-player (mismo origen, mismo fallo latente) también corregido ──
  win.S.date = win.td();
  win.openGuestPlayerModal({ mode: "att" });
  const pickerEl = win.document.getElementById("m-guest-player");
  assert(!!pickerEl, "openGuestPickerModal() abre su modal");
  const pickerZ = zIndexOf(pickerEl);
  assert(pickerZ !== null && pickerZ < confirmZ, `m-guest-player (z-index ${pickerZ}) también queda por debajo del techo de _confirm() (${confirmZ}) -- antes también era 100000`);

  return report.summary();
}

module.exports = { run };
