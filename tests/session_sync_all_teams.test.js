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
// Este test necesita ejercitar el camino real de _attachClubListeners /
// _attachSessionListeners / _syncSessionListeners, que solo se activan
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

  // Simula que Firebase Auth ya resuelve la sesión de la cuenta compartida
  // del club (equivalente a haber entrado con el código correcto).
  mock.triggerLogin({ email: "club-cbjaca@kortline.app" });

  report.assert(win._cloudEnabled === true, "con el mock de firebase inyectado, _cloudEnabled queda a true (antes false en el resto de la suite)");

  // Este dispositivo está viendo el equipo "t1"...
  win.S.teamId = "t1";

  // ...pero el club tiene dos equipos. El listener de la lista de equipos
  // entrega ambos (como haría Firestore al conectar).
  mock.fire("clubs/cbjaca/teams", docsSnap([
    { id: "t1", name: "Equipo Uno", order: 0 },
    { id: "t2", name: "Equipo Dos", order: 1 }
  ]));

  report.assert(
    JSON.stringify(win.S.teams.map(t => t.id).sort()) === JSON.stringify(["t1", "t2"]),
    "S.teams recoge los dos equipos del club tras el snapshot de \"teams\""
  );
  report.assert(
    mock.listenerCount("clubs/cbjaca/teams/t1/sessions") === 1,
    "hay un listener de asistencia conectado para t1 (el equipo que se está viendo)"
  );
  report.assert(
    mock.listenerCount("clubs/cbjaca/teams/t2/sessions") === 1,
    "también hay un listener de asistencia conectado para t2, AUNQUE no sea el equipo que se está viendo -- el bug reportado"
  );
  report.assert(
    mock.listenerCount("clubs/cbjaca/teams/t2/players") === 0,
    "el resto de colecciones de t2 (jugadoras, partidos...) NO se escuchan hasta entrar en ese equipo -- eso no cambia con este fix"
  );

  // Un entrenador en OTRO dispositivo pasa asistencia de "t2" (el equipo
  // que ESTE dispositivo no tiene abierto), de un día que no es hoy.
  const otroDia = "2026-01-15";
  mock.fire("clubs/cbjaca/teams/t2/sessions", changesSnap([
    { type: "added", id: otroDia, data: { p1: "present", p2: "absent" } }
  ]));

  const key = win.sk("t2", otroDia);
  report.assert(!!win.S.sessions[key], "la asistencia de t2 llega a S.sessions sin que este dispositivo entre en ese equipo");
  report.assert(win.S.sessions[key].p1 === "present" && win.S.sessions[key].p2 === "absent", "el contenido de la asistencia recibida es el correcto");
  report.assert(win.S.teamId === "t1", "S.teamId (el equipo que se está viendo) no cambia solo por recibir datos de otro equipo");

  // El mismo mecanismo cubre las notas de entrenamiento (misma clave, misma colección hermana).
  mock.fire("clubs/cbjaca/teams/t2/trainingNotes", changesSnap([
    { type: "added", id: otroDia, data: { text: "Buen ritmo hoy" } }
  ]));
  report.assert(!!(win.S.trainingNotes && win.S.trainingNotes[key]), "las notas de entrenamiento de un equipo no visible también llegan en tiempo real");

  // Si t2 se da de baja del club, su listener de asistencia se debe cortar
  // (no debe quedar escuchando para siempre a un equipo borrado).
  mock.fire("clubs/cbjaca/teams", docsSnap([
    { id: "t1", name: "Equipo Uno", order: 0 }
  ]));
  report.assert(mock.listenerCount("clubs/cbjaca/teams/t2/sessions") === 0, "al borrarse t2 del club, se desconecta su listener de asistencia");
  report.assert(mock.listenerCount("clubs/cbjaca/teams/t1/sessions") === 1, "el listener de t1 sigue activo sin duplicarse");

  // Entrar en t2 (aunque ya no exista, por si el flujo de navegación se
  // dispara) no debe volver a crear un segundo listener de asistencia para
  // t1 -- el que ya había seguía siendo válido.
  win.render();
  report.assert(mock.listenerCount("clubs/cbjaca/teams/t1/sessions") === 1, "navegar/renderizar no duplica el listener de asistencia de un equipo que ya lo tenía");

  return report.summary();
}

module.exports = { run };
