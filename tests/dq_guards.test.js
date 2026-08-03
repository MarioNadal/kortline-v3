"use strict";
const { loadApp, buildFixture, newReporter } = require("./harness");

async function run() {
  const report = newReporter("dq_guards");
  const win = await loadApp();
  const match = buildFixture(win);
  match.live = {
    q: 1, onCourt: ["p1", "p2", "p3", "p4", "p5"], rivalOnCourt: ["r1"],
    stats: { p6: { foul: 5 } },
    rivalStats: {},
    teamFouls: [0, 0, 0, 0, 0, 0], rivalFouls: [0, 0, 0, 0, 0, 0],
    qScores: [[0, 0]], log: [], timeouts: { our: [0, 0, 0, 0, 0, 0], rival: [0, 0, 0, 0, 0, 0] },
    convocados: match.convocados
  };
  win.S.matchId = "m1";

  // p6 tiene 5 faltas personales -> descalificado. No debe poder entrar a
  // pista por ninguna de las 3 vias independientes de sustitucion.
  let toasts = [];
  win.toast = (m) => toasts.push(m);

  win.subPlayer("p6", "p1");
  report.assert(!match.live.onCourt.includes("p6"), "subPlayer bloquea a un descalificado (banquillo -> pista normal)");
  report.assert(toasts.some(t => /descalificado/i.test(t)), "subPlayer avisa con toast al bloquear");

  toasts = [];
  win._tmPickIn && report.assert(typeof win._tmPickIn === "function", "_tmPickIn existe (sustitucion desde tiempo muerto)");
  if (typeof win._tmPickIn === "function") {
    win._tmOutPid = "p1";
    win._tmPickIn("p6");
    report.assert(!match.live.onCourt.includes("p6"), "_tmPickIn bloquea a un descalificado (sustitucion en tiempo muerto)");
  }

  match.live.rivalOnCourt = ["r2"];
  match.rivalPlayers = [{ id: "r1", name: "Rival Uno", number: 10 }, { id: "r2", name: "Rival Dos", number: 11 }];
  match.live.rivalStats = { r1: { foul: 5 } };
  toasts = [];
  win.subRivalPlayer("r1", "r2");
  report.assert(!match.live.rivalOnCourt.includes("r1"), "subRivalPlayer bloquea a un rival descalificado");

  // Sanity: un jugador SIN descalificar si puede entrar por las 3 vias.
  match.live.onCourt = ["p2", "p3", "p4", "p5"];
  match.live.stats.p1 = { foul: 1 };
  win.subPlayer("p1", null);
  report.assert(match.live.onCourt.includes("p1"), "subPlayer SI deja entrar a un jugador sin descalificar (no regresion)");

  return report.summary();
}

module.exports = { run };
