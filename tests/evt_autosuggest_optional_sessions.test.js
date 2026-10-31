"use strict";
// v3.0.0-dev.100 · B-VOLTECH1: bug de auditoría confirmado. _evtAutoSuggest()
// (sugerencia automática de convocatoria para partidos/eventos, basada en %
// de asistencia) construía su lista de sesiones directamente desde
// S.sessions, sin excluir los entrenamientos opcionales (voluntarios/
// tecnificaciones, campo `_optType`) que B-VOLTECH1 introduce. Como Mario
// pidió explícitamente que esas sesiones NUNCA influyan en el % oficial
// ("contador aparte, nunca toca el % oficial" -- su respuesta a
// AskUserQuestion), una ausencia o presencia en un entrenamiento opcional se
// habría colado en la sugerencia de convocatoria, pudiendo cambiar a quién
// se sugiere convocar.
//
// Fix: _evtAutoSuggest ahora construye su lista con
// _teamSessionEntries(tid) (que excluye _optType por defecto) en vez de leer
// S.sessions directamente.
const { loadApp, newReporter } = require("./harness");

async function run() {
  const report = newReporter("evt_autosuggest_optional_sessions");
  const win = await loadApp();
  const assert = (cond, msg) => report.assert(cond, msg);

  const today = win.td();
  const dOfficial = win._addDaysISO(today, -10);

  win.S.teams = [{ id: "t1", name: "Cadete Masculino", color: "#F06318", schedule: {} }];
  win.S.players = {
    t1: [
      { id: "p1", name: "Jugador Uno", number: 4, addedAt: "2026-07-01" },
      { id: "p2", name: "Jugador Dos", number: 5, addedAt: "2026-07-01" }
    ]
  };
  win.S.matches = {};
  win.S.teamId = "t1";
  win.S.date = today;

  // Un único entrenamiento OFICIAL: p1 y p2 empatados a 1 presencia cada uno.
  win.S.sessions = {
    [`t1_${dOfficial}`]: { p1: "present", p2: "present" }
  };
  // Cinco entrenamientos VOLUNTARIOS (_optType): p2 asiste a todos, p1 falta
  // a todos. Si estas sesiones contaran para el % oficial, p2 quedaría muy
  // por delante de p1 en la sugerencia de convocatoria -- pero son opcionales
  // y las ausencias/presencias ahí NUNCA deben tocar el % oficial.
  for (let i = 1; i <= 5; i++) {
    const d = win._addDaysISO(today, -i);
    win.S.sessions[`t1_${d}`] = { p1: "absent", p2: "present", _optType: "voluntario" };
  }

  win.S.events = { t1: [{ id: "e1", tipo: "partido", rival: "Rival CB", fecha: today, convocados: [] }] };
  win._evtAutoSuggest("t1", "e1");
  const e = win.evtById("t1", "e1");

  assert(Array.isArray(e.convocados) && e.convocados.length === 2,
    "_evtAutoSuggest rellena convocados con ambos jugadores");
  assert(e.convocados[0] === "p1",
    "B-VOLTECH1 FIX: con el empate real en sesiones OFICIALES (1-1), p1 sigue primero -- " +
    "las 5 sesiones voluntarias (p2 presente, p1 ausente en todas) NO deben desempatar la sugerencia");

  return report.summary();
}

module.exports = { run };
