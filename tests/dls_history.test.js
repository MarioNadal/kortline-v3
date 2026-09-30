"use strict";
// v3.0.0-dev.80 · B-DLS10: tercera y última de las tres funciones pedidas
// por Mario el mismo día (ver att_player_note.test.js y
// dls_drag_reorder.test.js para las otras dos). Pedido explícito: "las
// estadisticas se tendran que poder buscar todas juntas en el equipo en
// catalogo de ejrcicios especificamente en contraataque de 11 haciendfo una
// suma de todos los dias que se ha hecho el contraataque de 11... se podria
// borrar alguno si hace falta". Aclarado con AskUserQuestion: el agregado
// cubre TANTO Contraataque de 11 COMO Final de partido, y el borrado tiene
// que poder hacerse "en los dos sitios" (desde el propio histórico Y desde
// la vista de resultado de una sesión).
//
// Esto es una REVERSIÓN DELIBERADA Y CONFIRMADA de la decisión B-DLS8
// (dev.72) de quitar el agregado por ejercicio del catálogo -- pero
// arrancar/continuar/ver el resultado de HOY se queda exactamente donde
// B-DLS8 lo puso (el propio día del entrenamiento, att()): esta pantalla es
// SOLO consulta del histórico completo + borrar. Ver dls.test.js para la
// aserción actualizada que confirma que el catálogo NO recupera los
// controles de arrancar/continuar, solo el botón de histórico.
const { loadApp, newReporter } = require("./harness.js");

