"use strict";
// v3.0.0-dev.96 · Bug real reportado por Mario: se dio de alta (registró) una
// lesión a un jugador que, dentro del rango de fechas de esa lesión, SÍ había
// asistido a entrenar (marca explícita "present" en S.sessions ese día) --
// pero applyInjuryToSessions() pisaba SIEMPRE esa marca con "excused"
// (jr:"injury"), como si el jugador no hubiera ido, sin mirar si ya había un
// estado explícito distinto. Pasaba al crear la lesión (saveInjury), al
// editarla (saveInjury con startDate distinto) y al dar el alta médica
// (confirmInjuryRecovery), porque las tres llaman a applyInjuryToSessions().
//
// El fix: applyInjuryToSessions() ahora solo escribe excused+injury en un día
// si ese día no tiene ya una marca explícita, O si la marca explícita que
// tiene es el propio auto-marcado de ESTA misma lesión (excused + jr:injury,
// para poder refrescar la nota). Nunca pisa "present"/"late"/"absent", ni un
// "excused" con otro motivo de justificación distinto.
const { loadApp, newReporter } = require("./harness");

async function run() {
  const report = newReporter("injury_backfill_overwrite_bug");
  const win = await loadApp();
  const assert = (cond, msg) => report.assert(cond, msg);

  const today = win.td();
  const startDate = win._addDaysISO(today, -10);
  const dBefore = win._addDaysISO(today, -12); // antes del rango de la lesión
  const dPresentBug = win._addDaysISO(today, -8); // dentro del rango -- SÍ asistió (el bug)
  const dUnmarked = win._addDaysISO(today, -7); // dentro del rango -- sin marca explícita
  const dLate = win._addDaysISO(today, -6); // dentro del rango -- explícito "late"
  const dExcusedOther = win._addDaysISO(today, -5); // dentro del rango -- excused por otro motivo
  const dAbsent = win._addDaysISO(today, -4); // dentro del rango -- explícito "absent"

  win.S.teams = [{ id: "t1", name: "Cadete Masculino", color: "#F06318", category: "Cadete", gender: "Masculino", schedule: {} }];
  win.S.players = {
    t1: [
      {
        id: "p1", name: "Jugador Lesionado", number: 4, addedAt: "2026-08-01",
        injury: { active: true, startDate, origin: "training" }
      },
      { id: "p2", name: "Compañero Sano", number: 5, addedAt: "2026-08-01" }
    ]
  };
  win.S.sessions = {
    ["t1_" + dBefore]: { p1: "present", p2: "present" },
    ["t1_" + dPresentBug]: { p1: "present", p2: "present" },
    ["t1_" + dUnmarked]: { p2: "present" },
    ["t1_" + dLate]: { p1: "late", p2: "present" },
    ["t1_" + dExcusedOther]: { p1: "excused", p1_jr: "personal", p2: "present" },
    ["t1_" + dAbsent]: { p1: "absent", p2: "present" }
  };
  win.S.matches = {};
  win.S.events = {};
  win.S.teamId = "t1";
  win.S.date = today;

  // ── 1) Dar de alta la lesión (igual que hace saveInjury) ──
  win.applyInjuryToSessions("t1", "p1", startDate, null, "Tobillo");

  const sess = win.S.sessions;
  assert(sess["t1_" + dBefore].p1 === "present", "Día ANTES del rango: no se toca (sigue 'present')");
  assert(sess["t1_" + dPresentBug].p1 === "present", "BUG: día dentro del rango con asistencia explícita ('present') NO debe pisarse con 'excused'");
  assert(sess["t1_" + dPresentBug].p1_jr === undefined, "BUG: tampoco se añade un motivo de justificación a un día que sí fue 'present'");
  assert(sess["t1_" + dUnmarked].p1 === "excused" && sess["t1_" + dUnmarked].p1_jr === "injury", "Día SIN marca explícita dentro del rango: se backfillea normal a 'excused'+'injury'");
  assert(sess["t1_" + dUnmarked].p1_jn === "Tobillo", "El backfill normal sí escribe la nota en el día sin marca");
  assert(sess["t1_" + dLate].p1 === "late", "Día con 'late' explícito dentro del rango: no se pisa");
  assert(sess["t1_" + dExcusedOther].p1 === "excused" && sess["t1_" + dExcusedOther].p1_jr === "personal", "Día ya 'excused' por OTRO motivo ('personal'): se mantiene su propio motivo, no se cambia a 'injury'");
  assert(sess["t1_" + dAbsent].p1 === "absent", "Día con 'absent' explícito dentro del rango: no se pisa");
  // Control: el jugador sano nunca se ve afectado.
  assert(sess["t1_" + dPresentBug].p2 === "present" && sess["t1_" + dUnmarked].p2 === "present", "El compañero sano no se ve afectado por el backfill del lesionado");

  // ── 2) Editar la lesión (p.ej. añadir/cambiar la nota) -- debe poder
  //      refrescar la nota en el día que SÍ auto-marcó ella misma, sin tocar
  //      los días con marca explícita de otra cosa ──
  win.applyInjuryToSessions("t1", "p1", startDate, null, "Esguince de tobillo (grado 2)");
  assert(sess["t1_" + dUnmarked].p1_jn === "Esguince de tobillo (grado 2)", "Editar la lesión SÍ actualiza la nota en el día que ella misma auto-marcó");
  assert(sess["t1_" + dPresentBug].p1 === "present", "Editar la lesión sigue sin pisar el día que fue 'present'");
  assert(sess["t1_" + dLate].p1 === "late", "Editar la lesión sigue sin pisar el día 'late'");
  assert(sess["t1_" + dExcusedOther].p1_jr === "personal", "Editar la lesión sigue sin pisar el 'excused' de otro motivo");

  // ── 3) Dar de alta médica (confirmInjuryRecovery) -- usa la misma función
  //      por debajo, así que debe respetar igualmente los días explícitos ──
  win.S.players.t1[0].injury = { active: true, startDate, origin: "training", notes: "Esguince de tobillo (grado 2)" };
  win.confirmInjuryRecovery("p1");
  assert(sess["t1_" + dPresentBug].p1 === "present", "confirmInjuryRecovery(): el día 'present' dentro del rango sigue sin pisarse al dar el alta");
  assert(sess["t1_" + dLate].p1 === "late", "confirmInjuryRecovery(): el día 'late' sigue sin pisarse al dar el alta");
  assert(sess["t1_" + dAbsent].p1 === "absent", "confirmInjuryRecovery(): el día 'absent' sigue sin pisarse al dar el alta");
  const p1After = win.S.players.t1.find(x => x.id === "p1");
  assert(p1After.injury === null, "confirmInjuryRecovery(): limpia la lesión activa como siempre");

  return report.summary();
}

module.exports = { run };
