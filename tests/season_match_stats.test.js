"use strict";
// v3.0.0-dev.126 · Temporada completa de partidos: directo (con marcador
// público), estadísticas a mano y solo marcador, en dos temporadas. Comprueba
// que TODAS las cifras cuadran con lo que se anotó: por jugadora, equipo,
// balance V-D, KPIs, exportación Excel y marcador para familias; y que al
// archivar la temporada (B-SEASON5) los partidos no se mezclan.
const { loadApp, newReporter } = require("./harness.js");
async function run() {
  const r = newReporter("season_match_stats");
  const win = await loadApp(); const doc = win.document;
  let seed = 12345; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const today = win.td(), d = n => win._addDaysISO(today, n);
  win.S.cfg.features = Object.assign({}, win.S.cfg.features, { chainPrompt: false });
  win.S.cfg.seasons = []; win.S.cfg.seasonStart = null;
  win.S.teams = [{ id: "t1", name: "JUNIOR", category: "Junior", color: "#F06318" }];
  const P = Array.from({ length: 10 }, (_, i) => ({ id: "p" + i, name: "Jug " + i, number: i + 4, addedAt: d(-400) }));
  win.S.players = { t1: P };
  win.S.matches = { t1: [] }; win.S.sessions = {};
  win.save();
  // Registro esperado, por partido
  const exp = {}; // mid -> {ours,theirs,players:{pid:{pts,p1m,p1a,p2m,p2a,p3m,p3a,ro,rd,ast,stl,blk,to}}}
  const blank = () => ({ pts: 0, p1m: 0, p1a: 0, p2m: 0, p2a: 0, p3m: 0, p3a: 0, ro: 0, rd: 0, ast: 0, stl: 0, blk: 0, to: 0 });
  const ACTIONS = [["p2m", 2], ["p2a", 0], ["p3m", 3], ["p3a", 0], ["p1m", 1], ["p1a", 0], ["ro", 0], ["rd", 0], ["ast", 0], ["stl", 0], ["blk", 0], ["to", 0]];
  let pubMismatch = 0, pubNames = 0, liveInv = 0;
  const playLive = (mid, date, location, nPlays) => {
    const conv = P.map(p => p.id);
    win.S.matches.t1.push({ id: mid, date, time: "18:00", rival: "Rival " + mid, location, quarters: 4, qMins: 10, matchMode: "live", convocados: conv, titulares: conv.slice(0, 5), rivalPlayers: [] });
    win.save(); win.navTo("liveGame", { teamId: "t1", matchId: mid });
    const m = win.mById("t1", mid);
    win.startPublicScore(); // marcador para familias activo todo el partido
    doc.querySelectorAll("body > div[id^='m-']").forEach(x => x.remove());
    const e = exp[mid] = { ours: 0, theirs: 0, players: {} };
    for (let i = 0; i < nPlays; i++) {
      if (i > 0 && i % Math.ceil(nPlays / 4) === 0 && m.live.q < 4) { m.live.q++; m.live.maxQ = Math.max(m.live.maxQ || 1, m.live.q); win._ensureQSlot(m.live, m.live.q - 1); }
      if (rnd() < 0.3) { const pts = 1 + Math.floor(rnd() * 3); win.rivalScoreLive(pts); e.theirs += pts; }
      else {
        const onC = m.live.onCourt || []; const pid = onC[Math.floor(rnd() * onC.length)];
        const [a, pts] = ACTIONS[Math.floor(rnd() * ACTIONS.length)];
        win.liveAction(pid, a, pts);
        doc.querySelectorAll("body > div[id^='m-']").forEach(x => x.remove());
        const s = e.players[pid] = e.players[pid] || blank(); s[a]++; s.pts += pts; e.ours += pts;
      }
      // invariantes y marcador público tras CADA jugada
      const sc = win.mScore(m); const ours = location === "away" ? sc.a : sc.h, theirs = location === "away" ? sc.h : sc.a;
      const sumP = Object.values(m.live.stats || {}).reduce((t, s) => t + win._msPts(s), 0);
      if (ours !== e.ours || theirs !== e.theirs || sumP !== e.ours || (m.live.onCourt || []).length !== 5) liveInv++;
      const pay = win._publicPayload("t1", m);
      const pSum = pay.periods.reduce((t, x) => [t[0] + x.o, t[1] + x.r], [0, 0]);
      if (pay.ours !== e.ours || pay.theirs !== e.theirs || pSum[0] !== e.ours || pSum[1] !== e.theirs) pubMismatch++;
      if (/Jug \d/.test(JSON.stringify(pay))) pubNames++;
    }
    win.finishMatch("t1", mid);
    doc.querySelectorAll("body > div[id^='m-']").forEach(x => x.remove());
    const fin = win._publicPayload("t1", win.mById("t1", mid));
    if (!fin.finished) pubMismatch++;
  };
  const manual = (mid, date, location, byQ, q) => {
    win.S.matches.t1.push({ id: mid, date, rival: "Rival " + mid, location, quarters: 4, q, manualStats: { byQuarter: byQ } });
    const e = exp[mid] = { ours: 0, theirs: 0, players: {} };
    const sc = win.mScore({ q, location }); e.ours = location === "away" ? sc.a : sc.h; e.theirs = location === "away" ? sc.h : sc.a;
    Object.values(byQ).forEach(qd => Object.entries(qd).forEach(([pid, s]) => { const t = e.players[pid] = e.players[pid] || blank(); Object.keys(s).forEach(k => { t[k] += s[k]; }); t.pts += (s.p1m || 0) + 2 * (s.p2m || 0) + 3 * (s.p3m || 0); }));
  };
  // Temporada A (pasada)
  playLive("a1", d(-200), "home", 80);
  playLive("a2", d(-190), "away", 80);
  manual("a3", d(-180), "home", { 0: { p0: { p2m: 3, p2a: 2, p1m: 1, rd: 2 }, p1: { p3m: 1, p3a: 3 } }, 2: { p0: { p2m: 1 }, p2: { p2m: 2, ast: 3 } } }, [10, 12, 8, 9, 7, 6, 5, 11]);
  win.S.matches.t1.push({ id: "a4", date: d(-170), rival: "Solo marcador", location: "away", quarters: 4, q: [20, 10, 15, 12, 9, 14, 11, 8] });
  // Temporada actual
  playLive("b1", d(-30), "home", 120);
  playLive("b2", d(-20), "away", 120);
  playLive("b3", d(-10), "home", 60);
  manual("b4", d(-5), "away", { 1: { p3: { p2m: 4, p2a: 1, to: 2 }, p4: { p1m: 4, p1a: 2, stl: 1 } } }, [14, 10, 12, 11, 9, 13, 10, 12]);
  win.save();
  r.assert(liveInv === 0, `Directo: marcador = suma de puntos de las jugadoras = lo anotado, y 5 en pista, tras cada jugada (${liveInv} fallos)`);
  r.assert(pubMismatch === 0, `Marcador para familias: igual que el directo tras cada jugada, parciales que suman el total y 'Final' al terminar (${pubMismatch} fallos)`);
  r.assert(pubNames === 0, "Marcador para familias: nunca lleva nombres de jugadoras");

  const sumExp = mids => { const o = {}; let pj = {}; mids.forEach(mid => Object.entries(exp[mid].players).forEach(([pid, s]) => { const t = o[pid] = o[pid] || blank(); Object.keys(s).forEach(k => t[k] += s[k]); pj[pid] = (pj[pid] || 0) + 1; })); return { o, pj }; };
  const checkAgg = (mids, label) => {
    win.S.teamId = "t1"; win.S.statsMonth = null;
    const { matchList, rows } = win._matchAggRows();
    const { o, pj } = sumExp(mids);
    r.assert(matchList.length === mids.length && mids.every(id => matchList.some(m => m.id === id)), `${label}: entran exactamente los partidos con estadísticas de esa temporada (${matchList.length})`);
    let bad = [];
    Object.entries(o).forEach(([pid, s]) => { const row = rows.find(x => x.p.id === pid); if (!row) { bad.push(pid + ":sin fila"); return; }
      ["pts", "p1m", "p1a", "p2m", "p2a", "p3m", "p3a", "ro", "rd", "ast", "stl", "blk", "to"].forEach(k => { if (row.a[k] !== s[k]) bad.push(`${pid}.${k} ${row.a[k]}≠${s[k]}`); });
      if (row.a.pj !== pj[pid]) bad.push(`${pid}.pj ${row.a.pj}≠${pj[pid]}`); });
    r.assert(bad.length === 0, `${label}: cada jugadora suma exactamente lo anotado (puntos, tiros, rebotes, asistencias, robos, tapones, pérdidas, PJ)${bad.length ? " -- " + bad.slice(0, 5).join(", ") : ""}`);
    const k = win.computeTeamKPIs(matchList);
    const tot = Object.values(o).reduce((t, s) => { t.fga += s.p2m + s.p2a + s.p3m + s.p3a; t.to += s.to; t.ro += s.ro; return t; }, { fga: 0, to: 0, ro: 0 });
    r.assert(k.fga === tot.fga && k.to === tot.to && k.ro === tot.ro, `${label}: KPIs de equipo (tiros de campo, pérdidas, rebotes ofensivos) cuadran`);
    // Excel de partidos
    let wb = null; const orig = win.XLSX.writeFile; win.XLSX.writeFile = w => { wb = w; }; win.exportMatchesExcel(); win.XLSX.writeFile = orig;
    const aoa = wb ? win.XLSX.utils.sheet_to_json(wb.Sheets["Partidos"], { header: 1 }) : [];
    const xlBad = aoa.slice(1).filter(rw => { const p = P.find(x => x.name === rw[1]); return !p || rw[4] !== (o[p.id] || {}).pts || rw[2] !== pj[p.id]; }).length;
    r.assert(wb && aoa.length - 1 === Object.keys(o).length && xlBad === 0, `${label}: el Excel de partidos tiene una fila por jugadora con sus puntos y PJ correctos`);
  };
  const recordOf = mids => mids.reduce((t, id) => { const m = win.mById("t1", id); const res = win.mResult(m); t[res] = (t[res] || 0) + 1; t.pf += win.mOurScore(m); t.pa += win.mTheirScore(m); return t; }, { pf: 0, pa: 0 });
  // Sin temporadas archivadas: todo junto, como siempre
  checkAgg(["a1", "a2", "a3", "b1", "b2", "b3", "b4"], "Sin archivar");
  let st = win.mSeasonStats("t1"), rec = recordOf(["a1", "a2", "a3", "a4", "b1", "b2", "b3", "b4"]);
  r.assert(st.total === 8 && st.pf === rec.pf && st.pa === rec.pa && st.w === (rec.W || 0) && st.l === (rec.L || 0), "Sin archivar: balance V-D y puntos a favor/en contra de todos los partidos");
  // Archivar la temporada A
  const ar = win.archiveSeason("Temporada A", d(-100));
  r.assert(ar.ok, "Archivar la temporada pasada");
  checkAgg(["b1", "b2", "b3", "b4"], "Temporada actual (B-SEASON5)");
  st = win.mSeasonStats("t1"); rec = recordOf(["b1", "b2", "b3", "b4"]);
  r.assert(st.total === 4 && st.pf === rec.pf && st.pa === rec.pa, "B-SEASON5: el balance V-D de la lista de partidos es solo de la temporada actual");
  win.S.statsSeason = win.S.cfg.seasons[0].id;
  checkAgg(["a1", "a2", "a3"], "Temporada archivada");
  win.S.statsSeason = "all";
  checkAgg(["a1", "a2", "a3", "b1", "b2", "b3", "b4"], "Todo el historial");
  win.S.statsSeason = "current";
  win.navTo("stats", { teamId: "t1" }); win.S.statsView = "matches"; win.render();
  r.assert(!!doc.querySelector('select[aria-label="Temporada"]'), "B-SEASON5: la pestaña Partidos tiene selector de temporada");
  win._statsSetSeason(win.S.cfg.seasons[0].id);
  r.assert(/estás viendo sus partidos/.test(doc.getElementById("root").textContent), "B-SEASON5: avisa cuando se ve una temporada archivada");
  win.navTo("matchList", { teamId: "t1" });
  r.assert(/Balance de la temporada actual/.test(doc.getElementById("root").textContent), "B-SEASON5: la lista de partidos dice que el balance es de la temporada actual");
  r.assert(win.S.matches.t1.length === 8, "Archivar no borra ningún partido");
  return r.summary();
}
module.exports = { run };
if (require.main === module) run().then(({ failed }) => process.exit(failed ? 1 : 0));
