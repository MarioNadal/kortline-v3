"use strict";
// v3.0.0-dev.114 · Auditoría "mono" a nivel usuario (pedida por Mario:
// "auditala como un profesional pero también pruébala como un usuario real").
// Carga una temporada completa de datos de ejemplo (equipos, jugadoras,
// lesiones, incidencias, asistencia, voluntarios/tecnificaciones, puntuales,
// partido en directo con jugadas, partido con estadísticas manuales, evento)
// y, en Chromium a tamaño móvil, PULSA UNO POR UNO TODOS LOS BOTONES de todas
// las pantallas, anotando cualquier error de JavaScript, texto "NaN"/
// "undefined" visible o elemento que se sale de la pantalla.
//
// Todo en local (sin Firebase): nunca toca ninguna base de datos real.
// No forma parte de run-all.js (necesita Chromium + Playwright). Uso:
//   node e2e/monkey.e2e.js ["Pixel 7"|"iPhone SE"|...]
//   MONKEY_ROLE=entrenador node e2e/monkey.e2e.js   → segunda pasada: un
//     entrenador que solo puede EDITAR el equipo t1 y solo VER el t2 pulsa
//     todo en las pantallas de t2; si consigue cambiar cualquier dato de t2
//     (o la lista de entrenadores) se anota como fallo de PERMISOS.
const { chromium, devices } = require("playwright");
const path = require("path"), http = require("http"), fs = require("fs");
const ROOT = path.join(__dirname, "..", "..");
const MIRROR = path.join(__dirname, "..", "cdn-mirror", "node_modules") + "/";
const INDEX = process.env.KORTLINE_TEST_INDEX || "index.html";
const map = { "chart.umd.min.js": "chart.js/dist/chart.umd.js", "driver.min.js.iife.js": "driver.js/dist/driver.js.iife.js", "driver.min.css": "driver.js/dist/driver.css", "jspdf.umd.min.js": "jspdf/dist/jspdf.umd.min.js", "jspdf.plugin.autotable.min.js": "jspdf-autotable/dist/jspdf.plugin.autotable.min.js", "xlsx.full.min.js": "xlsx/dist/xlsx.full.min.js" };

