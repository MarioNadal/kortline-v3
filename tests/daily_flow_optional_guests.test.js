"use strict";
// v3.0.0-dev.110 · B-VOLTECH5 + B-GUEST9 + B-GUEST10: el día a día de
// entrenamientos voluntarios/tecnificación y de jugadores puntuales, tal y
// como lo reportó Mario probando desde el móvil:
//  - "si las pones en el equipo como un entrenamiento más semanal no salen
//    en el horario en el día de hoy para pasar lista"
//  - "si ya hay un entrenamiento de ese equipo tampoco deja añadirlo o no
//    acaba de funcionar bien"
//  - "no puedes borrar un jugador puntual añadido un día de entrenamiento y
//    si hay errores debe hacerse"
// Todo se ejecuta por los mismos caminos que los botones (formulario de
// Editar equipo, hoja "＋ Añadir actividad", pase de lista).
const { loadApp, newReporter } = require("./harness.js");

function clickConfirm(win) {
  const b = win.document.querySelector("#m-confirm button");
  if (b) b.click();
}

async function setup() {
  const win = await loadApp();
  const today = win.td(), ti = win._weekdayIdxForDate(today);
  win.S.teams = [
    { id: "t1", name: "CADETE", schedule: { [ti]: "18:00" }, color: "#f00" },
    { id: "t2", name: "INFANTIL", schedule: {}, color: "#00f" }
  ];
  win.S.players = { t1: [{ id: "p1", name: "Ana", number: 1 }, { id: "p2", name: "Bea", number: 2 }], t2: [{ id: "q1", name: "Cris", number: 3 }] };
  win.S.sessions = {}; win.S.matches = {};
  return { win, d: win.document, today, ti };
}
const root = win => win.document.getElementById("root").innerHTML;
// Tarjetas de la línea de tiempo de Hoy que son de un tipo (sin contar las barras divisorias)
const tlCards = (win, label) => [...win.document.querySelectorAll("#root .tl-row")].filter(x => x.textContent.includes(label)).length;
// Abre "Añadir puntual" y escribe un nombre nuevo a mano (si ya hay
// puntuales frecuentes, el formulario manual viene plegado).
function addGuestManual(win, name) {
  win.openGuestPlayerModal({ mode: "att" });
  if (!win.document.getElementById("gp-name")) win._guestToggleManualOpen();
  win.document.getElementById("gp-name").value = name;
  win._guestPlayerCommit("att");
}

