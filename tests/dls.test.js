"use strict";
// v3.0.0-dev.57 · B-DLS1: estadísticas en vivo de ejercicio, como FLAG
// reutilizable (drill.liveStats) de cualquier ejercicio del catálogo del
// equipo -- reemplaza al B-B11-1 anterior (que era fijo, solo
// "Contraataque de 11" y solo accesible desde el pase de lista). Ahora se
// lanza desde "Equipo -> Catálogo de ejercicios" (openDrillLibraryModal),
// NUNCA desde el picker ligado al pase de lista (openDrillPickerModal).
// Cubre: el checkbox "con estadísticas en vivo" en el alta/edición del
// catálogo, el botón de lanzar/continuar en la fila del catálogo, todo el
// flujo de captura (tiros 2/3, rebote, asistencia, pérdida+robo, tapón,
// deshacer), que el pase de lista queda intacto (sin ningún resto del B11
// fijo anterior), y que terminar el ejercicio no borra nada.
const { loadApp, newReporter } = require("./harness.js");

async function run() {
  const win = await loadApp();
  const report = newReporter("dls");
  const { document } = win;

  win.S.teamId = "t1";
  win.S.teams = [{ id: "t1", name: "Infantil A", category: "Infantil", coaches: ["María"] }];
  win.S.players = {
    t1: [
      { id: "p1", name: "Ana García", number: 4 },
      { id: "p2", name: "Bea López", number: 5 },
      { id: "p3", name: "Cata Ruiz", number: 6 },
      { id: "p4", name: "Dana Soto", number: 7, matchOnly: true } // puntual de partido: nunca entrena, no debe entrar en el roster del ejercicio
    ]
  };
  win.S.drills = { t1: [] };
  win.S.sessions = {};
  win.S.drillLive = {};
  win.S.date = "2026-09-16";
  win.S.cfg.features.exercises = true;

  // ── Alta de un ejercicio del catálogo marcado "con estadísticas en vivo" ──
  win.openDrillModal();
  document.getElementById("m-add-drill-name").value = "Contraataque de 11";
  document.getElementById("m-add-drill-cat").value = "transition";
  document.getElementById("m-add-drill-livestats").checked = true;
  win.saveDrill("m-add-drill", "");
  report.assert(win.S.drills.t1.length === 1 && win.S.drills.t1[0].liveStats === true, "el checkbox 'con estadísticas en vivo' se guarda como drill.liveStats");
  const drill = win.S.drills.t1[0];

  // ── Un ejercicio normal (sin el flag) no ofrece el botón de en vivo ──
  win.openDrillModal();
  document.getElementById("m-add-drill-name").value = "Rueda de tiro exterior";
  win.saveDrill("m-add-drill", "");
  const libHtmlBoth = win._drillLibraryRowsHtml();
  report.assert(libHtmlBoth.includes("openDlsSetupModal('" + drill.id + "')"), "un ejercicio con liveStats ofrece el botón 'Iniciar en vivo' en la fila del catálogo");
  const normalDrill = win.S.drills.t1.find(d => d.name === "Rueda de tiro exterior");
  report.assert(!libHtmlBoth.includes("openDlsSetupModal('" + normalDrill.id + "')") && !libHtmlBoth.includes("openDlsResumeOrLive('" + normalDrill.id + "')"), "un ejercicio SIN liveStats no ofrece ningún botón de en vivo");

  // ── El picker ligado al pase de lista NUNCA ofrece el botón de en vivo ──
  win.S.screen = "att";
  const pickerHtml = win._drillPickerListHtml();
  report.assert(!pickerHtml.includes("openDlsSetupModal") && !pickerHtml.includes("openDlsResumeOrLive"), "_drillPickerListHtml() (pase de lista) nunca ofrece lanzar estadísticas en vivo -- eso vive solo en el catálogo del equipo");

  // ── El pase de lista no tiene ningún resto del B11 fijo anterior ──
  const attHtml = win.att();
  report.assert(!attHtml.includes("Contraataque de 11") && !/openB11|openDls/.test(attHtml), "la pantalla de pase de lista (att()) no menciona el ejercicio en vivo en absoluto -- se ha revertido por completo");

  // ── Setup: roster excluye matchOnly, preselecciona a todos los demás ──
  // (se lanza desde la pantalla Equipo, que es su único punto de entrada real)
  win.S.screen = "team";
  win.openDlsSetupModal(drill.id);
  report.assert(!!document.getElementById("m-dls-setup"), "openDlsSetupModal() abre el modal de configuración");
  report.assert(document.querySelector("#m-dls-setup .mtitle").textContent.includes("Contraataque de 11"), "el título del modal usa el nombre real del ejercicio del catálogo");
  report.assert(win._dlsSetup.selected.size === 3, "el roster inicial preselecciona a los 3 jugadores activos (excluye al puntual de partido)");
  report.assert(!win._dlsSetup.selected.has("p4"), "un puntual de partido (matchOnly) no entra en el roster del ejercicio");

  // ── Quitar un jugador y añadir uno temporal (no cuenta) ──
  win._dlsTogglePlayer("p2");
  report.assert(win._dlsSetup.selected.size === 2, "_dlsTogglePlayer quita a un jugador de la selección");
  document.getElementById("dls-temp-name").value = "Invitado suelto";
  win._dlsAddTemp();
  report.assert(win._dlsSetup.temps.length === 1, "_dlsAddTemp añade un jugador temporal a la lista");

  // ── Configurar checklist y minutos, empezar ──
  document.getElementById("dls-chk-ast").checked = true;
  document.getElementById("dls-chk-blk").checked = false;
  document.getElementById("dls-minutes").value = "10";
  win.startDls();
  report.assert(!document.getElementById("m-dls-setup"), "startDls cierra el modal de configuración");
  report.assert(win.S.screen === "dlsLive", "startDls navega a la pantalla en vivo");
  const b = win._dls();
  report.assert(!!b, "_dls() devuelve la sesión recién creada");
  report.assert(b.drillId === drill.id && b.drillName === "Contraataque de 11", "la sesión guarda el id y una copia del nombre del ejercicio del catálogo");
  report.assert(b.date === win.td(), "la sesión se fecha con el día en que se lanza");
  report.assert(win.S.drillLive.t1[drill.id][0] === b, "la sesión se guarda en S.drillLive[teamId][drillId], no en S.sessions");
  report.assert(b.status === "running", "la sesión arranca en estado 'running'");
  report.assert(b.durationSec === 600 && b.remainingSec === 600, "la duración configurada (10 min) se guarda en segundos");
  report.assert(b.checklist.ast === true && b.checklist.blk === false, "el checklist de asistencias/tapones respeta lo marcado en el setup");
  report.assert(b.players.length === 3, "la sesión guarda 2 jugadores del roster + 1 temporal = 3 participantes");
  report.assert(b.players.some(p => p.id === "p2") === false, "el jugador deseleccionado (p2) no participa en la sesión");
  const tempP = b.players.find(p => p.temp);
  report.assert(!!tempP && tempP.name === "Invitado suelto", "el jugador temporal entra en la sesión con su nombre");
  report.assert(!win.S.players.t1.some(p => p.name === "Invitado suelto"), "el jugador temporal NO se añade a la plantilla real del equipo (no cuenta para nada fuera de esta sesión)");
  Object.keys(b.stats).forEach(pid => {
    const st = b.stats[pid];
    report.assert(st.p2m === 0 && st.reb === 0 && st.to === 0, "cada jugador arranca con estadísticas a 0 (" + pid + ")");
  });

  // ── Tiro anotado de 2 → encadena asistencia → encadena rebote ──
  win.dlsShot(2, true);
  report.assert(!!document.getElementById("m-dls-picker"), "dlsShot abre el selector de '¿quién anotó?'");
  win._dlsPickerConfirm("p1");
  report.assert(win._dls().stats.p1.p2m === 1, "anotar +2 incrementa p2m del jugador elegido");
  report.assert(!!document.getElementById("m-dls-picker"), "tras anotar (con checklist.ast activo) se encadena el selector de asistencia");
  win._dlsPickerSkip(); // sin asistencia
  report.assert(win._dls().stats.p1.ast === 0 && win._dls().stats.p3.ast === 0, "saltar la asistencia no suma nada a nadie");
  report.assert(!!document.getElementById("m-dls-picker"), "tras la asistencia (u omitirla) se encadena el selector de rebote");
  win._dlsPickerConfirm("p3");
  report.assert(win._dls().stats.p3.reb === 1, "elegir jugador en el selector de rebote suma reb a quien lo coge");
  report.assert(!document.getElementById("m-dls-picker"), "el selector se cierra tras completar la cadena");

  // ── Tiro fallado de 3 → encadena rebote directamente (sin asistencia) ──
  win.dlsShot(3, false);
  win._dlsPickerConfirm("p3");
  report.assert(win._dls().stats.p3.p3a === 1, "fallar de 3 incrementa p3a del jugador elegido");
  report.assert(!!document.getElementById("m-dls-picker"), "un fallo también encadena el selector de rebote (no solo el acierto)");
  win._dlsPickerSkip();
  report.assert(win._dls().stats.p3.reb === 1, "saltar el rebote no suma un segundo rebote de más");

  // ── Pérdida → encadena robo, con opción de omitir ──
  win.dlsTurnover();
  win._dlsPickerConfirm("p1");
  report.assert(win._dls().stats.p1.to === 1, "marcar pérdida incrementa 'to' de quien la comete");
  report.assert(!!document.getElementById("m-dls-picker"), "tras la pérdida se encadena el selector de '¿quién ha robado?'");
  win._dlsPickerConfirm("p3");
  report.assert(win._dls().stats.p3.stl === 1, "elegir jugador en el selector de robo suma 'stl'");

  win.dlsTurnover();
  win._dlsPickerConfirm("p3");
  win._dlsPickerSkip(); // nadie robó
  report.assert(win._dls().stats.p3.to === 1 && Object.values(win._dls().stats).every(s => s.stl === 1 || s.stl === 0), "omitir el robo tras una pérdida no rompe nada ni asigna un robo fantasma");

  // ── Tapón desactivado por checklist: el botón no debe pintarse en la pantalla ──
  const screenHtml = win.screenDlsLive();
  report.assert(!screenHtml.includes("dlsBlock()"), "con checklist.blk desactivado, la pantalla en vivo no ofrece el botón de Tapón");
  report.assert(screenHtml.includes("dlsTurnover()") && screenHtml.includes("dlsShot(2,true)"), "la pantalla en vivo sí incluye los botones base de tiro y pérdida");
  report.assert(screenHtml.includes("Contraataque de 11"), "la cabecera de la pantalla en vivo usa el nombre real del ejercicio, no un texto fijo");

  // ── Deshacer última acción ──
  const before = win._dls().stats.p3.stl;
  win.dlsTurnover();
  win._dlsPickerConfirm("p1");
  win._dlsPickerConfirm("p3");
  report.assert(win._dls().stats.p3.stl === before + 1, "robo registrado antes de deshacer");
  win.undoDlsLast();
  report.assert(win._dls().stats.p3.stl === before, "undoDlsLast revierte exactamente la última acción del log");

  // ── Terminar el ejercicio: no borra nada, solo cambia de estado, y vuelve a Equipo ──
  const logLenBeforeEnd = win._dls().log.length;
  win.confirmEndDls();
  const confirmBtn = document.querySelector("#m-confirm button");
  report.assert(!!confirmBtn, "confirmEndDls pide confirmación antes de cerrar el ejercicio");
  confirmBtn.click();
  const finishedSess = win.S.drillLive.t1[drill.id][0];
  report.assert(finishedSess.status === "finished", "confirmar el cierre marca la sesión como 'finished'");
  report.assert(finishedSess.log.length === logLenBeforeEnd, "terminar el ejercicio no borra ni un solo evento del log");
  report.assert(win.S.screen === "team", "al terminar, la navegación vuelve a la pantalla Equipo (de donde se lanzó), no al pase de lista");
  report.assert(!!document.getElementById("m-dls-summary"), "al terminar se abre el resumen automáticamente");
  document.getElementById("m-dls-summary").remove();

  // ── La fila del catálogo refleja el estado 'finished': ya no ofrece "continuar", sí "ver último resultado" ──
  const libHtmlAfterFinish = win._drillLibraryRowsHtml();
  report.assert(libHtmlAfterFinish.includes("openDlsSetupModal('" + drill.id + "')"), "tras terminar, la fila vuelve a ofrecer 'Iniciar en vivo' (nueva sesión) en vez de 'Continuar'");
  report.assert(libHtmlAfterFinish.includes("openDlsSummaryModal('" + drill.id + "')"), "tras terminar, la fila ofrece un acceso para ver el último resultado");

  // ── Lanzar una segunda sesión el mismo día NO sobreescribe el historial de la primera ──
  win.openDlsSetupModal(drill.id);
  win.startDls();
  report.assert(win.S.drillLive.t1[drill.id].length === 2, "una segunda sesión se añade al histórico del ejercicio sin borrar la primera");
  report.assert(win.S.drillLive.t1[drill.id][0].status === "finished" && win.S.drillLive.t1[drill.id][0].log.length === logLenBeforeEnd, "la primera sesión (ya terminada) sigue intacta tras arrancar una segunda");
  win.confirmEndDls();
  document.querySelector("#m-confirm button").click();
  document.getElementById("m-dls-summary")?.remove();

  // ── Borrar el ejercicio del catálogo no borra su histórico de estadísticas en vivo ──
  win.deleteDrill(drill.id);
  document.querySelector("#m-confirm button").click();
  report.assert(!win.S.drills.t1.some(d => d.id === drill.id), "el ejercicio desaparece del catálogo");
  report.assert(win.S.drillLive.t1[drill.id].length === 2, "el histórico de estadísticas en vivo de ese ejercicio se conserva aunque se borre del catálogo (nunca se borra nada)");

  // ── El catálogo/sesiones del pase de lista siguen intactos (nada se ha tocado fuera de lo esperado) ──
  report.assert(Array.isArray(win.S.drills.t1), "el catálogo de ejercicios (S.drills) sigue siendo un array normal, sin efectos colaterales");
  report.assert(Object.keys(win.S.sessions).length === 0, "S.sessions (pase de lista) nunca se ha tocado -- todo el flujo en vivo vive en S.drillLive");

  return report.summary();
}

module.exports = { run };
if (require.main === module) {
  run().then(({ failed }) => process.exit(failed ? 1 : 0));
}
