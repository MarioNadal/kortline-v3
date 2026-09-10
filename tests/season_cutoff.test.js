"use strict";
// v3.0.0-dev.55 · B-SEASON1: petición del usuario -- los entrenamientos de
// pretemporada (antes de una fecha configurable, "Inicio de temporada" en
// Ajustes -> Estadísticas) se siguen registrando exactamente igual que
// cualquier otro (pasar lista, Historial, hoja "Sesiones" del Excel...)
// pero NO cuentan en los agregados de temporada: % de asistencia, riesgo
// FEB, gráficas, resumen semanal, exports. S.cfg.seasonStart vacío/null
// (el valor por defecto, para no romper ningún club que no lo configure)
// = sin recorte, comportamiento de siempre.
const { loadApp, newReporter } = require("./harness");

async function run() {
  const report = newReporter("season_cutoff");
  const win = await loadApp();
  const assert = (cond, msg) => report.assert(cond, msg);
  const pc = win.pc;

  assert(win.S.cfg.seasonStart === null || win.S.cfg.seasonStart === undefined, "por defecto S.cfg.seasonStart no está configurado (ningún club se ve afectado sin tocar Ajustes)");
  assert(win._isDateInSeason("2020-01-01") === true, "_isDateInSeason(): sin seasonStart configurado, cualquier fecha cuenta (comportamiento de siempre)");

  win.S.teams = [{ id: "t1", name: "Mi Equipo", color: "#F06318", category: "Cadete", schedule: {} }];
  win.S.players = {
    t1: [
      { id: "p1", name: "Ana García", number: 4, addedAt: "2026-07-01" },
      { id: "p2", name: "Bea López", number: 5, addedAt: "2026-07-01" }
    ]
  };
  // Pretemporada (2 sesiones) + temporada (2 sesiones), a propósito con
  // resultados que darían un % distinto según se cuente la pretemporada o no.
  win.S.sessions = {
    "t1_2026-09-01": { p1: "absent", p2: "present" }, // pretemporada
    "t1_2026-09-05": { p1: "absent", p2: "present" }, // pretemporada
    "t1_2026-09-14": { p1: "present", p2: "present" }, // ya es temporada (límite incluido)
    "t1_2026-09-20": { p1: "present", p2: "absent" }   // temporada
  };
  win.S.matches = {};
  win.S.events = {};
  win.S.teamId = "t1";
  win.S.statsMonth = null;
  win.S.histMonth = null;

  // ── Sin seasonStart configurado: comportamiento de siempre (todo cuenta) ──
  const teamHtmlSinCorte = win.team();
  const sinCorte = pc(2 + 3, 4 + 4); // p1: 2/4, p2: 3/4 -> media ponderada
  assert(teamHtmlSinCorte.includes(`${sinCorte}%`), `team(): sin seasonStart, la media de asistencia cuenta las 4 sesiones (${sinCorte}%)`);

  // ── Con seasonStart = 2026-09-14: solo cuentan las 2 sesiones de temporada ──
  win.S.cfg.seasonStart = "2026-09-14";
  assert(win._isDateInSeason("2026-09-13") === false, "_isDateInSeason(): un día antes del corte no cuenta");
  assert(win._isDateInSeason("2026-09-14") === true, "_isDateInSeason(): el propio día del corte SÍ cuenta (límite incluido)");
  assert(win._isDateInSeason("2026-09-20") === true, "_isDateInSeason(): días posteriores cuentan");

  const conCorte = pc(2 + 1, 2 + 2); // p1: 2/2 (presente en las 2 de temporada), p2: 1/2 -> 75%
  const teamHtmlConCorte = win.team();
  assert(teamHtmlConCorte.includes(`${conCorte}%`), `team(): con seasonStart, la media de asistencia (Asistencia media) solo cuenta las 2 sesiones de temporada (${conCorte}%)`);
  assert(!teamHtmlConCorte.includes(`${sinCorte}%`) || sinCorte === conCorte, "team(): ya no aparece la media \"inflada\" por la pretemporada (salvo que coincidiera por casualidad)");
  assert(teamHtmlConCorte.includes("2 entrenamiento"), "team(): el contador de entrenamientos de la barra también baja a 2 (coincide con el % mostrado)");

  // ── stats(): la tabla de temporada también respeta el corte ──
  const statsHtml = win.stats();
  const p1PctConCorte = pc(2, 2); // p1: presente las 2 sesiones de temporada -> 100%
  assert(statsHtml.includes(`${p1PctConCorte}%`), "stats(): el % de p1 en la tabla de temporada refleja solo las sesiones de temporada");

  // ── hist(): el día a día NO cambia (sigue mostrando lo que pasó de
  // verdad), solo la media del mes se ve afectada ──
  win.S.histMonth = "2026-09";
  const histHtml = win.hist();
  // El 1 de septiembre (pretemporada): p1 ausente, p2 presente -> 1/2 = 50% ese día en concreto.
  const sept1Idx = histHtml.search(/1 sept/);
  assert(sept1Idx >= 0, "hist(): la sesión del 1 de septiembre (pretemporada) sigue apareciendo en el listado de Historial, sin excluirla");
  // La media del mes (mStats) debe ser la de temporada (2 sesiones), no la de los 4 días del mes.
  assert(histHtml.includes(`${conCorte}%`), "hist(): la \"Media\" del mes en Historial respeta el corte de temporada (solo las 2 sesiones de temporada)");

  // ── stats(): si SOLO hay pretemporada registrada, se avisa en vez de
  // enseñar una tabla vacía confusa ──
  win.S.sessions = {
    "t1_2026-09-01": { p1: "present", p2: "present" },
    "t1_2026-09-05": { p1: "present", p2: "present" }
  };
  win.S.statsMonth = null;
  const statsSoloPretemporadaHtml = win.stats();
  assert(statsSoloPretemporadaHtml.includes("pretemporada"), "stats(): con solo sesiones de pretemporada registradas, avisa de forma explícita en vez de una tabla vacía");
  assert(statsSoloPretemporadaHtml.includes("Ver Historial"), "stats(): ese aviso ofrece ir a Historial para consultar esos entrenamientos");

  // ── computeInjurySnapshot(): tampoco cuenta pretemporada al congelar el % ──
  const sessList = Object.entries(win.S.sessions).map(([k, v]) => ({ date: k.replace("t1_", ""), data: v }));
  const snap = win.computeInjurySnapshot(win.S.players.t1[0], "2026-09-10", sessList);
  assert(snap.tot === 0 && snap.pct === 100, "computeInjurySnapshot(): con seasonStart activo, un historial 100% de pretemporada no cuenta (tot:0, pct:100 por defecto) en vez de reflejar esas sesiones");

  // ── Ajustes: el campo se guarda y se puede volver a desactivar (vacío) ──
  win.S.teamId = "t1";
  win.openClubSettings();
  const input = win.document.getElementById("cfg-season-start");
  assert(!!input, "openClubSettings(): existe el campo de fecha \"Inicio de temporada\"");
  assert(input.value === "2026-09-14", "openClubSettings(): el campo precarga el valor actual de S.cfg.seasonStart");
  input.value = "2026-10-01";
  win.saveClubSettings();
  assert(win.S.cfg.seasonStart === "2026-10-01", "saveClubSettings(): guarda la nueva fecha de inicio de temporada");

  win.openClubSettings();
  win.document.getElementById("cfg-season-start").value = "";
  win.saveClubSettings();
  assert(win.S.cfg.seasonStart === null, "saveClubSettings(): dejar el campo vacío desactiva el corte (vuelve a null, no a una cadena vacía)");
  assert(win._isDateInSeason("2020-01-01") === true, "_isDateInSeason(): tras desactivarlo desde Ajustes, cualquier fecha vuelve a contar");

  return report.summary();
}

module.exports = { run };
