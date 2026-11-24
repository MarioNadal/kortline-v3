"use strict";
// v3.0.0-dev.128 · B-TLDQ1: Mario -- "Unai tenía que tirar tiros libres pero
// es expulsado por técnica: debe ser cambiado primero y el que entra tira
// los tiros libres; y eso puede pasar también si se ha lesionado".
const { loadApp, newReporter } = require("./harness.js");
const wait = ms => new Promise(r => setTimeout(r, ms));
async function run() {
  const r = newReporter("tl_shooter_dq_injury");
  const win = await loadApp(); const doc = win.document;
  const $ = id => doc.getElementById(id);
  const setup = (benchDQ) => {
    doc.querySelectorAll("body > div[id^='m-']").forEach(x => x.remove());
    win._pendingDQSubs = []; win._tlPaused = null;
    win.S.cfg.features = Object.assign({}, win.S.cfg.features, { chainPrompt: false });
    win.S.teams = [{ id: "t1", name: "JUNIOR", category: "Junior" }];
    win.S.players = { t1: ["Unai", "Pablo", "Hugo", "Leo", "Mario", "Iker", "Dani"].map((n, i) => ({ id: "p" + i, name: n, number: 4 + i })) };
    const conv = win.S.players.t1.map(p => p.id);
    win.S.matches = { t1: [{ id: "m1", date: win.td(), rival: "CB R", location: "home", quarters: 4, qMins: 10, matchMode: "live", convocados: conv, titulares: conv.slice(0, 5), rivalPlayers: [] }] };
    win.save(); win.navTo("liveGame", { teamId: "t1", matchId: "m1" });
    const m = win.mById("t1", "m1");
    if (benchDQ) ["p5", "p6"].forEach(id => { m.live.stats[id] = Object.assign(m.live.stats[id] || {}, { foul: 5 }); });
    return m;
  };
  const ptsOf = (m, id) => (m.live.stats[id] || {}).p1m || 0;
  // ── A) Unai va a tirar 2 TL, se pausa, le pitan su 2ª técnica (descalificado)
  let m = setup();
  win.openOurFoulTLModal(null, "foul"); win.selectOurTLShooter("p0"); win.setOurTLCount(2); win.confirmOurTL();
  r.assert(!!$("m-ourtlshoot") && $("m-ourtlshoot")._pid === "p0", "A: se abre la ventana de tiros libres de Unai");
  win._pauseTLModal("m-ourtlshoot");
  m.live.stats.p0 = Object.assign(m.live.stats.p0 || {}, { ftech1: 2 }); win._enqueueDQSub("p0", false);
  r.assert(!!$("m-dqsub"), "A: el cambio por descalificación sale YA, sin esperar a los tiros libres (en pausa)");
  $("m-dqsub").querySelector("button[onclick*=\"_doDQSub('p5'\"]").click(); await wait(10);
  r.assert(!m.live.onCourt.includes("p0") && m.live.onCourt.includes("p5"), "A: Unai sale e Iker entra");
  r.assert($("m-ourtlshoot")._pid === "p5" && /Iker/.test($("m-ourtlshoot").querySelector(".msub").textContent), "A: los tiros libres pasan a Iker (y lo pone en la ventana)");
  win._resumeTLModal(); win.setOurTLResult(0, true); win.setOurTLResult(1, true);
  $("ourtl-shoot-confirm").click();
  r.assert(ptsOf(m, "p5") === 2 && ptsOf(m, "p0") === 0, "A: los 2 puntos se los apunta Iker, no Unai");
  r.assert(m.live.qScores[0][0] === 2 && (m.live.onCourt || []).length === 5, "A: marcador 2 y 5 en pista");
  // ── B) Lesión: se pausa el TL y se cambia a Unai a mano
  m = setup();
  win.openOurFoulTLModal(null, "foul"); win.selectOurTLShooter("p0"); win.setOurTLCount(2); win.confirmOurTL();
  win._pauseTLModal("m-ourtlshoot");
  win.subPlayer("p6", "p0");
  r.assert($("m-ourtlshoot")._pid === "p6", "B: lesionado → los tiros libres pasan a quien entra (Dani)");
  win._resumeTLModal(); win.setOurTLResult(0, true); $("ourtl-shoot-confirm").click();
  r.assert(ptsOf(m, "p6") === 1 && ptsOf(m, "p0") === 0, "B: el punto es de Dani");
  // ── C) Antes de elegir tirador (ventana "¿quién la recibió?") ya seleccionado
  m = setup();
  win.openOurFoulTLModal(null, "foul"); win.selectOurTLShooter("p0"); win.setOurTLCount(2);
  win._pauseTLModal("m-ourtl");
  m.live.stats.p0 = Object.assign(m.live.stats.p0 || {}, { fdq: 1 }); win._enqueueDQSub("p0", false);
  $("m-dqsub").querySelector("button[onclick*=\"_doDQSub('p5'\"]").click(); await wait(10);
  r.assert($("m-ourtl")._pid === "p5" && !$("m-ourtl")._fromBench, "C: en la ventana de la falta, la seleccionada pasa a ser quien entra (ya en pista)");
  win._resumeTLModal(); win.confirmOurTL();
  r.assert($("m-ourtlshoot") && $("m-ourtlshoot")._pid === "p5" && (m.live.onCourt || []).length === 5, "C: tira Iker, sin cambios de más (5 en pista)");
  // ── D) Banquillo agotado: hay que elegir quién tira entre las de pista
  m = setup(true);
  win.openOurFoulTLModal(null, "foul"); win.selectOurTLShooter("p0"); win.setOurTLCount(2); win.confirmOurTL();
  win._pauseTLModal("m-ourtlshoot");
  m.live.stats.p0 = Object.assign(m.live.stats.p0 || {}, { ftech1: 2 }); win._enqueueDQSub("p0", false);
  $("m-dqsub").querySelector("button[onclick*=\"_doDQSub(null\"]").click(); await wait(10);
  r.assert(!!$("m-ourtl-pick"), "D: sin banquillo, pregunta quién tira de las que siguen en pista");
  r.assert(![...$("m-ourtl-pick").querySelectorAll("button")].some(b => b.textContent.includes("Unai")), "D: Unai (descalificado) no se ofrece");
  win._ourTLSetShooter("p1"); win._resumeTLModal(); win.setOurTLResult(0, true); win.setOurTLResult(1, true); $("ourtl-shoot-confirm").click();
  r.assert(ptsOf(m, "p1") === 2 && ptsOf(m, "p0") === 0 && m.live.onCourt.length === 4, "D: tira Pablo, 4 en pista (banquillo agotado)");
  // ── E) Sin pausa: un cambio normal que no es de la tiradora no cambia nada
  m = setup();
  win.openOurFoulTLModal(null, "foul"); win.selectOurTLShooter("p0"); win.setOurTLCount(1); win.confirmOurTL();
  win._pauseTLModal("m-ourtlshoot"); win.subPlayer("p6", "p3");
  r.assert($("m-ourtlshoot")._pid === "p0", "E: cambiar a otra jugadora no toca a la tiradora");
  win._resumeTLModal(); win.setOurTLResult(0, true); $("ourtl-shoot-confirm").click();
  r.assert(ptsOf(m, "p0") === 1, "E: Unai tira y anota su punto");
  // ── F) Una ventana de TL VISIBLE (no en pausa) sigue bloqueando el cambio forzoso
  m = setup();
  win.openOurFoulTLModal(null, "foul");
  m.live.stats.p2 = Object.assign(m.live.stats.p2 || {}, { foul: 5 }); win._enqueueDQSub("p2", false);
  r.assert(!$("m-dqsub"), "F: con la ventana de TL abierta (no en pausa) el cambio espera a que se cierre, como antes");
  $("m-ourtl").remove(); await wait(700);
  r.assert(!!$("m-dqsub"), "F: al cerrar la ventana, sale el cambio forzoso");
  // ── G) Caso real completo: con el TL de Unai en pausa se anota su 2ª técnica
  // con el botón del directo (que abre los TL del rival por la técnica).
  m = setup();
  win.openOurFoulTLModal(null, "foul"); win.selectOurTLShooter("p0"); win.setOurTLCount(2); win.confirmOurTL();
  win._pauseTLModal("m-ourtlshoot");
  m.live.stats.p0 = Object.assign(m.live.stats.p0 || {}, { ftech1: 1 });
  win.liveAction("p0", "ftech1", 0); await wait(50);
  const rivalTL = [...doc.querySelectorAll("body > div[id^='m-']")].filter(d => d.id !== "m-ourtlshoot" && d.id !== "m-dqsub" && d.id !== "m-tl-resume-banner" && d.style.display !== "none").map(d => d.id);
  r.assert(win._isDQ(m.live.stats.p0), "G: con la 2ª técnica Unai queda descalificado");
  rivalTL.forEach(id => $(id) && $(id).remove()); await wait(700);
  r.assert(!!$("m-dqsub"), `G: tras los TL del rival (${rivalTL.join(",") || "ninguno"}) sale el cambio de Unai antes de sus tiros libres`);
  $("m-dqsub").querySelector("button[onclick*=\"_doDQSub('p5'\"]").click(); await wait(10);
  r.assert($("m-ourtlshoot")._pid === "p5", "G: los tiros libres pasan a Iker");
  win._resumeTLModal(); win.setOurTLResult(0, true); $("ourtl-shoot-confirm").click();
  r.assert(ptsOf(m, "p5") === 1 && ptsOf(m, "p0") === 0 && !m.live.onCourt.includes("p0"), "G: anota Iker y Unai ya no está en pista");
  return r.summary();
}
module.exports = { run };
if (require.main === module) run().then(({ failed }) => process.exit(failed ? 1 : 0));
