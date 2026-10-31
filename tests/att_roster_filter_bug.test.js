"use strict";
// v3.0.0-dev.100 · B-ATT8: bug encontrado en la auditoría exhaustiva pedida
// por Mario (2026-10-31). El filtro "¿este jugador entrena hoy?" (nunca un
// puntual de PARTIDO -matchOnly-, y un puntual de ENTRENO -attOnly- solo el
// día exacto para el que se dio de alta -- ver _attOnlyActiveOn/B-GUEST7) ya
// vivía repetido en att()/hoy()/buildDailyText, pero setAll() y _flushSess()
// seguían iterando pl(tid) SIN ese filtro: "Pasar/Confirmar lista" y los
// botones "Todos presentes/ausentes" escribían un estado fantasma en
// S.sessions para puntuales que ni siquiera entrenaban ese día (de partido,
// o de entreno dado de alta para OTRO día). No se veía mal en pantalla
// (todo lo que lee ya filtraba), pero ensuciaba Firestore.
//
// Fix: nuevo helper _attRosterFor(tid,date) centraliza el filtro, usado
// ahora por setAll() y _flushSess().
const { loadApp, newReporter } = require("./harness");

async function run() {
  const report = newReporter("att_roster_filter_bug");
  const win = await loadApp();
  const assert = (cond, msg) => report.assert(cond, msg);

  const today = win.td();

  win.S.teams = [{ id: "t1", name: "Cadete Masculino", color: "#F06318", schedule: {} }];
  win.S.players = {
    t1: [
      { id: "p1", name: "Jugador Normal", number: 4, addedAt: "2026-07-01" },
      { id: "p2", name: "Puntual de Partido", number: 99, matchOnly: true, addedAt: "2026-07-01" },
      // puntual de entreno, dado de alta para OTRO día distinto al que se testea
      { id: "p3", name: "Puntual de Entreno (otro día)", number: 98, attOnly: true, addedAt: win._addDaysISO(today, -10) },
      // puntual de entreno, dado de alta justo para HOY -- este SÍ debe contar
      { id: "p4", name: "Puntual de Entreno (hoy)", number: 97, attOnly: true, addedAt: today }
    ]
  };
  win.S.matches = {};
  win.S.events = {};
  win.S.sessions = {};
  win.S.teamId = "t1";
  win.S.date = today;

  // ── setAll(): "Todos presentes" ──
  win.setAll("present");
  const sessAfterSetAll = win.S.sessions[win.sk("t1", today)];
  assert(sessAfterSetAll.p1 === "present", "setAll: jugador normal SÍ se marca");
  assert(sessAfterSetAll.p2 === undefined, "B-ATT8 FIX: setAll NUNCA escribe sobre un puntual de PARTIDO (matchOnly)");
  assert(sessAfterSetAll.p3 === undefined, "B-ATT8 FIX: setAll NUNCA escribe sobre un puntual de entreno dado de alta para OTRO día");
  assert(sessAfterSetAll.p4 === "present", "setAll: SÍ escribe sobre un puntual de entreno dado de alta justo para HOY");

  // ── _flushSess(): confirmar lista con los valores que ya hay en memoria ──
  win.S.sessions = {}; // limpio, _flushSess construye desde cero via S.att si existe, o por roster
  win.S.date = today;
  win._flushSess();
  const sessAfterFlush = win.S.sessions[win.sk("t1", today)] || {};
  assert(sessAfterFlush.p2 === undefined, "B-ATT8 FIX: _flushSess NUNCA escribe sobre un puntual de PARTIDO (matchOnly)");
  assert(sessAfterFlush.p3 === undefined, "B-ATT8 FIX: _flushSess NUNCA escribe sobre un puntual de entreno de OTRO día");

  return report.summary();
}

module.exports = { run };
