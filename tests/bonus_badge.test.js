"use strict";
// v1.8.30 · B-BONUS1: la insignia "BONUS" de la cabecera del partido en vivo
// usaba teamFouls>=4 (una falta antes de tiempo) mientras que el resto de la
// app (toast de _checkBonusEnter, badge de la pestaña de cuarto, y el
// bonusBanner de los 4 modales de falta) usa correctamente >=5 (regla FIBA:
// bonus a partir de la 5a falta de equipo). Este test fija el comportamiento
// correcto para las 3 zonas a la vez.
const { loadApp, buildFixture, newReporter } = require("./harness");

async function run() {
  const report = newReporter("bonus_badge");
  const win = await loadApp();
  const match = buildFixture(win);
  const assert = (cond, msg) => report.assert(cond, msg);

  win.S.screen = "liveGame";
  win.liveGame(); // inicializa m.live (onCourt, teamFouls, etc.)

  const m = win.mById(win.S.teamId, win.S.matchId);
  const badgeStyle = 'background:rgba(245,158,11,.25);color:#f59e0b;border:1px solid rgba(245,158,11,.4);border-radius:6px;font-size:10px;font-weight:800;padding:2px 6px';

  const hasHeaderBonusBadge = () => {
    win.render();
    const html = win.document.getElementById("root").innerHTML;
    return html.includes('style="' + badgeStyle + '">BONUS<');
  };

  m.live.teamFouls[0] = 0;
  assert(!hasHeaderBonusBadge(), "sin faltas de equipo, la cabecera NO muestra BONUS");

  m.live.teamFouls[0] = 4;
  assert(!hasHeaderBonusBadge(), "con 4 faltas de equipo (aun no es bonus), la cabecera NO muestra BONUS");

  m.live.teamFouls[0] = 5;
  assert(hasHeaderBonusBadge(), "con 5 faltas de equipo (bonus FIBA), la cabecera SI muestra BONUS");

  m.live.teamFouls[0] = 7;
  assert(hasHeaderBonusBadge(), "con mas de 5 faltas de equipo, la cabecera sigue mostrando BONUS");

  m.live.teamFouls[0] = 4;
  delete m.live.bonusToastFired;
  win._checkBonusEnter(m, 0);
  assert(!m.live.bonusToastFired || !m.live.bonusToastFired[0], "el toast de bonus NO se marca como disparado con 4 faltas");

  m.live.teamFouls[0] = 5;
  win._checkBonusEnter(m, 0);
  assert(m.live.bonusToastFired && m.live.bonusToastFired[0] === true, "el toast de bonus SI se marca como disparado con 5 faltas");

  return report.summary();
}

module.exports = { run };
