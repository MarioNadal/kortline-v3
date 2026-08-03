"use strict";
const { loadApp, buildFixture, newReporter } = require("./harness");

async function run() {
  const report = newReporter("dq_guards_tl_shooter");
  const win = await loadApp();
  const match = buildFixture(win);
  match.live = {
    q: 1, onCourt: ["p1", "p2", "p3", "p4", "p5"], rivalOnCourt: ["r1"],
    stats: { p6: { foul: 5 } }, rivalStats: {},
    teamFouls: [0, 0, 0, 0, 0, 0], rivalFouls: [0, 0, 0, 0, 0, 0],
    qScores: [[0, 0]], log: [], timeouts: { our: [0, 0, 0, 0, 0, 0], rival: [0, 0, 0, 0, 0, 0] }
  };

  // p6 esta descalificada (5 faltas) y en el banquillo. El picker de "quien
  // tira nuestro TL" (tras una falta del rival) no debe dejarla elegir, ni
  // aunque se fuerce el estado interno saltandose la UI.
  win.openOurFoulTLModal(null, "foul");
  const el = win.document.getElementById("m-ourtl");
  report.assert(!!el, "m-ourtl se crea");

  const p6Btn = el.querySelector('button[data-pid="p6"]');
  report.assert(!!p6Btn, "la fila de la jugadora descalificada aparece en el banquillo");
  report.assert(/DESCALIFICAD/i.test(p6Btn.innerHTML), "la fila muestra el aviso de descalificada");
  report.assert(!p6Btn.getAttribute("onclick").includes("selectOurTLShooter"), "el click de la fila NO llama a selectOurTLShooter");

  el._pid = "p6"; el._tl = 1; el._fromBench = true;
  let toasts = [];
  win.toast = (m) => toasts.push(m);
  win.confirmOurTL();
  report.assert(!match.live.onCourt.includes("p6"), "confirmOurTL bloquea a la jugadora descalificada aunque se fuerce _pid (defensa en profundidad)");
  report.assert(toasts.some(t => /descalificad/i.test(t)), "confirmOurTL avisa con toast al bloquear");
  report.assert(!!win.document.getElementById("m-ourtl"), "el modal no se cierra si se bloquea");

  // No regresion: un jugador de banquillo SIN descalificar si debe poder
  // elegirse y entrar a pista.
  match.live.stats.p6 = { foul: 1 };
  win.selectOurTLShooter("p6");
  report.assert(el._pid === "p6", "selectOurTLShooter SI selecciona a un jugador de banquillo sin descalificar");
  win.setOurTLCount(0);
  win.confirmOurTL();
  report.assert(match.live.onCourt.includes("p6"), "confirmOurTL SI mete en pista a un jugador de banquillo valido (no regresion)");

  return report.summary();
}

module.exports = { run };
