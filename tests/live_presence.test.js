"use strict";
const { loadApp, buildFixture, newReporter } = require("./harness");

async function run() {
  const report = newReporter("live_presence");

  const winA = await loadApp();
  const winB = await loadApp();
  const matchA = buildFixture(winA);
  const matchB = buildFixture(winB);
  winA.S.screen = "liveGame";
  winB.S.screen = "liveGame";

  let toastsA = [];
  winA.toast = (m) => toastsA.push(m);
  winA.liveGame();
  report.assert(toastsA.length === 0, "el primer dispositivo en entrar no ve aviso de concurrencia");
  const idA = matchA.live.trackedBy;
  report.assert(!!idA, "el primer dispositivo marca su latido de presencia");

  // Simula que la sincronizacion a Firestore ya trajo el latido de A a B.
  matchB.live = JSON.parse(JSON.stringify(matchA.live));

  let toastsB = [];
  winB.toast = (m) => toastsB.push(m);
  winB.liveGame();
  report.assert(toastsB.length === 1, "el segundo dispositivo ve un aviso al entrar mientras el primero esta activo");
  report.assert(/otro dispositivo/i.test(toastsB[0] || ""), "el aviso menciona a otro dispositivo");
  report.assert(matchB.live.trackedBy !== idA, "el segundo dispositivo tiene su propio id, distinto al primero");

  winB.liveGame();
  report.assert(toastsB.length === 1, "no se repite el aviso en renders sucesivos del mismo partido");

  // Latido propio no avisa.
  let toastsSelf = [];
  winB.toast = (m) => toastsSelf.push(m);
  winB._checkLivePresence({ id: "m1", live: { trackedBy: matchB.live.trackedBy, trackedAt: Date.now() } });
  report.assert(toastsSelf.length === 0, "un latido del propio dispositivo no genera aviso");

  // Latido caducado no avisa.
  let toastsStale = [];
  winB.toast = (m) => toastsStale.push(m);
  winB._checkLivePresence({ id: "m1", live: { trackedBy: idA, trackedAt: Date.now() - 40000 } });
  report.assert(toastsStale.length === 0, "un latido caducado (>25s) no genera aviso");

  // _matchCmpView debe ignorar clockSec/trackedBy/trackedAt para no generar
  // ruido de sincronizacion, pero SI detectar cambios reales de juego.
  const m1 = { id: "m1", live: { clockSec: 100, trackedBy: "dA", trackedAt: 111, onCourt: ["p1"] } };
  const m2 = { id: "m1", live: { clockSec: 55, trackedBy: "dB", trackedAt: 999999, onCourt: ["p1"] } };
  report.assert(
    JSON.stringify(winA._matchCmpView(m1)) === JSON.stringify(winA._matchCmpView(m2)),
    "_matchCmpView ignora clockSec/trackedBy/trackedAt"
  );
  const m3 = { id: "m1", live: { clockSec: 100, trackedBy: "dA", trackedAt: 111, onCourt: ["p1", "p2"] } };
  report.assert(
    JSON.stringify(winA._matchCmpView(m1)) !== JSON.stringify(winA._matchCmpView(m3)),
    "_matchCmpView SI detecta un cambio real (onCourt distinto)"
  );

  return report.summary();
}

module.exports = { run };
