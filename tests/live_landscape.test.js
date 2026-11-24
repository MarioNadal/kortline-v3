"use strict";
// v3.0.0-dev.129 · B-LIVELS1: directo en horizontal (mesa de anotación,
// opción A elegida por Mario). Usa las MISMAS funciones de siempre, así que
// aquí se comprueba sobre todo que cada toque llega a la función correcta y
// al equipo correcto.
const { loadApp, newReporter } = require("./harness.js");
const wait = ms => new Promise(r => setTimeout(r, ms));
async function run() {
  const r = newReporter("live_landscape");
  const win = await loadApp(); const doc = win.document;
  const $ = id => doc.getElementById(id), root = () => $("root");
  const clear = () => doc.querySelectorAll("body > div[id^='m-']").forEach(x => x.remove());
  const land = () => { win.innerWidth = 844; win.innerHeight = 390; };
  const port = () => { win.innerWidth = 390; win.innerHeight = 844; };
  const setup = (o) => {
    o = o || {}; clear(); win._lsSel = null; win.eval("_lsSel=null");
    win.S.cfg.features = Object.assign({}, win.S.cfg.features, { chainPrompt: o.chain !== false });
    win.S.teams = [{ id: "t1", name: "JUNIOR", category: "Junior", color: "#F06318" }];
    win.S.players = { t1: Array.from({ length: 8 }, (_, i) => ({ id: "p" + i, name: "Jug " + i, number: 4 + i })) };
    const conv = win.S.players.t1.map(p => p.id);
    const rp = o.rivals ? Array.from({ length: 7 }, (_, i) => ({ id: "r" + i, name: "Riv " + i, number: 20 + i })) : [];
    win.S.matches = { t1: [Object.assign({ id: "m1", date: win.td(), rival: "CB Huesca", location: "home", quarters: 4, qMins: 10, matchMode: "live", convocados: conv, titulares: conv.slice(0, 5), rivalPlayers: rp, rivalStatsEnabled: !!o.rivals }, o.m || {})] };
    win.save(); land(); win.navTo("liveGame", { teamId: "t1", matchId: "m1" });
    return win.mById("t1", "m1");
  };
  const ours = m => m.live.qScores.reduce((a, q) => a + ((q && q[0]) || 0), 0);
  const theirs = m => m.live.qScores.reduce((a, q) => a + ((q && q[1]) || 0), 0);
  // 1) Estructura
  let m = setup();
  r.assert(!!root().querySelector(".lsg"), "Horizontal: sale la mesa de anotación");
  r.assert(root().querySelectorAll(".ls-side")[0].querySelectorAll(".ls-tile:not(.team)").length === 5, "Horizontal: los 5 en pista de tu equipo");
  r.assert(root().querySelectorAll(".ls-side")[0].querySelectorAll(".ls-bench button").length === 3, "Horizontal: el banquillo en fila (3)");
  r.assert(root().querySelectorAll(".ls-side")[1].querySelectorAll(".ls-tile.team.big").length === 1 && root().querySelectorAll(".ls-side")[1].querySelectorAll(".ls-tile:not(.team)").length === 0, "Rival sin plantilla: un cuadrado grande de equipo");
  r.assert(!!$("live-clock") && !!$("live-clock-btn"), "Horizontal: reloj con los mismos ids (el cronómetro lo actualiza solo)");
  r.assert(!root().querySelector(".live-stats-wrap") && !/Gira el móvil/.test(root().textContent), "Horizontal: ni tabla a pantalla completa ni aviso de girar");
  // 2) Jugadora → acción
  win._lsSelect("our", "p0");
  r.assert(root().querySelector(".ls-tile.sel") && /Jug 0|J\. 0|Jug/.test(root().querySelector(".ls-hint").textContent), "Al tocar una jugadora queda marcada");
  win._lsAct("p2m", 2); await wait(300);
  r.assert(m.live.stats.p0.p2m === 1 && ours(m) === 2, "Jugadora + '+2': 2 puntos para ella y para el equipo");
  r.assert(!!$("m-chainast"), "Igual que siempre: pregunta quién dio la asistencia");
  clear();
  r.assert(!root().querySelector(".ls-tile.sel"), "Tras anotar se quita la selección");
  // 3) Sin elegir a nadie: pregunta quién (como en vertical)
  win._lsAct("p3m", 3);
  r.assert(!!$("m-actpicker"), "Acción sin jugadora: sale el '¿Quién?' de siempre");
  clear();
  // 4) Cuadrado del rival (equipo)
  win._lsSelect("rival", "team"); win._lsAct("p3m", 3);
  r.assert(theirs(m) === 3 && ours(m) === 2, "Equipo rival + '+3': 3 puntos al rival");
  r.assert(m.live.activeTeam === "our", "Después se vuelve al lado propio");
  win._lsSelect("rival", "team"); win._lsAct("foul", 0); await wait(200);
  r.assert(((m.live.rivalFouls || [])[0] || 0) === 1 && !!$("m-ourtl"), "Falta del equipo rival: cuenta su falta y abre nuestros tiros libres");
  clear();
  // 5) Falta nuestra → TL del rival (mismo flujo de siempre)
  win._lsSelect("our", "p1"); win._lsAct("funsport", 0); await wait(200);
  r.assert((m.live.stats.p1.funsport || 0) === 1 && [...doc.querySelectorAll("body > div[id^='m-']")].length > 0, "Antideportiva nuestra: se apunta y salen los tiros libres del rival");
  clear();
  // 6) Rival con plantilla: jugadores + cuadrado de equipo siempre
  m = setup({ rivals: true });
  const rs = root().querySelectorAll(".ls-side")[1];
  r.assert(rs.querySelectorAll(".ls-tile:not(.team)").length === 5 && rs.querySelectorAll(".ls-tile.team").length === 1 && rs.querySelectorAll(".ls-bench button").length === 2, "Rival con plantilla: sus 5, su banquillo y SIEMPRE el cuadrado de equipo");
  win._lsSelect("rival", "r0"); win._lsAct("p2m", 2); await wait(300);
  r.assert(m.live.rivalStats.r0.p2m === 1 && theirs(m) === 2 && !$("m-chainast"), "Jugador rival + '+2': para él, sin preguntar asistencias de nuestro equipo");
  win._lsSelect("rival", "team"); win._lsAct("p1m", 1);
  r.assert(theirs(m) === 3, "Y el cuadrado de equipo sigue sumando al rival");
  // 7) Fuera de casa: nuestro equipo a la derecha
  m = setup({ m: { location: "away" } });
  r.assert(/JUNIOR/.test(root().querySelectorAll(".ls-side")[1].textContent) && /CB Huesca/.test(root().querySelectorAll(".ls-side")[0].textContent), "Jugando fuera: el local (rival) a la izquierda, nosotros a la derecha");
  win._lsSelect("our", "p0"); win._lsAct("p2m", 2); clear();
  r.assert(ours(m) === 2 && m.q[1] === 2, "Jugando fuera: los puntos van a nuestro marcador (visitante)");
  // 8) Reglamento FIBA 2026-27
  m = setup({ m: { fibaRules2026: true } });
  const acts = [...root().querySelectorAll(".ls-act")].map(b => b.textContent);
  r.assert(["TÉC-1", "TÉC-2", "DISR", "FLAGR.", "DESC"].every(x => acts.some(a => a.includes(x))), "Con reglamento 2026-27: TÉC-1, TÉC-2, DISR, FLAGR. y DESC");
  m = setup();
  const acts2 = [...root().querySelectorAll(".ls-act")].map(b => b.textContent);
  r.assert(["TÉC", "ANTID.", "DESC", "FALTA"].every(x => acts2.some(a => a.includes(x))), "Sin él: FALTA, TÉC, ANTID. y DESC");
  // 9) Solo equipo (sin jugadoras individuales)
  m = setup({ m: { teamOnlyStats: true } });
  r.assert(root().querySelectorAll(".ls-side")[0].querySelectorAll(".ls-tile.team.big").length === 1, "Modo solo equipo: tu equipo es un cuadrado grande");
  win._lsSelect("our", "team"); win._lsAct("p2m", 2); clear();
  r.assert(ours(m) === 2 && (m.live.teamAgg || {}).p2m === 1, "Modo solo equipo: suma al equipo");
  // 10) Mapa de tiro del rival: aunque se repinte en medio, va al rival
  m = setup({ m: { shotChart: true } });
  win._lsSelect("rival", "team"); win._lsAct("p2m", 2);
  r.assert(!!$("m-shotchart"), "Con mapa de tiro: se abre para el tiro del rival");
  win.render();
  win._confirmShot("rival-team", "p2m", 2, 0.5, 0.5); clear();
  r.assert(theirs(m) === 2 && ours(m) === 0, "Mapa de tiro: el tiro del rival suma al rival aunque la pantalla se repinte en medio");
  // 11) Modo ver
  m = setup();
  win.S.cfg.coaches = [{ id: "sa", name: "M", role: "superadmin", teamsEdit: [], teamsView: [] }, { id: "e", name: "L", role: "entrenador", teamsEdit: [], teamsView: ["t1"] }];
  win._setCurrentCoachId("e"); win.save(); land(); win.navTo("liveGame", { teamId: "t1", matchId: "m1" });
  r.assert(!root().querySelector(".ls-act") && !root().querySelector("[onclick*='_lsSelect']") && /Modo ver/.test(root().textContent), "Modo ver: se ve el partido pero no se puede anotar");
  win._lsAct("p2m", 2); r.assert(ours(m) === 0, "Modo ver: ni forzándolo");
  win.S.cfg.coaches = []; win._setCurrentCoachId(""); win.save();
  // 12) Vertical: se pide girar; "Seguir en vertical" se recuerda
  win.eval('localStorage.removeItem(_lsKey("cbj:liveVertical"))');
  m = setup(); port(); win.render();
  r.assert(!!$("live-rotate-prompt") && !root().querySelector(".lsg"), "En vertical: pide girar el móvil (horizontal por defecto)");
  win._lsChooseVertical(); win.render();
  r.assert(!$("live-rotate-prompt") && /BANQUILLO|Banquillo/.test(root().textContent), "'Seguir en vertical': se queda la pantalla vertical de siempre");
  win.render();
  r.assert(!$("live-rotate-prompt"), "Y no vuelve a preguntar en este móvil");
  return r.summary();
}
module.exports = { run };
if (require.main === module) run().then(({ failed }) => process.exit(failed ? 1 : 0));
