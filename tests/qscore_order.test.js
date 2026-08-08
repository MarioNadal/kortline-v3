"use strict";
// Historial de esta seccion (matchDetail() -> steppers de anotacion manual
// por cuartos):
//
// v1.8.34 . B-QSCORE1: los steppers se ordenaban por el indice
// local/visitante "en crudo" de m.q (par=local), asi que jugando en CASA
// arriba salia nuestro equipo pero jugando FUERA arriba salia el RIVAL --
// el orden se invertia de partido a partido y confundia al anotar en
// directo. Se cambio a "arriba SIEMPRE nuestro equipo, abajo SIEMPRE el
// rival", pero el titulo de la seccion siguio diciendo "(Local /
// Visitante)", que ya no describia el orden real de las cajas.
//
// v3.0.0-dev.39 . B-STATSLOC1: se detecto esa contradiccion (el usuario
// reporto "el marcador sale bien pero las estadisticas salen al reves,
// siempre primero tu equipo") y se corrigio el TITULO para que dijera
// "(Nosotros / Rival)", que es lo que las cajas hacian de verdad.
//
// v3.0.0-dev.40 . B-QSCORE2: preguntado explicitamente si prefiere que
// las estadisticas sigan el orden real del marcador (Local siempre
// primero, sea quien sea) o que su equipo este siempre a la izquierda, el
// usuario eligio la primera opcion. Se deshace el criterio de B-QSCORE1:
// las cajas vuelven a ir en orden real Local/Visitante -- exactamente
// igual que el marcador de arriba (mismas variables homeColor/awayColor)
// -- y el titulo vuelve a decir "(Local / Visitante)", ahora sin ninguna
// contradiccion porque es literalmente lo que se ve.
const { loadApp, buildFixture, newReporter } = require("./harness");

async function run() {
  const report = newReporter("qscore_order");
  const assert = (cond, msg) => report.assert(cond, msg);

  // ── Partido en CASA: Local == nosotros, sigue arriba (sin cambio visual) ──
  const winHome = await loadApp();
  buildFixture(winHome, { location: "home" });
  winHome.S.screen = "matchDetail";
  const htmlHome = winHome.matchDetail();
  const firstStepHome = htmlHome.match(/_qStep\((\d+),-1\)/);
  assert(!!firstStepHome, "matchDetail() en casa renderiza los steppers de cuartos");
  assert(parseInt(firstStepHome[1]) % 2 === 0, "en casa, el primer stepper (arriba) escribe en el indice LOCAL (par) -- coincide con nuestro equipo, como siempre");

  // ── Partido FUERA: Local == el rival, ahora va arriba (antes iba nuestro equipo) ──
  const winAway = await loadApp();
  buildFixture(winAway, { location: "away" });
  winAway.S.screen = "matchDetail";
  const htmlAway = winAway.matchDetail();
  const firstStepAway = htmlAway.match(/_qStep\((\d+),-1\)/);
  assert(!!firstStepAway, "matchDetail() fuera renderiza los steppers de cuartos");
  assert(parseInt(firstStepAway[1]) % 2 === 0, "fuera, el primer stepper (arriba) escribe en el indice LOCAL (par) -- ahora es el RIVAL, igual que en el marcador de arriba");

  // ── El valor mostrado en el primer stepper es siempre el LOCAL (el rival, si jugamos fuera) ──
  const m = winAway.mById(winAway.S.teamId, winAway.S.matchId);
  m.q = [10, 20, null, null, null, null, null, null, null, null]; // local=10 (rival), visitante=20 (nosotros)
  const htmlAway2 = winAway.matchDetail();
  const firstValMatch = htmlAway2.match(/qv-\d+"[^>]*>([^<]+)</);
  assert(!!firstValMatch && firstValMatch[1] === "10", `fuera, el primer valor mostrado es el LOCAL (10, el rival), igual que en el marcador -- salio "${firstValMatch && firstValMatch[1]}"`);

  // ── El marcador (scoreboard) sigue etiquetando Local/Visitante correctamente ──
  assert(htmlAway2.includes(">Local<") && htmlAway2.includes(">Visitante<"), "el marcador de arriba sigue mostrando las etiquetas Local/Visitante");

  // ── El titulo de la seccion vuelve a decir (Local / Visitante) -- y esta vez SI describe el orden real ──
  assert(htmlHome.includes("Local / Visitante"), "en casa, el titulo de cuartos dice (Local / Visitante)");
  assert(htmlAway2.includes("Local / Visitante"), "fuera, el titulo de cuartos tambien dice (Local / Visitante)");
  assert(!htmlHome.includes("Nosotros / Rival") && !htmlAway2.includes("Nosotros / Rival"), "ya no queda el titulo intermedio (Nosotros / Rival) de la version anterior");

  // ── Las cajas ahora llevan title=Local / title=Visitante, no Nosotros/Rival ──
  assert(htmlAway2.includes('title="Local"') && htmlAway2.includes('title="Visitante"'), "las cajas de los steppers llevan title=Local / title=Visitante, coincidiendo con el marcador");

  return report.summary();
}

module.exports = { run };
