"use strict";
// v3.0.0-dev.100 · B-VOLTECH1: entrenamientos voluntarios y tecnificaciones,
// pedidos explícitamente por Mario en la auditoría exhaustiva. Comprueba el
// flujo real de creación (openHoyAddSheet -> _hoyAddPickOptional ->
// _hoyAddCommitOptional, mismo mecanismo que "entrenamiento sorpresa" pero
// con selección múltiple de equipo, confirmado con AskUserQuestion), el
// aviso en att() (optSessionBannerHtml), el "contador aparte" que nunca
// toca el % oficial (_optionalAttCount, también confirmado con
// AskUserQuestion), y la salvaguarda crítica: NUNCA convertir en
// voluntario/tecnificación una sesión que ya tiene asistencia real de hoy.
const { loadApp, newReporter } = require("./harness");

async function run() {
  const report = newReporter("voluntary_trainings");
  const win = await loadApp();
  const assert = (cond, msg) => report.assert(cond, msg);

  const today = win.td();

  win.S.teams = [
    { id: "t1", name: "Cadete Masculino", color: "#F06318", schedule: {} },
    { id: "t2", name: "Infantil Femenino", color: "#1a6fc4", schedule: {} }
  ];
  win.S.players = {
    t1: [{ id: "p1", name: "Jugador Uno", number: 4, addedAt: "2026-07-01" }, { id: "p2", name: "Jugador Dos", number: 5, addedAt: "2026-07-01" }],
    t2: [{ id: "p3", name: "Jugadora Tres", number: 6, addedAt: "2026-07-01" }]
  };
  win.S.matches = {};
  win.S.events = {};
  win.S.sessions = {};
  win.S.teamId = "t1";
  win.S.date = today;

  // ── Flujo real: abrir el FAB, elegir "Tecnificación", marcar AMBOS
  // equipos, confirmar. ──
  win.openHoyAddSheet();
  assert(!!win.document.getElementById("m-hoy-add"), "openHoyAddSheet(): abre el bottom sheet");
  win._hoyAddPickOptional("tecnificacion");
  const checkboxes = win.document.querySelectorAll("#hoy-opt-teams input[type=checkbox]");
  assert(checkboxes.length === 2, "_hoyAddPickOptional(): un checkbox por cada equipo del club");
  checkboxes.forEach(cb => { cb.checked = true; });
  win._hoyAddCommitOptional("tecnificacion");

  const sessT1 = win.S.sessions[win.sk("t1", today)];
  const sessT2 = win.S.sessions[win.sk("t2", today)];
  assert(sessT1 && sessT1._optType === "tecnificacion", "_hoyAddCommitOptional(): crea la sesión de t1 con _optType=tecnificacion");
  assert(sessT2 && sessT2._optType === "tecnificacion", "_hoyAddCommitOptional(): crea la sesión de t2 con _optType=tecnificacion (multi-equipo real)");
  assert(win.S.teamId === "t1", "_hoyAddCommitOptional(): navega al pase de lista del primer equipo elegido");

  // ── Aviso en att(): debe verse el banner morado de "no cuenta para el %
  // oficial" cuando la sesión tiene _optType. ──
  win.S.date = today;
  win.S.screen = "att";
  const attHtml = win.att();
  assert(attHtml.includes("Tecnificación") && attHtml.includes("NO cuentan para el % oficial"),
    "att(): muestra el aviso de tecnificación cuando la sesión tiene _optType");

  // ── Pasar lista con normalidad (reutiliza setAll, sin tocar su código) --
  // p1 presente, p2 ausente. Las ausencias en esta sesión NUNCA deben
  // perjudicar el % oficial (ya cubierto por _teamSessionEntries/B-VOLTECH1
  // en otros tests; aquí se confirma el "contador aparte" por encima). ──
  win.S.sessions[win.sk("t1", today)] = { ...win.S.sessions[win.sk("t1", today)], p1: "present", p2: "absent" };

  const p1 = win.S.players.t1[0], p2 = win.S.players.t1[1];
  const c1 = win._optionalAttCount(p1, "t1");
  const c2 = win._optionalAttCount(p2, "t1");
  assert(c1.asistidas === 1 && c1.total === 1, "_optionalAttCount(): p1 (presente) cuenta 1 asistencia de 1 sesión opcional");
  assert(c2.asistidas === 0 && c2.total === 1, "_optionalAttCount(): p2 (ausente) cuenta 0 asistencias -- la ausencia NO suma, pero tampoco resta nada (solo no suma)");

  // ── Salvaguarda crítica: un equipo con entrenamiento NORMAL ya pasado hoy
  // nunca debe convertirse en opcional por error. ──
  win.S.sessions[win.sk("t2", today)] = { p3: "present" }; // entrenamiento NORMAL real de t2, ya pasado
  win.openHoyAddSheet();
  win._hoyAddPickOptional("voluntario");
  const cbs2 = win.document.querySelectorAll("#hoy-opt-teams input[type=checkbox]");
  cbs2.forEach(cb => { if (cb.value === "t2") cb.checked = true; });
  win._hoyAddCommitOptional("voluntario");
  assert(win.S.sessions[win.sk("t2", today)].p3 === "present" && !win.S.sessions[win.sk("t2", today)]._optType,
    "B-VOLTECH1 SALVAGUARDA: nunca convierte en voluntario/tecnificación una sesión que ya tenía asistencia real de hoy");

  // ── Pero SÍ se puede cambiar de tipo una sesión que YA era opcional
  // (de voluntario a tecnificación, por ejemplo) -- no hay asistencia real
  // en riesgo, solo cambia la etiqueta. ──
  win.S.sessions = {};
  win.S.sessions[win.sk("t1", today)] = { _optType: "voluntario", p1: "present" };
  win.openHoyAddSheet();
  win._hoyAddPickOptional("tecnificacion");
  const cbs3 = win.document.querySelectorAll("#hoy-opt-teams input[type=checkbox]");
  cbs3.forEach(cb => { if (cb.value === "t1") cb.checked = true; });
  win._hoyAddCommitOptional("tecnificacion");
  assert(win.S.sessions[win.sk("t1", today)]._optType === "tecnificacion" && win.S.sessions[win.sk("t1", today)].p1 === "present",
    "_hoyAddCommitOptional(): permite cambiar el tipo de una sesión que YA era opcional, sin perder la asistencia ya tomada");

  // ── "Hoy": la tarjeta del equipo debe distinguir claramente que es una
  // tecnificación, no un entrenamiento oficial normal (de un vistazo, sin
  // tener que entrar al pase de lista). ──
  win.S.sessions = {};
  win.S.sessions[win.sk("t1", today)] = { _optType: "tecnificacion" };
  win.S.hoyDate = null;
  const hoyHtml = win.hoy();
  assert(hoyHtml.includes("🎯 TECNIFICACIÓN"), "hoy(): la tarjeta de un equipo con tecnificación hoy muestra la etiqueta 🎯 TECNIFICACIÓN, no 🏋️ ENTRENAMIENTO");

  // ── hist() no debe reventar con sesiones opcionales de por medio, y debe
  // mostrar su propio bloque separado. ──
  win.S.sessions = {
    [`t1_${win._addDaysISO(today, -5)}`]: { p1: "present", p2: "present" },
    [`t1_${today}`]: { _optType: "tecnificacion", p1: "present", p2: "absent" }
  };
  win.S.teamId = "t1";
  let histHtml = "";
  try { histHtml = win.hist(); } catch (e) { report.assert(false, "hist() no debe lanzar excepción con sesiones opcionales: " + e.message); }
  if (histHtml) {
    assert(histHtml.includes("Voluntarios / tecnificación"), "hist(): muestra el bloque separado de sesiones opcionales");
    assert(histHtml.includes("1 asistieron de 2"), "hist(): cuenta bien asistencias dentro del bloque opcional (p1 presente, p2 ausente -> 1 de 2)");
  }

  return report.summary();
}

module.exports = { run };
