"use strict";
// v3.0.0-dev.84 · B-LIVEBTNMOVE1: Mario, tras B-MATCHMODE1/B-LIVECONFIRM1:
// *"vamos a quitar el seguimiento en vivo de la parte de arriba. Solo lo
// dejamos abajo y en Partidos en la primera pantalla quiero poner el boton
// de en directo cuandos ea en directo y en la pantalla hoy igual, solo
// cuando ssea en directo que salga empezar partiod sino que salga lo
// otro"*. Confirmado con AskUserQuestion (3 preguntas):
// 1) El botón de "Seguimiento en vivo" se quita de arriba en matchDetail()
//    (junto al badge de resultado) y se deja solo abajo, junto al
//    marcador/modo de partido.
// 2) En Partidos (matchList) y en Hoy, el acceso rápido de "Empezar
//    partido"/"En directo" solo se ofrece si el partido tiene elegido el
//    modo "En directo" -- en modo por cuartos/resultado final sale
//    "✏️ Anotar partido" en su lugar.
// 3) Ese acceso rápido pasa por el mismo aviso de confirmación de
//    B-LIVECONFIRM1 (dev.83) antes de bloquear el marcador por cuartos.
const { loadApp, buildFixture, newReporter } = require("./harness");

async function run() {
  const report = newReporter("live_btn_move");
  const assert = (cond, msg) => report.assert(cond, msg);

  // ═══ 1) matchDetail(): el botón de arriba (junto al resultado) desaparece ═══
  {
    const win = await loadApp();
    buildFixture(win); // sin matchMode -> "quarters"
    win.S.screen = "matchDetail";
    const html = win.matchDetail();
    // La franja de arriba es "resultBadge" seguido de scoreboardHtml -- el
    // viejo botón llevaba el texto "Seguimiento en vivo" junto al pill de
    // resultado; ahora esa franja solo tiene el pill.
    const topSlice = html.slice(html.indexOf("match-result-badge"), html.indexOf("match-result-badge") + 400);
    assert(!topSlice.includes("Seguimiento en vivo") && !topSlice.includes("startLiveGameConfirm"), "matchDetail(): la franja de arriba (junto al badge de resultado) ya NO tiene el botón de seguimiento en vivo");
  }

  // ═══ 2) matchDetail(): el botón SÍ sigue existiendo, pero abajo (junto al marcador) ═══
  {
    const win = await loadApp();
    buildFixture(win, { matchMode: "quarters" });
    win.S.screen = "matchDetail";
    const html = win.matchDetail();
    assert(html.includes("startLiveGameConfirm()"), "matchDetail() modo 'quarters': sigue habiendo un botón para escalar a directo, abajo");
    assert(html.includes("Cambiar a seguimiento en vivo"), "matchDetail() modo 'quarters': el botón de abajo es el discreto 'Cambiar a seguimiento en vivo'");
    const scorePos = html.indexOf("Marcador por cuartos");
    const btnPos = html.indexOf("startLiveGameConfirm()");
    assert(btnPos > scorePos, "el botón de directo aparece DESPUÉS de la sección del marcador, no antes (está 'abajo')");
  }

  // ═══ 3) matchDetail(): modo 'live' sin iniciar -> botón "Empezar en directo" abajo ═══
  {
    const win = await loadApp();
    buildFixture(win, { matchMode: "live" });
    win.S.screen = "matchDetail";
    const html = win.matchDetail();
    assert(html.includes("🔴 Empezar en directo"), "matchDetail() modo 'live' sin iniciar: el botón de abajo dice 'Empezar en directo'");
    assert(html.includes("startLiveGameConfirm()"), "y pasa por el mismo aviso de confirmación de siempre");
  }

  // ═══ 4) matchDetail(): ya en directo -> botón "Continuar en vivo" abajo, SIN confirmación ═══
  {
    const win = await loadApp();
    buildFixture(win);
    win.S.screen = "liveGame";
    win.liveGame(); // inicializa m.live de verdad
    win.S.screen = "matchDetail";
    const html = win.matchDetail();
    assert(html.includes("🔴 Continuar en vivo"), "matchDetail() ya en directo: el botón de abajo dice 'Continuar en vivo'");
    assert(html.includes("onclick=\"navTo('liveGame')\""), "y va directo sin pasar por el diálogo de confirmación (ya no hay nada que evitar)");
  }

  // ═══ 5) matchList() (Partidos): modo 'live', sin iniciar -> "▶ Empezar partido" ═══
  {
    const win = await loadApp();
    win.S.teams = [{ id: "t1", name: "Cadete Masculino", color: "#F06318" }];
    win.S.players = { t1: [] };
    win.S.matches = { t1: [{ id: "m1", rival: "Rival A", date: "2026-10-10", matchMode: "live", convocados: [] }] };
    win.S.teamId = "t1";
    win.S.screen = "matchList";
    const html = win.matchList();
    assert(html.includes("▶ Empezar partido"), "matchList(): partido en modo 'live' sin iniciar -> botón 'Empezar partido'");
    assert(html.includes("startLiveGameConfirm('m1')"), "matchList(): el botón llama a startLiveGameConfirm con el id de ESE partido concreto");
    assert(!html.includes("✏️ Anotar partido"), "matchList(): en modo 'live' no se ofrece 'Anotar partido' como acceso rápido");
  }

  // ═══ 6) matchList(): modo 'quarters'/'final' -> "✏️ Anotar partido", nunca empezar en directo ═══
  {
    const win = await loadApp();
    win.S.teams = [{ id: "t1", name: "Cadete Masculino", color: "#F06318" }];
    win.S.players = { t1: [] };
    win.S.matches = { t1: [
      { id: "m1", rival: "Rival Cuartos", date: "2026-10-10", matchMode: "quarters", convocados: [] },
      { id: "m2", rival: "Rival Final", date: "2026-10-11", matchMode: "final", convocados: [] }
    ] };
    win.S.teamId = "t1";
    win.S.screen = "matchList";
    const html = win.matchList();
    assert(html.includes("✏️ Anotar partido"), "matchList(): partidos en modo 'quarters'/'final' -> botón 'Anotar partido'");
    const anotarCount = (html.match(/✏️ Anotar partido/g) || []).length;
    assert(anotarCount === 2, "matchList(): el botón 'Anotar partido' aparece para los 2 partidos (quarters y final) -- dio " + anotarCount);
    assert(!html.includes("▶ Empezar partido") && !html.includes("startLiveGameConfirm("), "matchList(): en estos modos NO se ofrece ningún acceso directo a 'en directo' -- hay que entrar al partido y cambiar el modo a propósito");
  }

  // ═══ 7) matchList(): partido YA en directo (sin matchMode guardado, caso antiguo) -> SÍ se trata como 'live' ═══
  {
    const win = await loadApp();
    win.S.teams = [{ id: "t1", name: "Cadete Masculino", color: "#F06318" }];
    win.S.players = { t1: [{ id: "p1", name: "Jugador Test", number: 4 }] };
    win.S.matches = { t1: [{ id: "m1", rival: "Rival Viejo", date: "2026-10-10", convocados: ["p1"], live: { qScores: [[2, 1], [0, 0], [0, 0], [0, 0], [0, 0]] } }] }; // SIN matchMode -- partido anterior a dev.82
    win.S.teamId = "t1";
    win.S.screen = "matchList";
    const html = win.matchList();
    assert(html.includes("🔴 Continuar en vivo"), "matchList(): un partido ya en directo (m.live existe) mantiene su acceso rápido de 'Continuar en vivo' aunque no tenga matchMode guardado (partido de antes de B-MATCHMODE1) -- dio: " + html.includes("✏️ Anotar partido"));
  }

  // ═══ 8) matchList(): partido ya finalizado -> sin acceso rápido de ningún tipo ═══
  {
    const win = await loadApp();
    win.S.teams = [{ id: "t1", name: "Cadete Masculino", color: "#F06318" }];
    win.S.players = { t1: [] };
    win.S.matches = { t1: [{ id: "m1", rival: "Rival Pasado", date: "2026-09-01", matchMode: "live", finished: true, q: [20, 15, 0, 0, 0, 0, 0, 0, 0, 0] }] };
    win.S.teamId = "t1";
    win.S.screen = "matchList";
    const html = win.matchList();
    assert(!html.includes("▶ Empezar partido") && !html.includes("✏️ Anotar partido") && !html.includes("🔴 Continuar en vivo"), "matchList(): un partido ya finalizado no muestra ningún botón de acceso rápido");
  }

  // ═══ 9) hoy(): partido de hoy en modo 'live', sin iniciar -> botón pasa por el aviso de confirmación ═══
  {
    const win = await loadApp();
    const today = win.td();
    win.S.teams = [{ id: "t1", name: "Cadete Masculino", color: "#F06318", schedule: {} }];
    win.S.players = { t1: [] };
    win.S.matches = { t1: [{ id: "m1", rival: "Rival Hoy", date: today, matchMode: "live", convocados: [] }] };
    win.S.sessions = {};
    win.S.screen = "hoy";
    const html = win.hoy();
    assert(html.includes("▶ Empezar partido"), "hoy(): partido de hoy en modo 'live' sin iniciar -> botón 'Empezar partido'");
    assert(html.includes("startLiveGameConfirm('m1')"), "hoy(): el botón pasa por startLiveGameConfirm() (con el aviso de confirmación), ya no salta directo a liveGame()");
    assert(!html.includes("navTo('liveGame',{teamId:'t1',matchId:'m1'})"), "hoy(): ya no llama directamente a navTo('liveGame',...) sin preguntar");
  }

  // ═══ 10) hoy(): partido de hoy en modo 'quarters' -> 'Anotar partido', sin tentar al directo ═══
  {
    const win = await loadApp();
    const today = win.td();
    win.S.teams = [{ id: "t1", name: "Cadete Masculino", color: "#F06318", schedule: {} }];
    win.S.players = { t1: [] };
    win.S.matches = { t1: [{ id: "m1", rival: "Rival Hoy", date: today, matchMode: "quarters", convocados: [] }] };
    win.S.sessions = {};
    win.S.screen = "hoy";
    const html = win.hoy();
    assert(html.includes("✏️ Anotar partido"), "hoy(): partido de hoy en modo 'quarters' -> botón 'Anotar partido'");
    assert(!html.includes("▶ Empezar partido") && !html.includes("startLiveGameConfirm("), "hoy(): sin ningún acceso directo a 'en directo' para este partido");
  }

  // ═══ 11) hoy(): partido de hoy YA en directo, matchMode indiferente -> 'Continuar partido' ═══
  {
    const win = await loadApp();
    const today = win.td();
    win.S.teams = [{ id: "t1", name: "Cadete Masculino", color: "#F06318", schedule: {} }];
    win.S.players = { t1: [{ id: "p1", name: "Jugador Test", number: 4 }] };
    win.S.matches = { t1: [{ id: "m1", rival: "Rival Hoy", date: today, matchMode: "quarters", convocados: ["p1"], live: { qScores: [[1, 0], [0, 0], [0, 0], [0, 0], [0, 0]] } }] };
    win.S.sessions = {};
    win.S.screen = "hoy";
    const html = win.hoy();
    assert(html.includes("🔴 Continuar partido"), "hoy(): un partido de hoy YA en directo sigue ofreciendo 'Continuar partido', aunque su matchMode guardado sea 'quarters' (caso de un partido escalado a directo desde modo manual)");
  }

  return report.summary();
}

module.exports = { run };
if (require.main === module) { run().then(({ failed }) => process.exit(failed ? 1 : 0)); }
