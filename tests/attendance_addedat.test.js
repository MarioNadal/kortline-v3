"use strict";
// v1.8.33 · B-ATT1: varias pantallas de asistencia/temporada calculaban el %
// medio contando como "presente" por defecto a jugadores en fechas
// anteriores a que existieran (p.addedAt), a diferencia de exportPDF(),
// stats() e hist() que ya respetaban esto correctamente vía
// _playerStartDate()/_countAtt(). Este test fija un escenario con 3
// entrenamientos (2 antes de que exista un jugador nuevo, 1 después) y
// comprueba que las 6+1 pantallas afectadas dan ahora el número correcto
// en vez del inflado/desinflado por contar sesiones "de antes de nacer".
const { loadApp, newReporter } = require("./harness");

async function run() {
  const report = newReporter("attendance_addedat");
  const win = await loadApp();
  const assert = (cond, msg) => report.assert(cond, msg);

  win.S.teams = [{ id: "t1", name: "Mi Equipo", color: "#F06318", category: "Cadete", schedule: {} }];
  win.S.players = {
    t1: [
      { id: "p1", name: "Ana García", number: 4, addedAt: "2026-07-01" },
      { id: "p2", name: "Bea López", number: 5, addedAt: "2026-07-01" },
      // g1 no existía en las 2 primeras sesiones -- solo debe contar desde 08-03
      { id: "g1", name: "Chaval de Zaragoza", number: 77, addedAt: "2026-08-03", guest: true }
    ]
  };
  win.S.sessions = {
    "t1_2026-08-01": { p1: "present", p2: "present" },
    "t1_2026-08-02": { p1: "present", p2: "absent" },
    "t1_2026-08-03": { p1: "present", p2: "present", g1: "present" }
  };
  win.S.matches = {};
  win.S.events = {};
  win.S.teamId = "t1";

  // Media correcta: p1 3/3, p2 2/3, g1 1/1 -> sumPr=6, sumPs=7 -> 86%
  // (la version con el bug daba 89%, contando a g1 como presente también
  // en las sesiones del 01 y 02, antes de que existiera)
  const teamHtml = win.team();
  assert(teamHtml.includes("86%"), "team(): la media de asistencia respeta la fecha de alta (86%, no 89%)");
  assert(!teamHtml.includes("89%"), "team(): ya no aparece el número inflado por contar sesiones previas al alta");

  const equiposHtml = win.equiposScreen();
  assert(equiposHtml.includes("86%"), "equiposScreen(): la tarjeta del equipo respeta la fecha de alta (86%)");

  const statsHomeHtml = (() => {
    win.S.teams = [
      { id: "t1", name: "Mi Equipo", color: "#F06318", category: "Cadete", schedule: {} },
      { id: "t2", name: "Otro Equipo", color: "#222", category: "Infantil", schedule: {} }
    ];
    win.S.players.t2 = [];
    const html = win.statsHomeScreen();
    win.S.teams = win.S.teams.filter(t => t.id === "t1"); // restaura para el resto del test
    return html;
  })();
  assert(statsHomeHtml.includes("86%"), "statsHomeScreen(): la tarjeta del equipo respeta la fecha de alta (86%)");

  // Auto-sugerencia de convocatoria de eventos: g1 solo tiene 1 sesión (100%
  // sobre 1), p1 tiene 3/3 (100% sobre 3) -- ambos "perfectos", pero p1 con
  // más historial real debería quedar por delante de un invitado con una
  // sola sesión detrás si el ranking respeta la fecha de alta.
  win.S.events.t1 = [{ id: "e1", tipo: "partido", rival: "Rival", convocados: [] }];
  win._evtAutoSuggest("t1", "e1");
  const ranked = win.evtById("t1", "e1").convocados;
  assert(ranked.indexOf("p1") < ranked.indexOf("g1"), "_evtAutoSuggest(): un jugador con más entrenamientos reales queda por delante de un invitado con una sola sesión");

  // Resumen semanal (texto de WhatsApp): también debe dar 86%, no 89%
  const weekly = win.buildWeeklyText("t1", false, {});
  assert(weekly.includes("86%"), "buildWeeklyText(): la media semanal respeta la fecha de alta (86%)");
  assert(!weekly.includes("89%"), "buildWeeklyText(): ya no aparece el número inflado");
  assert(weekly.includes("1/1") && weekly.includes("Chaval de Zaragoza"), "buildWeeklyText(): el invitado aparece con su propio total de sesiones (1/1), no sobre las 3 del equipo");

  // Insignia de % en la convocatoria de eventos (openEventoConvModal /
  // evtTogglePlayer): usamos un escenario donde el bug se nota en el número
  // -- si g1 falta el único día que ya existía, lo correcto es 0%, pero el
  // bug lo inflaba a 67% al sumarle "de regalo" 2 sesiones de antes de que
  // existiera (que por defecto cuentan como presente).
  win.S.sessions["t1_2026-08-03"].g1 = "absent";
  win.S.eventId = "e1";
  win.openEventoConvModal();
  const convModalHtml = win.document.getElementById("m-evt-conv").innerHTML;
  // p2 legítimamente muestra 67% (2 presentes / 3 sesiones reales) -- lo que
  // hay que comprobar es la fila del invitado en concreto, no que "67%" no
  // aparezca en ningún sitio del modal.
  const guestRow = convModalHtml.slice(convModalHtml.indexOf("Chaval de Zaragoza") - 5, convModalHtml.indexOf("Chaval de Zaragoza") + 400);
  assert(guestRow.includes(">0%<"), "openEventoConvModal(): la insignia de % del invitado respeta su fecha de alta (0%, no 67% inflado por sesiones previas)");
  assert(!guestRow.includes(">67%<"), "openEventoConvModal(): la fila del invitado no muestra el % inflado");

  win.evtTogglePlayer("p1"); // fuerza el refresco de la lista con la misma lógica
  const refreshedHtml = win.document.getElementById("ev-conv-list").innerHTML;
  const guestRow2 = refreshedHtml.slice(refreshedHtml.indexOf("Chaval de Zaragoza") - 5, refreshedHtml.indexOf("Chaval de Zaragoza") + 400);
  assert(guestRow2.includes(">0%<") && !guestRow2.includes(">67%<"), "evtTogglePlayer(): el refresco de la lista también respeta la fecha de alta del invitado");

  return report.summary();
}

module.exports = { run };
