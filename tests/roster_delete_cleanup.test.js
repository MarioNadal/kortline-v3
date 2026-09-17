"use strict";
// v3.0.0-dev.65 · B-DELP1: bug real encontrado en una tanda de pruebas de
// "casos raros del día a día" (borrar/editar cosas fuera del flujo feliz
// habitual). Borrar un jugador de la plantilla (delPlayer) NUNCA lo quitaba
// de la convocatoria/titulares/capitán de ningún partido (ni de la
// convocatoria de eventos) -- su id fantasma se quedaba para siempre. Como
// "máximo 12 convocados (FIBA)" y "máximo 5 titulares" comprueban el TAMAÑO
// BRUTO del array (sin filtrar por si el jugador sigue existiendo), bastaba
// con que un solo jugador borrado ya estuviera convocado o de titular en un
// partido para que ese hueco quedase bloqueado en falso, sin ninguna pista
// visual de por qué (la fila fantasma nunca se pintaba, porque el resto de
// la UI SÍ filtra por jugadores existentes -- el hueco parecía libre pero no
// dejaba añadir a nadie más). Un caso muy plausible en el día a día: un
// jugador deja el equipo a media temporada después de haber estado ya
// convocado/de titular en el próximo partido, y el entrenador lo borra de
// la plantilla.
//
// Este test fija: (1) la limpieza real de convocados/titulares/capitán/
// reducedMinutesDismissed en TODOS los partidos del equipo y de convocados
// en TODOS los eventos, (2) que el hueco liberado se puede volver a usar de
// verdad (toggleConvocado/toggleTitular ya no lo bloquean), (3) que NO se
// tocan las estadísticas históricas ya registradas (live.stats de partidos
// ya jugados), y (4) el bloqueo preventivo de borrar a alguien que está EN
// PISTA ahora mismo en un partido en directo (mismo criterio que ya existía
// para toggleConvocado, B-ADV5).
const { loadApp, buildFixture, newReporter } = require("./harness");

function confirmClick(win) {
  const el = win.document.getElementById("m-confirm");
  if (!el) return false;
  el.querySelector("button").click();
  return true;
}

