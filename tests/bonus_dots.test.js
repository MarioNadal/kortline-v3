"use strict";
// v3.0.0-dev.42 · B-BONUS2 (reportado por el usuario): el marcador en vivo
// pintaba 5 bolos (círculos) de faltas de equipo por lado, pero un
// marcador de pabellón real solo tiene 4 luces de falta por equipo y
// periodo -- el equipo entra en "situación de bonus" nada más cometer la
// 4ª falta (a partir de ahí CUALQUIER falta siguiente tira 2 TL; esto ya
// lo hacía bien openFoulTLModal/bonus_badge.test.js). Con 5 bolos en
// pantalla, el 5º se rellenaba justo cuando ya se estaba en bonus, dando
// la falsa impresión de que el bonus "empieza" en la falta número 5 en
// vez de estar ya activo desde la 4ª. Ahora se pintan siempre 4 bolos
// (como un marcador real): el 4º se pone ámbar (próximo bonus) y, a
// partir de la 5ª falta, los 4 quedan en rojo (bonus activo) -- sin
// añadir un 5º bolo que no existe físicamente en un marcador de pabellón.
const { loadApp, buildFixture, newReporter } = require("./harness");

// Extrae el bloque de bolos de faltas de equipo (el div "gap:0" que envuelve
// _foulDots + el aviso de calavera) y cuenta cuántos círculos (spans de
// 11x11 con border-radius:50%) contiene.
function countFoulDots(html, occurrence) {
  const re = /gap:0">([\s\S]*?)<\/div>/g;
  let match, i = 0, target = null;
  while ((match = re.exec(html)) !== null) {
    if (i === occurrence) { target = match[1]; break; }
    i++;
  }
  if (target === null) return null;
  const dotRe = /width:11px;height:11px;border-radius:50%/g;
  return (target.match(dotRe) || []).length;
}

async function run() {
  const report = newReporter("bonus_dots");
  const assert = (cond, msg) => report.assert(cond, msg);

  const win = await loadApp();
  buildFixture(win, { location: "home" }); // en casa: el bloque "gap:0" #0 es el NUESTRO
  win.S.screen = "liveGame";
  win.liveGame(); // inicializa m.live
  const m = win.mById(win.S.teamId, win.S.matchId);

  const casos = [0, 2, 4, 5, 7, 10];
  for (const n of casos) {
    m.live.teamFouls[0] = n;
    const html = win.liveGame();
    const dots = countFoulDots(html, 0); // bloque 0 = nuestro equipo (jugando en casa)
    assert(dots === 4, `con ${n} falta(s) de equipo, se pintan exactamente 4 bolos (salieron ${dots})`);
  }

  // ── El 4º bolo (aviso "próxima falta = bonus") se pinta en ámbar ──
  // (cada bolo relleno pinta su color 2 veces -- background y border --
  // así que se cuenta "background:COLOR" para contar bolos, no ocurrencias
  // sueltas del color.)
  m.live.teamFouls[0] = 4;
  const html4 = win.liveGame();
  const block4 = html4.match(/gap:0">([\s\S]*?)<\/div>/)[1];
  const filledAmber4 = (block4.match(/background:#f59e0b/g) || []).length;
  assert(filledAmber4 === 4, `con 4 faltas de equipo, los 4 bolos se pintan en ámbar (aviso de bonus inminente) -- salieron ${filledAmber4}`);

  // ── Con 5+ faltas (bonus activo), los 4 bolos quedan en rojo ──
  m.live.teamFouls[0] = 5;
  const html5 = win.liveGame();
  const block5 = html5.match(/gap:0">([\s\S]*?)<\/div>/)[1];
  const filledRed5 = (block5.match(/background:#ef4444/g) || []).length;
  assert(filledRed5 === 4, `con 5 faltas de equipo (bonus activo), los 4 bolos se pintan en rojo -- salieron ${filledRed5}`);

  return report.summary();
}

module.exports = { run };
