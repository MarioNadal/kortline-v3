"use strict";
// v3.0.0-dev.69 · B-DLS4 (parte 2): drilllive_persistence.test.js ya cubre
// que S.drillLive sobrevive a un cierre/recarga vía localStorage (el bug que
// reportó Mario). Este fichero cubre la otra mitad -- que también viaja de
// verdad por Firestore, igual que el resto de colecciones del club, para
// que el historial de "Contraataque de 11"/"Final de partido" no se quede
// atrapado en un solo dispositivo y sobreviva a un cambio de móvil o a
// borrar datos locales. Reutiliza el mismo patrón de mock de Firestore que
// session_sync_all_teams.test.js (loadApp({firebase}), _cloudEnabled real),
// ampliado con un batch() mínimo para poder inspeccionar lo que _runCloudSync()
// escribiría de verdad.
const { loadApp, newReporter } = require("./harness.js");

function makeFirebaseMock() {
  const listeners = {}; // path -> [callback, ...]
  const writes = []; // {op:"set"|"delete", path, data?}
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
    fire(path, snap) { (listeners[path] || []).forEach(cb => cb(snap)); },
    triggerLogin(user) { if (authCb) authCb(user); },
    writes
  };
}

function docsSnap(docs) {
  return { docs: docs.map(d => ({ id: d.id, data: () => d })) };
}

async function run() {
  const report = newReporter("drilllive_cloud_sync");
  const mock = makeFirebaseMock();
  const win = await loadApp({ firebase: mock.firebase });
  const P = p => `clubs/${win.CLUB_ID}/${p}`;

  mock.triggerLogin({ email: "club-cbjaca@kortline.app" });
  win.S.teamId = "t1";
  win.S.teams = [{ id: "t1", name: "Equipo Uno" }];
  win.S.players = { t1: [] };
  win.S.drills = { t1: [] };
  win.S.drillLive = {};

  // ── Entrada (Firestore → S): _attachTeamListeners escucha "drillLive" y reconstruye la forma anidada ──
  win._attachTeamListeners("t1");
  const sessDocA = { id: "dls_x1", drillId: "d1", drillName: "Contraataque de 11", type: "b11", status: "finished", players: [], stats: {}, log: [] };
  const sessDocB = { id: "dlm_x2", drillId: "d2", drillName: "Final de partido", type: "endgame", status: "running", players: [], stats: {}, log: [] };
  mock.fire(P("teams/t1/drillLive"), docsSnap([sessDocA, sessDocB]));
  report.assert(!!win.S.drillLive.t1, "tras el snapshot de 'drillLive', S.drillLive.t1 se rellena");
  report.assert(win.S.drillLive.t1.d1 && win.S.drillLive.t1.d1[0].id === "dls_x1", "la sesión del ejercicio d1 llega agrupada bajo su propio drillId");
  report.assert(win.S.drillLive.t1.d2 && win.S.drillLive.t1.d2[0].id === "dlm_x2", "una sesión de un ejercicio distinto (d2, tipo endgame) se agrupa aparte, sin mezclarse con d1");

  // ── Salida (S → Firestore): _runCloudSync() sube cada sesión como documento propio en la subcolección "drillLive" del equipo ──
  const liveSession = { id: "dls_new", drillId: "d3", drillName: "Rueda de tiro", type: "b11", status: "running", startedAt: 1, checklist: { ast: true, missTrack: true, missPenalty: false }, durationSec: 600, remainingSec: 600, players: [{ id: "p1", name: "Ana", number: 4 }], stats: { p1: { p2m: 1, p2a: 0, p3m: 0, p3a: 0, reb: 0, to: 0, stl: 0, ast: 0, blk: 0 } }, log: [{ pid: "p1", action: "p2m", ts: 1 }] };
  win.S.drillLive.t1.d3 = [liveSession];
  await win._runCloudSync();
  const setWrite = mock.writes.find(w => w.op === "set" && w.path === P("teams/t1/drillLive/dls_new"));
  report.assert(!!setWrite, "_runCloudSync() escribe la sesión en vivo como documento propio en clubs/.../teams/t1/drillLive/<id de la sesión>");
  report.assert(!!(setWrite && setWrite.data && setWrite.data.stats && setWrite.data.stats.p1 && setWrite.data.stats.p1.p2m === 1), "el documento subido lleva las estadísticas reales de la sesión (no un objeto vacío)");
  report.assert(!(setWrite && "id" in setWrite.data), "igual que el resto de colecciones (drills/matches/events), el campo 'id' no se duplica dentro del documento -- ya es el id del propio documento");

  // ── El cronómetro corriendo (solo cambia remainingSec) NO debe disparar una nueva sincronización -- _dlsCmpView en acción dentro del diff real ──
  const writesBefore = mock.writes.length;
  win.S.drillLive.t1.d3[0].remainingSec = 599; // como haría startDlsTimer() cada segundo
  await win._runCloudSync();
  report.assert(mock.writes.length === writesBefore, "un tick del cronómetro (solo remainingSec cambia) no genera ninguna escritura nueva en Firestore -- evita sincronizar una vez por segundo con cualquier ejercicio/mini-partido en marcha");

  // ── Un cambio real (nueva estadística) sí debe sincronizar ──
  win.S.drillLive.t1.d3[0].stats.p1.p2m = 2;
  win.S.drillLive.t1.d3[0].log.push({ pid: "p1", action: "p2m", ts: 2 });
  await win._runCloudSync();
  const secondWrite = mock.writes.filter(w => w.op === "set" && w.path === P("teams/t1/drillLive/dls_new"));
  report.assert(secondWrite.length >= 2 && secondWrite[secondWrite.length - 1].data.stats.p1.p2m === 2, "un cambio real de estadísticas (no solo el segundero) sí dispara una nueva escritura con los datos actualizados");

  return report.summary();
}

module.exports = { run };
if (require.main === module) {
  run().then(({ failed }) => process.exit(failed ? 1 : 0));
}
