"use strict";
const { loadApp, newReporter } = require("./harness");

// B-TNOTES1: nueva funcionalidad pedida por el usuario -- "Notas de
// entrenamiento", una entidad DELIBERADAMENTE independiente de la
// asistencia (que se sigue pasando aparte, en el pabellón). Objetivo del
// día, foco de la semana (se repite entre sesiones), hábitos trabajados
// (checklist visual), contenido técnico/táctico, foto del planteamiento,
// observaciones por jugador/a y notas para la próxima sesión. Vista
// semanal por categoría. Multi-entrenador y offline vía la misma
// infraestructura de Firestore + localStorage que ya usa el resto de la
// app (S.trainingNotes, colección "trainingNotes" por equipo).
async function run() {
  const report = newReporter("training_notes");
  const win = await loadApp();

  win.S.teamId = "t1";
  win.S.teams = [{ id: "t1", name: "CB Jaca Infantil", category: "Infantil", coaches: ["Mario"], color: "#f06318", schedule: { 0: "18:00", 2: "18:00" } }];
  win.S.players = {
    t1: [
      { id: "p1", name: "Ana García", number: 4 },
      { id: "p2", name: "Bea López", number: 5 },
    ],
  };
  win.S.sessions = {};
  win.S.trainingNotes = {};

  // ── 1) Independencia total de la asistencia ──
  win.S.date = "2026-08-10"; // lunes
  const objetivo = "Mejorar el bloqueo directo";
  win._tnPatch("t1", "2026-08-10", { objetivo });
  report.assert(win.tn("t1", "2026-08-10").objetivo === objetivo, "_tnPatch guarda el objetivo del día");
  report.assert(Object.keys(win.S.sessions).length === 0, "crear una nota de entrenamiento NO crea ni toca ninguna sesión de asistencia (S.sessions sigue vacío)");

  // Al revés: pasar asistencia no debe tocar ni requerir una nota de entrenamiento.
  win.S.sessions[win.sk("t1", "2026-08-10")] = { p1: "present", p2: "absent" };
  report.assert(win.tn("t1", "2026-08-10").objetivo === objetivo, "pasar asistencia no borra ni modifica la nota de entrenamiento ya existente");
  report.assert(win.tn("t1", "2026-08-11") === null, "un día sin nota de entrenamiento devuelve null (no un objeto vacío fantasma)");

  // ── 2) Hábitos (checklist) ──
  win._tnToggleHabit("t1", "2026-08-10", "puntualidad");
  win._tnToggleHabit("t1", "2026-08-10", "actitud");
  let note = win.tn("t1", "2026-08-10");
  report.assert(note.habitos.puntualidad === true && note.habitos.actitud === true, "_tnToggleHabit marca los hábitos trabajados");
  win._tnToggleHabit("t1", "2026-08-10", "puntualidad");
  report.assert(win.tn("t1", "2026-08-10").habitos.puntualidad === false, "_tnToggleHabit alterna (segunda vez lo desmarca)");

  // ── 3) Observaciones por jugador/a ──
  win.S.date = "2026-08-10";
  win.S._tnShowObsForm = true;
  win.trainingNoteScreen(); // solo para generar el formulario en el DOM real via document, pero usamos document directamente:
  // Construimos el formulario a mano en el documento (más robusto que parsear el HTML devuelto).
  const selEl = win.document.createElement("select");
  selEl.id = "tn-obs-player";
  const opt = win.document.createElement("option");
  opt.value = "p1";
  opt.selected = true;
  selEl.appendChild(opt);
  win.document.body.appendChild(selEl);
  const noteEl = win.document.createElement("textarea");
  noteEl.id = "tn-obs-note";
  noteEl.value = "Muy atenta en defensa hoy";
  win.document.body.appendChild(noteEl);
  win._tnAddObservation();
  note = win.tn("t1", "2026-08-10");
  report.assert(note.observaciones.length === 1 && note.observaciones[0].playerId === "p1" && note.observaciones[0].note === "Muy atenta en defensa hoy", "_tnAddObservation añade la observación vinculada al jugador/a correcto");
  const obsId = note.observaciones[0].id;
  win._tnRemoveObservation(obsId);
  report.assert(win.tn("t1", "2026-08-10").observaciones.length === 0, "_tnRemoveObservation la quita");
  selEl.remove(); noteEl.remove();

  // ── 4) "Entrenador (quién la registra)" se rellena solo con _getCoachName() ──
  win.lsSet && win.lsSet; // noop, aseguramos que localStorage existe
  win.localStorage.setItem("cbj:coachname", JSON.stringify("Mario")); // lsGet() hace JSON.parse
  win.S.trainingNotes = {};
  win._tnPatch("t1", "2026-08-12", { objetivo: "Tiro" });
  report.assert(win.tn("t1", "2026-08-12").coachName === "Mario", "la nota se atribuye automáticamente al entrenador del dispositivo (_getCoachName)");

  // ── 5) "Foco de la semana" se repite entre sesiones de la misma semana ──
  win.S.trainingNotes = {};
  win._tnPatch("t1", "2026-08-10", { focoSemana: "Defensa individual" }); // lunes
  const hint = win._weekFocusHint("t1", win._weekMonday("2026-08-12"), "2026-08-12"); // miércoles misma semana
  report.assert(hint === "Defensa individual", "_weekFocusHint recupera el foco de otra sesión de la MISMA semana natural (lunes-domingo)");
  const noHint = win._weekFocusHint("t1", win._weekMonday("2026-08-20"), "2026-08-20"); // semana siguiente
  report.assert(noHint === "", "_weekFocusHint NO se cuela de una semana a otra");

  // ── 6) Helpers de semana ──
  report.assert(win._weekMonday("2026-08-13") === "2026-08-10", "_weekMonday: jueves 13 -> lunes 10 (misma semana)");
  report.assert(win._weekMonday("2026-08-09") === "2026-08-03", "_weekMonday: domingo pertenece a la semana que termina ese día");
  const wd = win._weekDatesFrom("2026-08-10");
  report.assert(wd.length === 7 && wd[0] === "2026-08-10" && wd[6] === "2026-08-16", "_weekDatesFrom devuelve las 7 fechas lunes-domingo");

  // ── 7) Pantallas no lanzan excepción y contienen los campos clave ──
  win.S.screen = "trainingNote";
  win.S.teamId = "t1";
  win.S.date = "2026-08-10";
  let html;
  try { html = win.trainingNoteScreen(); } catch (e) { html = null; report.assert(false, "trainingNoteScreen() no debe lanzar: " + e.message); }
  if (html != null) {
    report.assert(html.includes("Objetivo del día"), "trainingNoteScreen incluye el campo objetivo");
    report.assert(html.includes("Foco de la semana"), "trainingNoteScreen incluye el campo foco de la semana");
    report.assert(html.includes("Hábitos a trabajar"), "trainingNoteScreen incluye el checklist de hábitos");
    report.assert(html.includes("Contenido técnico"), "trainingNoteScreen incluye el contenido técnico/táctico");
    report.assert(html.includes("Foto del planteamiento"), "trainingNoteScreen mantiene la foto (ya no como único campo)");
    report.assert(html.includes("Observaciones por jugador"), "trainingNoteScreen incluye observaciones por jugador/a");
    report.assert(html.includes("próxima sesión"), "trainingNoteScreen incluye notas para la próxima sesión");
    report.assert(html.includes("independiente de pasar lista"), "trainingNoteScreen dice explícitamente que es independiente de la asistencia");
  }

  let htmlWeek;
  try { htmlWeek = win.trainingNotesWeekScreen(); } catch (e) { htmlWeek = null; report.assert(false, "trainingNotesWeekScreen() no debe lanzar: " + e.message); }
  if (htmlWeek != null) {
    report.assert(htmlWeek.includes("Notas de entrenamiento"), "trainingNotesWeekScreen tiene título");
    report.assert(htmlWeek.includes("Planificado") || htmlWeek.includes("Sin planificar"), "trainingNotesWeekScreen muestra el estado de cada sesión de la semana");
  }

  // ── 8) La vista semanal agrupa exactamente los días en que el equipo entrena (o ya tiene nota) ──
  win.S.trainingNotes = {};
  win.S.tnWeekStart = "2026-08-10"; // lunes, equipo entrena lunes(0) y miércoles(2)
  const wk = win.trainingNotesWeekScreen();
  const luneCount = (wk.match(/Lunes/g) || []).length;
  const mierCount = (wk.match(/Miércoles/g) || []).length;
  const martCount = (wk.match(/>Martes</g) || []).length;
  report.assert(luneCount > 0 && mierCount > 0, "la semana muestra los días en que el equipo SÍ entrena (lunes y miércoles)");
  report.assert(martCount === 0, "la semana NO muestra un día sin entrenamiento programado ni nota (martes)");

  // ── 9) Sincronización a la nube: trainingNotes viaja en el snapshot y se
  // sincroniza como colección propia, no mezclada con sessions.
  const snap = win._snapshotState();
  report.assert("trainingNotes" in snap, "_snapshotState() incluye trainingNotes");
  const batchCalls = [];
  const fakeBatch = { set: (ref, data) => batchCalls.push({ op: "set", ref, data }), delete: (ref) => batchCalls.push({ op: "delete", ref }) };
  const nDiff = win._diffSessions(fakeBatch, { t1_2026_08_10: { objetivo: "x" } }, {}, "trainingNotes");
  report.assert(nDiff === 1 && batchCalls.length === 1 && batchCalls[0].op === "set", "_diffSessions (reutilizada con el parámetro de colección) genera un write hacia la colección 'trainingNotes'");

  // ── 10) Persistencia local (localStorage) ──
  win.S.trainingNotes = {};
  win._tnPatch("t1", "2026-08-10", { objetivo: "Persistencia" });
  const raw = win.localStorage.getItem("cbj:tn");
  report.assert(!!raw && JSON.parse(raw)[win.sk("t1", "2026-08-10")].objetivo === "Persistencia", "las notas de entrenamiento persisten en localStorage (offline) bajo su propia clave 'cbj:tn'");

  return report.summary();
}

module.exports = { run };
