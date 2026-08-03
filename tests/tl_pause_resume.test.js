"use strict";
const { loadApp, buildFixture, newReporter } = require("./harness");

async function run() {
  const report = newReporter("tl_pause_resume");
  const win = await loadApp();
  const match = buildFixture(win);
  match.live = {
    q: 1, clockSec: 600, clockRunning: false, maxQ: 1,
    onCourt: ["p1", "p2", "p3", "p4", "p5"],
    convocados: match.convocados,
    stats: {}, rivalStats: {}, teamFouls: [0, 0, 0, 0, 0, 0], rivalFouls: [0, 0, 0, 0, 0, 0],
    qScores: [[0, 0]], log: [], timeouts: { our: [0, 0, 0, 0, 0, 0], rival: [0, 0, 0, 0, 0, 0] }
  };

  // m-foultl -> m-tlshoot: pausar a medio elegir y a medio marcar aciertos,
  // reanudar y comprobar que el estado interno no se ha perdido.
  win.openFoulTLModal("p1", false, "foul");
  let el = win.document.getElementById("m-foultl");
  report.assert(!!el, "m-foultl se crea");
  win.selectFoulRecipient(el.querySelector("#foultl-players button"), "r1");
  win.setFoulTLCount(2);
  win._pauseTLModal("m-foultl");
  report.assert(el.style.display === "none", "m-foultl se oculta al pausar");
  win._resumeTLModal();
  report.assert(el._rpid === "r1" && el._tl === 2, "m-foultl conserva tirador y conteo tras pausar+reanudar");

  win.confirmFoulTL("p1");
  const shootEl = win.document.getElementById("m-tlshoot");
  report.assert(!!shootEl, "confirmFoulTL abre m-tlshoot");
  win.setTLResult(0, true);
  win._pauseTLModal("m-tlshoot");
  win._resumeTLModal();
  report.assert(JSON.stringify(shootEl._state) === JSON.stringify([true, false]), "m-tlshoot conserva los aciertos marcados tras pausar+reanudar");
  win.setTLResult(1, true);
  win.saveTLResults("r1", 2, "p1");
  report.assert(match.live.rivalStats.r1.p1m === 2, "el resultado final (2/2) se guarda bien tras el ciclo de pausa");

  // m-ourtl -> m-ourtlshoot: mismo patron para nuestro tirador.
  win.openOurFoulTLModal(null, "foul");
  const ourtlEl = win.document.getElementById("m-ourtl");
  win.selectOurTLShooter("p2");
  win.setOurTLCount(1);
  win._pauseTLModal("m-ourtl");
  win._resumeTLModal();
  report.assert(ourtlEl._pid === "p2" && ourtlEl._tl === 1, "m-ourtl conserva tirador y conteo tras pausar+reanudar");
  win.confirmOurTL();
  const ourShootEl = win.document.getElementById("m-ourtlshoot");
  win.setOurTLResult(0, true);
  win._pauseTLModal("m-ourtlshoot");
  win._resumeTLModal();
  win.confirmOurTLShoot("p2", 1);
  report.assert(match.live.stats.p2.p1m === 1, "TL nuestro (1/1) se guarda bien tras el ciclo de pausa");

  // Los 8 modales de TL deben estar cubiertos.
  const expected = ["m-foultl", "m-tlshoot", "m-teamtl", "m-teamtlshoot", "m-ourtl", "m-ourtlshoot", "m-ourtl-team", "m-ourtlshoot-team"];
  report.assert(
    JSON.stringify(win._TL_PAUSABLE.slice().sort()) === JSON.stringify(expected.slice().sort()),
    "_TL_PAUSABLE cubre los 8 modales de tiros libres"
  );

  // Pausar/reanudar sin nada abierto no debe lanzar.
  let threw = false;
  try { win._resumeTLModal(); win._pauseTLModal("m-no-existe"); } catch (e) { threw = true; }
  report.assert(!threw, "pausar/reanudar sin modal activo no lanza error");

  return report.summary();
}

module.exports = { run };
