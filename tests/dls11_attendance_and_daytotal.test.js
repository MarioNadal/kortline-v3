"use strict";
// v3.0.0-dev.95 · B-DLS11: Mario, cuatro mejoras pedidas sobre "Contraataque
// de 11" en el mismo mensaje:
// 1) "si se añade contraataque de 11 a un entrenamiento debe de usar las
//    personas disponibles en ese entrenamiento" -- antes openDlsSetupModal()
//    premarcaba a TODA la plantilla activa sin mirar la asistencia del día.
//    Confirmado con AskUserQuestion: ahora se premarca solo a quien conste
//    presente o con tarde ese entrenamiento (_attEffectiveState, la misma
//    lógica que ya usa el pase de lista) -- el resto se sigue mostrando en
//    la lista, sin marcar, para poder añadirlo a mano si hace falta.
// 2) "si se ha hecho más de un ejercicio de contraataque de 11 poder ver las
//    estadisticas totales del entrenamiento... porque normalmente hago 2
//    contraataques de 11 y quiero ver el total" -- confirmado: el total
//    combinado del día vive dentro del propio selector de sesiones de hoy
//    (_dlsOpenDaySessionsList), reutilizando el mismo agregado que ya existe
//    para "todo el histórico" (_dlsAggregateB11Html, B-DLS10) pero alimentado
//    solo con las sesiones de ESE día. Solo para Contraataque de 11, no para
//    "Final de partido" (Mario no lo pidió para ese tipo).
// 3) "el orden de los jugadores... tiene que salir igual de ordenado en la
//    pantalla primera y en la pantalla de las estadisticas... sino no tiene
//    sentido ordenarlo" + 4) "quiero que sea más fácil ordenar... que ahora
//    se mueven todos raro". Por dentro el orden ya era el mismo array
//    (b.players) que en la configuración, pero se pintaba como una REJILLA
//    de varias tarjetas por fila (en vez de la lista vertical de una fila
//    por jugador que usa la configuración) -- confirmado con AskUserQuestion:
//    la pantalla en vivo pasa a ser la MISMA lista vertical (mismo
//    componente .conv-row) que la configuración, y de paso se arregla que el
//    resaltado de "esto es lo que estoy arrastrando" (.dls-dragging) se
//    perdía en cada repintado durante el arrastre (el repintado reconstruye
//    el contenedor entero con innerHTML=, así que el nodo marcado se
//    destruye) -- ahora se vuelve a aplicar al nodo (nuevo) que corresponde
//    al mismo pid en cada paso del arrastre.
const { loadApp, newReporter } = require("./harness");

