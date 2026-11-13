"use strict";
// v3.0.0-dev.127 · B-GUEST11: puntuales en entreno normal, voluntario y
// tecnificación EL MISMO DÍA. Mario: "las puntuales en la tecnificación, en
// Hoy, en el resumen no salen, por lo menos no las cuenta como presentes".
// Cada puntual debe contar SOLO en la sesión a la que vino, en todas las
// pantallas: pase de lista, tarjeta de Hoy, texto de WhatsApp, historial,
// contador de voluntarios/tecnificaciones y % oficial.
const { loadApp, newReporter } = require("./harness.js");
async function run() {
  const r = newReporter("guests_optional_sessions");
  const win = await loadApp(); const doc = win.document;
  const today = win.td(), d = n => win._addDaysISO(today, n);
  const wi = win._weekdayIdxForDate(today), wiPast = win._weekdayIdxForDate(d(-7));
  win.S.cfg.features = Object.assign({}, win.S.cfg.features, { incidents: false });
  win.S.teams = [
    { id: "t1", name: "CADETE", category: "Cadete", gender: "F", schedule: { [wi]: "18:00" }, optSchedules: { voluntario: { [wi]: "17:00" }, tecnificacion: { [wi]: "20:00" } } },
    { id: "t0", name: "INFANTIL", category: "Infantil", gender: "F", schedule: {} }];
  win.S.players = { t1: Array.from({ length: 6 }, (_, i) => ({ id: "r" + i, name: "Fija " + i, number: 4 + i, addedAt: d(-60) })), t0: [{ id: "i1", name: "Inés Infantil", number: 20, addedAt: d(-60) }] };
  win.S.sessions = {}; win.S.matches = { t1: [], t0: [] };
  win.save();
  const TYPES = [false, "voluntario", "tecnificacion"];
  const lbl = t => t === false ? "entreno" : t;
  const root = () => doc.getElementById("root");
  const closeModals = () => doc.querySelectorAll("body > div[id^='m-']").forEach(x => x.remove());
  const addManualGuest = (type, name, date) => {
    win.navTo("att", { teamId: "t1", date: date || today, attOpt: type });
    win.openGuestPlayerModal({ mode: "att" });
    if (!doc.getElementById("gp-name")) { win._guestPicker.manualOpen = true; win._refreshGuestPickerBody(); }
    doc.getElementById("gp-name").value = name;
    win._guestPlayerCommit("att"); closeModals();
    return win.S.players.t1.find(p => p.name === name);
  };
  // 1) Un puntual distinto en cada sesión de hoy + una ausente en cada una
  const G = {};
  TYPES.forEach((type, k) => {
    G[lbl(type)] = addManualGuest(type, "Puntual " + lbl(type));
    win.navTo("att", { teamId: "t1", date: today, attOpt: type });
    win.confirmSession();
    const key = win._sessKeyFor("t1", today, type); win.S.sessions[key] = { ...win.S.sessions[key], ["r" + k]: "absent" }; win.save();
  });
  // Tarjetas de Hoy: [pres, aus] de la tarjeta de ese tipo
  const hoyCard = type => {
    win.navTo("hoy");
    const label = type === "tecnificacion" ? "TECNIFICACIÓN" : type === "voluntario" ? "VOLUNTARIO" : null;
    const cards = [...root().querySelectorAll("div")].filter(dv => dv.querySelector(".hoy-stats") && /CADETE/.test(dv.textContent) && dv.querySelectorAll(".hoy-stats").length === 1);
    const card = cards.find(c => label ? new RegExp(label).test(c.textContent) : !/TECNIFICACIÓN|VOLUNTARIO/.test(c.textContent));
    if (!card) return null;
    const v = [...card.querySelectorAll(".hoy-stat")].map(s => s.textContent.replace(/\s+/g, " ").trim());
    const num = re => { const x = v.find(t => re.test(t)); return x ? parseInt(x, 10) : NaN; };
    return { pct: parseInt(v[0], 10), pres: num(/Pres/), aus: num(/Aus/) };
  };
  // Un 2º puntual SOLO en el voluntario: así cada sesión tiene un número
  // distinto de puntuales y un error de "sesión equivocada" no puede quedar
  // tapado por casualidad (que es lo que pasaba con la tecnificación).
  addManualGuest("voluntario", "Puntual voluntario 2");
  const EXP = { entreno: 6, voluntario: 7, tecnificacion: 6 };
  TYPES.forEach(type => {
    const c = hoyCard(type);
    r.assert(c && c.pres === EXP[lbl(type)] && c.aus === 1, `Hoy · ${lbl(type)}: cuenta a SUS puntuales como presentes y no los de otras sesiones (${EXP[lbl(type)]} presentes, 1 ausente)${c ? ` [${c.pres}/${c.aus}]` : " [sin tarjeta]"}`);
    win.navTo("att", { teamId: "t1", date: today, attOpt: type });
    const names = [...root().querySelectorAll(".pr")].map(e => e.textContent);
    const mine = names.some(t => t.includes("Puntual " + lbl(type)));
    const others = TYPES.filter(o => o !== type).some(o => names.some(t => t.includes("Puntual " + lbl(o))));
    r.assert(mine && !others, `Pase de lista · ${lbl(type)}: sale su puntual y no los de las otras sesiones`);
    const txt = win.buildDailyText("t1", today, false, null, type);
    r.assert(txt.includes("Puntual " + lbl(type)) && !TYPES.filter(o => o !== type).some(o => new RegExp("Puntual " + lbl(o) + "(\\n| ·|$)").test(txt)) && new RegExp("Presentes \\(" + EXP[lbl(type)] + "\\)").test(txt), `WhatsApp · ${lbl(type)}: sus puntuales entre los presentes, sin los de las otras sesiones`);
  });
  // Contadores
  ["voluntario", "tecnificacion"].forEach(type => {
    const c = win._optionalAttCount(G[type], "t1", type);
    r.assert(c.asistidas === 1 && c.total === 1, `Contador de ${type}: su puntual tiene 1 de 1`);
    const other = win._optionalAttCount(G[type], "t1", type === "voluntario" ? "tecnificacion" : "voluntario");
    r.assert(other.asistidas === 0, `Contador de ${type}: no le suma en la otra sesión opcional`);
  });
  const fixedPct = win._countAtt ? null : null;
  win.navTo("stats", { teamId: "t1" }); win.S.statsView = "table"; win.render();
  const statNames = [...root().querySelectorAll(".pr, .pcard, [class*='prow']")].map(e => e.textContent).join("|");
  r.assert(!/Puntual voluntario|Puntual tecnificacion/.test(statNames), "% oficial: los puntuales de voluntario/tecnificación no entran en la tabla oficial");
  // 2) Reutilizar desde "Más frecuentes" otro día (tecnificación de hace 7 días)
  win.navTo("att", { teamId: "t1", date: d(-7), attOpt: "tecnificacion" });
  win.openGuestPlayerModal({ mode: "att" });
  const fr = win._guestPicker.frequent.map(x => x.name);
  r.assert(fr.includes("Puntual tecnificacion"), "Más frecuentes: ofrece al puntual ya usado");
  win._guestPicker.selectedFrequent.add(G.tecnificacion.id); win._guestPickerCommit(); closeModals();
  const gT = win.S.players.t1.find(p => p.id === G.tecnificacion.id);
  r.assert(gT.attDates.includes(d(-7) + "_opt_tec") && win.S.players.t1.filter(p => p.name === "Puntual tecnificacion").length === 1, "Más frecuentes: se reutiliza el mismo puntual (sin duplicarlo) y se apunta ese día de tecnificación");
  win.navTo("att", { teamId: "t1", date: d(-7), attOpt: false });
  r.assert(![...root().querySelectorAll(".pr")].some(e => /Puntual tecnificacion/.test(e.textContent)), "Más frecuentes: no aparece en el entreno normal de ese día");
  r.assert(win._optionalAttCount(gT, "t1", "tecnificacion").asistidas === 2, "Más frecuentes: el contador de tecnificación sube a 2");
  // 3) Traer a una de categoría inferior a la tecnificación de hoy
  win.navTo("att", { teamId: "t1", date: today, attOpt: "tecnificacion" });
  win.openGuestPlayerModal({ mode: "att" });
  r.assert(win._guestPicker.lowerRows.some(x => x.name === "Inés Infantil"), "Categoría inferior: ofrece a la jugadora del infantil");
  win._guestPicker.selectedLower.add("i1"); win._guestPickerCommit(); closeModals();
  let c = hoyCard("tecnificacion");
  r.assert(c && c.pres === 7, `Hoy · tecnificación: la de categoría inferior también cuenta (7 presentes)${c ? " [" + c.pres + "]" : ""}`);
  c = hoyCard(false);
  r.assert(c && c.pres === 6, "Hoy · entreno: no se suma la de categoría inferior traída a la tecnificación");
  // 4) Quitar al puntual solo de la tecnificación de hoy
  win.navTo("att", { teamId: "t1", date: today, attOpt: "tecnificacion" });
  win.removeGuestFromSession(G.tecnificacion.id); doc.querySelector("#m-confirm button").click();
  c = hoyCard("tecnificacion");
  const g2 = win.S.players.t1.find(p => p.id === G.tecnificacion.id);
  r.assert(c && c.pres === 6 && g2 && g2.attDates.includes(d(-7) + "_opt_tec") && !g2.attDates.includes(today + "_opt_tec"), "Quitar puntual de la tecnificación de hoy: baja a 6 y conserva su otro día");
  // 5) Tecnificación pasada solo con puntuales (las fijas sin tocar)
  const gOnly = addManualGuest("tecnificacion", "Solo Puntual", d(-14));
  const keyOnly = win._sessKeyFor("t1", d(-14), "tecnificacion");
  r.assert(win.S.sessions[keyOnly][gOnly.id] === "present", "Tecnificación con solo un puntual añadido: queda marcado presente");
  r.assert(win._optionalAttCount(gOnly, "t1", "tecnificacion").asistidas === 1, "Tecnificación con solo un puntual: cuenta en su contador");
  // 6) Historial: la tecnificación de hoy aparece en el bloque aparte
  win.S.histMonth = null; win.navTo("hist", { teamId: "t1" });
  r.assert(/Tecnificación|TECNIFICACIÓN/.test(root().textContent), "Historial: las tecnificaciones salen en su bloque");
  // 6b) Una jugadora fija dada de alta HOY no suma tecnificaciones anteriores
  win.S.players.t1.push({ id: "nueva", name: "Nueva Hoy", number: 30, addedAt: today }); win.save();
  const pastTec = { date: d(-7), optType: "tecnificacion", data: win.S.sessions[win._sessKeyFor("t1", d(-7), "tecnificacion")] };
  r.assert(!win._optAttendedIn(win.S.players.t1.find(p => p.id === "nueva"), "t1", pastTec), "Alta de hoy: no cuenta como presente en una tecnificación de antes de su alta");
  r.assert(win._optAttendedIn(win.S.players.t1.find(p => p.id === "r5"), "t1", pastTec), "Plantilla de siempre: sí cuenta en esa tecnificación (sin marca = presente)");
  const mdN = win._monthReportData("t1", d(-7).slice(0, 7)).rows.find(x => x.p.id === "nueva");
  r.assert(!mdN || mdN.optC === (d(-7).slice(0, 7) === today.slice(0, 7) ? (win._optAttendedIn(win.S.players.t1.find(p => p.id === "nueva"), "t1", { date: today, optType: "tecnificacion", data: win.S.sessions[win._sessKeyFor("t1", today, "tecnificacion")] }) ? 1 : 0) + (win._optAttendedIn(win.S.players.t1.find(p => p.id === "nueva"), "t1", { date: today, optType: "voluntario", data: win.S.sessions[win._sessKeyFor("t1", today, "voluntario")] }) ? 1 : 0) : 0), "Informe del mes: el alta de hoy solo suma las sesiones opcionales desde su alta");
  // 7) Informe del mes: los puntuales de voluntario cuentan en "voluntarios"
  const ym = today.slice(0, 7);
  const md = win._monthReportData("t1", ym);
  const rowV = md.rows.find(x => x.p.name === "Puntual voluntario");
  r.assert(rowV && rowV.optC === 1 && rowV.tot === 0, "Informe del mes: el puntual del voluntario sale con 1 sesión opcional y 0 oficiales");
  const rowE = md.rows.find(x => x.p.name === "Puntual entreno");
  r.assert(rowE && rowE.tot === 1 && rowE.optC === 0, "Informe del mes: el puntual del entreno cuenta solo en el entreno oficial");
  // 8) Historial: la fila de la tecnificación de hoy suma a los que vinieron
  win.navTo("hist", { teamId: "t1" });
  const optRows = [...root().querySelectorAll(".he")].filter(e => /Tecnificación/.test(e.textContent) && e.textContent.includes(win.fd(today, true)));
  r.assert(optRows.length === 1, "Historial: una fila para la tecnificación de hoy");
  return r.summary();
}
module.exports = { run };
if (require.main === module) run().then(({ failed }) => process.exit(failed ? 1 : 0));
