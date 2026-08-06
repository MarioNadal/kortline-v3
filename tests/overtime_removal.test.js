"use strict";
const { loadApp, newReporter } = require("./harness");

// B-OT1: auditoría del modo "solo equipo" y la prórroga. Bug real
// encontrado: removeLastOT() borraba la columna de marcador de la última
// prórroga (m.q / live.qScores) pero dejaba intactas las jugadas ya
// registradas ahí (live.log, live.stats) -- si de verdad se había jugado y
// anotado en esa OT, el resultado por cuartos dejaba de cuadrar con los
// totales de jugador/equipo sin ningún aviso. Ahora se pide confirmación
// explícita cuando hay jugadas registradas; si no hay ninguna, se quita al
// instante como siempre.
async function run() {
  const report = newReporter("overtime_removal");
  const win = await loadApp();
  win.S.teamId = "t1";
  win.S.matchId = "m1";
  win.S.teams = [{ id: "t1", name: "CB Jaca", coaches: [], color: "#f06318" }];
  win.S.players = { t1: [{ id: "p1", name: "Ana", number: 4 }] };

  // ── Caso CON jugadas registradas en la OT: debe pedir confirmación.
  win.S.matches = {
    t1: [
      {
        id: "m1",
        date: "2026-08-01",
        quarters: 4,
        q: [10, 8, 12, 9, 11, 10, 14, 12, 5, 4],
        live: {
          otCount: 1,
          qScores: [[10, 8], [12, 9], [11, 10], [14, 12], [5, 4]],
          stats: { p1: { p2m: 2, p2a: 0 } },
          log: [{ pid: "p1", action: "p2m", pts: 2, q: 5, clockAt: 120 }],
        },
      },
    ],
  };
  win.removeLastOT();
  let m = win.mById("t1", "m1");
  report.assert(m.live.otCount === 1, "con jugadas registradas, NO quita la OT de inmediato (queda pendiente de confirmar)");
  report.assert(!!win.document.getElementById("m-confirm"), "con jugadas registradas, aparece el modal de confirmación");
  win.document.getElementById("m-confirm").querySelector("button").click();
  m = win.mById("t1", "m1");
  report.assert(m.live.otCount === 0, "tras confirmar, la OT se quita de verdad");
  report.assert(m.q[8] === null && m.q[9] === null, "tras confirmar, la columna de marcador de esa OT queda vacía");
  report.assert(m.live.log.some((e) => e.q === 5), "las jugadas históricas de esa OT NO se borran del log (el aviso decía esto explícitamente)");
  report.assert(m.live.stats.p1.p2m === 2, "las estadísticas del jugador de esa OT tampoco se borran (mismo motivo)");

  // ── Caso SIN jugadas registradas: se quita al instante, sin fricción.
  win.S.matches = {
    t1: [
      {
        id: "m1",
        date: "2026-08-01",
        quarters: 4,
        q: [10, 8, 12, 9, 11, 10, 14, 12, null, null],
        live: { otCount: 1, qScores: [[10, 8], [12, 9], [11, 10], [14, 12], [0, 0]], log: [] },
      },
    ],
  };
  win.removeLastOT();
  m = win.mById("t1", "m1");
  report.assert(m.live.otCount === 0, "sin jugadas registradas, la OT se quita de inmediato");
  report.assert(!win.document.getElementById("m-confirm"), "sin jugadas registradas, no aparece ningún modal");

  return report.summary();
}

module.exports = { run };
