"use strict";
// v3.0.0-dev.40 · B-ROSTER1: la pantalla "Plantilla" (team()) mezclaba
// jugadores fijos y puntuales/invitados en una sola lista ordenada solo
// por dorsal -- un puntual con dorsal bajo (o sin dorsal) podia
// intercalarse en mitad de la plantilla fija, dificultando ver de un
// vistazo quien es del equipo de verdad, aunque llevara la etiqueta
// "🔄 PUNTUAL". El usuario pidió expresamente que los puntuales queden
// abajo/aparte "de la manera más profesional posible". Ahora se pintan en
// dos bloques: plantilla fija (por dorsal) arriba, y un segundo bloque de
// puntuales bajo un separador con contador, solo si existe alguno.
const { loadApp, newReporter } = require("./harness");

async function run() {
  const report = newReporter("roster_order");
  const assert = (cond, msg) => report.assert(cond, msg);

  const win = await loadApp();
  win.S.teamId = "t1";
  win.S.teams = [{ id: "t1", name: "CB Jaca", category: "Infantil", coaches: [], color: "#f06318", schedule: {} }];
  win.S.players = {
    t1: [
      { id: "p1", name: "Ana Fija", number: 4, addedAt: "2026-01-01" },
      { id: "p2", name: "Guest Bajo Dorsal", number: 1, guest: true, matchOnly: false, addedAt: "2026-08-01" },
      { id: "p3", name: "Bea Fija", number: 7, addedAt: "2026-01-01" },
      { id: "p4", name: "Guest Sin Dorsal", number: null, guest: true, attOnly: true, addedAt: "2026-08-08" },
      { id: "p5", name: "Cata Fija", number: 2, addedAt: "2026-01-01" },
    ],
  };
  win.S.matches = { t1: [] };
  win.S.events = { t1: [] };
  win.S.drills = { t1: [] };
  win.S.sessions = {};

  const html = win.team();

  // ── Orden: los 3 fijos primero, por dorsal (Cata #2, Ana #4, Bea #7) ──
  const iCata = html.indexOf("Cata Fija");
  const iAna = html.indexOf("Ana Fija");
  const iBea = html.indexOf("Bea Fija");
  const iSep = html.indexOf("Puntuales");
  const iGuestBajo = html.indexOf("Guest Bajo Dorsal");
  const iGuestSin = html.indexOf("Guest Sin Dorsal");

  assert(iCata !== -1 && iAna !== -1 && iBea !== -1, "los 3 jugadores fijos aparecen en la Plantilla");
  assert(iCata < iAna && iAna < iBea, "los fijos siguen ordenados por dorsal dentro de su bloque (2, 4, 7)");
  assert(iSep !== -1, "aparece un separador con la palabra 'Puntuales' antes del segundo bloque");
  assert(iBea < iSep, "el separador de puntuales va DESPUÉS de todos los jugadores fijos, no intercalado");
  assert(iSep < iGuestBajo && iSep < iGuestSin, "los puntuales aparecen después del separador");
  assert(html.includes("Puntuales / invitados (2)"), "el separador cuenta correctamente los 2 puntuales dados de alta");

  // ── El puntual con dorsal más bajo (#1) NO se cuela antes que los fijos ──
  assert(iGuestBajo > iBea, "un puntual con dorsal más bajo que todos los fijos (#1) sigue apareciendo en el bloque de abajo, no intercalado arriba por número");

  // ── Ambos siguen llevando su etiqueta visual habitual ──
  assert(html.includes("🔄 PUNTUAL"), "los puntuales siguen mostrando su etiqueta 🔄 PUNTUAL dentro de su fila");

  // ── Caso sin puntuales: no debe aparecer separador vacío ──
  const win2 = await loadApp();
  win2.S.teamId = "t1";
  win2.S.teams = [{ id: "t1", name: "CB Jaca", category: "Infantil", coaches: [], color: "#f06318", schedule: {} }];
  win2.S.players = { t1: [{ id: "p1", name: "Ana Fija", number: 4, addedAt: "2026-01-01" }] };
  win2.S.matches = { t1: [] }; win2.S.events = { t1: [] }; win2.S.drills = { t1: [] }; win2.S.sessions = {};
  const html2 = win2.team();
  assert(!html2.includes("Puntuales"), "sin puntuales en la plantilla, no se muestra el separador");
  assert(html2.includes("Ana Fija"), "el jugador fijo sigue apareciendo con normalidad");

  // ── Caso solo puntuales (sin fijos): no debe mostrar 'Sin jugadores aún' ──
  const win3 = await loadApp();
  win3.S.teamId = "t1";
  win3.S.teams = [{ id: "t1", name: "CB Jaca", category: "Infantil", coaches: [], color: "#f06318", schedule: {} }];
  win3.S.players = { t1: [{ id: "p1", name: "Solo Puntual", number: 3, guest: true, attOnly: true, addedAt: "2026-08-08" }] };
  win3.S.matches = { t1: [] }; win3.S.events = { t1: [] }; win3.S.drills = { t1: [] }; win3.S.sessions = {};
  const html3 = win3.team();
  assert(!html3.includes("Sin jugadores aún"), "si solo hay puntuales (sin ningún fijo), no se muestra el mensaje de plantilla vacía");
  assert(html3.includes("Solo Puntual") && html3.includes("Puntuales"), "el puntual único se muestra en su propio bloque con separador");

  return report.summary();
}

module.exports = { run };