// Se ejecuta DENTRO de la página: construye la temporada de ejemplo usando
// las funciones reales de la app.
function seed() {
  /* global S, td, sk, skO, _addDaysISO, _weekdayIdxForDate, liveAction, save, render, navTo */
  const today = td(), ti = _weekdayIdxForDate(today), d = n => _addDaysISO(today, n);
  S.cfg.coaches = []; S.cfg.features = Object.assign({}, S.cfg.features, { exercises: true, teamScore: true, playerScore: true, incidents: true });
  S.clubName = "CB Prueba"; S.clubAbrev = "CBP";
  S.teams = [
    { id: "t1", name: "CADETE FEMENINO", category: "Cadete", gender: "Femenino", color: "#F06318", coaches: ["Mario", "Ana"], schedule: { [ti]: "17:00" }, optSchedules: { voluntario: { [ti]: "16:00" }, tecnificacion: {} }, order: 0 },
    { id: "t2", name: "SENIOR MASCULINO", category: "Senior", gender: "Masculino", color: "#3b82f6", coaches: ["Luis"], schedule: {}, optSchedules: { voluntario: {}, tecnificacion: { [ti]: "20:00" } }, order: 1 }
  ];
  const mk = (pre, n) => Array.from({ length: n }, (_, i) => ({ id: pre + i, name: "Jugador " + pre.toUpperCase() + (i + 1) + " Apellido", nickname: "J" + i, number: i + 4, position: ["Base", "Alero", "Pívot"][i % 3], birthDate: "2011-0" + (1 + i % 9) + "-1" + (i % 9), addedAt: d(-90) }));
  S.players = { t1: mk("a", 10), t2: mk("b", 9) };
  S.players.t1[1].birthDate = "2011-" + today.slice(5);                      // cumpleaños hoy
  S.players.t1[2].injury = { start: d(-5), notes: "Esguince", origin: "training", type: "tobillo", estimate: d(3) }; S.players.t1[2].isInj = true;
  S.players.t1[3].injuryHistory = [{ startDate: d(-60), endDate: d(-50), days: 10, notes: "Sobrecarga", origin: "match" }];
  S.players.t1[4].incidents = [{ id: "i1", category: "puntualidad", note: "Tarde", consequence: "Aviso", level: 1, date: d(-10) }, { id: "i2", category: "actitud", note: "Mala actitud", consequence: "Banquillo", level: 2, date: d(-3) }];
  S.players.t1.push({ id: "g1", name: "Invitada Puntual", guest: true, attOnly: true, addedAt: today, attDates: [today], number: 99 });
  S.sessions = {};
  for (let i = 1; i <= 12; i++) {
    const s = {}; S.players.t1.slice(0, 10).forEach((p, k) => { s[p.id] = ["present", "present", "absent", "late", "excused"][(i + k) % 5]; });
    s._notes = "Notas del día " + i; s._ex = "Tiro y defensa"; s._teamScore = 5 + (i % 5); S.sessions[sk("t1", d(-7 * i))] = s;
  }
  S.sessions[sk("t1", today)] = { a0: "present", a1: "absent", a1_jr: "", g1: "present" };
  S.sessions[skO("t1", d(-2), "voluntario")] = { _optType: "voluntario", a0: "present", a1: "absent" };
  S.sessions[skO("t2", d(-1), "tecnificacion")] = { _optType: "tecnificacion", _time: "20:00", b0: "present" };
  const conv = S.players.t1.slice(0, 8).map(p => p.id);
  S.matches = {
    t1: [
      { id: "mlive", date: today, time: "12:00", rival: "CB Rival", location: "home", venue: "Pabellón", quarters: 4, qMins: 10, stopOnFoul: true, matchMode: "live", convocados: conv, titulares: conv.slice(0, 5), capitan: conv[0], rivalStatsEnabled: true, rivalPlayers: [{ id: "r1", name: "Rival Uno", number: 10 }, { id: "r2", name: "Rival Dos", number: 11 }], trackPlayType: true, shotChart: true, countsForAttendance: true },
      { id: "mq", date: d(-7), time: "11:00", rival: "Otro CB", location: "away", quarters: 4, qMins: 10, matchMode: "quarters", convocados: conv, q: [12, 10, 15, 18, 9, 11, 20, 14], finished: true, countsForAttendance: true, manualStats: { byQuarter: { 0: Object.fromEntries(conv.map((id, k) => [id, { min: 5, p2m: k % 3, p2a: 1, p3m: k % 2, p3a: 1, p1m: 1, p1a: 1 }])) }, plusMinus: { [conv[0]]: 6, [conv[1]]: -4 } } },
      { id: "mfin", date: d(-14), time: "10:00", rival: "Final CB", location: "home", quarters: 4, qMins: 10, matchMode: "final", convocados: conv, q: [60, 55], finished: true }
    ],
    t2: [{ id: "ms", date: d(2), time: "19:00", rival: "Senior Rival", location: "home", quarters: 4, qMins: 10, matchMode: "quarters", convocados: S.players.t2.slice(0, 8).map(p => p.id) }]
  };
  S.events = { t1: [{ id: "e1", tipo: "torneo", titulo: "Torneo de Navidad", fecha: d(5), date: d(5), hora: "10:00", lugar: "Jaca", convocados: conv.slice(0, 6), notas: "Llevar equipación" }] };
  S.drills = { t1: [{ id: "dr_1", name: "Contraataque de 11", type: "b11" }, { id: "dr_2", name: "Rueda de tiro", type: "normal" }] };
  S.trainingNotes = {}; S.drillLive = {};
  save();
  // Partido en directo con jugadas reales, por las mismas funciones que los botones
  S.teamId = "t1"; S.matchId = "mlive";
  navTo("liveGame", { teamId: "t1", matchId: "mlive" });
  const acts = [["p2m", 2], ["p3m", 3], ["p2a", 0], ["ro", 0], ["rd", 0], ["as", 0], ["st", 0], ["to", 0], ["p3a", 0], ["p2m", 2]];
  try { conv.slice(0, 5).forEach((pid, k) => { const a = acts[k % acts.length], b = acts[(k + 5) % acts.length]; liveAction(pid, a[0], a[1]); liveAction(pid, b[0], b[1]); }); } catch (e) { window.__seedErr = String(e && e.stack || e); }
  document.querySelectorAll("body > div[id^='m-']").forEach(x => x.remove());
  // Segundo directo (equipo t2), para la pasada de "entrenador de solo lectura"
  try { navTo("liveGame", { teamId: "t2", matchId: "ms" }); const c2 = S.matches.t2[0].convocados; liveAction(c2[0], "p2m", 2); liveAction(c2[1], "foul", 0); } catch (e) { window.__seedErr = (window.__seedErr || "") + " | t2: " + String(e && e.stack || e); }
  document.querySelectorAll("body > div[id^='m-']").forEach(x => x.remove());
  save();
  return { today };
}

