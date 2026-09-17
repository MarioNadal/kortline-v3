"use strict";
// v3.0.0-dev.69 · B-DLS4: bug real reportado por Mario probando "Contraataque
// de 11" en /test/ -- "deben de guardarse las estadísticas... sino se pierde
// al cerrar la aplicación". Mismo patrón de bug que B-DRILLSAVE1 (dev.53,
// ver drills.test.js) pero para S.drillLive en vez de S.drills: desde que se
// introdujo en B-DLS1 (dev.57), CADA acción de un ejercicio en vivo llamaba a
// save() (así que S.drillLive SÍ estaba actualizado en memoria), pero save()
// nunca escribía la clave "cbj:dl" en localStorage, load() nunca la leía de
// vuelta, y _snapshotState()/_runCloudSync() tampoco lo sincronizaban con
// Firestore -- así que TODO el historial de estadísticas en vivo (de
// cualquier ejercicio, "Contraataque de 11" o "Final de partido") vivía
// ÚNICAMENTE en memoria del JS de esa pestaña/sesión concreta: se perdía sin
// ningún aviso en cuanto se cerraba la app, se refrescaba la página, o
// Firestore reenviaba cualquier otra colección (¡S.drillLive ni siquiera
// sobrevivía a la sincronización de otros datos!).
const { loadApp, newReporter } = require("./harness.js");

