"use strict";
// v3.0.0-dev.108 · B-SYNCSAFE1 + B-LSNS1: blindaje del motor de
// sincronización tras el incidente real de pérdida de datos del 1-nov-2026.
// Cada escenario reproduce una forma concreta en la que la versión anterior
// podía borrar o pisar datos reales en Firestore.
const { loadApp, newReporter } = require("./harness.js");

function makeFirebaseMock() {
  const listeners = {};
  const writes = [];
  const commits = [];
  let failNext = 0;
  function ref(path) {
    return {
      path,
      collection(name) { return ref(path + "/" + name); },
      doc(id) { return ref(path + "/" + id); },
      onSnapshot(a, b) { const cb = typeof a === "function" ? a : b; (listeners[path] = listeners[path] || []).push(cb); return () => {}; },
      get() { return Promise.resolve({ exists: false, data: () => ({}), docs: [] }); }
    };
  }
  let authCb = null;
  const fs = {
    collection(name) { return ref(name); },
    enablePersistence() { return Promise.resolve(); },
    batch() {
      const pending = [];
      return {
        set(r, data, opts) { pending.push({ op: "set", path: r.path, data, opts }); },
        delete(r) { pending.push({ op: "delete", path: r.path }); },
        commit() {
          if (pending.length > 500) return Promise.reject(new Error("maximum 500 writes allowed per request"));
          if (failNext > 0) { failNext--; return Promise.reject(new Error("net")); }
          commits.push(pending.length); writes.push(...pending); return Promise.resolve();
        }
      };
    }
  };
  return {
    firebase: { initializeApp() {}, firestore() { return fs; }, auth() { return { onAuthStateChanged(cb) { authCb = cb; }, signInWithEmailAndPassword() { return Promise.resolve(); } }; } },
    fire(path, snap) { (listeners[path] || []).forEach(cb => cb(snap)); },
    login() { authCb && authCb({ email: "club-cbjaca@kortline.app" }); },
    writes, commits, failNextCommit(n) { failNext = (n == null ? 1 : n); }
  };
}
const docsSnap = docs => ({ exists: true, docs: docs.map(d => ({ id: d.id, data: () => d })), data: () => ({}) });
const changesSnap = ch => ({ docs: ch.filter(c => c.type !== "removed").map(c => ({ id: c.id, data: () => c.data })), docChanges: () => ch.map(c => ({ type: c.type, doc: { id: c.id, data: () => c.data } })) });

async function setup() {
  const mock = makeFirebaseMock();
  const win = await loadApp({ firebase: mock.firebase });
  win.localStorage.clear();
  mock.login();
  return { mock, win, P: p => `clubs/${win.CLUB_ID}/${p}` };
}
const players = n => Array.from({ length: n }, (_, i) => ({ id: "p" + i, name: "Jugadora " + i, number: i }));

