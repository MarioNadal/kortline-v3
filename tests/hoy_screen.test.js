"use strict";
// v1.8.31 · B-HOY1: la pantalla Hoy ordenaba los entrenamientos siguiendo el
// orden de S.teams (el mismo orden que la pantalla Equipos), que no tiene
// por que coincidir con la hora real de cada entreno. Ahora se ordenan
// cronologicamente y se muestra una barra con el proximo entreno pendiente
// de pasar lista (urgente si ya toca, normal si es mas tarde).
const { loadApp, newReporter } = require("./harness");

async function run() {
  const report = newReporter("hoy_screen");
  const win = await loadApp();
  const assert = (cond, msg) => report.assert(cond, msg);

  const ti = win.todayIdx();
  const today = win.td();

  // ── Test A: orden cronologico, NO el orden de S.teams ──
  win.S.teams = [
    { id: "tA", name: "Equipo Tarde", color: "#111", schedule: { [ti]: "18:00" } },
    { id: "tB", name: "Equipo Manana", color: "#222", schedule: { [ti]: "09:00" } },
    { id: "tC", name: "Equipo Mediodia", color: "#333", schedule: { [ti]: "15:00" } }
  ];
  win.S.players = { tA: [], tB: [], tC: [] };
  win.S.matches = {};
  win.S.sessions = {};
  win.S.screen = "hoy";
  win.render();
  const html = win.document.getElementById("root").innerHTML;
  const posA = html.indexOf("Equipo Tarde");
  const posB = html.indexOf("Equipo Manana");
  const posC = html.indexOf("Equipo Mediodia");
  assert(posB > -1 && posC > -1 && posA > -1, "las 3 tarjetas de entrenamiento se renderizan");
  assert(posB < posC && posC < posA, "orden cronologico 09:00 -> 15:00 -> 18:00, no el orden de S.teams (tarde, manana, mediodia)");

  // ── Test B: barra urgente cuando ya toca pasar lista ──
  win.S.teams = [{ id: "tU", name: "Equipo Urgente", color: "#111", schedule: { [ti]: "00:00" } }];
  win.S.players = { tU: [{ id: "p1", name: "Jugadora Uno", number: 4 }] };
  win.S.sessions = {}; // sin lista pasada
  win.render();
  const htmlUrgent = win.document.getElementById("root").innerHTML;
  assert(htmlUrgent.includes("Toca pasar lista ahora"), "con hora 00:00 (ya pasada) y sin lista, la barra es urgente");
  assert(htmlUrgent.includes("Equipo Urgente"), "la barra urgente nombra al equipo correcto");

  // ── Test C: barra normal cuando el entreno aun no ha llegado ──
  win.S.teams = [{ id: "tP", name: "Equipo Proximo", color: "#111", schedule: { [ti]: "23:59" } }];
  win.S.players = { tP: [{ id: "p1", name: "Jugadora Uno", number: 4 }] };
  win.S.sessions = {};
  win.render();
  const htmlUpcoming = win.document.getElementById("root").innerHTML;
  assert(htmlUpcoming.includes("Próximo entrenamiento"), "con hora 23:59 (aun no llegada) y sin lista, la barra es informativa, no urgente");
  assert(!htmlUpcoming.includes("Toca pasar lista ahora"), "no se marca como urgente si la hora aun no ha llegado");

  // ── Test D: sin barra si la lista ya esta pasada ──
  win.S.teams = [{ id: "tD", name: "Equipo Hecho", color: "#111", schedule: { [ti]: "00:00" } }];
  win.S.players = { tD: [{ id: "p1", name: "Jugadora Uno", number: 4 }] };
  win.S.sessions = { ["tD_" + today]: { p1: "present" } };
  win.render();
  const htmlDone = win.document.getElementById("root").innerHTML;
  assert(!htmlDone.includes("Toca pasar lista ahora") && !htmlDone.includes("Próximo entrenamiento"), "sin barra si ya se paso la lista del unico entreno de hoy");

  // ══════════════════════════════════════════════════════════════════════
  // v3.0.0-dev.73 · B-HOY2: un "Entrenamiento sorpresa" (openHoyAddSheet,
  // fuera del horario semanal fijo) guarda su asistencia igual que
  // cualquiera otro (S.sessions[sk(teamId,date)]), pero el equipo no
  // aparecía en "Hoy" porque el filtro solo miraba el horario semanal fijo.
  // Mario pidió explícitamente que, si se ha pasado lista hoy, se vea en
  // "Hoy" aunque ese día de la semana no tenga hora puesta.
  // ══════════════════════════════════════════════════════════════════════

  // ── Test E: equipo SIN horario para hoy, pero CON asistencia ya guardada hoy -> SÍ aparece en "Hoy" ──
  win.S.teams = [{ id: "tS", name: "Equipo Sorpresa", color: "#111", schedule: {} }];
  win.S.players = { tS: [{ id: "p1", name: "Jugadora Uno", number: 4 }] };
  win.S.sessions = { ["tS_" + today]: { p1: "present" } };
  win.render();
  const htmlSurprise = win.document.getElementById("root").innerHTML;
  assert(htmlSurprise.includes("Equipo Sorpresa"), "B-HOY2: un entrenamiento sorpresa con asistencia ya guardada hoy aparece en la pantalla 'Hoy', aunque el equipo no tenga hora puesta ese día de la semana");
  assert(htmlSurprise.includes("✓ Pasada"), "B-HOY2: se muestra como 'Pasada' igual que cualquier otro entrenamiento con lista ya pasada");
  assert(htmlSurprise.includes("1 HOY"), "B-HOY2: el contador de 'HOY' del header cuenta también el entrenamiento sorpresa");

  // ── Test F: equipo SIN horario para hoy y SIN ninguna sesión guardada -> NO aparece (nada que mostrar todavía) ──
  win.S.teams = [{ id: "tN", name: "Equipo Sin Nada", color: "#111", schedule: {} }];
  win.S.players = { tN: [{ id: "p1", name: "Jugadora Uno", number: 4 }] };
  win.S.sessions = {};
  win.render();
  const htmlNothing = win.document.getElementById("root").innerHTML;
  assert(!htmlNothing.includes("Equipo Sin Nada"), "B-HOY2: sin horario y sin ninguna asistencia guardada hoy, el equipo sigue sin aparecer -- no se puede avisar de un entreno sorpresa que todavía no ha pasado nada");
  assert(htmlNothing.includes("Sin actividad hoy"), "B-HOY2: sin ningún equipo programado ni ninguna sorpresa con datos, se sigue mostrando el estado vacío de siempre");

  // ── Test G: un equipo SIN el campo 'schedule' en absoluto (dato antiguo) no revienta, ni programado ni con sesión de hoy ──
  win.S.teams = [{ id: "tLegacy", name: "Equipo Legado", color: "#111" }];
  win.S.players = { tLegacy: [{ id: "p1", name: "Jugadora Uno", number: 4 }] };
  win.S.sessions = {};
  let threwLegacyNoSession = false;
  try { win.render(); } catch (e) { threwLegacyNoSession = true; }
  assert(!threwLegacyNoSession, "B-HOY2: un equipo sin 'schedule' en absoluto (dato legado) no revienta la pantalla 'Hoy' cuando tampoco tiene sesión de hoy");
  const htmlLegacyNoSession = win.document.getElementById("root").innerHTML;
  assert(!htmlLegacyNoSession.includes("Equipo Legado"), "un equipo sin 'schedule' y sin sesión de hoy tampoco aparece, igual que uno con schedule:{}");

  // ── Test H: el mismo equipo legado (sin 'schedule'), pero CON sesión de hoy -> SÍ aparece, y tampoco revienta ──
  win.S.sessions = { ["tLegacy_" + today]: { p1: "present" } };
  let threwLegacyWithSession = false;
  try { win.render(); } catch (e) { threwLegacyWithSession = true; }
  assert(!threwLegacyWithSession, "B-HOY2: un equipo sin 'schedule' en absoluto pero CON sesión de hoy tampoco revienta (antes accedía directo a t.schedule[ti] sin comprobar que existiera)");
  const htmlLegacyWithSession = win.document.getElementById("root").innerHTML;
  assert(htmlLegacyWithSession.includes("Equipo Legado") && htmlLegacyWithSession.includes("✓ Pasada"), "B-HOY2: y si tiene sesión de hoy, aparece igual que cualquier entrenamiento sorpresa");

  // ── Test I: equipo programado hoy Y con sesión de hoy no se duplica (sigue contando solo una vez) ──
  win.S.teams = [{ id: "tBoth", name: "Equipo Normal", color: "#111", schedule: { [ti]: "10:00" } }];
  win.S.players = { tBoth: [{ id: "p1", name: "Jugadora Uno", number: 4 }] };
  win.S.sessions = { ["tBoth_" + today]: { p1: "present" } };
  win.render();
  const htmlBoth = win.document.getElementById("root").innerHTML;
  const occurrences = htmlBoth.split("Equipo Normal").length - 1;
  assert(occurrences === 1, "B-HOY2: un equipo que YA estaba programado hoy y además tiene sesión guardada no se duplica en la lista (sigue apareciendo una sola vez)");
  assert(htmlBoth.includes("1 HOY"), "el contador sigue contando 1, no 2, para ese mismo equipo");

  return report.summary();
}

module.exports = { run };
