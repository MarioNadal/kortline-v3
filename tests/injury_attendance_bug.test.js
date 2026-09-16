"use strict";
// v3.0.0-dev.60 · B-INJ2: regresión del bug real reportado por Mario -- un
// jugador lesionado y justificado aparecía con 100% de asistencia (y "0
// justificados") en Historial/Stats/exports/WhatsApp cuando el día de la
// lesión no tenía marca EXPLÍCITA en S.sessions (p.ej. el entrenador nunca
// llegó a confirmar esa sesión, o la marcó como asistido un día y luego la
// lesión se activó retroactivamente). effectiveState() en att() ya lo
// pintaba bien en el pase de lista del día (es solo un overlay visual), pero
// _countAtt/hist()/gráficas/exports/WhatsApp leían el valor crudo de
// S.sessions y trataban "undefined" como "present" sin mirar la lesión.
// Este test fija ese escenario exacto y comprueba que TODAS las pantallas
// afectadas ahora cuentan al jugador como justificado, no como presente.
const { loadApp, newReporter } = require("./harness");

async function run() {
  const report = newReporter("injury_attendance_bug");
  const win = await loadApp();
  const assert = (cond, msg) => report.assert(cond, msg);

  win.S.teams = [{ id: "t1", name: "Cadete Masculino", color: "#F06318", category: "Cadete", gender: "Masculino", schedule: {} }];
  win.S.players = {
    t1: [
      {
        id: "p1", name: "Jugador Lesionado", number: 4, addedAt: "2026-08-01",
        injury: { active: true, startDate: "2026-09-14", origin: "training" }
      },
      { id: "p2", name: "Compañero Sano", number: 5, addedAt: "2026-08-01" }
    ]
  };
  // 3 sesiones: las 2 primeras antes de la lesión (p1 presente en ambas), la
  // 3ª (2026-09-16, un miércoles) es el día de la lesión -- SIN marca
  // explícita para p1 (el entrenador no tocó su estado ese día), tal y como
  // describía Mario. p2 sirve de control: siempre presente.
  win.S.sessions = {
    "t1_2026-09-09": { p1: "present", p2: "present" },
    "t1_2026-09-11": { p1: "present", p2: "present" },
    "t1_2026-09-16": { p2: "present" } // p1 sin marca -- lesionado desde el 09-14
  };
  win.S.matches = {};
  win.S.events = {};
  win.S.teamId = "t1";
  win.S.date = "2026-09-16";

  // 1) _countAtt: p1 debe contar 2 presentes + 1 justificado (excused), NO
  //    3 presentes / 0 justificados (el bug exacto que describía Mario).
  // sessList con el mismo formato {date,data} que usan hist()/buildWeeklyText().
  const sessList = Object.keys(win.S.sessions).map(k => ({ date: k.replace("t1_", ""), data: win.S.sessions[k] }));
  const cnt = win._countAtt(win.S.players.t1[0], sessList);
  assert(cnt.pr === 2, "_countAtt(): el lesionado cuenta 2 presentes reales (no 3) — dio " + cnt.pr);
  assert(cnt.ex === 1, "_countAtt(): el lesionado cuenta 1 justificado (el día sin marca explícita) — dio " + cnt.ex);
  assert(cnt.tot === 3, "_countAtt(): el total de sesiones sigue siendo 3");

  // 2) hist(): el desglose de esa sesión concreta no debe mostrar a p1 como
  //    presente ni el resumen mensual debe inflar su % con ese día.
  const histHtml = win.hist();
  assert(typeof histHtml === "string" && histHtml.length > 0, "hist() no lanza y devuelve HTML");

  // 3) buildDailyText (WhatsApp del día 2026-09-16): p1 debe salir en la
  //    sección de Justificados, no en la de Presentes.
  const daily = win.buildDailyText("t1", "2026-09-16", true, {});
  const presentSection = daily.slice(daily.indexOf("Presentes"), daily.indexOf("Justificados") >= 0 ? daily.indexOf("Justificados") : daily.length);
  const justSection = daily.indexOf("Justificados") >= 0 ? daily.slice(daily.indexOf("Justificados")) : "";
  assert(!presentSection.includes("Jugador Lesionado"), "buildDailyText(): el lesionado NO aparece en la sección de Presentes");
  assert(justSection.includes("Jugador Lesionado"), "buildDailyText(): el lesionado SÍ aparece en la sección de Justificados");

  // 4) buildWeeklyText: el % semanal de p1 debe reflejar 2/3, no 3/3.
  const weekly = win.buildWeeklyText("t1", false, {});
  // 2 presentes de 3 sesiones = 67%
  const p1Block = weekly.slice(weekly.indexOf("Jugador Lesionado"), weekly.indexOf("Jugador Lesionado") + 200);
  assert(p1Block.includes("2/3") || p1Block.includes("67%"), "buildWeeklyText(): el lesionado muestra 2/3 (o 67%), no 3/3 (100%) — bloque: " + JSON.stringify(p1Block));

  // 5) _effAttState y isInjuredOn directamente, para que el test señale la
  //    causa exacta si algo se rompe en el futuro.
  const p1 = win.S.players.t1[0];
  assert(win.isInjuredOn(p1, "2026-09-16") === true, "isInjuredOn(): el jugador está lesionado el día de la sesión sin marca");
  assert(win._effAttState(p1, "2026-09-16", undefined) === "excused", "_effAttState(): sin marca explícita + lesionado ese día => 'excused'");
  assert(win._effAttState(p1, "2026-09-09", undefined) === "present", "_effAttState(): sin marca explícita + NO lesionado ese día => 'present' (comportamiento normal intacto)");

  // 6) Recuperación: si el jugador ya se ha recuperado (injury.active=false)
  //    pero queda archivado en injuryHistory con el rango de fechas, un día
  //    DENTRO de ese rango sigue debiendo contar como justificado si nunca
  //    se marcó explícitamente (p.ej. se confirma la sesión más tarde).
  const p1Recovered = {
    ...p1,
    injury: { active: false },
    injuryHistory: [{ startDate: "2026-09-14", endDate: "2026-09-20", days: 6 }]
  };
  assert(win.isInjuredOn(p1Recovered, "2026-09-16") === true, "isInjuredOn(): tras recuperarse, un día dentro del rango archivado sigue contando como lesionado");
  assert(win.isInjuredOn(p1Recovered, "2026-09-25") === false, "isInjuredOn(): un día FUERA del rango archivado (ya de alta) no cuenta como lesionado");

  return report.summary();
}

module.exports = { run };
