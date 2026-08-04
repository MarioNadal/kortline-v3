"use strict";
// v1.8.32 · B-GUEST1: jugadores puntuales/invitados (suben de categoría para
// un partido concreto, o un externo que juega/entrena de forma excepcional).
// Se crean como jugadores normales de la plantilla (guest:true) para que
// hereden gratis todo el pipeline de stats/asistencia -- decisión tomada con
// el usuario de que SÍ cuenten en las estadísticas de temporada del equipo.
// Este test también cubre los dos arreglos relacionados: el modo "solo
// stats de equipo" ya no exige 5 convocados para poder jugar.
const { loadApp, buildFixture, newReporter } = require("./harness");

async function run() {
  const report = newReporter("guest_players");
  const assert = (cond, msg) => report.assert(cond, msg);

  // ── A: invitado añadido desde la convocatoria de un partido ──
  const win = await loadApp();
  buildFixture(win, { teamOnlyStats: false });
  win.S.screen = "matchDetail";
  win.openConvSetup();
  win.openGuestPlayerModal({ mode: "match" });
  win.document.getElementById("gp-name").value = "Chaval de Zaragoza";
  win.document.getElementById("gp-num").value = "77";
  win.document.getElementById("gp-note").value = "Externo · partido puntual";
  win._guestPlayerCommit("match");

  const guest = win.pl(win.S.teamId).find(p => p.name === "Chaval de Zaragoza");
  assert(!!guest, "el invitado se crea como jugador de la plantilla");
  assert(guest && guest.guest === true, "el invitado queda marcado con guest:true");
  assert(guest && guest.number === "77", "el dorsal del invitado se guarda");
  const mAfter = win.mById(win.S.teamId, win.S.matchId);
  assert(mAfter.convocados.includes(guest.id), "el invitado queda convocado automáticamente a ese partido");

  // Dorsal duplicado: no debe poder llevar el mismo número que otro jugador
  win.openGuestPlayerModal({ mode: "match" });
  win.document.getElementById("gp-name").value = "Otro Invitado";
  win.document.getElementById("gp-num").value = "4"; // ya lo lleva p1 en el fixture
  win._guestPlayerCommit("match");
  const dupeGuest = win.pl(win.S.teamId).find(p => p.name === "Otro Invitado");
  assert(!dupeGuest, "no se crea el invitado si el dorsal ya lo lleva otro jugador de la plantilla");

  // ── B: invitado añadido desde el pase de lista de un entreno ──
  const win2 = await loadApp();
  buildFixture(win2, {});
  win2.S.date = win2.td();
  win2.openGuestPlayerModal({ mode: "att" });
  win2.document.getElementById("gp-name").value = "Jugadora Puntual";
  win2.document.getElementById("gp-num").value = "";
  win2._guestPlayerCommit("att");
  const guest2 = win2.pl(win2.S.teamId).find(p => p.name === "Jugadora Puntual");
  assert(!!guest2 && guest2.guest === true, "el invitado de entreno se crea marcado como guest");
  const sessKey = win2.sk(win2.S.teamId, win2.S.date);
  assert(win2.S.sessions[sessKey] && win2.S.sessions[sessKey][guest2.id] === "present", "el invitado de entreno queda marcado presente ese día");

  // El invitado debe aparecer en el listado de la plantilla con la insignia
  win2.S.screen = "team";
  win2.render();
  const teamHtml = win2.document.getElementById("root").innerHTML;
  assert(teamHtml.includes("Jugadora Puntual") && teamHtml.includes("PUNTUAL"), "el invitado aparece en Jugadores con la insignia de puntual");

  // ── C: modo "solo stats de equipo" no exige convocatoria ──
  const win3 = await loadApp();
  buildFixture(win3, { teamOnlyStats: true, convocados: [] });
  win3.S.screen = "liveGame";
  const htmlBefore = win3.liveGame();
  assert(!htmlBefore.includes("Sin convocados") && win3.S.screen === "liveGame", "en modo equipo se puede entrar al partido en vivo sin convocados");
  assert(!!win3.mById(win3.S.teamId, win3.S.matchId).live, "el live se inicializa igualmente en modo equipo sin convocados");

  // _convFinish() tampoco debe bloquear por falta de convocados/titulares/capitán
  win3.S.screen = "matchDetail";
  win3._convFinish();
  assert(win3.S.screen === "matchDetail" && !win3.document.getElementById("m-conv-validation"), "_convFinish() no bloquea con 0 convocados en modo equipo");

  return report.summary();
}

module.exports = { run };
