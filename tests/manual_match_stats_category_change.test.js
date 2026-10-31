"use strict";
// v3.0.0-dev.103 · auditoría exhaustiva -- cierre de la tarea #12: ¿qué pasa
// si un equipo cambia de categoría A MITAD DE TEMPORADA, con partidos que
// ya tienen estadísticas manuales guardadas de ANTES del cambio? isSenior
// se deriva de t.category en el momento de renderizar (nunca se guarda
// "congelado" en el partido ni en manualStats), así que en teoría el
// formulario que se muestra para un partido viejo debería seguir la
// categoría ACTUAL del equipo, no la que tenía cuando se jugó el partido
// -- de nuevo, "en teoría" no es "probado".
//
// Dos escenarios reales de un club:
// 1) Un equipo "Cadete" asciende a "Senior" (o se reclasifica) a mitad de
//    temporada. Los partidos ya anotados en formulario reducido deben
//    seguir mostrándose correctamente (no reventar) aunque ahora, con la
//    categoría nueva, el modal les ofrezca el box score completo para
//    partidos FUTUROS. Los datos ya guardados (sin rebotes/asistencias/etc,
//    solo min/p1/p2/p3) deben conservarse intactos -- nada se borra nunca.
// 2) Al revés: un equipo "Senior" se reclasifica a "Junior". Los partidos
//    con box score completo ya guardado deben seguir íntegros (incluidas
//    las columnas que el formulario reducido ni muestra), y el modal para
//    partidos nuevos debe pasar a ofrecer el formulario reducido.
const { loadApp, newReporter } = require("./harness");

