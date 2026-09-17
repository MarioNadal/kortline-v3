"use strict";
// v3.0.0-dev.62 · B-BDAY1: cumpleaños de jugadores, pedido explícito de
// Mario: "el día que sea el cumpleaños debe aparecer cuando se pase lista"
// y también en la pantalla "Hoy" (para no perderse un cumpleaños en un día
// sin entreno de ese equipo). Cubre: el campo opcional p.birthDate, el aviso
// en att() (con la edad si hay año), el aviso agregado de TODOS los equipos
// en hoy() (incluso sin entreno/partido hoy), y que un jugador sin
// birthDate o con otro día no dispara nada.
const { loadApp, newReporter } = require("./harness");

async function run() {
  const report = newReporter("birthday_reminder");
  const win = await loadApp();
  const assert = (cond, msg) => report.assert(cond, msg);
  const doc = win.document;

  const today = win.td();
  const todayMD = today.slice(5); // "MM-DD"
  const thisYear = parseInt(today.slice(0, 4), 10);
  const birthYear = thisYear - 15; // cumple 15 hoy
  const todayBirthDate = `${birthYear}-${todayMD}`;
  // Un día distinto de hoy (mismo año, mes 01 si hoy no es 01, si no mes 02) para el jugador "de control".
  const otherMD = todayMD.startsWith("01-") ? "02-15" : "01-15";
  const otherBirthDate = `${birthYear}-${otherMD}`;

  win.S.teams = [
    { id: "t1", name: "Cadete Masculino", color: "#F06318", category: "Cadete", gender: "Masculino", schedule: { 1: "18:00" } },
    { id: "t2", name: "Infantil Femenino", color: "#1a6fc4", category: "Infantil", gender: "Femenino", schedule: {} }
  ];
  win.S.players = {
    t1: [
      { id: "p1", name: "Jugador Cumpleañero", number: 4, addedAt: "2026-08-01", birthDate: todayBirthDate },
      { id: "p2", name: "Jugador Normal", number: 5, addedAt: "2026-08-01", birthDate: otherBirthDate },
      { id: "p3", name: "Jugador Sin Fecha", number: 6, addedAt: "2026-08-01" }
    ],
    t2: [
      { id: "p4", name: "Jugadora Otro Equipo", number: 7, addedAt: "2026-08-01", birthDate: todayBirthDate }
    ]
  };
  win.S.sessions = {};
  win.S.matches = {};
  win.S.events = {};
  win.S.teamId = "t1";
  win.S.date = today;

  // ── 1) isBirthdayToday / playerBirthdayAge ──
  const p1 = win.S.players.t1[0];
  const p2 = win.S.players.t1[1];
  const p3 = win.S.players.t1[2];
  assert(win.isBirthdayToday(p1) === true, "isBirthdayToday(): true para el jugador cuyo día/mes coincide con hoy");
  assert(win.isBirthdayToday(p2) === false, "isBirthdayToday(): false para un jugador con otro día");
  assert(win.isBirthdayToday(p3) === false, "isBirthdayToday(): false para un jugador sin birthDate (no revienta)");
  assert(win.playerBirthdayAge(p1) === 15, "playerBirthdayAge(): calcula bien la edad que cumple hoy — dio " + win.playerBirthdayAge(p1));

  // ── 2) Aviso en att() del equipo del cumpleañero ──
  let attHtml = win.att();
  assert(attHtml.includes("Jugador Cumpleañero"), "att(): incluye el nombre del cumpleañero");
  assert(attHtml.includes("¡Hoy cumple 15 años!"), "att(): muestra la edad que cumple");
  assert(!attHtml.includes("Jugador Normal</div><div style=\"font-size:12px;color:#ec4899"), "att(): el jugador con otro cumpleaños no sale en el aviso rosa");

  // ── 3) Sin aviso en el equipo que no tiene a nadie de cumpleaños hoy ──
  win.S.teamId = "t2"; // Jugadora Otro Equipo SÍ cumple hoy, así que debe salir aquí
  let attHtml2 = win.att();
  assert(attHtml2.includes("Jugadora Otro Equipo") && attHtml2.includes("🎂"), "att(): el aviso también sale correctamente en otro equipo distinto");
  win.S.teamId = "t1";

  // ── 4) hoy(): aparece agregado de TODOS los equipos, incluso sin entreno/partido programado ──
  win.S.teams[0].schedule = {}; // quitamos el entreno de hoy a propósito
  const hoyHtml = win.hoy();
  assert(hoyHtml.includes("Jugador Cumpleañero") && hoyHtml.includes("Cadete Masculino"), "hoy(): muestra al cumpleañero del equipo 1 con su nombre de equipo, aunque hoy no entrene");
  assert(hoyHtml.includes("Jugadora Otro Equipo") && hoyHtml.includes("Infantil Femenino"), "hoy(): muestra también al cumpleañero del equipo 2 (agregado de todo el club)");
  assert(hoyHtml.includes("Sin actividad hoy"), "hoy(): el estado 'sin actividad' se sigue mostrando igual (el banner de cumpleaños no lo sustituye)");

  // ── 5) _todaysBirthdays() devuelve la estructura esperada ──
  const all = win._todaysBirthdays();
  assert(all.length === 2, "_todaysBirthdays(): encuentra los 2 cumpleaños de hoy en todo el club — dio " + all.length);
  assert(all.some(x => x.player.id === "p1" && x.team.id === "t1"), "_todaysBirthdays(): incluye jugador+equipo correctos para p1");
  assert(all.some(x => x.player.id === "p4" && x.team.id === "t2"), "_todaysBirthdays(): incluye jugador+equipo correctos para p4");

  // ── 6) Guardar la fecha de nacimiento desde el modal (savePlayer) ──
  win.openPlayerModal(win.S.players.t1[2]); // Jugador Sin Fecha
  const mid = "m-edit-pl-p3";
  doc.getElementById(mid + "-bd").value = todayBirthDate;
  win.savePlayer(mid, "p3");
  const p3After = win.S.players.t1.find(x => x.id === "p3");
  assert(p3After.birthDate === todayBirthDate, "savePlayer(): persiste la fecha de nacimiento puesta en el modal");
  assert(win.isBirthdayToday(p3After) === true, "isBirthdayToday(): ahora sí es true tras guardar la fecha");

  return report.summary();
}

module.exports = { run };
