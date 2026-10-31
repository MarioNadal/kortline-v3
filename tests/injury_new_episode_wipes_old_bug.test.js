"use strict";
// v3.0.0-dev.100 · B-INJ7: bug CRÍTICO encontrado en la auditoría exhaustiva
// pedida por Mario (2026-10-31). applyInjuryToSessions() limpia marcas
// "_jr=injury" que quedan fuera del rango de la lesión que se está guardando
// -- pero antes de este fix lo hacía sobre TODO el histórico del equipo, sin
// distinguir a qué EPISODIO de lesión pertenecía cada marca. Como
// isInjured()/injuryStart() (usadas por _attEffectiveState) solo miran la
// lesión ACTIVA actual, no el historial (injuryHistory), dar de alta una
// lesión NUEVA (o mover la fecha de una activa hacia adelante) del MISMO
// jugador borraba en silencio la asistencia "justificado" ya archivada de un
// episodio ANTERIOR ya cerrado -- esos días pasaban a verse como "Presente"
// por defecto, en vez de "Justificado (lesión)". Asistencia real corrompida
// sin que el entrenador tocara nada de esas fechas.
//
// Fix: nuevo parámetro opcional `prevStartDate` en applyInjuryToSessions --
// la limpieza del paso 1 nunca toca una fecha anterior a `prevStartDate`
// (el startDate que YA tenía este mismo episodio antes de este guardado,
// solo si seguía activo). Una lesión nueva no pasa prevStartDate -> no
// limpia nada; editar una lesión activa limpia solo su propio tramo.
const { loadApp, newReporter } = require("./harness");

async function run() {
  const report = newReporter("injury_new_episode_wipes_old_bug");
  const win = await loadApp();
  const assert = (cond, msg) => report.assert(cond, msg);

  const today = win.td();
  // Episodio VIEJO, ya cerrado: lesión de sept, de alta hace tiempo.
  const oldStart = win._addDaysISO(today, -40);
  const oldEnd = win._addDaysISO(today, -25);
  const dOldEpisode = win._addDaysISO(today, -30); // dentro del episodio viejo
  // Episodio NUEVO: empieza bastante después de que el viejo se cerrara.
  const newStart = win._addDaysISO(today, -5);
  const dNewEpisode = win._addDaysISO(today, -3); // dentro del episodio nuevo
  const dBetween = win._addDaysISO(today, -15); // entre los dos episodios, sano

  win.S.teams = [{ id: "t1", name: "Cadete Masculino", color: "#F06318", schedule: {} }];
  win.S.players = {
    t1: [
      { id: "p1", name: "Jugador Recurrente", number: 4, addedAt: "2026-07-01", injury: null, injuryHistory: [] },
      { id: "p2", name: "Compañero Sano", number: 5, addedAt: "2026-07-01" }
    ]
  };
  win.S.matches = {};
  win.S.events = {};
  win.S.teamId = "t1";
  win.S.date = today;

  // ── Paso 1: simula el episodio VIEJO completo (alta + recuperación) ──
  win.S.sessions = {
    [`t1_${dOldEpisode}`]: { p2: "present" }, // p1 sin marca -> se backfillea
    [`t1_${dBetween}`]: { p1: "present", p2: "present" }, // p1 YA recuperado, fue a entrenar
    [`t1_${dNewEpisode}`]: { p2: "present" }
  };
  win.applyInjuryToSessions("t1", "p1", oldStart, oldEnd, "Esguince viejo", undefined);
  assert(win.S.sessions[`t1_${dOldEpisode}`].p1 === "excused" && win.S.sessions[`t1_${dOldEpisode}`].p1_jr === "injury",
    "preparación: el episodio viejo queda correctamente backfilleado como justificado por lesión");
  // Se archiva el episodio viejo (igual que confirmInjuryRecovery) y se deja sano.
  win.S.players.t1[0].injury = null;
  win.S.players.t1[0].injuryHistory = [{ startDate: oldStart, endDate: oldEnd, days: 15 }];

  // Control ANTES del episodio nuevo: el día del episodio viejo sigue justificado.
  assert(win.S.sessions[`t1_${dOldEpisode}`].p1 === "excused", "antes de la lesión nueva: el día del episodio viejo sigue 'excused' (justificado)");

  // ── Paso 2: lesión NUEVA del MISMO jugador, meses después (saveInjury, sin prevStartDate porque prev=null) ──
  win.applyInjuryToSessions("t1", "p1", newStart, null, "Lesión nueva", undefined);
  win.S.players.t1[0].injury = { active: true, startDate: newStart, origin: "training", notes: "Lesión nueva" };

  // ── Verificaciones del fix ──
  assert(win.S.sessions[`t1_${dOldEpisode}`].p1 === "excused" && win.S.sessions[`t1_${dOldEpisode}`].p1_jr === "injury",
    "B-INJ7 FIX: el día del episodio VIEJO sigue 'excused'/'injury' -- la lesión nueva no lo borra");
  assert(win.S.sessions[`t1_${dBetween}`].p1 === "present",
    "el día SANO entre los dos episodios (el jugador fue a entrenar de verdad) sigue 'present', nunca se tocó");
  assert(win.S.sessions[`t1_${dNewEpisode}`].p1 === "excused" && win.S.sessions[`t1_${dNewEpisode}`].p1_jr === "injury" && win.S.sessions[`t1_${dNewEpisode}`].p1_jn === "Lesión nueva",
    "el episodio NUEVO se backfillea correctamente con su propia nota");
  // Control: el compañero sano nunca se ve afectado por nada de esto.
  assert(win.S.sessions[`t1_${dOldEpisode}`].p2 === "present" && win.S.sessions[`t1_${dBetween}`].p2 === "present" && win.S.sessions[`t1_${dNewEpisode}`].p2 === "present",
    "el compañero sano no se ve afectado en ningún día por ninguno de los dos episodios");

  // ── Paso 3: editar la fecha de la lesión NUEVA hacia adelante -- esto SÍ
  // debe limpiar el tramo que deja de estar cubierto de ESTE episodio,
  // pero nunca tocar el episodio viejo (prevStartDate=newStart lo acota) ──
  const newStartMovedForward = win._addDaysISO(today, -2);
  win.applyInjuryToSessions("t1", "p1", newStartMovedForward, null, "Lesión nueva", newStart);
  assert(win.S.sessions[`t1_${dNewEpisode}`].p1 === undefined,
    "mover la fecha del episodio NUEVO hacia adelante limpia el tramo que ya no cubre (dNewEpisode quedó antes de la nueva fecha)");
  assert(win.S.sessions[`t1_${dOldEpisode}`].p1 === "excused" && win.S.sessions[`t1_${dOldEpisode}`].p1_jr === "injury",
    "y sigue sin tocar el episodio VIEJO, incluso editando la fecha del nuevo (acotado por prevStartDate)");

  return report.summary();
}

module.exports = { run };
