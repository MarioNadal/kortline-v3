"use strict";
// v3.0.0-dev.124 · revisión visual + guía de instalación + aviso "sin subir".
const { loadApp, newReporter } = require("./harness.js");
const fs = require("fs"), path = require("path");
async function run() {
  const r = newReporter("review_fixes_124");
  const win = await loadApp(); const doc = win.document;
  const today = win.td(), d = n => win._addDaysISO(today, n);
  const wi = win._weekdayIdxForDate(today);
  win.S.teams = [{ id: "t1", name: "CADETE", schedule: { [wi]: "18:00" } }];
  win.S.players = { t1: [{ id: "p1", name: "Ana", number: 4, addedAt: d(-90) }, { id: "p2", name: "Bea", number: 5, position: "Base", addedAt: d(-90) }] };
  win.S.sessions = {};
  [-40, -38, -3, -1].forEach(o => { win.S.sessions[win.sk("t1", d(o))] = { p1: "present", p2: o === -1 ? "absent" : "present" }; });
  win.S.matches = { t1: [{ id: "m1", date: d(-5), rival: "CB H", location: "home", quarters: 4, q: [10, 8, 9, 7, 11, 6, 12, 5] }, { id: "m2", date: d(4), rival: "CB Z", location: "home", quarters: 4 }] };
  win.save();
  const txt = () => doc.getElementById("root").textContent;
  win.navTo("team", { teamId: "t1" });
  const rows = [...doc.querySelectorAll(".pr")].map(e => e.textContent.replace(/\s+/g, " "));
  r.assert(rows.length === 2 && !rows.some(t => / — /.test(" " + t + " ")), "B-UI1: sin '—' debajo de jugadoras sin posición");
  r.assert(rows.some(t => /Base/.test(t)), "B-UI1: la posición sigue saliendo si la hay");
  win.navTo("hoy");
  const clockLines = [...doc.querySelectorAll("div")].filter(x => x.children.length === 0 && /🕐 18:00h/.test(x.textContent)).map(x => x.textContent.trim());
  r.assert(clockLines.length > 0 && clockLines.every(t => !t.startsWith("·")), "B-UI2: la hora en Hoy sin '·' suelto delante");
  // Partido jugado
  win.navTo("matchDetail", { teamId: "t1", matchId: "m1" });
  r.assert(!/Iniciar en Vivo/.test(txt()), "B-MD1: un partido con resultado no ofrece 'Iniciar en vivo'");
  r.assert(/No se apuntó la convocatoria/.test(txt()), "B-MD1: convocatoria vacía de un partido jugado, plegada");
  const nb = doc.getElementById("btn-save-match-notes");
  r.assert(nb && /display:\s*none/.test(nb.getAttribute("style")), "B-MD1: sin notas, no sale 'Notas guardadas'");
  win._mdShowConvFor = "m1"; win.eval("_mdShowConvFor='m1'"); win.render();
  r.assert(!/No se apuntó/.test(txt()) && doc.querySelectorAll(".conv-player").length === 2, "B-MD1: 'Apuntarla' despliega la lista");
  win.navTo("matchDetail", { teamId: "t1", matchId: "m2" });
  r.assert(/Iniciar en Vivo/.test(txt()) && doc.querySelectorAll(".conv-player").length === 2, "B-MD1: un partido por jugar sigue igual (Iniciar en vivo + convocatoria)");
  // Equipos sin categoría
  win.navTo("equipos");
  r.assert(!doc.querySelector(".team-badge"), "B-UI3: sin categoría no sale la etiqueta '—'");
  // Historial por meses
  win.S.histMonth = null; win.navTo("hist", { teamId: "t1" });
  const heads = [...doc.querySelectorAll(".hist-month-h")].map(e => e.textContent.replace(/\s+/g, " ").trim());
  r.assert(heads.length >= 2, "B-HISTMONTH1: 'Todos los meses' separa el listado por mes");
  r.assert(heads.every(h => /\d+ entrenos?/.test(h) && /%/.test(h) && !/ De /.test(h)), "B-HISTMONTH1: cada mes con nº de entrenos y % ('de' en minúscula)");
  r.assert((doc.getElementById("root").innerHTML.match(/openDeleteConfirm\(/g) || []).length === doc.querySelectorAll(".he").length && doc.querySelectorAll(".he").length >= 2, "B-HISTMONTH1: la papelera de cada día se mantiene");
  // Aviso de sincronización
  win.eval("_cloudEnabled=true;_syncUnsentSince=Date.now()-1000"); win._updateSyncChip();
  r.assert(!doc.getElementById("sync-chip"), "B-SYNCCHIP1: con un envío reciente (<8 s) no se ve nada");
  win.eval("_syncUnsentSince=Date.now()-20000"); win._updateSyncChip();
  r.assert(!!doc.getElementById("sync-chip"), "B-SYNCCHIP1: cambios sin subir más de 8 s → aviso");
  win.eval("_syncUnsentSince=0"); win._updateSyncChip();
  r.assert(!doc.getElementById("sync-chip"), "B-SYNCCHIP1: en cuanto suben, desaparece");
  win.eval("_cloudEnabled=false");
  // Invitar
  win.openInviteCoach();
  r.assert(/instalar\.html/.test(doc.getElementById("m-invite").textContent) && !/PIN|código del club:/.test(doc.querySelector("#m-invite .share-preview").textContent.replace("código del club que te daré", "")), "B-INSTALL1: invitar manda el enlace a la guía y no incluye el código del club");
  // Archivos
  const root = path.join(__dirname, "..");
  r.assert(fs.existsSync(path.join(root, "instalar.html")) && fs.existsSync(path.join(root, "assets/vendor/qrcode.js")), "B-INSTALL1: guía y librería QR en el repo (sin CDN)");
  const man = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
  r.assert(man.icons.every(i => fs.existsSync(path.join(root, i.src))), "B-ICON1: todos los iconos del manifest existen");
  r.assert(man.icons.filter(i => i.purpose === "maskable").every(i => /maskable/.test(i.src)), "B-ICON1: iconos 'maskable' propios para Android");
  return r.summary();
}
module.exports = { run };
if (require.main === module) run().then(({ failed }) => process.exit(failed ? 1 : 0));
