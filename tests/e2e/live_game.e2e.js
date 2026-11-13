"use strict";
// v3.0.0-dev.120 · Partido en directo COMPLETO a nivel usuario (Chromium a
// tamaño móvil, pulsando los botones reales). Mario: "pruebas los partidos en
// directo, todo". Empieza el partido desde Hoy, juega ~120 jugadas al azar
// (canastas, fallos, rebotes, asistencias, robos, tapones, pérdidas, faltas de
// todo tipo con sus tiros libres, puntos y faltas del rival, cambios, tiempos
// muertos, deshacer), resuelve cada ventana que aparezca como lo haría un
// entrenador, pasa los 4 cuartos con el reloj (y la prórroga si hay empate) y
// cierra el partido. Después de CADA jugada comprueba que todo cuadra:
//   - marcador = suma de los puntos de las jugadoras (y del registro)
//   - 5 en pista, sin repetidas, todas convocadas y ninguna descalificada
//   - ninguna estadística negativa
// Al final abre resumen, detalle, estadísticas y descarga los PDF/Excel.
// Todo en local: nunca toca Firebase. Uso: node e2e/live_game.e2e.js [dispositivo] [semilla]
const { openApp } = require("./_server.js");
const fs = require("fs"), os = require("os"), path = require("path");
let seed = parseInt(process.argv[3] || "7", 10);
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const pick = a => a[Math.floor(rnd() * a.length)];

