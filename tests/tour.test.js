"use strict";
// v3.0.0-dev.94 · B-TOUR1: Mario pidió un tutorial en la aplicación para la
// primera vez que se abra ("para que este en el menu de configuracion
// explicando lo basico pero de toda la aplicacion") y, al pedir pensar cómo
// hacerlo visual: "Es un tutorial que visita la apliacion enseñando cada
// opcion... debe tener datos de prueba al principio porque un club no
// tendra [datos reales]".
//
// v3.0.0-dev.104 · B-TOURSYNC1: REESCRITO tras un incidente real de pérdida
// de datos en producción (2026-11-01). El diseño original de startTour()
// REEMPLAZABA por completo S.teams/players/sessions/matches/events por los
// del equipo de demo, guardando una foto de "antes" para restaurarla EXACTA
// al terminar (_tourEnd). El problema: los oyentes de Firestore "siempre
// activos" (jugadoras/partidos/asistencia/notas de TODOS los equipos) NUNCA
// se pausan durante el tour -- si mientras está abierto llegan datos reales
// del club (justo lo que pasa en un dispositivo nuevo, que es cuando el
// tour arranca solo), esos datos reales se escribían en S con normalidad...
// y al terminar, restaurar a ciegas la foto de "antes" (tomada ANTES de que
// llegaran) los borraba de la memoria otra vez -- mientras que
// _lastSyncedSnapshot sí se había quedado con el recuerdo de esos datos
// reales. El siguiente guardado normal disparaba una sincronización que
// comparaba una S "vaciada" contra un recuerdo con datos reales, y los
// borraba de verdad en la nube. Ver cabecera de startTour()/_tourEnd() en
// index.html para el detalle completo.
//
// Arreglo: el equipo de demo se AÑADE a S sin tocar lo que ya hubiera (real
// o todavía vacío), y _tourEnd() solo QUITA lo del equipo de demo -- nunca
// restaura una foto vieja de los datos. Así, cualquier dato real que llegue
// de la nube mientras el tour está abierto sobrevive intacto. Además,
// _runCloudSync() tiene ahora su propio cerrojo (_tourActive) como última
// línea de defensa, para que ninguna sincronización pueda salir mientras S
// tiene datos de demo cargados, sea lo que sea lo que la dispare.
//
// Este test verifica, sin depender de Driver.js realmente pintando overlays
// (solo necesitamos que exista y que .highlight()/.destroy() no exploten):
//  1) startTour() en un club nuevo: añade el equipo de demo, no toca
//     localStorage, save() sigue sin escribir mientras el tour está activo.
//  2) startTour() en un club YA en marcha: el equipo/datos reales siguen
//     presentes en S junto con los de demo (no se reemplazan).
//  3) Cada uno de los 8 pasos resuelve su selector a un elemento real.
//  4) _tourEnd() quita SOLO lo del equipo de demo y restaura la
//     pantalla/equipo/partido/fecha de antes -- deja lo real intacto.
//  5) Caso "club nuevo": tras el tour, S.teams vuelve a quedar vacío si no
//     llegó ningún dato real durante el tour (no se cuela el de demo).
//  6) EL TEST DE REGRESIÓN DEL INCIDENTE REAL: datos reales que "llegan de
//     la nube" (simulados, como haría un oyente de Firestore) MIENTRAS el
//     tour está abierto deben sobrevivir a _tourEnd() -- antes de este
//     arreglo, se perdían.
//  7) _runCloudSync() no sincroniza nada mientras _tourActive es true,
//     aunque S y _lastSyncedSnapshot difieran -- y vuelve a sincronizar con
//     normalidad en cuanto el tour termina.
//  8) _maybeStartTour(): false si ya hay equipos o si ya se vio el tour;
//     true (y programa startTour) solo para club nuevo + nunca visto.
const { loadApp, newReporter } = require("./harness");

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function makeFirebaseMock() {
  const writes = [];
  function ref(path) {
    return {
      path,
      collection(name) { return ref(path + "/" + name); },
      doc(id) { return ref(path + "/" + id); },
      onSnapshot() { return () => {}; },
      get() { return Promise.resolve({ exists: false, data: () => ({}), docs: [] }); }
    };
  }
  let authCb = null;
  const firestoreSingleton = {
    collection(name) { return ref(name); },
    enablePersistence() { return Promise.resolve(); },
    batch() {
      return {
        set(docRef, data) { writes.push({ op: "set", path: docRef.path, data }); },
        delete(docRef) { writes.push({ op: "delete", path: docRef.path }); },
        commit() { return Promise.resolve(); }
      };
    }
  };
  const authSingleton = {
    onAuthStateChanged(cb) { authCb = cb; },
    signInWithEmailAndPassword() { return Promise.resolve(); }
  };
  return {
    firebase: {
      initializeApp() {},
      firestore() { return firestoreSingleton; },
      auth() { return authSingleton; }
    },
    triggerLogin(user) { if (authCb) authCb(user); },
    writes
  };
}

