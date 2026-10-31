"use strict";
// v3.0.0-dev.102 · B-MANUALSTATS2: formulario REDUCIDO de estadísticas de
// partido sin directo, para todas las categorías salvo Senior -- pedido de
// Mario tras ver la primera entrega (dev.101): "en los infantiles hasta
// junior solo se apunta minutos, tiros de 2 anotados, tiros de 3 anotados,
// tiros libres intentados y anotados con el porcentaje, y +/-" (a
// diferencia del box score completo de Senior: rebotes, asistencias,
// robos, tapones, pérdidas, faltas). Confirmado con AskUserQuestion: la
// categoría decide (campo t.category que ya existía, "Todo menos Senior"
// usa el reducido); 2P/3P SOLO anotados, sin intentos ni %; el +/- es UN
// ÚNICO número final por jugador para todo el partido, no por cuarto (vive
// aparte de byQuarter, en m.manualStats.plusMinus).
//
// Este test cubre: que el modal muestra las columnas reducidas (y NO las
// del box score completo) para cualquier categoría que no sea "Senior"
// (incluida sin categoría en absoluto); que %TL se calcula en vivo al
// escribir; que guardar un cuarto reducido no inventa valores en los
// campos que ni se muestran; que el resumen de matchDetail() añade la
// columna +/- editable para estas categorías y NO para Senior; que
// savePlusMinus() persiste un único valor por partido (no por cuarto) y
// respeta los mismos guardas de permisos que el resto; y, al revés, que un
// equipo Senior sigue viendo el formulario completo de siempre sin la
// columna +/-.
const { loadApp, newReporter } = require("./harness");

