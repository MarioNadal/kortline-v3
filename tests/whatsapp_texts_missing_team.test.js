"use strict";
const { loadApp, newReporter } = require("./harness");

// B-WATEXT1: auditoría de los textos compartidos por WhatsApp
// (buildDailyText, buildWeeklyText, buildEventoText, mConvText,
// shareMatchResult). Bug real encontrado: buildDailyText, buildWeeklyText y
// mConvText leían `t.coaches` sin comprobar antes que `t` (el equipo)
// existiera -- a diferencia de buildEventoText y shareMatchResult, que sí
// hacen `if(!t||...)return`. Con varios entrenadores compartiendo la misma
// base de datos en tiempo real (Firestore), si un equipo desaparece
// (borrado desde otro móvil, o una carrera de sincronización) mientras
// alguien tiene abierta la pantalla de "Compartir", esto lanzaba
// "Cannot read properties of undefined (reading 'coaches')" y rompía la
// pantalla. Comprueba que las tres funciones ahora devuelven un valor vacío
// en vez de lanzar, igual que ya hacían buildEventoText/shareMatchResult.
async function run() {
  const report = newReporter("whatsapp_texts_missing_team");
  const win = await loadApp();

  win.S.teamId = "t1";
  win.S.teams = []; // el equipo t1 ya no existe
  win.S.players = { t1: [{ id: "p1", name: "Ana García", number: 4 }] };
  win.S.sessions = { "t1_2026-08-06": { p1: "present" } };
  win.S.matches = { t1: [{ id: "m1", date: "2026-08-06", convocados: ["p1"] }] };
  win.S.events = { t1: [{ id: "e1", tipo: "partido", fecha: "2026-08-06", convocados: ["p1"] }] };

  let threw = false;
  try {
    win.buildDailyText("t1", "2026-08-06", false, {});
  } catch (e) {
    threw = true;
  }
  report.assert(!threw, "buildDailyText no lanza si el equipo no existe");
  report.assert(win.buildDailyText("t1", "2026-08-06", false, {}) === "", "buildDailyText devuelve '' si el equipo no existe");

  threw = false;
  try {
    win.buildWeeklyText("t1", false, {});
  } catch (e) {
    threw = true;
  }
  report.assert(!threw, "buildWeeklyText no lanza si el equipo no existe");
  report.assert(win.buildWeeklyText("t1", false, {}) === null, "buildWeeklyText devuelve null si el equipo no existe (mismo contrato que 'sin sesiones')");

  threw = false;
  try {
    win.mConvText("t1", "m1", false, {});
  } catch (e) {
    threw = true;
  }
  report.assert(!threw, "mConvText no lanza si el equipo no existe");
  report.assert(win.mConvText("t1", "m1", false, {}) === "", "mConvText devuelve '' si el equipo no existe");

  // Estas dos ya tenían el guard antes de esta sesión -- se comprueban aquí
  // también para que las 5 funciones queden cubiertas por el mismo test y
  // no se vuelvan a desincronizar sin que salte un fallo.
  threw = false;
  try {
    win.buildEventoText("t1", "e1", {});
  } catch (e) {
    threw = true;
  }
  report.assert(!threw, "buildEventoText no lanza si el equipo no existe (ya lo comprobaba)");

  win.S.matchId = "m1";
  threw = false;
  try {
    win.shareMatchResult();
  } catch (e) {
    threw = true;
  }
  report.assert(!threw, "shareMatchResult no lanza si el equipo no existe (ya lo comprobaba)");

  // Caso normal (equipo SÍ existe): las tres funciones arregladas siguen
  // devolviendo el texto de siempre, con los datos reales.
  win.S.teams = [{ id: "t1", name: "CB Jaca", category: "Infantil", coaches: ["Mario"] }];
  const daily = win.buildDailyText("t1", "2026-08-06", false, {});
  report.assert(typeof daily === "string" && daily.includes("Ana García"), "buildDailyText con equipo real sigue incluyendo al jugador");
  const weekly = win.buildWeeklyText("t1", false, {});
  report.assert(typeof weekly === "string" && weekly.includes("CB Jaca"), "buildWeeklyText con equipo real sigue funcionando");
  const conv = win.mConvText("t1", "m1", false, {});
  report.assert(typeof conv === "string" && conv.includes("Ana García"), "mConvText con equipo real sigue incluyendo al convocado");

  return report.summary();
}

module.exports = { run };
