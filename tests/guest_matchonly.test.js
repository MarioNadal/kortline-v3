"use strict";
const { loadApp, newReporter } = require("./harness");

// B-GUEST2: un jugador puntual añadido para un PARTIDO (mode="match" en
// openGuestPlayerModal) se guardaba igual que uno añadido desde un
// entrenamiento (mode="att") -- ambos con addedAt=hoy y sin distinción --
// así que a partir de esa fecha empezaba a aparecer también en el pase de
// lista de TODOS los entrenamientos siguientes, contando como "presente"
// por defecto en sesiones a las que nunca fue. Esto contradice el propio
// texto del modal ("No se queda en la plantilla fija — solo para este
// partido"). Fix: los puntuales de partido llevan matchOnly:true y se
// excluyen de todo lo relacionado con asistencia a entrenamientos (pase de
// lista, resumen "Hoy", textos de WhatsApp, tabla/gráfico de Stats,
// exportación PDF/Excel de asistencia) -- pero siguen contando igual en
// las estadísticas y exportaciones DE PARTIDOS, que es donde sí jugaron.
async function run() {
  const report = newReporter("guest_matchonly");
  const win = await loadApp();

  win.S.teamId = "t1";
  win.S.teams = [{ id: "t1", name: "CB Jaca", category: "Infantil", coaches: [], color: "#f06318", schedule: {} }];
  win.S.players = {
    t1: [
      { id: "p1", name: "Ana Fija", number: 4, addedAt: "2026-01-01" },
      { id: "p2", name: "Guest Partido", number: 9, guest: true, matchOnly: true, addedAt: "2026-08-01" },
    ],
  };
  // Sesión de entrenamiento DESPUÉS de que se añadiera el puntual de partido.
  win.S.sessions = { "t1_2026-08-05": { p1: "present" } };
  win.S.date = "2026-08-05";

  const attHtml = win.att();
  report.assert(attHtml.includes("Ana Fija"), "att() sigue incluyendo a un jugador normal de plantilla");
  report.assert(!attHtml.includes("Guest Partido"), "att() NO incluye a un puntual de partido (matchOnly) en el pase de lista");

  const daily = win.buildDailyText("t1", "2026-08-05", false, {});
  report.assert(!daily.includes("Guest Partido"), "buildDailyText NO incluye al puntual de partido");
  report.assert(/1\/1/.test(daily), "buildDailyText cuenta la asistencia sobre 1 jugador (el puntual no infla el total)");

  const weekly = win.buildWeeklyText("t1", false, {});
  report.assert(!weekly.includes("Guest Partido"), "buildWeeklyText NO incluye al puntual de partido en el resumen 'por jugador'");

  const c = win._countAtt(win.S.players.t1[1], [{ date: "2026-08-05", data: { p1: "present" } }]);
  report.assert(c.tot === 0 && c.pr === 0 && c.ab === 0, "_countAtt del puntual de partido siempre da tot:0 (sin datos de asistencia)");

  // Un puntual añadido desde un ENTRENAMIENTO (mode="att") NO lleva
  // matchOnly y debe seguir comportándose exactamente igual que antes.
  win.S.players.t1.push({ id: "p3", name: "Guest Entreno", number: 11, guest: true, matchOnly: false, addedAt: "2026-08-01" });
  const attHtml2 = win.att();
  report.assert(attHtml2.includes("Guest Entreno"), "un puntual añadido desde un entrenamiento (mode=att, sin matchOnly) SÍ sigue apareciendo en el pase de lista");

  return report.summary();
}

module.exports = { run };
