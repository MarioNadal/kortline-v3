"use strict";
// v3.0.0-dev.92 · B-RIVALREB1 / B-LIVEFLOAT1: Mario, revisando funciones de
// partido en vivo, pidió dos cosas en el mismo mensaje:
//
// 1) "los rebotes ofensivos del otro equipo es algo que hay que contar
//    también siempre... datos imprescindibles al igual que las faltas o
//    los tiempos muertos" -- investigado antes de preguntar: faltas y
//    tiempos muertos del rival YA tienen un camino "siempre disponible" sin
//    depender del seguimiento individual del rival (rivalFoulLive(),
//    addTimeout('rival')), pero los rebotes NO -- la única forma de
//    anotar que el rival cogió un rebote era _pickReboundRival(), SOLO
//    alcanzable desde la cadena automática tras UN FALLO NUESTRO, y SOLO
//    para el caso defensivo (nunca el ofensivo, que es justo el que Mario
//    señaló como el dato que faltaba). Confirmado con AskUserQuestion: no
//    hace falta que se vea como contador en el marcador en vivo (de
//    momento) -- la pieza real es poder anotarlo SIEMPRE desde los propios
//    botones "R.Ofen"/"R.Def", sin tener que depender de la cadena ni del
//    seguimiento individual del rival.
// 2) "el boton del tiempo sobretodo el play y pause... hay que hacerlo
//    como boton flotante sino no es util tener que subir y bajar todo el
//    rato". Confirmado con AskUserQuestion: panel flotante con reloj
//    (tiempo + play/pause) + Tiempo Muerto, centrado abajo, ADITIVO sobre
//    la cabecera (que se queda igual, con el reloj completo).
const { loadApp, buildFixture, newReporter } = require("./harness");

