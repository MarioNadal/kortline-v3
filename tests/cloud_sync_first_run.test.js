"use strict";
// v3.0.0-dev.75 · B-SYNC4: bug real bastante serio, encontrado mientras se
// escribían los tests del reintento automático (B-SYNC3, ver
// cloud_sync_retry.test.js). _diffSessions(batch, curSess, prevSess, colName)
// se defendía de curSess/prevSess venir undefined SOLO al construir el
// conjunto de claves a comparar (`Object.keys(curSess||{})`), pero luego los
// leía directamente sin ese `||{}` (`curSess[key]`, `prevSess[key]`).
// `_lastSyncedSnapshot` (de donde sale `prevSess`) arranca en `null` en
// CADA carga de la app -- es una variable en memoria, nunca se guarda en
// localStorage -- y solo se rellena cuando: (a) llega un cambio remoto que
// de verdad difiere de la caché local, o (b) esta misma sincronización de
// salida ya ha triunfado una vez. Si lo PRIMERO que hace un entrenador al
// abrir la app es pasar lista de un equipo cuya asistencia de otros días ya
// existe (el caso normal -- casi siempre hay historial), y su caché local
// todavía coincide con Firestore (nada remoto ha cambiado desde la última
// vez que abrió la app), _lastSyncedSnapshot sigue siendo null en ese
// momento: `prevSess` es `undefined`, y `prevSess[key]` lanzaba un
// TypeError. Como está dentro del try/catch de _runCloudSync(), el fallo
// era silencioso (solo un aviso por consola) -- la asistencia se quedaba a
// salvo en este dispositivo (localStorage) pero NUNCA llegaba a Firestore
// en ese intento, así que otros dispositivos no la veían. Muy probablemente
// la causa principal de "a veces cuesta o no llega a otro móvil" que
// reportó Mario, dado que pasar lista es casi siempre lo primero que se
// hace nada más abrir la app.
const { loadApp, newReporter } = require("./harness.js");

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
  const report = newReporter("cloud_sync_first_run");
  const mock = makeFirebaseMock();
  const win = await loadApp({ firebase: mock.firebase });
  const P = p => `clubs/${win.CLUB_ID}/${p}`;

  mock.triggerLogin({ email: "club-cbjaca@kortline.app" });
  win.S.teamId = "t1";
  win.S.teams = [{ id: "t1", name: "Equipo Uno" }];
  win.S.players = { t1: [{ id: "p1", name: "Ana", number: 4 }] };
  // Asistencia YA EXISTENTE de un día anterior -- simula el historial normal
  // de un equipo que lleva toda la temporada usando la app.
  win.S.sessions = { [win.sk("t1", "2026-09-01")]: { p1: "present" } };
  win.S.trainingNotes = { [win.sk("t1", "2026-09-01")]: { text: "Buen ritmo" } };

  // Nota: _lastSyncedSnapshot es una variable `let` interna del script, no
  // una propiedad de `window` -- no se puede leer desde fuera (win.
  // _lastSyncedSnapshot sale `undefined` aunque su valor real sea `null`).
  // Por eso este test comprueba el comportamiento observable (no revienta,
  // y el envío llega a Firestore) en vez de inspeccionar esa variable
  // directamente.

  // El entrenador pasa lista de HOY -- lo primero que hace nada más abrir
  // la app, con la asistencia de "2026-09-01" ya en S.sessions de antes.
  win.S.sessions[win.sk("t1", "2026-09-24")] = { p1: "absent" };

  let threw = false, errMsg = "";
  try { await win._runCloudSync(); } catch (e) { threw = true; errMsg = e && e.message; }
  report.assert(!threw, "B-SYNC4: la primera sincronización de la sesión (_lastSyncedSnapshot todavía null) NO debe lanzar excepción aunque ya exista asistencia previa que diferenciar -- " + errMsg);

  const writeHoy = mock.writes.find(w => w.op === "set" && w.path === P("teams/t1/sessions/2026-09-24"));
  const writeAntes = mock.writes.find(w => w.op === "set" && w.path === P("teams/t1/sessions/2026-09-01"));
  const writeNota = mock.writes.find(w => w.op === "set" && w.path === P("teams/t1/trainingNotes/2026-09-01"));
  report.assert(!!writeHoy, "B-SYNC4: la asistencia de HOY llega a Firestore en el primer intento -- antes se perdía por el TypeError silencioso");
  report.assert(!!(writeHoy && writeHoy.data && writeHoy.data.p1 === "absent"), "el contenido de la asistencia de hoy es el correcto");
  report.assert(!!writeAntes, "la asistencia de un día anterior (ya existente antes de esta sesión de la app) también se sube correctamente en ese mismo primer intento");
  report.assert(!!writeNota, "lo mismo para las notas de entrenamiento (mismo mecanismo, _diffSessions reutilizada) -- también existían de antes y también se suben bien");

  // Una segunda sincronización inmediatamente después (ya con
  // _lastSyncedSnapshot fijado) no debe re-enviar nada -- confirma que el
  // fix no rompe la comparación normal de diffs una vez hay un `prev` real.
  const writesBefore = mock.writes.length;
  await win._runCloudSync();
  report.assert(mock.writes.length === writesBefore, "una segunda sincronización sin cambios nuevos no reenvía nada -- el fix solo evitaba el crash, no desactiva el diff normal");

  return report.summary();
}

module.exports = { run };
if (require.main === module) {
  run().then(({ failed }) => process.exit(failed ? 1 : 0));
}
