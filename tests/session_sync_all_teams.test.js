"use strict";
// v3.0.0-dev.54 · B-SYNCATT1: antes, la asistencia ("sessions" de
// Firestore) solo se escuchaba en tiempo real para el equipo que se
// tuviera abierto en pantalla en ESE dispositivo en ese momento (el
// listener se reconectaba cada vez que cambiaba S.teamId, ver render()).
// Si un entrenador pasaba asistencia -- de hoy o de otro día -- de un
// equipo que otro dispositivo no tenía abierto, ese cambio no llegaba a
// ese otro dispositivo hasta que alguien entraba en ese equipo concreto
// (síntoma reportado: "hasta que no entro en el equipo no lo recarga").
// Ahora la asistencia (y las notas de entrenamiento, mismo mecanismo) se
// escuchan para TODOS los equipos del club a la vez, esté ese equipo
// abierto en pantalla o no.
//
// v3.0.0-dev.75 · B-SYNC2: el mismo patrón exacto de bug, reportado por
// Mario para "jugadoras": cambiar el cumpleaños (o cualquier dato) de un
// jugador sin entrar a SU equipo no se reflejaba en la pantalla "Hoy" (el
// aviso de cumpleaños de hoy mira S.players[] de TODOS los equipos). Lo
// mismo pasaba con "partidos" (todayMatches en Hoy también mira TODOS los
// equipos). "players" y "matches" se movieron al mismo mecanismo "siempre
// activo para todos los equipos" que ya tenían sessions/trainingNotes desde
// B-SYNCATT1 -- por eso este mismo archivo de test se amplía en vez de
// crear uno nuevo, es exactamente el mismo bug y el mismo arreglo.
//
// Este test necesita ejercitar el camino real de _attachClubListeners /
// _attachGlobalTeamListeners / _syncGlobalTeamListeners, que solo se activan
// cuando `firebase` existe como global (typeof firebase!=="undefined").
// El resto de la suite carga index.html sin firebase (modo local), así
// que aquí inyectamos un mock mínimo de Firestore vía loadApp({firebase}),
// sin tocar el comportamiento de ningún otro test.
const { loadApp, newReporter } = require("./harness.js");

function makeFirebaseMock() {
  const listeners = {}; // path (string) -> [callback, ...]
  function ref(path) {
    return {
      path,
      collection(name) { return ref(path + "/" + name); },
      doc(id) { return ref(path + "/" + id); },
      onSnapshot(cb) {
        (listeners[path] = listeners[path] || []).push(cb);
        return () => {
          const arr = listeners[path] || [];
          const i = arr.indexOf(cb);
          if (i >= 0) arr.splice(i, 1);
        };
      },
      // Nadie en el código bajo prueba llama a .get() en estas colecciones,
      // pero se ofrece por si algún camino no cubierto lo necesitara.
      get() { return Promise.resolve({ exists: false, data: () => ({}), docs: [] }); }
    };
  }
  let authCb = null;
  const firestoreSingleton = {
    collection(name) { return ref(name); },
    enablePersistence() { return Promise.resolve(); }
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
    fire(path, snap) { (listeners[path] || []).forEach(cb => cb(snap)); },
    listenerCount(path) { return (listeners[path] || []).length; },
    triggerLogin(user) { if (authCb) authCb(user); }
  };
}

function docsSnap(docs) {
  return { docs: docs.map(d => ({ id: d.id, data: () => d })) };
}
function changesSnap(changes) {
  return { docChanges: () => changes.map(c => ({ type: c.type, doc: { id: c.id, data: () => c.data } })) };
}