async function run() {
  const r = newReporter("sync_safety");

  // 1) Móvil nuevo: la memoria tiene la configuración POR DEFECTO (sin
  //    entrenadores/roles) y aún no ha llegado el snapshot del club. Antes,
  //    el primer save() subía esa config vacía encima de la real.
  {
    const { mock, win, P } = await setup();
    win.S.cfg.coaches = [];
    win.S.teams = [{ id: "t1", name: "Stale" }];
    await win._runCloudSync();
    r.assert(mock.writes.length === 0, "1) móvil nuevo: sin snapshots de la nube todavía, NO se sube nada a ciegas (ni club por defecto, ni equipos de caché vieja)");
    mock.fire(`clubs/${win.CLUB_ID}`, { exists: true, data: () => ({ clubName: "CB Jaca", cfg: { coaches: [{ id: "c1", name: "Mario", role: "superadmin" }] } }) });
    r.assert(win.S.cfg.coaches.length === 1 && win.S.clubName === "CB Jaca", "1) al llegar el snapshot del club, la config real sustituye a la de por defecto");
    await win._runCloudSync();
    r.assert(!mock.writes.some(w => w.path === `clubs/${win.CLUB_ID}`), "1) y no se reenvía (no ha cambiado nada respecto a la nube)");
    win.S.clubLema = "Nuevo lema"; await win._runCloudSync();
    r.assert(mock.writes.some(w => w.op === "set" && w.data && w.data.clubLema === "Nuevo lema"), "1) un cambio real de ajustes del club SÍ se sube una vez conocido el estado de la nube");
  }

  // 2) Un cambio remoto NO debe marcar como 'subido' un cambio local pendiente.
  {
    const { mock, win, P } = await setup();
    mock.fire(P("teams"), docsSnap([{ id: "t1", name: "Uno", order: 0 }]));
    mock.fire(P("teams/t1/players"), docsSnap([{ id: "p1", name: "Ana" }]));
    mock.fire(P("teams/t1/sessions"), changesSnap([]));
    mock.fire(P("teams/t1/matches"), docsSnap([]));
    mock.failNextCommit(5); // sin cobertura: los envíos fallan
    win.S.sessions[win.sk("t1", "2026-11-05")] = { p1: "present" };
    await win._runCloudSync();
    // Llega un cambio de OTRO entrenador sobre las jugadoras
    mock.fire(P("teams/t1/players"), docsSnap([{ id: "p1", name: "Ana María" }]));
    mock.failNextCommit(0);
    await win._runCloudSync();
    r.assert(mock.writes.some(w => w.path === P("teams/t1/sessions/2026-11-05")), "2) la asistencia pasada sin cobertura se sube igualmente aunque mientras tanto llegara un cambio remoto (antes se marcaba como 'ya subida' y se perdía)");
    r.assert(!mock.writes.some(w => w.path === P("teams/t1/players/p1")), "2) el cambio que vino de la nube no se re-sube como eco");
  }

  // 3) Freno de borrados masivos: memoria vaciada por un bug.
  {
    const { mock, win, P } = await setup();
    mock.fire(P("teams"), docsSnap([{ id: "t1", name: "Uno", order: 0 }]));
    mock.fire(P("teams/t1/players"), docsSnap(players(15)));
    r.assert(win.S.players.t1.length === 15, "3) llegan 15 jugadoras de la nube");
    win.S.players = {}; // bug: memoria vaciada (mismo patrón que el incidente del tutorial)
    await win._runCloudSync();
    r.assert(!mock.writes.some(w => w.op === "delete"), "3) B-SYNCSAFE1: un envío que quiere borrar 15 documentos de golpe se BLOQUEA -- no se borra nada en la nube");
    r.assert(win._syncDebugState().blocked && win._syncDebugState().blocked.deletes === 15, "3) queda registrado por qué se bloqueó");
  }

  // 4) Borrado legítimo de un equipo (autorizado) + papelera.
  {
    const { mock, win, P } = await setup();
    mock.fire(P("teams"), docsSnap([{ id: "t1", name: "Uno", order: 0 }]));
    mock.fire(P("teams/t1/players"), docsSnap(players(12)));
    win._allowBulkDelete();
    win.S.teams = []; delete win.S.players.t1;
    await win._runCloudSync();
    const dels = mock.writes.filter(w => w.op === "delete");
    const trash = mock.writes.filter(w => w.op === "set" && w.path.startsWith(P("trash/")));
    r.assert(dels.length === 13, "4) borrar un equipo autorizado sí borra equipo + 12 jugadoras");
    r.assert(trash.length === 13, "4) cada documento borrado tiene antes su copia en la papelera");
    const t5 = trash.find(t => t.data.path === P("teams/t1/players/p5"));
    r.assert(!!t5 && t5.data.data.name === "Jugadora 5" && !!t5.data.deletedAt, "4) la copia de la papelera guarda la ruta, los datos completos y la fecha");
  }

  // 5) Un borrado normal (1 sesión) va a la papelera y no se bloquea.
  {
    const { mock, win, P } = await setup();
    mock.fire(P("teams"), docsSnap([{ id: "t1", name: "Uno", order: 0 }]));
    mock.fire(P("teams/t1/sessions"), changesSnap([{ type: "added", id: "2026-10-01", data: { p1: "absent" } }]));
    delete win.S.sessions[win.sk("t1", "2026-10-01")];
    await win._runCloudSync();
    r.assert(mock.writes.some(w => w.op === "delete" && w.path === P("teams/t1/sessions/2026-10-01")), "5) borrar una sesión sigue funcionando");
    r.assert(mock.writes.some(w => w.path.startsWith(P("trash/")) && w.data.data.p1 === "absent"), "5) y queda copia recuperable en la papelera");
  }

  // 6) Más de 500 operaciones: antes el commit fallaba SIEMPRE.
  {
    const { mock, win, P } = await setup();
    mock.fire(P("teams"), docsSnap([{ id: "t1", name: "Uno", order: 0 }]));
    mock.fire(P("teams/t1/sessions"), changesSnap([]));
    for (let i = 0; i < 950; i++) win.S.sessions[win.sk("t1", "2025-" + String(i).padStart(4, "0"))] = { p1: "present" };
    await win._runCloudSync();
    const sessWrites = mock.writes.filter(w => w.path.startsWith(P("teams/t1/sessions/")));
    r.assert(sessWrites.length === 950, "6) 950 documentos se suben todos (antes: error 'maximum 500 writes' en bucle infinito)");
    r.assert(mock.commits.every(n => n <= 400) && mock.commits.length >= 3, "6) repartidos en lotes de como mucho 400 operaciones");
  }

  // 7) Caché contaminada por /test/ (dispositivo que abrió la copia de
  //    pruebas antes de esta versión): las claves que no están en la nube
  //    se apartan a cbj:orphans en vez de subirse a producción.
  {
    const { mock, win, P } = await setup();
    win.S.sessions[win.sk("t1", "2026-10-20")] = { p1: "present" }; // solo existe en /test/
    mock.fire(P("teams"), docsSnap([{ id: "t1", name: "Uno", order: 0 }]));
    mock.fire(P("teams/t1/sessions"), changesSnap([{ type: "added", id: "2026-10-01", data: { p1: "absent" } }]));
    await win._runCloudSync();
    r.assert(!mock.writes.some(w => w.path === P("teams/t1/sessions/2026-10-20")), "7) B-LSNS1: la sesión que solo estaba en la caché local (posible resto de /test/) NO se sube a la nube la primera vez");
    r.assert(!win.S.sessions[win.sk("t1", "2026-10-20")] && !!win.lsGet("cbj:orphans")["sessions|" + win.sk("t1", "2026-10-20")], "7) se aparta a cbj:orphans (recuperable), no se destruye");
    r.assert(!!win.S.sessions[win.sk("t1", "2026-10-01")], "7) la sesión real de la nube sí está");
  }

  // 8) Ya migrado: un cambio local sin cobertura que no llegó a subirse
  //    antes de cerrar la app SÍ se sube al volver a abrirla.
  {
    const { mock, win, P } = await setup();
    win._markLsNamespaceMigrated();
    win.S.sessions[win.sk("t1", "2026-11-07")] = { p1: "late" };
    mock.fire(P("teams"), docsSnap([{ id: "t1", name: "Uno", order: 0 }]));
    mock.fire(P("teams/t1/sessions"), changesSnap([]));
    await win._runCloudSync();
    r.assert(mock.writes.some(w => w.path === P("teams/t1/sessions/2026-11-07")), "8) tras la primera apertura, una asistencia local pendiente se sube con normalidad");
  }

  // 10) B-SYNCSAFE2: la caché local de Firestore dice "el club no existe"
  //     (móvil nuevo) -- NO es la verdad de la nube, no se sube nada.
  {
    const { mock, win } = await setup();
    const CP = `clubs/${win.CLUB_ID}`;
    win.S.cfg.coaches = [];
    mock.fire(CP, { exists: false, metadata: { fromCache: true }, data: () => ({}) });
    mock.fire(`${CP}/teams`, { docs: [], metadata: { fromCache: true } });
    await win._runCloudSync();
    r.assert(mock.writes.length === 0, "10) B-SYNCSAFE2: con solo la caché local ('el club no existe'), no se sube la configuración por defecto encima de la real -- el fallo visto al probar dev.108 en /test/");
    mock.fire(CP, { exists: true, metadata: { fromCache: false }, data: () => ({ cfg: { coaches: [{ id: "c1", name: "Mario", role: "superadmin" }] } }) });
    r.assert(win.S.cfg.coaches.length === 1, "10) cuando responde el servidor, llega la lista real de entrenadores");
    await win._runCloudSync();
    r.assert(!mock.writes.some(w => w.path === CP), "10) y no se reenvía nada");
  }

  // 11) Freno de la lista de entrenadores
  {
    const { mock, win } = await setup();
    const CP = `clubs/${win.CLUB_ID}`;
    mock.fire(CP, { exists: true, data: () => ({ cfg: { coaches: [{ id: "c1", name: "Mario", role: "superadmin" }, { id: "c2", name: "Ana", role: "entrenador" }] } }) });
    win.S.cfg.coaches = []; // bug: se vacía en memoria
    await win._runCloudSync();
    r.assert(!mock.writes.some(w => w.path === CP), "11) vaciar la lista de entrenadores por un bug NO llega a la nube");
    win._allowBulkDelete(); await win._runCloudSync();
    r.assert(mock.writes.some(w => w.path === CP), "11) quitar al último entrenador a mano (autorizado) sí se guarda");
  }

  // 9) Espacio de nombres de localStorage por club.
  {
    const { win } = await setup();
    const expected = win.CLUB_ID === "cbjaca" ? "cbj:t" : "cbj@" + win.CLUB_ID + ":t";
    r.assert(win._lsKey("cbj:t") === expected, "9) B-LSNS1: producción mantiene sus claves de siempre; cualquier otro club (p.ej. /test/) usa las suyas propias");
    r.assert(win._lsKey("cbj-ios-never") === "cbj-ios-never", "9) las claves que no son de datos del club no cambian");
  }

  return r.summary();
}

module.exports = { run };
if (require.main === module) run().then(({ failed }) => process.exit(failed ? 1 : 0));
