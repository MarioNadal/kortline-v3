"use strict";
// v3.0.0-dev.101 · B-MANUALSTATS1: estadísticas de partido NO en vivo, por
// cuartos -- pedido explícito de Mario y, en sus palabras, "casi lo más
// importante": poder anotar las estadísticas de puntos (y el resto: rebotes,
// asistencias, robos, tapones, pérdidas, faltas) de un partido que hoy
// apunta a mano o saca del Swish, cuarto a cuarto, CON minutaje por
// jugador -- y que eso alimente las MISMAS pantallas de Stats/exportación
// que ya existen para partidos en directo, sin montar nada nuevo aparte.
// Confirmado con AskUserQuestion: "Formulario por cuarto, estadística
// completa (recomendado)"; minutaje "solo mostrar el dato (recomendado)".
//
// Este test cubre: el modelo de datos (m.manualStats.byQuarter), el flujo
// real de entrada (openManualStatsModal -> rellenar inputs ->
// saveManualStatsQuarter), la normalización _matchPlayerStats() que une
// live.stats y manualStats bajo el mismo formato, la integración con
// _hasMatchStats/computeTeamKPIs/_matchAggRows (para que Stats y los
// exports vean estos partidos exactamente igual que uno en directo), el
// minutaje vía _getMinSec, el aviso de comparación con el marcador oficial
// del cuarto, y que esta sección NUNCA aparece ni se puede usar en un
// partido CON seguimiento en vivo (live.stats manda ahí, sin excepción).
const { loadApp, newReporter } = require("./harness");

