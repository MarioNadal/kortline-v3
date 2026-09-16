"use strict";
// v3.0.0-dev.60 · B-INJ1: campo de "tipo de lesión" (lista predefinida) +
// "vuelta estimada" que se autorrellena según la duración típica del tipo
// elegido (INJURY_TYPES), pedido explícito de Mario. Cubre: setInjType()
// autorrellena la fecha, _recalcInjEstimate() la recalcula si cambia la
// fecha de inicio, saveInjury() persiste type/typeLabel/estimatedReturn,
// "other" no autorrellena nada, y la info se ve tanto en la Plantilla como
// en Riesgo FEB (Stats), y se archiva correctamente al dar de alta.
const { loadApp, newReporter } = require("./harness");

async function run() {
  const report = newReporter("injury_type_estimate");
  const win = await loadApp();
  const assert = (cond, msg) => report.assert(cond, msg);
  const doc = win.document;

  win.S.teams = [{ id: "t1", name: "Cadete Masculino", color: "#F06318", category: "Cadete", gender: "Masculino", schedule: {} }];
  win.S.players = { t1: [{ id: "p1", name: "Jugador Test", number: 7, addedAt: "2026-08-01" }] };
  win.S.sessions = {};
  win.S.matches = {};
  win.S.events = {};
  win.S.teamId = "t1";
  win.S.date = "2026-09-10";

  // ── 1) Abrir modal de nueva lesión, fijar fecha, elegir tipo con duración típica ──
  win.openInjuryNewModal("p1");
  const mid = "m-inj-p1";
  const dateEl = doc.getElementById(mid + "-date");
  assert(!!dateEl, "openInjuryNewModal(): existe el campo de fecha");
  dateEl.value = "2026-09-10";

  const ankleBtn = doc.querySelector(`#${mid}-types .inj-type[data-k="ankle_mild"]`);
  assert(!!ankleBtn, "el botón de tipo 'ankle_mild' existe en el selector");
  win.setInjType(mid, "ankle_mild");
  assert(ankleBtn.classList.contains("sel"), "setInjType(): el botón elegido queda marcado .sel");
  const estEl = doc.getElementById(mid + "-est");
  // ankle_mild = 10 días típicos → 2026-09-10 + 10 = 2026-09-20
  assert(estEl.value === "2026-09-20", "setInjType(): autorrellena la vuelta estimada (+10d para esguince leve de tobillo) — dio " + estEl.value);

  // ── 2) Cambiar la fecha de inicio y recalcular ──
  dateEl.value = "2026-09-12";
  win._recalcInjEstimate(mid);
  assert(estEl.value === "2026-09-22", "_recalcInjEstimate(): recalcula la vuelta al mover la fecha de inicio (+10d desde la nueva fecha) — dio " + estEl.value);

  // Vuelve a poner la fecha buena para guardar
  dateEl.value = "2026-09-10";
  win._recalcInjEstimate(mid);

  // ── 3) Guardar y comprobar que se persiste todo ──
  win.saveInjury(mid, "p1");
  const p1 = win.S.players.t1.find(x => x.id === "p1");
  assert(p1.injury && p1.injury.active === true, "saveInjury(): la lesión queda activa");
  assert(p1.injury.type === "ankle_mild", "saveInjury(): persiste el tipo elegido");
  assert(p1.injury.typeLabel && p1.injury.typeLabel.includes("Esguince"), "saveInjury(): persiste la etiqueta legible del tipo");
  assert(p1.injury.estimatedReturn === "2026-09-20", "saveInjury(): persiste la fecha de vuelta estimada");

  // ── 4) injuryEstimatedReturnShort/Info ──
  const info = win.injuryEstimatedReturnInfo(p1);
  assert(info && info.date === "2026-09-20", "injuryEstimatedReturnInfo(): devuelve la fecha guardada");
  const short = win.injuryEstimatedReturnShort(p1);
  assert(typeof short === "string" && short.length > 0, "injuryEstimatedReturnShort(): devuelve un texto no vacío");

  // ── 5) Visible en la Plantilla (roster) ──
  win.S.teamId = "t1";
  const teamHtml = win.team();
  assert(teamHtml.includes("Jugador Test"), "team(): la plantilla se renderiza con el jugador");
  const rowSlice = teamHtml.slice(teamHtml.indexOf("Jugador Test") - 10, teamHtml.indexOf("Jugador Test") + 600);
  assert(/vuelta/i.test(rowSlice) || rowSlice.includes("09-20") || rowSlice.includes("20 sep") || rowSlice.includes("20/09"), "team(): la fila del jugador muestra algo de la vuelta estimada — slice: " + JSON.stringify(rowSlice.slice(0, 300)));

  // ── 6) Visible en Riesgo FEB (Stats, vista tabla) ──
  win.S.sessions["t1_2026-09-05"] = { p1: "present" };
  const statsHtml = win.stats();
  assert(/vuelta|09-20|20 sep|20\/09/i.test(statsHtml), "stats(): incluye información de vuelta estimada en algún punto (Riesgo FEB)");

  // ── 7) Tipo "other": no autorrellena nada ──
  win.S.players.t1.push({ id: "p2", name: "Otro Jugador", number: 8, addedAt: "2026-08-01" });
  win.openInjuryNewModal("p2");
  const mid2 = "m-inj-p2";
  const dateEl2 = doc.getElementById(mid2 + "-date");
  dateEl2.value = "2026-09-10";
  win.setInjType(mid2, "other");
  const estEl2 = doc.getElementById(mid2 + "-est");
  assert(estEl2.value === "", "setInjType('other'): no autorrellena la vuelta estimada (sin duración típica)");
  win.saveInjury(mid2, "p2");
  const p2 = win.S.players.t1.find(x => x.id === "p2");
  assert(p2.injury.type === "other" && p2.injury.estimatedReturn === "", "saveInjury(): con tipo 'other' y sin fecha manual, estimatedReturn queda vacío");

  // ── 8) Edición: reabrir el modal de edición mantiene el tipo/fecha guardados ──
  win.openInjuryEditModal("p1");
  const editSelBtn = doc.querySelector(`#${mid}-types .inj-type.sel`);
  assert(editSelBtn && editSelBtn.dataset.k === "ankle_mild", "openInjuryEditModal(): preselecciona el tipo ya guardado");
  assert(doc.getElementById(mid + "-est").value === "2026-09-20", "openInjuryEditModal(): precarga la vuelta estimada ya guardada");
  doc.getElementById(mid)?.remove();

  // ── 9) Alta médica: el tipo y la vuelta estimada se archivan en injuryHistory ──
  win.confirmInjuryRecovery("p1");
  const p1After = win.S.players.t1.find(x => x.id === "p1");
  assert(p1After.injury === null, "confirmInjuryRecovery(): limpia la lesión activa");
  assert(Array.isArray(p1After.injuryHistory) && p1After.injuryHistory.length === 1, "confirmInjuryRecovery(): archiva una entrada en injuryHistory");
  const histEntry = p1After.injuryHistory[0];
  assert(histEntry.type === "ankle_mild", "injuryHistory: conserva el tipo de lesión");
  assert(histEntry.estimatedReturn === "2026-09-20", "injuryHistory: conserva la vuelta estimada original");

  return report.summary();
}

module.exports = { run };
