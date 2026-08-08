"use strict";
// v3.0.0-dev.34 · B-DRILL1: catalogo de ejercicios reutilizables por
// equipo + adjuntarlos a la sesion del pase de lista (planificacion de
// entrenamientos, v1 acotada). Cubre: alta/edicion/borrado en el catalogo,
// adjuntar/quitar de la sesion de hoy, que el borrado del catalogo no
// afecta a sesiones pasadas que ya lo usaron, y que aparece en el texto de
// WhatsApp diario cuando corresponde.
const { loadApp, newReporter } = require("./harness.js");

async function run() {
  const win = await loadApp();
  const report = newReporter("drills");
  const { document } = win;

  win.S.teamId = "t1";
  win.S.teams = [{ id: "t1", name: "Infantil A", category: "Infantil", coaches: ["María"] }];
  win.S.players = { t1: [{ id: "p1", name: "Ana García", number: 4 }] };
  win.S.drills = { t1: [] };
  win.S.sessions = {};
  win.S.date = "2026-08-10";
  win.S.cfg.features.exercises = true;

  // ── Alta de un ejercicio nuevo ──
  win.openDrillModal();
  report.assert(!!document.getElementById("m-add-drill"), "openDrillModal() sin argumentos abre el modal de alta");
  document.getElementById("m-add-drill-name").value = "Rueda de tiro exterior";
  document.getElementById("m-add-drill-cat").value = "shooting";
  document.getElementById("m-add-drill-min").value = "15";
  document.getElementById("m-add-drill-notes").value = "5 estaciones";
  const savedOk = win.saveDrill("m-add-drill", "");
  report.assert(savedOk === true, "saveDrill devuelve true cuando el nombre es valido");
  report.assert(!document.getElementById("m-add-drill"), "el modal se cierra tras guardar");
  report.assert(win.S.drills.t1.length === 1, "el ejercicio se añade al catálogo del equipo");
  const drill1 = win.S.drills.t1[0];
  report.assert(drill1.name === "Rueda de tiro exterior" && drill1.category === "shooting" && drill1.minutes === 15, "el ejercicio guarda nombre/categoría/minutos correctamente");
  report.assert(typeof drill1.id === "string" && drill1.id.length > 0, "el ejercicio tiene un id propio");

  // ── Validacion: nombre vacío no guarda ──
  win.openDrillModal();
  document.getElementById("m-add-drill-name").value = "   ";
  const savedEmpty = win.saveDrill("m-add-drill", "");
  report.assert(savedEmpty === false, "saveDrill rechaza un nombre vacío (solo espacios)");
  report.assert(win.S.drills.t1.length === 1, "un intento de guardado inválido no añade nada al catálogo");
  document.getElementById("m-add-drill")?.remove();

  // ── Edicion ──
  win.openDrillModal(drill1);
  report.assert(document.getElementById("m-edit-drill-name").value === "Rueda de tiro exterior", "editar precarga el nombre actual");
  document.getElementById("m-edit-drill-name").value = "Rueda de tiro exterior (variante)";
  document.getElementById("m-edit-drill-min").value = "20";
  win.saveDrill("m-edit-drill", drill1.id);
  report.assert(win.S.drills.t1[0].name === "Rueda de tiro exterior (variante)", "editar actualiza el nombre sin duplicar el ejercicio");
  report.assert(win.S.drills.t1.length === 1, "editar no crea una segunda entrada");
  report.assert(win.S.drills.t1[0].minutes === 20, "editar actualiza los minutos");

  // ── Adjuntar/quitar de la sesion de hoy ──
  report.assert(win._sessionDrills().length === 0, "la sesión de hoy empieza sin ejercicios adjuntados");
  win.toggleSessionDrill(drill1.id);
  report.assert(win._sessionDrills().length === 1, "toggleSessionDrill adjunta el ejercicio a la sesión de hoy");
  const sessKey = win.sk(win.S.teamId, win.S.date);
  report.assert(win.S.sessions[sessKey].drills[0].name === "Rueda de tiro exterior (variante)", "la sesión guarda una copia (nombre/categoría/minutos), no solo el id");
  win.toggleSessionDrill(drill1.id);
  report.assert(win._sessionDrills().length === 0, "toggleSessionDrill sobre el mismo id lo vuelve a quitar");
  win.toggleSessionDrill(drill1.id); // lo dejamos adjuntado para los siguientes checks

  // ── El texto diario de WhatsApp incluye el catálogo cuando hay algo adjuntado ──
  // Hace falta pase de lista real para que buildDailyText tenga sesion con contenido.
  const sess = win.S.sessions[sessKey];
  sess.p1 = "present";
  const dailyText = win.buildDailyText("t1", win.S.date, true, {});
  report.assert(dailyText.includes("Rueda de tiro exterior (variante)"), "buildDailyText incluye los ejercicios del catálogo adjuntados ese día");

  // ── Borrar del catálogo NO afecta al historial de la sesión ──
  win.deleteDrill(drill1.id);
  const confirmBtn = document.querySelector("#m-confirm button");
  report.assert(!!confirmBtn, "deleteDrill pide confirmación antes de borrar");
  confirmBtn.click();
  report.assert(win.S.drills.t1.length === 0, "confirmar el borrado lo quita del catálogo");
  report.assert(win.S.sessions[sessKey].drills[0].name === "Rueda de tiro exterior (variante)", "la sesión que ya lo usó conserva el nombre aunque se borre del catálogo");

  // ── Picker: lista vacía cuando no hay nada en el catálogo ──
  win.openDrillPickerModal();
  const pickerHtml = document.getElementById("drill-picker-list")?.innerHTML || "";
  report.assert(pickerHtml.includes("Catálogo vacío"), "el picker avisa cuando el catálogo del equipo está vacío");
  document.getElementById("m-drill-picker")?.remove();

  // ── El catálogo y las sesiones viajan por el pipeline de sync (snapshot/diff) ──
  win.S.drills.t1 = [{ id: "dr_x", name: "Defensa 1c1", category: "defense", minutes: 10, notes: "" }];
  const snap = win._snapshotState();
  report.assert(Array.isArray(snap.drills.t1) && snap.drills.t1.length === 1, "_snapshotState() incluye S.drills para que el sync saliente lo suba a Firestore");

  return report.summary();
}

module.exports = { run };