async function run() {
  const report = newReporter("manual_match_stats");
  const win = await loadApp();
  const document = win.document;
  const assert = (cond, msg) => report.assert(cond, msg);

  // v3.0.0-dev.102 · B-MANUALSTATS2: category:"Senior" a propósito -- este
  // archivo cubre el box score COMPLETO (rebotes/asistencias/robos/
  // tapones/pérdidas/faltas), que tras B-MANUALSTATS2 solo se usa para
  // Senior. El formulario reducido (resto de categorías) tiene su propio
  // test, manual_match_stats_reduced.test.js.
  win.S.teams = [{ id: "t1", name: "Senior Masculino", category: "Senior", color: "#F06318", schedule: {} }];
  win.S.players = {
    t1: [
      { id: "p1", name: "Jugador Uno", number: 4, addedAt: "2026-07-01" },
      { id: "p2", name: "Jugador Dos", number: 5, addedAt: "2026-07-01" },
      { id: "p3", name: "Jugador Tres", number: 6, addedAt: "2026-07-01" }
    ]
  };
  win.S.cfg.coaches = [];
  win.S.teamId = "t1";
  const match = {
    id: "m1", rival: "Rival CB", date: win.td(), quarters: 4, qMins: 10,
    location: "home", matchMode: "quarters",
    convocados: ["p1", "p2", "p3"], titulares: [], capitan: null,
    q: [20, 15, null, null, null, null, null, null], // solo Q1 anotado: nosotros(local) 20, rival 15
    notes: ""
  };
  win.S.matches = { t1: [match] };
  win.S.matchId = "m1";

  function setInput(pid, k, v) {
    const row = document.querySelector(`#m-manual-stats tr[data-ms-pid="${pid}"]`);
    const inp = row && row.querySelector(`[data-k="${k}"]`);
    if (!inp) return;
    inp.value = String(v);
    // openManualStatsModal() escucha el evento "input" para refrescar el
    // aviso de comprobación en vivo -- hay que disparárselo de verdad, no
    // basta con tocar .value a mano.
    inp.dispatchEvent(new win.Event("input", { bubbles: true }));
  }

  // ════════════════════════════════════════════════════════════════
  // 1) Sin estadísticas todavía
  // ════════════════════════════════════════════════════════════════
  assert(win._hasMatchStats(match) === false, "_hasMatchStats(): false antes de anotar nada (sin live, sin manualStats)");
  assert(win._matchPlayerStats(match) === null, "_matchPlayerStats(): null sin datos");
  assert(win._getMinSec(match, "p1") === 0, "_getMinSec(): 0 sin datos");

  // ════════════════════════════════════════════════════════════════
  // 2) Abrir el formulario del Q1 -- 3 jugadores convocados, inputs en 0
  // ════════════════════════════════════════════════════════════════
  win.openManualStatsModal(0);
  assert(!!document.getElementById("m-manual-stats"), "openManualStatsModal(): abre el modal");
  const rows = document.querySelectorAll("#m-manual-stats tr[data-ms-pid]");
  assert(rows.length === 3, "openManualStatsModal(): una fila por cada convocado (3)");
  assert(document.querySelector('#m-manual-stats tr[data-ms-pid="p1"] [data-k="min"]').value === "0",
    "openManualStatsModal(): los inputs arrancan en 0 (sin datos previos)");

  // -- Rellenar Q1: p1 anota 10 (2x2 + 2x3), 8 minutos; p2 anota 3 (3 tiros libres) --
  setInput("p1", "min", 8);
  setInput("p1", "p2m", 2); setInput("p1", "p2a", 3);
  setInput("p1", "p3m", 2); setInput("p1", "p3a", 4);
  setInput("p1", "ro", 1); setInput("p1", "rd", 2); setInput("p1", "ast", 1); setInput("p1", "stl", 1);
  setInput("p2", "min", 10);
  setInput("p2", "p1m", 3); setInput("p2", "p1a", 4);
  setInput("p2", "to", 2); setInput("p2", "foul", 1);
  // p3 se queda todo en 0 -- no debe guardarse ninguna fila para p3.

  // -- El aviso de comprobación debe reflejar la suma de puntos (10+3=13)
  // frente al marcador oficial de este cuarto (nuestro, local = 20) --
  const msCheckBefore = document.getElementById("ms-check").textContent;
  assert(msCheckBefore.includes("13"), "_msRefreshCheck(): suma los puntos tecleados en vivo mientras se rellena (13 = 10 de p1 + 3 de p2)");
  assert(msCheckBefore.includes("20") && msCheckBefore.includes("⚠"),
    "_msRefreshCheck(): avisa de que 13 no coincide con el marcador oficial del cuarto (20) -- entrada parcial, normal mientras se rellena");

  win.saveManualStatsQuarter(0);
  assert(!document.getElementById("m-manual-stats"), "saveManualStatsQuarter(): cierra el modal al guardar");
  assert(match.manualStats && match.manualStats.byQuarter && match.manualStats.byQuarter[0],
    "saveManualStatsQuarter(): crea m.manualStats.byQuarter[0]");
  const q0 = match.manualStats.byQuarter[0];
  assert(q0.p1 && q0.p1.min === 8 && q0.p1.p2m === 2 && q0.p1.p3m === 2,
    "saveManualStatsQuarter(): guarda los valores tecleados para p1 tal cual");
  assert(q0.p2 && q0.p2.p1m === 3 && q0.p2.to === 2,
    "saveManualStatsQuarter(): guarda los valores tecleados para p2");
  assert(!q0.p3, "saveManualStatsQuarter(): NO guarda una fila para p3 (todo a cero -- sin 'fantasmas')");

  // ════════════════════════════════════════════════════════════════
  // 3) _hasMatchStats / _matchPlayerStats tras guardar el Q1
  // ════════════════════════════════════════════════════════════════
  assert(win._hasMatchStats(match) === true, "_hasMatchStats(): true en cuanto hay al menos una fila guardada");
  const st1 = win._matchPlayerStats(match);
  assert(st1 && st1.p1 && st1.p1.p2m === 2 && st1.p1.p3m === 2 && st1.p2.p1m === 3,
    "_matchPlayerStats(): normaliza manualStats al mismo formato que live.stats");
  assert(win._getMinSec(match, "p1") === 8 * 60, "_getMinSec(): 8 minutos del Q1 -> 480 segundos");
  assert(win._getMinSec(match, "p2") === 10 * 60, "_getMinSec(): 10 minutos del Q1 para p2");
  assert(win._getMinSec(match, "p3") === 0, "_getMinSec(): 0 para un jugador sin estadísticas guardadas");

  // ════════════════════════════════════════════════════════════════
  // 4) Un segundo cuarto (Q2) con más minutos de p1 -- deben SUMARSE, no
  //    sobrescribir el Q1.
  // ════════════════════════════════════════════════════════════════
  match.q[2] = 18; match.q[3] = 16; // ahora Q2 también tiene marcador oficial (nosotros 18)
  win.openManualStatsModal(1);
  assert(document.querySelector('#m-manual-stats tr[data-ms-pid="p1"] [data-k="min"]').value === "0",
    "openManualStatsModal(): el Q2 arranca en 0 -- es independiente del Q1 (no hereda sus valores)");
  setInput("p1", "min", 9);
  setInput("p1", "p2m", 3); setInput("p1", "p2a", 5); // 6 puntos
  win.saveManualStatsQuarter(1);
  assert(win._getMinSec(match, "p1") === (8 + 9) * 60, "_getMinSec(): suma los minutos de Q1 + Q2 para p1 (8+9=17 min)");
  const st2 = win._matchPlayerStats(match);
  assert(st2.p1.p2m === 2 + 3, "_matchPlayerStats(): suma los aciertos de 2 de Q1 y Q2 (2+3=5)");

  // -- Los chips de cuarto deben reflejar cuáles tienen datos guardados --
  win.S.screen = "matchDetail";
  const mdHtml = win.matchDetail();
  assert(mdHtml.includes("📊 Estadísticas por jugador"), "matchDetail(): muestra la sección de estadísticas por jugador para un partido sin directo");
  assert((mdHtml.match(/✓ Q/g) || []).length === 2, "matchDetail(): los chips de Q1 y Q2 muestran ✓ (tienen datos guardados), Q3/Q4 no");

  // -- B-MIN1: resumen de solo lectura de PTS/MIN por jugador, pedido por
  // Mario ("tener en cuenta minutaje"), confirmado "solo mostrar el dato". --
  // _shortName() desambigua por inicial cuando varios jugadores comparten
  // el primer nombre ("Jugador" en los 3 de este test) -- p1/p2 deben
  // aparecer (tienen estadísticas guardadas), p3 no.
  assert(mdHtml.includes(win._shortName("Jugador Uno")) && mdHtml.includes(win._shortName("Jugador Dos")),
    "matchDetail(): el resumen PTS/MIN lista a quien tiene estadísticas guardadas (p1, p2)");
  assert(!mdHtml.includes(`>${win._shortName("Jugador Tres")}<`) && !mdHtml.includes(` ${win._shortName("Jugador Tres")}</td>`),
    "matchDetail(): el resumen PTS/MIN NO lista a p3 (sin estadísticas guardadas)");
  assert(mdHtml.includes(">16<"), "matchDetail(): el resumen muestra los puntos totales de p1 (16) en la columna PTS");
  assert(mdHtml.includes(win._fmtMin(17 * 60)), "matchDetail(): el resumen muestra los minutos totales de p1 (17:00) en la columna MIN");

  // ════════════════════════════════════════════════════════════════
  // 5) Integración con _matchAggRows() / computeTeamKPIs() -- deben ver
  //    este partido exactamente igual que uno en directo.
  // ════════════════════════════════════════════════════════════════
  win.S.statsMonth = "";
  const agg = win._matchAggRows();
  assert(agg.matchList.length === 1, "_matchAggRows(): incluye el partido manual en matchList (vía _hasMatchStats)");
  const rowP1 = agg.rows.find(r => r.p.id === "p1");
  assert(rowP1, "_matchAggRows(): p1 aparece en el agregado");
  assert(rowP1.a.pts === (2 * 2 + 2 * 3 + 3 * 2), "_matchAggRows(): puntos totales de p1 correctos (Q1: 2x2+2x3=10, Q2: 3x2=6 -> 16)");
  assert(rowP1.a.minSec === (8 + 9) * 60, "_matchAggRows(): minSec de p1 viene de _getMinSec (17 min)");

  const kpis = win.computeTeamKPIs([match]);
  // computeTeamKPIs() no devuelve p2m/p2a sueltos -- los pliega en "fga"
  // (tiros de campo intentados: p2m+p2a+p3m+p3a). p1 aporta p2m=5,p2a=8 (Q1:
  // 2/3 + Q2: 3/5) y p3m=2,p3a=4 (solo Q1) -> fga=5+8+2+4=19; los tiros
  // libres de p2 (p1m/p1a) no cuentan como tiro de campo, correctamente.
  assert(kpis.fga === 19, "computeTeamKPIs(): incluye los tiros de campo del partido manual en 'fga' (19)");
  assert(kpis.p3m === 2 && kpis.p3a === 4, "computeTeamKPIs(): triples del partido manual correctos (2 de 4)");
  assert(kpis.to === 2 && kpis.ro === 1 && kpis.rd === 2 && kpis.stl === 1,
    "computeTeamKPIs(): resto de KPIs del partido manual correctos (pérdidas, rebotes, robos)");

  // ════════════════════════════════════════════════════════════════
  // 6) Guardias de permisos: un entrenador sin acceso a t1 no puede abrir
  //    el formulario ni guardar, y _msAddOT() tampoco añade una prórroga.
  // ════════════════════════════════════════════════════════════════
  win.S.cfg.coaches = [
    { id: "c-super", name: "Super", role: "superadmin", teamsEdit: [], teamsView: [] },
    { id: "c-other", name: "De otro equipo", role: "entrenador", teamsEdit: [], teamsView: ["t1"] }
  ];
  win._setCurrentCoachId("c-other"); // solo ve t1, no lo edita
  document.getElementById("m-manual-stats")?.remove();
  document.querySelectorAll(".toast").forEach(e => e.remove());
  const beforeOt = (match.manualStats && match.manualStats.otCount) || 0;
  win._msAddOT();
  assert(((match.manualStats && match.manualStats.otCount) || 0) === beforeOt, "_msAddOT(): no añade prórroga si no se puede editar el equipo");
  // openManualStatsModal() en sí no está bloqueado por diseño (es de solo
  // lectura, útil para que un director deportivo consulte lo ya anotado),
  // pero guardar SÍ debe estar bloqueado -- lo relevante es que el dato no cambie.
  const q0Before = JSON.stringify(match.manualStats.byQuarter[0]);
  win.openManualStatsModal(0);
  setInput("p3", "min", 5); setInput("p3", "p2m", 4);
  win.saveManualStatsQuarter(0);
  assert(JSON.stringify(match.manualStats.byQuarter[0]) === q0Before,
    "saveManualStatsQuarter(): NO guarda nada si el entrenador actual no puede editar este equipo (defensa en profundidad)");
  document.getElementById("m-manual-stats")?.remove();
  win._setCurrentCoachId("c-super");

  // ════════════════════════════════════════════════════════════════
  // 7) Un partido CON seguimiento en vivo nunca ofrece ni permite esta
  //    sección -- live.stats es la única fuente de verdad ahí.
  // ════════════════════════════════════════════════════════════════
  const liveMatch = {
    id: "m2", rival: "Rival Live", date: win.td(), quarters: 4, qMins: 10,
    location: "home", matchMode: "live",
    convocados: ["p1"], titulares: [], capitan: null, q: [null, null, null, null, null, null, null, null],
    live: { q: 1, stats: {}, qScores: [[0, 0]], onCourt: ["p1"], log: [] }
  };
  win.S.matches.t1.push(liveMatch);
  win.S.matchId = "m2";
  win.S.screen = "matchDetail";
  const mdHtmlLive = win.matchDetail();
  assert(!mdHtmlLive.includes("📊 Estadísticas por jugador"),
    "matchDetail(): NUNCA muestra la sección de estadísticas a mano en un partido con seguimiento en vivo");
  document.querySelectorAll(".toast").forEach(e => e.remove());
  win.openManualStatsModal(0);
  assert(!document.getElementById("m-manual-stats"), "openManualStatsModal(): se niega a abrirse para un partido con seguimiento en vivo");
  assert(!!document.querySelector(".toast"), "openManualStatsModal(): avisa de que ese partido se anota desde el directo");

  return report.summary();
}

module.exports = { run };
