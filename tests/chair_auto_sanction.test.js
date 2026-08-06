"use strict";
const { loadApp, newReporter } = require("./harness");

// B-CHAIR1: el badge 🪑 de la convocatoria ya no es un toggle manual libre —
// se deriva de autoSanctionLevel() a partir del historial de incidencias, y
// SOLO debe aplicar al primer partido cronológicamente posterior a la
// incidencia (nunca a todos los partidos futuros). El entrenador puede
// descartarlo para un partido concreto vía m.reducedMinutesDismissed.
async function run() {
  const report = newReporter("chair_auto_sanction");
  const win = await loadApp();
  win.S.teamId = "t1";

  const p1 = { id: "p1", name: "Jugadora Uno", incidents: [] };
  win.S.players = { t1: [p1] };

  const m1 = { id: "m1", date: "2026-08-10", convocados: ["p1"] };
  const m2 = { id: "m2", date: "2026-08-17", convocados: ["p1"] };
  const m3 = { id: "m3", date: "2026-08-24", convocados: ["p1"] };
  win.S.matches = { t1: [m1, m2, m3] };

  // Sin incidencias: no hay sanción.
  report.assert(win.autoSanctionLevel(p1, "t1", m1) === 0, "sin incidencias, autoSanctionLevel es 0");
  report.assert(win.reducedMinutesInfo(p1, "t1", m1) === null, "sin incidencias, reducedMinutesInfo es null");

  // 1ª incidencia (nivel 1, solo aviso verbal): no debe sancionar la convocatoria.
  p1.incidents.push({ id: "i1", date: "2026-08-05", level: 1 });
  report.assert(win.autoSanctionLevel(p1, "t1", m1) === 0, "incidencia nivel 1 no sanciona la convocatoria");

  // 2ª incidencia (nivel 2 = minutos reducidos), fechada antes de m1: debe
  // sancionar SOLO m1 (el primer partido siguiente a la fecha), no m2 ni m3.
  p1.incidents.push({ id: "i2", date: "2026-08-08", level: 2 });
  report.assert(win.autoSanctionLevel(p1, "t1", m1) === 2, "incidencia nivel 2 sanciona el primer partido siguiente (m1)");
  report.assert(win.autoSanctionLevel(p1, "t1", m2) === 0, "la sanción de nivel 2 NO se arrastra al segundo partido siguiente (m2)");
  report.assert(win.autoSanctionLevel(p1, "t1", m3) === 0, "la sanción de nivel 2 NO se arrastra a partidos posteriores (m3)");

  const info1 = win.reducedMinutesInfo(p1, "t1", m1);
  report.assert(!!info1 && /Minutos reducidos/.test(info1.label), "reducedMinutesInfo etiqueta nivel 2 como 'Minutos reducidos'");

  // 3ª incidencia (nivel 3 = banquillo), fechada entre m1 y m2: debe
  // sancionar m2 (el primer partido siguiente a ESA fecha), no m1 (ya pasado).
  p1.incidents.push({ id: "i3", date: "2026-08-12", level: 3 });
  report.assert(win.autoSanctionLevel(p1, "t1", m1) === 2, "m1 conserva solo la sanción de la incidencia anterior a su fecha");
  const lvl2 = win.autoSanctionLevel(p1, "t1", m2);
  report.assert(lvl2 === 3, "incidencia nivel 3 sanciona el primer partido siguiente a SU fecha (m2)");
  const info2 = win.reducedMinutesInfo(p1, "t1", m2);
  report.assert(!!info2 && /Banquillo/.test(info2.label), "reducedMinutesInfo etiqueta nivel 3 como 'Banquillo'");

  // Descarte manual: el entrenador puede ocultar el aviso para un partido
  // concreto sin tocar el historial de incidencias.
  m2.reducedMinutesDismissed = ["p1"];
  report.assert(win.reducedMinutesInfo(p1, "t1", m2) === null, "reducedMinutesDismissed oculta el aviso en ese partido");
  report.assert(win.autoSanctionLevel(p1, "t1", m2) === 3, "el descarte no borra el nivel calculado, solo lo oculta en la UI");

  // toggleReducedMinutesDismiss debe togglear m.reducedMinutesDismissed del
  // partido activo (S.matchId) y refrescar sin lanzar error aunque no haya
  // fila en el DOM.
  win.S.matchId = "m1";
  win.toggleReducedMinutesDismiss("p1");
  report.assert((m1.reducedMinutesDismissed || []).includes("p1"), "toggleReducedMinutesDismiss añade al array de descartados");
  win.toggleReducedMinutesDismiss("p1");
  report.assert(!(m1.reducedMinutesDismissed || []).includes("p1"), "toggleReducedMinutesDismiss vuelve a togglear (quita el descarte)");

  return report.summary();
}

module.exports = { run };