async function run() {
  const report = newReporter("manual_match_stats_category_change");
  const win = await loadApp();
  const document = win.document;
  const assert = (cond, msg) => report.assert(cond, msg);

  function setInput(pid, k, v) {
    const row = document.querySelector(`#m-manual-stats tr[data-ms-pid="${pid}"]`);
    const inp = row && row.querySelector(`[data-k="${k}"]`);
    if (inp) { inp.value = String(v); inp.dispatchEvent(new win.Event("input", { bubbles: true })); }
  }

  win.S.players = { tc: [{ id: "p1", name: "Jugadora Uno", number: 4, addedAt: "2026-07-01" }] };
  win.S.sessions = {};
  win.S.teamId = "tc";

  // ════════════════════════════════════════════════════════════════
  // Escenario 1: Cadete -> Senior a mitad de temporada.
  // ════════════════════════════════════════════════════════════════
  win.S.teams = [{ id: "tc", name: "Equipo Ascendido", category: "Cadete", color: "#F06318", schedule: {} }];
  const oldMatch = { id: "mOld", rival: "Rival Viejo", date: "2026-09-01", quarters: 4, qMins: 10, location: "home", matchMode: "quarters", convocados: ["p1"], titulares: [], capitan: null, q: [null, null, null, null, null, null, null, null], notes: "" };
  win.S.matches = { tc: [oldMatch] };
  win.S.matchId = "mOld";
  win.openManualStatsModal(0);
  setInput("p1", "min", 7); setInput("p1", "p2m", 3); setInput("p1", "p1m", 1); setInput("p1", "p1a", 2); // 1 de 2 TL
  win.saveManualStatsQuarter(0);
  document.getElementById("m-manual-stats")?.remove();
  const q0Old = JSON.stringify(oldMatch.manualStats.byQuarter[0].p1);
  assert(oldMatch.manualStats.byQuarter[0].p1.p2m === 3 && oldMatch.manualStats.byQuarter[0].p1.p1a === 1,
    "Escenario 1 (Cadete): el partido viejo guarda bien sus datos reducidos antes del ascenso (p1a ya convertido a fallos: 2 intentados - 1 anotado = 1)");

  // -- Ascenso: el equipo pasa a Senior. --
  win.S.teams[0].category = "Senior";

  // El partido VIEJO (jugado como reducido) no debe perder ni corromper sus
  // datos solo por re-renderizarse bajo la categoría nueva.
  win.S.screen = "matchDetail";
  win.render();
  assert(JSON.stringify(oldMatch.manualStats.byQuarter[0].p1) === q0Old,
    "Escenario 1: tras el ascenso a Senior, los datos YA guardados del partido viejo (formulario reducido) no se tocan ni se pierden con el simple hecho de volver a renderizar matchDetail()");
  const detailHtmlAfterPromo = document.getElementById("root")?.innerHTML || "";
  assert(detailHtmlAfterPromo.includes(String(win._msPts ? win._msPts(oldMatch.manualStats.byQuarter[0].p1) : ""))
    || detailHtmlAfterPromo.includes('id="ms-summary-table"'),
    "Escenario 1: la tabla-resumen del partido viejo sigue renderizándose con normalidad tras el ascenso");
  // Y como ahora la categoría es Senior, el resumen ya NO debe ofrecer +/-
  // (columna propia de categorías reducidas) para ESTE partido, aunque sus
  // datos se anotaran cuando el equipo aún era Cadete -- isSenior se deriva
  // siempre de la categoría ACTUAL del equipo, no de la de cuando se jugó.
  assert(!detailHtmlAfterPromo.includes("savePlusMinus()"),
    "Escenario 1: tras el ascenso, incluso el partido viejo se trata ya como Senior (sin +/-) -- isSenior depende de la categoría actual del equipo, no de una 'congelada' en el partido");

  // El modal para un partido NUEVO (jugado ya como Senior) debe ofrecer el
  // box score completo, no el reducido.
  const newMatch = { id: "mNew", rival: "Rival Nuevo", date: "2026-10-15", quarters: 4, qMins: 10, location: "home", matchMode: "quarters", convocados: ["p1"], titulares: [], capitan: null, q: [null, null, null, null, null, null, null, null], notes: "" };
  win.S.matches.tc.push(newMatch);
  win.S.matchId = "mNew";
  win.openManualStatsModal(0);
  const newModalHtml = document.getElementById("m-manual-stats")?.outerHTML || "";
  assert(/data-k="ro"/.test(newModalHtml) && /data-k="ast"/.test(newModalHtml),
    "Escenario 1: un partido NUEVO, jugado ya con el equipo como Senior, ofrece el box score completo");
  document.getElementById("m-manual-stats")?.remove();

  // ════════════════════════════════════════════════════════════════
  // Escenario 2 (equipo distinto, limpio): Senior -> Junior a mitad de
  // temporada, con un partido viejo de box score completo.
  // ════════════════════════════════════════════════════════════════
  win.S.teamId = "ts";
  win.S.teams = [{ id: "ts", name: "Equipo Descendido", category: "Senior", color: "#22c55e", schedule: {} }];
  win.S.players = { ts: [{ id: "p1", name: "Jugadora Uno", number: 4, addedAt: "2026-07-01" }] };
  const oldFull = { id: "mOldFull", rival: "Rival Viejo", date: "2026-09-01", quarters: 4, qMins: 10, location: "home", matchMode: "quarters", convocados: ["p1"], titulares: [], capitan: null, q: [null, null, null, null, null, null, null, null], notes: "" };
  win.S.matches = { ts: [oldFull] };
  win.S.matchId = "mOldFull";
  win.openManualStatsModal(0);
  setInput("p1", "min", 15); setInput("p1", "p2m", 4); setInput("p1", "p2a", 2); setInput("p1", "ro", 3); setInput("p1", "rd", 5); setInput("p1", "ast", 2); setInput("p1", "stl", 1); setInput("p1", "blk", 0); setInput("p1", "to", 2); setInput("p1", "foul", 1);
  win.saveManualStatsQuarter(0);
  document.getElementById("m-manual-stats")?.remove();
  const fullBefore = JSON.stringify(oldFull.manualStats.byQuarter[0].p1);
  assert(oldFull.manualStats.byQuarter[0].p1.ro === 3 && oldFull.manualStats.byQuarter[0].p1.ast === 2,
    "Escenario 2 (Senior): el partido viejo guarda bien su box score completo (rebotes, asistencias, etc.) antes del descenso");

  // -- Descenso: el equipo pasa a Junior. --
  win.S.teams[0].category = "Junior";
  win.S.screen = "matchDetail";
  win.render();
  assert(JSON.stringify(oldFull.manualStats.byQuarter[0].p1) === fullBefore,
    "Escenario 2: tras el descenso a Junior, los datos del box score completo ya guardados (incluidas columnas que el formulario reducido ni muestra) permanecen intactos");
  const detailHtmlAfterDemo = document.getElementById("root")?.innerHTML || "";
  assert(detailHtmlAfterDemo.includes("savePlusMinus()"),
    "Escenario 2: tras el descenso, el partido viejo pasa a ofrecer +/- (categoría reducida) igual que cualquier otro partido de un equipo no-Senior");

  // Un partido NUEVO debe ofrecer ya el formulario reducido.
  const newReduced = { id: "mNewReduced", rival: "Rival Nuevo", date: "2026-10-15", quarters: 4, qMins: 10, location: "home", matchMode: "quarters", convocados: ["p1"], titulares: [], capitan: null, q: [null, null, null, null, null, null, null, null], notes: "" };
  win.S.matches.ts.push(newReduced);
  win.S.matchId = "mNewReduced";
  win.openManualStatsModal(0);
  const newReducedModalHtml = document.getElementById("m-manual-stats")?.outerHTML || "";
  assert(newReducedModalHtml.includes("formulario reducido") && !/data-k="ro"/.test(newReducedModalHtml),
    "Escenario 2: un partido NUEVO, jugado ya con el equipo como Junior, ofrece el formulario reducido");
  document.getElementById("m-manual-stats")?.remove();

  // Por último: los KPIs/Stats agregados del equipo no deben reventar al
  // mezclar, para el mismo equipo, partidos con box score completo (de
  // cuando era Senior) y partidos reducidos (de después del descenso).
  win.S.statsMonth = null;
  let threwAgg = null;
  try { win._matchAggRows(); } catch (e) { threwAgg = e; }
  assert(!threwAgg, "Escenario 2: _matchAggRows() no lanza al mezclar, en el mismo equipo, partidos de antes (box completo) y después (reducido) del cambio de categoría" + (threwAgg ? ` (lanzó: ${threwAgg.message})` : ""));

  return report.summary();
}

module.exports = { run };
