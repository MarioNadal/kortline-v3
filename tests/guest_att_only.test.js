"use strict";
// v3.0.0-dev.37 · B-GUEST3: bug real reportado por Mario -- un jugador
// puntual añadido desde el pase de lista de un ENTRENAMIENTO (mode="att")
// prometía en el propio modal "No se queda en la plantilla fija — solo
// para este entrenamiento", pero en la práctica se guardaba exactamente
// igual que un jugador normal (sin distinción, addedAt=hoy real en vez de
// la fecha de la sesión): aparecía en TODOS los entrenamientos siguientes
// como si fuera plantilla fija, y también en la convocatoria de partidos y
// eventos, cosas para las que nunca se dio de alta. Este test cubre el
// mismo patrón que guest_matchonly.test.js pero para el caso simétrico
// (attOnly en vez de matchOnly).
const { loadApp, buildFixture, newReporter } = require("./harness");

async function run() {
  const report = newReporter("guest_att_only");
  const assert = (cond, msg) => report.assert(cond, msg);
  const win = await loadApp();

  win.S.teamId = "t1";
  win.S.teams = [{ id: "t1", name: "CB Jaca", category: "Infantil", coaches: [], color: "#f06318", schedule: {} }];
  win.S.players = { t1: [{ id: "p1", name: "Ana Fija", number: 4, addedAt: "2026-01-01" }] };
  win.S.sessions = {};
  win.S.matches = { t1: [] };
  win.S.events = { t1: [] };

  // ── Alta del puntual de entreno un día concreto, atrasado (S.date != hoy real) ──
  win.S.date = "2026-08-01"; // el entrenador está pasando lista de un día atrasado
  win.openGuestPlayerModal({ mode: "att" });
  win.document.getElementById("gp-name").value = "Puntual de Entreno";
  win.document.getElementById("gp-num").value = "";
  win._guestPlayerCommit("att");
  const guest = win.pl("t1").find(p => p.name === "Puntual de Entreno");
  assert(!!guest, "el puntual de entreno se crea");
  assert(guest.attOnly === true, "queda marcado con attOnly:true");
  assert(guest.matchOnly !== true, "NO queda marcado como matchOnly (son excluyentes)");
  assert(guest.addedAt === "2026-08-01", "addedAt es la fecha de la SESIÓN que se estaba pasando lista, no la fecha real de hoy");

  // ── Solo aparece en el pase de lista de SU día ──
  let attHtml = win.att(); // S.date sigue en 2026-08-01
  assert(attHtml.includes("Puntual de Entreno"), "att() incluye al puntual en el día exacto para el que se dio de alta");

  win.S.date = "2026-08-08"; // un entrenamiento posterior
  win.S.sessions["t1_2026-08-08"] = { p1: "present" };
  attHtml = win.att();
  assert(!attHtml.includes("Puntual de Entreno"), "att() NO incluye al puntual en un entrenamiento posterior -- antes se quedaba para siempre como plantilla fija");
  assert(attHtml.includes("Ana Fija"), "el jugador de plantilla fija sigue apareciendo con normalidad");

  win.S.date = "2026-07-20"; // un entrenamiento ANTERIOR a su alta
  attHtml = win.att();
  assert(!attHtml.includes("Puntual de Entreno"), "att() tampoco lo incluye en un entrenamiento anterior a su alta");

  // ── buildDailyText: solo aparece el día exacto ──
  const dailyHisDay = win.buildDailyText("t1", "2026-08-01", false, {});
  assert(dailyHisDay.includes("Puntual de Entreno"), "buildDailyText incluye al puntual en el resumen de SU día");
  const dailyOtherDay = win.buildDailyText("t1", "2026-08-08", false, {});
  assert(!dailyOtherDay.includes("Puntual de Entreno"), "buildDailyText NO lo incluye en el resumen de otro día");
  assert(/1\/1/.test(dailyOtherDay), "el resumen de otro día cuenta la asistencia solo sobre la plantilla real (1 jugador), sin inflar con el puntual");

  // ── No es convocable a partidos ──
  win.S.matches.t1 = [{ id: "m1", rival: "Rival CB", quarters: 4, qMins: 10, convocados: [] }];
  win.S.matchId = "m1";
  const convHtml = win._convSetupHtml(win.S.matches.t1[0], win.S.teams[0], 0);
  assert(!convHtml.includes("Puntual de Entreno"), "el wizard de convocatoria de partido NO ofrece al puntual de entreno como candidato");
  assert(convHtml.includes("Ana Fija"), "el wizard sigue ofreciendo a los jugadores normales de plantilla");

  // ── No es convocable a eventos ──
  win.S.events.t1 = [{ id: "ev1", tipo: "evento", titulo: "Torneo", convocados: [] }];
  win.S.eventId = "ev1";
  win.openEventoConvModal();
  let evtHtml = win.document.getElementById("m-evt-conv")?.innerHTML || "";
  assert(!evtHtml.includes("Puntual de Entreno"), "la convocatoria de eventos NO ofrece al puntual de entreno como candidato");
  win.document.getElementById("m-evt-conv")?.remove();

  win.evtConvAll();
  const ev1 = win.evtById("t1", "ev1");
  assert(!ev1.convocados.includes(guest.id), "'Todos' en la convocatoria de eventos no incluye al puntual de entreno");
  assert(ev1.convocados.includes("p1"), "'Todos' sigue incluyendo a los jugadores normales de plantilla");

  // ── "Todos" en la convocatoria de partido tampoco lo incluye ──
  win.S.matchId = "m1";
  win.S.matches.t1[0].convocados = [];
  win._convSelectAll();
  const m1After = win.mById("t1", "m1");
  assert(!m1After.convocados.includes(guest.id), "'Todos' en la convocatoria de partido no incluye al puntual de entreno");
  assert(m1After.convocados.includes("p1"), "'Todos' en la convocatoria de partido sigue incluyendo a la plantilla real");
  // ── _isPlayerActiveOn: chequeo directo del helper centralizado ──
  assert(win._isPlayerActiveOn(guest, "2026-08-01", []) === true, "_isPlayerActiveOn: true en el día exacto de alta");
  assert(win._isPlayerActiveOn(guest, "2026-08-02", []) === false, "_isPlayerActiveOn: false al día siguiente");
  assert(win._isPlayerActiveOn(guest, "2026-07-31", []) === false, "_isPlayerActiveOn: false al día anterior");

  return report.summary();
}

module.exports = { run };
