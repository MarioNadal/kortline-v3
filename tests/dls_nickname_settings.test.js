"use strict";
// v3.0.0-dev.66 · B-DLS2: dos piezas de UI que dls.test.js no cubre porque
// viven fuera de la pantalla del ejercicio en sí -- la ficha del jugador
// (nuevo campo "Apodo") y Ajustes del club (nuevo selector "Cómo mostrar a
// los jugadores" en Ejercicios en vivo). Ambas alimentan a
// _dlsPlayerLabel/S.cfg.dlsNameMode, ya probados directamente en
// dls.test.js -- este fichero fija que el USUARIO puede de verdad rellenar
// y guardar esos dos campos desde la interfaz.
const { loadApp, buildFixture, newReporter } = require("./harness");

async function run() {
  const report = newReporter("dls_nickname_settings");
  const assert = (cond, msg) => report.assert(cond, msg);

  // ── Ficha del jugador: alta y edición del apodo ──
  {
    const win = await loadApp();
    win.S.teamId = "t1";
    win.S.teams = [{ id: "t1", name: "Equipo", color: "#F06318" }];
    win.S.players = { t1: [] };

    win.openPlayerModal();
    win.document.getElementById("m-add-pl-n").value = "Ana García";
    win.document.getElementById("m-add-pl-nick").value = "Anita";
    win.savePlayer("m-add-pl", "");
    const p = win.S.players.t1[0];
    assert(!!p && p.nickname === "Anita", "savePlayer() guarda el apodo introducido en el alta");
    assert(p.name === "Ana García", "el nombre normal se sigue guardando igual, el apodo es un campo aparte");

    win.openPlayerModal(p);
    assert(win.document.getElementById("m-edit-pl-" + p.id + "-nick").value === "Anita", "al editar, el campo de apodo viene precargado con el valor guardado");
    win.document.getElementById("m-edit-pl-" + p.id + "-nick").value = "";
    win.savePlayer("m-edit-pl-" + p.id, p.id);
    assert(win.S.players.t1[0].nickname === "", "el apodo se puede borrar (queda como cadena vacía, no rompe nada)");

    win.openPlayerModal();
    win.document.getElementById("m-add-pl-n").value = "Sin Apodo";
    win.savePlayer("m-add-pl", "");
    const p2 = win.S.players.t1.find(x => x.name === "Sin Apodo");
    assert(!!p2 && p2.nickname === "", "si no se rellena el campo, el jugador se crea igualmente con apodo vacío (nunca undefined, no rompe _dlsPlayerLabel)");
  }

  // ── Ajustes del club: selector de modo de nombre para Ejercicios ──
  {
    const win = await loadApp();
    win.S.teamId = "t1";
    win.S.teams = [{ id: "t1", name: "Equipo", color: "#F06318" }];
    win.S.players = { t1: [] };

    assert(win.S.cfg.dlsNameMode === "nombre", "por defecto, un club nuevo empieza en modo 'Nombre' (DEFAULT_CFG)");

    win.openClubSettings();
    const sel = win.document.getElementById("cfg-dls-name-mode");
    assert(!!sel, "Ajustes del club incluye el selector 'Cómo mostrar a los jugadores' (sección 🏀 Ejercicios en vivo)");
    assert(sel.value === "nombre", "el selector arranca en el valor ya guardado (Nombre)");
    sel.value = "apodo";
    win.saveClubSettings();
    assert(win.S.cfg.dlsNameMode === "apodo", "saveClubSettings() guarda el modo elegido en S.cfg.dlsNameMode");

    // Reabrir confirma que el valor persiste y se precarga bien la siguiente vez.
    win.openClubSettings();
    assert(win.document.getElementById("cfg-dls-name-mode").value === "apodo", "al reabrir Ajustes, el selector recuerda el modo guardado");
  }

  return report.summary();
}

module.exports = { run };
if (require.main === module) {
  run().then(({ failed }) => process.exit(failed > 0 ? 1 : 0));
}
