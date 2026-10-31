"use strict";
// v3.0.0-dev.98 · B-HOY3: Mario -- "en lo de el día de hoy en esa pestaña
// poder ir para adelante y hacias atras, sobretodo me importa hacia atras
// para comprobar que todos los entrenaientos han sido pasado lista. [...]
// lo importante es hoy y tiene que aparecer siempre lo primero pero que
// puedas ir dias atraws y no se si conviene días adelante". Tras preguntar
// a Mario el límite hacia adelante, confirmó "Topar en hoy (recomendado)":
// nunca se puede navegar a un día futuro real.
//
// Mecanismo: S.hoyDate guarda el día que se está viendo (null = hoy, valor
// por defecto). _hoyShiftDay(delta) lo desplaza, topando en el día real de
// hoy hacia adelante; _hoyGoToday() lo resetea a null; navRoot('hoy') (el
// icono "Hoy" de la barra inferior) también lo resetea a null siempre --
// "hoy" es el sitio por defecto, nunca donde te quedaste navegando. navTo/
// navBack lo incluyen en la pila de navegación como cualquier otro campo de
// estado de pantalla.
const { loadApp, newReporter } = require("./harness");

async function run() {
  const report = newReporter("hoy_day_navigation");
  const win = await loadApp();
  const assert = (cond, msg) => report.assert(cond, msg);

  const today = win.td();
  const yesterday = win._addDaysISO(today, -1);
  const twoDaysAgo = win._addDaysISO(today, -2);

  const baseTeam = (id, name, ti) => ({ id, name, color: "#111", schedule: { [ti]: "10:00" } });

  // ── Fixture común: un equipo con sesión pasada AYER (marcada) y nada hoy ──
  function setupFixture() {
    const tiYesterday = win._weekdayIdxForDate(yesterday);
    const tiToday = win.todayIdx();
    win.S.teams = [
      baseTeam("tY", "Equipo Ayer", tiYesterday),
      baseTeam("tT", "Equipo Hoy", tiToday)
    ];
    win.S.players = {
      tY: [{ id: "p1", name: "Jugadora Ayer", number: 4 }],
      tT: [{ id: "p2", name: "Jugadora Hoy", number: 5 }]
    };
    win.S.matches = {};
    win.S.sessions = { ["tY_" + yesterday]: { p1: "present" } }; // ayer YA pasada
    win.S.screen = "hoy";
    win.S.hoyDate = null;
    win.S.navStack = [];
  }

  // ── Test A: por defecto se ve HOY, no un día navegado ──
  setupFixture();
  win.render();
  let html = win.document.getElementById("root").innerHTML;
  assert(html.includes("Viendo hoy"), "por defecto (S.hoyDate null) la fila de navegación dice 'Viendo hoy'");
  assert(!html.includes("Equipo Ayer"), "por defecto no se ve el entrenamiento de AYER (solo el de hoy, que ese día de la semana no coincide)");

  // ── Test B: _hoyShiftDay(-1) navega a ayer y muestra su entrenamiento ──
  win._hoyShiftDay(-1);
  assert(win.S.hoyDate === yesterday, "_hoyShiftDay(-1) deja S.hoyDate en el día de ayer");
  html = win.document.getElementById("root").innerHTML;
  assert(html.includes("Equipo Ayer"), "viendo ayer, aparece el entrenamiento programado ese día de la semana");
  assert(html.includes("✓ Pasada"), "y se ve correctamente como 'Pasada' (ya se le había pasado lista)");
  assert(!html.includes("Equipo Hoy"), "viendo ayer, el entrenamiento programado solo para HOY no aparece");

  // ── Test C: se puede seguir retrocediendo sin límite (dos días atrás) ──
  win._hoyShiftDay(-1);
  assert(win.S.hoyDate === twoDaysAgo, "_hoyShiftDay(-1) otra vez retrocede un día más, sin límite hacia atrás");

  // ── Test D: desde ahí, _hoyShiftDay(1) avanza un día (vuelve a ayer) ──
  win._hoyShiftDay(1);
  assert(win.S.hoyDate === yesterday, "_hoyShiftDay(1) avanza un día, volviendo a ayer");

  // ── Test E: tope hacia adelante -- avanzar desde ayer llega a HOY, no más allá ──
  win._hoyShiftDay(1);
  assert(win.S.hoyDate === null, "al llegar a HOY, S.hoyDate vuelve a null (no se guarda como fecha explícita)");
  html = win.document.getElementById("root").innerHTML;
  assert(html.includes("Viendo hoy"), "tras avanzar hasta hoy, la fila de navegación vuelve a decir 'Viendo hoy'");

  // ── Test F: Mario confirmó 'Topar en hoy' -- no se puede ir a un día futuro real ──
  win._hoyShiftDay(1);
  assert(win.S.hoyDate === null, "intentar avanzar MÁS ALLÁ de hoy no mueve nada -- se queda en hoy (tope confirmado por Mario)");
  win._hoyShiftDay(1);
  win._hoyShiftDay(1);
  assert(win.S.hoyDate === null, "repetir el intento de avanzar varias veces seguidas tampoco traspasa el tope");

  // ── Test G: el botón › aparece deshabilitado (visualmente) viendo hoy, y habilitado en un día pasado ──
  html = win.document.getElementById("root").innerHTML;
  assert(/_hoyShiftDay\(1\)" aria-label="Día siguiente" disabled/.test(html), "viendo hoy, el botón › lleva el atributo disabled");
  win._hoyShiftDay(-1);
  html = win.document.getElementById("root").innerHTML;
  assert(!/_hoyShiftDay\(1\)" aria-label="Día siguiente" disabled/.test(html), "viendo un día pasado, el botón › ya no lleva disabled");
  assert(html.includes(">Hoy</button>"), "viendo un día distinto de hoy, aparece el botón de acceso directo 'Hoy'");

  // ── Test H: _hoyGoToday() resetea directamente a hoy desde cualquier punto ──
  win._hoyShiftDay(-1); // dos días atrás
  win._hoyGoToday();
  assert(win.S.hoyDate === null, "_hoyGoToday() resetea S.hoyDate a null sin importar cuánto se había retrocedido");

  // ── Test I: el botón 'Pasar lista'/'Editar lista' de un día pasado actúa SOBRE ESE DÍA, no sobre hoy real ──
  // (bug que el feature debía evitar: antes el botón llevaba siempre date:td())
  win._hoyShiftDay(-1); // ayer
  html = win.document.getElementById("root").innerHTML;
  assert(html.includes(`navTo('att',{teamId:'tY',date:'${yesterday}'})`), "el botón de pasar/editar lista de 'Equipo Ayer' navega con la fecha de AYER, no la de hoy");
  assert(!html.includes(`navTo('att',{teamId:'tY',date:'${today}'})`), "y en ningún caso con la fecha de hoy real");
  // el botón de compartir (📤) también, solo aparece cuando done=true (Equipo Ayer ya tiene lista pasada)
  assert(html.includes(`navTo('share',{date:'${yesterday}'})`), "el botón de compartir de un día pasado comparte la fecha de ESE día, no la de hoy");

  // ── Test J: el título/fecha del header refleja el día navegado, no siempre hoy ──
  assert(!html.includes("Viendo hoy"), "viendo un día pasado, ya no dice 'Viendo hoy' en la fila de navegación");

  // ── Test K: el aviso de 'próximo entrenamiento' / 'toca pasar lista ahora' NO aparece viendo un día que no es hoy ──
  setupFixture();
  // 'Equipo Hoy' con hora ya pasada (00:00) y sin lista -> generaría la barra urgente si isToday
  win.S.teams = [{ id: "tT", name: "Equipo Hoy", color: "#111", schedule: { [win.todayIdx()]: "00:00" } }];
  win.S.players = { tT: [{ id: "p2", name: "Jugadora Hoy", number: 5 }] };
  win.S.sessions = {};
  win.S.hoyDate = null;
  win.render();
  html = win.document.getElementById("root").innerHTML;
  assert(html.includes("Toca pasar lista ahora"), "control: viendo HOY, con hora ya pasada y sin lista, sí sale la barra urgente");
  win._hoyShiftDay(-1); // ahora viendo ayer
  html = win.document.getElementById("root").innerHTML;
  assert(!html.includes("Toca pasar lista ahora") && !html.includes("Próximo entrenamiento"), "viendo un día que no es hoy, el aviso de 'próximo entrenamiento' no aparece (no tiene sentido fuera de isToday)");

  // ── Test L: el banner de cumpleaños de hoy NO aparece viendo un día que no es hoy ──
  setupFixture();
  win.S.players.tT = [{ id: "p2", name: "Jugadora Cumple", number: 5, birthDate: `2010-${today.slice(5,7)}-${today.slice(8,10)}` }];
  win.S.hoyDate = null;
  win.render();
  html = win.document.getElementById("root").innerHTML;
  assert(html.includes("Jugadora Cumple") && html.includes("🎂"), "control: viendo hoy, el banner de cumpleaños de hoy real del jugador sí aparece");
  win._hoyShiftDay(-1);
  html = win.document.getElementById("root").innerHTML;
  assert(!html.includes("Jugadora Cumple"), "viendo un día pasado, el banner de cumpleaños de 'hoy' no aparece (aunque hoy real sí hubiera uno)");

  // ── Test M: el botón '+' (actividad sorpresa) NO aparece viendo un día que no es hoy ──
  setupFixture();
  win.S.hoyDate = null;
  win.render();
  html = win.document.getElementById("root").innerHTML;
  assert(html.includes("openHoyAddSheet()"), "control: viendo hoy, el botón '+' de actividad sorpresa está presente");
  win._hoyShiftDay(-1);
  html = win.document.getElementById("root").innerHTML;
  assert(!html.includes("openHoyAddSheet()"), "viendo un día que no es hoy, el botón '+' de actividad sorpresa desaparece (su copy dice explícitamente 'hoy')");

  // ── Test N: navRoot('hoy') (icono 'Hoy' de la barra inferior) siempre resetea S.hoyDate a null ──
  setupFixture();
  win.S.hoyDate = yesterday;
  win.navRoot("hoy");
  assert(win.S.hoyDate === null, "navRoot('hoy') resetea S.hoyDate a null aunque se hubiera quedado navegando por otro día");
  assert(win.S.screen === "hoy", "navRoot('hoy') lleva a la pantalla 'hoy' como siempre");

  // ── Test Ñ: navTo/navBack conservan y restauran S.hoyDate correctamente ──
  setupFixture();
  win.S.hoyDate = null;
  win.S.screen = "hoy";
  win.S.navStack = [];
  win._hoyShiftDay(-1); // viendo ayer
  assert(win.S.hoyDate === yesterday, "preparación: viendo ayer antes de navegar a otra pantalla");
  win.navTo("equipos");
  assert(win.S.screen === "equipos", "navTo cambia de pantalla con normalidad");
  win.navBack();
  assert(win.S.screen === "hoy", "navBack() vuelve a la pantalla 'hoy'");
  assert(win.S.hoyDate === yesterday, "navBack() restaura el día que se estaba viendo (ayer), no resetea a hoy");

  return report.summary();
}

module.exports = { run };
