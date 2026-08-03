"use strict";
const { loadApp, buildFixture, newReporter } = require("./harness");

async function run() {
  const report = newReporter("coach_name");
  const win = await loadApp();
  win.S.teamId = "t1";
  win.S.cfg = win.S.cfg || {};

  report.assert(win._getCoachName() === "", "sin nombre puesto al principio");

  // _cloudEnabled depende de que el SDK de Firebase haya inicializado bien
  // (offline funciona igual, initializeApp no requiere red), pero lo forzamos
  // aqui para que el test no dependa de la disponibilidad real del CDN.
  win._cloudEnabled = true;

  win._maybeShowCoachNamePrompt();
  report.assert(!!win.document.getElementById("m-coachname"), "se muestra el prompt de nombre la primera vez (con Firebase activo)");

  win.document.getElementById("coachname-input").value = "María";
  win._confirmCoachNamePrompt();
  report.assert(win._getCoachName() === "María", "el nombre se guarda tras confirmar");
  report.assert(!win.document.getElementById("m-coachname"), "el prompt se cierra tras confirmar");
  report.assert((win.S.cfg.knownCoachNames || []).includes("María"), "el nombre se añade a la lista de sugerencias compartida");

  win._maybeShowCoachNamePrompt();
  report.assert(!win.document.getElementById("m-coachname"), "no se vuelve a mostrar si ya hay nombre puesto");

  // Segundo dispositivo que salta el prompt.
  const win2 = await loadApp();
  win2.S.teamId = "t1"; win2.S.cfg = win2.S.cfg || {};
  win2._cloudEnabled = true;
  win2._maybeShowCoachNamePrompt();
  report.assert(!!win2.document.getElementById("m-coachname"), "el prompt aparece en un dispositivo nuevo sin nombre");
  win2._skipCoachNamePrompt();
  report.assert(!win2.document.getElementById("m-coachname"), "Ahora no cierra el prompt");
  win2._maybeShowCoachNamePrompt();
  report.assert(!win2.document.getElementById("m-coachname"), "tras saltarlo, no se vuelve a insistir en el mismo dispositivo");
  report.assert(win2._getCoachName() === "", "saltar el prompt no deja un nombre guardado");

  // Sin Firebase activo no se pregunta (no hay "otro dispositivo" del que avisar).
  const win3 = await loadApp();
  win3.S.teamId = "t1"; win3.S.cfg = win3.S.cfg || {};
  win3._cloudEnabled = false;
  win3._maybeShowCoachNamePrompt();
  report.assert(!win3.document.getElementById("m-coachname"), "sin sincronizacion activa no se pregunta el nombre");

  // El aviso de partido en vivo concurrente usa el nombre cuando existe.
  const winA = await loadApp();
  const winB = await loadApp();
  const matchA = buildFixture(winA);
  const matchB = buildFixture(winB);
  winA.S.screen = "liveGame"; winB.S.screen = "liveGame";
  winA._setCoachName("Pablo");
  winA.liveGame();
  report.assert(matchA.live.trackedByName === "Pablo", "el latido de presencia incluye el nombre puesto");

  matchB.live = JSON.parse(JSON.stringify(matchA.live));
  let toastsB = [];
  winB.toast = (m) => toastsB.push(m);
  winB.liveGame();
  report.assert(toastsB.length === 1, "el segundo dispositivo ve un aviso");
  report.assert(toastsB[0].includes("Pablo"), "el aviso menciona el nombre del entrenador en vez de \"otro dispositivo\"");

  // Si el otro dispositivo no ha puesto nombre, el aviso cae al texto generico.
  const winC = await loadApp();
  const matchC = buildFixture(winC);
  winC.S.screen = "liveGame";
  matchC.live = JSON.parse(JSON.stringify(matchA.live));
  matchC.live.trackedByName = null;
  let toastsC = [];
  winC.toast = (m) => toastsC.push(m);
  winC.liveGame();
  report.assert(toastsC.length === 1 && /otro dispositivo/i.test(toastsC[0]), "sin nombre puesto, el aviso usa el texto generico (no regresion)");

  return report.summary();
}

module.exports = { run };