async function run() {
  const report = newReporter("manual_match_stats_reduced");
  const win = await loadApp();
  const document = win.document;
  const assert = (cond, msg) => report.assert(cond, msg);

  win.S.teams = [
    { id: "inf", name: "Infantil Masculino A", category: "Infantil", color: "#F06318", schedule: {} },
    { id: "noc", name: "Equipo sin categoría", color: "#6366f1", schedule: {} }, // category undefined a propósito
    { id: "sen", name: "Senior Masculino", category: "Senior", color: "#22c55e", schedule: {} }
  ];
  win.S.players = {
    inf: [
      { id: "p1", name: "Jugador Uno", number: 4, addedAt: "2026-07-01" },
      { id: "p2", name: "Jugador Dos", number: 5, addedAt: "2026-07-01" }
    ],
    sen: [{ id: "s1", name: "Senior Uno", number: 7, addedAt: "2026-07-01" }]
  };
  win.S.cfg.coaches = [];
  const baseMatch = (tid) => ({
    id: "m_" + tid, rival: "Rival", date: win.td(), quarters: 4, qMins: 10,
    location: "home", matchMode: "quarters",
    convocados: tid === "inf" ? ["p1", "p2"] : ["s1"], titulares: [], capitan: null,
    q: [10, 8, null, null, null, null, null, null], notes: ""
  });
  win.S.matches = { inf: [baseMatch("inf")], sen: [baseMatch("sen")] };

  function setInput(pid, k, v) {
    const row = document.querySelector(`#m-manual-stats tr[data-ms-pid="${pid}"]`);
    const inp = row && row.querySelector(`[data-k="${k}"]`);
    if (inp) { inp.value = String(v); inp.dispatchEvent(new win.Event("input", { bubbles: true })); }
  }

  // ── 1) Categoría Infantil -- formulario reducido ──
  win.S.teamId = "inf"; win.S.matchId = "m_inf";
  win.openManualStatsModal(0);
  const modalHtmlInf = document.getElementById("m-manual-stats").outerHTML;
  assert(modalHtmlInf.includes('data-k="min"') && modalHtmlInf.includes('data-k="p2m"') && modalHtmlInf.includes('data-k="p3m"') && modalHtmlInf.includes('data-k="p1m"') && modalHtmlInf.includes('data-k="p1a"'),
    "Infantil: el formulario reducido SÍ pide minutos, 2P anotados, 3P anotados y TL anotados/intentados");
  assert(!modalHtmlInf.includes('data-k="p2a"') && !modalHtmlInf.includes('data-k="p3a"') && !modalHtmlInf.includes('data-k="ro"') && !modalHtmlInf.includes('data-k="rd"') && !modalHtmlInf.includes('data-k="ast"') && !modalHtmlInf.includes('data-k="stl"') && !modalHtmlInf.includes('data-k="blk"') && !modalHtmlInf.includes('data-k="to"') && !modalHtmlInf.includes('data-k="foul"'),
    "Infantil: el formulario reducido NUNCA pide intentos de 2P/3P ni rebotes/asistencias/robos/tapones/pérdidas/faltas (eso es solo Senior)");
  assert(modalHtmlInf.includes("formulario reducido"), "Infantil: el modal avisa de que es el formulario reducido, con la categoría");

  // -- %TL en vivo mientras se escribe --
  setInput("p1", "p1m", 3); setInput("p1", "p1a", 4);
  const ftCellTxt = document.querySelector('#m-manual-stats tr[data-ms-pid="p1"] .ms-ftpct').textContent;
  assert(ftCellTxt === "75%", "Infantil: %TL se recalcula en vivo al escribir (3/4 = 75%)");
  setInput("p1", "p1a", 0);
  assert(document.querySelector('#m-manual-stats tr[data-ms-pid="p1"] .ms-ftpct').textContent === "—",
    "Infantil: %TL muestra '—' en vez de dividir por cero cuando no hay intentos");
  setInput("p1", "p1a", 4); // restaurar para el guardado

  setInput("p1", "min", 8); setInput("p1", "p2m", 2); setInput("p1", "p3m", 1);
  setInput("p2", "min", 5); // p2 también juega, aunque sin puntos -- para que aparezca en el resumen de +/-
  win.saveManualStatsQuarter(0);
  const mInf = win.mById("inf", "m_inf");
  const savedP1 = mInf.manualStats.byQuarter[0].p1;
  // v3.0.0-dev.103 · B-MANUALSTATS3: el "4" tecleado en TL I es intentos
  // TOTALES (3 anotados de 4 intentados) -- se guarda como 1 fallo
  // (4-3), no como "4" tal cual, para que el %TL de Stats/exports salga
  // bien (ver saveManualStatsQuarter).
  assert(savedP1.min === 8 && savedP1.p2m === 2 && savedP1.p3m === 1 && savedP1.p1m === 3 && savedP1.p1a === 1,
    "Infantil: guarda minutos/2P/3P tal cual, y el TL convertido a fallos reales (3 de 4 intentos -> p1a=1)");
  assert(savedP1.p2a === 0 && savedP1.ro === 0 && savedP1.ast === 0 && savedP1.foul === 0,
    "Infantil: los campos que el formulario reducido no muestra se guardan en 0 (nunca basura ni undefined)");
  document.getElementById("m-manual-stats")?.remove();

  // ── 2) Equipo SIN categoría -- también usa el reducido ("todo menos Senior") ──
  win.S.teamId = "noc"; win.S.matches.noc = [baseMatch("noc")]; win.S.players.noc = [{ id: "n1", name: "Jugador Noc", number: 9, addedAt: "2026-07-01" }];
  win.S.matches.noc[0].convocados = ["n1"]; win.S.matchId = "m_noc";
  win.openManualStatsModal(0);
  assert(!document.getElementById("m-manual-stats").outerHTML.includes('data-k="ro"'),
    "Un equipo sin categoría asignada también usa el formulario reducido, no el completo de Senior");
  document.getElementById("m-manual-stats")?.remove();

  // ── 3) Categoría Senior -- sigue con el formulario completo de siempre ──
  win.S.teamId = "sen"; win.S.matchId = "m_sen";
  win.openManualStatsModal(0);
  const modalHtmlSen = document.getElementById("m-manual-stats").outerHTML;
  assert(modalHtmlSen.includes('data-k="p2a"') && modalHtmlSen.includes('data-k="ro"') && modalHtmlSen.includes('data-k="ast"') && modalHtmlSen.includes('data-k="foul"'),
    "Senior: sigue con el box score completo de 14 columnas, sin recortar nada");
  assert(!modalHtmlSen.includes("ms-ftpct") && !modalHtmlSen.includes("formulario reducido"),
    "Senior: no muestra %TL en vivo ni el aviso de 'formulario reducido' -- eso es solo para el resto de categorías");
  setInput("s1", "min", 15); setInput("s1", "p2m", 4); setInput("s1", "p2a", 7); setInput("s1", "ast", 3);
  win.saveManualStatsQuarter(0);
  const savedS1 = win.mById("sen", "m_sen").manualStats.byQuarter[0].s1;
  // v3.0.0-dev.103 · B-MANUALSTATS3: el "7" tecleado en T2 I son intentos
  // TOTALES (4 anotados de 7 intentados) -- se guarda como 3 fallos (7-4),
  // mismo criterio que el formulario reducido; asistencias no se tocan.
  assert(savedS1.p2a === 3 && savedS1.ast === 3, "Senior: también convierte intentos totales a fallos reales (4 de 7 -> p2a=3); el resto (asistencias) sin tocar");
  document.getElementById("m-manual-stats")?.remove();

  // ── 3b) Cierre del círculo: el %TL que se ve en vivo en el modal (paso 1,
  // 75%) debe ser EXACTAMENTE el mismo que acaba mostrando la pantalla real
  // de Stats ("Partidos") para ese jugador -- confirma que la conversión a
  // fallos al guardar no solo cuadra en bruto, sino que el % final que ve
  // Mario en la app es el correcto de principio a fin (y no, por ejemplo,
  // 3/(3+4)=43% si se hubiera guardado "tal cual" lo tecleado). stats()
  // exige al menos un entrenamiento pasado lista para no quedarse en su
  // estado vacío ("Pasa lista primero") -- Infantil en este test solo tiene
  // partidos, así que se crea uno mínimo.
  win.S.teamId = "inf"; win.S.date = win.td();
  win.cycleAtt("p1");
  win.S.statsMonth = ""; win.S.screen = "stats";
  const statsHtmlInf = win.stats();
  assert(statsHtmlInf.includes("75%"), "Infantil: la pantalla real de Stats ('Partidos') muestra el %TL correcto (75%) para p1, igual que la vista previa en vivo del modal");
  assert(!statsHtmlInf.includes("43%"), "Infantil: la pantalla de Stats NO muestra el % equivocado que saldría de no convertir intentos a fallos al guardar (43%)");

  // ── 4) +/- final del partido -- columna en matchDetail(), reducido sí / Senior no ──
  win.S.teamId = "inf"; win.S.matchId = "m_inf"; win.S.screen = "matchDetail";
  const mdHtmlInf = win.matchDetail();
  assert(mdHtmlInf.includes("ms-pm-inp") && mdHtmlInf.includes(">+/-<"),
    "Infantil: matchDetail() muestra la columna +/- editable en el resumen del partido");
  assert(mdHtmlInf.includes("Guardar +/-"), "Infantil: hay un botón propio para guardar el +/-, separado de guardar un cuarto");

  win.S.teamId = "sen";
  const mdHtmlSen = win.matchDetail();
  assert(!mdHtmlSen.includes("ms-pm-inp") && !mdHtmlSen.includes("Guardar +/-"),
    "Senior: NUNCA muestra la columna +/- ni su botón de guardar -- esa stat no aplica a esta categoría");

  // ── 5) savePlusMinus() guarda un ÚNICO valor por partido, no por cuarto ──
  // (render(), no solo matchDetail(), para que #ms-summary-table exista de
  // verdad en el DOM -- matchDetail() a secas solo devuelve el HTML como
  // string, igual que se usó arriba para comprobar texto.)
  win.S.teamId = "inf"; win.S.matchId = "m_inf"; win.S.screen = "matchDetail";
  win.render();
  document.querySelector('#ms-summary-table tr[data-pm-pid="p1"] .ms-pm-inp').value = "7";
  document.querySelector('#ms-summary-table tr[data-pm-pid="p2"] .ms-pm-inp').value = "-3";
  win.savePlusMinus();
  const pmInf = win.mById("inf", "m_inf").manualStats.plusMinus;
  assert(pmInf.p1 === 7 && pmInf.p2 === -3, "savePlusMinus(): guarda positivo y negativo correctamente, uno por jugador");
  assert(mInf.manualStats.byQuarter && Object.keys(mInf.manualStats.byQuarter).length === 1,
    "El +/- no crea ni toca ninguna entrada de byQuarter -- vive totalmente aparte de los cuartos");
  // -- Guardar 0 quita la entrada (ni "fantasmas" con valor 0 colgando) --
  win.render();
  document.querySelector('#ms-summary-table tr[data-pm-pid="p2"] .ms-pm-inp').value = "0";
  win.savePlusMinus();
  assert(win.mById("inf", "m_inf").manualStats.plusMinus.p2 === undefined,
    "savePlusMinus(): un +/- guardado a 0 se quita del objeto, igual que una fila de cuarto a cero");

  // ── 6) Mismo guarda de permisos que el resto de mutadores de equipo ──
  win.S.cfg.coaches = [
    { id: "ana", name: "Ana", role: "entrenador", teamsEdit: ["sen"], teamsView: ["inf"] },
    { id: "mario", name: "Mario", role: "superadmin", teamsEdit: [], teamsView: [] }
  ];
  win._setCurrentCoachId("ana"); // solo ve Infantil, no lo edita
  win.S.teamId = "inf"; win.S.matchId = "m_inf"; win.S.screen = "matchDetail";
  win.render();
  const pmBefore = JSON.stringify(win.mById("inf", "m_inf").manualStats.plusMinus);
  document.querySelector('#ms-summary-table tr[data-pm-pid="p1"] .ms-pm-inp').value = "99";
  win.savePlusMinus();
  assert(JSON.stringify(win.mById("inf", "m_inf").manualStats.plusMinus) === pmBefore,
    "savePlusMinus(): Ana no puede guardar el +/- de Infantil -- no tiene permiso de edición sobre ese equipo");
  win.S.cfg.coaches = [];

  return report.summary();
}

module.exports = { run };
