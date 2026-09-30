"use strict";
// v3.0.0-dev.77 · B-HISTWARN1: Mario, justo antes de subir el hotfix de hoy,
// pidió explícitamente un aviso al editar un entrenamiento desde Historial
// que NO sea el de hoy -- "un mensaje de estás cambiando datos que no son
// de hoy, pero siempre que no sea un entrenamiento de hoy". Es solo un aviso
// informativo (no lo pidió como confirmación bloqueante), así que no debe
// cambiar ningún comportamiento de guardado -- solo debe aparecer/desaparecer
// según la fecha que se esté viendo en el pase de lista.
const { loadApp, newReporter } = require("./harness");

async function run() {
  const report = newReporter("att_not_today_banner");
  const win = await loadApp();
  const assert = (cond, msg) => report.assert(cond, msg);

  const today = win.td();
  const yesterday = "2020-01-01"; // cualquier fecha distinta de hoy sirve

  win.S.teams = [{ id: "t1", name: "Equipo Uno", color: "#111", schedule: {} }];
  win.S.players = { t1: [{ id: "p1", name: "Ana", number: 4 }] };
  win.S.matches = { t1: [] };
  win.S.events = { t1: [] };
  win.S.drills = { t1: [] };
  win.S.sessions = {
    [win.sk("t1", today)]: { p1: "present" },
    [win.sk("t1", yesterday)]: { p1: "present" }
  };
  win.S.teamId = "t1";
  win.S.screen = "att";

  // ── 1) Pase de lista de HOY: sin aviso ──
  win.S.date = today;
  win.render();
  let html = win.document.getElementById("root").innerHTML;
  assert(!html.includes("no es el de hoy"), "en el entrenamiento de HOY no aparece ningún aviso de 'no es el de hoy'");

  // ── 2) Pase de lista de OTRO día (típico: entrar desde Historial): sí aparece el aviso ──
  win.S.date = yesterday;
  win.render();
  html = win.document.getElementById("root").innerHTML;
  assert(html.includes("no es el de hoy"), "B-HISTWARN1: en un entrenamiento que NO es hoy, aparece el aviso");
  assert(html.includes("📅"), "el aviso usa el icono de calendario, coherente con el resto de avisos de la app");

  // ── 3) El aviso es solo informativo: no bloquea nada, se puede seguir editando con normalidad ──
  win.cycleAtt("p1");
  assert(win.S.sessions[win.sk("t1", yesterday)].p1 === "absent", "cycleAtt() sigue funcionando con normalidad en un día que no es hoy, el aviso no bloquea nada");
  html = win.document.getElementById("root").innerHTML;
  assert(html.includes("no es el de hoy"), "el aviso se sigue mostrando tras editar, sigue siendo el mismo día");

  // ── 4) Volviendo a HOY (botón "HOY" del selector de fecha) el aviso desaparece ──
  win.S.date = today;
  win.render();
  html = win.document.getElementById("root").innerHTML;
  assert(!html.includes("no es el de hoy"), "al volver a la fecha de hoy, el aviso desaparece");

  return report.summary();
}

module.exports = { run };
if (require.main === module) {
  run().then(({ failed }) => process.exit(failed ? 1 : 0));
}
