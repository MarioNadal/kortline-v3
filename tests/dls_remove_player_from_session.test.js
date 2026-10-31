"use strict";
// v3.0.0-dev.97 · B-DLS12: bug real reportado por Mario -- "en la sesión
// infantil masculino del 19 [...] te he añadido un puntual pero no puedo
// quitarlo [...] Kilian Pérez [...] hay que hacer algo para que si pasa eso
// se pueda borrar". Causa: el único botón para quitar a un jugador puntual
// (_dlsRemoveTemp) solo existe durante la CONFIGURACIÓN de un ejercicio en
// vivo, antes de arrancarlo (ver openDlsSetupModal) -- una vez la sesión ya
// está guardada (en curso o terminada) no había ninguna forma de corregir
// un jugador añadido por error, ni puntual ni de plantilla fija. Este test
// fija la solución: un botón "✕" por fila en el resumen de una sesión ya
// TERMINADA (mismo criterio que el ya existente "🗑 Borrar esta sesión"),
// que quita a ese jugador de `players`/`stats`/`log` sin tocar el resto de
// la sesión ni las demás sesiones.
const { loadApp, newReporter } = require("./harness.js");

async function run() {
  const win = await loadApp();
  const report = newReporter("dls_remove_player_from_session");
  const { document } = win;

  win.S.teamId = "t1";
  win.S.teams = [{ id: "t1", name: "Infantil Masculino", category: "Infantil", gender: "Masculino", coaches: [] }];
  win.S.players = {
    t1: [
      { id: "p1", name: "Ana", number: 4 },
      { id: "p2", name: "Bea", number: 5 }
    ]
  };
  win.S.drills = { t1: [{ id: "d1", name: "Pichi", category: "transition", dlsType: "b11" }] };
  win.S.matches = { t1: [] };
  win.S.events = { t1: [] };
  win.S.sessions = {};
  win.S.date = "2026-10-19";
  win.S.cfg.features.exercises = true;

  const emptyStats = () => ({ p2m: 0, p2a: 0, p3m: 0, p3a: 0, reb: 0, to: 0, stl: 0, ast: 0, blk: 0 });
  // Kilian: puntual añadido por error, con alguna estadística ya anotada.
  const kilian = { id: "tmp_kilian", name: "Kilian Pérez", number: null, temp: true };

  win.S.drillLive = {
    t1: {
      d1: [
        {
          id: "s_running", drillId: "d1", drillName: "Pichi", date: "2026-10-19", type: "b11", status: "running",
          checklist: { ast: true, missTrack: true, missPenalty: false }, durationSec: 600, remainingSec: 300,
          players: [{ id: "p1", name: "Ana", number: 4 }, kilian],
          stats: { p1: emptyStats(), tmp_kilian: emptyStats() },
          log: []
        },
        {
          id: "s_finished", drillId: "d1", drillName: "Pichi", date: "2026-10-19", type: "b11", status: "finished",
          checklist: { ast: true, missTrack: true, missPenalty: false }, durationSec: 600, remainingSec: 0,
          players: [{ id: "p1", name: "Ana", number: 4 }, { id: "p2", name: "Bea", number: 5 }, kilian],
          stats: {
            p1: { ...emptyStats(), p2m: 2 },
            p2: { ...emptyStats(), p3m: 1 },
            tmp_kilian: { ...emptyStats(), reb: 3 }
          },
          log: [
            { pid: "p1", action: "p2m", ts: 1 },
            { pid: "tmp_kilian", action: "reb", ts: 2 },
            { pid: "tmp_kilian", action: "reb", ts: 3 },
            { pid: "tmp_kilian", action: "reb", ts: 4 },
            { pid: "p2", action: "p3m", ts: 5 }
          ]
        }
      ]
    }
  };

  // ── Una sesión EN CURSO no ofrece el botón de quitar jugador ──
  win._dlsOpenHistorySession("d1", "s_running");
  let summaryHtml = document.getElementById("m-dls-summary").innerHTML;
  report.assert(!summaryHtml.includes("_dlsConfirmRemovePlayer"), "una sesión en curso no ofrece quitar jugadores desde su resumen (mismo criterio que borrar sesión entera)");
  document.getElementById("m-dls-summary").remove();

  // ── Una sesión TERMINADA SÍ ofrece el botón, uno por jugador (incluido el puntual) ──
  win._dlsOpenHistorySession("d1", "s_finished");
  summaryHtml = document.getElementById("m-dls-summary").innerHTML;
  report.assert(summaryHtml.includes("Kilian Pérez"), "el resumen de la sesión terminada muestra al puntual, igual que a cualquier jugador");
  const removeButtons = [...document.querySelectorAll("#m-dls-summary button[onclick*=\"_dlsConfirmRemovePlayer\"]")];
  report.assert(removeButtons.length === 3, "hay un botón de quitar por cada uno de los 3 jugadores de la sesión terminada -- dio " + removeButtons.length);

  // ── Quitar pide confirmación -- no es un borrado de un solo toque ──
  win._dlsConfirmRemovePlayer("d1", "s_finished", "tmp_kilian");
  const confirmDialog = document.getElementById("m-confirm");
  report.assert(!!confirmDialog, "quitar a un jugador pide confirmación antes de hacerlo de verdad");
  report.assert(confirmDialog.innerHTML.includes("Kilian Pérez"), "el diálogo de confirmación nombra al jugador concreto que se va a quitar");

  // ── Cancelar no toca nada ──
  document.querySelector("#m-confirm button:nth-of-type(2)").click(); // "Cancelar"
  const sFinishedBefore = win.S.drillLive.t1.d1.find(s => s.id === "s_finished");
  report.assert(sFinishedBefore.players.some(p => p.id === "tmp_kilian"), "cancelar el diálogo NO quita al jugador");
  report.assert(!!sFinishedBefore.stats.tmp_kilian, "cancelar tampoco toca sus estadísticas");

  // ── Confirmar SÍ lo quita, y solo a él ──
  win._dlsConfirmRemovePlayer("d1", "s_finished", "tmp_kilian");
  document.querySelector("#m-confirm button").click(); // "Quitar" (primer botón)
  const sFinishedAfter = win.S.drillLive.t1.d1.find(s => s.id === "s_finished");
  report.assert(!sFinishedAfter.players.some(p => p.id === "tmp_kilian"), "tras confirmar, el puntual ya no está en `players`");
  report.assert(sFinishedAfter.stats.tmp_kilian === undefined, "su entrada en `stats` también se borra");
  report.assert(!sFinishedAfter.log.some(l => l.pid === "tmp_kilian"), "sus entradas sueltas en `log` también se limpian");
  report.assert(sFinishedAfter.players.length === 2, "los otros 2 jugadores de esa sesión siguen ahí -- dio " + sFinishedAfter.players.length);
  report.assert(sFinishedAfter.stats.p1.p2m === 2 && sFinishedAfter.stats.p2.p3m === 1, "las estadísticas de los jugadores que NO se quitan no se tocan");
  report.assert(sFinishedAfter.log.filter(l => l.pid === "p1" || l.pid === "p2").length === 2, "las entradas de log de los demás jugadores se mantienen intactas");

  // ── La OTRA sesión (la que seguía en curso) no se ve afectada ──
  const sRunningAfter = win.S.drillLive.t1.d1.find(s => s.id === "s_running");
  report.assert(sRunningAfter.players.some(p => p.id === "tmp_kilian"), "quitar de una sesión no toca a Kilian en la otra sesión distinta");

  // ── El resumen se refresca solo, ya sin la fila del jugador quitado ──
  const summaryAfterHtml = document.getElementById("m-dls-summary")?.innerHTML || "";
  report.assert(!!document.getElementById("m-dls-summary"), "el resumen se vuelve a abrir solo tras quitar, para ver la tabla ya actualizada");
  report.assert(!summaryAfterHtml.includes("Kilian Pérez"), "la tabla del resumen ya no incluye la fila del jugador quitado");
  report.assert(summaryAfterHtml.includes("Ana") && summaryAfterHtml.includes("Bea"), "los demás jugadores siguen saliendo en la tabla");

  return report.summary();
}

module.exports = { run };
