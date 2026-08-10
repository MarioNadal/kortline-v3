"use strict";
const { loadApp, buildFixture, newReporter } = require("./harness");

// B-DQ5: revisión de reglas FIBA desde perspectiva de entrenador. Bug real
// encontrado en _isDQ() -- el límite de "5 faltas" que descalifica a un
// jugador (Art. 40.1 FIBA) solo comprobaba st.foul>=5 (faltas PERSONALES a
// solas). Pero por reglamento FIBA una falta técnica se carga "como falta
// de jugador" (Art. 36.3.1: "a technical foul shall be charged as a player
// foul") -- cuenta igual que una personal para ese límite de 5, no aparte.
// Lo mismo con las antideportivas. Así que un jugador con, por ejemplo, 4
// faltas personales + 1 técnica (5 faltas en total) NO se marcaba como
// descalificado -- podía seguir en pista, tirar sus propios tiros libres,
// etc., cuando por reglamento ya debería haber sido sustituido
// obligatoriamente. El propio comentario del código en liveAction()
// ("v1.6.13 · B-47: descalificación considera personales + técnicas +
// antideportivas + descalificantes") ya documentaba esta intención, que
// _isDQ() no llegaba a cumplir en el caso mixto.
//
// Fuentes: FIBA Official Basketball Rules 2024, Art. 36.3.1 ("By a player,
// a technical foul shall be charged as a player foul and shall count as
// one of the team fouls") y Art. 40.1 ("A player who has committed 5 fouls
// ... must leave the game").
async function run() {
  const report = newReporter("dq_combined_fouls");
  const win = await loadApp();

  const match = buildFixture(win, {});
  win.S.screen = "liveGame";
  win.liveGame();
  const m = win.mById(win.S.teamId, win.S.matchId);
  const p1 = "p1";

  // ── Caso del bug: 4 personales + 1 técnica = 5 faltas en total.
  m.live.stats[p1] = { p2m: 0, p2a: 0, foul: 4, ftech: 1, funsport: 0, fdq: 0 };
  report.assert(win._isDQ(m.live.stats[p1]) === true, "_isDQ: 4 personales + 1 técnica (5 en total) SÍ descalifica");

  // ── Mismo caso pero con antideportiva en vez de técnica.
  m.live.stats[p1] = { foul: 4, ftech: 0, funsport: 1, fdq: 0 };
  report.assert(win._isDQ(m.live.stats[p1]) === true, "_isDQ: 4 personales + 1 antideportiva (5 en total) SÍ descalifica");

  // ── Un total mixto de solo 4 faltas NO debe descalificar todavía.
  m.live.stats[p1] = { foul: 3, ftech: 1, funsport: 0, fdq: 0 };
  report.assert(win._isDQ(m.live.stats[p1]) === false, "_isDQ: 3 personales + 1 técnica (4 en total) NO descalifica todavía");

  // ── Regresión: los umbrales que ya funcionaban siguen funcionando igual.
  m.live.stats[p1] = { foul: 5, ftech: 0, funsport: 0, fdq: 0 };
  report.assert(win._isDQ(m.live.stats[p1]) === true, "_isDQ: 5 personales puras (regresión) sigue descalificando");
  m.live.stats[p1] = { foul: 0, ftech: 2, funsport: 0, fdq: 0 };
  report.assert(win._isDQ(m.live.stats[p1]) === true, "_isDQ: 2 técnicas (regresión) sigue descalificando");
  m.live.stats[p1] = { foul: 0, ftech: 0, funsport: 2, fdq: 0 };
  report.assert(win._isDQ(m.live.stats[p1]) === true, "_isDQ: 2 antideportivas (regresión) sigue descalificando");
  m.live.stats[p1] = { foul: 0, ftech: 1, funsport: 1, fdq: 0 };
  report.assert(win._isDQ(m.live.stats[p1]) === true, "_isDQ: 1 técnica + 1 antideportiva (regresión) sigue descalificando");
  m.live.stats[p1] = { foul: 0, ftech: 0, funsport: 0, fdq: 1 };
  report.assert(win._isDQ(m.live.stats[p1]) === true, "_isDQ: 1 falta descalificante directa (regresión) sigue descalificando");
  m.live.stats[p1] = { foul: 3, ftech: 0, funsport: 0, fdq: 0 };
  report.assert(win._isDQ(m.live.stats[p1]) === false, "_isDQ: 3 personales solas (regresión) sigue sin descalificar");

  // ── Comprobación de extremo a extremo: registrar en vivo 4 faltas
  // personales + 1 técnica sobre un jugador en pista dispara la
  // descalificación real (toast + cola de sustitución forzosa), no solo
  // _isDQ() en aislado.
  const p2 = m.convocados[1];
  m.live.onCourt = [p2, "p1x", "p1y", "p1z", "p1w"].map((x, i) => (i === 0 ? p2 : m.convocados[i]));
  win.liveAction(p2, "foul", 0);
  win.liveAction(p2, "foul", 0);
  win.liveAction(p2, "foul", 0);
  win.liveAction(p2, "foul", 0);
  report.assert(win._isDQ(m.live.stats[p2]) === false, "tras 4 personales en vivo, todavía NO descalificado");
  win.liveAction(p2, "ftech", 0);
  report.assert(win._isDQ(m.live.stats[p2]) === true, "tras la 5ª falta en vivo (4 personales + 1 técnica), SÍ descalificado");
  // _enqueueDQSub() procesa la cola de inmediato si no hay modales
  // bloqueantes de por medio (_tryProcessDQSubs), así que para cuando
  // comprobamos ya se ha abierto el modal de sustitución forzosa en vez de
  // quedar pendiente en la cola.
  report.assert(!!win.document.getElementById("m-dqsub"), "tras descalificarse en pista, se abre el modal de sustitución forzosa");

  return report.summary();
}

module.exports = { run };