async function run() {
  const win = await loadApp();
  const report = newReporter("dls11_attendance_and_daytotal");
  const assert = (cond, msg) => report.assert(cond, msg);
  const { document } = win;

  win.S.teamId = "t1";
  win.S.teams = [{ id: "t1", name: "Infantil A", category: "Infantil", coaches: [] }];
  win.S.players = {
    t1: [
      { id: "p1", name: "Ana García", number: 4 },
      { id: "p2", name: "Bea López", number: 5 },
      { id: "p3", name: "Cata Ruiz", number: 6 },
      { id: "p4", name: "Dana Soto", number: 7, injury: { active: true, startDate: "2026-09-01" } }
    ]
  };
  win.S.drills = { t1: [{ id: "d1", name: "Contraataque de 11", category: "transition", dlsType: "b11" }] };
  win.S.matches = { t1: [] };
  win.S.events = { t1: [] };
  win.S.sessions = {};
  win.S.drillLive = {};
  win.S.date = "2026-10-08";
  win.S.cfg.features.exercises = true;

  // ═══ 1) Jugadores disponibles según la asistencia del día ═══
  {
    // p1 presente explícito, p2 ausente, p3 tarde, p4 sin marcar pero lesionada (auto-excused)
    win.S.sessions["t1_2026-10-08"] = { p1: "present", p2: "absent", p3: "late" };

    win.S.screen = "team";
    win.openDlsSetupModal("d1");
    assert(!!document.getElementById("m-dls-setup"), "openDlsSetupModal() abre el modal");
    assert(win._dlsSetup.selected.has("p1"), "B-DLS11: un jugador marcado explícitamente 'presente' queda premarcado");
    assert(win._dlsSetup.selected.has("p3"), "B-DLS11: un jugador marcado 'tarde' TAMBIÉN queda premarcado (llegó, participa)");
    assert(!win._dlsSetup.selected.has("p2"), "B-DLS11: un jugador marcado 'ausente' NO queda premarcado");
    assert(!win._dlsSetup.selected.has("p4"), "B-DLS11: una jugadora lesionada sin marcar (auto-justificada 'excused') tampoco queda premarcada");
    assert(win._dlsSetup.selected.size === 2, "en total, solo los 2 disponibles (presente + tarde) quedan premarcados");

    // Pero los 4 siguen apareciendo en la lista -- nadie desaparece, el entrenador puede añadir a mano
    const rosterList = document.getElementById("dls-roster-list");
    const rows = [...rosterList.querySelectorAll("[data-pid]")];
    assert(rows.length === 4, "B-DLS11: los 4 jugadores activos se siguen mostrando en la lista, estén o no premarcados");
    const onIds = rows.filter(r => r.querySelector(".conv-cb.on")).map(r => r.dataset.pid);
    assert(onIds.sort().join(",") === "p1,p3", "B-DLS11: visualmente, solo las filas de p1 y p3 aparecen marcadas (✓) de entrada");
    assert(rosterList.innerHTML.includes("premarcados los presentes de hoy") || document.querySelector("#m-dls-setup .fl").textContent.includes("premarcados"), "el modal explica por qué unos salen marcados y otros no");

    // El entrenador puede seguir añadiendo a mano a quien no esté premarcado (p.ej. p2 llegó tarde de verdad)
    win._dlsTogglePlayer("p2");
    assert(win._dlsSetup.selected.has("p2"), "B-DLS11: sigue siendo posible marcar a mano a alguien que no estaba premarcado");
    document.getElementById("m-dls-setup").remove();
  }

  // ═══ Caso sin asistencia tocada todavía: todos cuentan como disponibles (comportamiento de siempre, sin regresión) ═══
  {
    delete win.S.sessions["t1_2026-10-08"];
    win.S.players.t1[3].injury.active = false; // quitamos la lesión para este caso
    win.openDlsSetupModal("d1");
    assert(win._dlsSetup.selected.size === 4, "B-DLS11: si todavía no se ha tocado el pase de lista de hoy, todo el mundo se asume presente -- se premarcan los 4, como antes");
    document.getElementById("m-dls-setup").remove();
    win.S.players.t1[3].injury.active = true; // se restaura para el resto del test
  }

  // ═══ 2) Total combinado del día cuando se repite "Contraataque de 11" ═══
  {
    const mk = (id, p1v) => ({
      id, drillId: "d1", drillName: "Contraataque de 11", date: win.S.date, type: "b11", status: "finished",
      durationSec: 600, remainingSec: 0, checklist: { missPenalty: false },
      players: [{ id: "p1", name: "Ana García", number: 4 }, { id: "p3", name: "Cata Ruiz", number: 6 }],
      stats: {
        p1: { ...win._dlsEmptyStats(), p2m: p1v, p2a: 1 },
        p3: { ...win._dlsEmptyStats(), p2m: 1, p2a: 0 }
      },
      log: []
    });
    win.S.drillLive.t1 = { d1: [mk("s1", 2), mk("s2", 1)] }; // p1 anota 2 + 1 = 3 de dos en las dos sesiones de hoy

    win._dlsOpenDaySummary("d1", win.S.date);
    assert(!document.getElementById("m-dls-summary"), "con 2 sesiones terminadas hoy, no se asume cuál ver -- no abre el resumen directo");
    const daySessionsEl = document.getElementById("m-dls-day-sessions");
    assert(!!daySessionsEl, "se abre el selector de sesiones de hoy");
    assert(daySessionsEl.innerHTML.includes("se ha hecho 2 veces hoy"), "sigue avisando cuántas veces se ha repetido (sin regresión del aviso de B-DLS8)");
    assert(daySessionsEl.innerHTML.includes("Total combinado de hoy"), "B-DLS11: aparece la sección 'Total combinado de hoy'");
    assert(daySessionsEl.innerHTML.includes("Sesiones por separado"), "y debajo, las sesiones sueltas siguen pudiendo verse una a una");
    const sessBtns = [...daySessionsEl.querySelectorAll("[data-dls-day-session]")];
    assert(sessBtns.length === 2, "las 2 sesiones de hoy se siguen listando por separado, sin regresión");

    // El total combinado SUMA las dos sesiones -- p1 hizo 2/1 + 1/1 = 3/2 en total de tiros de 2
    assert(daySessionsEl.innerHTML.includes("3/5"), "B-DLS11: el total combinado SUMA las estadísticas de las dos sesiones de hoy para el mismo jugador (p1: 2+1 anotados de 3+2 intentados = 3/5)");

    document.getElementById("m-dls-day-sessions").remove();

    // Con una sola sesión terminada hoy, sigue yendo directo al resumen -- sin selector, sin total (B-DLS8, sin regresión)
    win.S.drillLive.t1.d1 = [mk("s1", 2)];
    win._dlsOpenDaySummary("d1", win.S.date);
    assert(!!document.getElementById("m-dls-summary") && !document.getElementById("m-dls-day-sessions"), "con una única sesión de hoy, sigue abriendo su resumen directamente, sin selector ni total");
    document.getElementById("m-dls-summary").remove();

    // "Final de partido" (endgame) con 2 sesiones el mismo día: selector sí, pero SIN total combinado (Mario no lo pidió para ese tipo)
    win.S.drills.t1.push({ id: "d2", name: "Final de partido", category: "scrimmage", dlsType: "endgame" });
    const mkEnd = (id) => ({
      id, drillId: "d2", drillName: "Final de partido", date: win.S.date, type: "endgame", status: "finished",
      durationSec: 150, remainingSec: 0, players: [{ id: "p1", name: "Ana García", number: 4, team: "A" }],
      stats: { p1: win._dlsEmptyStats() }, manualScore: { A: 10, B: 8 }, log: []
    });
    win.S.drillLive.t1.d2 = [mkEnd("e1"), mkEnd("e2")];
    win._dlsOpenDaySummary("d2", win.S.date);
    const endDaySessionsEl = document.getElementById("m-dls-day-sessions");
    assert(!!endDaySessionsEl, "B-DLS11: 'Final de partido' repetido el mismo día también abre el selector de sesiones");
    assert(!endDaySessionsEl.innerHTML.includes("Total combinado de hoy"), "B-DLS11: pero NO ofrece 'Total combinado de hoy' -- Mario solo lo pidió para Contraataque de 11");
    document.getElementById("m-dls-day-sessions").remove();
  }

  // ═══ 3) La pantalla en vivo usa la MISMA lista vertical que la configuración (ya no una rejilla) ═══
  {
    win.S.drillLive = {};
    win.S.sessions = {};
    win.S.screen = "team";
    win.openDlsSetupModal("d1");
    win._dlsToggleAll(true);
    document.getElementById("dls-minutes").value = "10";
    win.startDls();
    const b = win._dls();
    assert(!!b, "startDls() crea la sesión");

    win.navTo("dlsLive");
    win.render();
    const grid = document.getElementById("dls-live-grid");
    assert(!!grid, "la pantalla en vivo expone el contenedor #dls-live-grid");
    const style = grid.getAttribute("style") || "";
    assert(!style.includes("display:grid"), "B-DLS11: el contenedor en vivo ya NO es una rejilla multi-columna (display:grid) -- antes sí lo era");
    const rows = [...grid.querySelectorAll("[data-pid]")];
    assert(rows.length === 4 && rows.every(r => r.classList.contains("conv-row")), "B-DLS11: cada jugador se pinta como una fila .conv-row, el MISMO componente que usa la lista de configuración -- de un vistazo se ve que es el mismo orden");

    // ── El resaltado de "esto es lo que arrastro" (.dls-dragging) sobrevive al repintado durante el arrastre ──
    const draggedPid = rows[0].dataset.pid;
    const targetPid = rows[1].dataset.pid;
    win._dlsDragHandlePointerDown({ preventDefault() {}, stopPropagation() {} }, draggedPid, "#dls-live-grid", "live");
    let draggedRow = grid.querySelector(`[data-pid="${draggedPid}"]`);
    assert(draggedRow.classList.contains("dls-dragging"), "al empezar a arrastrar, la fila se marca con .dls-dragging");

    // Simulamos que el dedo pasa por encima de la fila del segundo jugador (mock de elementFromPoint, no hay layout real en jsdom)
    const targetRow = grid.querySelector(`[data-pid="${targetPid}"]`);
    document.elementFromPoint = () => targetRow;
    win._dlsDragPointerMove({ clientX: 0, clientY: 0 });

    // El repintado reconstruye el contenedor (innerHTML=) -- el nodo de antes ya no existe, hay que volver a buscarlo
    draggedRow = grid.querySelector(`[data-pid="${draggedPid}"]`);
    assert(!!draggedRow, "tras el repintado del arrastre, la fila del jugador arrastrado sigue existiendo (con un nuevo nodo)");
    assert(draggedRow.classList.contains("dls-dragging"), "B-DLS11: y ese nuevo nodo SIGUE marcado con .dls-dragging -- antes se perdía en cada repintado, dando la sensación de que 'se mueve todo raro'");

    // El orden visual ya refleja el intercambio
    const newOrder = [...grid.querySelectorAll("[data-pid]")].map(r => r.dataset.pid);
    assert(newOrder[0] === targetPid && newOrder[1] === draggedPid, "el jugador arrastrado y el de destino han intercambiado posición en el DOM");

    // Soltar: limpia el resaltado y persiste el nuevo orden (sin regresión de B-DLS9)
    win._dlsDragPointerUp();
    assert(!grid.querySelector(".dls-dragging"), "al soltar, el resaltado desaparece");
    assert(win.S.teams[0].dlsOrder[0] === targetPid && win.S.teams[0].dlsOrder[1] === draggedPid, "al soltar, el nuevo orden se guarda de verdad para el equipo (_dlsCommitLiveOrder + _dlsSaveTeamOrder)");

    delete document.elementFromPoint;
  }

  return report.summary();
}

module.exports = { run };
if (require.main === module) {
  run().then(({ failed }) => process.exit(failed > 0 ? 1 : 0));
}
