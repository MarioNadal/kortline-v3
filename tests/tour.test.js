"use strict";
// v3.0.0-dev.94 · B-TOUR1: Mario pidió un tutorial en la aplicación para la
// primera vez que se abra ("para que este en el menu de configuracion
// explicando lo basico pero de toda la aplicacion") y, al pedir pensar cómo
// hacerlo visual: "Es un tutorial que visita la apliacion enseñando cada
// opcion... debe tener datos de prueba al principio porque un club no
// tendra [datos reales]".
// Confirmado con Mario (AskUserQuestion):
// 1) Alcance "lo básico de cada pantalla" (8 paradas) -- no botón por botón.
// 2) Los datos de muestra viven SOLO en memoria durante el tour -- nunca se
//    escriben en localStorage ni en Firestore, y al terminar se restauran
//    EXACTAMENTE los datos reales de antes (vacíos o no).
//
// Este test verifica, sin depender de Driver.js realmente pintando overlays
// (solo necesitamos que exista y que .highlight()/.destroy() no exploten):
//  1) startTour() hace el swap de S sin tocar los datos reales y sin pasar
//     por el save() real (localStorage no debe escribirse).
//  2) Cada uno de los 8 pasos resuelve su selector a un elemento real tras
//     _tourGoTo (ninguno se "rompe" en silencio).
//  3) _tourEnd() restaura EXACTAMENTE S.teams/players/sessions/matches/events
//     y la pantalla/equipo/partido/fecha de antes de arrancar el tour.
//  4) _maybeStartTour(): false si ya hay equipos o si ya se vio el tour;
//     true (y programa startTour) solo para club nuevo + nunca visto.
const { loadApp, newReporter } = require("./harness");

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
  const report = newReporter("tour");
  const assert = (cond, msg) => report.assert(cond, msg);

  // ═══ 1) startTour(): swap en memoria, SIN tocar localStorage (guard de save()) ═══
  {
    const win = await loadApp();
    // Datos reales "de antes" -- simulan un club YA en marcha (no vacío),
    // para comprobar que el tour también funciona (y restaura bien) en ese caso.
    win.S.screen = "equipos";
    win.S.teamId = "real-team-1";
    win.S.matchId = "real-match-1";
    win.S.date = "2026-01-01";
    win.S.teams = [{ id: "real-team-1", name: "Equipo Real", color: "#123456" }];
    win.S.players = { "real-team-1": [{ id: "rp1", name: "Jugadora Real", number: 9 }] };
    win.S.sessions = { "real-team-1": [{ id: "s1", date: "2026-01-01" }] };
    win.S.matches = { "real-team-1": [{ id: "real-match-1", rival: "Rival Real" }] };
    win.S.events = { "real-team-1": [] };

    // IMPORTANTE: NO se puede espiar window.localStorage.setItem directamente
    // -- jsdom implementa Storage con un Proxy que trata cualquier asignación
    // de propiedad como "guardar esa clave en el storage", así que
    // `localStorage.setItem = fn` no sobreescribe el método real, solo crea
    // una entrada literal llamada "setItem" (comprobado con el revert-sanity-
    // check de este mismo test: con el guard roto a propósito, el spy sobre
    // setItem seguía vacío). Espiamos lsSet() en su lugar -- es una función
    // global corriente (declarada con `function`), sí se puede sobreescribir.
    const lsSetCalls = [];
    const origLsSet = win.lsSet;
    win.lsSet = (...args) => { lsSetCalls.push(args[0]); return origLsSet(...args); };

    win.startTour();
    await sleep(250); // el primer _tourGoTo usa rAF + setTimeout(80ms)

    assert(win._tourActive === true, "startTour() activa la bandera _tourActive");
    assert(win.S.teams.length === 1 && win.S.teams[0].name === "Equipo Demo", "S.teams pasa a contener el equipo de demo, no el real");
    assert(win.S.teams[0].id !== "real-team-1", "el id del equipo de demo no coincide con el real (no hay colisión de datos)");
    assert(Object.keys(win.S.players)[0] !== "real-team-1", "S.players ya no indexa por el id real");
    assert(lsSetCalls.length === 0, "pintar las pantallas de demo no llama a lsSet()/localStorage por su cuenta");

    // Comprobación directa y explícita del guard de save(): si algo SÍ
    // llamara a save() mientras el tour está activo, tampoco debe escribir
    // nada ni ejecutar el resto de la función real.
    const saveResult = win.save();
    assert(saveResult === true, "save() devuelve true (éxito 'fingido') cuando se le llama mientras _tourActive está activo");
    assert(lsSetCalls.length === 0, "B-TOUR1: save() NO llama a lsSet() ni una sola vez mientras el tour está activo -- el guard al principio de save() corta la función antes de cualquier escritura real");

    // Limpieza: terminar el tour para no dejar el estado "activo" a medio camino.
    win._tourEnd();
    win.lsSet = origLsSet;
  }

  // ═══ 2) Cada uno de los 8 pasos resuelve su elemento real (ninguno roto) ═══
  {
    const win = await loadApp();
    win.S.screen = "equipos"; win.S.teamId = null; win.S.matchId = null;
    win.S.teams = []; win.S.players = {}; win.S.sessions = {}; win.S.matches = {}; win.S.events = {};

    win.startTour();
    await sleep(250);

    // Mismo bundle de demo que usó internamente startTour() (tid/mid fijos,
    // y además con la forma completa -- incluye .match -- que algunos
    // "setup" de los pasos necesitan, p.ej. el paso 5 lee demo.match.live).
    const demo = win._tourDemoBundle();
    const steps = win._tourSteps(demo);
    assert(steps.length === 8, "el tour tiene las 8 paradas acordadas (lo básico de cada pantalla, no botón por botón)");

    for (let i = 0; i < steps.length; i++) {
      win._tourGoTo(demo, i);
      await sleep(250);
      const el = steps[i].el();
      assert(!!el, "paso " + (i + 1) + " (" + steps[i].title + "): el selector resuelve a un elemento real en pantalla");
    }

    win._tourEnd();
  }

  // ═══ 3) _tourEnd() restaura EXACTAMENTE los datos reales de antes (club ya en marcha) ═══
  {
    const win = await loadApp();
    const realTeams = [{ id: "real-team-9", name: "Equipo Restaurado", color: "#abcdef" }];
    const realPlayers = { "real-team-9": [{ id: "rp9", name: "Jugadora Nueve", number: 3 }] };
    const realSessions = { "real-team-9": [{ id: "s9", date: "2026-02-02" }] };
    const realMatches = { "real-team-9": [{ id: "real-match-9", rival: "Rival Nueve" }] };
    const realEvents = { "real-team-9": [{ id: "e9", title: "Evento real" }] };
    win.S.screen = "att"; win.S.teamId = "real-team-9"; win.S.matchId = "real-match-9"; win.S.date = "2026-02-02";
    win.S.teams = realTeams; win.S.players = realPlayers; win.S.sessions = realSessions;
    win.S.matches = realMatches; win.S.events = realEvents;

    win.startTour();
    await sleep(250);
    assert(win.S.teams[0].name === "Equipo Demo", "mientras el tour está activo, S muestra los datos de demo");

    win._tourEnd();
    assert(win._tourActive === false, "_tourEnd() desactiva _tourActive");
    assert(win.S.screen === "att", "se restaura la pantalla exacta de antes del tour");
    assert(win.S.teamId === "real-team-9" && win.S.matchId === "real-match-9" && win.S.date === "2026-02-02", "se restauran teamId/matchId/date exactos de antes");
    assert(win.S.teams === realTeams, "S.teams vuelve a ser EXACTAMENTE (misma referencia) el array real de antes");
    assert(win.S.players === realPlayers && win.S.sessions === realSessions && win.S.matches === realMatches && win.S.events === realEvents, "players/sessions/matches/events también se restauran exactos");
    assert(win.localStorage.getItem("cbj:tour_seen") !== null, "_tourEnd() marca cbj:tour_seen para no repetir el tour solo en este dispositivo");
  }

  // ═══ 3b) _tourEnd() restaura bien también el caso "club nuevo" (todo vacío) ═══
  {
    const win = await loadApp();
    win.S.screen = "equipos"; win.S.teamId = null; win.S.matchId = null; win.S.date = null;
    win.S.teams = []; win.S.players = {}; win.S.sessions = {}; win.S.matches = {}; win.S.events = {};

    win.startTour();
    await sleep(250);
    win._tourEnd();

    assert(Array.isArray(win.S.teams) && win.S.teams.length === 0, "para un club nuevo, tras el tour S.teams vuelve a quedar vacío (no se cuela el equipo de demo)");
    assert(win.S.teamId === null, "teamId vuelve a null, como un club nuevo sin equipos");
  }

  // ═══ 4) _maybeStartTour(): solo para club genuinamente nuevo y nunca visto ═══
  {
    const win = await loadApp();
    win.S.teams = [{ id: "t1", name: "Ya tiene equipo" }];
    win.localStorage.removeItem("cbj:tour_seen");
    assert(win._maybeStartTour() === false, "_maybeStartTour() NO arranca si el club ya tiene algún equipo creado");
  }
  {
    const win = await loadApp();
    win.S.teams = [];
    win.localStorage.setItem("cbj:tour_seen", "true");
    assert(win._maybeStartTour() === false, "_maybeStartTour() NO arranca si este dispositivo ya vio el tour, aunque el club esté vacío");
  }
  {
    const win = await loadApp();
    win.S.teams = [];
    win.localStorage.removeItem("cbj:tour_seen");
    const result = win._maybeStartTour();
    assert(result === true, "_maybeStartTour() SÍ arranca (devuelve true) para club nuevo + nunca visto en este dispositivo");
    await sleep(250 + 250); // 400ms de setTimeout interno + margen de carga de pasos
    assert(win._tourActive === true, "y, efectivamente, el tour queda activo tras el setTimeout(startTour,400) interno");
    win._tourEnd();
  }

  return report.summary();
}

module.exports = { run };
if (require.main === module) {
  run().then(({ failed }) => process.exit(failed > 0 ? 1 : 0));
}
