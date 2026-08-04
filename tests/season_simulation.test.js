"use strict";
// Simulacion de temporada realista de extremo a extremo: 16 entrenamientos
// (8 semanas x 2 dias) con asistencia variada, una lesion real, un jugador
// puntual que se une al ultimo entreno, un evento de tecnificacion, y 3
// partidos de tipos distintos (individual con rival, modo equipo con
// invitado, y en vivo). Comprueba que las pantallas de asistencia agregada
// (team/equiposScreen/statsHomeScreen) coinciden entre si, y que todos los
// textos para compartir (a padres, a entrenadores, convocatorias,
// resultados) salen coherentes y sin "undefined/NaN/null" colados.
const { loadApp, newReporter } = require("./harness");

function pad(n) { return String(n).padStart(2, "0"); }
function addDays(dateStr, n) {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
}

async function run() {
  const report = newReporter("season_simulation");
  const win = await loadApp();
  const assert = (cond, msg) => report.assert(cond, msg);
  const S = win.S;

  S.clubName = "CB Ejemplo";
  S.clubAbrev = "CBE";
  S.teams = [{
    id: "t1", name: "Cadete Masculino", color: "#F06318", category: "Cadete",
    coaches: ["Mario", "Laura"], schedule: { "1": "18:30", "3": "18:30" }
  }];
  const names = ["Ana García", "Bea López", "Cata Ruiz", "Dana Soto", "Eva Prat", "Fina Ortiz", "Gala Marín", "Hana Vidal", "Iris Costa", "Jana Reyes"];
  S.players = { t1: names.map((n, i) => ({ id: "p" + (i + 1), name: n, number: i + 4, addedAt: "2026-05-01" })) };
  S.sessions = {};
  S.matches = { t1: [] };
  S.events = { t1: [] };
  S.teamId = "t1";

  let d = "2026-06-02";
  const dates = [];
  for (let w = 0; w < 8; w++) { dates.push(addDays(d, w * 7)); dates.push(addDays(d, w * 7 + 2)); }
  dates.forEach((date, i) => {
    const sess = {};
    S.players.t1.forEach((p, pi) => {
      if (p.id === "p3" && i >= 4 && i <= 8) { sess[p.id] = "excused"; return; }
      if ((pi + i) % 7 === 0) sess[p.id] = "absent";
      else if ((pi + i) % 11 === 0) sess[p.id] = "late";
      else sess[p.id] = "present";
    });
    S.sessions["t1_" + date] = sess;
  });
  const lastTrainDate = dates[dates.length - 1];
  S.players.t1.push({ id: "g1", name: "Chaval Puntual", number: 77, addedAt: lastTrainDate, guest: true });
  S.sessions["t1_" + lastTrainDate].g1 = "present";

  S.events.t1.push({ id: "e1", tipo: "tecnificacion", titulo: "Tecnificación tiro", fecha: addDays(d, 10), hora: "17:00", convocados: [] });
  win._evtAutoSuggest("t1", "e1");

  S.matches.t1.push({
    id: "m1", rival: "Rival Individual", date: addDays(d, 14), time: "10:00", venue: "Pabellón Norte",
    location: "home", quarters: 4, qMins: 10, stopOnFoul: false, rivalStatsEnabled: true, teamOnlyStats: false,
    q: [18, 15, 12, 10, 20, 14, 16, 18], convocados: names.slice(0, 7).map((_, i) => "p" + (i + 1)),
    titulares: ["p1", "p2", "p3", "p4", "p5"], capitan: "p1", finished: true,
    rivalPlayers: [{ id: "r1", name: "Rival Uno", number: 4 }, { id: "r2", name: "Rival Dos", number: 7 }]
  });
  S.matches.t1.push({
    id: "m2", rival: "Rival Equipo", date: addDays(d, 21), time: "12:00", venue: "",
    location: "away", quarters: 4, qMins: 10, stopOnFoul: true, rivalStatsEnabled: true, teamOnlyStats: true,
    q: [22, 19, 14, 16, 18, 20, 15, 13], convocados: ["g1"], finished: true, rivalPlayers: []
  });

  // ── 1: las 3 pantallas de asistencia agregada deben coincidir entre si ──
  const teamHtml = win.team();
  const teamPct = (teamHtml.match(/Asistencia media<\/div>\s*<div[^>]*>(\d+)%/) || [])[1];
  const equiposPct = (win.equiposScreen().match(/(\d+)%<\/div>\s*<div[^>]*>Asist\./) || [])[1];
  S.teams.push({ id: "t2", name: "Otro Equipo", color: "#222", category: "Infantil", schedule: {} });
  S.players.t2 = [];
  const statsHomeHtml = win.statsHomeScreen();
  const statsHomeIdx = statsHomeHtml.indexOf("Cadete Masculino");
  const statsHomePct = (statsHomeHtml.slice(statsHomeIdx, statsHomeIdx + 400).match(/(\d+)%/) || [])[1];
  S.teams = S.teams.filter(t => t.id === "t1");
  delete S.players.t2;

  assert(!!teamPct, "team() muestra un % de asistencia media");
  assert(teamPct === equiposPct, `equiposScreen() coincide con team() (${teamPct}% vs ${equiposPct}%)`);
  assert(teamPct === statsHomePct, `statsHomeScreen() coincide con team() (${teamPct}% vs ${statsHomePct}%)`);

  // ── 2: textos para compartir -- sin basura, con los datos esperados ──
  const allTexts = [];
  const dayP = win.buildDailyText("t1", lastTrainDate, false, {});
  const dayI = win.buildDailyText("t1", lastTrainDate, true, {});
  const wkP = win.buildWeeklyText("t1", false, {});
  const evtTxt = win.buildEventoText("t1", "e1", {});
  const conv1 = win.mConvText("t1", "m1", false, {});
  const conv2 = win.mConvText("t1", "m2", false, {});
  allTexts.push(["buildDailyText (padres)", dayP], ["buildDailyText (interno)", dayI], ["buildWeeklyText", wkP], ["buildEventoText", evtTxt], ["mConvText m1", conv1], ["mConvText m2", conv2]);

  allTexts.forEach(([label, txt]) => {
    assert(typeof txt === "string" && txt.length > 0, `${label} genera texto no vacío`);
    assert(!/undefined|NaN|\bnull\b/.test(txt), `${label} no contiene undefined/NaN/null`);
  });

  assert(dayP.includes("Chaval Puntual"), "buildDailyText incluye al jugador puntual del último entreno");
  assert(dayP.includes("91%"), "buildDailyText calcula bien el % del día con el invitado incluido");
  assert(conv1.includes("Convocados (7)") && conv1.includes("🏆") && conv1.includes("66 — 57"), "mConvText de m1 (individual) muestra convocatoria y resultado correctos");
  assert(conv2.includes("Chaval Puntual") && conv2.includes("Convocados (1)"), "mConvText de m2 (modo equipo) refleja al invitado como único convocado");

  // ── 3: shareMatchResult para un partido finalizado y otro en modo equipo ──
  ["m1", "m2"].forEach(mid => {
    S.matchId = mid;
    win.shareMatchResult();
    const prev = win.document.getElementById("sr-prev");
    assert(!!prev && prev.textContent.length > 0, `shareMatchResult(${mid}) genera una vista previa`);
    assert(!/undefined|NaN|\bnull\b/.test(prev.textContent), `shareMatchResult(${mid}) no contiene undefined/NaN/null`);
    win.document.getElementById("m-share-result")?.remove();
  });
  const m1Text = (() => { S.matchId = "m1"; win.shareMatchResult(); const t = win.document.getElementById("sr-prev").textContent; win.document.getElementById("m-share-result")?.remove(); return t; })();
  assert(m1Text.includes("66  —  57") && m1Text.includes("VICTORIA"), "shareMatchResult(m1) calcula bien marcador y resultado");
  const m2Text = (() => { S.matchId = "m2"; win.shareMatchResult(); const t = win.document.getElementById("sr-prev").textContent; win.document.getElementById("m-share-result")?.remove(); return t; })();
  assert(m2Text.includes("68  —  69") && m2Text.includes("DERROTA"), "shareMatchResult(m2, modo equipo) calcula bien marcador y resultado sin plantilla rival");

  return report.summary();
}

module.exports = { run };
