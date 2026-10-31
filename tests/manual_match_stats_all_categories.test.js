"use strict";
// v3.0.0-dev.103 · auditoría exhaustiva (a petición de Mario: "hazle
// pruebas de manera exhaustiva... antes de que pruebe yo") -- cierre de la
// tarea #11: manual_match_stats_reduced.test.js solo probó "Infantil" y
// "sin categoría" como representantes del formulario reducido; Senior
// como representante del completo. El código decide con una simple
// comparación de string (`(t.category||"")==="Senior"`), así que en teoría
// CUALQUIER otra categoría de la lista CATEGORIES debería comportarse
// exactamente igual que "Infantil" -- pero "en teoría" no es "probado", y
// la regla de la casa es verificar, no asumir. Este test recorre TODAS las
// categorías reales de la app (Escuela, Benjamín, Alevín, Cadete, Junior,
// 3x3, Otro) una por una y comprueba que cada una obtiene el formulario
// reducido (igual que Infantil), y que Senior -- y solo Senior -- obtiene
// el completo.
const { loadApp, newReporter } = require("./harness");

async function run() {
  const report = newReporter("manual_match_stats_all_categories");
  const win = await loadApp();
  const document = win.document;
  const assert = (cond, msg) => report.assert(cond, msg);

  // Misma lista que CATEGORIES en index.html (duplicada deliberadamente:
  // si algún día alguien la cambia en la app sin tocar este test, es
  // preferible que el test se quede "desactualizado pero correcto" para
  // las categorías que sí conoce, antes que depender de un acceso interno
  // a una const no exportada).
  const ALL_CATEGORIES = ["Escuela", "Benjamín", "Alevín", "Infantil", "Cadete", "Junior", "Senior", "3x3", "Otro"];
  const NON_SENIOR = ALL_CATEGORIES.filter((c) => c !== "Senior");

  win.S.players = { tcat: [{ id: "p1", name: "Jugadora Uno", number: 4, addedAt: "2026-07-01" }] };
  win.S.sessions = {};
  win.S.teamId = "tcat";
  win.S.matchId = "mcat";

  function setupMatchFor(category) {
    win.S.teams = [{ id: "tcat", name: `Equipo ${category}`, category, color: "#F06318", schedule: {} }];
    win.S.matches = { tcat: [{ id: "mcat", rival: "Rival", date: win.td(), quarters: 4, qMins: 10, location: "home", matchMode: "quarters", convocados: ["p1"], titulares: [], capitan: null, q: [null, null, null, null, null, null, null, null], notes: "" }] };
    document.getElementById("m-manual-stats")?.remove();
  }

  function setInput(pid, k, v) {
    const row = document.querySelector(`#m-manual-stats tr[data-ms-pid="${pid}"]`);
    const inp = row && row.querySelector(`[data-k="${k}"]`);
    if (inp) { inp.value = String(v); inp.dispatchEvent(new win.Event("input", { bubbles: true })); }
  }

  NON_SENIOR.forEach((category) => {
    setupMatchFor(category);
    win.openManualStatsModal(0);
    const modalHtml = document.getElementById("m-manual-stats")?.outerHTML || "";
    assert(modalHtml.includes("formulario reducido") || modalHtml.includes("TL%"), `Categoría "${category}": el modal de estadísticas por cuarto muestra el formulario REDUCIDO (igual que Infantil)`);
    assert(!/data-k="ro"/.test(modalHtml) && !/data-k="rd"/.test(modalHtml) && !/data-k="ast"/.test(modalHtml), `Categoría "${category}": el modal NO incluye las columnas del box score completo (rebotes/asistencias/etc.)`);
    assert(/data-k="p2m"/.test(modalHtml) && /data-k="p3m"/.test(modalHtml) && /data-k="p1m"/.test(modalHtml) && /data-k="p1a"/.test(modalHtml), `Categoría "${category}": el modal SÍ incluye las columnas reducidas (T2, T3, TL anotados/intentos)`);

    // Para que matchDetail() muestre la tabla-resumen (y con ella el botón
    // +/-), _matchPlayerStats(m) necesita datos reales guardados -- no
    // basta con haber abierto el modal. Se anota y guarda una línea mínima.
    setInput("p1", "min", 8);
    setInput("p1", "p2m", 2);
    win.saveManualStatsQuarter(0);

    // matchDetail() debe mostrar la columna +/- editable para esta categoría.
    win.S.screen = "matchDetail";
    win.render();
    const detailHtml = document.getElementById("root")?.innerHTML || "";
    assert(detailHtml.includes('id="ms-summary-table"'), `Categoría "${category}": la tabla-resumen SÍ se renderiza (hay datos guardados)`);
    assert(detailHtml.includes("savePlusMinus()"), `Categoría "${category}": matchDetail() ofrece guardar +/- (como en Infantil)`);

    document.getElementById("m-manual-stats")?.remove();
  });

  // ── Senior, y SOLO Senior, obtiene el formulario completo sin +/-. ──
  setupMatchFor("Senior");
  win.openManualStatsModal(0);
  const seniorModalHtml = document.getElementById("m-manual-stats")?.outerHTML || "";
  assert(!seniorModalHtml.includes("formulario reducido"), `Categoría "Senior": el modal NO muestra la nota de formulario reducido`);
  assert(/data-k="ro"/.test(seniorModalHtml) && /data-k="rd"/.test(seniorModalHtml) && /data-k="ast"/.test(seniorModalHtml) && /data-k="stl"/.test(seniorModalHtml) && /data-k="blk"/.test(seniorModalHtml) && /data-k="to"/.test(seniorModalHtml) && /data-k="foul"/.test(seniorModalHtml), `Categoría "Senior": el modal SÍ incluye las columnas del box score completo`);
  assert(!seniorModalHtml.includes('class="fi ms-ftpct"') && !/TL%/.test(seniorModalHtml.replace(/<!--.*?-->/g, "")), `Categoría "Senior": el modal NO muestra la columna de %TL en vivo (solo tiene sentido en el formulario reducido)`);

  // Igual que arriba: se guarda una línea real para que la tabla-resumen SÍ
  // se renderice, y así la ausencia del botón +/- sea una comprobación real
  // (no un falso positivo por falta de datos).
  setInput("p1", "min", 12);
  setInput("p1", "p2m", 2);
  win.saveManualStatsQuarter(0);

  win.S.screen = "matchDetail";
  win.render();
  const seniorDetailHtml = document.getElementById("root")?.innerHTML || "";
  assert(seniorDetailHtml.includes('id="ms-summary-table"'), `Categoría "Senior": la tabla-resumen SÍ se renderiza (hay datos guardados) -- así la comprobación siguiente es real, no un falso positivo por ausencia de datos`);
  assert(!seniorDetailHtml.includes("savePlusMinus()"), `Categoría "Senior": matchDetail() NO ofrece guardar +/- (solo aplica a categorías reducidas)`);

  document.getElementById("m-manual-stats")?.remove();

  return report.summary();
}

module.exports = { run };
