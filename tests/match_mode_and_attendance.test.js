"use strict";
// v3.0.0-dev.82 · B-MATCHMODE1 + B-MATCHATT1: Mario pidió, en el apartado de
// Partidos, poder elegir por partido cómo se anota el resultado -- "Normal
// · por cuartos" (de siempre), "Normal · resultado final" (nuevo, un único
// marcador sin desglose) o "En directo" -- y que, una vez iniciado el
// directo, el partido ya no pueda volver a "normal". Además, pidió que la
// participación en partidos cuente como asistencia, tanto en la general
// como en la de partidos ("que cuente como asistencia para los jugadores
// en la general y en asistencias para los partidos").
//
// Decisiones confirmadas con Mario vía AskUserQuestion:
// 1) Selector de 3 modos en el modal de partido (quarters/final/live).
// 2) Cuenta como presente cualquier convocado (m.convocados), sin
//    distinguir titular/suplente ni "no-show".
// 3) Un solo % mezclado (entrenamientos + partidos), no una vista separada.
// 4) Solo de aquí en adelante -- los partidos YA guardados (sin
//    countsForAttendance) nunca empiezan a contar retroactivamente.
const { loadApp, buildFixture, newReporter } = require("./harness");

async function run() {
  const report = newReporter("match_mode_and_attendance");
  const assert = (cond, msg) => report.assert(cond, msg);

  // ═══ 1) Selector de modo en el modal: nuevo partido, por defecto "quarters" ═══
  {
    const win = await loadApp();
    win.S.teams = [{ id: "t1", name: "Cadete Masculino", color: "#F06318", category: "Cadete", gender: "Masculino", schedule: {} }];
    win.S.players = { t1: [] };
    win.S.matches = {};
    win.S.teamId = "t1";
    win.openMatchModal(null);
    const mid = "m-add-match";
    const doc = win.document;
    assert(!!doc.getElementById(mid + "-modes"), "openMatchModal(null): el selector de modo existe para un partido nuevo");
    const btns = doc.querySelectorAll("#" + mid + "-modes .match-mode-btn");
    assert(btns.length === 3, "openMatchModal(null): el selector tiene exactamente 3 opciones -- tenía " + btns.length);
    const selBtn = doc.querySelector("#" + mid + "-modes .match-mode-btn.sel");
    assert(selBtn && selBtn.dataset.k === "quarters", "openMatchModal(null): por defecto, el modo preseleccionado es 'quarters' (por cuartos, como siempre)");

    // Elegir "resultado final" a mano
    win.setMatchModeBtn(mid, "final");
    const selAfter = doc.querySelector("#" + mid + "-modes .match-mode-btn.sel");
    assert(selAfter && selAfter.dataset.k === "final", "setMatchModeBtn(): marca el botón elegido como .sel");
    assert(doc.getElementById(mid + "-modes").querySelectorAll(".match-mode-btn.sel").length === 1, "setMatchModeBtn(): solo un botón queda marcado .sel a la vez");

    // Rellenar lo mínimo y guardar
    doc.getElementById(mid + "-rival").value = "Rival CB";
    win.saveMatchMeta(mid, "");
    const saved = win.S.matches.t1[0];
    assert(saved.matchMode === "final", "saveMatchMeta(): persiste el modo elegido en el selector ('final')");
    assert(saved.countsForAttendance === true, "saveMatchMeta(): un partido NUEVO se estampa con countsForAttendance:true (de aquí en adelante)");
  }

  // ═══ 2) Partido ya en directo: el selector queda fijo/bloqueado ═══
  {
    const win = await loadApp();
    win.S.teams = [{ id: "t1", name: "Cadete Masculino", color: "#F06318", category: "Cadete", gender: "Masculino", schedule: {} }];
    win.S.players = { t1: [{ id: "p1", name: "Jugador Test", number: 4 }] };
    const liveMatch = { id: "m1", rival: "Rival Live", quarters: 4, qMins: 10, matchMode: "live", countsForAttendance: true, convocados: ["p1"], live: { qScores: [[1, 2]] } };
    win.S.matches = { t1: [liveMatch] };
    win.S.teamId = "t1";
    win.openMatchModal(liveMatch);
    const mid = "m-edit-match";
    const doc = win.document;
    assert(!doc.getElementById(mid + "-modes"), "openMatchModal(partido en directo): el selector de 3 botones ya no se muestra");
    const html = doc.getElementById(mid).innerHTML;
    assert(html.includes("En directo -- ya iniciado"), "openMatchModal(partido en directo): se explica que el modo queda fijo");

    // Guardar sin tocar nada más: el modo guardado se conserva
    doc.getElementById(mid + "-rival").value = "Rival Live";
    win.saveMatchMeta(mid, "m1");
    const saved = win.S.matches.t1.find(m => m.id === "m1");
    assert(saved.matchMode === "live", "saveMatchMeta(): al editar un partido ya en directo, el modo guardado ('live') se conserva sin cambios");
  }

  // ═══ 3) Modo "resultado final": matchDetail() muestra un único marcador, sin grid de cuartos ═══
  {
    const win = await loadApp();
    const match = buildFixture(win, { matchMode: "final", countsForAttendance: true, q: [null, null, null, null, null, null, null, null, null, null] });
    win.S.screen = "matchDetail";
    const html = win.matchDetail();
    assert(html.includes("Resultado final"), "matchDetail() en modo 'final': el título cambia a 'Resultado final'");
    assert(!html.includes("addManualOT()"), "matchDetail() en modo 'final': no tiene sentido añadir una prórroga por cuartos, así que ese botón no aparece");
    // El editor de resultado final usa los mismos helpers genéricos _qStep/_qInlineEdit, pero solo sobre los índices 0 y 1
    assert(html.includes("_qStep(0,"), "matchDetail() en modo 'final': el marcador usa _qStep(0,...) para el total local");
    assert(html.includes("_qStep(1,"), "matchDetail() en modo 'final': el marcador usa _qStep(1,...) para el total visitante");
    assert(!html.includes("_qStep(2,") && !html.includes("_qStep(3,"), "matchDetail() en modo 'final': NO aparecen steppers para el resto de cuartos (2,3,4...)");

    // Anotar el resultado final a mano y comprobar que mScore/mResult lo reflejan sin tocar ninguna otra función
    win.updateQ(0, "62");
    win.updateQ(1, "54");
    const m = win.mById(win.S.teamId, win.S.matchId);
    const sc = win.mScore(m);
    assert(sc.h === 62 && sc.a === 54, "mScore(): con modo 'final', escribir solo q[0]/q[1] basta -- mScore() los suma igual que siempre (dio h=" + sc.h + " a=" + sc.a + ")");
    assert(win.mResult(m) === "W", "mResult(): con el resultado final anotado, el partido se resuelve como Victoria sin ningún cambio en mResult()");
  }

  // ═══ 4) Modo "live" elegido pero sin iniciar aún: no se puede anotar a mano ═══
  {
    const win = await loadApp();
    buildFixture(win, { matchMode: "live", countsForAttendance: true });
    win.S.screen = "matchDetail";
    const html = win.matchDetail();
    assert(html.includes("usa el botón de seguimiento en vivo"), "matchDetail() en modo 'live' sin iniciar: explica que hay que usar el seguimiento en vivo");
    assert(!html.includes("_qStep("), "matchDetail() en modo 'live' sin iniciar: no hay ningún stepper editable a mano");
  }

  // ═══ 5) Modo "quarters" (o sin matchMode, retrocompatible): todo igual que siempre ═══
  {
    const win = await loadApp();
    buildFixture(win); // sin matchMode -> por defecto "quarters"
    win.S.screen = "matchDetail";
    const html = win.matchDetail();
    assert(html.includes("Marcador por cuartos"), "matchDetail() sin matchMode (partido antiguo): sigue mostrando el grid de cuartos de siempre");
    assert(html.includes("_qStep(0,") && html.includes("_qStep(7,"), "matchDetail() sin matchMode: el grid completo de cuartos (8 índices para 4 cuartos) sigue editable");
  }

  // ═══ 6) Asistencia: un partido que cuenta se mezcla con los entrenamientos ═══
  {
    const win = await loadApp();
    win.S.teams = [{ id: "t1", name: "Cadete Masculino", color: "#F06318", category: "Cadete", gender: "Masculino", schedule: {} }];
    win.S.players = {
      t1: [
        { id: "p1", name: "Convocada Siempre", number: 4, addedAt: "2026-08-01" },
        { id: "p2", name: "Nunca Convocada", number: 5, addedAt: "2026-08-01" }
      ]
    };
    // 3 entrenamientos: p1 presente en los 3, p2 presente en los 3 también (misma base)
    win.S.sessions = {
      "t1_2026-08-05": { p1: "present", p2: "present" },
      "t1_2026-08-07": { p1: "present", p2: "present" },
      "t1_2026-08-10": { p1: "present", p2: "present" }
    };
    // 2 partidos NUEVOS (countsForAttendance:true) -- p1 convocada a ambos, p2 a ninguno
    win.S.matches = {
      t1: [
        { id: "m1", rival: "Rival A", date: "2026-08-12", countsForAttendance: true, convocados: ["p1"], q: [] },
        { id: "m2", rival: "Rival B", date: "2026-08-19", countsForAttendance: true, convocados: ["p1"], q: [] }
      ]
    };
    win.S.events = {};
    win.S.teamId = "t1";
    const p1 = win.S.players.t1[0], p2 = win.S.players.t1[1];
    const sessList = Object.entries(win.S.sessions).map(([k, v]) => ({ date: k.replace("t1_", ""), data: v }));

    const base1 = win._countAtt(p1, sessList);
    assert(base1.tot === 3, "_countAtt(): sin partidos, p1 tiene 3 entrenamientos (sanity)");

    const blended1 = win._countAttAll(p1, sessList, "t1");
    assert(blended1.tot === 5, "_countAttAll(): p1 (3 entrenos + 2 partidos convocada) -> total 5 -- dio " + blended1.tot);
    assert(blended1.pr === 5, "_countAttAll(): p1 presente en los 3 entrenos + presente en los 2 partidos -> 5 presentes -- dio " + blended1.pr);

    const blended2 = win._countAttAll(p2, sessList, "t1");
    assert(blended2.tot === 3, "_countAttAll(): p2 (3 entrenos + 0 partidos, nunca convocada) -> total sigue siendo 3, los partidos no la afectan -- dio " + blended2.tot);

    // Helper aislado
    const mc1 = win._matchAttCount(p1, "t1");
    assert(mc1.tot === 2 && mc1.pr === 2, "_matchAttCount(): p1 cuenta 2/2 partidos (convocada a ambos, todo convocado cuenta como presente)");
    const mc2 = win._matchAttCount(p2, "t1");
    assert(mc2.tot === 0, "_matchAttCount(): p2 no está convocada a ningún partido -> 0");
  }

  // ═══ 7) No retroactivo: un partido YA EXISTENTE (sin countsForAttendance) nunca cuenta ═══
  {
    const win = await loadApp();
    win.S.teams = [{ id: "t1", name: "Cadete Masculino", color: "#F06318", category: "Cadete", gender: "Masculino", schedule: {} }];
    win.S.players = { t1: [{ id: "p1", name: "Jugadora", number: 4, addedAt: "2026-08-01" }] };
    win.S.sessions = {};
    // Partido antiguo, de antes de dev.82 -- SIN countsForAttendance, p1 convocada
    win.S.matches = { t1: [{ id: "old1", rival: "Rival Viejo", date: "2026-08-01", convocados: ["p1"], q: [] }] };
    win.S.events = {};
    win.S.teamId = "t1";
    const p1 = win.S.players.t1[0];
    const mc = win._matchAttCount(p1, "t1");
    assert(mc.tot === 0, "_matchAttCount(): un partido ya guardado SIN countsForAttendance nunca cuenta, aunque la jugadora esté convocada (no retroactivo, confirmado con Mario)");
    const blended = win._countAttAll(p1, [], "t1");
    assert(blended.tot === 0, "_countAttAll(): coherente con lo anterior, el total mezclado tampoco se ve afectado por el partido antiguo");

    // Editar ese partido antiguo (sin tocar el modo) NO le añade countsForAttendance retroactivamente
    win.S.matchId = "old1";
    win.openMatchModal(win.S.matches.t1[0]);
    const mid = "m-edit-match";
    win.document.getElementById(mid + "-rival").value = "Rival Viejo";
    win.saveMatchMeta(mid, "old1");
    const afterEdit = win.S.matches.t1.find(m => m.id === "old1");
    assert(afterEdit.countsForAttendance !== true, "saveMatchMeta(): editar un partido antiguo (ya existente) NO le añade countsForAttendance -- sigue sin contar");
  }

  // ═══ 8) El puntual de partido (matchOnly) sigue sin contar nada, ni por partidos ═══
  {
    const win = await loadApp();
    win.S.teams = [{ id: "t1", name: "Cadete Masculino", color: "#F06318", category: "Cadete", gender: "Masculino", schedule: {} }];
    const guest = { id: "g1", name: "Puntual De Partido", number: 99, matchOnly: true, addedAt: "2026-08-12" };
    win.S.players = { t1: [guest] };
    win.S.sessions = {};
    win.S.matches = { t1: [{ id: "m1", rival: "Rival A", date: "2026-08-12", countsForAttendance: true, convocados: ["g1"], q: [] }] };
    win.S.events = {};
    win.S.teamId = "t1";
    const mc = win._matchAttCount(guest, "t1");
    assert(mc.tot === 0, "_matchAttCount(): un puntual de PARTIDO (matchOnly) sigue sin contar nada, ni siquiera por el partido al que fue convocado -- sin cambios respecto a _countAtt()");
  }

  return report.summary();
}

module.exports = { run };
if (require.main === module) { run().then(({ failed }) => process.exit(failed ? 1 : 0)); }
