"use strict";
// v3.0.0-dev.85 · B-LIVECONVGUARD1: Mario, tras B-LIVEBTNMOVE1 (dev.84):
// *"si le das a cambiar en vivo y no tiene convocados que va a ser llon
// normal porque se pone el aprtido y luego ya se convocará entonces peta la
// aplicacion. Deberíamos pasar la convocatoria que se quede sin seleccionar
// a nadie y se pasa lista desde fuera o se convoca ya cuando entras al
// directo, algo asi"*.
//
// Investigación: no había ningún crash de JS reproducible -- el guard
// existente en liveGame() (`!m.live&&!m.teamOnlyStats&&convP.length<5`) sí
// intercepta correctamente el caso de 0/pocos convocados, PERO el aviso que
// mostraba (_convValidationModal con primaryLabel:"Ir a la convocatoria")
// tenía un botón que en realidad solo se cerraba a sí mismo -- no llevaba a
// ningún sitio. El entrenador se quedaba atascado en matchDetail con la
// convocatoria igual de vacía, lo que describió como que "peta".
//
// Confirmado con AskUserQuestion: en vez de ese aviso muerto, el guard abre
// la convocatoria (openConvSetup) ahí mismo -- y si se completa con 5+
// convocados, se continúa DIRECTO a seguimiento en vivo (navTo('liveGame'))
// en vez de volver a matchDetail, vía el nuevo S._pendingLiveAfterConv que
// _convFinishDeferred() consulta al terminar. Si el entrenador pulsa
// "Saltar — configurar después", se queda en matchDetail como siempre (no
// se fuerza a entrar en directo sin querer).
const { loadApp, buildFixture, newReporter } = require("./harness");

