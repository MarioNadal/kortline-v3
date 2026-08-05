"use strict";
// v1.8.35 · B-VER1 / B-NOBKP1: (1) se quito la seccion "Copia de seguridad"
// (export/import JSON manual, autobackup, aviso "sin backup reciente") de
// Ajustes -- con Firestore como fuente de verdad compartida, restaurar un
// JSON local podia pisar datos mas nuevos de otro entrenador y ya no
// aportaba nada que Firestore no diera mejor. (2) la "Version" mostrada en
// Acerca de estaba clavada en "1.0.0" desde el esqueleto inicial pese a
// decenas de cambios reales -- ahora sale de una unica constante
// (APP_VERSION) que hay que bumpear junto con CACHE_VERSION en cada release.
const { loadApp, buildFixture, newReporter } = require("./harness");
const fs = require("fs");
const path = require("path");

async function run() {
  const report = newReporter("version_and_backup_removal");
  const assert = (cond, msg) => report.assert(cond, msg);

  const win = await loadApp();
  buildFixture(win);

  // ── La sección de Ajustes ya no ofrece copia de seguridad manual ──
  win.openClubSettings();
  const settingsHtml = win.document.getElementById("m-club-settings").innerHTML;
  assert(!settingsHtml.includes("Copia de seguridad"), "el modal de Ajustes ya no muestra la sección 'Copia de seguridad'");
  assert(!settingsHtml.includes("exportBackup"), "el modal de Ajustes ya no tiene ningún botón que llame a exportBackup()");
  assert(!settingsHtml.includes("importBackup"), "el modal de Ajustes ya no tiene ningún botón que llame a importBackup()");
  assert(!settingsHtml.includes('id="import-input"'), "el input de archivo para importar backup ya no existe");
  assert(typeof win.exportBackup === "undefined", "exportBackup ya no existe como función global");
  assert(typeof win.importBackup === "undefined", "importBackup ya no existe como función global");
  assert(typeof win.checkBackupReminder === "undefined", "checkBackupReminder ya no existe como función global");
  assert(typeof win.autoBackup === "undefined", "autoBackup ya no existe como función global");
  assert(typeof win.restoreAutoBackup === "undefined", "restoreAutoBackup ya no existe como función global");

  // ── El resto de Ajustes (perfil, umbral FEB, Acerca de) sigue intacto ──
  assert(settingsHtml.includes("Tu perfil en este dispositivo"), "el resto del modal de Ajustes (perfil del entrenador) sigue presente");
  assert(settingsHtml.includes("Umbral de riesgo FEB"), "el resto del modal de Ajustes (umbral FEB) sigue presente");
  assert(settingsHtml.includes("Acerca de"), "la sección 'Acerca de' sigue presente");

  // ── La versión visible viene de APP_VERSION, ya no está clavada en 1.0.0 ──
  const indexHtml = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf-8");
  const appVerMatch = indexHtml.match(/const APP_VERSION\s*=\s*"([^"]+)"/);
  assert(!!appVerMatch, "existe una constante APP_VERSION en index.html");
  assert(settingsHtml.includes(`Versión ${appVerMatch[1]}`), "el texto 'Versión' en Acerca de usa APP_VERSION (" + appVerMatch[1] + "), no un valor clavado");
  assert(!settingsHtml.includes("Versión 1.0.0"), "ya no aparece la versión clavada '1.0.0'");

  // ── APP_VERSION (index.html) y CACHE_VERSION (sw.js) están sincronizados ──
  const swJs = fs.readFileSync(path.join(__dirname, "..", "sw.js"), "utf-8");
  const cacheVerMatch = swJs.match(/const CACHE_VERSION\s*=\s*"kortline-v3\.0\.0-dev\.(\d+)"/);
  const appVerDevMatch = appVerMatch[1].match(/dev\.(\d+)$/);
  assert(!!cacheVerMatch && !!appVerDevMatch, "ambos ficheros usan el mismo patrón de numeración 'dev.N'");
  assert(cacheVerMatch[1] === appVerDevMatch[1], `el número de build coincide entre APP_VERSION (dev.${appVerDevMatch && appVerDevMatch[1]}) y CACHE_VERSION (dev.${cacheVerMatch && cacheVerMatch[1]})`);

  // ── El aviso de almacenamiento lleno ya no menciona un "backup" que no existe ──
  assert(!indexHtml.includes("Exporta backup y limpia"), "el aviso de almacenamiento lleno ya no invita a exportar un backup inexistente");
  assert(!indexHtml.includes("o exporta backup"), "el otro aviso de sin espacio tampoco menciona exportar backup");

  return report.summary();
}

module.exports = { run };
if (require.main === module) {
  run().then(({ failed }) => process.exit(failed > 0 ? 1 : 0));
}
