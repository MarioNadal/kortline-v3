"use strict";
// v3.0.0-dev.76 · B-TNMERGE1: Mario pidió explícitamente quitar el botón
// "📝 Notas de entrenamiento" (pantalla aparte, objetivos/foco de
// semana/hábitos/observaciones/foto/notas para la próxima sesión) de "Hoy"
// (junto a "Pasar lista") y de Equipo ("NOTAS DE ENTRENAMIENTO") -- no lo
// usaba nunca, y lo que sí usa (ejercicios de la sesión) ya vivía dentro del
// propio pase de lista (att()). Los datos antiguos de S.trainingNotes NO se
// borran ni se dejan de sincronizar -- si un día concreto ya tenía una nota
// guardada, se puede seguir consultando (solo lectura) desde el propio pase
// de lista de ese día (_legacyTrainingNoteHtml).
const { loadApp, newReporter } = require("./harness");

async function run() {
  const report = newReporter("tnmerge_att_legacy");
  const win = await loadApp();
  const assert = (cond, msg) => report.assert(cond, msg);

  const ti = win.todayIdx();
  const today = win.td();

  win.S.teams = [{ id: "t1", name: "Equipo Uno", color: "#111", schedule: { [ti]: "18:00" } }];
  win.S.players = { t1: [{ id: "p1", name: "Ana", number: 4 }] };
  win.S.matches = { t1: [] };
  win.S.events = { t1: [] };
  win.S.drills = { t1: [] };
  win.S.sessions = { [win.sk("t1", today)]: { p1: "present" } };
  win.S.trainingNotes = {};

  // ── 1) "Hoy": el botón de notas de entrenamiento ya no aparece junto a "Pasar lista" ──
  win.S.screen = "hoy";
  win.render();
  let html = win.document.getElementById("root").innerHTML;
  assert(html.includes("Pasar lista") || html.includes("Editar lista"), "la tarjeta de entrenamiento de hoy se sigue viendo con normalidad");
  assert(!html.includes("navTo('trainingNote'"), "B-TNMERGE1: 'Hoy' ya no tiene ningún enlace a la pantalla separada de notas de entrenamiento");

  // ── 2) Equipo: el botón "NOTAS DE ENTRENAMIENTO" ya no aparece ──
  win.S.teamId = "t1";
  win.S.screen = "team";
  win.render();
  html = win.document.getElementById("root").innerHTML;
  assert(!html.includes("NOTAS DE ENTRENAMIENTO"), "B-TNMERGE1: la pantalla de Equipo ya no tiene el botón de notas de entrenamiento (vista semanal)");
  assert(!html.includes("navTo('trainingNotesWeek'"), "B-TNMERGE1: la pantalla de Equipo ya no enlaza a la vista semanal de notas");
  assert(html.includes("CATÁLOGO DE EJERCICIOS"), "el resto de botones de Equipo (catálogo de ejercicios, etc.) se mantienen intactos");

  // ── 3) Pase de lista de un día SIN nota antigua: no aparece ninguna caja ──
  win.S.cfg.features.exercises = true;
  win.S.date = today;
  win.S.screen = "att";
  win.render();
  html = win.document.getElementById("root").innerHTML;
  assert(!html.includes("Nota de entrenamiento guardada de este día"), "sin nota antigua para este día, no se muestra ninguna caja de solo lectura");
  assert(html.includes("Ejercicios del entrenamiento"), "el campo libre de ejercicios de siempre sigue ahí");

  // ── 4) Pase de lista de un día CON nota antigua completa: se ve todo, de solo lectura ──
  win.S.trainingNotes = {
    [win.sk("t1", today)]: {
      focoSemana: "Defensa individual",
      objetivos: [{ id: "o1", text: "Mejorar el bloqueo directo" }],
      habitos: ["Rebote", "Bote"],
      contenido: "Calentamiento + 3c3",
      observaciones: [{ id: "ob1", playerId: "p1", note: "Muy atenta hoy" }],
      notasProximas: "Retomar el pick and roll",
      foto: "data:image/png;base64,AAAA"
    }
  };
  win.render();
  html = win.document.getElementById("root").innerHTML;
  assert(html.includes("Nota de entrenamiento guardada de este día"), "B-TNMERGE1: con una nota antigua para este día exacto, aparece la caja de solo lectura");
  assert(html.includes("Defensa individual"), "muestra el foco de la semana guardado");
  assert(html.includes("Mejorar el bloqueo directo"), "muestra los objetivos guardados");
  assert(html.includes("Rebote") && html.includes("Bote"), "muestra los hábitos guardados");
  assert(html.includes("Calentamiento + 3c3"), "muestra el contenido técnico/táctico guardado");
  assert(html.includes("Ana: Muy atenta hoy"), "muestra las observaciones por jugador, con el nombre real resuelto");
  assert(html.includes("Retomar el pick and roll"), "muestra las notas para la próxima sesión");
  assert(html.includes("_tnOpenPhotoPreview"), "la foto guardada es tocable para verla en grande, reutilizando el visor ya existente");
  assert(!html.includes("<textarea") || !html.includes("tn-contenido"), "la caja es de solo lectura -- no reutiliza los campos editables de la pantalla antigua");

  // ── 5) Un día DISTINTO del mismo equipo no muestra la nota de otro día ──
  win.S.date = "2020-01-01";
  win.render();
  html = win.document.getElementById("root").innerHTML;
  assert(!html.includes("Nota de entrenamiento guardada de este día"), "una nota de OTRO día no se cuela en el pase de lista de este día");

  // ── 6) Nada de esto borra los datos antiguos ──
  assert(Object.keys(win.S.trainingNotes).length === 1, "S.trainingNotes sigue teniendo la nota antigua intacta tras navegar por hoy/team/att");
  assert(win.S.trainingNotes[win.sk("t1", today)].contenido === "Calentamiento + 3c3", "el contenido de la nota antigua no se ha modificado");

  // ── 7) Las funciones de la pantalla antigua siguen existiendo (por si acaso, y porque _legacyTrainingNoteHtml las reutiliza) ──
  assert(typeof win.trainingNoteScreen === "function", "trainingNoteScreen sigue definida (código, aunque sin botón de entrada)");
  assert(typeof win.trainingNotesWeekScreen === "function", "trainingNotesWeekScreen sigue definida");
  assert(typeof win.tn === "function", "tn() sigue disponible para leer notas antiguas");

  return report.summary();
}

module.exports = { run };
if (require.main === module) {
  run().then(({ failed }) => process.exit(failed ? 1 : 0));
}