async function run() {
  const win = await loadApp();
  const report = newReporter("drilllive_persistence");
  const { document } = win;

  win.S.teamId = "t1";
  win.S.teams = [{ id: "t1", name: "Equipo", color: "#F06318" }];
  win.S.players = { t1: [{ id: "p1", name: "Ana García", number: 4 }] };
  win.S.drills = { t1: [] };
  win.S.sessions = {};
  win.S.drillLive = {};
  win.S.date = "2026-09-17";

  // ── save()/load(): el mismo round-trip que ya se arregló para S.drills en B-DRILLSAVE1 (dev.53) ──
  win.localStorage.removeItem("cbj:dl");
  const fakeSession = { id: "dls_persist1", drillId: "d1", drillName: "Contraataque de 11", date: "2026-09-17", type: "b11", status: "finished", startedAt: 1, finishedAt: 2, checklist: { ast: true, missTrack: true, missPenalty: false }, durationSec: 720, remainingSec: 0, players: [{ id: "p1", name: "Ana García", number: 4 }], stats: { p1: { p2m: 3, p2a: 1, p3m: 1, p3a: 0, reb: 2, to: 0, stl: 1, ast: 0, blk: 0 } }, log: [{ pid: "p1", action: "p2m", ts: 1 }] };
  win.S.drillLive = { t1: { d1: [fakeSession] } };
  win.save();
  const persistedDl = JSON.parse(win.localStorage.getItem("cbj:dl") || "null");
  report.assert(!!persistedDl, "save() escribe la clave 'cbj:dl' en localStorage (antes NUNCA lo hacía -- este es el bug real reportado)");
  report.assert(!!(persistedDl && persistedDl.t1 && persistedDl.t1.d1 && persistedDl.t1.d1[0] && persistedDl.t1.d1[0].id === "dls_persist1"), "el contenido guardado en localStorage refleja el historial de ejercicios en vivo tal cual estaba en memoria");
  // Simula un refresco de página / cierre y reapertura de la app: load() reconstruye S.drillLive SOLO desde localStorage.
  win.S.drillLive = {};
  win.load();
  report.assert(win.S.drillLive.t1 && win.S.drillLive.t1.d1 && win.S.drillLive.t1.d1[0] && win.S.drillLive.t1.d1[0].id === "dls_persist1", "tras 'recargar' (load() desde localStorage), la sesión de ejercicio en vivo sigue ahí -- ya no se pierde al cerrar la app");
  report.assert(win.S.drillLive.t1.d1[0].stats.p1.p2m === 3, "las estadísticas concretas de la sesión (no solo su existencia) sobreviven íntegras al ciclo guardar/recargar");

  // ── _persistLocalCacheOnly() (la ruta que se usa al recibir datos de Firestore de OTRO entrenador) también debe escribir "cbj:dl" ──
  win.localStorage.removeItem("cbj:dl");
  win._persistLocalCacheOnly();
  report.assert(!!JSON.parse(win.localStorage.getItem("cbj:dl") || "null"), "_persistLocalCacheOnly() también escribe 'cbj:dl' -- antes tampoco lo hacía, así que un refresco justo después de recibir una sincronización remota también perdía el historial");

  // ── _flattenDrillLive/_unflattenDrillLiveTeam: round-trip sin pérdida entre la forma anidada (que usa el resto de la app) y la forma plana (que usa el sync con Firestore, un documento por sesión) ──
  const sessA = { id: "dls_a", drillId: "dA", drillName: "Ejercicio A", type: "b11", status: "finished", players: [], stats: {}, log: [] };
  const sessB1 = { id: "dlm_b1", drillId: "dB", drillName: "Ejercicio B", type: "endgame", status: "finished", players: [], stats: {}, log: [] };
  const sessB2 = { id: "dlm_b2", drillId: "dB", drillName: "Ejercicio B", type: "endgame", status: "running", players: [], stats: {}, log: [] };
  const nested = { t1: { dA: [sessA], dB: [sessB1, sessB2] }, t2: { dC: [] } };
  const flat = win._flattenDrillLive(nested);
  report.assert(Array.isArray(flat.t1) && flat.t1.length === 3, "_flattenDrillLive junta TODAS las sesiones de TODOS los ejercicios de un equipo en un único array plano (3 sesiones: dA tiene 1, dB tiene 2)");
  report.assert(flat.t1.some(s => s.id === "dls_a") && flat.t1.some(s => s.id === "dlm_b1") && flat.t1.some(s => s.id === "dlm_b2"), "el array plano conserva cada sesión con su id original intacto");
  const reconstructed = win._unflattenDrillLiveTeam(flat.t1);
  report.assert(reconstructed.dA.length === 1 && reconstructed.dA[0].id === "dls_a", "_unflattenDrillLiveTeam reconstruye el grupo del ejercicio dA a partir del campo drillId de cada sesión");
  report.assert(reconstructed.dB.length === 2 && reconstructed.dB.some(s => s.id === "dlm_b1") && reconstructed.dB.some(s => s.id === "dlm_b2"), "reconstruye también un ejercicio con varias sesiones en su historial (dB), sin perder ninguna");
  report.assert(win._unflattenDrillLiveTeam([{ id: "huerfana", drillId: null }, null, undefined]).drillId === undefined, "_unflattenDrillLiveTeam no revienta con una sesión sin drillId o con entradas nulas -- simplemente las ignora");

  // ── _snapshotState() incluye drillLive ya aplanado (para que _runCloudSync lo pueda sincronizar como una colección más) ──
  win.S.drillLive = { t1: { d1: [fakeSession] } };
  const snap = win._snapshotState();
  report.assert(Array.isArray(snap.drillLive?.t1) && snap.drillLive.t1.length === 1 && snap.drillLive.t1[0].id === "dls_persist1", "_snapshotState() incluye S.drillLive ya aplanado para el equipo t1 -- antes ni existía en el snapshot, así que _runCloudSync() jamás lo subía a Firestore");

  // ── _dlsCmpView: excluye remainingSec de la comparación (para no disparar una sincronización cada segundo mientras el cronómetro corre, igual que ya se hace para el reloj de partidos con _matchCmpView) ──
  const withClock = { id: "x", status: "running", remainingSec: 700, stats: {} };
  const cmp1 = win._dlsCmpView(withClock);
  report.assert(!("remainingSec" in cmp1), "_dlsCmpView() quita remainingSec de la vista usada para comparar -- así un tick del cronómetro no parece un cambio real");
  report.assert(cmp1.status === "running" && cmp1.id === "x", "_dlsCmpView() conserva el resto de campos tal cual (solo excluye remainingSec)");
  report.assert(withClock.remainingSec === 700, "_dlsCmpView() no modifica el objeto original -- el remainingSec real que SÍ hay que guardar sigue intacto");
  const withClock2 = { ...withClock, remainingSec: 650 }; // solo cambia el segundero
  report.assert(JSON.stringify(win._dlsCmpView(withClock)) === JSON.stringify(win._dlsCmpView(withClock2)), "dos sesiones que solo difieren en remainingSec se consideran IGUALES para decidir si hace falta sincronizar (evita un envío a Firestore cada segundo con cualquier ejercicio/mini-partido en marcha)");
  report.assert(win._dlsCmpView(null) === null, "_dlsCmpView(null) no revienta");

  return report.summary();
}

module.exports = { run };
if (require.main === module) {
  run().then(({ failed }) => process.exit(failed ? 1 : 0));
}