async function run() {
  const report = newReporter("live_rebound_rival_and_float");
  const assert = (cond, msg) => report.assert(cond, msg);

  // ═══ 1) El picker "¿Quién?" de R.Ofen/R.Def ofrece una tarjeta "Rival" -- SOLO viendo nuestro propio equipo ═══
  {
    const win = await loadApp();
    const match = buildFixture(win);
    win.S.screen = "liveGame";
    win.liveGame(); // inicializa m.live (activeTeam:"our" por defecto)

    win.openActionPicker("ro", 0);
    let picker = win.document.getElementById("m-actpicker");
    let html = picker.innerHTML;
    assert(html.includes("_pickReboundForRival('ro')"), "B-RIVALREB1: el picker de R.Ofen (rebote ofensivo) ofrece la tarjeta 'Rival' viendo nuestro propio equipo");
    assert(html.includes("Rival"), "la tarjeta dice 'Rival'");
    picker.remove();

    win.openActionPicker("rd", 0);
    picker = win.document.getElementById("m-actpicker");
    html = picker.innerHTML;
    assert(html.includes("_pickReboundForRival('rd')"), "B-RIVALREB1: el picker de R.Def (rebote defensivo) también ofrece la tarjeta 'Rival'");
    picker.remove();

    // Otras acciones (no rebote) NO deben ofrecer la tarjeta -- scope exacto de lo pedido.
    win.openActionPicker("ast", 0);
    picker = win.document.getElementById("m-actpicker");
    html = picker.innerHTML;
    assert(!html.includes("_pickReboundForRival"), "la tarjeta 'Rival' NO aparece en el picker de asistencia (solo aplica a ro/rd)");
    picker.remove();
    win.openActionPicker("foul", 0);
    picker = win.document.getElementById("m-actpicker");
    html = picker.innerHTML;
    assert(!html.includes("_pickReboundForRival"), "la tarjeta 'Rival' NO aparece en el picker de falta (ya existe rivalFoulLive para eso)");
    picker.remove();
  }

  // ═══ 2) En la pestaña Rival (seguimiento individual activo), R.Ofen/R.Def NO ofrecen la tarjeta genérica --
  //        ahí ya se pregunta por un jugador rival concreto, que es más preciso ═══
  {
    const win = await loadApp();
    const rivalPlayers = [
      { id: "r1", name: "Rival Uno", number: 4 }, { id: "r2", name: "Rival Dos", number: 5 },
      { id: "r3", name: "Rival Tres", number: 6 }, { id: "r4", name: "Rival Cuatro", number: 7 },
      { id: "r5", name: "Rival Cinco", number: 8 }
    ];
    buildFixture(win, { rivalPlayers, rivalStatsEnabled: true });
    win.S.screen = "liveGame";
    win.liveGame();
    win.setActiveTeam("rival");
    win.liveGame();

    win.openActionPicker("ro", 0);
    const picker = win.document.getElementById("m-actpicker");
    const html = picker.innerHTML;
    assert(!html.includes("_pickReboundForRival"), "en la pestaña Rival, el picker de R.Ofen no ofrece la tarjeta genérica -- ya se pregunta por un jugador rival concreto");
    assert(html.includes("_pickActionFor('r1','ro'"), "sigue ofreciendo a las jugadoras rivales individuales con normalidad");
    picker.remove();
  }

  // ═══ 3) _pickReboundForRival(): registra el rebote del rival sin jugador concreto, para ofensivo Y defensivo ═══
  {
    const win = await loadApp();
    const match = buildFixture(win);
    win.S.screen = "liveGame";
    win.liveGame();

    win._pickReboundForRival("ro");
    let lastLog = match.live.log[match.live.log.length - 1];
    assert(lastLog.pid === "rival" && lastLog.action === "ro", "B-RIVALREB1: el rebote OFENSIVO del rival (el dato que faltaba) se registra en el log sin jugador concreto");
    assert(lastLog.desc === "Rebote ofensivo rival", "con la descripción correcta");
    assert(match.live.rivalTeamAgg && match.live.rivalTeamAgg.ro === 1, "se acumula en live.rivalTeamAgg.ro (mismo acumulador que ya usa el modo 'solo equipo', reutilizado para que quede disponible en futuros informes)");
    let toastEl = win.document.querySelector(".toast");
    assert(!!toastEl && toastEl.textContent.includes("ofensivo del rival"), "avisa por toast de qué se acaba de anotar");

    win._pickReboundForRival("rd");
    lastLog = match.live.log[match.live.log.length - 1];
    assert(lastLog.action === "rd" && lastLog.desc === "Rebote defensivo rival", "también funciona para el defensivo, con su propia descripción");
    assert(match.live.rivalTeamAgg.rd === 1, "se acumula por separado en .rd (no se mezcla con .ro)");

    // Repetir ro: el acumulador SUMA, no reemplaza.
    win._pickReboundForRival("ro");
    assert(match.live.rivalTeamAgg.ro === 2, "un segundo rebote ofensivo del rival suma al acumulador, no lo reinicia");
  }

  // ═══ 4) _pickReboundRival() (la cadena automática tras un fallo nuestro, ya existente) también
  //        suma ahora a rivalTeamAgg.rd -- mismo acumulador que el camino nuevo, sin romper lo que ya hacía ═══
  {
    const win = await loadApp();
    const match = buildFixture(win);
    win.S.screen = "liveGame";
    win.liveGame();

    win._pickReboundRival();
    const lastLog = match.live.log[match.live.log.length - 1];
    assert(lastLog.pid === "rival" && lastLog.action === "rd" && lastLog.desc === "Rebote rival", "B-RIVALREB1: _pickReboundRival() (la cadena de siempre) sigue registrando el log exactamente igual que antes -- sin regresión");
    assert(match.live.rivalTeamAgg && match.live.rivalTeamAgg.rd === 1, "y ahora TAMBIÉN suma a rivalTeamAgg.rd, el mismo acumulador que usa la tarjeta nueva -- los dos caminos para anotar un rebote del rival sin jugador concreto quedan unificados");
  }

  // ═══ 5) Panel flotante del reloj (B-LIVEFLOAT1): presente en el HTML, con los controles pedidos ═══
  {
    const win = await loadApp();
    buildFixture(win);
    win.S.screen = "liveGame";
    const html = win.liveGame();
    assert(html.includes('class="live-float-bar"'), "B-LIVEFLOAT1: el panel flotante existe en la pantalla de partido en vivo");
    assert(html.includes('id="live-clock-float"'), "incluye el tiempo restante");
    assert(html.includes('id="live-clock-btn-float"') && html.includes('onclick="toggleClock()"'), "incluye play/pause, reutilizando la misma función toggleClock() que la cabecera");
    assert(html.includes('onclick="openTimeoutModal()"') , "incluye acceso directo a Tiempo Muerto");
    // La cabecera de arriba sigue intacta -- esto es aditivo, no un reemplazo.
    assert(html.includes('id="live-clock-btn"') && html.includes('id="live-clock"'), "la cabecera original (reloj completo con editar/rebobinar) sigue ahí, sin tocar");
  }

  // ═══ 6) toggleClock() mantiene sincronizados los DOS botones de play/pause (cabecera y flotante) ═══
  {
    const win = await loadApp();
    const match = buildFixture(win);
    win.S.screen = "liveGame";
    const html = win.liveGame();
    const container = win.document.createElement("div");
    container.innerHTML = html;
    win.document.body.appendChild(container);

    const btnHeader = win.document.getElementById("live-clock-btn");
    const btnFloat = win.document.getElementById("live-clock-btn-float");
    // El botón de la cabecera lleva además una etiqueta "INICIAR"/"PARAR" en
    // un <span> anidado (preexistente, ver línea ~11982) -- por eso su
    // textContent inicial es "▶INICIAR", no "▶" a secas. El flotante no
    // tiene ese span, así que el suyo sí es "▶" exacto.
    assert(btnHeader.textContent.startsWith("▶") && btnFloat.textContent === "▶", "antes de arrancar, los dos botones muestran ▶ (el de la cabecera además con su etiqueta 'INICIAR')");

    win.toggleClock();
    assert(match.live.clockRunning === true, "toggleClock() arranca el reloj");
    assert(win.document.getElementById("live-clock-btn").textContent === "⏸", "el botón de la cabecera cambia a ⏸");
    assert(win.document.getElementById("live-clock-btn-float").textContent === "⏸", "B-LIVEFLOAT1: el botón flotante TAMBIÉN cambia a ⏸ -- sincronizado con el de la cabecera");

    win.toggleClock(); // parar, para no dejar un setInterval real corriendo tras el test
    assert(match.live.clockRunning === false, "toggleClock() para el reloj");
    assert(win.document.getElementById("live-clock-btn-float").textContent === "▶", "el botón flotante vuelve a ▶ al parar");
  }

  return report.summary();
}

module.exports = { run };
if (require.main === module) {
  run().then(({ failed }) => process.exit(failed > 0 ? 1 : 0));
}