async function run() {
  const report = newReporter("roster_delete_cleanup");
  const assert = (cond, msg) => report.assert(cond, msg);

  // ── Caso base: borrar a alguien sin ninguna referencia especial sigue funcionando igual ──
  {
    const win = await loadApp();
    buildFixture(win, { convocados: ["p1", "p2", "p3", "p4", "p5"] });
    win.delPlayer("p6");
    const opened = confirmClick(win);
    assert(opened, "delPlayer() de un jugador normal sigue abriendo la confirmación de siempre");
    assert(!win.S.players.t1.some(p => p.id === "p6"), "tras confirmar, el jugador desaparece de la plantilla");
    assert((win.document.querySelector(".toast")?.textContent || "").includes("Eliminado"), "se muestra el toast de siempre tras borrar");
  }

  // ── Ghost-slot en TITULARES (máximo 5): el hueco fantasma se libera de verdad ──
  {
    const win = await loadApp();
    const match = buildFixture(win, { convocados: ["p1", "p2", "p3", "p4", "p5", "p6"], titulares: ["p1", "p2", "p3", "p4", "p5"] });
    win.delPlayer("p5");
    confirmClick(win);
    assert(!match.titulares.includes("p5"), "p5 (titular) desaparece de m.titulares tras borrarlo");
    assert(match.titulares.length === 4, "m.titulares queda con 4 reales, no arrastra el hueco fantasma (longitud 4, no 5)");
    win.toggleTitular("p6");
    assert(match.titulares.includes("p6"), "toggleTitular('p6') YA NO se bloquea por 'Máximo 5 titulares' -- el hueco liberado se puede volver a usar");
    assert(match.titulares.length === 5, "tras liberar el hueco, m.titulares vuelve a tener 5 titulares reales");
  }

  // ── Ghost-slot en CONVOCADOS (máximo 12 FIBA): mismo bug con roster más grande ──
  {
    const win = await loadApp();
    win.S.teamId = "t1";
    win.S.teams = [{ id: "t1", name: "Equipo Grande", color: "#F06318" }];
    const roster = Array.from({ length: 13 }, (_, i) => ({ id: "p" + (i + 1), name: "Jugador " + (i + 1), number: i + 1 }));
    win.S.players = { t1: roster };
    const convocados = roster.slice(0, 12).map(p => p.id); // p1..p12 convocados, p13 se queda fuera
    const match = { id: "m1", rival: "Rival", quarters: 4, qMins: 10, stopOnFoul: true, convocados, rivalPlayers: [] };
    win.S.matches = { t1: [match] };
    win.S.matchId = "m1";

    assert(match.convocados.length === 12, "arrancamos con la convocatoria al completo (12, máximo FIBA)");
    win.delPlayer("p12");
    confirmClick(win);
    assert(!match.convocados.includes("p12"), "p12 desaparece de m.convocados tras borrarlo");
    assert(match.convocados.length === 11, "m.convocados queda con 11 reales, no arrastra el hueco fantasma (longitud 11, no 12)");
    win.toggleConvocado("p13");
    assert(match.convocados.includes("p13"), "toggleConvocado('p13') YA NO se bloquea por 'Máximo 12 convocados (FIBA)' -- el hueco liberado se puede volver a usar");
    assert(match.convocados.length === 12, "tras liberar el hueco, m.convocados vuelve a tener 12 convocados reales");
  }

  // ── Capitán y "reducedMinutesDismissed" también se limpian ──
  {
    const win = await loadApp();
    const match = buildFixture(win, {
      convocados: ["p1", "p2", "p3", "p4", "p5", "p6"],
      capitan: "p3",
      reducedMinutesDismissed: ["p2"]
    });
    win.delPlayer("p3");
    confirmClick(win);
    assert(match.capitan === null, "si el jugador borrado era el capitán, m.capitan queda a null (no se queda apuntando a un id que ya no existe)");

    win.delPlayer("p2");
    confirmClick(win);
    assert(!match.reducedMinutesDismissed.includes("p2"), "reducedMinutesDismissed también se limpia al borrar al jugador");
  }

  // ── Convocatoria de EVENTOS (tecnificación/otros, no partidos) también se limpia ──
  {
    const win = await loadApp();
    buildFixture(win, { convocados: ["p1", "p2", "p3", "p4", "p5"] });
    win.S.events = { t1: [{ id: "e1", tipo: "tecnificacion", titulo: "Extra", convocados: ["p1", "p6"] }] };
    win.delPlayer("p6");
    confirmClick(win);
    assert(!win.S.events.t1[0].convocados.includes("p6"), "la convocatoria de un evento también pierde al jugador borrado");
    assert(win.S.events.t1[0].convocados.includes("p1"), "el resto de la convocatoria del evento no se toca");
  }

  // ── Las estadísticas YA REGISTRADAS de partidos jugados NO se tocan ──
  {
    const win = await loadApp();
    const match = buildFixture(win, { convocados: ["p1", "p2", "p3", "p4", "p5", "p6"] });
    match.live = { stats: { p4: { p2m: 3, p2a: 5, ast: 2 } }, onCourt: [] };
    win.delPlayer("p4");
    confirmClick(win);
    assert(!!match.live.stats.p4 && match.live.stats.p4.p2m === 3, "el rendimiento ya registrado (live.stats) de un partido ya jugado NO se borra ni se toca al eliminar al jugador de la plantilla");
  }

  // ── Bloqueo preventivo: no se puede borrar a quien está EN PISTA ahora mismo ──
  {
    const win = await loadApp();
    const match = buildFixture(win, { convocados: ["p1", "p2", "p3", "p4", "p5", "p6"] });
    win.liveGame(); // arranca con 5 titulares en pista (quinteto por defecto)
    const onCourtPid = match.live.onCourt[0];
    win.delPlayer(onCourtPid);
    const opened = confirmClick(win);
    assert(!opened, "delPlayer() de alguien EN PISTA ahora mismo NO abre ni siquiera la confirmación -- se bloquea antes");
    assert(win.S.players.t1.some(p => p.id === onCourtPid), "el jugador en pista sigue en la plantilla, no se ha borrado");
    assert((win.document.querySelector(".toast")?.textContent || "").includes("en pista"), "el toast explica que está en pista ahora mismo");

    // Un jugador que SÍ está convocado pero NO está en pista ahora mismo sigue pudiéndose borrar sin problema.
    const benchPid = match.convocados.find(id => !match.live.onCourt.includes(id));
    win.delPlayer(benchPid);
    const opened2 = confirmClick(win);
    assert(opened2, "un convocado que está en el banquillo (no en pista) SÍ se puede borrar con normalidad");
    assert(!win.S.players.t1.some(p => p.id === benchPid), "el jugador del banquillo se borra correctamente");
  }

  return report.summary();
}

module.exports = { run };
if (require.main === module) {
  run().then(({ failed }) => process.exit(failed > 0 ? 1 : 0));
}
