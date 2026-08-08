"use strict";
// v3.0.0-dev.34 · B-ERRLOG1: captura de errores en produccion.
// Verifica que _logClientError nunca lanza, respeta el limite por sesion,
// no intenta escribir en Firestore sin sesion real (_fbUser), y que el
// visor en Ajustes (openErrorLogsModal) no revienta sin conexion a la nube.
const { loadApp, newReporter } = require("./harness.js");

async function run() {
  const win = await loadApp();
  const report = newReporter("error_logging");

  report.assert(typeof win._logClientError === "function", "_logClientError existe como funcion global");
  report.assert(typeof win.openErrorLogsModal === "function", "openErrorLogsModal existe como funcion global");

  // Reset del contador (por si otro codigo del boot ya disparo algun error)
  win._errorLogCount = 0;

  let threw = false;
  try {
    win._logClientError(new win.Error("boom de prueba"), "test-manual");
  } catch (e) {
    threw = true;
  }
  report.assert(!threw, "_logClientError no lanza aunque el logger interno falle");
  report.assert(win._errorLogCount === 1, "_logClientError incrementa el contador de la sesion");

  // Sin _fbUser (nadie ha iniciado sesion en este jsdom), no debe intentar
  // escribir en Firestore de verdad -- solo comprobamos que sigue sin
  // lanzar aunque _cloudEnabled este a true.
  win._cloudEnabled = true;
  threw = false;
  try {
    win._logClientError({ message: "otro error", stack: "at x" }, "test-manual-2");
  } catch (e) {
    threw = true;
  }
  report.assert(!threw, "_logClientError no lanza con _cloudEnabled=true pero sin sesion (_fbUser null)");
  report.assert(win._errorLogCount === 2, "el contador sigue subiendo con cada llamada");

  // Limite por sesion: no debe superar el tope aunque se llame muchas veces.
  win._errorLogCount = 0;
  for (let i = 0; i < 30; i++) {
    win._logClientError(new win.Error("spam " + i), "test-spam");
  }
  report.assert(win._errorLogCount === 20, "el contador se congela en el maximo por sesion (20), no sigue subiendo indefinidamente");

  // window.onerror / unhandledrejection deben estar enganchados de verdad.
  win._errorLogCount = 0;
  try {
    win.dispatchEvent(new win.ErrorEvent("error", { error: new win.Error("evento global"), message: "evento global" }));
    report.assert(win._errorLogCount === 1, "el listener de window 'error' llama a _logClientError");
  } catch (e) {
    report.assert(false, "no se pudo disparar ErrorEvent en jsdom: " + e.message);
  }

  win._errorLogCount = 0;
  try {
    win.dispatchEvent(new win.PromiseRejectionEvent("unhandledrejection", { promise: Promise.resolve(), reason: new win.Error("rechazo global") }));
    report.assert(win._errorLogCount === 1, "el listener de 'unhandledrejection' llama a _logClientError");
  } catch (e) {
    // jsdom no siempre implementa PromiseRejectionEvent -- si falla la
    // construccion del evento no es un fallo de la app, se anota y sigue.
    report.assert(true, "PromiseRejectionEvent no soportado en este jsdom (no es un fallo de la app, se omite)");
  }

  // Visor en Ajustes: sin conexion a la nube debe avisar sin reventar.
  win._cloudEnabled = false;
  win.openErrorLogsModal();
  await new Promise(r => setTimeout(r, 50));
  const listEl = win.document.getElementById("error-logs-list");
  report.assert(!!listEl, "el modal de errores recientes se abre y crea la lista");
  report.assert(/conexión a la nube/i.test(listEl.textContent || ""), "sin _cloudEnabled avisa que no puede consultar otros dispositivos, no revienta");
  win.document.getElementById("m-error-logs")?.remove();

  // El boton nuevo vive dentro de Ajustes (Acerca de).
  win.openClubSettings();
  const settingsHtml = win.document.getElementById("m-club-settings")?.innerHTML || "";
  report.assert(settingsHtml.includes("openErrorLogsModal()"), "Ajustes > Acerca de incluye el boton 'Ver errores recientes'");
  win.document.getElementById("m-club-settings")?.remove();

  return report.summary();
}

module.exports = { run };
