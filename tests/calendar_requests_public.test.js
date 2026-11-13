"use strict";
// v3.0.0-dev.122 · B-ICS1 (calendario .ics), B-REQ2 (bandeja de solicitudes),
// B-PUBLIC1 (marcador en directo para familias).
const { loadApp, newReporter } = require("./harness.js");
async function run() {
  const r = newReporter("calendar_requests_public");
  const win = await loadApp();
  const today = win.td(), d = n => win._addDaysISO(today, n);
  const wi = win._weekdayIdxForDate(d(1));
  win.S.teams = [{ id: "t1", name: "ALEVÍN, FEM; A", schedule: { [wi]: "18:30" }, optSchedules: { voluntario: {}, tecnificacion: {} } }, { id: "t2", name: "OTRO" }];
  win.S.players = { t1: [{ id: "p1", name: "Ana Secreta", number: 4 }, { id: "p2", name: "Bea Secreta", number: 5 }, { id: "p3", name: "Carla", number: 6 }, { id: "p4", name: "Dana", number: 7 }, { id: "p5", name: "Eva", number: 8 }], t2: [] };
  win.S.matches = { t1: [{ id: "m1", date: d(3), time: "11:00", rival: "CB Huesca", location: "away", quarters: 4, qMins: 10 }], t2: [] };
  win.S.sessions = {}; win.save();
  const before = JSON.stringify({ s: win.S.sessions, m: win.S.matches, t: win.S.teams, p: win.S.players });

  // ── ICS
  const items = win._calendarItems("t1", 2);
  r.assert(items.filter(x => /Entreno/.test(x.title)).length >= 2, "B-ICS1: los entrenos semanales salen cada semana");
  r.assert(items.some(x => /CB Huesca/.test(x.title) && x.date === d(3)), "B-ICS1: incluye el partido");
  const ics = win._buildICS("t1", 2).text;
  r.assert(/^BEGIN:VCALENDAR/.test(ics) && /END:VCALENDAR\s*$/.test(ics) && /BEGIN:VTIMEZONE/.test(ics), "B-ICS1: archivo .ics bien formado y con zona horaria");
  r.assert(/\r\n/.test(ics), "B-ICS1: usa saltos de línea CRLF (estándar)");
  r.assert(ics.includes("ALEVÍN" + String.fromCharCode(92) + ", FEM" + String.fromCharCode(92) + "; A"), "B-ICS1: escapa comas y puntos y coma del nombre");
  const uids = ics.match(/^UID:.*$/gm) || [];
  r.assert(uids.length === items.length && new Set(uids).size === uids.length, "B-ICS1: un UID único por evento (reimportar no duplica)");
  r.assert(/DTSTART;TZID=Europe\/Madrid:\d{8}T1830/.test(ics), "B-ICS1: hora del entreno correcta");
  r.assert(!/Secreta/.test(ics), "B-ICS1: no incluye nombres de jugadoras");

  // ── Solicitudes (modo local: localStorage)
  win.S.cfg.coaches = [{ id: "sa", name: "Mario", role: "superadmin", teamsEdit: [], teamsView: [] }, { id: "e", name: "Laura", role: "entrenador", teamsEdit: ["t2"], teamsView: ["t1"] }];
  win.save();
  win._setCurrentCoachId("e");
  win.navTo("att", { teamId: "t1", date: today, attOpt: false });
  win.openChangeRequestModal();
  r.assert(!!win.document.getElementById("req-send"), "B-REQ2: la ventana de petición tiene 'Enviar al superadmin'");
  win.sendChangeRequest();
  await new Promise(res => setTimeout(res, 20));
  let reqs = win._allRequests();
  r.assert(reqs.length === 1 && reqs[0].status === "pending" && reqs[0].fromCoachId === "e" && reqs[0].teamId === "t1" && reqs[0].type === "perm", "B-REQ2: la solicitud queda guardada como pendiente");
  win.openChangeRequestModal(); win.sendChangeRequest();
  await new Promise(res => setTimeout(res, 20));
  r.assert(win._allRequests().length === 1, "B-REQ2: no duplica una solicitud igual pendiente");
  win.document.querySelectorAll("body > div[id^='m-']").forEach(x => x.remove());
  win.resolveRequest(reqs[0].id, "approved");
  r.assert(win.S.cfg.coaches[1].teamsEdit.includes("t2") && !win.S.cfg.coaches[1].teamsEdit.includes("t1"), "B-REQ2: un entrenador no puede aprobar solicitudes");
  win._setCurrentCoachId("sa");
  win.navTo("hoy");
  r.assert(/solicitud(es)? pendiente/.test(win.document.body.textContent), "B-REQ2: el superadmin ve el aviso de solicitudes pendientes en Hoy");
  win.openRequestsInbox();
  r.assert(/Laura/.test(win.document.body.textContent), "B-REQ2: la bandeja muestra quién la pide");
  win.resolveRequest(reqs[0].id, "approved");
  const ok = win.document.querySelector("#m-confirm button");
  r.assert(!!ok, "B-REQ2: aprobar un permiso pide confirmación");
  ok && ok.click();
  await new Promise(res => setTimeout(res, 20));
  const laura = win.S.cfg.coaches.find(c => c.id === "e");
  r.assert(laura.teamsEdit.includes("t1") && !laura.teamsView.includes("t1"), "B-REQ2: aprobar concede el permiso de edición");
  r.assert(win._allRequests()[0].status === "approved" && win._pendingRequests().length === 0, "B-REQ2: la solicitud queda aprobada");
  r.assert(JSON.stringify({ s: win.S.sessions, m: win.S.matches, t: win.S.teams, p: win.S.players }) === before, "B-REQ2/B-ICS1: no tocan asistencia, partidos, equipos ni jugadoras");
  r.assert(!JSON.stringify(win._snapshotState ? win._snapshotState() : {}).includes("rq_"), "B-REQ2: las solicitudes no entran en el estado sincronizado");

  // ── Marcador público
  win._setCurrentCoachId("sa");
  const conv = win.S.players.t1.map(p => p.id);
  Object.assign(win.S.matches.t1[0], { date: today, matchMode: "live", convocados: conv, titulares: conv, rivalPlayers: [] });
  win.save();
  win.navTo("liveGame", { teamId: "t1", matchId: "m1" });
  win.liveAction("p1", "p2m", 2);
  win.document.querySelectorAll("body > div[id^='m-']").forEach(x => x.remove());
  win.startPublicScore();
  const m = win.mById("t1", "m1");
  r.assert(/^pb[0-9a-f]{24}$/.test(m.publicToken || ""), "B-PUBLIC1: crea un token aleatorio largo");
  const pay = win._publicPayload("t1", m);
  r.assert(pay.ours === 2 && pay.theirs === 0 && pay.rival === "CB Huesca" && pay.started === true, "B-PUBLIC1: publica el marcador correcto");
  r.assert(!/Secreta|Carla|Dana|Eva/.test(JSON.stringify(pay)), "B-PUBLIC1: nunca publica nombres de jugadoras");
  const allowed = ["team", "club", "rival", "location", "quarters", "q", "periods", "ours", "theirs", "clockSec", "clockRunning", "started", "finished", "date", "time", "updatedAt"];
  r.assert(Object.keys(pay).every(k => allowed.includes(k)), "B-PUBLIC1: solo campos permitidos por las reglas de Firestore");
  r.assert(/marcador\.html\?c=[^&]+&t=pb/.test(win._publicScoreUrl(m)), "B-PUBLIC1: enlace a marcador.html con club y token");
  r.assert(/Marcador para familias/.test(win.document.body.textContent), "B-PUBLIC1: abre la ventana con el enlace");
  win.document.querySelectorAll("body > div[id^='m-']").forEach(x => x.remove());
  win.stopPublicScore();
  r.assert(!win.mById("t1", "m1").publicToken, "B-PUBLIC1: dejar de compartir borra el token");
  win._setCurrentCoachId("e"); win.S.cfg.coaches[1].teamsEdit = ["t2"]; win.S.cfg.coaches[1].teamsView = ["t1"]; win.save();
  win.navTo("liveGame", { teamId: "t1", matchId: "m1" });
  win.document.querySelectorAll("body > div[id^='m-']").forEach(x => x.remove());
  win.startPublicScore();
  r.assert(!win.mById("t1", "m1").publicToken, "B-PUBLIC1: en modo ver no se puede crear el enlace");
  return r.summary();
}
module.exports = { run };
if (require.main === module) run().then(({ failed }) => process.exit(failed ? 1 : 0));
