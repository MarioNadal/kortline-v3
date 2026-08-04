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

  return report.summary();
}

module.exports = { run };