const ROLE = process.env.MONKEY_ROLE || "";
const SCREENS_ROLE = [
  ["hoy", {}], ["equipos", {}], ["statsHome", {}], ["team", { teamId: "t1" }], ["att", { teamId: "t1", date: "__TODAY__", attOpt: false }], ["matchDetail", { teamId: "t1", matchId: "mq" }], ["hist", { teamId: "t1" }], ["team", { teamId: "t2" }], ["att", { teamId: "t2", date: "__TODAY__", attOpt: false }], ["att", { teamId: "t2", date: "__TODAY__", attOpt: "tecnificacion" }],
  ["hist", { teamId: "t2" }], ["matchList", { teamId: "t2" }], ["matchDetail", { teamId: "t2", matchId: "ms" }], ["eventos", { teamId: "t2" }], ["stats", { teamId: "t2", statsView: "table" }],
  ["liveGame", { teamId: "t2", matchId: "ms" }], ["matchSummary", { teamId: "t2", matchId: "ms" }], ["shotMap", { teamId: "t2", matchId: "ms" }],
  ["dlsLive", { teamId: "t2" }]
];
const SCREENS_ALL = [
  ["hoy", {}], ["equipos", {}], ["statsHome", {}],
  ["team", { teamId: "t1" }], ["att", { teamId: "t1", date: "__TODAY__", attOpt: false }], ["att", { teamId: "t1", date: "__TODAY__", attOpt: "voluntario" }],
  ["hist", { teamId: "t1" }], ["share", { teamId: "t1", date: "__TODAY__", attOpt: false }],
  ["stats", { teamId: "t1", statsView: "table" }], ["stats", { teamId: "t1", statsView: "team" }], ["stats", { teamId: "t1", statsView: "matches" }], ["stats", { teamId: "t1", statsView: "charts" }],
  ["eventos", { teamId: "t1" }], ["matchList", { teamId: "t1" }],
  ["matchDetail", { teamId: "t1", matchId: "mq" }], ["matchDetail", { teamId: "t1", matchId: "mfin" }], ["matchDetail", { teamId: "t1", matchId: "mlive" }],
  ["liveGame", { teamId: "t1", matchId: "mlive" }], ["shotMap", { teamId: "t1", matchId: "mlive" }], ["matchSummary", { teamId: "t1", matchId: "mlive" }],
  ["team", { teamId: "t2" }], ["matchDetail", { teamId: "t2", matchId: "ms" }], ["att", { teamId: "t2", date: "__TODAY__", attOpt: "tecnificacion" }],
  ["liveGame", { teamId: "t2", matchId: "ms" }]
];

