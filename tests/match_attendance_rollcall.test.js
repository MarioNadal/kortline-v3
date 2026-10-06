"use strict";
// v3.0.0-dev.87 · B-MATCHATT2: Mario, tras usar B-MATCHATT1 un tiempo:
// *"Lo de la asistencia a los partidos hay que darle una vuelta porque
// quiero que sea como en los entrenamientos, porque lo de convocados esta
// bien pero en un priucnipio estarán todos convocados si acaso podemos
// poner una opcion de no convocado especial"*.
//
// Confirmado con AskUserQuestion (3 preguntas, las 3 recomendadas):
// 1) Pase de lista COMPLETO para toda la plantilla activa, con los mismos 4
//    estados que entrenamientos (Presente/Ausente/Tarde/Justif.) + un 5º
//    estado especial "No convocado" para quien no entra en la convocatoria.
// 2) "No convocado" cuenta como asistencia positiva (como si hubiera
//    venido).
// 3) Se marca dentro de la propia convocatoria (sin pantalla aparte).
//
// No retroactivo (mismo criterio que B-MATCHATT1): solo los partidos creados
// desde esta versión, con rollCallAtt:true, usan el pase de lista completo
// -- los de dev.82-86 (countsForAttendance sin rollCallAtt) siguen con el
// comportamiento legado exacto (solo cuentan los convocados, como
// "presente", sin expandir al resto de la plantilla).
//
// v3.0.0-dev.88 · B-MATCHATT3: Mario probó esto y pidió simplificar la
// interfaz -- *"lo que hay ahora de convocatoria que marcas ahora no
// sairve porque aparecen los no convocados y enotnces no se entiende [...]
// Mas funcional y se vea mas simple"*. El test nº9 (UI real) se actualizó
// para reflejar el nuevo diseño: sin override no se muestra ningún texto
// ("Presente"/"No convocado" eran ruido visual en todas las filas), solo un
// icono pequeño y discreto; la pastilla de color con texto SOLO aparece
// cuando hay un override real (Ausente/Tarde/Justificado). La lógica de
// datos (_matchAttState/_matchAttCount/_convCycleAtt) no cambia en absoluto
// -- es puramente un ajuste de qué se pinta en cada caso.
const { loadApp, buildFixture, newReporter } = require("./harness");