async function run() {
  const report = newReporter("tour");
  const assert = (cond, msg) => report.assert(cond, msg);

  // ═══ 1) startTour() en club NUEVO: añade el demo, sin tocar localStorage ═══
  {
    const win = await loadApp();
    win.S.screen = "equipos"; win.S.teamId = null; win.S.matchId = null; win.S.date = null;
    win.S.teams = []; win.S.players = {}; win.S.sessions = {}; win.S.matches = {}; win.S.events = {};

    // IMPORTANTE: NO se puede espiar window.localStorage.setItem directamente
    // -- jsdom implementa Storage con un Proxy que trata cualquier asignación
    // de propiedad como "guardar esa clave en el storage". Espiamos lsSet()
    // en su lugar -- es una función global corriente, sí se puede sobreescribir.
    const lsSetCalls = [];
    const origLsSet = win.lsSet;
    win.lsSet = (...args) => { lsSetCalls.push(args[0]); return origLsSet(...args); };

    win.startTour();
    await sleep(250); // el primer _tourGoTo usa rAF + setTimeout(80ms)

    assert(win._tourActive === true, "startTour() activa la bandera _tourActive");
    assert(win.S.teams.length === 1 && win.S.teams[0].name === "Equipo Demo", "en un club nuevo (sin equipos de antes), S.teams pasa a tener solo el equipo de demo");
    assert(lsSetCalls.length === 0, "pintar las pantallas de demo no llama a lsSet()/localStorage por su cuenta");

    // Comprobación directa y explícita del guard de save(): si algo SÍ
    // llamara a save() mientras el tour está activo, tampoco debe escribir
    // nada ni ejecutar el resto de la función real.
    const saveResult = win.save();
    assert(saveResult === true, "save() devuelve true (éxito 'fingido') cuando se le llama mientras _tourActive está activo");
    assert(lsSetCalls.length === 0, "B-TOUR1: save() NO llama a lsSet() ni una sola vez mientras el tour está activo -- el guard al principio de save() corta la función antes de cualquier escritura real");

    win._tourEnd();
    win.lsSet = origLsSet;
    assert(Array.isArray(win.S.teams) && win.S.teams.length === 0, "tras terminar, en un club que seguía sin datos reales, S.teams vuelve a quedar vacío (no se cuela el equipo de demo)");
  }

  // ═══ 2) startTour() en club YA EN MARCHA: lo real convive con el demo, no se reemplaza ═══
  {
    const win = await loadApp();
    win.S.screen = "equipos";
    win.S.teamId = "real-team-1";
    win.S.matchId = "real-match-1";
    win.S.date = "2026-01-01";
    win.S.teams = [{ id: "real-team-1", name: "Equipo Real", color: "#123456" }];
    win.S.players = { "real-team-1": [{ id: "rp1", name: "Jugadora Real", number: 9 }] };
    win.S.sessions = { [win.sk("real-team-1", "2026-01-01")]: { rp1: "present" } };
    win.S.matches = { "real-team-1": [{ id: "real-match-1", rival: "Rival Real" }] };
    win.S.events = { "real-team-1": [] };

    win.startTour();
    await sleep(250);

    assert(win.S.teams.some(t => t.id === "real-team-1"), "el equipo REAL sigue en S.teams mientras el tour está activo -- ya no se reemplaza por completo");
    assert(win.S.teams.some(t => t.name === "Equipo Demo"), "el equipo de demo se AÑADE junto al real");
    assert(JSON.stringify(win.S.players["real-team-1"]) === JSON.stringify([{ id: "rp1", name: "Jugadora Real", number: 9 }]), "S.players del equipo real no se toca");
    assert(JSON.stringify(win.S.sessions[win.sk("real-team-1", "2026-01-01")]) === JSON.stringify({ rp1: "present" }), "S.sessions del equipo real no se toca");
    assert(JSON.stringify(win.S.matches["real-team-1"]) === JSON.stringify([{ id: "real-match-1", rival: "Rival Real" }]), "S.matches del equipo real no se toca");

    win._tourEnd();
    assert(win.S.teams.length === 1 && win.S.teams[0].id === "real-team-1", "_tourEnd() quita SOLO el equipo de demo, dejando el real");
    assert(win.S.players["tour-demo-team"] === undefined && win.S.matches["tour-demo-team"] === undefined && win.S.events["tour-demo-team"] === undefined, "las claves del equipo de demo se limpian de players/matches/events");
    assert(win.S.screen === "equipos" && win.S.teamId === "real-team-1" && win.S.matchId === "real-match-1" && win.S.date === "2026-01-01", "se restaura la pantalla/equipo/partido/fecha exactos de antes del tour");
    assert(win.localStorage.getItem("cbj:tour_seen") !== null, "_tourEnd() marca cbj:tour_seen para no repetir el tour solo en este dispositivo");
  }

  // ═══ 3) Cada uno de los 8 pasos resuelve su elemento real (ninguno roto) ═══
  {
    const win = await loadApp();
    win.S.screen = "equipos"; win.S.teamId = null; win.S.matchId = null;
    win.S.teams = []; win.S.players = {}; win.S.sessions = {}; win.S.matches = {}; win.S.events = {};

    win.startTour();
    await sleep(250);

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

  // ═══ 4) B-TOURSYNC1 -- EL ESCENARIO REAL DEL INCIDENTE ═══
  // Un dispositivo nuevo arranca el tour (todavía sin ningún equipo cargado).
  // Mientras el tour está abierto, llegan datos reales de la nube -- se
  // simula escribiendo en S exactamente como lo harían los oyentes "siempre
  // activos" de Firestore (_attachClubListeners/_attachGlobalTeamListeners),
  // que NUNCA se pausan durante el tour. Esos datos deben sobrevivir a
  // _tourEnd() -- antes de este arreglo, se perdían.
  {
    const win = await loadApp();
    win.S.screen = "equipos"; win.S.teamId = null; win.S.matchId = null; win.S.date = null;
    win.S.teams = []; win.S.players = {}; win.S.sessions = {}; win.S.matches = {}; win.S.events = {};

    win.startTour();
    await sleep(250);
    assert(win._tourActive === true, "el tour está activo");

    // Simula la llegada, a mitad de tour, de los datos reales del club
    // (igual que harían los onSnapshot de _attachClubListeners/
    // _attachGlobalTeamListeners, que no comprueban _tourActive).
    win.S.teams.push({ id: "cadete-real", name: "Cadete Masculino", color: "#F06318" });
    win.S.players["cadete-real"] = [
      { id: "jr1", name: "Jugador Real 1", number: 4 },
      { id: "jr2", name: "Jugador Real 2", number: 7 }
    ];
    win.S.matches["cadete-real"] = [{ id: "mr1", rival: "Rival Jaca" }];
    win.S.sessions[win.sk("cadete-real", "2026-10-15")] = { jr1: "present", jr2: "absent" };

    win._tourEnd();

    assert(win.S.teams.some(t => t.id === "cadete-real"), "B-TOURSYNC1: el equipo real que llegó MIENTRAS el tour estaba abierto sigue en S.teams tras terminar -- antes se borraba al restaurar la foto vieja");
    assert(!win.S.teams.some(t => t.name === "Equipo Demo"), "el equipo de demo ya no está");
    assert(JSON.stringify(win.S.players["cadete-real"]) === JSON.stringify([
      { id: "jr1", name: "Jugador Real 1", number: 4 },
      { id: "jr2", name: "Jugador Real 2", number: 7 }
    ]), "B-TOURSYNC1: las jugadoras reales que llegaron durante el tour sobreviven");
    assert(JSON.stringify(win.S.matches["cadete-real"]) === JSON.stringify([{ id: "mr1", rival: "Rival Jaca" }]), "B-TOURSYNC1: el partido real que llegó durante el tour sobrevive");
    assert(JSON.stringify(win.S.sessions[win.sk("cadete-real", "2026-10-15")]) === JSON.stringify({ jr1: "present", jr2: "absent" }), "B-TOURSYNC1: la asistencia real que llegó durante el tour sobrevive");
  }

  // ═══ 5) Cerrojo de _runCloudSync(): no sincroniza nada mientras _tourActive ═══
  {
    const mock = makeFirebaseMock();
    const win = await loadApp({ firebase: mock.firebase });
    mock.triggerLogin({ email: "club-cbjaca@kortline.app" });

    win.S.teamId = "t1";
    win.S.teams = [{ id: "t1", name: "Equipo Uno" }];
    win.S.players = { t1: [{ id: "p1", name: "Ana", number: 4 }] };

    // Primera sincronización normal (fija _lastSyncedSnapshot con estos datos).
    await win._runCloudSync();
    const writesAfterFirstSync = mock.writes.length;
    assert(writesAfterFirstSync > 0, "sanity check: sin el tour activo, _runCloudSync() sí sincroniza con normalidad");

    // Ahora, con el tour activo, los datos en memoria "se vacían" (como
    // pasaría de verdad si startTour() estuviera corriendo) -- sin el
    // cerrojo, esto es EXACTAMENTE lo que disparó el incidente real: S sin
    // los datos reales, pero _lastSyncedSnapshot sí los recuerda.
    win._tourActive = true;
    win.S.teams = [];
    win.S.players = {};
    await win._runCloudSync();
    assert(mock.writes.length === writesAfterFirstSync, "B-TOURSYNC1: _runCloudSync() no escribe NADA en la nube mientras _tourActive es true, aunque S y el último estado sincronizado difieran radicalmente -- cerrojo de última línea");

    // Al terminar el tour, la sincronización normal debe seguir funcionando.
    win._tourActive = false;
    win.S.teams = [{ id: "t1", name: "Equipo Uno" }];
    win.S.players = { t1: [{ id: "p1", name: "Ana", number: 4 }, { id: "p2", name: "Bea", number: 5 }] };
    await win._runCloudSync();
    assert(mock.writes.length > writesAfterFirstSync, "en cuanto _tourActive vuelve a false, _runCloudSync() sincroniza con normalidad otra vez");
  }

  // ═══ 6) _maybeStartTour(): solo para club genuinamente nuevo y nunca visto ═══
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
