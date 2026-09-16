"use strict";
// v3.0.0-dev.59 · B-GUEST5: rediseño del picker de "jugador puntual".
// Sustituye a la v de dev.58 (chips + checkboxes HTML) por un único
// mecanismo de selección múltiple (.conv-row/.conv-cb/.pnum, igual que la
// convocatoria de partido) compartido por "Más frecuentes" y "Categoría
// inferior", con un solo botón "Añadir seleccionados" al final. Cubre:
//  - _lowerCategoryTeams ahora filtra también por GÉNERO del equipo.
//  - el nuevo flujo unificado _guestToggle/_guestPickerCommit.
//  - el alta manual sigue existiendo pero colapsada (_guestToggleManualOpen).
//  - dedup por NOMBRE normalizado, tanto al traer de categoría inferior
//    como al dar de alta manualmente (unifica estadísticas).
//  - el nuevo buscador/fusionador de puntuales duplicados ya existentes
//    (_findDuplicateGuestGroups/_mergeGuestGroup), incluyendo el remapeo de
//    ids en sesiones (modo entreno) y en partidos/eventos/stats en vivo
//    (modo partido), sin perder datos.
const { loadApp, newReporter } = require("./harness.js");

async function run() {
  const win = await loadApp();
  const report = newReporter("guest_picker");
  const { document } = win;

  win.S.teams = [
    { id: "cadete", name: "Cadete Masculino", category: "Cadete", gender: "Masculino", coaches: [] },
    { id: "cadeteF", name: "Cadete Femenino", category: "Cadete", gender: "Femenino", coaches: [] },
    { id: "infA", name: "Infantil A", category: "Infantil", gender: "Masculino", coaches: [] },
    { id: "infB", name: "Infantil B", category: "Infantil", gender: "Masculino", coaches: [] },
    { id: "infFem", name: "Infantil Femenino", category: "Infantil", gender: "Femenino", coaches: [] },
    { id: "alevin", name: "Alevín", category: "Alevín", gender: "Masculino", coaches: [] }
  ];
  win.S.players = {
    cadete: [{ id: "c1", name: "Cadete Titular", number: 4, addedAt: "2026-01-01" }],
    cadeteF: [{ id: "cf1", name: "Cadete Fem Titular", number: 4, addedAt: "2026-01-01" }],
    infA: [
      { id: "ia1", name: "Infantil A Uno", number: 7 },
      { id: "ia2", name: "Infantil A Dos", number: 8 }
    ],
    infB: [{ id: "ib1", name: "Infantil B Uno", number: 5 }],
    infFem: [{ id: "if1", name: "Infantil Fem Uno", number: 6 }],
    alevin: [{ id: "al1", name: "Alevín Uno", number: 2 }]
  };
  win.S.sessions = {};
  win.S.matches = { cadete: [], cadeteF: [] };
  win.S.events = {};
  win.S.teamId = "cadete";
  win.S.date = "2026-09-01";

  // ── _lowerCategoryTeams: Cadete Masculino -> solo Infantil MASCULINO (A y B), nunca el Femenino ──
  const lowerOfCadete = win._lowerCategoryTeams("cadete").map(t => t.id).sort();
  report.assert(lowerOfCadete.length === 2 && lowerOfCadete.includes("infA") && lowerOfCadete.includes("infB"), "_lowerCategoryTeams devuelve los equipos de Infantil del MISMO género (A y B), no solo uno");
  report.assert(!lowerOfCadete.includes("infFem"), "_lowerCategoryTeams NO ofrece Infantil Femenino a un equipo masculino (B-GUEST5: filtro por género)");
  report.assert(!lowerOfCadete.includes("alevin"), "_lowerCategoryTeams no salta a Alevín cuando ya hay equipos en la categoría justo debajo (Infantil)");

  // ── Simétrico para el equipo femenino ──
  const lowerOfCadeteF = win._lowerCategoryTeams("cadeteF").map(t => t.id);
  report.assert(lowerOfCadeteF.length === 1 && lowerOfCadeteF[0] === "infFem", "_lowerCategoryTeams de un equipo FEMENINO solo ofrece el Infantil femenino, nunca el masculino");

  // ── Retrocompatibilidad: un equipo SIN género definido (gender:"") no filtra por género ──
  win.S.teams.push({ id: "cadeteSinGenero", name: "Cadete C", category: "Cadete", gender: "", coaches: [] });
  const lowerSinGenero = win._lowerCategoryTeams("cadeteSinGenero").map(t => t.id).sort();
  report.assert(lowerSinGenero.length === 3 && lowerSinGenero.includes("infA") && lowerSinGenero.includes("infB") && lowerSinGenero.includes("infFem"), "un equipo sin género definido (equipos antiguos sin editar) sigue viendo TODA la categoría inferior, sin filtrar -- retrocompatible");
  win.S.teams = win.S.teams.filter(t => t.id !== "cadeteSinGenero");

  // ── Fallback: si la categoría justo debajo no existe en el club, baja hasta encontrar una que sí (respetando género) ──
  win.S.teams.push({ id: "junior", name: "Junior", category: "Junior", gender: "Masculino", coaches: [] });
  win.S.players.junior = [{ id: "j1", name: "Junior Uno", number: 9 }];
  const lowerOfJunior = win._lowerCategoryTeams("junior").map(t => t.id);
  report.assert(lowerOfJunior.includes("cadete") && !lowerOfJunior.includes("cadeteF"), "_lowerCategoryTeams de Junior (masculino) encuentra Cadete masculino (categoría justo debajo, mismo género)");
  win.S.teams = win.S.teams.filter(t => t.id !== "junior");
  delete win.S.players.junior;

  // ── El propio equipo no aparece nunca como su categoría inferior, y Escuela no tiene inferior ──
  win.S.teams.push({ id: "escuela", name: "Escuela", category: "Escuela", gender: "Masculino", coaches: [] });
  report.assert(win._lowerCategoryTeams("escuela").length === 0, "Escuela (categoría más baja) no ofrece categoría inferior");
  win.S.teams = win.S.teams.filter(t => t.id !== "escuela");

  // ── openGuestPlayerModal (mode:"att"): estructura del nuevo picker unificado ──
  win.openGuestPlayerModal({ mode: "att" });
  report.assert(!!document.getElementById("m-guest-player"), "openGuestPlayerModal abre el modal");
  report.assert(!!document.getElementById("guest-picker-body"), "el modal tiene el contenedor unificado guest-picker-body");
  let bodyHtml = document.getElementById("guest-picker-body").innerHTML;
  const lowerNames0 = win._guestPicker.lowerRows.map(r => r.name);
  report.assert(lowerNames0.includes("Infantil A Uno") && lowerNames0.includes("Infantil B Uno"), "'Categoría inferior' lista jugadores reales de Infantil A e Infantil B (mismo género)");
  report.assert(!lowerNames0.includes("Infantil Fem Uno") && !lowerNames0.includes("Alevín Uno"), "'Categoría inferior' no incluye Infantil Femenino (otro género) ni Alevín (no es la inmediatamente inferior)");
  report.assert(!bodyHtml.includes("Más frecuentes"), "sin puntuales previos usados, 'Más frecuentes' no se muestra");
  report.assert(win._guestPicker.lowerOpen === false, "'Categoría inferior' arranca colapsada");
  // El formulario manual sigue existiendo pero colapsado (de segundo plano).
  report.assert(!document.getElementById("gp-name"), "con candidatos disponibles, el formulario manual arranca COLAPSADO (no se ve gp-name todavía)");
  report.assert(bodyHtml.includes("Es alguien nuevo"), "el toggle para dar de alta manualmente ('Es alguien nuevo') sigue presente, solo que de segundo plano");

  // ── Abrir la categoría inferior y seleccionar 2 con el selector tipo convocatoria ──
  win._guestToggleLowerOpen();
  report.assert(win._guestPicker.lowerOpen === true, "_guestToggleLowerOpen despliega la sección");
  win._guestToggle("lower", "ia1");
  win._guestToggle("lower", "ib1");
  report.assert(win._guestPicker.selectedLower.size === 2, "_guestToggle acumula selección múltiple en 'Categoría inferior'");
  bodyHtml = document.getElementById("guest-picker-body").innerHTML;
  report.assert(bodyHtml.includes("conv-cb on"), "las filas seleccionadas usan el componente visual .conv-cb.on (el mismo check naranja de la convocatoria de partido), no checkboxes HTML sosos");
  report.assert(/Añadir seleccionados[^0-9]*\(2\)/.test(bodyHtml), "el botón único de confirmación muestra el total seleccionado (2)");

  win._guestPickerCommit();
  report.assert(!document.getElementById("m-guest-player"), "_guestPickerCommit cierra el modal");
  const brought = win.pl("cadete").filter(p => p.guest);
  report.assert(brought.length === 2, "se crean 2 puntuales nuevos, uno por cada seleccionado");
  const broughtIA1 = brought.find(p => p.name === "Infantil A Uno");
  report.assert(!!broughtIA1 && broughtIA1.number === 7 && broughtIA1.attOnly === true && broughtIA1.guestNote === "Infantil A", "el puntual traído copia nombre/dorsal y guarda de qué equipo viene, como puntual de ENTRENO");
  report.assert(broughtIA1.sourceTeamId === "infA" && broughtIA1.sourcePlayerId === "ia1", "guarda de dónde viene (copia independiente, no un enlace en vivo)");
  report.assert(win.S.players.infA.find(p => p.id === "ia1").number === 7, "el jugador ORIGINAL de Infantil A no se toca ni se borra");
  report.assert(Array.isArray(broughtIA1.attDates) && broughtIA1.attDates.includes("2026-09-01"), "el puntual traído arranca con attDates incluyendo el día de hoy");
  const sessKey = win.sk("cadete", "2026-09-01");
  report.assert(win.S.sessions[sessKey][broughtIA1.id] === "present", "el puntual traído queda marcado presente en la sesión de hoy");

  // ── Ese mismo jugador ya no vuelve a ofrecerse en "Categoría inferior" ──
  win.openGuestPlayerModal({ mode: "att" });
  win._guestToggleLowerOpen();
  const bodyAfter = document.getElementById("guest-picker-body").innerHTML;
  report.assert(!bodyAfter.includes("Infantil A Uno") || bodyAfter.indexOf("Más frecuentes") < 0, "un jugador ya traído no se vuelve a ofrecer en 'Categoría inferior' (evita duplicados por origen)");
  report.assert(win._guestPicker.lowerRows.some(r => r.name === "Infantil A Dos"), "el resto de Infantil A sigue disponible para traer");
  // Pero como ya está activo HOY, tampoco sale todavía en "Más frecuentes" (evita re-añadir dos veces el mismo día).
  report.assert(win._guestPicker.frequent.length === 0, "un puntual ya activo hoy no se ofrece en 'Más frecuentes' hoy mismo");
  document.getElementById("m-guest-player")?.remove();

  // ── Al día siguiente, sí aparece en "Más frecuentes" (reutilizable, sin duplicar) ──
  win.S.date = "2026-09-08";
  win.openGuestPlayerModal({ mode: "att" });
  report.assert(win._guestPicker.frequent.some(p => p.name === "Infantil A Uno"), "en un entrenamiento posterior, el puntual ya usado aparece en 'Más frecuentes'");
  win._guestToggle("freq", broughtIA1.id);
  win._guestPickerCommit();
  report.assert(win.pl("cadete").filter(p => p.name === "Infantil A Uno").length === 1, "reutilizar desde 'Más frecuentes' NO crea una segunda entrada duplicada");
  report.assert(broughtIA1.attDates.includes("2026-09-01") && broughtIA1.attDates.includes("2026-09-08"), "attDates acumula ambos días de uso sin perder el anterior");
  report.assert(win._isPlayerActiveOn(broughtIA1, "2026-09-01", []) === true && win._isPlayerActiveOn(broughtIA1, "2026-09-08", []) === true, "_isPlayerActiveOn es true en AMBOS días de uso");
  report.assert(win._isPlayerActiveOn(broughtIA1, "2026-09-15", []) === false, "_isPlayerActiveOn sigue siendo false un día en que no se usó");
  const sessKey2 = win.sk("cadete", "2026-09-08");
  report.assert(win.S.sessions[sessKey2][broughtIA1.id] === "present", "reutilizar desde 'Más frecuentes' marca presente al puntual también en la nueva sesión");

  // ── Retrocompatibilidad: un puntual antiguo sin attDates (solo addedAt) sigue funcionando igual que siempre ──
  const legacyGuest = { id: "legacy1", name: "Legacy Puntual", guest: true, attOnly: true, addedAt: "2026-08-01" };
  report.assert(win._isPlayerActiveOn(legacyGuest, "2026-08-01", []) === true, "un puntual legacy (sin attDates) sigue activo en su addedAt de siempre");
  report.assert(win._isPlayerActiveOn(legacyGuest, "2026-08-02", []) === false, "un puntual legacy sigue sin contar fuera de su addedAt");

  // ── Orden de 'Más frecuentes' por frecuencia de uso (el más repetido primero) ──
  win.S.date = "2026-09-15";
  win.openGuestPlayerModal({ mode: "att" });
  win._guestToggleLowerOpen();
  win._guestToggle("lower", "ia2");
  win._guestPickerCommit(); // Infantil A Dos usado 1 vez
  win.S.date = "2026-09-22";
  win.openGuestPlayerModal({ mode: "att" });
  document.getElementById("m-guest-player")?.remove();
  win.S.date = "2026-09-29";
  win.openGuestPlayerModal({ mode: "att" });
  const freqOrder = win._guestPicker.frequent.map(p => p.name);
  const posIA1 = freqOrder.indexOf("Infantil A Uno"); // usado 2 veces
  const posIA2 = freqOrder.indexOf("Infantil A Dos"); // usado 1 vez
  report.assert(posIA1 >= 0 && posIA2 >= 0 && posIA1 < posIA2, "'Más frecuentes' ordena por frecuencia de uso -- el puntual usado más veces sale primero");
  document.getElementById("m-guest-player")?.remove();

  // ── El formulario manual de "Es alguien nuevo" sigue creando puntuales normales, ahora también con attDates ──
  win.openGuestPlayerModal({ mode: "att" });
  report.assert(!document.getElementById("gp-name"), "el formulario manual arranca colapsado también aquí (hay candidatos disponibles)");
  win._guestToggleManualOpen();
  report.assert(!!document.getElementById("gp-name") && !!document.getElementById("gp-num") && !!document.getElementById("gp-note"), "_guestToggleManualOpen despliega el formulario manual de siempre (nombre/dorsal/nota) -- nada desaparece");
  document.getElementById("gp-name").value = "Manual Nuevo";
  win._guestPlayerCommit("att");
  const manual = win.pl("cadete").find(p => p.name === "Manual Nuevo");
  report.assert(!!manual && manual.attOnly === true && Array.isArray(manual.attDates) && manual.attDates.includes("2026-09-29"), "el alta manual sigue funcionando y arranca attDates con su día de alta (reutilizable a partir de ahora)");

  // ── Sin ningún candidato disponible, el formulario manual se muestra directamente (no hace falta desplegar nada) ──
  const savedInfA = win.S.teams.find(t => t.id === "infA");
  const savedInfB = win.S.teams.find(t => t.id === "infB");
  const savedAlevin = win.S.teams.find(t => t.id === "alevin");
  const savedPlayersInfA = win.S.players.infA;
  const savedPlayersInfB = win.S.players.infB;
  const savedPlayersAlevin = win.S.players.alevin;
  win.S.teams = win.S.teams.filter(t => !["infA", "infB", "alevin"].includes(t.id));
  delete win.S.players.infA;
  delete win.S.players.infB;
  delete win.S.players.alevin;
  win.S.date = "2026-10-06"; // día sin ningún puntual previo activo todavía
  win.S.players.cadete = win.S.players.cadete.filter(p => !p.guest);
  win.openGuestPlayerModal({ mode: "att" });
  report.assert(!!document.getElementById("gp-name"), "sin 'Más frecuentes' ni 'Categoría inferior' disponibles, el formulario manual se muestra directo, sin toggle que desplegar");
  document.getElementById("m-guest-player")?.remove();

  // Restaurar Infantil A/B y Alevín tal cual estaban para el resto de pruebas.
  win.S.teams.push(savedInfA, savedInfB, savedAlevin);
  win.S.players.infA = savedPlayersInfA;
  win.S.players.infB = savedPlayersInfB;
  win.S.players.alevin = savedPlayersAlevin;

  // ── Dedup por NOMBRE al traer de categoría inferior: si ya existe un puntual con ese nombre en este equipo/modo, se reutiliza ──
  win.S.players.infA.push({ id: "ia1b", name: "Homónimo Repetido", number: 11 });
  win.S.players.cadete.push({ id: "prevHom", name: "Homónimo Repetido", guest: true, attOnly: true, addedAt: "2026-09-01", attDates: ["2026-09-01"], number: null });
  win.openGuestPlayerModal({ mode: "att" });
  win._guestToggleLowerOpen();
  win._guestToggle("lower", "ia1b");
  win._guestPickerCommit();
  const homonimos = win.pl("cadete").filter(p => p.name === "Homónimo Repetido" && p.attOnly);
  report.assert(homonimos.length === 1, "traer de categoría inferior a alguien con el MISMO NOMBRE que un puntual ya existente reutiliza esa entrada -- no crea un segundo duplicado (B-GUEST5)");
  report.assert(homonimos[0].id === "prevHom" && homonimos[0].number === 11, "la entrada reutilizada es la ya existente, y se le rellena el dorsal si no lo tenía");
  report.assert(win.S.players.infA.find(p => p.id === "ia1b").number === 11, "el jugador original de Infantil A sigue intacto");

  // ── Dedup por NOMBRE también en el alta manual ──
  win.openGuestPlayerModal({ mode: "att" });
  win._guestToggleManualOpen();
  document.getElementById("gp-name").value = "homónimo repetido"; // distinta capitalización/acento a propósito
  win._guestPlayerCommit("att");
  const homonimos2 = win.pl("cadete").filter(p => win._normName(p.name) === win._normName("Homónimo Repetido") && p.attOnly);
  report.assert(homonimos2.length === 1, "el alta manual con un nombre que normaliza igual a uno ya existente también reutiliza la entrada, en vez de duplicar (B-GUEST5)");

  // ── Modo partido: 'Más frecuentes' y 'Categoría inferior' respetan matchOnly y convocados ──
  win.S.matches.cadete = [{ id: "m1", rival: "Rival CB", quarters: 4, qMins: 10, convocados: [] }];
  win.S.matchId = "m1";
  win.openGuestPlayerModal({ mode: "match" });
  win._guestToggleLowerOpen();
  report.assert(win._guestPicker.lowerRows.some(r => r.name === "Infantil B Uno"), "en modo partido, 'Categoría inferior' también ofrece candidatos (Infantil B Uno, aún no traído)");
  win._guestToggle("lower", "ib1");
  win._guestPickerCommit();
  // Ya existe un "Infantil B Uno" attOnly de la sección de entreno de más
  // arriba, así que hay que distinguir por matchOnly -- son dos entradas
  // independientes a propósito (attOnly y matchOnly son excluyentes).
  const matchGuest = win.pl("cadete").find(p => p.name === "Infantil B Uno" && p.matchOnly);
  report.assert(!!matchGuest && matchGuest.matchOnly === true && matchGuest.attOnly !== true, "un puntual traído en modo partido queda marcado matchOnly (no attOnly)");
  report.assert(win.mById("cadete", "m1").convocados.includes(matchGuest.id), "queda convocado directamente al partido actual");

  // Reutilizarlo en un partido FUTURO desde 'Más frecuentes'.
  win.S.matches.cadete.push({ id: "m2", rival: "Otro Rival", quarters: 4, qMins: 10, convocados: [] });
  win.S.matchId = "m2";
  win.openGuestPlayerModal({ mode: "match" });
  report.assert(win._guestPicker.frequent.some(p => p.name === "Infantil B Uno"), "en modo partido, un puntual ya usado en OTRO partido aparece en 'Más frecuentes' (reutilizable partido a partido)");
  win._guestToggle("freq", matchGuest.id);
  win._guestPickerCommit();
  report.assert(win.pl("cadete").filter(p => p.name === "Infantil B Uno" && p.matchOnly).length === 1, "reutilizar en modo partido tampoco duplica al jugador (sigue habiendo un único matchOnly \"Infantil B Uno\", aparte del attOnly de antes)");
  report.assert(win.mById("cadete", "m2").convocados.includes(matchGuest.id), "queda convocado también al segundo partido");
  document.getElementById("m-guest-player")?.remove();

  // ── El catálogo/roster real de los equipos de origen no se ha tocado en ningún momento ──
  report.assert(win.S.players.infB.length === 1 && win.S.players.alevin.length === 1, "los rosters reales de los equipos de categoría inferior siguen exactamente igual que al principio -- solo se copian, nunca se mueven ni se borran");

  // ═══════════════════════════════════════════════════════════════════════
  // PUNTUALES DUPLICADOS · fusión de duplicados YA EXISTENTES (B-GUEST5)
  // ═══════════════════════════════════════════════════════════════════════
  win.S.teams = [{ id: "eq", name: "Equipo Test Fusión", category: "Cadete", gender: "Masculino", coaches: [] }];
  win.S.players = {
    eq: [
      { id: "fix", name: "Fijo Titular", number: 4 },
      // Dos puntuales de ENTRENO con el mismo nombre (duplicado por dar de alta dos veces sin el dedup nuevo).
      { id: "e1", name: "Puntual Repe", guest: true, attOnly: true, addedAt: "2026-09-01", attDates: ["2026-09-01"], number: null, guestNote: "" },
      { id: "e2", name: "puntual repe", guest: true, attOnly: true, addedAt: "2026-09-08", attDates: ["2026-09-08"], number: 15, guestNote: "Infantil A" },
      // Dos puntuales de PARTIDO con el mismo nombre.
      { id: "m1p", name: "Convocado Repe", guest: true, matchOnly: true, addedAt: "2026-09-01", number: 20 },
      { id: "m2p", name: "Convocado Repe", guest: true, matchOnly: true, addedAt: "2026-09-05", number: null }
    ]
  };
  win.S.sessions = {
    "eq_2026-09-01": { fix: "present", e1: "present" },
    "eq_2026-09-08": { fix: "present", e2: "present", e2_score: 8 }
  };
  win.S.matches = {
    eq: [
      { id: "mA", rival: "Rival A", quarters: 4, qMins: 10, convocados: ["fix", "m1p"], titulares: ["fix"], capitan: "m1p",
        live: { onCourt: ["fix", "m1p"], stats: { m1p: { pts: 4 }, fix: { pts: 2 } }, minTracked: { m1p: 5 }, plusMinusTracked: { m1p: 3 }, inSince: { m1p: 100 }, plusMinusBaseline: { m1p: 0 }, shots: [{ pid: "m1p", made: true }] } },
      { id: "mB", rival: "Rival B", quarters: 4, qMins: 10, convocados: ["fix", "m2p"], titulares: [],
        live: { onCourt: [], stats: { m2p: { pts: 6 } }, minTracked: { m2p: 8 }, plusMinusTracked: {}, inSince: {}, plusMinusBaseline: {}, shots: [{ pid: "m2p", made: false }] } }
    ]
  };
  win.S.events = { eq: [{ id: "ev1", convocados: ["fix", "m2p"] }] };
  win.S.teamId = "eq";

  const groups = win._findDuplicateGuestGroups("eq");
  report.assert(groups.length === 2, "_findDuplicateGuestGroups detecta los 2 grupos duplicados (uno de entreno, uno de partido) -- ignora al jugador fijo");
  const attGroup = groups.find(g => g[0].attOnly);
  const matchGroup = groups.find(g => g[0].matchOnly);
  report.assert(attGroup.length === 2 && matchGroup.length === 2, "cada grupo agrupa correctamente las 2 entradas repetidas por nombre normalizado");

  const mergeAtt = win._mergeGuestGroup("eq", attGroup);
  report.assert(mergeAtt.survivor.id === "e1" && mergeAtt.mergedCount === 1, "al fusionar, sobrevive la entrada más ANTIGUA (e1) y se cuenta 1 fusionado");
  report.assert(mergeAtt.survivor.number === 15, "el superviviente hereda el dorsal del duplicado si él no tenía");
  report.assert(mergeAtt.survivor.guestNote === "Infantil A", "el superviviente hereda la nota del duplicado si él no tenía");
  report.assert(mergeAtt.survivor.attDates.includes("2026-09-01") && mergeAtt.survivor.attDates.includes("2026-09-08"), "attDates de ambas entradas se combinan sin perder ninguna");
  report.assert(!win.pl("eq").some(p => p.id === "e2"), "la entrada duplicada (e2) desaparece tras la fusión");
  report.assert(win.S.sessions["eq_2026-09-01"].e1 === "present", "la sesión que ya usaba el id superviviente (e1) no se toca");
  report.assert(win.S.sessions["eq_2026-09-08"].e1 === "present" && win.S.sessions["eq_2026-09-08"].e1_score === 8, "las claves de sesión del duplicado (incluida la de puntuación, sufijo _score) se remapean al id superviviente, sin perder el dato");
  report.assert(win.S.sessions["eq_2026-09-08"].e2 === undefined && win.S.sessions["eq_2026-09-08"].e2_score === undefined, "las claves viejas del duplicado ya no quedan sueltas en la sesión");

  const mergeMatch = win._mergeGuestGroup("eq", matchGroup);
  report.assert(mergeMatch.survivor.id === "m1p" && mergeMatch.mergedCount === 1, "en el grupo de partido sobrevive también el más antiguo (m1p)");
  const mA = win.mById("eq", "mA");
  const mB = win.mById("eq", "mB");
  report.assert(mB.convocados.includes("m1p") && !mB.convocados.includes("m2p"), "convocados del otro partido (mB) se remapean del duplicado (m2p) al superviviente (m1p)");
  report.assert(mA.capitan === "m1p", "el capitán del partido mA sigue apuntando al superviviente (ya lo era)");
  report.assert(mB.live.stats.m1p.pts === 6, "las estadísticas en vivo (stats) del duplicado se trasladan al superviviente cuando este no tenía stats en ese partido");
  report.assert(mA.live.stats.m1p.pts === 4, "las estadísticas en vivo del superviviente en el partido donde SÍ jugó él no se pierden ni se suman de más");
  report.assert(mB.live.minTracked.m1p === 8, "minTracked del duplicado se traslada al superviviente");
  report.assert(mB.live.shots[0].pid === "m1p", "los tiros (shots) registrados a nombre del duplicado quedan reasignados al superviviente");
  report.assert(win.S.events.eq[0].convocados.includes("m1p") && !win.S.events.eq[0].convocados.includes("m2p"), "los convocados de eventos también se remapean del duplicado al superviviente");
  report.assert(!win.pl("eq").some(p => p.id === "m2p"), "la entrada duplicada de partido (m2p) desaparece tras la fusión");
  report.assert(win.pl("eq").some(p => p.id === "fix"), "el jugador fijo del equipo no se toca en ningún momento por la fusión");

  report.assert(win._findDuplicateGuestGroups("eq").length === 0, "tras fusionar todos los grupos, ya no quedan puntuales duplicados en el equipo");

  // ── openGuestDuplicatesModal / _confirmMergeAllGuestDuplicates: flujo end-to-end con confirmación ──
  win.S.players.eq.push(
    { id: "d1", name: "Otro Repe", guest: true, attOnly: true, addedAt: "2026-09-01", attDates: ["2026-09-01"] },
    { id: "d2", name: "Otro Repe", guest: true, attOnly: true, addedAt: "2026-09-10", attDates: ["2026-09-10"] }
  );
  win.openGuestDuplicatesModal();
  report.assert(!!document.getElementById("m-guest-dupes"), "openGuestDuplicatesModal abre el modal cuando hay duplicados");
  const dupesHtml = document.getElementById("m-guest-dupes").innerHTML;
  report.assert(dupesHtml.includes("Otro Repe"), "el modal lista el grupo de duplicados detectado");
  win._confirmMergeAllGuestDuplicates();
  // _confirmMergeAllGuestDuplicates usa _confirm(), que abre un modal de
  // confirmación y solo ejecuta la fusión cuando se pulsa su botón -- no
  // fusiona nada hasta entonces. Simulamos ese click igual que haría el usuario.
  report.assert(!!document.getElementById("m-confirm"), "_confirmMergeAllGuestDuplicates pide confirmación antes de fusionar nada (no destructivo por sorpresa)");
  document.querySelector("#m-confirm button")._cb();
  report.assert(!win.pl("eq").some(p => p.id === "d2"), "tras confirmar, la fusión elimina la entrada duplicada");
  report.assert(win.pl("eq").find(p => p.id === "d1").attDates.includes("2026-09-10"), "tras confirmar, la fusión combina attDates de ambas entradas en la superviviente");
  document.getElementById("m-guest-dupes")?.remove();

  // Sin duplicados, el modal no se abre (solo un toast informativo) -- no debe petar.
  win.openGuestDuplicatesModal();
  report.assert(!document.getElementById("m-guest-dupes"), "sin puntuales duplicados, openGuestDuplicatesModal no abre ningún modal");

  return report.summary();
}

module.exports = { run };
if (require.main === module) {
  run().then(({ failed }) => process.exit(failed ? 1 : 0));
}
