"use strict";
// v1.8.36 · B-SCORE1 / B-PHOTO1: dos quejas reales de uso -- (1) la
// valoracion 1-10 (equipo y jugador) se pedia con una fila de 10 estrellas
// diminutas, dificil de leer de un vistazo y aun mas dificil de acertar con
// el dedo en el numero exacto -- se sustituye por un stepper +/- con numero
// grande y color; (2) la foto del entrenamiento no tenia ninguna forma de
// volver a verse una vez subida (ni una miniatura en el Historial, ni una
// vista ampliada), y ademas desaparecia del todo si se desactivaba el flag
// "photos" despues de subirla -- se añade un lightbox de vista previa
// reutilizable y se arregla que las fotos ya guardadas sigan siendo visibles
// aunque se apague el flag.
const { loadApp, buildFixture, newReporter } = require("./harness");

async function run() {
  const report = newReporter("score_and_photo");
  const assert = (cond, msg) => report.assert(cond, msg);

  const win = await loadApp();
  buildFixture(win);
  win.S.cfg.features.teamScore = true;
  win.S.cfg.features.playerScore = true;
  win.S.cfg.features.photos = true;
  win.S.date = "2026-08-03";

  // ── Valoracion de jugador: stepper en vez de 10 estrellas ──
  const k = win.sk("t1", "2026-08-03");
  win.S.sessions[k] = { p1: "present" };
  let html = win.att();
  assert(html.includes("stepPlayerScore('p1',1)"), "att() usa stepPlayerScore(+1) para el jugador presente, no una fila de estrellas");
  assert(!html.includes("setPlayerScore"), "ya no queda ningún onclick a setPlayerScore (función eliminada)");
  assert(typeof win.setPlayerScore === "undefined", "setPlayerScore ya no existe como función global");
  assert(typeof win.stepPlayerScore === "function", "stepPlayerScore existe como función global");

  win.stepPlayerScore("p1", 1);
  win.stepPlayerScore("p1", 1);
  win.stepPlayerScore("p1", 1);
  assert(win.S.sessions[k].p1_score === 3, "3 pulsaciones de '+' suben la valoración del jugador a 3");
  win.stepPlayerScore("p1", -1);
  assert(win.S.sessions[k].p1_score === 2, "'-' baja la valoración en 1 (2)");
  // bajar hasta 0 y comprobar que no baja de 0
  win.stepPlayerScore("p1", -1); win.stepPlayerScore("p1", -1); win.stepPlayerScore("p1", -1);
  assert(win.S.sessions[k].p1_score === 0, "bajar por debajo de 1 deja la valoración en 0 (sin valorar), no negativa");
  // subir hasta 10 y comprobar que no sube de 10
  for (let i = 0; i < 15; i++) win.stepPlayerScore("p1", 1);
  assert(win.S.sessions[k].p1_score === 10, "subir por encima de 10 se limita a 10 (tope FIBA de la escala)");

  // ── Valoracion de equipo (modo manual): stepper en vez de 10 estrellas ──
  win.S.sessions[k] = { p1: "present", _teamScoreManual: true };
  html = win.att();
  assert(html.includes("stepTeamScore(-1)") && html.includes("stepTeamScore(1)"), "att() usa stepTeamScore(+/-1) para la valoración de equipo manual, no una fila de estrellas");
  assert(!html.includes("setTeamScore"), "ya no queda ningún onclick a setTeamScore (función eliminada)");
  assert(typeof win.setTeamScore === "undefined", "setTeamScore ya no existe como función global");
  win.stepTeamScore(7);
  assert(win.S.sessions[k]._teamScore === 7, "stepTeamScore sube la valoración de equipo correctamente (7)");

  // ── Ningún onclick de estrella individual (1..10) debería quedar ──
  assert(!/onclick="setPlayerScore|onclick="setTeamScore/.test(html), "no queda ningún manejador de clic por-estrella individual en el HTML");

  // ── Foto: vista previa accesible aunque se desactive el flag "photos" ──
  const winP = await loadApp();
  buildFixture(winP);
  winP.S.cfg.features.photos = true;
  winP.S.date = "2026-08-03";
  const kp = winP.sk("t1", "2026-08-03");
  const fakeDataUri = "data:image/jpeg;base64,/9j/AAAB"; // base64 corto de prueba
  winP.S.sessions[kp] = { p1: "present", _photo: fakeDataUri };

  let htmlPhotoOn = winP.att();
  assert(htmlPhotoOn.includes(fakeDataUri), "con el flag activado, la foto ya guardada se muestra en att()");
  assert(htmlPhotoOn.includes("openPhotoPreview('t1','2026-08-03')"), "att() ofrece abrir la vista previa a tamaño completo");

  // Desactivar el flag DESPUÉS de tener la foto guardada
  winP.S.cfg.features.photos = false;
  const htmlPhotoOff = winP.att();
  assert(htmlPhotoOff.includes(fakeDataUri), "B-PHOTO1: la foto sigue viéndose en att() aunque se desactive el flag 'photos' -- ANTES desaparecía por completo");
  assert(!htmlPhotoOff.includes('id="att-photo-input"'), "con el flag desactivado ya no se ofrece subir/cambiar foto, solo verla");
  assert(!htmlPhotoOff.includes("Quitar foto"), "con el flag desactivado tampoco se ofrece borrar la foto desde aquí");
  assert(htmlPhotoOff.includes("openPhotoPreview('t1','2026-08-03')"), "con el flag desactivado, tocar la foto abre la vista previa (no un selector de archivo)");

  // ── openPhotoPreview() abre el lightbox con la imagen correcta ──
  winP.S.cfg.features.photos = true;
  winP.att(); // aseguramos estado consistente
  winP.openPhotoPreview("t1", "2026-08-03");
  const modal = winP.document.getElementById("m-photo-preview");
  assert(!!modal, "openPhotoPreview() crea el modal de vista previa");
  assert(modal.innerHTML.includes(fakeDataUri), "el modal de vista previa muestra la foto correcta a tamaño completo");

  winP.openPhotoPreview("t1", "2099-01-01"); // fecha sin sesión/foto
  assert(!!winP.document.querySelector(".toast"), "openPhotoPreview() avisa con un toast si no hay foto para esa fecha, en vez de fallar en silencio");

  // ── Miniatura real (no solo un emoji) en el Historial ──
  winP.S.sessions[winP.sk("t1", "2026-08-01")] = { p1: "present", _photo: fakeDataUri };
  winP.S.screen = "hist";
  const histHtml = winP.hist();
  assert(histHtml.includes(`<img src="${fakeDataUri}"`), "hist() muestra una miniatura real de la foto (no solo un icono 📷 sin vista previa)");
  assert(histHtml.includes("openPhotoPreview('t1','2026-08-01')"), "la miniatura del Historial abre la vista previa a tamaño completo al tocarla");

  return report.summary();
}

module.exports = { run };
if (require.main === module) {
  run().then(({ failed }) => process.exit(failed > 0 ? 1 : 0));
}
