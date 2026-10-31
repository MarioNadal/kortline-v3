"use strict";
// v3.0.0-dev.100 · B-GUEST8: bug encontrado durante la simulación de
// temporada completa de la auditoría exhaustiva pedida por Mario. Al crear
// un evento (partido/tecnificación), saveEvento() llama automáticamente a
// _evtAutoSuggest(tid,eid) para rellenar convocados. Esa función usaba
// pl(tid) SIN el filtro "!p.attOnly" que SÍ llevan convRows/evtTogglePlayer
// dentro del mismo modal de convocatoria (B-GUEST3: "un puntual de
// ENTRENAMIENTO no es convocable a un evento"). Resultado: un puntual de
// entreno (attOnly) se colaba en e.convocados nada más crear el evento --
// invisible en el propio modal (que sí lo filtra al listar, así que el
// entrenador nunca lo ve ni puede quitarlo), pero buildEventoText()/
// shareEventoConv() leen e.convocados contra el roster completo SIN ese
// filtro, así que su nombre aparecía de verdad en el texto de WhatsApp de
// convocatoria compartido con el equipo.
//
// Fix: _evtAutoSuggest ahora filtra "!p.attOnly" igual que el resto de
// funciones de convocatoria de evento.
const { loadApp, newReporter } = require("./harness");

async function run() {
  const report = newReporter("evt_autosuggest_excludes_attonly_guest");
  const win = await loadApp();
  const assert = (cond, msg) => report.assert(cond, msg);

  const today = win.td();

  win.S.teams = [{ id: "t1", name: "Cadete Masculino", color: "#F06318", schedule: {} }];
  win.S.players = {
    t1: [
      { id: "p1", name: "Jugador Uno", number: 4, addedAt: "2026-07-01" },
      { id: "p2", name: "Jugador Dos", number: 5, addedAt: "2026-07-01" },
      // Puntual de ENTRENO: nunca debe ser convocable a un evento (B-GUEST3).
      { id: "g1", name: "Puntual de Entreno", number: 88, attOnly: true, addedAt: today, attDates: [today] }
    ]
  };
  win.S.matches = {};
  win.S.sessions = {};
  win.S.teamId = "t1";
  win.S.date = today;

  win.S.events = { t1: [{ id: "e1", tipo: "partido", rival: "Rival CB", fecha: today, convocados: [] }] };
  win._evtAutoSuggest("t1", "e1");
  const e = win.evtById("t1", "e1");

  assert(!e.convocados.includes("g1"),
    "B-GUEST8 FIX: _evtAutoSuggest NUNCA incluye a un puntual de entreno (attOnly) en convocados");
  assert(e.convocados.includes("p1") && e.convocados.includes("p2"),
    "_evtAutoSuggest sigue incluyendo a la plantilla oficial con normalidad");

  // La fuga real: buildEventoText() leía e.convocados contra el roster
  // completo sin filtrar -- si g1 se hubiera colado, su nombre aparecería
  // aquí, en el texto real de WhatsApp enviado al equipo.
  const text = win.buildEventoText("t1", "e1", {});
  assert(!text.includes("Puntual de Entreno"),
    "B-GUEST8 FIX: el texto de convocatoria de WhatsApp (buildEventoText) nunca nombra al puntual de entreno");

  return report.summary();
}

module.exports = { run };
