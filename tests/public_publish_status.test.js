"use strict";
// v3.0.0-dev.128 · B-PUBLIC2: el entrenador sabe si el marcador ha llegado
// de verdad a la nube (comprobado leyendo del servidor) o por qué no.
// Nube SIMULADA: nunca toca Firestore.
const { loadApp, newReporter } = require("./harness.js");
const wait = ms => new Promise(r => setTimeout(r, ms));
async function run() {
  const r = newReporter("public_publish_status");
  const win = await loadApp(); const doc = win.document;
  const store = {}; let failWith = null; const logs = [];
  win.eval("_scheduleCloudSync=function(){}; _reqCloud=function(){return true;}; _logClientError=function(e){window.__logs=(window.__logs||[]).concat([e.message]);};");
  win._clubDocRef = () => ({ collection: () => ({ doc: id => ({
    set: data => failWith ? Promise.reject({ code: failWith }) : (store[id] = data, Promise.resolve()),
    get: () => Promise.resolve({ exists: !!store[id] }),
    delete: () => { delete store[id]; return Promise.resolve(); } }) }) });
  win.eval("_clubDocRef=window._clubDocRef");
  win.S.teams = [{ id: "t1", name: "JUNIOR" }];
  win.S.players = { t1: Array.from({ length: 5 }, (_, i) => ({ id: "p" + i, name: "J" + i, number: i + 4 })) };
  const conv = win.S.players.t1.map(p => p.id);
  win.S.matches = { t1: [{ id: "m1", date: win.td(), rival: "CB R", location: "home", quarters: 4, qMins: 10, matchMode: "live", convocados: conv, titulares: conv, rivalPlayers: [] }] };
  win.save(); win.navTo("liveGame", { teamId: "t1", matchId: "m1" });
  doc.querySelectorAll("body > div[id^='m-']").forEach(x => x.remove());
  win.openPublicScoreModal(); win.startPublicScore(); await wait(30);
  const m = win.mById("t1", "m1");
  const txt = () => (doc.getElementById("m-public-score") || {}).textContent || "";
  r.assert(!!store[m.publicToken], "Éxito: el marcador se escribe en la nube");
  r.assert(/Las familias ya lo pueden ver/.test(txt()), "Éxito: la ventana confirma que las familias ya lo pueden ver (comprobado)");
  r.assert(/Verlo como las familias/.test(txt()), "Éxito: botón para abrirlo como lo ven las familias");
  // Fallo de permisos
  win.stopPublicScore(); await wait(10);
  failWith = "permission-denied";
  win.startPublicScore(); await wait(30);
  r.assert(/Todavía no ha llegado a la nube \(permission-denied\)/.test(txt()), "Fallo: la ventana dice que no ha llegado y el motivo");
  r.assert((win.__logs || []).some(x => /permission-denied/.test(x)), "Fallo: queda apuntado en el registro de errores");
  // Se recupera solo en el siguiente cambio
  failWith = null; win.liveAction("p0", "p2m", 2); doc.querySelectorAll("body > div[id^='m-']:not(#m-public-score)").forEach(x => x.remove()); await wait(30);
  win.openPublicScoreModal(); await wait(10);
  const m2 = win.mById("t1", "m1");
  r.assert(store[m2.publicToken] && store[m2.publicToken].ours === 2, "Recuperación: en cuanto se puede, sube con el marcador al día");
  r.assert(/Las familias ya lo pueden ver/.test(txt()), "Recuperación: vuelve a '✅ Las familias ya lo pueden ver'");
  win.eval("clearTimeout(_pubRetryT)");
  return r.summary();
}
module.exports = { run };
if (require.main === module) run().then(({ failed }) => process.exit(failed ? 1 : 0));
