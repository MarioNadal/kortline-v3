"use strict";
// v1.8.34 · B-QSCORE1: al anotar el resultado manual por cuartos en
// matchDetail(), los dos steppers de cada cuarto se ordenaban por el indice
// local/visitante "en crudo" de m.q (indice par = local siempre arriba),
// asi que jugando en CASA arriba salia nuestro equipo pero jugando FUERA
// arriba salia el RIVAL -- el orden se invertia de partido a partido y
// confundia al anotar en directo (justo lo que reporto el usuario: "si
// estoy de visitante... al reves queda raro para anotar"). Este test fija
// que nuestro equipo esta SIEMPRE en el primer stepper (arriba/izquierda),
// tanto en casa como fuera, aunque el indice de m.q al que escribe cada
// stepper siga siendo el correcto (par=local, impar=visitante) para que el
// marcador y el acta (Local/Visitante) sigan siendo correctos.
const { loadApp, buildFixture, newReporter } = require("./harness");

async function run() {
  const report = newReporter("qscore_order");
  const assert = (cond, msg) => report.assert(cond, msg);

  // ── Partido en CASA: nuestro equipo ya era el indice par (local) ──
  const winHome = await loadApp();
  buildFixture(winHome, { location: "home" });
  winHome.S.screen = "matchDetail";
  const htmlHome = winHome.matchDetail();
  // El primer stepper de cada cuarto debe escribir en el indice PAR (local)
  // porque en casa nuestro equipo YA es el local.
  const firstStepHome = htmlHome.match(/_qStep\((\d+),-1\)/);
  assert(!!firstStepHome, "matchDetail() en casa renderiza los steppers de cuartos");
  assert(parseInt(firstStepHome[1]) % 2 === 0, "en casa, el primer stepper (arriba) escribe en el indice LOCAL (par) -- coincide con nuestro equipo");

  // ── Partido FUERA: nuestro equipo es el indice impar (visitante) ──
  const winAway = await loadApp();
  buildFixture(winAway, { location: "away" });
  winAway.S.screen = "matchDetail";
  const htmlAway = winAway.matchDetail();
  const firstStepAway = htmlAway.match(/_qStep\((\d+),-1\)/);
  assert(!!firstStepAway, "matchDetail() fuera renderiza los steppers de cuartos");
  assert(parseInt(firstStepAway[1]) % 2 === 1, "fuera, el primer stepper (arriba) escribe en el indice VISITANTE (impar) -- sigue siendo nuestro equipo arriba, no el rival");

  // ── El valor mostrado en el primer stepper es siempre "nuestro" marcador ──
  const m = winAway.mById(winAway.S.teamId, winAway.S.matchId);
  m.q = [10, 20, null, null, null, null, null, null, null, null]; // local=10 (rival), visitante=20 (nosotros)
  const htmlAway2 = winAway.matchDetail();
  const firstValMatch = htmlAway2.match(/qv-\d+"[^>]*>([^<]+)</);
  assert(!!firstValMatch && firstValMatch[1] === "20", `fuera, el primer valor mostrado es el NUESTRO (20), no el del rival (10) -- salio "${firstValMatch && firstValMatch[1]}"`);

  // ── El marcador (scoreboard) sigue etiquetando Local/Visitante correctamente ──
  assert(htmlAway2.includes(">Local<") && htmlAway2.includes(">Visitante<"), "el marcador de arriba sigue mostrando las etiquetas Local/Visitante");

  return report.summary();
}

module.exports = { run };