async function run() {
  const report = newReporter("live_conv_guard");
  const assert = (cond, msg) => report.assert(cond, msg);
  const doc_ = (win) => win.document;

  // ═══ 1) liveGame() con convocatoria vacía: NO crashea, abre la convocatoria (no el aviso muerto) ═══
  {
    const win = await loadApp();
    const match = buildFixture(win, { convocados: [], matchMode: "quarters" });
    win.S.screen = "liveGame";
    const out = win.liveGame();
    const doc = doc_(win);
    assert(out === "", "liveGame() con 0 convocados: no crashea, devuelve string vacío como antes");
    assert(!match.live, "con 0 convocados, m.live NO se inicializa");
    assert(win.S.screen === "matchDetail", "se vuelve a matchDetail (para que se vea detrás del wizard)");
    assert(!!doc.getElementById("m-conv-setup"), "B-LIVECONVGUARD1: se abre el wizard de convocatoria directamente");
    assert(!doc.getElementById("m-conv-validation"), "B-LIVECONVGUARD1: ya NO se muestra el aviso bloqueante de 'Sin convocados' (su botón no llevaba a ningún sitio)");
    assert(win.S._pendingLiveAfterConv === "m1", "se recuerda que este wizard se abrió porque se intentaba pasar a vivo (para continuar a vivo al terminar)");
  }

  // ═══ 2) Lo mismo con solo 3 convocados (menos de los 5 exigidos por FIBA) ═══
  {
    const win = await loadApp();
    const match = buildFixture(win, { convocados: ["p1", "p2", "p3"], matchMode: "quarters" });
    win.S.screen = "liveGame";
    win.liveGame();
    const doc = doc_(win);
    assert(!match.live, "con solo 3 convocados (menos de 5), m.live tampoco se inicializa");
    assert(!!doc.getElementById("m-conv-setup"), "también abre el wizard de convocatoria con 3 convocados (no solo con 0)");
    assert(win.S._pendingLiveAfterConv === "m1", "también queda recordado el intento de pasar a vivo con 3 convocados");
  }

  // ═══ 3) Dentro del wizard recién abierto, "Saltar — configurar después": se queda en matchDetail, sin pendiente ═══
  {
    const win = await loadApp();
    const match = buildFixture(win, { convocados: [], matchMode: "quarters" });
    win.S.screen = "liveGame";
    win.liveGame(); // abre el wizard, deja S._pendingLiveAfterConv="m1"
    const doc = doc_(win);
    const skipBtn = [...doc.querySelectorAll("#m-conv-setup button")].find(b => b.textContent.includes("Saltar"));
    assert(!!skipBtn, "el wizard tiene el botón de siempre para saltar la convocatoria");
    skipBtn.click();
    assert(!doc.getElementById("m-conv-setup"), "al saltar, el wizard se cierra");
    assert(win.S.screen === "matchDetail", "al saltar, se queda en matchDetail (no se fuerza a entrar en directo)");
    assert(!match.live, "al saltar, m.live sigue sin existir");
    assert(win.S._pendingLiveAfterConv == null, "al saltar, se limpia el pendiente -- no debe quedar colgado para la próxima vez que se abra la convocatoria por otro motivo");
  }

  // ═══ 4) Completando la convocatoria (5+, capitán, titulares) y pulsando "Listo": continúa DIRECTO a vivo ═══
  {
    const win = await loadApp();
    const match = buildFixture(win, { convocados: [], matchMode: "quarters" });
    win.S.screen = "liveGame";
    win.liveGame(); // abre el wizard por el guard, deja S._pendingLiveAfterConv="m1"
    assert(win.S._pendingLiveAfterConv === "m1", "precondición: el wizard quedó marcado como abierto por el intento de ir a vivo");
    // Completar la convocatoria "a mano" (seleccionar 5, titular y capitán ya
    // están cubiertos por otros tests dedicados a _convFinish() -- aquí solo
    // nos interesa qué pasa DESPUÉS de que quede todo correcto).
    match.convocados = ["p1", "p2", "p3", "p4", "p5"];
    match.titulares = ["p1", "p2", "p3", "p4", "p5"];
    match.capitan = "p1";
    win._convFinish(); // equivalente a pulsar "✅ Listo — ir al partido"
    const doc = doc_(win);
    assert(!doc.getElementById("m-conv-setup"), "al completar la convocatoria y pulsar Listo, el wizard se cierra");
    assert(!doc.getElementById("m-conv-validation"), "y no queda ningún aviso de validación a medias");
    assert(win.S.screen === "liveGame", "B-LIVECONVGUARD1: continúa DIRECTO a seguimiento en vivo, sin tener que volver a pulsar 'Cambiar a seguimiento en vivo'");
    assert(!!match.live, "y m.live queda inicializado de verdad");
    assert(win.S._pendingLiveAfterConv == null, "el pendiente se limpia después de usarse, para no afectar a la próxima vez que se edite la convocatoria");
  }

  // ═══ 5) Editar convocatoria normal (botón "✏️ Editar", SIN pasar por el guard de vivo): se queda en matchDetail ═══
  {
    const win = await loadApp();
    const match = buildFixture(win, { convocados: ["p1", "p2", "p3", "p4", "p5"], titulares: ["p1", "p2", "p3", "p4", "p5"], capitan: "p1", matchMode: "quarters" });
    win.S.screen = "matchDetail";
    win.render();
    win.openConvSetup(); // esto es lo que hace el botón "✏️ Editar" -- SIN pendingLiveMid
    assert(win.S._pendingLiveAfterConv == null, "abrir la convocatoria desde 'Editar' (fuera del guard de vivo) NO deja ningún pendiente de ir a vivo");
    win._convFinish(); // "✅ Listo — ir al partido" con todo ya correcto
    assert(win.S.screen === "matchDetail", "editar la convocatoria normal y pulsar Listo se queda en matchDetail, como siempre -- NO salta a vivo sin que se haya pedido");
    assert(!match.live, "tampoco se inicializa m.live solo por editar la convocatoria");
  }

  // ═══ 6) teamOnlyStats:true con convocados vacíos: sigue bypaseando el guard igual que antes (B-GUEST1 intacto) ═══
  {
    const win = await loadApp();
    const match = buildFixture(win, { convocados: [], teamOnlyStats: true, matchMode: "quarters" });
    win.S.screen = "liveGame";
    const out = win.liveGame();
    const doc = doc_(win);
    assert(!doc.getElementById("m-conv-setup"), "con teamOnlyStats:true, NO se abre el wizard de convocatoria (no hace falta, B-GUEST1)");
    assert(!!match.live, "con teamOnlyStats:true, se entra directo a vivo con 0 convocados, igual que antes de este cambio");
    assert(typeof out === "string" && out.length > 0, "liveGame() devuelve HTML real, no se interrumpe");
  }

  // ═══ 7) Partido YA en directo (m.live existe) con convocados vacíos: el guard ni se plantea ═══
  {
    const win = await loadApp();
    const match = buildFixture(win, { matchMode: "quarters" });
    win.S.screen = "liveGame";
    win.liveGame(); // inicializa m.live con los 6 convocados por defecto de la fixture
    match.convocados = []; // simular que, YA en directo, se vacía la convocatoria por error
    win.S.screen = "liveGame";
    const doc = doc_(win);
    win.liveGame();
    assert(!doc.getElementById("m-conv-setup"), "con m.live ya existente, el guard no se dispara aunque convocados esté vacío ahora -- no se interrumpe un directo ya en marcha");
    assert(win.S.screen === "liveGame", "se sigue viendo la pantalla de directo con normalidad");
  }

  return report.summary();
}

module.exports = { run };
if (require.main === module) { run().then(({ failed }) => process.exit(failed ? 1 : 0)); }
