"use strict";
const { loadApp, buildFixture, newReporter } = require("./harness");

// B-TLWORD1: bug real reportado por el usuario -- el modal "Tiros libres
// nuestros" (cuando el RIVAL nos comete falta) se titulaba y preguntaba como
// si los tiros libres fueran a suceder seguro ("Tiros libres nuestros" /
// "¿quién tira?"), pero el propio modal ofrece la opción "Sin TL" (0 tiros
// libres) -- que es lo más habitual en una falta personal sin bonus. Fix:
// reencuadrar como "quién recibió la falta" primero; si hay tiros libres o
// no, se resuelve después con los botones "Sin TL / 1 TL / 2 TL / 3 TL". La
// variante "solo equipo" (sin selección de jugador) recibe el mismo cambio
// de título. La lógica de confirmOurTL() (registrar frecv, aviso "sin tiros
// libres" en TL=0, abrir el modal de tiro en TL>0) no cambia -- esto es
// solo un fix de redacción/framing, verificado abajo.
async function run() {
  const report = newReporter("foul_tl_wording");
  const win = await loadApp();

  const match = buildFixture(win, {});
  win.S.screen = "liveGame";
  win.liveGame();

  win.openOurFoulTLModal();
  const html = win.document.getElementById("m-ourtl").innerHTML;
  report.assert(html.includes("Falta a nuestro favor"), "openOurFoulTLModal: nuevo título 'Falta a nuestro favor'");
  report.assert(!html.includes("Tiros libres nuestros"), "openOurFoulTLModal: ya no dice 'Tiros libres nuestros' (presuponía que iba a haberlos)");
  report.assert(html.includes("quién la recibió"), "openOurFoulTLModal: la pregunta ahora es quién recibió la falta, no quién tira");
  report.assert(!html.includes("¿quién tira?"), "openOurFoulTLModal: ya no pregunta '¿quién tira?' antes de saber si hay TL");
  report.assert(html.includes("Selecciona quién recibió la falta"), "openOurFoulTLModal: botón deshabilitado usa la nueva redacción");
  report.assert(!html.includes("Selecciona un tirador"), "openOurFoulTLModal: ya no dice 'Selecciona un tirador'");
  report.assert(html.includes("Sin TL"), "openOurFoulTLModal: sigue ofreciendo la opción 'Sin TL' (0 tiros libres), coherente con el nuevo framing");
  win.document.getElementById("m-ourtl").remove();

  buildFixture(win, { teamOnlyStats: true });
  win.liveGame();
  win.openOurTeamOnlyFoulTLModal();
  const teamOnlyEl = win.document.getElementById("m-ourtl") || win.document.querySelector("[id^='m-ourtl']");
  const htmlTO = teamOnlyEl ? teamOnlyEl.innerHTML : "";
  report.assert(htmlTO.includes("Falta a nuestro favor"), "openOurTeamOnlyFoulTLModal: mismo nuevo título");
  report.assert(!htmlTO.includes("Tiros libres nuestros"), "openOurTeamOnlyFoulTLModal: ya no dice 'Tiros libres nuestros'");
  teamOnlyEl?.remove();

  // ── Comprobación funcional: el fix de redacción no debe haber tocado el
  // comportamiento real de confirmOurTL().
  const match2 = buildFixture(win, {});
  win.liveGame();
  const p1 = match2.convocados[0];

  // Caso TL=0: registra "Falta Recibida" (frecv) y avisa "sin tiros
  // libres", sin abrir el modal granular de tiro.
  win.openOurFoulTLModal();
  win.selectOurTLShooter(p1);
  win.setOurTLCount(0);
  win.confirmOurTL();
  let m = win.mById(win.S.teamId, match2.id);
  report.assert(m.live.stats[p1].frecv === 1, "confirmOurTL con 0 TL: sigue registrando 'Falta Recibida' (frecv) para el jugador");
  report.assert(!win.document.getElementById("m-ourtlshoot"), "confirmOurTL con 0 TL: no abre el modal granular de tiro");

  // Caso TL=2: sigue abriendo el modal de tiro a tiro para ese jugador.
  win.openOurFoulTLModal();
  win.selectOurTLShooter(p1);
  win.setOurTLCount(2);
  win.confirmOurTL();
  m = win.mById(win.S.teamId, match2.id);
  report.assert(m.live.stats[p1].frecv === 2, "confirmOurTL con 2 TL: también registra 'Falta Recibida'");
  report.assert(!!win.document.getElementById("m-ourtlshoot"), "confirmOurTL con 2 TL: SÍ abre el modal granular de tiro a tiro");

  return report.summary();
}

module.exports = { run };
