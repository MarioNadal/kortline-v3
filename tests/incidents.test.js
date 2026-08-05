"use strict";
// Auditoria del sistema de incidencias (⚠️ Incidencias), que hasta ahora no
// tenia ninguna cobertura de tests. Comprueba el escalado 1a/2a/3a vez /
// reincidencia grave, que editar una incidencia NO recalcula su nivel
// (queda fijado a cuando se creo, por diseño -- para no romper el historico
// de escalado), que borrar actualiza bien el recuento/insignia, y que todo
// esto funciona igual para un jugador puntual/invitado (feature nueva de
// esta sesion) que para uno de plantilla fija.
const { loadApp, buildFixture, newReporter } = require("./harness");

async function run() {
  const report = newReporter("incidents");
  const assert = (cond, msg) => report.assert(cond, msg);

  const win = await loadApp();
  buildFixture(win);
  win.S.cfg.features.incidents = true;
  win.S.teamId = "t1";

  // ── Escalado: 1a, 2a, 3a vez, reincidencia grave ──
  const p1 = win.pl("t1").find(p => p.id === "p1");
  assert(win.incidentLevel(win.incidentCount(p1)) === 1, "sin incidencias previas, la próxima es 1ª vez");

  function addIncident(pid, date) {
    win.openIncidentNewModal(pid);
    const modalId = "m-inc-" + pid;
    win.document.getElementById(modalId + "-date").value = date;
    win.saveIncident(modalId, pid);
  }

  addIncident("p1", "2026-08-01");
  let p1b = win.pl("t1").find(p => p.id === "p1");
  assert(win.incidentCount(p1b) === 1, "tras la 1ª incidencia, el recuento es 1");
  assert(p1b.incidents[0].level === 1, "la 1ª incidencia se guarda con nivel 1 (1ª vez)");

  addIncident("p1", "2026-08-05");
  p1b = win.pl("t1").find(p => p.id === "p1");
  assert(win.incidentCount(p1b) === 2, "tras la 2ª incidencia, el recuento es 2");
  assert(p1b.incidents[1].level === 2, "la 2ª incidencia se guarda con nivel 2 (2ª vez)");

  addIncident("p1", "2026-08-10");
  p1b = win.pl("t1").find(p => p.id === "p1");
  assert(p1b.incidents[2].level === 3, "la 3ª incidencia se guarda con nivel 3 (3ª vez)");

  addIncident("p1", "2026-08-15");
  p1b = win.pl("t1").find(p => p.id === "p1");
  assert(p1b.incidents[3].level === 4, "la 4ª incidencia se guarda con nivel 4 (reincidencia grave)");
  win.openIncidentModal("p1");
  const listHtml = win.document.getElementById("m-incs-p1").innerHTML;
  assert(listHtml.includes("Reincidencia grave"), "la etiqueta de nivel 4 mostrada es 'Reincidencia grave'");
  win.document.getElementById("m-incs-p1").remove();

  // ── Editar NO recalcula el nivel ──
  const incId1 = p1b.incidents[0].id;
  win.openIncidentEditModal("p1", incId1);
  const editModalId = "m-inc-p1";
  win.document.getElementById(editModalId + "-note").value = "Nota editada";
  win.saveIncident(editModalId, "p1", incId1);
  const p1c = win.pl("t1").find(p => p.id === "p1");
  assert(p1c.incidents[0].level === 1, "editar la 1ª incidencia no le cambia el nivel (sigue en 1, no se recalcula a 4)");
  assert(p1c.incidents[0].note === "Nota editada", "editar sí actualiza la nota");
  assert(win.incidentCount(p1c) === 4, "editar no cambia el recuento total (sigue en 4)");

  // ── Borrar actualiza el recuento ──
  const incIdToDelete = p1c.incidents[3].id;
  win.deleteIncident("p1", incIdToDelete);
  const confirmBtn = win.document.querySelector("#m-confirm button");
  assert(!!confirmBtn, "deleteIncident() abre un modal de confirmación antes de borrar");
  confirmBtn._cb();
  const p1d = win.pl("t1").find(p => p.id === "p1");
  assert(win.incidentCount(p1d) === 3, "tras confirmar el borrado, el recuento baja a 3");

  // ── Insignia en team(): cuenta correctamente ──
  win.S.screen = "team";
  const teamHtml = win.team();
  assert(teamHtml.includes(">3</span>") || /title="3 incidencias"/.test(teamHtml), "team() muestra la insignia con el recuento correcto (3) junto al botón de incidencias de p1");

  // ── Funciona igual para un jugador puntual/invitado ──
  win.S.matchId = "m1";
  win.openGuestPlayerModal({ mode: "att" });
  win.document.getElementById("gp-name").value = "Invitado Test";
  win._guestPlayerCommit("att");
  const guest = win.pl("t1").find(p => p.guest === true);
  assert(!!guest, "se crea el jugador puntual correctamente");
  assert(win.incidentLevel(win.incidentCount(guest)) === 1, "un jugador puntual también empieza en nivel 1 (1ª vez) igual que uno de plantilla fija");
  addIncident(guest.id, "2026-08-20");
  const guestAfter = win.pl("t1").find(p => p.id === guest.id);
  assert(win.incidentCount(guestAfter) === 1, "se le puede registrar una incidencia a un jugador puntual sin ningún caso especial roto");

  return report.summary();
}

module.exports = { run };
if (require.main === module) {
  run().then(({ failed }) => process.exit(failed > 0 ? 1 : 0));
}