(async () => {
  const { page, errors, close } = await openApp(process.argv[2] || "Pixel 7");
  const problems = [], modalsSeen = {};
  const bad = (m) => { if (problems.length < 40) problems.push(m); };
  await page.evaluate(() => {
    const today = td();
    S.cfg.features = Object.assign({}, S.cfg.features, { chainPrompt: true });
    S.teams = [{ id: "t1", name: "CADETE", category: "Cadete", color: "#F06318", order: 0 }];
    S.players = { t1: Array.from({ length: 10 }, (_, i) => ({ id: "p" + i, name: "Jugadora " + (i + 1), number: i + 4 })) };
    const conv = S.players.t1.map(p => p.id);
    S.matches = { t1: [{ id: "m1", date: today, time: "18:00", rival: "CB Rival", location: "home", quarters: 4, qMins: 10, stopOnFoul: true, matchMode: "live", convocados: conv, titulares: conv.slice(0, 5), capitan: conv[0], rivalPlayers: [], countsForAttendance: true }] };
    save(); navRoot("hoy");
  });
  await page.click('.tl-row button:has-text("Empezar partido")');
  await page.click("#m-confirm button >> nth=0");
  await page.waitForTimeout(300);
  if (await page.evaluate(() => S.screen) !== "liveGame") bad("no se entra al directo desde Hoy");

  // Resuelve las ventanas que salgan tras una jugada, como lo haría un entrenador
  const resolve = async () => {
    await page.waitForTimeout(350); // algunas ventanas (rebote, tiros libres) se abren con un pequeño retraso
    // Descanso entre cuartos: el entrenador lo salta para seguir anotando
    await page.evaluate(() => { const b = document.querySelector("#break-overlay [onclick*='break-overlay']"); if (b) b.click(); });
    for (let i = 0; i < 10; i++) {
      const top = await page.evaluate(() => {
        const ms = [...document.querySelectorAll("body > div[id^='m-']")].filter(d => d.offsetParent !== null || getComputedStyle(d).display !== "none");
        const d = ms[ms.length - 1]; if (!d) return null;
        const btns = [...d.querySelectorAll("button,[onclick]")].filter(b => b.offsetParent !== null && !b.disabled && getComputedStyle(b).pointerEvents !== "none")
          .map((b, k) => ({ k, oc: b.getAttribute("onclick") || "", tx: (b.innerText || "").replace(/\s+/g, " ").trim().slice(0, 40), cls: b.className || "" }));
        return { id: d.id, text: (d.innerText || "").replace(/\s+/g, " ").slice(0, 80), btns };
      });
      if (!top) return;
      modalsSeen[top.id] = (modalsSeen[top.id] || 0) + 1;
      const B = top.btns;
      const players = B.filter(b => /_pick|Pid|pid|\('p\d+'/.test(b.oc) && !/remove\(\)$/.test(b.oc));
      const none = B.filter(b => /^(Sin|Nadie|No|Ninguno|Saltar|Omitir|Sin asistencia|Sin rebote)/i.test(b.tx));
      const confirm = B.filter(b => /btn-p/.test(b.cls) || /^(Confirmar|Guardar|Aceptar|Listo|Continuar|Sí|Si,|Cambiar|Terminar|Fin)/i.test(b.tx));
      const counts = B.filter(b => /^[0-3]$/.test(b.tx));
      // Botones que terminan cada ventana (como haría un entrenador tras
      // hacer lo que quería en ella): reanudar tras tiempo muerto, empezar
      // el descanso de fin de cuarto, confirmar tiros libres...
      const enders = B.filter(b => /_resumeFromTm\(|_eopStartBreak\(|confirm[A-Z]\w*\(|save[A-Z]\w*\(|_convFinish/.test(b.oc) || /-confirm$/.test(b.cls));
      let ch = null;
      if (enders.length && (i >= 2 || /m-tm-overlay|m-end-period/.test(top.id) && rnd() < 0.7)) ch = enders[0];
      else if (counts.length && rnd() < 0.9) ch = pick(counts);
      else if (players.length && rnd() < 0.7) ch = pick(players);
      else if (none.length) ch = pick(none);
      else if (confirm.length) ch = confirm[0];
      else if (players.length) ch = pick(players);
      else ch = B.find(b => !/Cancelar|Pausar|✕|remove\(\)/.test(b.tx + b.oc)) || B[0];
      if (!ch) { await page.evaluate(id => document.getElementById(id)?.remove(), top.id); continue; }
      if (process.env.TRACE) console.log(`    [${top.id}] «${ch.tx}» ${ch.oc.slice(0, 60)}`);
      await page.evaluate(([id, k]) => { const d = document.getElementById(id); const b = [...d.querySelectorAll("button,[onclick]")].filter(b => b.offsetParent !== null && !b.disabled && getComputedStyle(b).pointerEvents !== "none")[k]; b && b.click(); }, [top.id, ch.k]);
      await page.waitForTimeout(60);
    }
    // si después de 10 pasos sigue habiendo una ventana, se apunta
    const left = await page.evaluate(() => [...document.querySelectorAll("body > div[id^='m-']")].map(d => d.id));
    if (left.length) { bad("ventana que no se cierra tras 10 pasos: " + left.join(",")); await page.evaluate(() => document.querySelectorAll("body > div[id^='m-']").forEach(d => d.remove())); }
  };

  const invariants = async (ctx) => {
    const r = await page.evaluate(() => {
      const m = mById("t1", "m1"); const L = m.live; const out = [];
      if (!L) return ["no hay m.live"];
      const st = L.stats || {};
      let pts = 0; Object.values(st).forEach(s => { pts += (s.p1m || 0) + 2 * (s.p2m || 0) + 3 * (s.p3m || 0); Object.entries(s).forEach(([k, v]) => { if (typeof v === "number" && v < 0) out.push("estadística negativa " + k + "=" + v); }); });
      const our = (L.qScores || []).reduce((a, q) => a + ((q && q[0]) || 0), 0);
      const teamPts = (L.teamStats && ((L.teamStats.p1m || 0) + 2 * (L.teamStats.p2m || 0) + 3 * (L.teamStats.p3m || 0))) || 0;
      if (our !== pts + teamPts) out.push(`marcador propio ${our} ≠ puntos de las jugadoras ${pts}${teamPts ? " + equipo " + teamPts : ""}`);
      const oc = L.onCourt || [];
      // Menos de 5 solo es válido si TODO el banquillo está descalificado
      // (FIBA: el equipo sigue jugando con las que le quedan).
      const benchOk = (m.convocados || []).filter(pid => !oc.includes(pid)).every(pid => typeof _isDQ === "function" && _isDQ((L.stats || {})[pid]));
      if (oc.length > 5 || (oc.length < 5 && !benchOk)) out.push("en pista hay " + oc.length + " jugadoras");
      if (new Set(oc).size !== oc.length) out.push("jugadora repetida en pista");
      oc.forEach(pid => { if (!(m.convocados || []).includes(pid)) out.push("en pista una no convocada " + pid); if (typeof _isDQ === "function" && _isDQ(m, pid)) out.push("descalificada en pista " + pid); });
      (L.qScores || []).forEach((q, i) => { if (q && (q[0] < 0 || q[1] < 0)) out.push("marcador negativo en el periodo " + (i + 1)); });
      const hdr = document.getElementById("root").innerText;
      if (/NaN|undefined/.test(hdr)) out.push("texto roto en pantalla");
      return out;
    });
    r.forEach(x => bad(ctx + ": " + x));
  };

  const ACTIONS = ["p2m", "p2m", "p3m", "p1m", "p2a", "p2a", "p3a", "p1a", "ro", "rd", "rd", "ast", "stl", "blk", "to", "foul", "foul", "ftech", "funsport"];
  let n = 0;
  const play = async (count) => {
    for (let i = 0; i < count; i++) {
      n++;
      await resolve(); // ventanas que aparecen con retraso (p.ej. tiros libres del rival)
      const r = rnd();
      let what;
      if (r < 0.70) { what = pick(ACTIONS); const pts = { p2m: 2, p3m: 3, p1m: 1 }[what] || 0; await page.click(`[onclick="openActionPicker('${what}',${pts})"]`, { timeout: 3000 }).catch(async () => bad("no se puede pulsar " + what + " -- tapado por: " + await page.evaluate((w) => { const b = document.querySelector(`[onclick^="openActionPicker('${w}'"]`); if (!b) return "no existe el botón"; const r = b.getBoundingClientRect(); const e = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return e ? (e.closest("[id]")?.id || e.className || e.tagName) : "nada"; }, what))); }
      else if (r < 0.80) { what = "rival+"; await page.click('[onclick="rivalScoreLive(1)"]', { timeout: 3000 }).catch(() => bad("no se puede pulsar +1 rival")); }
      else if (r < 0.85) { what = "falta rival"; await page.click('[onclick="rivalFoulLive(1)"]', { timeout: 3000 }).catch(() => bad("no se puede pulsar falta rival")); }
      else if (r < 0.92) { what = "cambio"; const subs = await page.$$('[onclick^="openSubModal("]'); if (subs.length) await pick(subs).click({ timeout: 3000 }).catch(() => bad("no se puede pulsar cambio")); }
      else if (r < 0.95) { what = "deshacer"; await page.click('[onclick="undoLiveAction()"]', { timeout: 3000 }).catch(() => {}); }
      else { what = "tiempo muerto"; await page.click('[onclick="openTimeoutModal()"] >> nth=0', { timeout: 3000 }).catch(() => {}); }
      await page.waitForTimeout(40);
      await resolve();
      if (process.env.TRACE) console.log(`#${n} ${what} → pista ${JSON.stringify(await page.evaluate(() => mById("t1", "m1").live.onCourt))}`);
      await invariants(`jugada ${n} (${what})`);
    }
  };
  const endQuarter = async (q) => {
    await resolve();
    await page.evaluate(() => { const m = mById("t1", "m1"); m.live.clockSec = 1; save(); render(); });
    await page.click('[onclick="toggleClock()"] >> nth=0', { timeout: 3000 }).catch(() => bad("no se puede pulsar el reloj"));
    await page.waitForTimeout(2600);
    await resolve();
    const now = await page.evaluate(() => mById("t1", "m1").live.q);
    if (now !== q + 1) bad(`al acabar el reloj del cuarto ${q} el partido sigue en el ${now}`);
  };
  for (let q = 1; q <= 4; q++) { await play(30); if (q < 4) await endQuarter(q); }
  // final: empate → prórroga
  const tie = await page.evaluate(() => { const L = mById("t1", "m1").live; const o = L.qScores.reduce((a, q) => a + q[0], 0), r = L.qScores.reduce((a, q) => a + q[1], 0); return [o, r]; });
  await page.screenshot({ path: path.join(os.tmpdir(), "kortline_live_end.png"), fullPage: true });
  await resolve();
  await page.click(`[onclick="_finishAndShowSummary('t1','m1')"]`, { timeout: 3000 }).catch(() => bad("no se puede pulsar 🏁 terminar"));
  await page.waitForTimeout(200);
  await resolve();
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => ({ screen: S.screen, finished: !!mById("t1", "m1").finished, q: mById("t1", "m1").q, res: mResult(mById("t1", "m1")), text: document.getElementById("root").innerText.slice(0, 400) }));
  if (!after.finished) bad("el partido no queda como terminado tras 🏁 (pantalla " + after.screen + ")");
  if (/NaN|undefined/.test(after.text)) bad("resumen con texto roto");
  const exp = (tie[0] > tie[1] ? "W" : tie[0] < tie[1] ? "L" : "D");
  if (after.res && exp !== "D" && after.res !== exp) bad(`resultado ${after.res} pero el marcador es ${tie[0]}-${tie[1]}`);
  // detalle, estadísticas y descargas
  const downloads = [];
  page.on("download", async d => { const f = path.join(os.tmpdir(), "kortline_" + Date.now() + "_" + d.suggestedFilename()); await d.saveAs(f); downloads.push(f); });
  for (const [scr, o] of [["matchDetail", { teamId: "t1", matchId: "m1" }], ["matchSummary", { teamId: "t1", matchId: "m1" }], ["stats", { teamId: "t1", statsView: "table" }], ["stats", { teamId: "t1", statsView: "matches" }], ["stats", { teamId: "t1", statsView: "team" }]]) {
    await page.evaluate(([s, o]) => { Object.assign(S, o); S.screen = s; render(); }, [scr, o]);
    await page.waitForTimeout(150);
    const t = await page.evaluate(() => document.getElementById("root").innerText);
    if (/NaN|undefined|Infinity/.test(t)) bad(scr + " " + JSON.stringify(o) + ": texto roto");
  }
  for (const fn of ["exportMatchStatsPDF", "exportPDF", "exportExcel", "exportMatchesPDF", "exportMatchesExcel", "exportTeamKPIsPDF", "exportTeamKPIsExcel"]) {
    await page.evaluate(fn => { try { S.teamId = "t1"; S.matchId = "m1"; window[fn](); } catch (e) { window.__expErr = (window.__expErr || "") + fn + ": " + e.message + " | "; } }, fn);
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(1500);
  const expErr = await page.evaluate(() => window.__expErr || "");
  if (expErr) bad("exportación con error: " + expErr);
  const final = await page.evaluate(() => { const L = mById("t1", "m1").live; return { log: L.log.length, our: L.qScores.reduce((a, q) => a + q[0], 0), riv: L.qScores.reduce((a, q) => a + q[1], 0), maxQ: L.maxQ }; });
  await close();
  console.log(`Jugadas: ${n} · registro: ${final.log} · marcador final ${final.our}-${final.riv} · periodos ${final.maxQ} · descargas: ${downloads.length}`);
  console.log("Ventanas resueltas: " + JSON.stringify(modalsSeen));
  console.log("Descargas: " + downloads.map(f => path.basename(f)).join(", "));
  fs.writeFileSync(path.join(os.tmpdir(), "kortline_live_downloads.json"), JSON.stringify(downloads));
  errors.forEach(e => problems.push("ERROR JS " + e));
  console.log(problems.length ? "PROBLEMAS:\n - " + problems.join("\n - ") : "SIN PROBLEMAS");
  process.exit(problems.length ? 1 : 0);
})();
