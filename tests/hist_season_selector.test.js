"use strict";
// v3.0.0-dev.118 · B-SEASON4: selector de temporada en Historial. Mario: "en
// historial debería haber un botón de temporadas archivadas con un selector,
// porque cuando se junten más temporadas ¿cómo se distinguen las archivadas
// de la actual?".
const { loadApp, newReporter } = require("./harness.js");

async function run() {
  const r = newReporter("hist_season_selector");
  const win = await loadApp();
  const d = n => win._addDaysISO(win.td(), n);
  win.S.teams = [{ id: "t1", name: "CADETE" }];
  win.S.players = { t1: [{ id: "p1", name: "Ana", number: 4, addedAt: d(-400) }, { id: "p2", name: "Bea", number: 5, addedAt: d(-400) }] };
  win.S.sessions = {
    [win.sk("t1", d(-300))]: { p1: "present", p2: "absent" },   // temporada 1
    [win.sk("t1", d(-250))]: { p1: "present", p2: "present" },  // temporada 1
    [win.sk("t1", d(-100))]: { p1: "absent", p2: "absent" },    // temporada 2
    [win.sk("t1", d(-5))]: { p1: "present", p2: "present" },    // actual
    [win.skO("t1", d(-260), "voluntario")]: { _optType: "voluntario", p1: "present" } // voluntario de la temporada 1
  };
  win.S.cfg.seasonStart = null; win.S.cfg.seasons = [];
  win.S.teamId = "t1";
  const root = () => win.document.getElementById("root");
  const go = () => { win.S.screen = "hist"; win.render(); return root().textContent; };

  let txt = go();
  r.assert(!root().querySelector('select[aria-label="Temporada"]') && /4 sesiones/.test(txt), "sin temporadas archivadas no hay selector y se ve todo, como siempre");

  win.archiveSeason("2024-2025", d(-200));
  win.archiveSeason("2025-2026", d(-50));
  txt = go();
  const sel = root().querySelector('select[aria-label="Temporada"]');
  r.assert(!!sel, "con temporadas archivadas aparece el selector de temporada");
  const opts = [...sel.options].map(o => o.textContent);
  r.assert(opts.length === 4 && /Temporada actual/.test(opts[0]) && /2025-2026/.test(opts[1]) && /2024-2025/.test(opts[2]) && /Todo el historial/.test(opts[3]),
    "opciones: actual, archivadas (la más reciente primero) y todo -- " + JSON.stringify(opts));
  r.assert(/1 sesiones · Temporada actual/.test(txt), "por defecto se ve solo la temporada actual (1 entrenamiento)");

  win._histSetSeason(win.S.cfg.seasons[0].id); txt = go();
  r.assert(/2 sesiones · 2024-2025/.test(txt) && /Temporada archivada/.test(txt), "al elegir 2024-2025 se ven sus 2 entrenamientos con el aviso de temporada archivada");
  r.assert(/75%/.test(txt), "el % medio es el de ESA temporada (3 de 4 = 75%), no 0% por estar fuera de la temporada actual");
  r.assert(/Voluntarios/.test(txt) && /2 asistieron de 2/.test(txt), "también se ven los voluntarios de esa temporada (pasada lista: Ana marcada, Bea presente por defecto)");

  win._histSetSeason(win.S.cfg.seasons[1].id); txt = go();
  r.assert(/1 sesiones · 2025-2026/.test(txt) && !/Voluntarios/.test(txt), "2025-2026: solo su entrenamiento y sin los voluntarios de otra temporada");

  win._histSetSeason("all"); txt = go();
  r.assert(/4 sesiones · Todo el historial/.test(txt), "'Todo el historial' muestra los 4 entrenamientos");

  // Al deshacer la temporada elegida, se vuelve a la actual sin romper nada
  win._histSetSeason(win.S.cfg.seasons[1].id);
  win.deleteArchivedSeason(win.S.cfg.seasons[1].id);
  let threw = false; try { txt = go(); } catch (e) { threw = true; }
  r.assert(!threw && /Temporada actual/.test(txt), "si se deshace la temporada que se estaba viendo, el Historial vuelve a la actual sin errores");

  return r.summary();
}
module.exports = { run };
if (require.main === module) run().then(({ failed }) => process.exit(failed ? 1 : 0));