async function run() {
  const report = newReporter("match_attendance_rollcall");
  const assert = (cond, msg) => report.assert(cond, msg);
  const doc_ = (win) => win.document;

  // ═══ 1) Crear un partido nuevo estampa rollCallAtt:true (además de countsForAttendance) ═══
  {
    const win = await loadApp();
    win.S.teamId = "t1";
    win.S.teams = [{ id: "t1", name: "Cadete Masculino", color: "#F06318" }];
    win.S.players = { t1: [] };
    win.S.matches = { t1: [] };
    win.S.screen = "matchList";
    win.render();
    win.openMatchModal();
    const doc = doc_(win);
    doc.getElementById("m-add-match-rival").value = "Rival Test";
    win.saveMatchMeta("m-add-match", "");
    const m = win.S.matches.t1[0];
    assert(m.countsForAttendance === true, "sigue estampando countsForAttendance:true, como desde B-MATCHATT1");
    assert(m.rollCallAtt === true, "B-MATCHATT2: además estampa rollCallAtt:true -- este partido usa el pase de lista completo");
  }

  // ═══ 2) _matchAttState(): derivado de convocados cuando no hay override ═══
  {
    const win = await loadApp();
    const match = buildFixture(win, { convocados: ["p1", "p2"], rollCallAtt: true });
    assert(win._matchAttState(match, "p1") === "present", "convocado sin override -> 'present'");
    assert(win._matchAttState(match, "p3") === "not_called", "no convocado sin override -> 'not_called'");
  }

  // ═══ 3) _convCycleAtt(): cicla auto -> ausente -> tarde -> justificado -> auto, para cualquier jugador ═══
  {
    const win = await loadApp();
    const match = buildFixture(win, { convocados: ["p1"], rollCallAtt: true });
    win.S.matchId = "m1";
    win._convCycleAtt("p1");
    assert(match.attOverride.p1 === "absent", "1er toque: ausente (anula el 'present' derivado de estar convocado)");
    assert(win._matchAttState(match, "p1") === "absent", "_matchAttState refleja el override, por encima de estar convocado");
    win._convCycleAtt("p1");
    assert(match.attOverride.p1 === "late", "2º toque: tarde");
    win._convCycleAtt("p1");
    assert(match.attOverride.p1 === "excused", "3er toque: justificado");
    win._convCycleAtt("p1");
    assert(match.attOverride.p1 === undefined, "4º toque: vuelve a automático (se borra el override)");
    assert(win._matchAttState(match, "p1") === "present", "y _matchAttState vuelve a derivarlo de convocados");

    // También funciona para alguien NO convocado (ej. marcar que de verdad no vino, no solo que no fue convocado)
    win._convCycleAtt("p3");
    assert(match.attOverride.p3 === "absent", "también se puede marcar ausente a alguien que no está en la convocatoria");
    assert(win._matchAttState(match, "p3") === "absent", "el override manda incluso sin estar convocado");
  }

  // ═══ 4) _matchAttCount() con rollCallAtt:true: pase de lista completo, 'not_called' cuenta como presente ═══
  {
    const win = await loadApp();
    win.S.teamId = "t1";
    win.S.teams = [{ id: "t1", name: "Cadete Masculino", color: "#F06318" }];
    win.S.players = {
      t1: [
        { id: "p1", name: "Ana", number: 4 },
        { id: "p2", name: "Bea", number: 5 },
        { id: "p3", name: "Cata", number: 6 }
      ]
    };
    const m1 = { id: "m1", rival: "Rival A", date: "2026-10-10", countsForAttendance: true, rollCallAtt: true, convocados: ["p1", "p2"], attOverride: { p2: "late" } };
    win.S.matches = { t1: [m1] };
    const p1 = win.S.players.t1[0], p2 = win.S.players.t1[1], p3 = win.S.players.t1[2];
    const c1 = win._matchAttCount(p1, "t1", []);
    assert(c1.tot === 1 && c1.pr === 1, "p1: convocado sin override -> presente (1/1)");
    const c2 = win._matchAttCount(p2, "t1", []);
    assert(c2.tot === 1 && c2.la === 1 && c2.pr === 0, "p2: convocado con override 'tarde' -> cuenta en 'la', no en 'pr'");
    const c3 = win._matchAttCount(p3, "t1", []);
    assert(c3.tot === 1 && c3.pr === 1, "B-MATCHATT2: p3 NO está convocado pero SÍ cuenta (pase de lista completo) y cuenta como presente ('No convocado' = presente)");
  }

  // ═══ 5) _matchAttCount() con rollCallAtt:true respeta _isPlayerActiveOn (no cuenta antes de que el jugador existiera) ═══
  {
    const win = await loadApp();
    win.S.teamId = "t1";
    win.S.teams = [{ id: "t1", name: "Cadete Masculino", color: "#F06318" }];
    win.S.players = { t1: [{ id: "p1", name: "Jugadora nueva", number: 9, addedAt: "2026-11-01" }] };
    const m1 = { id: "m1", rival: "Rival Antiguo", date: "2026-10-10", countsForAttendance: true, rollCallAtt: true, convocados: [] };
    win.S.matches = { t1: [m1] };
    const p1 = win.S.players.t1[0];
    const c = win._matchAttCount(p1, "t1", []);
    assert(c.tot === 0, "un partido anterior a que el jugador se diera de alta no cuenta para él (ni como 'no convocado'), igual que en entrenamientos");
  }

  // ═══ 6) _matchAttCount() SIN rollCallAtt (partido legado, B-MATCHATT1): sin cambios -- solo convocados, siempre 'presente' ═══
  {
    const win = await loadApp();
    win.S.teamId = "t1";
    win.S.teams = [{ id: "t1", name: "Cadete Masculino", color: "#F06318" }];
    win.S.players = {
      t1: [
        { id: "p1", name: "Ana", number: 4 },
        { id: "p2", name: "Bea", number: 5 }
      ]
    };
    // Partido de antes de B-MATCHATT2: countsForAttendance SIN rollCallAtt.
    const m1 = { id: "m1", rival: "Rival Legado", date: "2026-09-01", countsForAttendance: true, convocados: ["p1"], attOverride: { p2: "absent" } };
    win.S.matches = { t1: [m1] };
    const p1 = win.S.players.t1[0], p2 = win.S.players.t1[1];
    const c1 = win._matchAttCount(p1, "t1", []);
    assert(c1.tot === 1 && c1.pr === 1, "partido legado: convocado sigue contando como presente, exactamente como antes");
    const c2 = win._matchAttCount(p2, "t1", []);
    assert(c2.tot === 0, "partido legado: jugador NO convocado NO cuenta para nada, aunque tenga un attOverride -- B-MATCHATT2 no se aplica retroactivamente a este partido");
  }

  // ═══ 7) _matchAttCount() excluye matchOnly y attOnly igual que antes, incluso con rollCallAtt:true ═══
  {
    const win = await loadApp();
    win.S.teamId = "t1";
    win.S.teams = [{ id: "t1", name: "Cadete Masculino", color: "#F06318" }];
    const guest = { id: "g1", name: "Puntual de partido", number: 99, matchOnly: true };
    const trainingGuest = { id: "g2", name: "Puntual de entreno", number: 98, attOnly: true };
    win.S.players = { t1: [guest, trainingGuest] };
    const m1 = { id: "m1", rival: "Rival", date: "2026-10-10", countsForAttendance: true, rollCallAtt: true, convocados: [] };
    win.S.matches = { t1: [m1] };
    assert(win._matchAttCount(guest, "t1", []).tot === 0, "un puntual de PARTIDO sigue sin contar para asistencia, igual que antes");
    assert(win._matchAttCount(trainingGuest, "t1", []).tot === 0, "un puntual de ENTRENO tampoco cuenta para asistencia de partidos (nunca aparece en la convocatoria)");
  }

  // ═══ 8) _countAttAll(): el desglose ausente/tarde/justificado de partidos SÍ se suma ahora al combinado (antes solo se sumaba 'pr'/'tot') ═══
  {
    const win = await loadApp();
    win.S.teamId = "t1";
    win.S.teams = [{ id: "t1", name: "Cadete Masculino", color: "#F06318" }];
    win.S.players = { t1: [{ id: "p1", name: "Ana", number: 4 }] };
    const m1 = { id: "m1", rival: "Rival", date: "2026-10-10", countsForAttendance: true, rollCallAtt: true, convocados: [], attOverride: { p1: "absent" } };
    win.S.matches = { t1: [m1] };
    win.S.sessions = {};
    const p1 = win.S.players.t1[0];
    const c = win._countAttAll(p1, [], "t1");
    assert(c.tot === 1 && c.ab === 1 && c.pr === 0, "una ausencia marcada en un partido se refleja en 'ab' del combinado, no solo en 'pr'/'tot' como antes de B-MATCHATT2");
  }

  // ═══ 9) UI real (B-MATCHATT3/dev.88): sin override no hay texto -- solo un icono discreto; la pastilla de color SOLO aparece con un override real ═══
  {
    const win = await loadApp();
    const match = buildFixture(win, { convocados: ["p1"], rollCallAtt: true });
    win.S.screen = "matchDetail";
    win.render();
    win.openConvSetup();
    const doc = doc_(win);
    const row = doc.querySelector('[data-pid="p1"]');
    assert(!!row, "la fila de un convocado existe en el wizard real");
    assert(!row.innerHTML.includes("Presente"), "B-MATCHATT3: convocado sin override -- ya NO se muestra el texto 'Presente' (era ruido visual)");
    const icon = [...row.querySelectorAll("button")].find(b => b.title === "Marcar ausente/tarde/justificado");
    assert(!!icon, "en su lugar hay un icono pequeño y discreto, siempre tocable");
    icon.click();
    assert(match.convocados.includes("p1"), "tocar el icono NO quita a p1 de la convocatoria (event.stopPropagation funciona)");
    assert(match.attOverride.p1 === "absent", "tocar el icono sí registra el override 'ausente'");
    const rowAfter = doc.querySelector('[data-pid="p1"]');
    assert(rowAfter.innerHTML.includes("Ausente"), "CON un override real, la fila SÍ muestra la pastilla de color con su texto ('Ausente')");

    const row3 = doc.querySelector('[data-pid="p3"]'); // p3 no está convocado, sin override
    assert(!row3.innerHTML.includes("No convocado"), "B-MATCHATT3: un jugador no convocado, sin override, tampoco muestra ya el texto 'No convocado' -- el check (sin marcar) ya lo dice");
    const icon3 = [...row3.querySelectorAll("button")].find(b => b.title === "Marcar ausente/tarde/justificado");
    assert(!!icon3, "pero sigue teniendo el mismo icono discreto disponible, aunque no esté convocado");
  }

  return report.summary();
}

module.exports = { run };
if (require.main === module) { run().then(({ failed }) => process.exit(failed ? 1 : 0)); }
