"use strict";
// v3.0.0-dev.121 · B-MONTH1 (informe mensual) + B-REQ1 ("Pedir un cambio").
const { loadApp, newReporter } = require("./harness.js");
async function run() {
  const r = newReporter("month_report_and_requests");
  const win = await loadApp();
  const today = win.td(), ym = today.slice(0, 7), d = n => win._addDaysISO(today, n);
  win.S.teams = [{ id: "t1", name: "ALEVÍN", mvpHistory: [{ id: "v", date: ym + "-03", playerId: "p2" }] }, { id: "t2", name: "OTRO" }];
  win.S.players = { t1: Array.from({ length: 4 }, (_, i) => ({ id: "p" + i, name: "Jug " + i, number: i + 4, addedAt: d(-200) })), t2: [] };
  win.S.sessions = {};
  ["-02", "-04", "-06", "-09"].forEach((dd, k) => { const s = {}; win.S.players.t1.forEach((p, i) => { s[p.id] = i === 1 && k < 3 ? "absent" : "present"; }); win.S.sessions[win.sk("t1", ym + dd)] = s; });
  win.S.sessions[win.sk("t1", "1999-01-05")] = { p0: "absent" }; // otro mes: no cuenta
  win.S.matches = { t1: [{ id: "m1", date: ym + "-08", rival: "CB H", location: "away", quarters: 4, q: [8, 10, 9, 12, 10, 8, 11, 15], manualStats: { byQuarter: { 0: { p0: { p2m: 5, p1m: 2 } } } } }] };
  const dta = win._monthReportData("t1", ym);
  r.assert(dta.sess.length === 4, "B-MONTH1: cuenta solo los entrenamientos de ese mes (4)");
  const p1 = dta.rows.find(x => x.p.id === "p1");
  r.assert(p1 && p1.pct === 25, "B-MONTH1: % por jugadora (Jug 1: 1 de 4 = 25%)");
  r.assert(dta.avg === Math.round((100 * 3 + 25) / 4), "B-MONTH1: asistencia media del equipo");
  r.assert(dta.low.length === 1 && dta.low[0].p.id === "p1", "B-MONTH1: detecta quién está por debajo del umbral");
  const mm = dta.matches[0];
  r.assert(mm.ours === 45 && mm.theirs === 38 && mm.res === "W", "B-MONTH1: fuera de casa, el marcador se lee desde nuestro lado (45-38, victoria)");
  r.assert(dta.topScorers[0] && dta.topScorers[0].p.id === "p0" && dta.topScorers[0].pts === 12, "B-MONTH1: máxima anotadora del mes (12 puntos)");
  r.assert(dta.mvps.length === 1, "B-MONTH1: incluye el MVP del mes");
  const txt = win._monthReportText(dta);
  r.assert(/Informe de/.test(txt) && /Entrenamientos:\* 4/.test(txt) && /45-38/.test(txt) && !/undefined|NaN/.test(txt), "B-MONTH1: el texto para WhatsApp sale completo y sin textos rotos");
  win.S.teamId = "t1"; win.openMonthReportModal();
  r.assert(!!win.document.getElementById("mr-preview") && win.document.getElementById("mr-preview").textContent.length > 20, "B-MONTH1: la ventana del informe muestra la vista previa");
  const before = JSON.stringify({ s: win.S.sessions, m: win.S.matches, t: win.S.teams });
  win._monthReportData("t1", ym); win._monthReportText(dta);
  r.assert(JSON.stringify({ s: win.S.sessions, m: win.S.matches, t: win.S.teams }) === before, "B-MONTH1: el informe no cambia ningún dato");

  // B-REQ1
  win.S.cfg.coaches = [{ id: "sa", name: "Mario", role: "superadmin", teamsEdit: [], teamsView: [] }, { id: "e", name: "Laura", role: "entrenador", teamsEdit: ["t2"], teamsView: ["t1"] }];
  win._setCurrentCoachId("e");
  win.navTo("att", { teamId: "t1", date: today, attOpt: false });
  r.assert(!!win.document.querySelector(".ro-banner .ro-ask"), "B-REQ1: el aviso de Modo ver tiene el botón 'Pedir un cambio'");
  win.openChangeRequestModal();
  const pv = () => win.document.getElementById("req-preview").textContent;
  r.assert(/soy Laura/.test(pv()) && /darme permiso para \*editar\* el equipo \*ALEVÍN\*/.test(pv()), "B-REQ1: por defecto prepara la petición de permiso de edición, firmada");
  win.document.querySelector('input[name="req-type"][value="fix"]').checked = true;
  win.document.getElementById("req-detail").value = "Ana sí vino";
  win._refreshChangeReq();
  r.assert(/corregir un dato/.test(pv()) && /Ana sí vino/.test(pv()), "B-REQ1: corregir un dato, con el detalle escrito");
  r.assert(JSON.stringify({ s: win.S.sessions, m: win.S.matches, t: win.S.teams }) === before, "B-REQ1: pedir un cambio no escribe nada en los datos");
  return r.summary();
}
module.exports = { run };
if (require.main === module) run().then(({ failed }) => process.exit(failed ? 1 : 0));