async function run() {
  const r = newReporter("daily_flow_optional_guests");

  // ═══ 1) Horario fijo de voluntario Y tecnificación desde "Editar equipo" ═══
  {
    const { win, d, ti, today } = await setup();
    win.openTeamModal(win.S.teams[0]);
    const id = "m-edit-team";
    r.assert(!d.getElementById(id + "-opttype"), "1) B-VOLTECH6: ya no hay desplegable de tipo (con él se perdía el horario si no se elegía)");
    d.getElementById(id + "-optv-day-" + ti).checked = true;
    d.getElementById(id + "-optv-time-" + ti).value = "17:00";
    d.getElementById(id + "-optt-day-" + ti).checked = true;
    d.getElementById(id + "-optt-time-" + ti).value = "20:00";
    win.saveTeam(id, "t1");
    const os = win.S.teams[0].optSchedules;
    r.assert(!!os && os.voluntario[ti] === "17:00" && os.tecnificacion[ti] === "20:00",
      "1) B-VOLTECH6: un equipo puede tener voluntario Y tecnificación fijos, cada uno con su día y hora");
    win.openTeamModal(win.S.teams[0]);
    r.assert(d.getElementById(id + "-optv-day-" + ti).checked && d.getElementById(id + "-optt-time-" + ti).value === "20:00", "1) al volver a abrir Editar equipo se ven los dos horarios guardados");
    d.getElementById(id)?.remove();
    win.S.screen = "hoy"; win.S.hoyDate = null; win.render();
    const h = root(win);
    r.assert(h.includes("🙋 VOLUNTARIO") && h.includes("🎯 TECNIFICACIÓN") && h.includes("🏋️ ENTRENAMIENTO"),
      "1) ese día salen en Hoy las TRES tarjetas: entrenamiento normal, voluntario y tecnificación");
    // Línea de tiempo: 17:00 voluntario → 18:00 entreno → 20:00 tecnificación
    const iV = h.indexOf("🙋 VOLUNTARIO"), iE = h.indexOf("🏋️ ENTRENAMIENTO"), iT = h.indexOf("🎯 TECNIFICACIÓN");
    r.assert(iV < iE && iE < iT, "1) B-HOY5: en Hoy van ordenados por hora en una sola línea de tiempo (17:00 voluntario, 18:00 entreno, 20:00 tecnificación), no en bloques separados");
    r.assert(!h.includes("🙋 VOLUNTARIOS / TECNIFICACIÓN"), "1) B-HOY5: ya no hay bloque aparte abajo del todo");
    // Barras divisorias intercaladas por tipo, en el orden de la hora:
    const divs = [...win.document.querySelectorAll("#root .tl-divider")].map(x => x.textContent.trim());
    r.assert(JSON.stringify(divs) === JSON.stringify(["🙋 VOLUNTARIO", "🏋️ ENTRENAMIENTOS", "🎯 TECNIFICACIÓN"]),
      "1) B-HOY5: cada cambio de tipo lleva su barra con nombre (VOLUNTARIO → ENTRENAMIENTOS → TECNIFICACIÓN), intercaladas por hora -- " + JSON.stringify(divs));
    win.navTo("att", { teamId: "t1", date: today, attOpt: "voluntario" });
    win.cycleAtt("p1");
    win.navTo("att", { teamId: "t1", date: today, attOpt: "tecnificacion" });
    win.cycleAtt("p2");
    const sv = win.S.sessions[win.skO("t1", today, "voluntario")], st = win.S.sessions[win.skO("t1", today, "tecnificacion")];
    r.assert(sv && sv.p1 === "absent" && !("p2" in sv) && st && st.p2 === "absent" && !("p1" in st) && !win.S.sessions[win.sk("t1", today)],
      "1) cada sesión (voluntario, tecnificación, entreno normal) guarda su propia asistencia, sin mezclarse");
  }

  // ═══ 1a) Entreno → tecnificación → entreno: la barra ENTRENAMIENTOS vuelve a salir ═══
  {
    const { win, ti } = await setup();
    win.S.teams[0].schedule = { [ti]: "17:00" };
    win.S.teams[1].schedule = { [ti]: "21:00" };
    win.S.teams[1].optSchedules = { voluntario: {}, tecnificacion: { [ti]: "19:00" } };
    win.S.screen = "hoy"; win.S.hoyDate = null; win.render();
    const divs = [...win.document.querySelectorAll("#root .tl-divider")].map(x => x.textContent.trim());
    r.assert(JSON.stringify(divs) === JSON.stringify(["🏋️ ENTRENAMIENTOS", "🎯 TECNIFICACIÓN", "🏋️ ENTRENAMIENTOS"]),
      "1a) B-HOY5: tras la tecnificación de las 19:00 vuelve a salir la barra ENTRENAMIENTOS para el de las 21:00, en vez de mandarlo todo abajo -- " + JSON.stringify(divs));
  }

  // ═══ 1b) Línea de tiempo con partido y "ahora" ═══
  {
    const { win, today, ti } = await setup();
    win.S.teams[0].schedule = { [ti]: "23:58" };
    win.S.matches = { t2: [{ id: "m1", date: today, time: "00:01", rival: "Rival Mañana", quarters: 4, qMins: 10, convocados: [] }] };
    win.S.screen = "hoy"; win.S.hoyDate = null; win.render();
    const h = root(win);
    const iM = h.indexOf("Rival Mañana"), iNow = h.indexOf("AHORA"), iE = h.indexOf("🏋️ ENTRENAMIENTO");
    r.assert(iM >= 0 && iNow > iM && iE > iNow, "1b) B-HOY5: el partido de las 00:01 va antes de la marca AHORA y el entrenamiento de las 23:58 después");
  }

  // ═══ 1c) Datos antiguos: tecnificación guardada en "_opt" y horario fijo antiguo ═══
  {
    const { win, today, ti } = await setup();
    win.S.sessions[win.sk("t1", today) + "_opt"] = { _optType: "tecnificacion", p1: "present" };
    win._migrateLegacyTecSessions();
    r.assert(!win.S.sessions[win.sk("t1", today) + "_opt"] && win.S.sessions[win.skO("t1", today, "tecnificacion")].p1 === "present",
      "1c) B-VOLTECH6: una tecnificación antigua (clave '_opt') se mueve a su propia clave sin perder la asistencia");
    win.S.teams[1].optSchedule = { type: "tecnificacion", schedule: { [ti]: "19:00" } }; // formato dev.106
    win.S.screen = "hoy"; win.S.hoyDate = null; win.render();
    r.assert(tlCards(win, "🎯 TECNIFICACIÓN") === 2 && root(win).includes("19:00"),
      "1c) un horario fijo guardado con el formato antiguo (un solo tipo) se sigue viendo en Hoy");
  }

  // ═══ 2) Crear una tecnificación para 2 equipos cuando ya hay entreno ═══
  {
    const { win, d, today } = await setup();
    win.navTo("att", { teamId: "t1", date: today, attOpt: false });
    win.cycleAtt("p1"); win.cycleAtt("p1"); // p1: ausente → tarde
    const normal = JSON.stringify(win.S.sessions[win.sk("t1", today)].p1);
    win.navRoot("hoy"); win.openHoyAddSheet(); win._hoyAddPickOptional("tecnificacion");
    d.querySelectorAll("#hoy-opt-teams input").forEach(c => { c.checked = true; });
    d.getElementById("hoy-opt-time").value = "19:30";
    win._hoyAddCommitOptional("tecnificacion");
    r.assert(win.S.screen === "att" && win.S.attOpt === "tecnificacion" && win.S.teamId === "t1", "2) tras crearla se abre directamente el pase de lista de la tecnificación");
    r.assert(JSON.stringify(win.S.sessions[win.sk("t1", today)].p1) === normal, "2) el entrenamiento normal ya pasado de ese día no se toca");
    r.assert(root(win).includes("INFANTIL") && root(win).includes("Otros equipos en esta tecnificación"), "2) B-VOLTECH5: en el pase de lista salen los otros equipos de la misma tecnificación para saltar a ellos sin volver a Hoy");
    win.navTo("att", { teamId: "t2", date: today, attOpt: "tecnificacion" });
    r.assert(root(win).includes("Cris") && root(win).includes("Tecnificación"), "2) y al saltar se abre la tecnificación del otro equipo");
    win.navRoot("hoy");
    const h = root(win);
    r.assert(h.includes("🏋️ ENTRENAMIENTO") && tlCards(win, "🎯 TECNIFICACIÓN") === 2 && h.includes("19:30"),
      "2) Hoy muestra el entrenamiento normal + una tarjeta de tecnificación por cada equipo, con la hora");
    win.navTo("team", { teamId: "t1" });
    r.assert(!root(win).includes("TECNIFICACIÓN HOY"), "2) la ficha del equipo NO tiene un segundo acceso a la sesión de hoy -- Mario: duplicaba el ＋ de Hoy y liaba; un solo sitio (Hoy)");
  }

  // ═══ 3) Puntual de tecnificación ≠ puntual del entrenamiento normal ═══
  {
    const { win, d, today } = await setup();
    win.S.sessions[win.skO("t1", today, "tecnificacion")] = { _optType: "tecnificacion" };
    win.navTo("att", { teamId: "t1", date: today, attOpt: "tecnificacion" });
    addGuestManual(win, "Invitado Tec");
    r.assert(root(win).includes("Invitado Tec"), "3) el puntual sale en la tecnificación donde se añadió");
    win.navTo("att", { teamId: "t1", date: today, attOpt: false });
    r.assert(!root(win).includes("Invitado Tec"), "3) B-GUEST9: y ya NO aparece en el entrenamiento normal del mismo día (antes salía, y contaba como presente en el % oficial)");
    addGuestManual(win, "Invitado Normal");
    win.navTo("att", { teamId: "t1", date: today, attOpt: "tecnificacion" });
    r.assert(!root(win).includes("Invitado Normal"), "3) igual al revés: un puntual del entrenamiento normal no se cuela en la tecnificación");
  }

  // ═══ 4) Quitar un puntual añadido por error ═══
  {
    const { win, d, today } = await setup();
    win.navTo("att", { teamId: "t1", date: today, attOpt: false });
    addGuestManual(win, "Error Nombre");
    const g = win.S.players.t1.find(p => p.name === "Error Nombre");
    r.assert(root(win).includes("removeGuestFromSession('" + g.id + "')"), "4) B-GUEST10: cada puntual del pase de lista tiene su botón ✕ Quitar");
    win.removeGuestFromSession(g.id); clickConfirm(win);
    r.assert(!win.S.players.t1.some(p => p.id === g.id), "4) un puntual que solo vino ese día se borra entero (era un error de alta)");
    r.assert(!(g.id in (win.S.sessions[win.sk("t1", today)] || {})), "4) y su marca de asistencia de ese día desaparece");
    r.assert(!root(win).includes("Error Nombre"), "4) y ya no sale en la lista");

    // Puntual que vino 2 días: quitarlo de uno conserva el otro
    const ayer = win._addDaysISO(today, -1);
    win.S.players.t1.push({ id: "gx", name: "Viene Dos Dias", guest: true, attOnly: true, addedAt: ayer, attDates: [ayer, today] });
    win.S.sessions[win.sk("t1", ayer)] = { gx: "present" };
    win.S.sessions[win.sk("t1", today)] = { ...(win.S.sessions[win.sk("t1", today)] || {}), gx: "late", gx_jn: "nota" };
    win.render();
    win.removeGuestFromSession("gx"); clickConfirm(win);
    const gx = win.S.players.t1.find(p => p.id === "gx");
    r.assert(!!gx && JSON.stringify(gx.attDates) === JSON.stringify([ayer]), "4) un puntual que vino otro día se conserva con ese otro día");
    r.assert(win.S.sessions[win.sk("t1", ayer)].gx === "present", "4) su asistencia del otro día queda intacta");
    r.assert(!("gx" in win.S.sessions[win.sk("t1", today)]) && !("gx_jn" in win.S.sessions[win.sk("t1", today)]), "4) y de hoy se quitan marca y nota");

    // Cancelar no hace nada
    win.S.players.t1.push({ id: "gy", name: "Cancelado", guest: true, attOnly: true, addedAt: today, attDates: [today] });
    win.removeGuestFromSession("gy");
    win.document.querySelectorAll("#m-confirm button")[1].click();
    r.assert(win.S.players.t1.some(p => p.id === "gy"), "4) si se pulsa Cancelar, no se quita nada");

    // Un jugador de plantilla fija nunca tiene botón ni se puede quitar así
    win.removeGuestFromSession("p1"); clickConfirm(win);
    r.assert(win.S.players.t1.some(p => p.id === "p1"), "4) a un jugador de la plantilla fija nunca se le puede quitar por esta vía");
  }

  // ═══ 5) Quitar un puntual de una tecnificación no toca el entreno normal ═══
  {
    const { win, today } = await setup();
    win.S.players.t1.push({ id: "gz", name: "Mixto", guest: true, attOnly: true, addedAt: today, attDates: [today, today + "_opt"] });
    win.S.sessions[win.sk("t1", today)] = { gz: "present" };
    win.S.sessions[win.skO("t1", today, "voluntario")] = { _optType: "voluntario", gz: "present" };
    win.navTo("att", { teamId: "t1", date: today, attOpt: "voluntario" });
    win.removeGuestFromSession("gz"); clickConfirm(win);
    const gz = win.S.players.t1.find(p => p.id === "gz");
    r.assert(!!gz && JSON.stringify(gz.attDates) === JSON.stringify([today]) && win.S.sessions[win.sk("t1", today)].gz === "present" && !("gz" in win.S.sessions[win.skO("t1", today, "voluntario")]),
      "5) quitarlo del voluntario lo quita solo de ahí -- sigue en el entrenamiento normal del mismo día");
  }

  return r.summary();
}

module.exports = { run };
if (require.main === module) run().then(({ failed }) => process.exit(failed ? 1 : 0));
