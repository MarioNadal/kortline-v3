"use strict";
const { loadApp, buildFixture, newReporter } = require("./harness");

async function run() {
  const report = newReporter("dorsal_dupe");
  const win = await loadApp();
  buildFixture(win);

  // p1 ya tiene el dorsal 4 (ver harness). Intentamos anadir un jugador
  // nuevo con el mismo dorsal -> debe bloquearse.
  win.openPlayerModal(null);
  const el = win.document.getElementById("m-add-pl");
  report.assert(!!el, "el modal de nuevo jugador se abre");
  win.document.getElementById("m-add-pl-n").value = "Nueva Jugadora";
  win.document.getElementById("m-add-pl-d").value = "4";

  let toasts = [];
  win.toast = (m) => toasts.push(m);
  const ok = win.savePlayer("m-add-pl", "");
  report.assert(ok === false, "savePlayer devuelve false si el dorsal ya esta en uso");
  report.assert(toasts.some(t => /dorsal/i.test(t)), "savePlayer avisa con toast del dorsal duplicado");
  report.assert(win.S.players.t1.length === 6, "no se ha anadido ningun jugador nuevo (sigue habiendo 6)");

  // Mismo dorsal pero editando al PROPIO jugador que ya lo lleva -> debe
  // permitirse (no es un duplicado real).
  win.openPlayerModal(win.S.players.t1[0]);
  const editId = "m-edit-pl-p1";
  win.document.getElementById(editId + "-n").value = "Ana García";
  win.document.getElementById(editId + "-d").value = "4";
  const ok2 = win.savePlayer(editId, "p1");
  report.assert(ok2 === true, "savePlayer SI permite guardar el mismo dorsal que ya llevaba ese jugador (no falso positivo)");

  // Dorsal nuevo, libre -> debe permitirse sin problema.
  win.openPlayerModal(null);
  win.document.getElementById("m-add-pl-n").value = "Otra Jugadora";
  win.document.getElementById("m-add-pl-d").value = "23";
  const ok3 = win.savePlayer("m-add-pl", "");
  report.assert(ok3 === true, "savePlayer permite un dorsal libre (no regresion)");
  report.assert(win.S.players.t1.length === 7, "el jugador con dorsal libre SI se anade");

  return report.summary();
}

module.exports = { run };
