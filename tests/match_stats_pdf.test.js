"use strict";
// v3.0.0-dev.90 · B-MATCHPDF1: Mario, revisando las funciones de partido en
// vivo, pidió un PDF "muy muy chulo a la vez que profesional" con las
// estadísticas del partido al finalizar, "que salga todo". Confirmado con
// AskUserQuestion: (1) accesible tanto desde el resumen que sale justo al
// terminar como desde el detalle de un partido ya finalizado reabierto
// desde el historial (hoy no hay ningún otro sitio para eso); (2) incluye
// destacados del partido y las estadísticas del rival si se registraron
// individualizadas; (3) mismo estilo de marca que el PDF de asistencia ya
// existente (exportPDF). De paso, Mario avisó de que el botón "📋 Copiar
// stats" de matchSummaryScreen no funcionaba -- bug real encontrado: su
// onclick era un IIFE de texto que capturaba `convP`/`live`, variables
// LOCALES de matchSummaryScreen() inaccesibles para un onclick (que corre
// en el ámbito global) -- lanzaba un ReferenceError silencioso y nunca
// copiaba nada.
const { loadApp, buildFixture, newReporter } = require("./harness");

async function run() {
  const report = newReporter("match_stats_pdf");
  const assert = (cond, msg) => report.assert(cond, msg);
  const doc_ = (win) => win.document;

  // ═══ 1) _matchStatsComputed(): filas, totales y destacados correctos ═══
  {
    const win = await loadApp();
    const match = buildFixture(win, {
      finished: true,
      live: {
        qScores: [[20, 15], [18, 12], [15, 20], [10, 8]],
        stats: {
          p1: { p2m: 5, p2a: 2, p3m: 2, p3a: 1, p1m: 3, p1a: 0, ro: 2, rd: 4, ast: 6, foul: 1, stl: 2, blk: 0, to: 1 },
          p2: { p2m: 2, p2a: 3, p3m: 0, p3a: 2, p1m: 1, p1a: 1, ro: 1, rd: 2, ast: 1, foul: 3, stl: 0, blk: 1, to: 3 }
        },
        minTracked: { p1: 1800, p2: 1500 },
        plusMinusTracked: { p1: 8, p2: -3 }
      }
    });
    win.S.screen = "matchSummary";
    const { rows, totals, topScorer, topPM, topEFF, hasRival } = win._matchStatsComputed(match);
    assert(rows.length === 2, "solo entran en la tabla los jugadores con alguna estadística >0 registrada -- dio " + rows.length);
    const p1row = rows.find(r => r.name === "Ana García");
    assert(!!p1row, "la fila de p1 existe");
    assert(p1row.pts === 5 * 2 + 2 * 3 + 3 * 1, "los puntos de p1 se calculan igual que en pantalla (T2*2 + T3*3 + TL) -- dio " + p1row.pts);
    assert(p1row.pm === 8, "el +/- de p1 viene de _getPlusMinus() -- dio " + p1row.pm);
    assert(totals.pts === rows.reduce((s, r) => s + r.pts, 0), "los totales de puntos son la suma real de las filas, no un número aparte");
    assert(topScorer.name === "Ana García", "el destacado de máximo anotador es quien más puntos tiene");
    assert(topPM.name === "Ana García", "el destacado de mejor +/- es quien tiene el +/- más alto (p1: +8 vs p2: -3)");
    assert(!!topEFF, "hay un destacado de mejor valoración (EFF)");
    assert(hasRival === false, "sin rivalStatsEnabled, no se considera que haya estadísticas de rival");
  }

  // ═══ 2) Rival individualizado: solo cuenta si rivalStatsEnabled Y hay algo >0 ═══
  {
    const win = await loadApp();
    const match = buildFixture(win, {
      finished: true,
      rivalStatsEnabled: true,
      live: {
        qScores: [[20, 15]],
        stats: { p1: { p2m: 1, p2a: 0 } },
        rivalStats: { r1: { p2m: 4, p2a: 2, p3m: 1, p3a: 0, ro: 3, ast: 2, foul: 2, stl: 1, blk: 0, to: 2 } }
      }
    });
    const { hasRival, rivalRows, rivalTotals } = win._matchStatsComputed(match);
    assert(hasRival === true, "con rivalStatsEnabled y estadísticas reales del rival, hasRival es true");
    assert(rivalRows.length === 1 && rivalRows[0].name === "Rival Uno", "la fila del rival sale con su nombre real");
    assert(rivalRows[0].pts === 4 * 2 + 1 * 3, "los puntos del rival se calculan igual que los nuestros -- dio " + rivalRows[0].pts);
    assert(rivalTotals.pts === rivalRows[0].pts, "los totales del rival cuadran con su única fila");

    // Sin rivalStatsEnabled (aunque hubiera datos en live.rivalStats por lo que sea), no se muestra.
    match.rivalStatsEnabled = false;
    const noFlag = win._matchStatsComputed(match);
    assert(noFlag.hasRival === false, "sin el flag rivalStatsEnabled, nunca se consideran estadísticas de rival aunque existan en el dato");

    // Con el flag puesto pero todo a cero (nunca se llegó a anotar nada del rival).
    match.rivalStatsEnabled = true;
    match.live.rivalStats = { r1: { p2m: 0, p2a: 0, foul: 0 } };
    const allZero = win._matchStatsComputed(match);
    assert(allZero.hasRival === false, "con el flag puesto pero todas las estadísticas del rival a cero, no se saca una tabla vacía");
  }

  // ═══ 3) _copyMatchStats(): el bug real -- antes lanzaba ReferenceError y no copiaba nada ═══
  {
    const win = await loadApp();
    buildFixture(win, {
      finished: true,
      live: { qScores: [[10, 8]], stats: { p1: { p2m: 3, p2a: 1, ast: 2, ro: 1, rd: 1 } } }
    });
    win.S.screen = "matchSummary";
    let copied = null;
    win.navigator.clipboard = { writeText: (txt) => { copied = txt; return Promise.resolve(); } };
    let threw = null;
    try { win._copyMatchStats(); } catch (e) { threw = e; }
    assert(!threw, "B-MATCHPDF1: _copyMatchStats() ya NO lanza ReferenceError (antes el botón roto hacía justo esto, en silencio)" + (threw ? " -- lanzó: " + threw.message : ""));
    assert(typeof copied === "string" && copied.includes(win._shortName("Ana García")), "el texto copiado incluye de verdad al jugador con estadísticas -- dio: " + copied);
    assert(copied.includes("Mi Equipo") && copied.includes("Rival CB"), "el texto copiado incluye el encabezado equipo vs rival");

    // Caso sin ninguna estadística: avisa por toast, no intenta copiar nada raro.
    win.S.matches.t1[0].live.stats = {};
    copied = null;
    win._copyMatchStats();
    assert(copied === null, "sin ninguna estadística registrada, no se copia nada (se avisa por toast en vez de copiar una lista vacía)");
  }

  // ═══ 4) exportMatchStatsPDF(): no lanza, genera el PDF con el nombre esperado, e incluye al rival cuando procede ═══
  {
    const win = await loadApp();
    win.URL.createObjectURL = () => "blob:mock";
    win.URL.revokeObjectURL = () => {};
    const match = buildFixture(win, {
      date: "2026-10-06", finished: true, rivalStatsEnabled: true,
      live: {
        qScores: [[20, 15], [18, 12], [15, 20], [10, 8]],
        stats: {
          p1: { p2m: 5, p2a: 2, p3m: 2, p3a: 1, p1m: 3, p1a: 0, ro: 2, rd: 4, ast: 6, foul: 1, stl: 2, blk: 0, to: 1 },
          p2: { p2m: 2, p2a: 3, p3m: 0, p3a: 2, p1m: 1, p1a: 1, ro: 1, rd: 2, ast: 1, foul: 3, stl: 0, blk: 1, to: 3 }
        },
        rivalStats: { r1: { p2m: 6, p2a: 3, ro: 2, ast: 3, foul: 2, stl: 1, to: 2 } },
        minTracked: { p1: 1800, p2: 1500 }, plusMinusTracked: { p1: 8, p2: -3 }
      }
    });
    win.S.screen = "matchSummary";
    let savedAs = null;
    const waitJsPdf = async () => { for (let i = 0; i < 100 && typeof win.jspdf === "undefined"; i++) await new Promise(r => setTimeout(r, 100)); };
    await waitJsPdf();
    assert(typeof win.jspdf !== "undefined", "jsPDF se ha cargado (si esto falla, el resto de aserciones de este bloque no son fiables)");
    // No basta con parchear jsPDF.prototype.save -- autoTable/jsPDF puede
    // dejar `save` como propiedad propia de la instancia, que taparía el
    // parche del prototipo. Envolvemos el propio constructor para
    // interceptar la instancia real que crea exportMatchStatsPDF().
    const RealJsPDF = win.jspdf.jsPDF;
    win.jspdf.jsPDF = function (...args) {
      const inst = new RealJsPDF(...args);
      inst.save = function (fn) { savedAs = fn; return inst; };
      return inst;
    };
    let threw = null;
    try { win.exportMatchStatsPDF(); } catch (e) { threw = e; }
    win.jspdf.jsPDF = RealJsPDF;
    assert(!threw, "exportMatchStatsPDF() no lanza con un partido completo (stats + rival + varios cuartos)" + (threw ? " -- lanzó: " + threw.message : ""));
    assert(typeof savedAs === "string" && savedAs.includes("mi_equipo") && savedAs.includes("rival_cb") && savedAs.includes("2026-10-06"), "el nombre del PDF incluye equipo, rival y fecha -- dio " + savedAs);
  }

  // ═══ 5) exportMatchStatsPDF(): casos límite -- sin ninguna estadística, con prórroga, sin jsPDF cargado ═══
  {
    const win = await loadApp();
    win.URL.createObjectURL = () => "blob:mock";
    win.URL.revokeObjectURL = () => {};
    buildFixture(win, { finished: true, live: { qScores: [[0, 0]], stats: {} } });
    const waitJsPdf = async () => { for (let i = 0; i < 100 && typeof win.jspdf === "undefined"; i++) await new Promise(r => setTimeout(r, 100)); };
    await waitJsPdf();
    let threw = null;
    try { win.exportMatchStatsPDF(); } catch (e) { threw = e; }
    assert(!threw, "exportMatchStatsPDF() no lanza con un partido finalizado sin ninguna estadística individual registrada" + (threw ? " -- lanzó: " + threw.message : ""));

    // Con prórroga también cuenta y no desborda el diseño (no hay forma de comprobar
    // el layout en jsdom, pero sí que la llamada completa no lanza con más cuartos de los habituales).
    win.S.matches.t1[0].live.qScores = [[20, 18], [15, 14], [12, 10], [8, 9], [5, 4]];
    win.S.matches.t1[0].live.otCount = 1;
    threw = null;
    try { win.exportMatchStatsPDF(); } catch (e) { threw = e; }
    assert(!threw, "exportMatchStatsPDF() no lanza con una prórroga jugada" + (threw ? " -- lanzó: " + threw.message : ""));

    // Sin jsPDF "cargado" (undefined) -- debe avisar por toast y no lanzar.
    const realJspdf = win.jspdf;
    win.jspdf = undefined;
    threw = null;
    try { win.exportMatchStatsPDF(); } catch (e) { threw = e; }
    win.jspdf = realJspdf;
    assert(!threw, "exportMatchStatsPDF() no lanza si jsPDF todavía no ha terminado de cargar -- avisa por toast en vez de reventar");
  }

  // ═══ 6) Acceso desde el detalle de un partido ya finalizado (historial) ═══
  {
    const win = await loadApp();
    const match = buildFixture(win, { finished: true, live: { qScores: [[10, 8]], stats: { p1: { p2m: 1, p2a: 0 } } } });
    win.S.screen = "matchDetail";
    win.render();
    let doc = doc_(win);
    let btn = [...doc.querySelectorAll("button")].find(b => b.title === "Estadísticas y PDF");
    assert(!!btn, "B-MATCHPDF1: un partido finalizado con seguimiento en vivo SÍ tiene acceso a estadísticas/PDF desde su detalle en el historial");

    // Sin m.live (partido anotado a mano, sin seguimiento en vivo nunca) -- no hay nada que mostrar.
    const match2 = buildFixture(win, { id: "m2", finished: true });
    delete match2.live;
    win.S.matches.t1.push(match2);
    win.S.matchId = "m2";
    win.render();
    doc = doc_(win);
    btn = [...doc.querySelectorAll("button")].find(b => b.title === "Estadísticas y PDF");
    assert(!btn, "un partido finalizado SIN seguimiento en vivo (nunca hubo live.stats) no ofrece el acceso a estadísticas/PDF");

    // Partido NO finalizado (en curso o pendiente) -- tampoco, aunque tenga m.live.
    win.S.matchId = "m1";
    win.S.matches.t1[0].finished = false;
    win.render();
    doc = doc_(win);
    btn = [...doc.querySelectorAll("button")].find(b => b.title === "Estadísticas y PDF");
    assert(!btn, "un partido todavía no finalizado no ofrece el acceso a estadísticas/PDF (ese resumen es solo para partidos ya jugados)");
  }

  // ═══ 7) El botón del detalle navega al resumen con _fromDetail:true, y el "←" ahí vuelve de verdad al detalle ═══
  {
    const win = await loadApp();
    buildFixture(win, { finished: true, live: { qScores: [[10, 8]], stats: { p1: { p2m: 1, p2a: 0 } } } });
    win.S.screen = "matchDetail";
    win.render();
    const doc = doc_(win);
    const btn = [...doc.querySelectorAll("button")].find(b => b.title === "Estadísticas y PDF");
    btn.click();
    assert(win.S.screen === "matchSummary", "tocar el botón navega al resumen del partido");
    assert(win.S._fromDetail === true, "la navegación desde el detalle marca _fromDetail:true");
    win.render();
    const backBtn = doc_(win).querySelector(".header .bbtn");
    assert(backBtn.getAttribute("onclick") === "navBack()", "con _fromDetail:true, el botón '←' del resumen vuelve de verdad atrás (navBack), no siempre a Hoy");
    backBtn.click();
    assert(win.S.screen === "matchDetail", "pulsar '←' desde aquí vuelve correctamente al detalle del partido de donde se vino");
  }

  // ═══ 8) El flujo normal de "Finalizar partido" sigue yendo a Hoy al pulsar "←" (sin cambios de comportamiento) ═══
  {
    const win = await loadApp();
    const match = buildFixture(win, { quarters: 4, qMins: 10 });
    match.live = { q: 4, otCount: 0, qScores: [[10, 8], [10, 8], [10, 8], [10, 8]], clockSec: 0, stats: { p1: { p2m: 1, p2a: 0 } } };
    win.S.screen = "liveGame";
    win.render();
    win._finishAndShowSummary("t1", "m1");
    assert(win.S.screen === "matchSummary", "_finishAndShowSummary navega al resumen como siempre");
    assert(win.S._fromDetail === false, "el flujo normal de finalizar en vivo deja _fromDetail en false explícitamente (nunca pegado de una navegación anterior)");
    win.render();
    const backBtn = doc_(win).querySelector(".header .bbtn");
    assert(backBtn.getAttribute("onclick") === "navRoot('hoy')", "en el flujo normal de finalizar, '←' sigue yendo a Hoy (nunca de vuelta a la pantalla de partido en vivo ya terminada)");
  }

  // ═══ 9) El botón "📋 Copiar stats" en pantalla llama a la función corregida (no al IIFE roto de antes) ═══
  {
    const win = await loadApp();
    buildFixture(win, { finished: true, live: { qScores: [[10, 8]], stats: { p1: { p2m: 1, p2a: 0 } } } });
    win.S.screen = "matchSummary";
    win.S._summaryTab = "stats";
    win.render();
    const doc = doc_(win);
    const copyBtn = [...doc.querySelectorAll("button")].find(b => b.textContent.includes("Copiar stats"));
    assert(!!copyBtn, "el botón de copiar stats sigue existiendo en pantalla");
    assert(copyBtn.getAttribute("onclick") === "_copyMatchStats()", "B-MATCHPDF1: el botón llama a la función global corregida, no al IIFE que capturaba variables locales inexistentes");
    const pdfBtn = [...doc.querySelectorAll("button")].find(b => b.textContent.includes("Exportar PDF del partido"));
    assert(!!pdfBtn && pdfBtn.getAttribute("onclick") === "exportMatchStatsPDF()", "el nuevo botón de exportar PDF está en la pestaña de estadísticas del resumen");
  }

  return report.summary();
}

module.exports = { run };
if (require.main === module) { run().then(({ failed }) => process.exit(failed ? 1 : 0)); }