async function run() {
  const win = await loadApp();
  const report = newReporter("dls_history");
  const { document } = win;

  win.S.teamId = "t1";
  win.S.teams = [{ id: "t1", name: "Infantil A", category: "Infantil", coaches: [] }];
  win.S.players = {
    t1: [
      { id: "p1", name: "Ana", number: 4 },
      { id: "p2", name: "Bea", number: 5 },
      { id: "p3", name: "Cata", number: 6 }
    ]
  };
  win.S.drills = {
    t1: [
      { id: "d1", name: "Contraataque de 11", category: "transition", dlsType: "b11" },
      { id: "d2", name: "Final de partido", category: "scrimmage", dlsType: "endgame" },
      { id: "d3", name: "Rueda de tiro exterior", category: "shooting" } // sin dlsType -- ejercicio normal, de control
    ]
  };
  win.S.matches = { t1: [] };
  win.S.events = { t1: [] };
  win.S.sessions = {};
  win.S.date = "2026-09-30";
  win.S.cfg.features.exercises = true;

  const emptyStats = () => ({ p2m: 0, p2a: 0, p3m: 0, p3a: 0, reb: 0, to: 0, stl: 0, ast: 0, blk: 0 });
  const b11Players = [
    { id: "p1", name: "Ana", number: 4 },
    { id: "p2", name: "Bea", number: 5 },
    { id: "p3", name: "Cata", number: 6 }
  ];

  // ── Sin ninguna sesión todavía: aviso de vacío, sin reventar ──
  win.S.drillLive = {};
  let body = win._dlsHistoryBodyHtml("d1");
  report.assert(body.includes("Todavía no hay ninguna sesión terminada"), "sin sesiones guardadas, el histórico avisa en vez de mostrar una tabla vacía");

  // ── Dos sesiones de Contraataque de 11 TERMINADAS en días distintos, con estadísticas conocidas ──
  win.S.drillLive = {
    t1: {
      d1: [
        {
          id: "s1", drillId: "d1", drillName: "Contraataque de 11", date: "2026-09-10", type: "b11", status: "finished",
          checklist: { ast: true, missTrack: true, missPenalty: false }, durationSec: 600, remainingSec: 0,
          players: b11Players,
          stats: {
            p1: { ...emptyStats(), p2m: 2, p2a: 1 },   // val = 2*1 = 2
            p2: { ...emptyStats(), p3m: 1, reb: 1 },   // val = 1*2 + 1 = 3
            p3: { ...emptyStats(), to: 1 }              // val = -1
          },
          log: []
        },
        {
          id: "s2", drillId: "d1", drillName: "Contraataque de 11", date: "2026-09-17", type: "b11", status: "finished",
          checklist: { ast: true, missTrack: true, missPenalty: false }, durationSec: 600, remainingSec: 0,
          players: b11Players,
          stats: {
            p1: { ...emptyStats(), p2m: 1 },            // val = 1
            p2: { ...emptyStats(), p3m: 1 },            // val = 2
            p3: { ...emptyStats(), ast: 2 }              // val = 2
          },
          log: []
        },
        {
          // Sesión todavía EN CURSO el mismo día -- no debe contar para el agregado ni salir en la lista de histórico
          id: "s3running", drillId: "d1", drillName: "Contraataque de 11", date: "2026-09-24", type: "b11", status: "running",
          checklist: { ast: true, missTrack: true, missPenalty: false }, durationSec: 600, remainingSec: 300,
          players: b11Players,
          stats: { p1: { ...emptyStats(), p2m: 5 }, p2: emptyStats(), p3: emptyStats() }, // si esto se colara en el agregado, se notaría enseguida
          log: []
        }
      ],
      d2: []
    }
  };

  // ── El botón de histórico aparece en la fila del catálogo, solo para ejercicios con tipo (b11/endgame) ──
  win.S.screen = "team";
  const libHtml = win._drillLibraryRowsHtml();
  report.assert(libHtml.includes("openDlsHistoryModal('d1')"), "B-DLS10: la fila de Contraataque de 11 en el catálogo ofrece el botón de histórico");
  report.assert(libHtml.includes("openDlsHistoryModal('d2')"), "B-DLS10: la fila de Final de partido también lo ofrece");
  report.assert(!libHtml.includes("openDlsHistoryModal('d3')"), "un ejercicio normal (sin dlsType) NO ofrece botón de histórico -- no tiene sentido, no guarda estadísticas en vivo");

  // ── Abrir el histórico de Contraataque de 11 ──
  win.openDlsHistoryModal("d1");
  report.assert(!!document.getElementById("m-dls-history"), "openDlsHistoryModal() abre el modal");
  report.assert(document.querySelector("#m-dls-history .mtitle").textContent.includes("Contraataque de 11"), "el título usa el nombre real del ejercicio");
  let histBody = document.getElementById("dls-history-body").innerHTML;
  report.assert(histBody.includes("2 sesión"), "el resumen cuenta solo las sesiones TERMINADAS (2), no la que sigue en curso (que sería una tercera)");

  // ── El agregado suma bien -- Ana: 2 sesiones, 3 tiros de 2 anotados de 4, valoración media (2+1)/2=1.5 ──
  report.assert(/Ana[\s\S]*?<\/tr>/.test(histBody), "la tabla de agregado incluye una fila para Ana");
  const anaRowMatch = histBody.match(/<tr><td[^>]*>Ana[\s\S]*?<\/tr>/);
  report.assert(!!anaRowMatch, "se puede extraer la fila de Ana para comprobar sus totales");
  const anaRow = anaRowMatch[0];
  report.assert(anaRow.includes(">2<") , "Ana: columna de sesiones jugadas = 2");
  report.assert(anaRow.includes("3/4"), "Ana: 2pt acumulado de las dos sesiones (2 anotados de la primera + 1 de la segunda = 3, sobre 3+1=4 intentados)");
  report.assert(anaRow.includes("1.5"), "Ana: valoración media (2 en la primera sesión, 1 en la segunda) = 1.5");
  report.assert(!anaRow.includes("p2m:5") && !/>7</.test(anaRow), "los 5 tiros de la sesión EN CURSO de Ana no se cuelan en el agregado (2+1=3, nunca 3+5=8 ni ninguna cifra que los incluya)");

  // ── La lista de sesiones del histórico muestra las 2 terminadas, más recientes primero, cada una tocable ──
  const histList = document.getElementById("dls-history-list");
  const histRows = [...histList.querySelectorAll("[data-dls-hist-session]")];
  report.assert(histRows.length === 2, "la lista del histórico muestra exactamente las 2 sesiones terminadas (nunca la que sigue en curso)");
  report.assert(histRows[0].dataset.dlsHistSession === "s2", "la sesión más reciente (17 de septiembre) sale primero");
  report.assert(histRows[1].dataset.dlsHistSession === "s1", "la sesión más antigua (10 de septiembre) sale después");

  // ── Tocar una sesión del histórico abre su resumen EXACTO (no el agregado, no la última) ──
  win._dlsOpenHistorySession("d1", "s1");
  report.assert(!!document.getElementById("m-dls-summary"), "tocar una fila del histórico abre el resumen de esa sesión");
  const summaryHtml1 = document.getElementById("m-dls-summary").innerHTML;
  report.assert(summaryHtml1.includes("Contraataque de 11"), "el resumen abierto es el del ejercicio correcto");
  report.assert(/>2<\/td>[\s\S]*?>1<\/td>/.test(summaryHtml1) || summaryHtml1.includes("2/3"), "el resumen muestra las estadísticas exactas de ESA sesión (2 de 3 en 2pt para Ana)");
  report.assert(summaryHtml1.includes("Borrar esta sesión"), "B-DLS10: el resumen de una sesión ya terminada ofrece borrarla desde aquí también");
  document.getElementById("m-dls-summary").remove();

  // ── Una sesión EN CURSO nunca ofrece el botón de borrar desde su resumen ──
  win.S._dlsDrillId = "d1";
  win.openDlsSummaryModal("d1"); // sin sesión activa distinta, cae a la última terminada o a la activa -- aquí hay una activa (s3running)
  const runningSummary = document.getElementById("m-dls-summary").innerHTML;
  report.assert(!runningSummary.includes("Borrar esta sesión"), "una sesión todavía en curso no ofrece borrarla desde su resumen");
  document.getElementById("m-dls-summary").remove();

  // ── Borrar una sesión desde el propio histórico (uno de los "dos sitios" pedidos) ──
  win.openDlsHistoryModal("d1");
  win._dlsDeleteSession("d1", "s1", "history");
  report.assert(win.S.drillLive.t1.d1.find(s => s.id === "s1") === undefined, "_dlsDeleteSession quita la sesión de S.drillLive de verdad");
  report.assert(win.S.drillLive.t1.d1.find(s => s.id === "s2") !== undefined, "borrar una sesión no afecta a las demás");
  const histListAfterDelete = document.getElementById("dls-history-list");
  report.assert([...histListAfterDelete.querySelectorAll("[data-dls-hist-session]")].length === 1, "B-DLS10: el histórico, si sigue abierto, se repinta solo tras borrar -- ya no muestra la sesión borrada");
  const histBodyAfterDelete = document.getElementById("dls-history-body").innerHTML;
  report.assert(histBodyAfterDelete.includes("1 sesión"), "el recuento de sesiones del resumen también se actualiza tras borrar");
  document.getElementById("m-dls-history").remove();

  // ── Borrar una sesión desde su propio resumen (el otro de los "dos sitios" pedidos) ──
  win._dlsOpenHistorySession("d1", "s2");
  report.assert(!!document.getElementById("m-dls-summary"), "se abre el resumen de la única sesión que queda");
  win._dlsConfirmDeleteSession("d1", "s2", "summary");
  const confirmBtn = document.querySelector("#m-confirm button");
  report.assert(!!confirmBtn, "borrar pide confirmación antes de hacerlo de verdad (no es un borrado de un solo toque)");
  confirmBtn.click();
  report.assert(win.S.drillLive.t1.d1.find(s => s.id === "s2") === undefined, "tras confirmar, la sesión se borra de verdad");
  report.assert(!document.getElementById("m-dls-summary"), "borrar desde el propio resumen también lo cierra");

  // ── Final de partido: agregado por jugador (partidos jugados, G-P-E, puntos a favor/en contra) ──
  win.S.drillLive.t1.d2 = [
    {
      id: "m1", drillId: "d2", drillName: "Final de partido", date: "2026-09-11", type: "endgame", status: "finished",
      trackIndividual: false, checklist: {}, durationSec: 180, remainingSec: 0,
      players: [
        { id: "p1", name: "Ana", number: 4, team: "A" },
        { id: "p2", name: "Bea", number: 5, team: "A" },
        { id: "p3", name: "Cata", number: 6, team: "B" }
      ],
      manualScore: { A: 20, B: 15 },
      stats: { p1: emptyStats(), p2: emptyStats(), p3: emptyStats() },
      log: []
    },
    {
      id: "m2", drillId: "d2", drillName: "Final de partido", date: "2026-09-18", type: "endgame", status: "finished",
      trackIndividual: false, checklist: {}, durationSec: 180, remainingSec: 0,
      players: [
        { id: "p1", name: "Ana", number: 4, team: "B" }, // esta vez Ana juega en el otro equipo -- el agregado tiene que seguirla a ella, no a "el equipo A"
        { id: "p3", name: "Cata", number: 6, team: "A" }
      ],
      manualScore: { A: 10, B: 12 },
      stats: { p1: emptyStats(), p3: emptyStats() },
      log: []
    }
  ];
  win.openDlsHistoryModal("d2");
  report.assert(document.querySelector("#m-dls-history .mtitle").textContent.includes("Final de partido"), "el histórico de Final de partido usa su propio nombre");
  const endgameBody = document.getElementById("dls-history-body").innerHTML;
  // Ana: partido 1 en A (20-15, gana, +20/-15), partido 2 en B (10-12, gana, +12/-10) -- 2 P.J., 2-0-0, 32 a favor, 25 en contra
  const anaEndRow = endgameBody.match(/<tr><td[^>]*>Ana[\s\S]*?<\/tr>/)[0];
  report.assert(anaEndRow.includes(">2<"), "Ana: 2 partidos jugados en total, contando los dos mini-partidos");
  report.assert(anaEndRow.includes("2-0-0"), "Ana: agregado por JUGADOR, no por 'equipo A' fijo -- ganó los dos aunque jugara en equipos distintos (2 victorias, 0 derrotas, 0 empates)");
  report.assert(anaEndRow.includes(">32<") && anaEndRow.includes(">25<"), "Ana: puntos a favor (20+12=32) y en contra (15+10=25) sumados de los dos mini-partidos, seas del equipo que seas cada vez");
  // Cata: partido 1 en B (20-15, pierde), partido 2 en A (10-12, pierde) -- 0-2-0
  const cataEndRow = endgameBody.match(/<tr><td[^>]*>Cata[\s\S]*?<\/tr>/)[0];
  report.assert(cataEndRow.includes("0-2-0"), "Cata perdió los dos mini-partidos (en equipos distintos cada vez) -- 0 victorias, 2 derrotas");
  // Bea solo jugó el primer mini-partido
  const beaEndRow = endgameBody.match(/<tr><td[^>]*>Bea[\s\S]*?<\/tr>/)[0];
  report.assert(beaEndRow.includes(">1<"), "Bea solo participó en 1 de los 2 mini-partidos");

  return report.summary();
}

module.exports = { run };
if (require.main === module) {
  run().then(({ failed }) => process.exit(failed ? 1 : 0));
}
