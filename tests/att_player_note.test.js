"use strict";
// v3.0.0-dev.78 · B-PLNOTE1: pedido explícito de Mario -- "en el pase de
// lista quiero poder poner si mantengo pulsado un comentario indiviudual de
// ese día del jugador que incluso pueda ser con una nota del día si quiere",
// y que sea privado por defecto pero se pueda incluir en el resumen para
// entrenadores ("Solo para mi pero se puede incluir en el resumen para
// entrenadores si es necesario"). Aquí se prueba directamente contra las
// funciones (no se simula el propio gesto de mantener pulsado con eventos
// pointerdown/pointerup de jsdom -- eso ya lo cubre el patrón existente
// _tsLongPressStart/_tsLongPressEnd, que no tiene test propio tampoco): lo
// que importa es que el modal guarda/borra el campo correcto, que aparece un
// aviso visible en el pase de lista, y que el comentario solo sale en el
// resumen "Interno", nunca en el de "Padres" ni en el resumen semanal.
const { loadApp, newReporter } = require("./harness");

async function run() {
  const report = newReporter("att_player_note");
  const win = await loadApp();
  const assert = (cond, msg) => report.assert(cond, msg);

  const today = win.td();

  win.S.teams = [{ id: "t1", name: "Equipo Uno", color: "#111", schedule: {} }];
  win.S.players = { t1: [{ id: "p1", name: "Ana", number: 4 }, { id: "p2", name: "Bea", number: 7 }] };
  win.S.matches = { t1: [] };
  win.S.events = { t1: [] };
  win.S.drills = { t1: [] };
  win.S.sessions = { [win.sk("t1", today)]: { p1: "present", p2: "present" } };
  win.S.teamId = "t1";
  win.S.date = today;
  win.S.screen = "att";

  // ── 1) Sin comentario: ni badge en el pase de lista ni línea en ningún resumen ──
  win.render();
  let html = win.document.getElementById("root").innerHTML;
  assert(!html.includes("pnote-badge"), "sin comentario guardado, no aparece el badge 📝 en la fila del jugador");
  let daily = win.buildDailyText("t1", today, true, {});
  assert(!daily.includes("Comentarios del día"), "sin comentarios, el resumen Interno no añade la sección de comentarios");

  // ── 2) Guardar un comentario para Ana vía el modal ──
  win.openPlayerNoteModal("p1");
  let modal = win.document.getElementById("m-plnote");
  assert(!!modal, "openPlayerNoteModal('p1') crea el modal");
  assert(modal.innerHTML.includes("Ana"), "el modal muestra el nombre de la jugadora");
  assert(modal.innerHTML.includes("privado"), "el modal deja claro que el comentario es privado por defecto");
  const textarea = win.document.getElementById("plnote-text");
  textarea.value = "Molestia leve en el tobillo, vigilar";
  win.savePlayerNote();
  const key = win.sk("t1", today);
  assert(win.S.sessions[key].p1_note === "Molestia leve en el tobillo, vigilar", "savePlayerNote() guarda el texto en sess[pid+'_note']");
  assert(!win.document.getElementById("m-plnote"), "savePlayerNote() cierra el modal");

  // ── 3) Tras guardar, aparece el badge en el pase de lista, y NO afecta a Bea (otro jugador) ──
  win.render();
  html = win.document.getElementById("root").innerHTML;
  assert(html.includes("pnote-badge"), "B-PLNOTE1: tras guardar un comentario, aparece el badge 📝 en la fila de ese jugador");
  assert(win.S.sessions[key].p2_note === undefined, "el comentario de Ana no afecta al registro de Bea");

  // ── 4) El comentario solo sale en el resumen Interno (showMotivo=true), nunca en el de Padres ──
  daily = win.buildDailyText("t1", today, true, {});
  assert(daily.includes("Comentarios del día"), "el resumen Interno (showMotivo=true) incluye la sección de comentarios");
  assert(daily.includes("Ana: Molestia leve en el tobillo, vigilar"), "el resumen Interno incluye el texto exacto del comentario junto al nombre");
  const dailyParents = win.buildDailyText("t1", today, false, {});
  assert(!dailyParents.includes("Molestia leve"), "B-PLNOTE1: el comentario NUNCA aparece en el resumen de Padres (showMotivo=false)");
  assert(!dailyParents.includes("Comentarios del día"), "el resumen de Padres no añade ni la etiqueta de la sección");

  // ── 5) No se cuela en el resumen semanal (Mario no lo pidió ahí) ──
  const weekly = win.buildWeeklyText("t1", true, {});
  assert(!(weekly && weekly.includes("Molestia leve")), "el comentario individual del día no aparece en el resumen semanal");

  // ── 6) Reabrir el modal ya con texto guardado ofrece quitar el comentario ──
  win.openPlayerNoteModal("p1");
  modal = win.document.getElementById("m-plnote");
  assert(win.document.getElementById("plnote-text").value === "Molestia leve en el tobillo, vigilar", "reabrir el modal precarga el comentario ya guardado");
  assert(modal.innerHTML.includes("Quitar comentario"), "con un comentario ya guardado, el modal ofrece un botón para quitarlo");
  win.clearPlayerNote();
  assert(win.S.sessions[key].p1_note === undefined, "clearPlayerNote() borra sess[pid+'_note'] por completo (no lo deja vacío)");

  // ── 7) Tras borrar, el badge desaparece y cycleAtt() sigue funcionando con normalidad ──
  win.render();
  html = win.document.getElementById("root").innerHTML;
  assert(!html.includes("pnote-badge"), "tras borrar el comentario, el badge 📝 desaparece");
  win.cycleAtt("p1");
  assert(win.S.sessions[key].p1 === "absent", "cycleAtt() sigue funcionando con normalidad, el long-press del comentario no interfiere");

  return report.summary();
}

module.exports = { run };
if (require.main === module) {
  run().then(({ failed }) => process.exit(failed ? 1 : 0));
}
