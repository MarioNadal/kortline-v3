"use strict";
// v3.0.0-dev.100 · B-SEASON2: "Archivar temporada", pedido por Mario en la
// auditoría exhaustiva ("haz para archivar temporadas"). Respuesta elegida
// vía AskUserQuestion: "Congelar y empezar limpio". Este test comprueba el
// contrato de archiveSeason()/deleteArchivedSeason(): ningún dato real se
// toca, solo se guarda una "foto" de fechas y se empuja seasonStart.
const { loadApp, newReporter } = require("./harness");

async function run() {
  const report = newReporter("archive_season");
  const win = await loadApp();
  const assert = (cond, msg) => report.assert(cond, msg);

  const today = win.td();
  const d = (n) => win._addDaysISO(today, n);

  win.S.teams = [{ id: "t1", name: "Cadete Masculino", color: "#F06318", schedule: {} }];
  win.S.players = { t1: [{ id: "p1", name: "Jugador Uno", number: 4, addedAt: d(-200) }] };
  win.S.matches = {};
  win.S.events = {};
  win.S.teamId = "t1";
  win.S.date = today;

  // Histórico real de "temporada 1": entrenamientos repartidos, algunos
  // antes de lo que será la fecha de archivado y alguno justo en el límite.
  win.S.sessions = {
    [`t1_${d(-150)}`]: { p1: "present" },
    [`t1_${d(-100)}`]: { p1: "absent" },
    [`t1_${d(-1)}`]: { p1: "present" } // el último día de la temporada que se archiva
  };
  win.S.cfg.seasonStart = null; // temporada 1 sin recorte de pretemporada todavía

  assert(Array.isArray(win.S.cfg.seasons) && win.S.cfg.seasons.length === 0,
    "DEFAULT_CFG: seasons empieza vacío -- nadie ha archivado nada todavía");

  // ── Archivar la temporada 1, con fin = ayer ──
  const endDate = d(-1);
  const r1 = win.archiveSeason("Temporada 2025-2026", endDate);
  assert(r1.ok === true, "archiveSeason(): devuelve ok:true con una fecha de fin válida");
  assert(win.S.cfg.seasons.length === 1, "archiveSeason(): añade un registro a S.cfg.seasons");
  const rec1 = win.S.cfg.seasons[0];
  assert(rec1.label === "Temporada 2025-2026", "archiveSeason(): guarda el label tal cual lo escribió el entrenador");
  assert(rec1.startDate === null, "archiveSeason(): startDate del registro = el seasonStart ANTERIOR (null, sin recorte)");
  assert(rec1.endDate === endDate, "archiveSeason(): endDate del registro = la fecha de fin elegida");
  assert(win.S.cfg.seasonStart === today,
    "B-SEASON2: seasonStart de la temporada NUEVA = el día siguiente al fin elegido (empezar limpio)");

  // ── Ningún dato real se ha tocado -- la condición MÁS importante de todas ──
  assert(win.S.sessions[`t1_${d(-150)}`] && win.S.sessions[`t1_${d(-150)}`].p1 === "present",
    "archiveSeason(): el entrenamiento de hace 150 días NO se borra ni se mueve");
  assert(win.S.sessions[`t1_${d(-100)}`] && win.S.sessions[`t1_${d(-100)}`].p1 === "absent",
    "archiveSeason(): el entrenamiento de hace 100 días NO se borra ni se mueve");
  assert(win.S.sessions[`t1_${endDate}`] && win.S.sessions[`t1_${endDate}`].p1 === "present",
    "archiveSeason(): incluso el último día de la temporada archivada sigue intacto en S.sessions");

  // ── Historial sigue viendo TODO (B-SEASON1 ya garantizaba esto, se
  // reconfirma que archivar no lo rompe) -- pero las medias de la temporada
  // NUEVA ya no incluyen esos días viejos. ──
  assert(win._isDateInSeason(d(-150)) === false,
    "tras archivar: un día de la temporada YA ARCHIVADA queda fuera de _isDateInSeason (no cuenta en la temporada nueva)");
  assert(win._isDateInSeason(today) === true,
    "tras archivar: hoy (temporada nueva) SÍ cuenta en _isDateInSeason");

  // ── Segunda temporada archivada encima -- startDate debe encadenar con el
  // seasonStart que dejó la primera (no con null ni con una fecha arbitraria). ──
  const end2 = win._addDaysISO(today, 30);
  const r2 = win.archiveSeason("Temporada 2026-2027", end2);
  assert(r2.ok === true, "archiveSeason(): una segunda temporada encima también funciona");
  assert(win.S.cfg.seasons.length === 2, "archiveSeason(): ahora hay 2 registros archivados");
  assert(win.S.cfg.seasons[1].startDate === today,
    "archiveSeason(): la 2ª temporada archivada empieza justo donde la 1ª dejó seasonStart (encadenado, sin huecos ni solapes)");

  // ── Validación: no se puede archivar con una fecha de fin anterior al
  // inicio de la temporada actual (evita un seasonStart hacia atrás). ──
  const rBad = win.archiveSeason("Temporada inválida", d(-500));
  assert(rBad.ok === false && typeof rBad.error === "string",
    "archiveSeason(): rechaza una fecha de fin anterior al seasonStart actual, con mensaje de error");
  assert(win.S.cfg.seasons.length === 2,
    "archiveSeason(): un intento inválido no añade ningún registro nuevo");

  // ── deleteArchivedSeason(): quita solo la ETIQUETA, nunca los datos reales ──
  const idToDelete = win.S.cfg.seasons[0].id;
  win.deleteArchivedSeason(idToDelete);
  assert(win.S.cfg.seasons.length === 1, "deleteArchivedSeason(): quita el registro archivado");
  assert(!win.S.cfg.seasons.some(s => s.id === idToDelete), "deleteArchivedSeason(): el registro concreto ya no está");
  assert(win.S.sessions[`t1_${d(-150)}`] && win.S.sessions[`t1_${d(-150)}`].p1 === "present",
    "deleteArchivedSeason(): borrar el registro archivado NUNCA toca los entrenamientos reales de esas fechas");
  assert(win.S.cfg.seasonStart === win._addDaysISO(end2, 1),
    "deleteArchivedSeason(): no toca seasonStart -- sigue siendo el que dejó el último archivado");

  return report.summary();
}

module.exports = { run };
