"use strict";
// v3.0.0-dev.63 · B-INJ4: bug real reportado por Mario -- al dar el alta
// médica el MISMO día en que el jugador vuelve (botón "✅ Dar de alta" del
// aviso de vuelta de lesión en el pase de lista), la ambulancia/badge de
// lesionado seguía saliendo ese mismo día en att(), porque isInjuredOn()
// trataba injuryHistory[].endDate como INCLUSIVO (confirmInjuryRecovery()
// siempre pone endDate=hoy) -- así que "hoy" seguía contando como día
// lesionado hasta medianoche aunque el entrenador acabase de decir
// explícitamente que ya está recuperado/a. Este test fija exactamente ese
// escenario: dar de alta HOY debe quitar la ambulancia HOY, sin tocar el
// comportamiento de los días anteriores (que siguen contando como lesión).
const { loadApp, newReporter } = require("./harness");

async function run() {
  const report = newReporter("injury_recovery_same_day");
  const win = await loadApp();
  const assert = (cond, msg) => report.assert(cond, msg);

  const today = win.td();
  const startDate = win._addDaysISO(today, -5); // lesionado desde hace 5 días
  const yesterday = win._addDaysISO(today, -1);

  win.S.teams = [{ id: "t1", name: "Cadete Masculino", color: "#F06318", category: "Cadete", gender: "Masculino", schedule: {} }];
  win.S.players = {
    t1: [
      {
        id: "p1", name: "Jugadora Recuperada", number: 4, addedAt: "2026-08-01",
        injury: { active: true, startDate, type: "ankle_mild", typeLabel: "Esguince", estimatedReturn: today }
      },
      { id: "p2", name: "Jugadora Sana", number: 5, addedAt: "2026-08-01" }
    ]
  };
  win.S.sessions = {};
  win.S.matches = {};
  win.S.events = {};
  win.S.teamId = "t1";
  win.S.date = today;

  // ── 1) Antes del alta: la ambulancia SÍ sale hoy ──
  let attHtml = win.att();
  assert(attHtml.includes("injury-badge") && attHtml.includes("🚑"), "att(): antes de dar el alta, la ambulancia sale hoy");
  assert(win.isInjuredOn(win.S.players.t1[0], today) === true, "isInjuredOn(): activa -> true para hoy, antes del alta");

  // ── 2) Dar de alta médica HOY (el botón del aviso de vuelta / de la ficha) ──
  win.confirmInjuryRecovery("p1");
  const p1 = win.S.players.t1.find(x => x.id === "p1");
  assert(p1.injury === null, "confirmInjuryRecovery(): limpia la lesión activa");
  assert(Array.isArray(p1.injuryHistory) && p1.injuryHistory.length === 1, "confirmInjuryRecovery(): archiva la lesión en injuryHistory");
  assert(p1.injuryHistory[0].endDate === today, "injuryHistory: el endDate archivado es HOY (así es como confirmInjuryRecovery lo pone siempre)");

  // ── 3) Justo después del alta, HOY ya NO debe salir como lesionado ──
  assert(win.isInjuredOn(p1, today) === false, "isInjuredOn(): tras el alta, HOY ya no cuenta como lesionado (el bug reportado)");
  attHtml = win.att();
  const p1RowStart = attHtml.indexOf("Jugadora Recuperada");
  const p1Row = attHtml.slice(Math.max(0, p1RowStart - 400), p1RowStart + 400);
  assert(!p1Row.includes("injury-badge") && !p1Row.includes("🚑"), "att(): tras dar el alta, la fila de la jugadora ya NO muestra la ambulancia hoy");
  assert(!p1Row.includes("injury-dot"), "att(): tampoco el puntito rojo de lesionado en el dorsal");

  // ── 4) Los días ANTERIORES al alta (dentro del rango) siguen contando como lesión ──
  assert(win.isInjuredOn(p1, yesterday) === true, "isInjuredOn(): ayer (dentro del rango startDate..endDate) sigue contando como lesión");
  assert(win.isInjuredOn(p1, startDate) === true, "isInjuredOn(): el propio día de inicio sigue contando como lesión");

  // ── 5) _effAttState: hoy ya cuenta como 'present' por defecto (recuperada), ayer sigue siendo 'excused' ──
  assert(win._effAttState(p1, today, undefined) === "present", "_effAttState(): hoy, sin marca explícita, ya es 'present' (recuperada) -- antes del fix habría sido 'excused'");
  assert(win._effAttState(p1, yesterday, undefined) === "excused", "_effAttState(): ayer, sin marca explícita, sigue siendo 'excused' (todavía lesionada ese día)");

  // ── 6) El jugador sano de control nunca se ve afectado ──
  assert(win.isInjuredOn(win.S.players.t1[1], today) === false, "isInjuredOn(): el jugador sin lesión nunca sale como lesionado");

  return report.summary();
}

module.exports = { run };
