"use strict";
const { loadApp, buildFixture, newReporter } = require("./harness");

// B-FIBA26: el usuario pidió implementar el cambio de reglamento FIBA para
// la temporada 2026-27 (vigente desde el 1 de octubre de 2026, verificado
// contra el reglamento oficial OBR 2026 de FIBA, Art. 36-39): la falta
// antideportiva desaparece, sustituida por "disruptiva" (fdisr, NO cuenta
// para descalificación -- Art. 37.2.1 solo la carga como falta de EQUIPO)
// y "flagrante" (fflag, SÍ cuenta -- Art. 38.2.3, ocupa el papel de la
// antideportiva de antes). La técnica se divide en categoría 1 (ftech1,
// cuenta para descalificación) y categoría 2 (ftech2, no cuenta, pero SÍ
// se carga como falta de jugador -- Art. 36.3.1 -- así que suma para el
// límite general de 5).
//
// Es un cambio de reglamento que solo aplica cuando la competición lo
// adopte -- se activa por partido (m.fibaRules2026, por defecto false), sin
// tocar el comportamiento de partidos con el reglamento anterior.
async function run() {
  const report = newReporter("fiba2026_rules");
  const win = await loadApp();

  // ── _isDQ() con los nuevos tipos de falta ──
  report.assert(win._isDQ({ foul: 0, ftech1: 2 }) === true, "_isDQ: 2 técnicas cat.1 descalifica");
  report.assert(win._isDQ({ foul: 0, ftech2: 2 }) === false, "_isDQ: 2 técnicas cat.2 NO descalifica (administrativas, Art. 36.2.1)");
  report.assert(win._isDQ({ foul: 0, fflag: 2 }) === true, "_isDQ: 2 flagrantes descalifica (Art. 38.2.3)");
  report.assert(win._isDQ({ foul: 0, fdisr: 2 }) === false, "_isDQ: 2 disruptivas NO descalifica nunca (Art. 37.2.1, quedan excluidas a propósito)");
  report.assert(win._isDQ({ foul: 0, fdisr: 10 }) === false, "_isDQ: ninguna cantidad de disruptivas descalifica");
  report.assert(win._isDQ({ foul: 0, ftech1: 1, fflag: 1 }) === true, "_isDQ: 1 técnica cat.1 + 1 flagrante descalifica (Art. 38.2.3)");
  report.assert(win._isDQ({ foul: 4, ftech2: 1 }) === true, "_isDQ: 4 personales + 1 técnica cat.2 = 5 en total SÍ descalifica (cat.2 cuenta como falta de jugador, Art. 36.3.1)");
  report.assert(win._isDQ({ foul: 4, fdisr: 1 }) === false, "_isDQ: 4 personales + 1 disruptiva = NO descalifica (la disruptiva no cuenta como falta de jugador)");
  report.assert(win._isDQ({ foul: 3, ftech1: 1, ftech2: 1 }) === true, "_isDQ: 3 personales + 1 técnica cat.1 + 1 técnica cat.2 = 5 en total, descalifica");

  // ── _totalFouls() informativo (SÍ incluye disruptivas, a efectos de mostrar cuántas ha cometido) ──
  report.assert(win._totalFouls({ foul: 2, ftech1: 1, ftech2: 1, fdisr: 1, fflag: 1 }) === 6, "_totalFouls: suma los 6 tipos de falta (informativo, incluye disruptivas)");

  // ── _foulTroubleMsg() con los nuevos tipos ──
  report.assert(win._foulTroubleMsg({ foul: 3, ftech2: 1 }) === "4 faltas en total (a una de la descalificación)", "_foulTroubleMsg: 3 personales + 1 técnica cat.2 SÍ avisa (suma 4 relevantes)");
  report.assert(win._foulTroubleMsg({ foul: 3, fdisr: 1 }) === null, "_foulTroubleMsg: 3 personales + 1 disruptiva NO avisa (la disruptiva no cuenta para el umbral)");

  // ── Partido con fibaRules2026 activo: el panel de faltas en vivo ofrece los 6 botones nuevos ──
  const match = buildFixture(win, { fibaRules2026: true });
  win.S.screen = "liveGame";
  const html = win.liveGame();
  report.assert(html.includes("openActionPicker('ftech1',0)"), "liveGame con fibaRules2026: ofrece el botón TÉC-1");
  report.assert(html.includes("openActionPicker('ftech2',0)"), "liveGame con fibaRules2026: ofrece el botón TÉC-2");
  report.assert(html.includes("openActionPicker('fdisr',0)"), "liveGame con fibaRules2026: ofrece el botón DISR");
  report.assert(html.includes("openActionPicker('fflag',0)"), "liveGame con fibaRules2026: ofrece el botón FLA");
  report.assert(!html.includes("openActionPicker('funsport',0)"), "liveGame con fibaRules2026: YA NO ofrece 'Antideportiva' (ANT)");
  report.assert(html.includes("Reglamento FIBA 2026-27 activo"), "liveGame con fibaRules2026: avisa visiblemente de qué reglamento está usando este partido");

  // ── Partido SIN fibaRules2026 (por defecto, false): todo sigue exactamente igual que antes ──
  buildFixture(win, {});
  const htmlOld = win.liveGame();
  report.assert(htmlOld.includes("openActionPicker('ftech',0)"), "liveGame sin fibaRules2026 (por defecto): sigue ofreciendo el botón TÉC clásico");
  report.assert(htmlOld.includes("openActionPicker('funsport',0)"), "liveGame sin fibaRules2026: sigue ofreciendo 'Antideportiva' (ANT) -- comportamiento sin cambios");
  report.assert(!htmlOld.includes("openActionPicker('ftech1',0)"), "liveGame sin fibaRules2026: NO ofrece los botones nuevos");

  // ── Registrar una falta técnica cat.1 en vivo: 1 TL de penalización, cuenta como falta de equipo ──
  const m2 = win.mById(win.S.teamId, win.S.matchId);
  buildFixture(win, { fibaRules2026: true });
  win.liveGame();
  const m3 = win.mById(win.S.teamId, win.S.matchId);
  const p1 = m3.convocados[0];
  win.liveAction(p1, "ftech1", 0);
  report.assert(m3.live.stats[p1].ftech1 === 1, "liveAction('ftech1'): se registra en las stats del jugador");
  report.assert((m3.live.teamFouls[0] || 0) === 1, "liveAction('ftech1'): cuenta como falta de equipo (Art. 36.3.1)");

  // ── Registrar una disruptiva: cuenta como falta de equipo pero NO descalifica aunque se repita ──
  win.liveAction(p1, "fdisr", 0);
  win.liveAction(p1, "fdisr", 0);
  win.liveAction(p1, "fdisr", 0);
  report.assert(m3.live.stats[p1].fdisr === 3, "liveAction('fdisr') x3: se registran las 3");
  report.assert(win._isDQ(m3.live.stats[p1]) === false, "tras 3 disruptivas (+1 técnica cat.1), el jugador NO está descalificado");
  report.assert((m3.live.teamFouls[0] || 0) === 4, "las disruptivas SÍ suman al contador de faltas de equipo (para el bonus)");

  return report.summary();
}

module.exports = { run };