(async () => {
  const types = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".css": "text/css" };
  const srv = http.createServer((req, res) => {
    const f = path.join(ROOT, decodeURIComponent(req.url.split("?")[0]));
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "Content-Type": types[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(res);
  }).listen(0);
  const PORT = srv.address().port;
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices[process.argv[2] || "Pixel 7"], serviceWorkers: "block" });
  const page = await ctx.newPage();
  let cur = "";
  const findings = [];
  const note = (kind, msg) => { const k = kind + " | " + cur + " | " + msg; if (!findings.includes(k)) findings.push(k); };
  page.on("pageerror", e => note("ERROR JS", (e.message || "") + " @ " + String(e.stack || "").split("\n").slice(1, 3).join(" < ").replace(/http:\/\/localhost:\d+\//g, "")));
  page.on("console", m => { if (m.type() === "error" && !/Failed to load resource|net::|ERR_/.test(m.text())) note("console.error", m.text().slice(0, 300)); });
  page.on("dialog", d => d.dismiss().catch(() => {}));
  page.on("download", d => d.cancel().catch(() => {}));
  await page.route("**/*", r => { const u = r.request().url();
    if (!u.startsWith("http://localhost")) { const f = Object.keys(map).find(k => u.endsWith(k)); if (f) return r.fulfill({ path: MIRROR + map[f] }); return r.abort(); }
    return r.continue(); });
  await page.addInitScript(() => { try { window.open = () => null; navigator.share = () => Promise.resolve(); } catch (e) {} });
  await page.goto(`http://localhost:${PORT}/${INDEX}`);
  await page.evaluate(() => { localStorage.clear(); ["cbj-ios-never", "cbj-android-never"].forEach(k => localStorage.setItem(k, "1")); localStorage.setItem("cbj:tour_seen", "true"); localStorage.setItem("cbj:coachname_skipped", "true"); });
  await page.reload(); await page.waitForTimeout(600);
  cur = "(carga de datos de ejemplo)";
  const { today } = await page.evaluate(seed);
  const seedErr = await page.evaluate(() => window.__seedErr || "");
  if (seedErr) note("ERROR JS", "al simular jugadas del directo: " + seedErr.slice(0, 300));
  if (ROLE) await page.evaluate(() => {
    S.cfg.coaches = [{ id: "c1", name: "Super", role: "superadmin", teamsEdit: [], teamsView: [] }, { id: "c2", name: "Entrenador T1", role: "entrenador", teamsEdit: ["t1"], teamsView: ["t2"] }];
    save(); _setCurrentCoachId("c2");
  });
  const SCREENS = ROLE ? SCREENS_ROLE : SCREENS_ALL;
  const guardFn = () => JSON.stringify({ team: S.teams.find(t => t.id === "t2"), teamsIdsOrder: S.teams.map(t => t.id + ":" + t.order), nTeams: S.teams.length, players: S.players.t2, matches: S.matches.t2, events: (S.events || {}).t2 || [], sess: Object.keys(S.sessions).filter(k => k.startsWith("t2_")).sort().map(k => [k, S.sessions[k]]), coaches: S.cfg.coaches, seasons: S.cfg.seasons || [], seasonStart: S.cfg.seasonStart || null });
  const snapshot = await page.evaluate(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k); } return o; });

  const goto = async (scr, opts) => page.evaluate(([scr, opts, snap]) => {
    document.querySelectorAll("body > div").forEach(x => { if (x.id !== "root" && !x.contains(document.getElementById("root"))) x.remove(); });
    localStorage.clear(); Object.keys(snap).forEach(k => localStorage.setItem(k, snap[k]));
    load(); S.navStack = []; S.attFilter = ""; S._attDraft = null; S.hoyDate = null;
    Object.assign(S, { teamId: null, matchId: null, eventId: null, attOpt: false }, opts); S.screen = scr; render();
  }, [scr, opts, snapshot]);
  const check = async (what) => {
    const r = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const vis = [...document.querySelectorAll("#root, body > div[id^='m-']")].map(e => e.innerText || "").join("\n");
      const bad = (vis.match(/[^\n]{0,40}\b(NaN|undefined|null%|Invalid Date|\[object Object\])[^\n]{0,30}/g) || []).slice(0, 3);
      const wide = [...document.querySelectorAll("body > div[id^='m-'] .modal, #root .content > *")].filter(e => { const b = e.getBoundingClientRect(); return b.width > 0 && (b.right > vw + 2 || b.left < -2); }).length;
      return { bad, wide, scrollX: document.documentElement.scrollWidth > vw + 2 };
    });
    r.bad.forEach(t => note("TEXTO ROTO", what + " → «" + t.trim() + "»"));
    if (r.wide || r.scrollX) note("SE SALE DE PANTALLA", what + (r.scrollX ? " (scroll lateral)" : ""));
  };

  if (ROLE) await page.evaluate(() => { const orig = window.toast; window.__locks = []; window.toast = function (m) { if (/🔒|Solo el superadmin|Solo el superadmin o|no puedes|No tienes/i.test(String(m))) window.__locks.push(String(m)); return orig.apply(this, arguments); }; });
  const checkLate = async () => { if (!ROLE) return; const l = await page.evaluate(() => { const x = window.__locks || []; window.__locks = []; return x; }); l.forEach(m => note("AVISA TARDE", "un botón visible deja intentarlo y al final avisa: «" + m.slice(0, 90) + "»")); };
  const guard0 = ROLE ? await page.evaluate(guardFn) : null;
  // Dos comprobaciones distintas: (1) solo ABRIR una pantalla no debe cambiar
  // datos de un equipo que no se puede editar; (2) PULSAR un botón tampoco.
  const diffKeys = (a, b) => { try { const A = JSON.parse(a), B = JSON.parse(b); const out = []; const walk = (x, y, p) => { if (JSON.stringify(x) === JSON.stringify(y)) return; if (x && y && typeof x === "object" && typeof y === "object" && out.length < 6) { new Set([...Object.keys(x), ...Object.keys(y)]).forEach(k => walk(x[k], y[k], p + "." + k)); } else out.push(p); }; walk(A, B, ""); return out.slice(0, 6).join(", "); } catch (e) { return "?"; } };
  let guardOpen = guard0;
  const checkOpen = async () => { if (!ROLE) return; guardOpen = await page.evaluate(guardFn); if (guardOpen !== guard0) note("PERMISOS (solo por abrir la pantalla)", "cambia: " + diffKeys(guard0, guardOpen)); };
  const checkGuard = async () => { if (!ROLE) return; const g = await page.evaluate(guardFn); if (g !== guardOpen) note("PERMISOS", "un entrenador SIN permiso de edición cambia: " + diffKeys(guardOpen, g)); };
  let clicks = 0;
  for (const [scr, rawOpts] of SCREENS) {
    const opts = JSON.parse(JSON.stringify(rawOpts).replace(/__TODAY__/g, today));
    cur = scr + " " + JSON.stringify(rawOpts).replace(/"/g, "");
    await goto(scr, opts); await page.waitForTimeout(150);
    await check("pantalla"); await checkOpen();
    if (ROLE) {
      const ro = await page.evaluate(() => ({ banner: !!document.querySelector("#root .ro-banner"), pasar: /Pasar lista|Anotar partido|Empezar partido|Continuar en vivo/.test(document.getElementById("root").innerText) }));
      const ownTeam = opts.teamId !== "t2";
      if (!ownTeam && /^(team|att|hist|matchList|matchDetail|liveGame|eventos|stats|shotMap|matchSummary|dlsLive)$/.test(scr) && !ro.banner) note("MODO VER", "falta el aviso de Modo ver");
      if (ownTeam && ro.banner) note("MODO VER", "sale el aviso de Modo ver en un equipo que SÍ puede editar");
      if (!ownTeam && ro.pasar && scr !== "hoy") note("MODO VER", "sigue ofreciendo Pasar lista / Anotar / Empezar en un equipo de solo ver");
    }
    const handlers = await page.evaluate(() => [...new Set([...document.querySelectorAll("#root [onclick]")].filter(e => e.offsetParent !== null && getComputedStyle(e).pointerEvents !== "none").map(e => e.getAttribute("onclick")))]);
    for (const h of handlers) {
      if (/navRoot\(|navBack\(|^navTo\(|location\.|installPWA|startTour/.test(h)) continue; // navegación ya cubierta pantalla a pantalla; el tutorial tiene su propio test
      await goto(scr, opts);
      const done = await page.evaluate((h) => { const el = [...document.querySelectorAll("#root [onclick]")].find(e => e.getAttribute("onclick") === h && e.offsetParent !== null && getComputedStyle(e).pointerEvents !== "none"); if (!el) return false; el.click(); return true; }, h);
      if (!done) continue;
      if (ROLE) { /* estado justo antes del clic = el de abrir la pantalla */ }
      clicks++; cur = scr + " " + JSON.stringify(rawOpts).replace(/"/g, "") + " → clic «" + h.slice(0, 90) + "»";
      await page.waitForTimeout(60);
      await check("tras pulsar"); await checkGuard(); await checkLate();
      // segundo nivel: dentro de la ventana que se haya abierto, pulsar también sus botones
      const inner = await page.evaluate((lim) => [...new Set([...document.querySelectorAll("body > div[id^='m-'] [onclick]")].filter(e => e.offsetParent !== null && getComputedStyle(e).pointerEvents !== "none").map(e => e.getAttribute("onclick")))].slice(0, lim), ROLE ? 120 : 25);
      for (const h2 of inner) {
        if (/startTour/.test(h2)) continue;
        if (/\.remove\(\)$|_closeModal|navRoot|location\./.test(h2) && !/;.*\(/.test(h2.replace(/\.remove\(\)$/, ""))) continue;
        const ok2 = await page.evaluate((h2) => { const el = [...document.querySelectorAll("body > div[id^='m-'] [onclick]")].find(e => e.getAttribute("onclick") === h2 && e.offsetParent !== null && getComputedStyle(e).pointerEvents !== "none"); if (!el) return false; el.click(); return true; }, h2);
        if (!ok2) continue;
        clicks++; const prev = cur; cur = prev + " → «" + h2.slice(0, 70) + "»";
        if (ROLE) { await page.evaluate(() => { const c = document.querySelector("#m-confirm button"); if (c) c.click(); }); }
        await page.waitForTimeout(40); await check("ventana"); await checkGuard(); await checkLate(); cur = prev;
      }
      cur = scr + " " + JSON.stringify(rawOpts).replace(/"/g, "");
    }
  }
  await b.close(); srv.close();
  console.log(`\nPantallas: ${SCREENS.length} · botones pulsados: ${clicks} · hallazgos: ${findings.length}\n`);
  findings.forEach(f => console.log(" - " + f));
  process.exit(findings.some(f => f.startsWith("ERROR JS") || f.startsWith("PERMISOS")) ? 1 : 0);
})();
