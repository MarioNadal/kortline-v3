"use strict";
// v3.0.0-dev.125 · B-ROSTER2: plantilla con fila limpia + menú (opción A).
const { loadApp, newReporter } = require("./harness.js");
async function run() {
  const r = newReporter("roster_sheet");
  const win = await loadApp(); const doc = win.document;
  win.S.cfg.features.incidents = true;
  win.S.teams = [{ id: "t1", name: "CADETE" }, { id: "t2", name: "OTRO" }];
  win.S.players = { t1: [{ id: "p1", name: "Ana", number: 4 }, { id: "p2", name: "Bea", number: 5, incidents: [{ id: "i1", date: win.td(), text: "x" }] }], t2: [{ id: "q1", name: "Zoe", number: 7 }] };
  win.save(); win.navTo("team", { teamId: "t1" });
  const html = () => doc.getElementById("root").innerHTML;
  r.assert(!/delPlayer\(|openInjuryModal\(|openIncidentModal\(/.test(html()), "B-ROSTER2: la fila ya no lleva ✏️ 🚑 ⚠️ 🗑");
  r.assert(doc.querySelectorAll(".pr-more").length === 2, "B-ROSTER2: un botón ⋯ por jugadora");
  r.assert(/⚠️ 1/.test(doc.querySelectorAll(".pr")[1].textContent), "B-ROSTER2: las incidencias se ven en la fila");
  win.openPlayerSheet("p2");
  const sh = doc.getElementById("m-player-sheet");
  const t = sh && sh.textContent;
  r.assert(sh && /#5 Bea/.test(t) && /Editar datos/.test(t) && /Marcar lesión/.test(t) && /Incidencias \(1\)/.test(t) && /Quitar de la plantilla/.test(t), "B-ROSTER2: el menú tiene Editar, Lesión, Incidencias y Quitar");
  [...sh.querySelectorAll("button")].find(b => /Quitar/.test(b.textContent)).click();
  r.assert(!doc.getElementById("m-player-sheet") && !!doc.getElementById("m-confirm"), "B-ROSTER2: 'Quitar' cierra el menú y pide confirmación");
  doc.getElementById("m-confirm").remove();
  r.assert(win.S.players.t1.length === 2, "B-ROSTER2: sin confirmar no se borra nadie");
  win.openPlayerSheet("p1");
  [...doc.querySelectorAll("#m-player-sheet button")].find(b => /Editar/.test(b.textContent)).click();
  r.assert(!doc.getElementById("m-player-sheet") && /Ana/.test([...doc.querySelectorAll("input")].map(i => i.value).join("|")), "B-ROSTER2: 'Editar datos' abre la ficha de esa jugadora");
  doc.querySelectorAll("body > div[id^='m-']").forEach(x => x.remove());
  // Modo ver
  win.S.cfg.coaches = [{ id: "sa", name: "M", role: "superadmin", teamsEdit: [], teamsView: [] }, { id: "e", name: "L", role: "entrenador", teamsEdit: ["t2"], teamsView: ["t1"] }];
  win._setCurrentCoachId("e"); win.save(); win.navTo("team", { teamId: "t1" });
  r.assert(doc.querySelectorAll(".pr-more").length === 0 && !/openPlayerSheet/.test(html()), "B-ROSTER2: en Modo ver no hay menú");
  win.openPlayerSheet("p1");
  r.assert(!doc.getElementById("m-player-sheet"), "B-ROSTER2: forzarlo en Modo ver no abre nada");
  win.navTo("team", { teamId: "t2" });
  r.assert(doc.querySelectorAll(".pr-more").length === 1, "B-ROSTER2: en su propio equipo sí");
  return r.summary();
}
module.exports = { run };
if (require.main === module) run().then(({ failed }) => process.exit(failed ? 1 : 0));
