"use strict";
// v3.0.0-dev.43 · dos correcciones relacionadas con las faltas del rival en
// el partido en vivo, encontradas al investigar el aviso del usuario
// ("porque han vuelto las faltas manuales en el marcador... cuando se ponen
// las estadisticas al rival tambien esto esta mal y cuando salta el bonus
// no salta lo de arriba"). Se comprobó por git diff que ninguno de los dos
// bugs lo introdujeron los commits de esta sesión (B-QSCORE2/B-BONUS2 no
// tocan esta zona del código) -- son bugs previos que se corrigen aquí:
//
// B-FOULBTN1: el +/- manual de faltas de equipo del rival (rivalFoulLive)
// se mostraba SIEMPRE, incluso con seguimiento individual del rival activo
// (rivalEnabled=true) -- a diferencia del +/- manual del MARCADOR del
// rival, que sí solo aparece sin seguimiento individual. Con jugadores
// rivales registrados, usar el botón manual suma una falta de equipo sin
// atribuirla a ningún jugador, descuadrando las estadísticas individuales.
//
// B-BONUS3: la insignia de cabecera "BONUS" solo avisaba de NUESTRAS
// faltas de equipo (el rival tira libres); no había ningún aviso
// persistente equivalente para cuando es el RIVAL el que llega a 5 faltas
// de equipo (somos NOSOTROS quienes tiramos libres a partir de ahí).
const { loadApp, buildFixture, newReporter } = require("./harness");

async function run() {
  const report = newReporter("rival_foul_manual");
  const assert = (cond, msg) => report.assert(cond, msg);

  // ── B-FOULBTN1: con seguimiento individual del rival, NO debe verse el +/- manual ──
  const win1 = await loadApp();
  buildFixture(win1, { location: "home", rivalStatsEnabled: true });
  win1.S.screen = "liveGame";
  const html1 = win1.liveGame();
  assert(!html1.includes("rivalFoulLive(-1)") && !html1.includes("rivalFoulLive(1)"), "con seguimiento individual del rival (rivalEnabled), NO aparece el +/- manual de faltas de equipo del rival");

  // ── Sin seguimiento individual del rival (fuera de casa, rival sin jugadores), el +/- manual SIGUE disponible ──
  const win2 = await loadApp();
  const match2 = buildFixture(win2, { location: "away", rivalStatsEnabled: false });
  match2.rivalPlayers = [];
  win2.S.screen = "liveGame";
  const html2 = win2.liveGame();
  assert(html2.includes("rivalFoulLive(-1)") && html2.includes("rivalFoulLive(1)"), "SIN seguimiento individual del rival, el +/- manual de faltas del rival sigue disponible (es la única forma de anotarlas)");

  // ── Nuestro propio +/- de faltas (si existiera) no se ve afectado -- no existe, las nuestras siempre van por jugador ──
  assert(!html1.includes('onclick="_qStep'), "liveGame() no usa steppers de matchDetail (verificación de que no se mezclan pantallas)");

  // ── B-BONUS3: insignia "BONUS A FAVOR" cuando el RIVAL llega a 5 faltas de equipo ──
  const win3 = await loadApp();
  buildFixture(win3, { location: "home" });
  win3.S.screen = "liveGame";
  win3.liveGame();
  const m3 = win3.mById(win3.S.teamId, win3.S.matchId);

  m3.live.rivalFouls[0] = 3;
  let html3 = win3.liveGame();
  assert(!html3.includes("BONUS A FAVOR"), "con 3 faltas de equipo del rival, todavía NO se muestra la insignia de bonus a favor");

  m3.live.rivalFouls[0] = 5;
  html3 = win3.liveGame();
  assert(html3.includes("BONUS A FAVOR"), "con 5 faltas de equipo del rival, se muestra la insignia 'BONUS A FAVOR' en la cabecera");

  // Nuestra propia insignia BONUS sigue funcionando igual (sin regresión)
  m3.live.teamFouls[0] = 5;
  html3 = win3.liveGame();
  assert(html3.includes(">BONUS<"), "nuestra propia insignia BONUS (cuando SOMOS nosotros los que llegamos a 5 faltas) sigue funcionando sin cambios");
  assert(html3.includes("BONUS A FAVOR") && html3.includes(">BONUS<"), "ambas insignias pueden mostrarse a la vez si los dos equipos están en bonus simultáneamente");

  return report.summary();
}

module.exports = { run };
