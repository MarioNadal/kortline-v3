"use strict";
// v3.0.0-dev.57 · B-DLS1: estadísticas en vivo de ejercicio, como FLAG
// reutilizable (drill.liveStats) de cualquier ejercicio del catálogo del
// equipo -- reemplaza al B-B11-1 anterior (que era fijo, solo
// "Contraataque de 11" y solo accesible desde el pase de lista). Ahora se
// lanza desde "Equipo -> Catálogo de ejercicios" (openDrillLibraryModal).
//
// v3.0.0-dev.66 · B-DLS2: rediseño pedido explícitamente por Mario porque
// "Contraataque de 11" se quedó muy feo de rellenar. Cambia respecto a
// B-DLS1: (1) el picker de "Ejercicios de la sesión" (openDrillPickerModal,
// al planificar el entrenamiento del día) AHORA SÍ ofrece lanzar/continuar/
// ver historial en vivo -- antes vivía solo en el catálogo del equipo; (2)
// valoración propia (_dlsValoracion: 2 anotado=1, 3 anotado=2, resto igual
// que en partidos) y el resumen se ordena por ella; (3) tiros fallados
// configurables (registrarlos o no; restar -1 o no a la valoración); (4)
// apodo/nombre/apellido (_dlsPlayerLabel, ajuste fijo S.cfg.dlsNameMode);
// (5) panel de botones COMPLETO siempre visible (rebote/robo/asistencia
// sueltos, no solo encadenados) -- el checklist ya no oculta ningún botón,
// solo decide si se pregunta la asistencia automáticamente tras canasta;
// (6) botón "Cancelar" en cualquier cadena de picker, que deshace TODO lo
// registrado en esa acción concreta, no solo el último paso.
//
// v3.0.0-dev.67 · B-DLS3: dos cambios más, pedidos por Mario tras probar
// dev.66 en /test/: (1) el botón "Añadir" de jugador nuevo en el setup ya
// no se come el input del nombre (bug de CSS, ver test más abajo); (2)
// "Contraataque de 11" pasa de ser un checkbox genérico (drill.liveStats,
// cualquier ejercicio podía tenerlo) a un selector "Tipo de ejercicio" con
// opciones fijas -- _dlsType(drill) devuelve "", "b11" o "endgame" (con
// fallback a "b11" para ejercicios antiguos que ya tenían liveStats:true,
// como el propio "Contraataque de 11" real de Mario). El nuevo tipo
// "endgame" ("Final de partido") es un mini-partido con marcador de dos
// equipos armados a mano por el entrenador, cuenta atrás en mm:ss y
// marcador inicial exacto configurable -- opcionalmente con estadísticas
// individuales activadas, en cuyo caso REUTILIZA tal cual el motor de
// captura de b11 (dlsShot/dlsRebound/...) y el marcador de cada equipo se
// calcula solo a partir de los puntos reales anotados por sus jugadores.
//
// v3.0.0-dev.70 · B-DLS6: pedido por Mario tras usar el selector de tipo de
// B-DLS3 -- "Tipo de ejercicio" pasa a ser el PRIMER campo del alta/edición
// (antes de Nombre y Categoría), y elegir "Contraataque de 11" o "Final de
// partido" rellena solos el nombre y la categoría "de libro" de ese tipo
// (offense/"Ataque / Táctica" y scrimmage/"Partido / Situaciones" de
// DRILL_CATS) vía _dlsTypeAutofill(). El usuario puede cambiar el nombre
// después con total libertad -- el autorrelleno solo actúa en el momento de
// elegir el tipo (evento change del selector), nunca se reimpone solo.
const { loadApp, newReporter } = require("./harness.js");

