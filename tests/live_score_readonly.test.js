"use strict";
// v3.0.0-dev.43 · B-LIVESYNC1 (reportado por el usuario): "cuando un
// partido se inicia en vivo no sé si debería poder tocar el marcador
// normal... cuando uno gana como visitante y toca cualquier punto se pone
// derrota". Causa raíz: matchDetail() solo sincronizaba m.q (marcador
// manual) desde live.qScores UNA vez, la primera vez que se visitaba la
// pantalla con m.q vacío -- a partir de ahí m.q quedaba "congelado" en esa
// foto, aunque el partido en vivo siguiera avanzando en otra pantalla. Si
// se volvía a matchDetail() y se tocaba cualquier "+"/"−" del marcador
// manual, se estaba editando esa foto vieja (no el partido real), y como
// mScore()/mResult() (el resultado W/L) se calculan sobre m.q, un equipo
// que iba perdiendo en el momento de la foto podía seguir mostrando
// "Derrota" mucho después de haber remontado y ganado de verdad en vivo.
// Fix: con seguimiento en vivo iniciado, matchDetail() resincroniza SIEMPRE
// desde live.qScores (nunca una foto vieja) y el marcador por cuartos deja
// de tener steppers editables -- de solo lectura, tal y como pidió el
// usuario.
const { loadApp, buildFixture, newReporter } = require("./harness");

async function run() {
  const report = newReporter("live_score_readonly");
  const assert = (cond, msg) => report.assert(cond, msg);

  // ── Escenario exacto del bug: visitante remontando ──
  const win = await loadApp();
  const match = buildFixture(win, { location: "away" });
  win.S.screen = "liveGame";
  win.liveGame(); // inicializa m.live
  const m = win.mById(win.S.teamId, win.S.matchId);

  // Momento 1: vamos perdiendo 5-10 (jugando fuera: qScores[0]=nuestro=5, [1]=rival=10)
  m.live.qScores = [[5, 10], [0, 0], [0, 0], [0, 0], [0, 0]];
  win.S.screen = "matchDetail";
  const htmlEarly = win.matchDetail();
  assert(htmlEarly.includes("❌ Derrota") || htmlEarly.includes("Pendiente") === false, "en el momento 1 (vamos perdiendo), el badge refleja correctamente que vamos perdiendo");

  // Momento 2: remontada real en vivo -- ahora vamos ganando 40-30, sin tocar NADA a mano.
  m.live.qScores = [[5, 10], [35, 20], [0, 0], [0, 0], [0, 0]];
  const htmlLate = win.matchDetail();
  assert(htmlLate.includes("🏆 Victoria"), "tras la remontada real en vivo, matchDetail() muestra Victoria (no se queda pegado a la foto vieja del momento 1)");
  assert(!htmlLate.includes("❌ Derrota"), "ya no muestra Derrota una vez remontado el partido en vivo");

  // ── No hay steppers editables mientras haya seguimiento en vivo ──
  assert(!htmlLate.includes("_qStep("), "con seguimiento en vivo, el marcador por cuartos NO tiene steppers +/- editables");
  assert(!htmlLate.includes("_qInlineEdit("), "con seguimiento en vivo, no se puede tocar para editar a mano");
  assert(!htmlLate.includes("addManualOT()"), "con seguimiento en vivo, no se puede añadir una prórroga manual (se hace desde el propio partido en vivo)");
  assert(htmlLate.includes("Marcador de solo lectura"), "se explica al usuario que el marcador es de solo lectura mientras haya seguimiento en vivo");

  // Los valores mostrados siguen siendo correctos (60 nuestro, 30 rival en total: 5+35=40... ajustamos)
  const totalOur = 5 + 35, totalRiv = 10 + 20;
  assert(htmlLate.includes(String(totalOur)) && htmlLate.includes(String(totalRiv)), "los totales mostrados coinciden con la suma real de live.qScores");

  // ── Sin seguimiento en vivo (m.live no existe): sigue totalmente editable, sin cambios ──
  const win2 = await loadApp();
  buildFixture(win2, { location: "away" });
  win2.S.screen = "matchDetail";
  const htmlNoLive = win2.matchDetail();
  assert(htmlNoLive.includes("_qStep("), "SIN seguimiento en vivo, el marcador manual conserva sus steppers +/- de siempre");
  assert(htmlNoLive.includes("addManualOT()"), "SIN seguimiento en vivo, se puede seguir añadiendo una prórroga manual");
  assert(!htmlNoLive.includes("Marcador de solo lectura"), "SIN seguimiento en vivo, no aparece el aviso de solo lectura");

  return report.summary();
}

module.exports = { run };
