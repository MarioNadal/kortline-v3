"use strict";
// v3.0.0-dev.61 · B-INJ3: aviso en el pase de lista (att()) cuando la vuelta
// estimada de un jugador lesionado se cumple o se pasa, pedido explícito de
// Mario: "que salga un aviso ese día... si quieres dar alta médica o dar otra
// estimación, o si omite sigue lesionada hasta dar alta médica". Cubre: el
// aviso NO sale antes de la fecha, SÍ sale el día exacto y después (cada día,
// hasta que se actúe), los 3 botones (alta/nueva fecha/omitir) hacen lo que
// deben, y "Omitir" solo oculta por HOY (usa localStorage, no Firestore).
const { loadApp, newReporter } = require("./harness");

async function run() {
  const report = newReporter("injury_reminder");
  const win = await loadApp();
  const assert = (cond, msg) => report.assert(cond, msg);
  const doc = win.document;

  win.S.teams = [{ id: "t1", name: "Cadete Masculino", color: "#F06318", category: "Cadete", gender: "Masculino", schedule: {} }];
  win.S.players = {
    t1: [
      {
        id: "p1", name: "Jugadora A", number: 4, addedAt: "2026-08-01",
        injury: { active: true, startDate: "2026-09-01", type: "ankle_mild", typeLabel: "Esguince", estimatedReturn: "2026-09-20" }
      },
      { id: "p2", name: "Jugadora B", number: 5, addedAt: "2026-08-01" }
    ]
  };
  win.S.sessions = {};
  win.S.matches = {};
  win.S.events = {};
  win.S.teamId = "t1";

  // Forzamos "hoy" via td() real del sistema -- en vez de mockear Date,
  // ajustamos p1.injury.estimatedReturn en cada paso relativo a hoy real.
  const today = win.td();
  const addDays = (d, n) => win._addDaysISO(d, n);

  // ── 1) Vuelta estimada en el FUTURO: no debe salir ningún aviso ──
  win.S.players.t1[0].injury.estimatedReturn = addDays(today, 5);
  let html = win.att();
  assert(!html.includes("Vuelta prevista"), "att(): sin aviso cuando la vuelta estimada está en el futuro");

  // ── 2) Vuelta estimada HOY: debe salir el aviso con el texto de "hoy" ──
  win.S.players.t1[0].injury.estimatedReturn = today;
  html = win.att();
  assert(html.includes("Jugadora A"), "att(): el aviso incluye el nombre de la jugadora");
  assert(html.includes("Vuelta prevista para hoy"), "att(): mensaje correcto el día exacto de la vuelta estimada");
  assert(html.includes("Dar de alta") && html.includes("Nueva fecha") && html.includes("Omitir"), "att(): los 3 botones están presentes");

  // ── 3) Vuelta estimada ya pasada (hace 3 días): aviso de superada ──
  win.S.players.t1[0].injury.estimatedReturn = addDays(today, -3);
  html = win.att();
  assert(html.includes("Vuelta prevista superada (hace 3 días)"), "att(): mensaje correcto cuando ya se ha pasado la fecha — dio: " + (html.match(/Vuelta prevista superada[^<]*/) || ["(no encontrado)"])[0]);

  // ── 4) "Omitir" oculta el aviso SOLO por hoy (usa localStorage) ──
  win._dismissInjReminder("p1");
  html = win.att();
  assert(!html.includes("Vuelta prevista"), "att(): tras Omitir, el aviso desaparece hoy");
  assert(win._injReminderDismissedToday("p1") === true, "_injReminderDismissedToday(): refleja el dismiss de hoy");

  // Simulamos que ha pasado a otro día: el dismiss de "ayer" no debe aplicar hoy.
  const fakeYesterday = addDays(today, -1);
  win.lsSet("cbj:injReminderDismiss", { p1: fakeYesterday }, true);
  html = win.att();
  assert(html.includes("Vuelta prevista"), "att(): un dismiss de OTRO día no oculta el aviso de hoy (vuelve a salir)");

  // ── 5) Botón "Dar de alta" (confirmInjuryRecovery) resuelve la lesión y el aviso desaparece ──
  win.confirmInjuryRecovery("p1");
  const p1 = win.S.players.t1.find(x => x.id === "p1");
  assert(p1.injury === null, "confirmInjuryRecovery(): limpia la lesión activa");
  html = win.att();
  assert(!html.includes("Vuelta prevista"), "att(): tras dar de alta, el aviso ya no sale (el jugador ya no está lesionado)");

  // ── 6) Botón "Nueva fecha" (openInjuryEditModal) permite cambiar la estimación sin dar de alta ──
  win.S.players.t1.push({
    id: "p3", name: "Jugadora C", number: 6, addedAt: "2026-08-01",
    injury: { active: true, startDate: "2026-09-01", type: "ankle_mild", typeLabel: "Esguince", estimatedReturn: today }
  });
  html = win.att();
  assert(html.includes("Jugadora C"), "att(): el aviso también sale para un segundo jugador lesionado y vencido");
  win.openInjuryEditModal("p3");
  const mid = "m-inj-p3";
  doc.getElementById(mid + "-est").value = addDays(today, 10);
  win.saveInjury(mid, "p3");
  const p3 = win.S.players.t1.find(x => x.id === "p3");
  assert(p3.injury.active === true, "saveInjury() vía 'Nueva fecha': la lesión SIGUE activa (no se da de alta)");
  assert(p3.injury.estimatedReturn === addDays(today, 10), "saveInjury() vía 'Nueva fecha': la nueva estimación queda guardada");
  // Jugadora C sigue en la lista de jugadores (att() la sigue mostrando como
  // lesionada activa), pero ya no debe estar en la lista de avisos vencidos.
  const dueNow = win._injReminderDue("t1").map(p => p.id);
  assert(!dueNow.includes("p3"), "_injReminderDue(): con la nueva fecha en el futuro, Jugadora C ya no está en la lista de avisos vencidos");

  return report.summary();
}

module.exports = { run };