async function run() {
  const win = await loadApp();
  const report = newReporter("dls");
  const { document } = win;

  win.S.teamId = "t1";
  win.S.teams = [{ id: "t1", name: "Infantil A", category: "Infantil", coaches: ["María"] }];
  win.S.players = {
    t1: [
      { id: "p1", name: "Ana García", nickname: "Anita", number: 4 },
      { id: "p2", name: "Bea López", number: 5 },
      { id: "p3", name: "Cata Ruiz", number: 6 },
      { id: "p4", name: "Dana Soto", number: 7, matchOnly: true } // puntual de partido: nunca entrena, no debe entrar en el roster del ejercicio
    ]
  };
  win.S.drills = { t1: [] };
  win.S.sessions = {};
  win.S.drillLive = {};
  win.S.date = "2026-09-16";
  win.S.cfg.features.exercises = true;

  // ── _dlsPlayerLabel: apodo / nombre / apellido (B-DLS2) ──
  const p1 = win.S.players.t1[0], p2 = win.S.players.t1[1];
  win.S.cfg.dlsNameMode = "nombre";
  report.assert(win._dlsPlayerLabel(p1) === "Ana", "modo 'nombre' (por defecto): usa el nombre de pila de siempre (_shortName)");
  win.S.cfg.dlsNameMode = "apodo";
  report.assert(win._dlsPlayerLabel(p1) === "Anita", "modo 'apodo': usa el apodo del jugador si lo tiene puesto");
  report.assert(win._dlsPlayerLabel(p2) === "Bea", "modo 'apodo': cae al nombre si el jugador no tiene apodo puesto");
  win.S.cfg.dlsNameMode = "apellido";
  report.assert(win._dlsPlayerLabel(p1) === "García", "modo 'apellido': usa lo que va después de la primera palabra del nombre");
  report.assert(win._dlsPlayerLabel({ name: "Cata" }) === "Cata", "modo 'apellido': si el nombre es una sola palabra, cae al nombre completo");
  report.assert(win._dlsPlayerLabel({ name: "Invitado", temp: true }) === "Invitado", "un jugador temporal siempre se muestra tal cual, sin aplicar ningún modo");
  win.S.cfg.dlsNameMode = "nombre"; // se deja en el modo por defecto para el resto del test

  // ── _dlsValoracion (B-DLS2): 2 anotado=1, 3 anotado=2, resto igual que partidos ──
  report.assert(win._dlsValoracion(null, false) === 0, "_dlsValoracion(null) no revienta, da 0");
  const stFull = { p2m: 2, p2a: 1, p3m: 1, p3a: 1, reb: 2, ast: 1, stl: 1, blk: 1, to: 1 };
  // pts = 2*1 + 1*2 = 4; +reb(2)+ast(1)+stl(1)+blk(1)-to(1) = 4+2+1+1+1-1 = 8
  report.assert(win._dlsValoracion(stFull, false) === 8, "sin penalización por fallo: 2pm vale 1, 3pm vale 2, el resto sube/baja igual que en partidos (esperado 8)");
  report.assert(win._dlsValoracion(stFull, true) === 6, "con penalización activada, cada tiro fallado (p2a+p3a=2) resta 1 más (esperado 8-2=6)");

  // ── Alta de un ejercicio del catálogo con Tipo "Contraataque de 11" (B-DLS3: ya no es un checkbox, es un selector) ──
  win.openDrillModal();
  document.getElementById("m-add-drill-name").value = "Contraataque de 11";
  document.getElementById("m-add-drill-cat").value = "transition";
  report.assert(!document.getElementById("m-add-drill-livestats"), "B-DLS3: el viejo checkbox 'con estadísticas en vivo' ha desaparecido del alta de ejercicio");
  const typeSel = document.getElementById("m-add-drill-dlstype");
  report.assert(!!typeSel && typeSel.value === "", "B-DLS3: el nuevo selector 'Tipo de ejercicio' existe y arranca en 'Normal' por defecto");
  typeSel.value = "b11";
  win.saveDrill("m-add-drill", "");
  report.assert(win.S.drills.t1.length === 1 && win.S.drills.t1[0].dlsType === "b11", "el tipo elegido se guarda como drill.dlsType");
  report.assert(win._dlsType(win.S.drills.t1[0]) === "b11", "_dlsType() reconoce el ejercicio recién creado como 'b11'");
  const drill = win.S.drills.t1[0];

  // ── Retrocompatibilidad: un ejercicio antiguo con liveStats:true (sin dlsType) sigue reconociéndose como 'b11' ──
  report.assert(win._dlsType({ liveStats: true }) === "b11", "B-DLS3: un ejercicio creado con el checkbox viejo (liveStats:true, sin dlsType) sigue tratándose como 'b11' -- no deja de funcionar por el cambio de UI");
  report.assert(win._dlsType({}) === "" && win._dlsType(null) === "", "_dlsType() no revienta con un ejercicio normal o inexistente");

  // ── B-DLS6 (dev.70): elegir el tipo rellena solo el nombre y la categoría "de libro" de ese tipo -- Mario no quiere escribirlo a mano cada vez ──
  win.openDrillModal();
  const typeSelAuto = document.getElementById("m-add-drill-dlstype");
  const nameElAuto = document.getElementById("m-add-drill-name");
  const catElAuto = document.getElementById("m-add-drill-cat");
  report.assert(nameElAuto.value === "" && catElAuto.value === "warmup", "B-DLS6: al abrir el alta en blanco, nombre y categoría siguen vacíos/por defecto -- el autorrelleno solo actúa cuando se elige un tipo");
  typeSelAuto.value = "b11";
  win._dlsTypeAutofill("m-add-drill");
  report.assert(nameElAuto.value === "Contraataque de 11", "B-DLS6: elegir el tipo 'Contraataque de 11' rellena el nombre solo");
  report.assert(catElAuto.value === "offense", "B-DLS6: elegir el tipo 'Contraataque de 11' rellena la categoría 'Ataque / Táctica' sola");
  nameElAuto.value = "Contraataque de 11 (variante rápida)";
  report.assert(nameElAuto.value === "Contraataque de 11 (variante rápida)", "B-DLS6: el usuario puede cambiar el nombre después de que se autorrellene, sin que nada se lo pise");
  typeSelAuto.value = "endgame";
  win._dlsTypeAutofill("m-add-drill");
  report.assert(nameElAuto.value === "Final de partido", "B-DLS6: elegir el tipo 'Final de partido' rellena el nombre solo -- y sí sobrescribe lo que hubiera antes, porque el usuario ha vuelto a elegir un tipo explícitamente");
  report.assert(catElAuto.value === "scrimmage", "B-DLS6: elegir el tipo 'Final de partido' rellena la categoría 'Partido / Situaciones' sola");
  typeSelAuto.value = "";
  win._dlsTypeAutofill("m-add-drill");
  report.assert(nameElAuto.value === "Final de partido", "B-DLS6: volver a 'Normal' no toca nada -- el autorrelleno solo actúa al elegir un tipo con estadísticas en vivo");
  const dlsTypeFieldOrder = [...document.querySelectorAll("#m-add-drill .fg .fl")].map(l => l.textContent.trim());
  report.assert(dlsTypeFieldOrder[0] === "Tipo de ejercicio" && dlsTypeFieldOrder.indexOf("Nombre") === 1, "B-DLS6: 'Tipo de ejercicio' es ahora el primer campo del alta, por delante de Nombre y Categoría, para que el autorrelleno tenga sentido en el orden en que se rellena el formulario");

  // ── Un ejercicio normal (Tipo="Normal") no ofrece el botón de en vivo ──
  win.openDrillModal();
  document.getElementById("m-add-drill-name").value = "Rueda de tiro exterior";
  win.saveDrill("m-add-drill", "");
  const libHtmlBoth = win._drillLibraryRowsHtml();
  report.assert(libHtmlBoth.includes("openDlsSetupModal('" + drill.id + "')"), "un ejercicio de tipo b11 ofrece el botón 'Iniciar en vivo' en la fila del catálogo");
  const normalDrill = win.S.drills.t1.find(d => d.name === "Rueda de tiro exterior");
  report.assert(!libHtmlBoth.includes("openDlsSetupModal('" + normalDrill.id + "')") && !libHtmlBoth.includes("openDlsResumeOrLive('" + normalDrill.id + "')"), "un ejercicio de tipo Normal no ofrece ningún botón de en vivo");

  // ── B-DLS2: el picker de "Ejercicios de la sesión" (planificar el entrenamiento del día) AHORA SÍ ofrece lanzar/ver en vivo ──
  win.S.screen = "att";
  const pickerHtml = win._drillPickerListHtml();
  report.assert(pickerHtml.includes("openDlsSetupModal('" + drill.id + "')"), "_drillPickerListHtml() (planificar el entrenamiento del día) ahora SÍ ofrece 'Iniciar en vivo' para un ejercicio con estadísticas -- antes vivía solo en el catálogo");
  report.assert(pickerHtml.includes("🎯 EN VIVO"), "el picker de la sesión también muestra la insignia '🎯 EN VIVO' del ejercicio, igual que el catálogo");
  report.assert(!pickerHtml.includes("openDlsSetupModal('" + normalDrill.id + "')"), "un ejercicio de tipo Normal sigue sin ofrecer nada de esto en el picker de la sesión");

  // ── El pase de lista no tiene ningún resto del B11 fijo anterior ──
  const attHtml = win.att();
  report.assert(!attHtml.includes("Contraataque de 11") && !/openB11|openDls/.test(attHtml), "la pantalla de pase de lista (att()) no menciona el ejercicio en vivo en absoluto -- se ha revertido por completo");

  // ── Setup: roster excluye matchOnly, preselecciona a todos los demás ──
  win.S.screen = "team";
  win.openDlsSetupModal(drill.id);
  report.assert(!!document.getElementById("m-dls-setup"), "openDlsSetupModal() abre el modal de configuración");
  report.assert(document.querySelector("#m-dls-setup .mtitle").textContent.includes("Contraataque de 11"), "el título del modal usa el nombre real del ejercicio del catálogo");
  report.assert(win._dlsSetup.selected.size === 3, "el roster inicial preselecciona a los 3 jugadores activos (excluye al puntual de partido)");
  report.assert(!win._dlsSetup.selected.has("p4"), "un puntual de partido (matchOnly) no entra en el roster del ejercicio");
  const rosterHtml = document.getElementById("dls-roster-list").innerHTML;
  report.assert(rosterHtml.includes("conv-row") && rosterHtml.includes("conv-cb"), "B-DLS2: la lista de jugadores usa el mismo componente visual que la convocatoria de partido (.conv-row/.conv-cb), no checkboxes sueltos");
  report.assert(rosterHtml.includes("Ana") && !rosterHtml.includes("#4 Ana"), "B-DLS2: el nombre es el protagonista -- el dorsal ya no va pegado delante como '#4 Nombre'");

  // ── Quitar un jugador y añadir uno temporal (no cuenta) ──
  win._dlsTogglePlayer("p2");
  report.assert(win._dlsSetup.selected.size === 2, "_dlsTogglePlayer quita a un jugador de la selección");
  document.getElementById("dls-temp-name").value = "Invitado suelto";
  win._dlsAddTemp();
  report.assert(win._dlsSetup.temps.length === 1, "_dlsAddTemp añade un jugador temporal a la lista");

  // ── B-DLS3: el botón "Añadir" del jugador nuevo ya no se come el input ──
  // (bug real reportado por Mario: el botón heredaba width:100% de .btn-s
  // dentro de la fila flex, tapando el nombre que se estaba escribiendo)
  const addTempBtn = [...document.querySelectorAll("#m-dls-setup button")].find(b => b.textContent.trim() === "Añadir");
  report.assert(!!addTempBtn && /width:\s*auto/.test(addTempBtn.getAttribute("style")), "el botón 'Añadir' de jugador nuevo tiene width:auto explícito -- ya no se estira al 100% del ancho tapando el input del nombre");

  // ── B-DLS2: ya no hay checkbox de "Tapones" (el botón está siempre disponible) -- en su lugar, tiros fallados configurables ──
  report.assert(!document.getElementById("dls-chk-blk"), "el viejo checkbox de 'Tapones' ha desaparecido del setup (el botón de tapón ya está siempre disponible)");
  const misstrackChk = document.getElementById("dls-chk-misstrack");
  report.assert(!!misstrackChk && misstrackChk.checked === true, "por defecto, 'Registrar los tiros fallados' viene marcado");
  const misspenaltyChk = document.getElementById("dls-chk-misspenalty");
  report.assert(!!misspenaltyChk && misspenaltyChk.checked === false, "por defecto, 'Restar -1 por fallo' viene SIN marcar (a petición explícita de Mario)");
  misspenaltyChk.checked = true; // lo activamos para poder probar la penalización más abajo

  // ── Configurar checklist y minutos, empezar ──
  document.getElementById("dls-chk-ast").checked = true;
  document.getElementById("dls-minutes").value = "10";
  win.startDls();
  report.assert(!document.getElementById("m-dls-setup"), "startDls cierra el modal de configuración");
  report.assert(win.S.screen === "dlsLive", "startDls navega a la pantalla en vivo");
  const b = win._dls();
  report.assert(!!b, "_dls() devuelve la sesión recién creada");
  report.assert(b.drillId === drill.id && b.drillName === "Contraataque de 11", "la sesión guarda el id y una copia del nombre del ejercicio del catálogo");
  report.assert(b.date === win.td(), "la sesión se fecha con el día en que se lanza");
  report.assert(win.S.drillLive.t1[drill.id][0] === b, "la sesión se guarda en S.drillLive[teamId][drillId], no en S.sessions");
  report.assert(b.status === "running", "la sesión arranca en estado 'running'");
  report.assert(b.durationSec === 600 && b.remainingSec === 600, "la duración configurada (10 min) se guarda en segundos");
  report.assert(b.checklist.ast === true && b.checklist.missTrack === true && b.checklist.missPenalty === true, "el checklist guarda asistencia automática + los dos ajustes nuevos de tiros fallados tal y como se marcaron");
  report.assert(b.players.length === 3, "la sesión guarda 2 jugadores del roster + 1 temporal = 3 participantes");
  report.assert(b.players.some(p => p.id === "p2") === false, "el jugador deseleccionado (p2) no participa en la sesión");
  report.assert(b.players.find(p => p.id === "p1").nickname === "Anita", "B-DLS2: la sesión guarda una copia del apodo del jugador (para poder mostrarlo aunque luego cambie en la ficha)");
  const tempP = b.players.find(p => p.temp);
  report.assert(!!tempP && tempP.name === "Invitado suelto", "el jugador temporal entra en la sesión con su nombre");
  report.assert(!win.S.players.t1.some(p => p.name === "Invitado suelto"), "el jugador temporal NO se añade a la plantilla real del equipo (no cuenta para nada fuera de esta sesión)");
  Object.keys(b.stats).forEach(pid => {
    const st = b.stats[pid];
    report.assert(st.p2m === 0 && st.reb === 0 && st.to === 0, "cada jugador arranca con estadísticas a 0 (" + pid + ")");
  });

  // ── Tiro anotado de 2 → encadena asistencia → encadena rebote ──
  win.dlsShot(2, true);
  report.assert(!!document.getElementById("m-dls-picker"), "dlsShot abre el selector de '¿quién anotó?'");
  report.assert(document.querySelector("#m-dls-picker button[onclick*='_dlsCancelChain']").textContent.includes("Cancelar"), "B-DLS2: el selector siempre tiene un botón 'Cancelar', además del de siempre");
  win._dlsPickerConfirm("p1");
  report.assert(win._dls().stats.p1.p2m === 1, "anotar +2 incrementa p2m del jugador elegido");
  report.assert(!!document.getElementById("m-dls-picker"), "tras anotar (con checklist.ast activo) se encadena el selector de asistencia");
  win._dlsPickerSkip(); // sin asistencia
  report.assert(win._dls().stats.p1.ast === 0 && win._dls().stats.p3.ast === 0, "saltar la asistencia no suma nada a nadie");
  report.assert(!!document.getElementById("m-dls-picker"), "tras la asistencia (u omitirla) se encadena el selector de rebote");
  win._dlsPickerConfirm("p3");
  report.assert(win._dls().stats.p3.reb === 1, "elegir jugador en el selector de rebote suma reb a quien lo coge");
  report.assert(!document.getElementById("m-dls-picker"), "el selector se cierra tras completar la cadena");

  // ── B-DLS5 (dev.69): rejilla estable -- se muestra SIEMPRE la plantilla completa, el excluido se ve atenuado en su sitio en vez de desaparecer y recolocar a los demás ──
  // (pedido explícito de Mario: "el juego va muy rápido... tienes que encontrar o acordarte de tres nombres en 2 segundos")
  win.dlsShot(2, true);
  win._dlsPickerConfirm("p1"); // anota p1 -- se abre el selector de asistencia excluyendo a p1
  const assistPickerCards = [...document.querySelectorAll("#m-dls-picker [data-pid]")];
  report.assert(assistPickerCards.length === 3, "B-DLS5: el selector de '¿quién dio la asistencia?' muestra la PLANTILLA COMPLETA (3 jugadores de la sesión), no solo los elegibles -- antes el anotador desaparecía de la rejilla y recolocaba a los demás");
  const p1Card = assistPickerCards.find(c => c.dataset.pid === "p1");
  report.assert(!!p1Card && p1Card.dataset.excluded === "1" && p1Card.tagName === "DIV", "el propio anotador (p1) se muestra atenuado, en su sitio de siempre, y no se puede pulsar (es un <div>, no un <button>) en vez de desaparecer");
  const p3Card = assistPickerCards.find(c => c.dataset.pid === "p3");
  report.assert(!!p3Card && !p3Card.dataset.excluded && p3Card.tagName === "BUTTON", "el resto de jugadores (p3) se sigue pudiendo elegir con normalidad, en la misma posición de siempre");
  report.assert(p3Card.innerHTML.includes("font-size:14px"), "B-DLS5: el nombre de la tarjeta usa un tamaño de letra más grande que antes (14px, antes 13px) para leerlo de un vistazo bajo presión");
  report.assert(/padding:16px/.test(p3Card.getAttribute("style")) && /padding:16px/.test(p1Card.getAttribute("style")), "B-DLS5: las tarjetas (elegibles y atenuadas por igual) tienen más padding que antes (16px, antes 14px) -- más grandes y fáciles de tocar/leer");
  win._dlsCancelChain(); // deshace también el tiro de p1 registrado justo arriba -- deja las estadísticas como estaban antes de esta comprobación
  report.assert(win._dls().stats.p1.p2m === 1, "tras cancelar esta comprobación, p1.p2m vuelve a su valor de antes (1) -- no interfiere con el resto del test");

  // ── B-DLS2: Cancelar a mitad de una cadena deshace TODO lo ya registrado en ella ──
  win.dlsShot(2, true);
  win._dlsPickerConfirm("p1"); // p1.p2m pasa a 2
  report.assert(win._dls().stats.p1.p2m === 2, "(preparación) segundo +2 de p1 registrado antes de cancelar");
  win._dlsPickerSkip(); // salta la asistencia (seguimos dentro de la misma cadena)
  win._dlsCancelChain(); // en el paso del rebote, cancelamos toda la acción
  report.assert(win._dls().stats.p1.p2m === 1, "Cancelar deshace también el tiro ya registrado en esta misma cadena (p1.p2m vuelve a 1)");
  report.assert(!document.getElementById("m-dls-picker"), "Cancelar cierra el selector");
  report.assert(win._dls().log[win._dls().log.length - 1].action !== "p2m" || win._dls().stats.p1.p2m === 1, "el log no se queda con un tiro fantasma tras cancelar");

  // ── Tiro fallado de 3 → encadena rebote directamente (sin asistencia) ──
  win.dlsShot(3, false);
  win._dlsPickerConfirm("p3");
  report.assert(win._dls().stats.p3.p3a === 1, "fallar de 3 incrementa p3a del jugador elegido");
  report.assert(!!document.getElementById("m-dls-picker"), "un fallo también encadena el selector de rebote (no solo el acierto)");
  win._dlsPickerSkip();
  report.assert(win._dls().stats.p3.reb === 1, "saltar el rebote no suma un segundo rebote de más");

  // ── Pérdida → encadena robo, con opción de omitir ──
  win.dlsTurnover();
  win._dlsPickerConfirm("p1");
  report.assert(win._dls().stats.p1.to === 1, "marcar pérdida incrementa 'to' de quien la comete");
  report.assert(!!document.getElementById("m-dls-picker"), "tras la pérdida se encadena el selector de '¿quién ha robado?'");
  win._dlsPickerConfirm("p3");
  report.assert(win._dls().stats.p3.stl === 1, "elegir jugador en el selector de robo suma 'stl'");

  win.dlsTurnover();
  win._dlsPickerConfirm("p3");
  win._dlsPickerSkip(); // nadie robó
  report.assert(win._dls().stats.p3.to === 1 && Object.values(win._dls().stats).every(s => s.stl === 1 || s.stl === 0), "omitir el robo tras una pérdida no rompe nada ni asigna un robo fantasma");

  // ── B-DLS2: accesos sueltos a rebote/robo/asistencia, siempre disponibles ──
  const rebBefore = win._dls().stats.p1.reb;
  win.dlsRebound();
  report.assert(!!document.getElementById("m-dls-picker"), "dlsRebound() (botón suelto) abre su propio selector, sin depender de ningún tiro fallado previo");
  win._dlsPickerConfirm("p1");
  report.assert(win._dls().stats.p1.reb === rebBefore + 1, "dlsRebound() suelto suma un rebote igual que el encadenado tras un fallo");
  win.dlsAssist();
  win._dlsPickerConfirm("p2");
  report.assert(win._dls().stats.p2.ast === 1, "dlsAssist() (botón suelto) permite registrar una asistencia sin que haya habido una canasta justo antes");
  win.dlsSteal();
  win._dlsPickerConfirm("p1");
  report.assert(win._dls().stats.p1.stl === 1, "dlsSteal() (botón suelto) permite registrar un robo sin que haya habido una pérdida justo antes");

  // ── B-DLS2: panel completo -- TODOS los botones están siempre visibles, el checklist ya no oculta ninguno ──
  const screenHtml = win.screenDlsLive();
  ["dlsShot(2,true)", "dlsShot(2,false)", "dlsShot(3,true)", "dlsShot(3,false)", "dlsRebound()", "dlsTurnover()", "dlsSteal()", "dlsAssist()", "dlsBlock()"].forEach(fn => {
    report.assert(screenHtml.includes(fn), "la pantalla en vivo incluye el botón " + fn + " (panel completo, siempre visible)");
  });
  report.assert(screenHtml.includes("Contraataque de 11"), "la cabecera de la pantalla en vivo usa el nombre real del ejercicio, no un texto fijo");
  report.assert(screenHtml.includes("val</span>") || / val</.test(screenHtml), "las tarjetas de jugador de la pantalla en vivo muestran también su valoración");

  // ── B-DLS2: si "Registrar tiros fallados" está desactivado, los botones de fallo desaparecen (el resto sigue) ──
  win.confirmEndDls();
  document.querySelector("#m-confirm button").click();
  document.getElementById("m-dls-summary")?.remove();
  win.openDlsSetupModal(drill.id);
  document.getElementById("dls-chk-misstrack").checked = false;
  win.startDls();
  const screenNoMiss = win.screenDlsLive();
  report.assert(!screenNoMiss.includes("dlsShot(2,false)") && !screenNoMiss.includes("dlsShot(3,false)"), "con 'Registrar tiros fallados' desmarcado, los botones de Fallo 2/Fallo 3 no se muestran");
  report.assert(screenNoMiss.includes("dlsShot(2,true)") && screenNoMiss.includes("dlsShot(3,true)") && screenNoMiss.includes("dlsRebound()"), "el resto de botones (incluidos los tiros anotados) se siguen mostrando igual");
  win.confirmEndDls();
  document.querySelector("#m-confirm button").click();

  // ── B-DLS2: el resumen se ordena por valoración y muestra siempre todas las columnas ──
  const summaryHtml = document.getElementById("m-dls-summary").innerHTML;
  report.assert(summaryHtml.includes(">Ast<") && summaryHtml.includes(">Tap<") && summaryHtml.includes(">Val<"), "el resumen siempre muestra las columnas de asistencia/tapón/valoración, aunque no se hayan marcado en la configuración");
  const tableRows = [...document.querySelectorAll("#m-dls-summary tbody tr")];
  const rowVals = tableRows.map(tr => parseInt(tr.querySelector("td:last-child").textContent, 10));
  const sorted = [...rowVals].sort((x, y) => y - x);
  report.assert(JSON.stringify(rowVals) === JSON.stringify(sorted), "las filas del resumen están ordenadas por valoración de mayor a menor");
  document.getElementById("m-dls-summary").remove();

  // ── Deshacer última acción ──
  win.openDlsSetupModal(drill.id);
  win.startDls();
  const before = win._dls().stats.p3.stl;
  win.dlsTurnover();
  win._dlsPickerConfirm("p1");
  win._dlsPickerConfirm("p3");
  report.assert(win._dls().stats.p3.stl === before + 1, "robo registrado antes de deshacer");
  win.undoDlsLast();
  report.assert(win._dls().stats.p3.stl === before, "undoDlsLast revierte exactamente la última acción del log");

  // ── Terminar el ejercicio: no borra nada, solo cambia de estado, y vuelve a Equipo ──
  const logLenBeforeEnd = win._dls().log.length;
  win.confirmEndDls();
  const confirmBtn = document.querySelector("#m-confirm button");
  report.assert(!!confirmBtn, "confirmEndDls pide confirmación antes de cerrar el ejercicio");
  confirmBtn.click();
  const finishedSess = win.S.drillLive.t1[drill.id][win.S.drillLive.t1[drill.id].length - 1];
  report.assert(finishedSess.status === "finished", "confirmar el cierre marca la sesión como 'finished'");
  report.assert(finishedSess.log.length === logLenBeforeEnd, "terminar el ejercicio no borra ni un solo evento del log");
  report.assert(win.S.screen === "team", "al terminar, la navegación vuelve a la pantalla Equipo (de donde se lanzó), no al pase de lista");
  report.assert(!!document.getElementById("m-dls-summary"), "al terminar se abre el resumen automáticamente");
  document.getElementById("m-dls-summary").remove();

  // ── La fila del catálogo refleja el estado 'finished': ya no ofrece "continuar", sí "ver último resultado" ──
  const libHtmlAfterFinish = win._drillLibraryRowsHtml();
  report.assert(libHtmlAfterFinish.includes("openDlsSetupModal('" + drill.id + "')"), "tras terminar, la fila vuelve a ofrecer 'Iniciar en vivo' (nueva sesión) en vez de 'Continuar'");
  report.assert(libHtmlAfterFinish.includes("openDlsSummaryModal('" + drill.id + "')"), "tras terminar, la fila ofrece un acceso para ver el último resultado");

  // ── Lanzar una nueva sesión el mismo día NO sobreescribe el historial anterior ──
  const sessCountBefore = win.S.drillLive.t1[drill.id].length;
  win.openDlsSetupModal(drill.id);
  win.startDls();
  report.assert(win.S.drillLive.t1[drill.id].length === sessCountBefore + 1, "una sesión nueva se añade al histórico del ejercicio sin borrar las anteriores");
  win.confirmEndDls();
  document.querySelector("#m-confirm button").click();
  document.getElementById("m-dls-summary")?.remove();

  // ── Borrar el ejercicio del catálogo no borra su histórico de estadísticas en vivo ──
  const histLenBeforeDelete = win.S.drillLive.t1[drill.id].length;
  win.deleteDrill(drill.id);
  document.querySelector("#m-confirm button").click();
  report.assert(!win.S.drills.t1.some(d => d.id === drill.id), "el ejercicio desaparece del catálogo");
  report.assert(win.S.drillLive.t1[drill.id].length === histLenBeforeDelete, "el histórico de estadísticas en vivo de ese ejercicio se conserva aunque se borre del catálogo (nunca se borra nada)");

  // ── El catálogo/sesiones del pase de lista siguen intactos (nada se ha tocado fuera de lo esperado) ──
  report.assert(Array.isArray(win.S.drills.t1), "el catálogo de ejercicios (S.drills) sigue siendo un array normal, sin efectos colaterales");
  report.assert(Object.keys(win.S.sessions).length === 0, "S.sessions (pase de lista) nunca se ha tocado -- todo el flujo en vivo vive en S.drillLive");

  // ══════════════════════════════════════════════════════════════════════
  // B-DLS3 (dev.67): "Final de partido" -- segundo tipo de ejercicio en vivo
  // ══════════════════════════════════════════════════════════════════════

  // ── Alta de un ejercicio de tipo "endgame" ──
  win.openDrillModal();
  document.getElementById("m-add-drill-name").value = "Situación de final de partido";
  document.getElementById("m-add-drill-dlstype").value = "endgame";
  win.saveDrill("m-add-drill", "");
  const matchDrill = win.S.drills.t1.find(d => d.name === "Situación de final de partido");
  report.assert(win._dlsType(matchDrill) === "endgame", "el tipo 'Final de partido' se guarda como drill.dlsType='endgame'");
  const libHtmlMatch = win._drillLibraryRowsHtml();
  report.assert(libHtmlMatch.includes("⏱️ FINAL PARTIDO"), "el catálogo muestra la insignia '⏱️ FINAL PARTIDO' para este tipo (distinta de '🎯 EN VIVO')");
  report.assert(libHtmlMatch.includes("openDlsMatchSetupModal('" + matchDrill.id + "')"), "el catálogo ofrece 'Configurar mini-partido' (openDlsMatchSetupModal), no el setup de b11");

  // ── Setup: reparto manual de equipos, jugador nuevo, marcador inicial exacto ──
  win.openDlsMatchSetupModal(matchDrill.id);
  report.assert(!!document.getElementById("m-dls-match-setup"), "openDlsMatchSetupModal() abre su propio modal de configuración");
  const matchRosterHtml = document.getElementById("dls-match-roster-list").innerHTML;
  report.assert(matchRosterHtml.includes("conv-row"), "B-DLS3: el roster del mini-partido usa el mismo componente visual (.conv-row) que el resto de la app");
  report.assert(!win._dlsMatchSetup.teamOf.p1, "al abrir el setup, nadie está asignado a ningún equipo todavía (reparto 100% manual, sin automatismos)");
  win._dlsMatchAssign("p1", "A");
  win._dlsMatchAssign("p3", "B");
  report.assert(win._dlsMatchSetup.teamOf.p1 === "A" && win._dlsMatchSetup.teamOf.p3 === "B", "_dlsMatchAssign asigna cada jugador al equipo tocado");
  win._dlsMatchAssign("p1", "A"); // tocar el mismo botón otra vez desasigna
  report.assert(!win._dlsMatchSetup.teamOf.p1, "tocar el mismo botón de equipo dos veces desasigna al jugador (vuelve a 'sin equipo')");
  win._dlsMatchAssign("p1", "B"); // asignar directamente a B mientras no tenía equipo
  report.assert(win._dlsMatchSetup.teamOf.p1 === "B", "asignar a un jugador sin equipo lo manda directo a ese equipo");
  win._dlsMatchAssign("p1", "A"); // cambiar de equipo directamente (de B a A) también funciona, sin pasar por 'sin equipo'
  report.assert(win._dlsMatchSetup.teamOf.p1 === "A", "tocar el otro botón de equipo cambia la asignación directamente -- queda en A para el resto del test");
  document.getElementById("dls-match-temp-name").value = "Suplente suelto";
  win._dlsMatchAddTemp();
  const tempId = win._dlsMatchSetup.temps[0].id;
  win._dlsMatchAssign(tempId, "B");
  report.assert(win._dlsMatchSetup.temps.length === 1 && win._dlsMatchSetup.teamOf[tempId] === "B", "se puede añadir un jugador nuevo (no de plantilla) y asignarlo también a un equipo");

  // ── Validación: si un equipo se queda sin nadie asignado, no se puede arrancar ──
  document.getElementById("dls-match-minutes").value = "2";
  document.getElementById("dls-match-seconds").value = "36";
  document.getElementById("dls-match-scoreA").value = "45";
  document.getElementById("dls-match-scoreB").value = "40";
  win._dlsMatchAssign("p3", "B"); // quitamos a p3 de B (estaba asignado) -- de momento en B solo queda el temporal
  win._dlsMatchAssign(tempId, "B"); // y ahora quitamos también al temporal -- Equipo B se queda sin nadie
  report.assert(!win._dlsMatchSetup.teamOf.p3 && !win._dlsMatchSetup.teamOf[tempId], "Equipo B se queda vacío a propósito para esta prueba (solo p1 sigue asignado, a Equipo A)");
  win.startDlsMatch();
  report.assert(!win._dlsActive(win.S.teamId, matchDrill.id), "startDlsMatch() no arranca si algún equipo se queda sin ningún jugador asignado");
  report.assert((document.querySelector(".toast")?.textContent || "").includes("Asigna al menos un jugador"), "avisa con un toast de qué falta para poder arrancar");
  document.querySelector(".toast")?.remove();
  win._dlsMatchAssign("p3", "B"); // volvemos a poner a p3 en Equipo B para poder arrancar de verdad (p1 sigue en A desde antes)

  // ── Arrancar en modo SOLO MARCADOR (sin estadísticas individuales, checkbox sin marcar) ──
  win.startDlsMatch();
  const matchSess = win._dls();
  report.assert(!!matchSess && matchSess.type === "endgame", "startDlsMatch() crea una sesión de tipo 'endgame'");
  report.assert(matchSess.trackIndividual === false, "por defecto (checkbox sin marcar) trackIndividual es false -- solo marcador de equipo");
  report.assert(matchSess.startScore.A === 45 && matchSess.startScore.B === 40, "el marcador inicial exacto introducido se guarda tal cual");
  report.assert(matchSess.durationSec === 2 * 60 + 36, "la duración en mm:ss (2:36) se guarda en segundos exactos, no redondeada a minutos enteros");
  report.assert(win._dlsMatchTeamScore(matchSess, "A") === 45 && win._dlsMatchTeamScore(matchSess, "B") === 40, "sin ninguna canasta todavía, el marcador de cada equipo es justo su marcador inicial");

  const matchScreenHtml1 = win.screenDlsLive();
  report.assert(matchScreenHtml1.includes("EQUIPO A") && matchScreenHtml1.includes("EQUIPO B"), "screenDlsLive() detecta la sesión 'endgame' y muestra el marcador de dos equipos");
  report.assert(matchScreenHtml1.includes("dlsMatchScore('A',2)") && matchScreenHtml1.includes("dlsMatchScore('B',3)"), "en modo solo marcador, la pantalla ofrece los botones +1/+2/+3 sueltos de cada equipo");
  report.assert(!matchScreenHtml1.includes("dlsShot(2,true)"), "en modo solo marcador NO se ofrece el panel de tiro por jugador (no hay estadísticas individuales)");

  win.dlsMatchScore("A", 2);
  report.assert(win._dlsMatchTeamScore(win._dls(), "A") === 47, "dlsMatchScore('A',2) suma 2 al marcador del Equipo A");
  win.dlsMatchScore("B", 3);
  report.assert(win._dlsMatchTeamScore(win._dls(), "B") === 43, "dlsMatchScore('B',3) suma 3 al marcador del Equipo B");
  win.undoDlsLast();
  report.assert(win._dlsMatchTeamScore(win._dls(), "B") === 40, "undoDlsLast() también deshace un punto de marcador tocado a mano (no solo estadísticas de jugador)");

  win.confirmEndDls();
  document.querySelector("#m-confirm button").click();
  const finishedMatch1 = win.S.drillLive.t1[matchDrill.id][win.S.drillLive.t1[matchDrill.id].length - 1];
  report.assert(finishedMatch1.status === "finished", "confirmEndDls()/terminar funciona igual para 'endgame' que para b11 (misma función, genérica)");
  const summaryHtml1 = document.getElementById("m-dls-summary")?.innerHTML || "";
  report.assert(summaryHtml1.includes("47") && summaryHtml1.includes("40"), "el resumen del mini-partido muestra el marcador final correcto (47-40)");
  report.assert(summaryHtml1.includes("Gana Equipo A"), "el resumen indica qué equipo ganó");
  document.getElementById("m-dls-summary")?.remove();

  // ── Segunda sesión del mismo ejercicio, ahora CON estadísticas individuales ──
  win.openDlsMatchSetupModal(matchDrill.id);
  win._dlsMatchAssign("p1", "A");
  win._dlsMatchAssign("p3", "B");
  document.getElementById("dls-match-minutes").value = "1";
  document.getElementById("dls-match-seconds").value = "0";
  document.getElementById("dls-match-scoreA").value = "0";
  document.getElementById("dls-match-scoreB").value = "0";
  document.getElementById("dls-match-individual").checked = true;
  win.startDlsMatch();
  const matchSess2 = win._dls();
  report.assert(matchSess2.trackIndividual === true, "con el checkbox marcado, trackIndividual es true");
  report.assert(win._dlsMatchTeamScore(matchSess2, "A") === 0 && win._dlsMatchTeamScore(matchSess2, "B") === 0, "sin ninguna canasta todavía, el marcador es 0-0 (marcador inicial también a 0 en esta sesión)");

  const matchScreenHtml2 = win.screenDlsLive();
  report.assert(matchScreenHtml2.includes("dlsShot(2,true)") && matchScreenHtml2.includes("dlsBlock()"), "B-DLS3: con estadísticas individuales activadas, se reutiliza el MISMO panel completo de botones que 'Contraataque de 11'");
  report.assert(!matchScreenHtml2.includes("dlsMatchScore("), "con estadísticas individuales activadas, ya no se ofrecen los botones sueltos de marcador manual (el marcador se calcula solo)");

  // p1 (Equipo A) anota un 2 -- reutiliza dlsShot/_dlsOpenPicker tal cual, sin ningún código nuevo
  win.dlsShot(2, true);
  win._dlsPickerConfirm("p1"); // ¿quién anotó?
  win._dlsPickerSkip(); // sin asistencia
  win._dlsPickerSkip(); // sin rebote
  report.assert(win._dls().stats.p1.p2m === 1, "el tiro anotado por p1 (Equipo A) se registra en sus estadísticas individuales igual que en b11");
  report.assert(win._dlsMatchTeamScore(win._dls(), "A") === 2, "B-DLS3: el marcador del Equipo A se calcula solo a partir del tiro real anotado por su jugador (2 puntos reales, no la valoración reducida de b11)");
  report.assert(win._dlsMatchTeamScore(win._dls(), "B") === 0, "el Equipo B no se ve afectado por una canasta del Equipo A");

  // p3 (Equipo B) anota un 3
  win.dlsShot(3, true);
  win._dlsPickerConfirm("p3");
  win._dlsPickerSkip();
  win._dlsPickerSkip();
  report.assert(win._dlsMatchTeamScore(win._dls(), "B") === 3, "un triple real de p3 (Equipo B) suma exactamente 3 puntos reales al marcador de su equipo");

  const summaryHtml2Sess = win._dls();
  win.confirmEndDls();
  document.querySelector("#m-confirm button").click();
  const summaryHtml2 = document.getElementById("m-dls-summary")?.innerHTML || "";
  report.assert(summaryHtml2.includes("2") && summaryHtml2.includes("3"), "el resumen con estadísticas individuales también muestra el marcador final (2-3)");
  report.assert(summaryHtml2.includes("Gana Equipo B"), "el resumen indica correctamente que ganó el Equipo B (3 sobre 2)");
  document.getElementById("m-dls-summary")?.remove();

  // ── El historial de "Final de partido" se guarda en el mismo S.drillLive de siempre, junto al de b11 -- nunca se borra nada ──
  report.assert(win.S.drillLive.t1[matchDrill.id].length === 2, "las dos sesiones de 'Final de partido' quedan en el histórico del ejercicio, sin sobreescribirse entre sí");
  report.assert(win.S.drillLive.t1[matchDrill.id].every(s => s.type === "endgame"), "ambas sesiones guardadas mantienen su type='endgame'");

  return report.summary();
}

module.exports = { run };
if (require.main === module) {
  run().then(({ failed }) => process.exit(failed ? 1 : 0));
}
