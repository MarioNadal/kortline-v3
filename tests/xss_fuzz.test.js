"use strict";
// v3.0.0-dev.108 · B-XSS2: prueba de intrusión automática. Cualquiera con el
// código del club puede escribir lo que quiera en Firestore (nombres,
// notas, rival...) y eso se pinta en el móvil de TODOS los entrenadores.
// Rellena cada campo de texto con HTML malicioso, recorre todas las
// pantallas y comprueba que ninguna lo interpreta como HTML (lo que
// permitiría ejecutar código en el móvil de otro entrenador).
const { loadApp, newReporter } = require("./harness.js");

const PAY = `ZZ"'><b class="xssprobe">X</b><img src=x class="xssprobe">`;

function poison(win) {
  const t = { id: "t1", name: PAY, category: PAY, color: "#F06318", coaches: [PAY], schedule: {} };
  win.S.teams = [t];
  win.S.clubName = PAY; win.S.clubAbrev = PAY; win.S.clubLema = PAY;
  win.S.cfg.coaches = [];
  const ps = [];
  for (let i = 1; i <= 8; i++) {
    ps.push({ id: "p" + i, name: PAY + i, nickname: PAY, position: PAY, number: i, notes: PAY,
      birthDate: "2012-01-01",
      incidents: [{ id: "i" + i, category: "otro", note: PAY, consequence: PAY, level: 1, date: win.td() }],
      injury: i === 1 ? { start: win.td(), notes: PAY, origin: "entreno", type: PAY } : null, isInj: i === 1,
      injuryHistory: [{ start: "2026-01-01", end: "2026-01-05", notes: PAY, origin: "partido" }] });
  }
  win.S.players = { t1: ps };
  const today = win.td();
  win.S.sessions = { [win.sk("t1", today)]: { p1: "present", p2: "absent", p3: "late", _notes: PAY, _ex: PAY, _just: { p2: { r: "otro", n: PAY } } } };
  win.S.matches = { t1: [{ id: "m1", date: today, time: "18:00", rival: PAY, location: PAY, venue: PAY, notes: PAY, quarters: 4, qMins: 10,
    convocados: ["p1", "p2", "p3", "p4", "p5", "p6"], titulares: ["p1", "p2", "p3", "p4", "p5"], capitan: "p1",
    rivalPlayers: [{ id: "r1", name: PAY, number: 9 }], rivalStatsEnabled: true, mode: "live" }] };
  win.S.events = { t1: [{ id: "e1", date: today, fecha: today, hora: "10:00", title: PAY, tipo: "otro", place: PAY, notes: PAY, convocados: ["p1"] }] };
  win.S.trainingNotes = { [win.sk("t1", today)]: { focoSemana: PAY, contenido: PAY, notasProximas: PAY, byPlayer: { p1: PAY } } };
  win.S.drills = { t1: [{ id: "d1", name: PAY, desc: PAY, type: "normal" }] };
  win.S.teamId = "t1"; win.S.matchId = "m1"; win.S.date = today;
}

async function run() {
  const r = newReporter("xss_fuzz");
  const win = await loadApp();
  win.URL.createObjectURL = () => "blob:mock";
  poison(win);
  const screens = ["hoy", "equipos", "statsHome", "team", "att", "stats", "hist", "share", "eventos", "matchList", "matchDetail", "liveGame", "shotMap", "matchSummary", "trainingNote", "trainingNotesWeek"];
  const hits = [];
  for (const sc of screens) {
    win.S.screen = sc;
    try { win.render(); } catch (e) { hits.push(sc + " (excepción: " + e.message + ")"); continue; }
    const n = win.document.querySelectorAll(".xssprobe").length;
    if (n) hits.push(sc + " ×" + n);
    win.document.querySelectorAll(".xssprobe").forEach(el => el.remove());
  }
  // Modales/ventanas que pintan datos de jugadoras o del partido
  const modals = [
    ["openIncidentModal", ["p1"]], ["openInjuryModal", ["p1"]], ["openPlayerDetail", ["p1"]],
    ["openLandscapeStats", []], ["openPlayerModal", ["p1"]], ["openEditPlayer", ["p1"]]
  ];
  win.S.screen = "liveGame"; try { win.render(); } catch (e) {}
  for (const [fn, args] of modals) {
    if (typeof win[fn] !== "function") continue;
    try { win[fn](...args); } catch (e) { continue; }
    const n = win.document.querySelectorAll(".xssprobe").length;
    if (n) hits.push(fn + " ×" + n);
    win.document.querySelectorAll(".xssprobe").forEach(el => el.remove());
  }
  r.assert(hits.length === 0, "ninguna pantalla ni modal interpreta como HTML un texto malicioso guardado por otro dispositivo" + (hits.length ? " -- inyectado en: " + hits.join(", ") : ""));

  // Ids maliciosos: un id de documento de Firestore puede contener comillas.
  // Los ids se usan dentro de onclick="fn('ID')": el HTML decodifica &#39;
  // ANTES de ejecutar el JS, así que esc() no protege ahí -- hay que
  // impedir que entren ids así.
  const bad = "x');window.__pwn=1;('";
  const sane = win._fsRestore({ id: bad, rivalPlayers: [{ id: bad }], convocados: [bad], capitan: bad });
  r.assert(!/['"<>]/.test(sane.id) && !/['"<>]/.test(sane.rivalPlayers[0].id) && !/['"<>]/.test(sane.convocados[0]) && !/['"<>]/.test(sane.capitan),
    "B-XSS2: los ids que llegan de Firestore con comillas/<> se neutralizan antes de llegar a ningún onclick");
  r.assert(win._safeDocId("abc_123-XY") === "abc_123-XY" && win._safeDocId(bad) !== bad, "_safeDocId deja intactos los ids normales y neutraliza los peligrosos");
  return r.summary();
}

module.exports = { run };
if (require.main === module) run().then(({ failed }) => process.exit(failed ? 1 : 0));
