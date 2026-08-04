"use strict";
// v1.8.35 · B-SHOTMAP1: el mapa de tiro mezclaba los tiros del equipo rival
// (en modo "solo equipo", con la pestana Rival activa) con los nuestros --
// tanto liveTeamAction() como el propio array m.live.shots[] los guardaba
// todos con pid "team", asi que el mapa de temporada (lo importante, segun
// el usuario) se contaminaba con tiros de un rival concreto de un partido
// concreto. Este test comprueba: (1) que un tiro anotado con la pestana
// Rival activa en modo equipo se etiqueta pid "rival-team" / rival:true en
// vez de "team", (2) que un tiro de un jugador rival INDIVIDUAL (plantilla
// propia) tambien se etiqueta rival:true, (3) que shotMap() separa "Nuestro
// equipo" de "Rival (este partido)" y no deja mezclar ambos, y (4) que el
// agregado de temporada nunca incluye tiros del rival.
const { loadApp, buildFixture, newReporter } = require("./harness");

async function run() {
  const report = newReporter("shotmap_rival");
  const assert = (cond, msg) => report.assert(cond, msg);

  // ── Escenario 1: modo "solo equipo" con shot chart activo ──
  const win = await loadApp();
  const m = buildFixture(win, {
    teamOnlyStats: true,
    shotChart: true,
    rivalPlayers: [],
    live: { activeTeam: "our", q: 1, clockSec: 600, qScores: [[0, 0]], teamAgg: {}, rivalTeamAgg: {} }
  });

  // Tiro NUESTRO: 2pt anotado, con la pestaña "Nuestro" activa.
  win.S.teamId = "t1"; win.S.matchId = "m1";
  win.liveTeamAction("p2m", 2); // debe abrir el modal con pid "team" (shotChart activo intercepta)
  assert(!!win.document.getElementById("m-shotchart"), "liveTeamAction() con shotChart activo abre el modal de captura (lado nuestro)");
  assert(win.document.getElementById("m-shotchart").innerHTML.includes("Equipo (sin jugador)"), "el modal muestra 'Equipo (sin jugador)' para el lado nuestro");
  win._confirmShot("team", "p2m", 2, 0.5, 0.75); // confirmar directamente (evita depender de la geometría del court)

  // Tiro del RIVAL: 3pt fallado, con la pestaña "Rival" activa.
  m.live.activeTeam = "rival";
  win.liveTeamAction("p3a", 0);
  assert(!!win.document.getElementById("m-shotchart"), "liveTeamAction() con shotChart activo abre el modal de captura (lado rival)");
  assert(win.document.getElementById("m-shotchart").innerHTML.includes("Rival (sin jugador)"), "el modal muestra 'Rival (sin jugador)' cuando la pestaña activa es Rival -- ANTES decía 'Equipo (sin jugador)' igual que el nuestro");
  win._confirmShot("rival-team", "p3a", 0, 0.05, 0.5);

  assert(m.live.shots.length === 2, "se registraron los 2 tiros en m.live.shots");
  const ourShot = m.live.shots.find(s => s.pid === "team");
  const rivalShot = m.live.shots.find(s => s.pid === "rival-team");
  assert(!!ourShot && ourShot.rival === false, "el tiro nuestro queda con pid 'team' y rival:false");
  assert(!!rivalShot && rivalShot.rival === true, "el tiro del rival queda con pid 'rival-team' y rival:true -- ANTES quedaba con pid 'team' igual que el nuestro (bug reportado)");

  // ── shotMap(): por defecto solo debe verse "nuestro" ──
  win.S.screen = "shotMap";
  delete win.S.shotMapSide;
  const htmlOur = win.shotMap();
  assert(htmlOur.includes("🔴 Rival (este partido)"), "el toggle 'Rival (este partido)' aparece porque este partido SÍ tiene tiros del rival");
  const totalOur = htmlOur.match(/(\d+)\/(\d+)<\/div>\s*<div[^>]*>TOTAL/);
  assert(!!totalOur && totalOur[1] === "1" && totalOur[2] === "1", "vista 'Nuestro equipo': solo cuenta el tiro nuestro (1/1), sin mezclar el del rival");

  // ── shotMap(): al cambiar a "rival" solo debe verse el del rival ──
  win.S.shotMapSide = "rival";
  win.S.shotMapPid = "all";
  const htmlRival = win.shotMap();
  assert(htmlRival.includes("🔴") && htmlRival.includes("solo este partido"), "la vista del rival se marca claramente como 'solo este partido'");
  const totalRival = htmlRival.match(/(\d+)\/(\d+)<\/div>\s*<div[^>]*>TOTAL/);
  assert(!!totalRival && totalRival[1] === "0" && totalRival[2] === "1", "vista 'Rival': solo cuenta el tiro del rival (0/1 -- el fallo de 3), sin el nuestro");

  // ── El agregado de TEMPORADA nunca debe incluir tiros del rival ──
  win.S.shotMapSide = "our";
  win.S.shotMapMode = "heatmap";
  win.S.shotMapSource = "season";
  win.S.matches = { t1: [m] };
  const htmlSeason = win.shotMap();
  const totalSeason = htmlSeason.match(/(\d+)\/(\d+)<\/div>\s*<div[^>]*>TOTAL/);
  assert(!!totalSeason && totalSeason[2] === "1", "el agregado de temporada solo suma el tiro nuestro (1 intento), nunca el del rival");

  // ── Escenario 2: rival INDIVIDUAL (plantilla propia, no modo equipo) ──
  const win2 = await loadApp();
  const m2 = buildFixture(win2, {
    teamOnlyStats: false,
    shotChart: true,
    rivalPlayers: [{ id: "r1", name: "Rival Uno", number: 10 }],
    live: { activeTeam: "our", q: 1, clockSec: 600, qScores: [[0, 0]], stats: {}, rivalStats: {} }
  });
  win2.S.teamId = "t1"; win2.S.matchId = "m1";
  win2.liveAction("r1", "p2m", 2); // tiro anotado por el jugador rival individual
  assert(!!win2.document.getElementById("m-shotchart"), "liveAction() de un jugador rival individual también abre el modal de captura");
  win2._confirmShot("r1", "p2m", 2, 0.5, 0.75);
  const rivalIndivShot = m2.live.shots.find(s => s.pid === "r1");
  assert(!!rivalIndivShot && rivalIndivShot.rival === true, "un tiro de un jugador rival individual (pid propio) también se etiqueta rival:true");

  return report.summary();
}

module.exports = { run };
if (require.main === module) {
  run().then(({ failed }) => process.exit(failed > 0 ? 1 : 0));
}
