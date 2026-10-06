"use strict";
// v3.0.0-dev.89 · B-MATCHATT4: Mario, tras probar B-MATCHATT3 (dev.88):
// *"lo primero es saber si estan convocados o no al partido que en un
// principio estaran todos, y luego saber de los que estan convocados al
// partido que son los que les debe contar la asistencia (si no estan
// convocados no se les puede poner que no han ido) los que estan
// convocados se les pone lo de ausente, presente justificado o tarde. Y se
// pone en el detalle del partido ya. La lista con checklists ya no
// existe"*.
//
// Confirmado con AskUserQuestion (2 preguntas, las 2 recomendadas):
// 1) Los partidos NUEVOS nacen ya con toda la plantilla convocada (se
//    desmarca a quien no vaya), en vez de nacer vacíos.
// 2) La asistencia (Ausente/Tarde/Justificado) se marca DIRECTAMENTE en la
//    lista de Convocatoria que ya se ve en matchDetail -- ya no depende de
//    abrir el wizard/editor aparte (openConvSetup) para nada de esto. El
//    control de asistencia solo aparece para quien SÍ está convocado.
const { loadApp, buildFixture, newReporter } = require("./harness");

async function run() {
  const report = newReporter("match_attendance_in_detail");
  const assert = (cond, msg) => report.assert(cond, msg);
  const doc_ = (win) => win.document;

  // ═══ 1) Partido nuevo: convocados nace con TODA la plantilla (no vacío) ═══
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
    win.S.matches = { t1: [] };
    win.S.screen = "matchList";
    win.render();
    win.openMatchModal();
    const doc = doc_(win);
    doc.getElementById("m-add-match-rival").value = "Rival Test";
    win.saveMatchMeta("m-add-match", "");
    const m = win.S.matches.t1[0];
    assert(!!m, "el partido se crea de verdad");
    assert(m.convocados.length === 3, "B-MATCHATT4: convocados nace con toda la plantilla (3), no vacío -- dio " + m.convocados.length);
    assert(["p1", "p2", "p3"].every(id => m.convocados.includes(id)), "los 3 jugadores de la plantilla están convocados por defecto");
  }

  // ═══ 2) Partido nuevo: se excluyen los puntuales de ENTRENO (attOnly) del convocados por defecto, igual que el botón 'Todos' del wizard ═══
  {
    const win = await loadApp();
    win.S.teamId = "t1";
    win.S.teams = [{ id: "t1", name: "Cadete Masculino", color: "#F06318" }];
    win.S.players = {
      t1: [
        { id: "p1", name: "Ana", number: 4 },
        { id: "g1", name: "Puntual de entreno", number: 98, attOnly: true }
      ]
    };
    win.S.matches = { t1: [] };
    win.S.screen = "matchList";
    win.render();
    win.openMatchModal();
    const doc = doc_(win);
    doc.getElementById("m-add-match-rival").value = "Rival Test";
    win.saveMatchMeta("m-add-match", "");
    const m = win.S.matches.t1[0];
    assert(m.convocados.length === 1 && m.convocados[0] === "p1", "el puntual de entreno (attOnly) NO entra en el convocados por defecto -- dio " + JSON.stringify(m.convocados));
  }

  // ═══ 3) Partido nuevo: tope de 12 (FIBA), igual que el botón 'Todos' del wizard ═══
  {
    const win = await loadApp();
    win.S.teamId = "t1";
    win.S.teams = [{ id: "t1", name: "Cadete Masculino", color: "#F06318" }];
    win.S.players = { t1: Array.from({ length: 15 }, (_, i) => ({ id: "p" + i, name: "Jugador " + i, number: i })) };
    win.S.matches = { t1: [] };
    win.S.screen = "matchList";
    win.render();
    win.openMatchModal();
    const doc = doc_(win);
    doc.getElementById("m-add-match-rival").value = "Rival Test";
    win.saveMatchMeta("m-add-match", "");
    const m = win.S.matches.t1[0];
    assert(m.convocados.length === 12, "con más de 12 jugadores en plantilla, el convocados por defecto se corta en 12 (FIBA) -- dio " + m.convocados.length);
  }

  // ═══ 4) matchDetail(): el control de asistencia (⋯/pastilla) aparece YA en la propia lista de Convocatoria, sin abrir ningún editor aparte ═══
  {
    const win = await loadApp();
    const match = buildFixture(win, { convocados: ["p1", "p2"], rollCallAtt: true });
    win.S.screen = "matchDetail";
    win.render();
    const doc = doc_(win);

    const row1 = doc.querySelector('[data-conv-pid="p1"]');
    assert(!!row1, "la fila de un convocado existe en la propia lista del detalle del partido");
    const attBtn1 = [...row1.querySelectorAll("button")].find(b => b.title === "Marcar ausente/tarde/justificado");
    assert(!!attBtn1, "B-MATCHATT4: un convocado SÍ tiene el control de asistencia directamente en matchDetail, sin abrir '✏️ Editar'");

    const row3 = doc.querySelector('[data-conv-pid="p3"]'); // p3 no está convocado en este fixture
    assert(!!row3, "la fila de un NO convocado también existe (sigue en la lista, solo sin marcar)");
    const attBtn3 = [...row3.querySelectorAll("button")].find(b => b.title === "Marcar ausente/tarde/justificado");
    assert(!attBtn3, "B-MATCHATT4: si no está convocado, NO tiene control de asistencia -- no se le puede marcar que no ha ido a algo a lo que no fue convocado");
  }

  // ═══ 5) Tocar el icono de asistencia en matchDetail: cicla el override, NO desconvoca (stopPropagation) y refresca solo esa fila ═══
  {
    const win = await loadApp();
    const match = buildFixture(win, { convocados: ["p1", "p2"], rollCallAtt: true });
    win.S.screen = "matchDetail";
    win.render();
    const doc = doc_(win);
    const row1 = doc.querySelector('[data-conv-pid="p1"]');
    const attBtn1 = [...row1.querySelectorAll("button")].find(b => b.title === "Marcar ausente/tarde/justificado");
    attBtn1.click();
    assert(match.convocados.includes("p1"), "tocar el icono de asistencia no quita a p1 de la convocatoria (event.stopPropagation funciona)");
    assert(match.attOverride.p1 === "absent", "tocar el icono registra el override 'ausente', igual que en el wizard (mismo dato)");
    const row1After = doc.querySelector('[data-conv-pid="p1"]');
    assert(row1After.innerHTML.includes("Ausente"), "la fila se refresca mostrando ya la pastilla 'Ausente'");
    assert(row1After.innerHTML.includes("✓"), "p1 sigue marcado como convocado (el check no se ha tocado)");

    // Ciclar otra vez: tarde
    const attBtn1b = [...row1After.querySelectorAll("button")].find(b => b.title === "Toca para cambiar o quitar");
    attBtn1b.click();
    assert(match.attOverride.p1 === "late", "un segundo toque cicla a 'tarde'");

    // p2 (otro convocado) no se ha visto afectado
    const row2 = doc.querySelector('[data-conv-pid="p2"]');
    assert(!row2.innerHTML.includes("Ausente") && !row2.innerHTML.includes("Tarde"), "p2 no se ve afectado por el cambio de p1 -- solo se refresca la fila tocada");
  }

  // ═══ 6) El wizard (openConvSetup/_convRowInner) sigue funcionando exactamente igual -- sin cambios de comportamiento, solo se reutiliza el mismo botón de asistencia ═══
  {
    const win = await loadApp();
    const match = buildFixture(win, { convocados: ["p1"], rollCallAtt: true });
    win.S.screen = "matchDetail";
    win.render();
    win.openConvSetup();
    const doc = doc_(win);
    const row = doc.querySelector('[data-pid="p1"]');
    assert(!!row, "el wizard sigue abriéndose y mostrando la fila del convocado");
    const icon = [...row.querySelectorAll("button")].find(b => b.title === "Marcar ausente/tarde/justificado");
    assert(!!icon, "el wizard conserva su propio control de asistencia (independiente del de matchDetail)");
    icon.click();
    assert(match.attOverride.p1 === "absent", "el wizard sigue registrando el override igual que siempre");
  }

  return report.summary();
}

module.exports = { run };
if (require.main === module) { run().then(({ failed }) => process.exit(failed ? 1 : 0)); }
