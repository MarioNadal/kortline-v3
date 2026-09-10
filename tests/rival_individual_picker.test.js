"use strict";
// v3.0.0-dev.53 · B-RIVALPICK1 (pendiente de la sesión anterior, sin
// confirmar todavía en CONTINUATION.md cuando se escribió este test --
// investigado a fondo aquí antes de tocar nada, como se pidió).
//
// Sospecha original: "¿openActionPicker()/liveAction() tienen un hueco
// registrando faltas individuales de jugadoras RIVALES en modo individual
// (no 'solo equipo') durante un partido en vivo?"
//
// Confirmado: el bug es real, y más amplio que solo faltas. openActionPicker
// (el modal "¿Quién?" que se abre al tocar CUALQUIER botón de acción --
// puntos, rebotes, asistencias, robos, faltas...) construía su lista de
// jugadores siempre a partir de NUESTRA plantilla (pl(S.teamId)) y de
// m.live.onCourt, sin mirar nunca m.live.activeTeam. rival_team_mode.test.js
// ya cubría que, con plantilla rival INCOMPLETA (<5), la app pasa a modo
// equipo (liveTeamAction, sin picker individual) -- pero con plantilla rival
// COMPLETA (>=5, modo individual "sin regresión"), ese test solo comprobaba
// que el HTML seguía conteniendo la palabra "openActionPicker(", nunca que
// el picker resultante mostrara jugadoras del RIVAL. En la práctica, estando
// en la pestaña Rival con su quinteto completo, tocar cualquier botón de
// acción (no solo falta) abría "¿Quién?" con NUESTRAS jugadoras en pista --
// cualquier punto/falta/rebote/robo del rival podía acabar apuntado, por
// error, a una jugadora nuestra. liveAction() en sí YA distinguía
// correctamente el pid rival (isRivalPid) una vez elegido -- el hueco estaba
// enteramente en qué lista de jugadoras ofrecía el picker.
const { loadApp, buildFixture, newReporter } = require("./harness");

async function run() {
  const report = newReporter("rival_individual_picker");
  const assert = (cond, msg) => report.assert(cond, msg);
  const win = await loadApp();

  const rivalPlayers = [
    { id: "r1", name: "Rival Uno", number: 4 },
    { id: "r2", name: "Rival Dos", number: 5 },
    { id: "r3", name: "Rival Tres", number: 6 },
    { id: "r4", name: "Rival Cuatro", number: 7 },
    { id: "r5", name: "Rival Cinco", number: 8 },
  ];
  const match = buildFixture(win, { rivalPlayers, rivalStatsEnabled: true });
  win.S.matchId = "m1";
  win.S.screen = "liveGame";
  win.liveGame(); // inicializa m.live (onCourt propio + rivalOnCourt autopoblado con las 5)
  win.setActiveTeam("rival");
  win.liveGame(); // re-render ya con activeTeam="rival"

  assert((match.live.rivalOnCourt || []).length === 5, "con plantilla rival completa, rivalOnCourt se autopuebla con las 5 al entrar en su pestaña");

  // ── El picker de una acción de PUNTOS, estando en la pestaña Rival ──
  win.openActionPicker("p2m", 2);
  let picker = win.document.getElementById("m-actpicker");
  assert(!!picker, "openActionPicker abre el modal \"¿Quién?\"");
  let html = picker.innerHTML;
  assert(html.includes("_pickActionFor('r1','p2m'"), "en la pestaña Rival, el picker de PUNTOS ofrece a las jugadoras del rival (r1)");
  assert(!html.includes("_pickActionFor('p1','p2m'"), "en la pestaña Rival, el picker de PUNTOS ya NO ofrece a nuestras jugadoras (p1) -- antes del fix sí aparecían");
  assert(html.includes("Rival U."), "el picker muestra el nombre (corto) de la jugadora rival -- _shortName desambigua entre 'Rival Uno'/'Rival Dos'/etc, igual que ya hace con nuestra plantilla");
  picker.remove();

  // Elegir a r1: debe anotarse como canasta RIVAL, sin tocar nuestras stats.
  const ourStatsBefore = JSON.stringify(match.live.stats);
  win._pickActionFor("r1", "p2m", 2);
  assert(match.live.rivalStats && match.live.rivalStats.r1 && match.live.rivalStats.r1.p2m === 1, "la canasta elegida en el picker rival se registra en live.rivalStats.r1");
  assert(match.live.qScores[0][1] === 2, "suma al marcador del RIVAL (columna [1])");
  assert((match.live.qScores[0][0] || 0) === 0, "no suma al marcador propio (columna [0])");
  assert(JSON.stringify(match.live.stats) === ourStatsBefore, "las estadísticas de nuestras jugadoras (live.stats) no se tocan al anotar desde la pestaña Rival");

  // ── El picker de una FALTA, estando en la pestaña Rival (la sospecha original) ──
  win.openActionPicker("foul", 0);
  picker = win.document.getElementById("m-actpicker");
  html = picker.innerHTML;
  assert(html.includes("_pickActionFor('r2','foul'") || html.includes("_pickActionFor('r1','foul'"), "en la pestaña Rival, el picker de FALTA ofrece jugadoras rivales");
  assert(!/_pickActionFor\('p\d','foul'/.test(html), "en la pestaña Rival, el picker de FALTA ya no ofrece a ninguna jugadora nuestra");
  picker.remove();

  win._pickActionFor("r2", "foul", 0);
  assert(match.live.rivalStats.r2 && match.live.rivalStats.r2.foul === 1, "la falta elegida en el picker rival se registra como falta de la jugadora rival r2");
  assert((match.live.rivalFouls || [])[0] === 1, "cuenta como falta de equipo del rival (rivalFouls), no de las nuestras");
  assert((match.live.teamFouls || [0])[0] === 0, "no cuenta como falta de nuestro equipo (teamFouls)");

  // ── Volviendo a nuestra propia pestaña, el picker sigue mostrando nuestra plantilla (sin regresión) ──
  win.setActiveTeam("our");
  win.liveGame();
  win.openActionPicker("p2m", 2);
  picker = win.document.getElementById("m-actpicker");
  html = picker.innerHTML;
  assert(/_pickActionFor\('p\d','p2m'/.test(html), "de vuelta en nuestra pestaña, el picker de PUNTOS vuelve a ofrecer a nuestras jugadoras");
  assert(!/_pickActionFor\('r\d','p2m'/.test(html), "de vuelta en nuestra pestaña, ya no aparecen jugadoras del rival en el picker");
  picker.remove();

  return report.summary();
}

module.exports = { run };
