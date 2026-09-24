"use strict";
// v3.0.0-dev.75 · B-SYNC3: bug de fiabilidad encontrado durante una revisión
// general pedida por Mario ("hay bastantes fallos en las sincronizaciones de
// un dispositivo a otro"). Antes, si UN intento de _runCloudSync() fallaba
// (corte de red justo al guardar, error puntual del servidor...), el error
// solo se registraba por consola -- el cambio se quedaba a salvo en
// localStorage de ese dispositivo, pero Firestore nunca se enteraba, y nada
// volvía a intentarlo hasta que el entrenador tocase OTRA cosa en la app (lo
// que dispara un save() nuevo). Si cerraba la app justo después de ese fallo
// (el caso típico: pasar lista y salir del pabellón con mala cobertura), ese
// cambio podía quedarse sin sincronizar indefinidamente -- exactamente el
// síntoma reportado ("a veces cuesta o no llega a otro móvil").
//
// Cada escenario carga su propia instancia de la app (loadApp() fresco) para
// que _lastCloudSyncAt arranque en 0 y el primer _scheduleCloudSync() de cada
// bloque use el margen corto (350ms) en vez del hueco mínimo de 3s entre
// sincronizaciones (CLOUD_SYNC_MIN_GAP_MS) -- así el test es rápido y
// determinista sin depender de temporizadores largos reales.
//
// Reutiliza el mismo patrón de mock de Firestore que
// drilllive_cloud_sync.test.js (loadApp({firebase}), batch() real para poder
// inspeccionar los envíos), ampliado para poder hacer que UN commit() en
// concreto falle antes de dejar que los siguientes tengan éxito.
const { loadApp, newReporter } = require("./harness.js");

function makeFirebaseMock() {
  const listeners = {}; // path -> [callback, ...]
  const writes = []; // {op:"set"|"delete", path, data?}
  let failNextCommits = 0;
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
      const pending = [];
      return {
        set(docRef, data) { pending.push({ op: "set", path: docRef.path, data }); },
        delete(docRef) { pending.push({ op: "delete", path: docRef.path }); },
        commit() {
          if (failNextCommits > 0) {
            failNextCommits--;
            return Promise.reject(new Error("simulated network failure"));
          }
          writes.push(...pending);
          return Promise.resolve();
        }
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
    writes,
    failNextCommit(n) { failNextCommits = (n == null ? 1 : n); }
  };
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function setupWin() {
  const mock = makeFirebaseMock();
  const win = await loadApp({ firebase: mock.firebase });
  const P = p => `clubs/${win.CLUB_ID}/${p}`;
  mock.triggerLogin({ email: "club-cbjaca@kortline.app" });
  win.S.teamId = "t1";
  win.S.teams = [{ id: "t1", name: "Equipo Uno" }];
  win.S.players = { t1: [{ id: "p1", name: "Ana", number: 4 }] };
  win.S.sessions = {};
  return { win, mock, P };
}

async function run() {
  const report = newReporter("cloud_sync_retry");

  // ══════════════════════════════════════════════════════════════════════
  // Escenario 1: un guardado que falla se reintenta solo, sin que el
  // entrenador toque nada más.
  // ══════════════════════════════════════════════════════════════════════
  {
    const { win, mock, P } = await setupWin();
    mock.failNextCommit(1);
    win.S.sessions[win.sk("t1", "2026-09-24")] = { p1: "present" };
    let threw = false;
    try { await win._runCloudSync(); } catch (e) { threw = true; }
    report.assert(!threw, "un fallo de red al sincronizar se captura dentro de _runCloudSync() -- no debe propagar la excepción hacia arriba");
    report.assert(!mock.writes.some(w => w.path === P("teams/t1/sessions/2026-09-24")), "el commit falló -- la asistencia todavía NO ha llegado a Firestore");

    // v3.0.0-dev.75 · B-SYNC3: el propio fallo debe haber programado un
    // reintento automático (vía _scheduleCloudSync). Con _lastCloudSyncAt a
    // 0 (instancia recién cargada), el margen es el corto (350ms).
    await sleep(600);
    const attWrite = mock.writes.find(w => w.op === "set" && w.path === P("teams/t1/sessions/2026-09-24"));
    report.assert(!!attWrite, "B-SYNC3: sin que el usuario haga NADA más, el reintento automático llega solo y la asistencia SÍ acaba en Firestore");
    report.assert(!!(attWrite && attWrite.data && attWrite.data.p1 === "present"), "el dato reintentado es el correcto");
  }

  // ══════════════════════════════════════════════════════════════════════
  // Escenario 2: recuperar conexión (evento 'online') comprueba y sube lo
  // pendiente, sin esperar a otro cambio del usuario.
  // ══════════════════════════════════════════════════════════════════════
  {
    const { win, mock, P } = await setupWin();
    win.S.sessions[win.sk("t1", "2026-09-25")] = { p1: "absent" };
    win.save(); // deja el cambio pendiente por el ciclo normal de guardado
    win.window.dispatchEvent(new win.Event("online"));
    await sleep(600);
    const write25 = mock.writes.find(w => w.op === "set" && w.path === P("teams/t1/sessions/2026-09-25"));
    report.assert(!!write25, "B-SYNC3: el evento 'online' (recuperar conexión) dispara una comprobación de sincronización pendiente");
  }

  // ══════════════════════════════════════════════════════════════════════
  // Escenario 3: la app vuelve a primer plano (visibilitychange) hace la
  // misma comprobación.
  // ══════════════════════════════════════════════════════════════════════
  {
    const { win, mock, P } = await setupWin();
    win.S.sessions[win.sk("t1", "2026-09-26")] = { p1: "late" };
    win.save();
    win.document.dispatchEvent(new win.Event("visibilitychange"));
    await sleep(600);
    const write26 = mock.writes.find(w => w.op === "set" && w.path === P("teams/t1/sessions/2026-09-26"));
    report.assert(!!write26, "B-SYNC3: volver a primer plano (visibilitychange) también comprueba si hay algo pendiente de subir");
  }

  // ══════════════════════════════════════════════════════════════════════
  // Escenario 4: el camino feliz (sin fallos) sigue funcionando exactamente
  // igual que antes -- el mecanismo de reintentos no lo rompe.
  // ══════════════════════════════════════════════════════════════════════
  {
    const { win, mock, P } = await setupWin();
    win.S.sessions[win.sk("t1", "2026-09-27")] = { p1: "present" };
    win.save();
    await sleep(600);
    const write27 = mock.writes.find(w => w.op === "set" && w.path === P("teams/t1/sessions/2026-09-27"));
    report.assert(!!write27, "un guardado normal (sin fallos) sigue sincronizando con normalidad");
  }

  return report.summary();
}

module.exports = { run };
if (require.main === module) {
  run().then(({ failed }) => process.exit(failed ? 1 : 0));
}
