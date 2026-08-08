"use strict";
// v3.0.0-dev.40 · B-FULLNAME1: el usuario reportó que en el marcador en
// vivo (liveGame) los nombres de los equipos no se entendían bien. La
// causa: _ourName/_rivName se cortaban a 12 caracteres + "…" por JS pase
// lo que pase, aunque el nombre real cupiera perfectamente en pantalla, o
// aunque cortarlo a media palabra generase un nombre ambiguo. Ahora se
// pasa el nombre completo y es el propio contenedor (que ya llevaba
// overflow:hidden + text-overflow:ellipsis + white-space:nowrap) el que
// recorta visualmente SOLO si de verdad no cabe en el ancho disponible.
const { loadApp, buildFixture, newReporter } = require("./harness");

async function run() {
  const report = newReporter("live_scoreboard_fullname");
  const assert = (cond, msg) => report.assert(cond, msg);

  const win = await loadApp();
  const match = buildFixture(win, { location: "home" });
  // Nombres largos, de más de 12 caracteres, como los que reportó el usuario.
  win.S.teams[0].name = "Club Baloncesto Jaca Infantil";
  match.rival = "Sociedad Deportiva Huesca Basket";
  win.S.screen = "liveGame";

  const html = win.liveGame();

  assert(html.includes("Club Baloncesto Jaca Infantil"), "el nombre completo de nuestro equipo aparece entero en el marcador en vivo, sin cortar a 12 caracteres");
  assert(html.includes("Sociedad Deportiva Huesca Basket"), "el nombre completo del rival aparece entero en el marcador en vivo, sin cortar a 12 caracteres");
  assert(!/Club Basketball…/.test(html) && !html.includes("Club Balonces…"), "ya no aparece el nombre cortado con puntos suspensivos a los 11 caracteres");

  // El contenedor sigue teniendo overflow/ellipsis por CSS, por si algún
  // nombre extremo no cupiera en pantallas muy estrechas (higiene visual,
  // no recorte de datos).
  assert(html.includes("text-overflow:ellipsis"), "el contenedor conserva el recorte visual por CSS como red de seguridad para pantallas muy estrechas");

  // Con jugando fuera, el nombre completo también debe verse en ambos lados.
  const win2 = await loadApp();
  const match2 = buildFixture(win2, { location: "away" });
  win2.S.teams[0].name = "Club Baloncesto Jaca Infantil";
  match2.rival = "Sociedad Deportiva Huesca Basket";
  win2.S.screen = "liveGame";
  const html2 = win2.liveGame();
  assert(html2.includes("Club Baloncesto Jaca Infantil") && html2.includes("Sociedad Deportiva Huesca Basket"), "jugando fuera, ambos nombres completos también aparecen enteros en el marcador");

  return report.summary();
}

module.exports = { run };
