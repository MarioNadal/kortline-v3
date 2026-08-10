"use strict";
const { loadApp, buildFixture, newReporter } = require("./harness");

// Auditoría sistémica, no de un bug puntual: tras encontrar B-REASSIGN1
// (openReassignLogModal ofrecía toda la plantilla en vez de los convocados),
// el usuario pidió repasar TODO ese tipo de bug -- cualquier selector de
// jugador de la pantalla de partido en vivo que pueda estar usando la
// plantilla completa (pl(S.teamId)) en vez de estar acotado a quienes
// realmente pueden actuar en ESE partido (convocados, y dentro de esos, en
// pista quien corresponda).
//
// Este archivo no prueba un fix concreto: fija como INVARIANTE, para cada
// selector de jugador de nuestro equipo en la pantalla de partido en vivo,
// que nunca puede ofrecer a un jugador de la plantilla que no esté
// convocado a ese partido. Si en el futuro se añade un selector nuevo (o se
// reescribe uno existente) y se le olvida acotar a convocados/en pista,
// este test lo detecta sin tener que esperar a que un usuario lo reporte.
//
// Fixture: plantilla de 8 jugadoras, pero solo 6 convocadas a este partido
// (p1..p6 -- "Ana/Bea/Cata/Dana/Eva/Fina"). p7 "Gala" y p8 "Hana" están en
// la plantilla del equipo pero NO fueron convocadas a este partido: no
// deben aparecer NUNCA en ningún selector de la pantalla en vivo. De las 6
// convocadas, las 5 primeras (Ana..Eva) quedan en pista por defecto y Fina
// (p6) queda en el banquillo -- así se puede comprobar también que los
// selectores "solo en pista" (acción, asistencia, rebote) excluyen
// correctamente al banquillo, y que los selectores "banquillo/convocados"
// sí incluyen a Fina pero nunca a Gala/Hana.
async function run() {
  const report = newReporter("live_pickers_convocados_scope");
  const win = await loadApp();

  const match = buildFixture(win, {});
  // Renombramos a p6 (queda en el banquillo por defecto) porque su nombre de
  // fixture "Fina" colisiona como subcadena con textos reales de la UI
  // (p.ej. el botón "Finalizar partido"), lo que daría falsos positivos al
  // buscarlo con includes(). "Wilma" no colisiona con ningún texto de la app.
  win.S.players.t1.find((p) => p.id === "p6").name = "Wilma Oria";
  win.S.players.t1.push(
    { id: "p7", name: "Gala Nuñez", number: 10 },
    { id: "p8", name: "Hana Bosch", number: 11 }
  );
  win.S.screen = "liveGame";
  win.liveGame();
  // jsdom no ejecuta el guard de Firebase Auth que en la app real retira el
  // overlay de PIN (#m-pin-gate) tras iniciar sesión -- se queda presente
  // igual que en la demo de Playwright de este mismo proyecto. Como coincide
  // con el selector [id^="m-"], bloquearía por error a _chainAssist y
  // _chainRebound (su guard "¿hay otro modal abierto?" no distingue el pin
  // gate de un modal real). Se retira aquí, no forma parte del bug a probar.
  win.document.getElementById("m-pin-gate")?.remove();
  const NOT_CONVOCADAS = ["Gala", "Hana"];
  const BENCH_NAME = "Wilma";

  const removeAll = () => {
    ["m-actpicker", "m-chainast", "m-chainreb", "m-endmatch", "m-sub", "m-tm-overlay", "m-reassign-log", "m-ourtl"]
      .forEach((id) => win.document.getElementById(id)?.remove());
  };

  const checkNoLeak = (label, html) => {
    NOT_CONVOCADAS.forEach((name) => {
      report.assert(!html.includes(name), `${label}: no incluye a ${name} (no convocada a este partido)`);
    });
  };

  // ── 1) Selector de acción "¿Quién?" (openActionPicker) -- solo en pista.
  removeAll();
  win.openActionPicker("p2m", 2);
  let html = win.document.getElementById("m-actpicker")?.innerHTML || "";
  checkNoLeak("openActionPicker", html);
  report.assert(html.includes("Ana"), "openActionPicker: sí incluye a un jugador en pista (Ana)");
  report.assert(!html.includes(BENCH_NAME), "openActionPicker: NO incluye a " + BENCH_NAME + " (convocada pero en el banquillo)");

  // ── 2) Cadena de asistencia tras canasta (_chainAssist) -- solo en pista.
  removeAll();
  win._chainAssist("p1", "p2m");
  html = win.document.getElementById("m-chainast")?.innerHTML || "";
  checkNoLeak("_chainAssist", html);
  report.assert(!html.includes(BENCH_NAME), "_chainAssist: NO incluye a " + BENCH_NAME + " (banquillo)");
  report.assert(html.includes("Bea"), "_chainAssist: sí incluye a otra jugadora en pista (Bea)");

  // ── 3) Cadena de rebote tras fallo (_chainRebound) -- solo en pista.
  removeAll();
  win._chainRebound("p1", "p2a");
  html = win.document.getElementById("m-chainreb")?.innerHTML || "";
  checkNoLeak("_chainRebound", html);
  report.assert(!html.includes(BENCH_NAME), "_chainRebound: NO incluye a " + BENCH_NAME + " (banquillo)");

  // ── 4) Sustitución: sale un titular, elegir quién entra (openCourtSubModal)
  // -- banquillo de CONVOCADOS (debe incluir a Fina, nunca a Gala/Hana).
  removeAll();
  win.openCourtSubModal("p1");
  html = win.document.getElementById("m-sub")?.innerHTML || "";
  checkNoLeak("openCourtSubModal", html);
  report.assert(html.includes(BENCH_NAME), "openCourtSubModal: SÍ incluye a " + BENCH_NAME + " (convocada, en el banquillo)");

  // ── 5) Sustitución: entra alguien del banquillo, elegir quién sale
  // (openSubModal) -- en pista, pero acotado a convocados.
  removeAll();
  win.openSubModal("p6");
  html = win.document.getElementById("m-sub")?.innerHTML || "";
  checkNoLeak("openSubModal", html);
  report.assert(html.includes("Ana"), "openSubModal: sí incluye a quien está en pista (Ana)");

  // ── 6) Panel de tiempo muerto (_buildTmOverlay) -- quinteto + banquillo,
  // ambos acotados a convocados.
  removeAll();
  win._buildTmOverlay("our", "Nuestro equipo");
  html = win.document.getElementById("m-tm-overlay")?.innerHTML || "";
  checkNoLeak("_buildTmOverlay", html);
  report.assert(html.includes(BENCH_NAME), "_buildTmOverlay: SÍ incluye a " + BENCH_NAME + " en el banquillo del panel de tiempo muerto");

  // ── 7) Tiros libres a nuestro favor (openOurFoulTLModal) -- en pista +
  // banquillo, ambos acotados a convocados.
  removeAll();
  win.openOurFoulTLModal(null, "foul");
  html = win.document.getElementById("m-ourtl")?.innerHTML || "";
  checkNoLeak("openOurFoulTLModal", html);
  report.assert(html.includes(BENCH_NAME), "openOurFoulTLModal: SÍ incluye a " + BENCH_NAME + " (convocada) en la sección de banquillo");

  // ── 8) Resumen de fin de partido, acciones de último segundo
  // (_showEndMatchOverlay) -- solo en pista.
  removeAll();
  win._showEndMatchOverlay(match, 40, 38, "4º cuarto");
  html = win.document.getElementById("m-endmatch")?.innerHTML || "";
  checkNoLeak("_showEndMatchOverlay", html);
  report.assert(!html.includes(BENCH_NAME), "_showEndMatchOverlay: NO incluye a " + BENCH_NAME + " (banquillo) en las acciones rápidas");

  // ── 9) Reasignar una acción del historial (openReassignLogModal) --
  // B-REASSIGN1, ya arreglado, se vuelve a comprobar aquí como parte del
  // barrido sistémico completo.
  removeAll();
  match.live.log = [{ pid: "p1", action: "p2m", pts: 2, q: 1, clockAt: 500, desc: "Ana García anota" }];
  win.openReassignLogModal(0);
  html = win.document.getElementById("m-reassign-log")?.innerHTML || "";
  checkNoLeak("openReassignLogModal", html);
  report.assert(html.includes(BENCH_NAME), "openReassignLogModal: SÍ incluye a " + BENCH_NAME + " (convocada) como destino posible");

  removeAll();
  return report.summary();
}

module.exports = { run };