async function run() {
  const report = newReporter("session_sync_all_teams");
  const mock = makeFirebaseMock();
  const win = await loadApp({ firebase: mock.firebase });
  // v3.0.0-dev.63 · B-CI1: rutas construidas con el CLUB_ID real del
  // index.html cargado ("cbjaca" en producción/raíz, "cbjaca-test" en
  // test/index.html) en vez de la cadena "cbjaca" a fuego -- así este test
  // vale igual se cargue el index.html que se cargue.
  const P = p => `clubs/${win.CLUB_ID}/${p}`;

  // Simula que Firebase Auth ya resuelve la sesión de la cuenta compartida
  // del club (equivalente a haber entrado con el código correcto). El email
  // de auth SÍ es el mismo en todos los entornos (cuenta compartida real),
  // a diferencia del CLUB_ID -- por eso este no se toca.
  mock.triggerLogin({ email: "club-cbjaca@kortline.app" });

  report.assert(win._cloudEnabled === true, "con el mock de firebase inyectado, _cloudEnabled queda a true (antes false en el resto de la suite)");

  // Este dispositivo está viendo el equipo "t1"...
  win.S.teamId = "t1";

  // ...pero el club tiene dos equipos. El listener de la lista de equipos
  // entrega ambos (como haría Firestore al conectar).
  mock.fire(P("teams"), docsSnap([
    { id: "t1", name: "Equipo Uno", order: 0 },
    { id: "t2", name: "Equipo Dos", order: 1 }
  ]));

  report.assert(
    JSON.stringify(win.S.teams.map(t => t.id).sort()) === JSON.stringify(["t1", "t2"]),
    "S.teams recoge los dos equipos del club tras el snapshot de \"teams\""
  );
  report.assert(
    mock.listenerCount(P("teams/t1/sessions")) === 1,
    "hay un listener de asistencia conectado para t1 (el equipo que se está viendo)"
  );
  report.assert(
    mock.listenerCount(P("teams/t2/sessions")) === 1,
    "también hay un listener de asistencia conectado para t2, AUNQUE no sea el equipo que se está viendo -- el bug reportado"
  );
  report.assert(
    mock.listenerCount(P("teams/t2/players")) === 1,
    "v3.0.0-dev.75 · B-SYNC2: ahora también hay un listener de jugadoras conectado para t2 aunque no sea el equipo que se está viendo (antes era 0 -- el bug del cumpleaños)"
  );
  report.assert(
    mock.listenerCount(P("teams/t2/matches")) === 1,
    "v3.0.0-dev.75 · B-SYNC2: y también uno de partidos, por el mismo motivo (todayMatches en Hoy mira todos los equipos)"
  );
  report.assert(
    mock.listenerCount(P("teams/t2/events")) === 0,
    "eventos SÍ se sigue escuchando solo bajo demanda -- nada fuera de la propia pantalla del equipo los lee"
  );
  report.assert(
    mock.listenerCount(P("teams/t2/drills")) === 0,
    "y lo mismo para el catálogo de ejercicios -- sigue siendo por equipo, bajo demanda"
  );

  // Un entrenador en OTRO dispositivo pasa asistencia de "t2" (el equipo
  // que ESTE dispositivo no tiene abierto), de un día que no es hoy.
  const otroDia = "2026-01-15";
  mock.fire(P("teams/t2/sessions"), changesSnap([
    { type: "added", id: otroDia, data: { p1: "present", p2: "absent" } }
  ]));

  const key = win.sk("t2", otroDia);
  report.assert(!!win.S.sessions[key], "la asistencia de t2 llega a S.sessions sin que este dispositivo entre en ese equipo");
  report.assert(win.S.sessions[key].p1 === "present" && win.S.sessions[key].p2 === "absent", "el contenido de la asistencia recibida es el correcto");
  report.assert(win.S.teamId === "t1", "S.teamId (el equipo que se está viendo) no cambia solo por recibir datos de otro equipo");

  // El mismo mecanismo cubre las notas de entrenamiento (misma clave, misma colección hermana).
  mock.fire(P("teams/t2/trainingNotes"), changesSnap([
    { type: "added", id: otroDia, data: { text: "Buen ritmo hoy" } }
  ]));
  report.assert(!!(win.S.trainingNotes && win.S.trainingNotes[key]), "las notas de entrenamiento de un equipo no visible también llegan en tiempo real");

  // ── Comprobación pedida explícitamente por el usuario: si estoy PARADO en
  // la pantalla "Hoy" (sin tocar nada) y otro entrenador pasa la lista de un
  // equipo que no es el mío, ¿se actualiza solo, o hace falta entrar a
  // "pasar lista" para verlo? Debe actualizarse solo. ──
  win.S.players.t2 = [{ id: "px", name: "Jugadora Test", number: 9 }];
  const hoyIdx = win.todayIdx();
  const hoyFecha = win.td();
  // t2 entrena hoy a las 18:00 -- y "Equipo Uno" (t1, el que SÍ estoy
  // viendo) también, para que quede claro que no estoy tocando ese equipo.
  mock.fire(P("teams"), docsSnap([
    { id: "t1", name: "Equipo Uno", order: 0, schedule: { [hoyIdx]: "17:00" } },
    { id: "t2", name: "Equipo Dos", order: 1, schedule: { [hoyIdx]: "18:00" } }
  ]));
  win.S.screen = "hoy";
  win.render(); // como si el entrenador ya estuviera parado mirando la pantalla Hoy

  const hoyHtmlAntes = win.document.getElementById("root").innerHTML;
  report.assert(hoyHtmlAntes.includes("Equipo Dos"), "la pantalla Hoy, ya renderizada, muestra la tarjeta de entrenamiento de Equipo Dos (t2)");
  report.assert(/Equipo Dos[\s\S]*?Pendiente/.test(hoyHtmlAntes), "antes de que nadie pase lista, la tarjeta de Equipo Dos sale como \"Pendiente\"");
  report.assert(!/Equipo Dos[\s\S]*?Pasada/.test(hoyHtmlAntes), "todavía no sale \"✓ Pasada\" para Equipo Dos");

  // Ahora "otro entrenador" pasa la lista de t2 HOY (no de este dispositivo:
  // llega solo por el listener, sin que este dispositivo llame a save() ni
  // navegue a ningún sitio).
  mock.fire(P("teams/t2/sessions"), changesSnap([
    { type: "added", id: hoyFecha, data: { px: "present" } }
  ]));

  const hoyHtmlDespues = win.document.getElementById("root").innerHTML;
  report.assert(win.S.screen === "hoy", "seguimos en la pantalla Hoy (no ha hecho falta navegar a ningún sitio)");
  report.assert(/Equipo Dos[\s\S]*?Pasada/.test(hoyHtmlDespues), "en cuanto llega la asistencia de t2, la tarjeta de Equipo Dos cambia sola a \"✓ Pasada\" -- sin tocar nada ni entrar en ese equipo");
  report.assert(hoyHtmlDespues !== hoyHtmlAntes, "el HTML de la pantalla Hoy realmente cambia solo (no hace falta pulsar \"pasar lista\" para refrescarlo)");

  // ── v3.0.0-dev.75 · B-SYNC2: el mismo escenario "parado en Hoy sin tocar
  // nada", pero para el cumpleaños de un jugador de t2 (equipo NO abierto en
  // este dispositivo) editado desde OTRO dispositivo. Antes de este fix,
  // S.players.t2 solo se actualizaba al entrar en t2 -- el aviso de
  // cumpleaños de "Hoy" (que mira TODOS los equipos) se quedaba con el dato
  // viejo hasta entonces. ──
  mock.fire(P("teams/t2/players"), docsSnap([
    { id: "px", name: "Jugadora Test", number: 9, birthDate: "2000-01-01" }
  ]));
  const hoyHtmlSinCumple = win.document.getElementById("root").innerHTML;
  report.assert(!hoyHtmlSinCumple.includes("¡Hoy cumple"), "todavía no es su cumpleaños (fecha de prueba lejana) -- no debería salir ningún aviso");

  const hoyMMDD = win.td().slice(5); // "MM-DD" de hoy, para que el test valga cualquier día del año
  mock.fire(P("teams/t2/players"), docsSnap([
    { id: "px", name: "Jugadora Test", number: 9, birthDate: "2000-" + hoyMMDD }
  ]));
  const hoyHtmlConCumple = win.document.getElementById("root").innerHTML;
  report.assert(hoyHtmlConCumple.includes("Jugadora Test"), "B-SYNC2: en cuanto llega por el listener el cumpleaños de una jugadora de t2 (equipo NO abierto), aparece en el aviso de \"Hoy\" -- sin entrar en t2 ni tocar nada");
  report.assert(/¡Hoy cumple|Hoy es su cumpleaños/.test(hoyHtmlConCumple), "el aviso de cumpleaños de \"Hoy\" se muestra");

  // ── Lo mismo para un partido: un partido de t2 programado para HOY debe
  // aparecer en la sección de "PARTIDOS" de Hoy sin entrar en t2. ──
  mock.fire(P("teams/t2/matches"), docsSnap([
    { id: "m1", rival: "Rival Test", date: hoyFecha, quarters: 4, qMins: 10, convocados: [] }
  ]));
  const hoyHtmlConPartido = win.document.getElementById("root").innerHTML;
  report.assert(hoyHtmlConPartido.includes("🏀 PARTIDOS"), "B-SYNC2: la sección de partidos de hoy aparece en cuanto llega un partido de t2 (equipo NO abierto) por el listener");
  report.assert(/Rival Test/.test(hoyHtmlConPartido), "el rival del partido de t2 se muestra en la tarjeta, sin haber entrado nunca en t2");

  // Si t2 se da de baja del club, su listener de asistencia se debe cortar
  // (no debe quedar escuchando para siempre a un equipo borrado).
  mock.fire(P("teams"), docsSnap([
    { id: "t1", name: "Equipo Uno", order: 0 }
  ]));
  report.assert(mock.listenerCount(P("teams/t2/sessions")) === 0, "al borrarse t2 del club, se desconecta su listener de asistencia");
  report.assert(mock.listenerCount(P("teams/t2/players")) === 0, "y también su listener de jugadoras (B-SYNC2, mismo bucket de listeners \"siempre activos\")");
  report.assert(mock.listenerCount(P("teams/t2/matches")) === 0, "y también su listener de partidos (B-SYNC2)");
  report.assert(mock.listenerCount(P("teams/t1/sessions")) === 1, "el listener de t1 sigue activo sin duplicarse");

  // Entrar en t2 (aunque ya no exista, por si el flujo de navegación se
  // dispara) no debe volver a crear un segundo listener de asistencia para
  // t1 -- el que ya había seguía siendo válido.
  win.render();
  report.assert(mock.listenerCount(P("teams/t1/sessions")) === 1, "navegar/renderizar no duplica el listener de asistencia de un equipo que ya lo tenía");

  return report.summary();
}

module.exports = { run };
