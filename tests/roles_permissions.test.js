"use strict";
// v3.0.0-dev.101 · B-ROLES1: roles y permisos (entrenador / director deportivo
// / superadmin), pedido explícito por Mario -- "con esto me gustaría hacer
// una versión de entrenadores, una de superadmin y una de director deportivo
// con diferentes permisos". Diseño confirmado con 3 rondas de AskUserQuestion
// (ver resumen de la sesión): login elegiendo nombre de una lista predefinida
// desde Ajustes; entrenador ve/edita sus equipos + puede tener equipos
// adicionales en "solo ver" (segundo/tercer entrenador que ayuda poco);
// director deportivo = igual que entrenador en SUS equipos (si entrena
// alguno) + ve TODOS los demás en solo lectura automáticamente; superadmin =
// acceso total + gestiona la lista. Vacío (sin entrenadores en la lista) =
// sin restricciones, comportamiento de toda la vida -- es un gate puramente
// de CLIENTE (Firestore solo tiene una cuenta compartida por club, ver
// firestore.rules), documentado explícitamente como limitación conocida.
//
// Este test cubre, en orden: el modelo de datos y los helpers puros
// (_permissionsActive/_myRole/_canEditTeam/_canViewTeam/_visibleTeams/
// _editableTeams/_requireEdit), el filtrado real en las pantallas
// (equiposScreen/statsHomeScreen/hoy), el guardia de render() para pantallas
// de equipo inaccesibles, los guardias de escritura en los mutadores más
// sensibles (asistencia, jugadores, lesiones, incidencias, eventos,
// partidos, partido en vivo), la gestión del roster desde Ajustes
// (altas/bajas, validación de "al menos un superadmin"), y la puerta de
// identidad (_needsIdentityPick/_showIdentityGate/_pickIdentity).
const { loadApp, newReporter } = require("./harness");

async function run() {
  const report = newReporter("roles_permissions");
  const win = await loadApp();
  const document = win.document;
  const assert = (cond, msg) => report.assert(cond, msg);

  const today = win.td();

  function freshFixture() {
    win.S.teams = [
      { id: "t1", name: "Cadete Masculino", color: "#F06318", schedule: {} },
      { id: "t2", name: "Infantil Femenino", color: "#1a6fc4", schedule: {} },
      { id: "t3", name: "Senior A", color: "#22c55e", schedule: {} }
    ];
    win.S.players = {
      t1: [{ id: "p1", name: "Jugador Uno", number: 4, addedAt: "2026-07-01" }],
      t2: [{ id: "p2", name: "Jugadora Dos", number: 5, addedAt: "2026-07-01" }],
      t3: [{ id: "p3", name: "Jugador Tres", number: 6, addedAt: "2026-07-01" }]
    };
    win.S.matches = {};
    win.S.events = {};
    win.S.sessions = {};
    win.S.cfg.coaches = [];
    win.lsSet("cbj:currentcoachid", "", true);
    win.S.teamId = "t1";
    win.S.date = today;
    win.S.screen = "hoy";
    win.S.hoyDate = null;
    document.querySelectorAll(".toast,#m-confirm,#m-identity-gate,#m-coach-edit,#m-club-settings,#m-hoy-add").forEach(e => e.remove());
  }

  // ════════════════════════════════════════════════════════════════
  // 1) SIN restricciones (coaches vacío) -- comportamiento de siempre
  // ════════════════════════════════════════════════════════════════
  freshFixture();
  assert(Array.isArray(win.S.cfg.coaches) && win.S.cfg.coaches.length === 0,
    "DEFAULT_CFG: coaches empieza vacío -- nadie ha activado permisos todavía");
  assert(win._permissionsActive() === false, "_permissionsActive(): false con coaches vacío");
  assert(win._myRole() === "superadmin", "_myRole(): sin permisos activos, cualquiera es efectivamente superadmin (compatibilidad total)");
  assert(win._isSuperadmin() === true, "_isSuperadmin(): true sin permisos activos");
  assert(win._canEditTeam("t1") === true && win._canEditTeam("t2") === true && win._canEditTeam("t3") === true,
    "_canEditTeam(): true para CUALQUIER equipo sin permisos activos");
  assert(win._canViewTeam("t1") === true && win._canViewTeam("t2") === true,
    "_canViewTeam(): true para cualquier equipo sin permisos activos");
  assert(win._visibleTeams().length === 3, "_visibleTeams(): devuelve los 3 equipos tal cual sin permisos activos");
  assert(win._editableTeams().length === 3, "_editableTeams(): devuelve los 3 equipos tal cual sin permisos activos");
  assert(win._needsIdentityPick() === false, "_needsIdentityPick(): false sin permisos activos -- nunca bloquea a nadie");

  // ════════════════════════════════════════════════════════════════
  // 2) Activar permisos: entrenador con 1 equipo propio + 1 en solo ver
  // ════════════════════════════════════════════════════════════════
  freshFixture();
  win.S.cfg.coaches = [
    { id: "c-super", name: "María (super)", role: "superadmin", teamsEdit: [], teamsView: [] },
    { id: "c-ent", name: "Juan (entrenador)", role: "entrenador", teamsEdit: ["t1"], teamsView: ["t2"] },
    { id: "c-dd", name: "Luis (director)", role: "director_deportivo", teamsEdit: ["t3"], teamsView: [] },
    { id: "c-dd2", name: "Rosa (director sin equipo)", role: "director_deportivo", teamsEdit: [], teamsView: [] }
  ];
  assert(win._permissionsActive() === true, "_permissionsActive(): true en cuanto coaches tiene al menos 1 entrada");

  // -- Nadie ha elegido identidad todavía en este "dispositivo" --
  assert(win._needsIdentityPick() === true, "_needsIdentityPick(): true con permisos activos y sin identidad elegida");
  assert(win._currentCoach() === null, "_currentCoach(): null sin identidad elegida");
  assert(win._myRole() === null, "_myRole(): null sin identidad elegida (no se asume ningún rol por defecto)");
  assert(win._canEditTeam("t1") === false && win._canViewTeam("t1") === false,
    "_canEditTeam/_canViewTeam: false para todo sin identidad elegida -- nunca se enseña nada por error");

  // -- Elegir "Juan (entrenador)" --
  win._setCurrentCoachId("c-ent");
  assert(win._needsIdentityPick() === false, "_needsIdentityPick(): false tras elegir identidad");
  assert(win._currentCoach() && win._currentCoach().id === "c-ent", "_currentCoach(): devuelve la entrada elegida");
  assert(win._myRole() === "entrenador", "_myRole(): 'entrenador' para Juan");
  assert(win._isSuperadmin() === false, "_isSuperadmin(): false para un entrenador normal");
  assert(win._canEditTeam("t1") === true, "entrenador: puede editar su propio equipo (t1, en teamsEdit)");
  assert(win._canEditTeam("t2") === false, "entrenador: NO puede editar un equipo que solo tiene en 'ver' (t2)");
  assert(win._canEditTeam("t3") === false, "entrenador: NO puede editar un equipo ajeno (t3)");
  assert(win._canViewTeam("t1") === true, "entrenador: puede VER su propio equipo");
  assert(win._canViewTeam("t2") === true, "entrenador: puede VER el equipo que tiene en 'solo ver' (t2)");
  assert(win._canViewTeam("t3") === false, "entrenador: NO puede ver un equipo totalmente ajeno (t3)");
  const visJuan = win._visibleTeams().map(t => t.id).sort();
  assert(JSON.stringify(visJuan) === JSON.stringify(["t1", "t2"]), "_visibleTeams(): Juan ve exactamente t1 y t2 (editar+ver), nunca t3");
  const editJuan = win._editableTeams().map(t => t.id);
  assert(JSON.stringify(editJuan) === JSON.stringify(["t1"]), "_editableTeams(): Juan solo puede EDITAR t1");

  // -- Elegir "Luis (director deportivo, entrena t3)" --
  win._setCurrentCoachId("c-dd");
  assert(win._myRole() === "director_deportivo", "_myRole(): 'director_deportivo' para Luis");
  assert(win._canEditTeam("t3") === true, "director deportivo: puede editar SU equipo (t3)");
  assert(win._canEditTeam("t1") === false, "director deportivo: NO puede editar un equipo que no entrena (t1)");
  assert(win._canViewTeam("t1") === true && win._canViewTeam("t2") === true && win._canViewTeam("t3") === true,
    "director deportivo: VE todos los equipos del club automáticamente, sin necesidad de teamsView explícito");
  assert(win._visibleTeams().length === 3, "_visibleTeams(): director deportivo ve los 3 equipos");
  const editLuis = win._editableTeams().map(t => t.id);
  assert(JSON.stringify(editLuis) === JSON.stringify(["t3"]), "_editableTeams(): Luis solo puede EDITAR t3 (el que entrena)");

  // -- Elegir "Rosa (director deportivo SIN equipo propio)" --
  win._setCurrentCoachId("c-dd2");
  assert(win._canViewTeam("t1") === true && win._canViewTeam("t2") === true && win._canViewTeam("t3") === true,
    "director deportivo sin equipo propio: sigue viendo TODOS los equipos (el ver no depende de entrenar ninguno)");
  assert(win._editableTeams().length === 0, "director deportivo sin equipo propio: no puede editar NINGÚN equipo");
  assert(win._canEditTeam("t1") === false && win._canEditTeam("t3") === false,
    "director deportivo sin equipo propio: no edita nada, ni siquiera por error");

  // -- Elegir "María (superadmin)" --
  win._setCurrentCoachId("c-super");
  assert(win._isSuperadmin() === true, "_isSuperadmin(): true para María");
  assert(win._canEditTeam("t1") === true && win._canEditTeam("t2") === true && win._canEditTeam("t3") === true,
    "superadmin: edita TODOS los equipos sin importar teamsEdit/teamsView (vacíos en su entrada)");
  assert(win._visibleTeams().length === 3 && win._editableTeams().length === 3,
    "superadmin: ve y edita los 3 equipos siempre");

  // -- Identidad apuntando a un coach que ya no existe en la lista (p.ej.
  // lo borraron desde otro dispositivo) -- debe comportarse como "sin
  // identidad elegida", NUNCA quedarse con los permisos antiguos en caché. --
  win._setCurrentCoachId("coach-borrado-id-inventado");
  assert(win._currentCoach() === null, "_currentCoach(): null si el id guardado ya no está en la lista");
  assert(win._needsIdentityPick() === true, "_needsIdentityPick(): true si el id guardado ya no está en la lista (hay que volver a elegir)");
  assert(win._canEditTeam("t1") === false, "_canEditTeam(): false con una identidad que ya no existe -- nunca hereda permisos de nadie");

  // ════════════════════════════════════════════════════════════════
  // 3) _requireEdit(tid): toast + false si no puede editar; true y sin
  //    toast si puede.
  // ════════════════════════════════════════════════════════════════
  win._setCurrentCoachId("c-ent"); // Juan: edita t1, no t2/t3
  document.querySelectorAll(".toast").forEach(e => e.remove());
  assert(win._requireEdit("t1") === true, "_requireEdit(): true para un equipo que sí puede editar");
  assert(document.querySelector(".toast") === null, "_requireEdit(): no muestra ningún toast cuando SÍ tiene permiso");
  assert(win._requireEdit("t2") === false, "_requireEdit(): false para un equipo que solo puede VER, no editar");
  assert(!!document.querySelector(".toast"), "_requireEdit(): muestra un toast de aviso cuando NO tiene permiso");

  // ════════════════════════════════════════════════════════════════
  // 4) Filtrado real en pantallas: equiposScreen() / statsHomeScreen() / hoy()
  // ════════════════════════════════════════════════════════════════
  win._setCurrentCoachId("c-ent"); // Juan: t1+t2 visibles, t3 no
  win.S.screen = "equipos";
  const eqHtml = win.equiposScreen();
  assert(eqHtml.includes("Cadete Masculino") && eqHtml.includes("Infantil Femenino"),
    "equiposScreen(): un entrenador ve las tarjetas de sus equipos (editar+ver)");
  assert(!eqHtml.includes("Senior A"),
    "equiposScreen(): un entrenador NUNCA ve la tarjeta de un equipo al que no tiene acceso (t3)");
  assert(!eqHtml.includes("openTeamModal()"),
    "equiposScreen(): un entrenador normal no tiene el botón ＋ de crear equipo (acción de superadmin)");

  win.S.screen = "statsHome";
  const statsHtml = win.statsHomeScreen();
  assert(statsHtml.includes("Cadete Masculino") && statsHtml.includes("Infantil Femenino") && !statsHtml.includes("Senior A"),
    "statsHomeScreen(): mismo filtrado que equiposScreen() -- solo equipos visibles para el entrenador");

  win.S.screen = "hoy";
  win.S.sessions = { [`t1_${today}`]: {}, [`t2_${today}`]: {}, [`t3_${today}`]: {} }; // "sorpresa" en los 3 para forzar que aparezcan en Hoy
  const hoyHtml = win.hoy();
  assert(hoyHtml.includes("Cadete Masculino") && hoyHtml.includes("Infantil Femenino"),
    "hoy(): un entrenador ve los entrenamientos de hoy de sus equipos visibles");
  assert(!hoyHtml.includes("Senior A"),
    "hoy(): un entrenador NUNCA ve el entrenamiento de hoy de un equipo al que no tiene acceso (t3)");

  // -- Director deportivo: ve TODO en Hoy/Equipos/Stats --
  win._setCurrentCoachId("c-dd");
  win.S.screen = "equipos";
  const eqHtmlDD = win.equiposScreen();
  assert(eqHtmlDD.includes("Cadete Masculino") && eqHtmlDD.includes("Infantil Femenino") && eqHtmlDD.includes("Senior A"),
    "equiposScreen(): el director deportivo ve los 3 equipos (ve todo automáticamente)");

  // ════════════════════════════════════════════════════════════════
  // 5) Guardia de render(): pantalla de equipo inaccesible -> redirige a
  //    "equipos" con aviso, nunca enseña datos de un equipo sin acceso.
  // ════════════════════════════════════════════════════════════════
  win._setCurrentCoachId("c-ent"); // Juan: no tiene acceso a t3
  win.S.teamId = "t3";
  win.S.screen = "team";
  document.querySelectorAll(".toast").forEach(e => e.remove());
  win.render();
  assert(win.S.screen === "equipos", "render(): con un equipo inaccesible en pantalla, redirige a 'equipos'");
  assert(win.S.teamId === null, "render(): limpia S.teamId al redirigir (no deja un id inaccesible colgado)");
  assert(!!document.querySelector(".toast"), "render(): muestra un aviso al redirigir por falta de acceso");

  // -- Pero SÍ puede entrar a una pantalla de un equipo que sí ve (t2, solo
  // lectura para él) -- el guardia de render() es de VISIBILIDAD, no de
  // edición; quien solo puede ver debe poder navegar a la pantalla igual. --
  win.S.teamId = "t2";
  win.S.screen = "team";
  win.render();
  assert(win.S.screen === "team" && win.S.teamId === "t2",
    "render(): un equipo que SÍ puede ver (aunque sea de solo lectura) no se redirige");

  // ════════════════════════════════════════════════════════════════
  // 6) Guardias de escritura en mutadores -- un entrenador NUNCA puede
  //    escribir en un equipo que no está en su teamsEdit, ni aunque fuerce
  //    S.teamId a mano (defensa en profundidad, no solo UI).
  // ════════════════════════════════════════════════════════════════
  freshFixture();
  win.S.cfg.coaches = [
    { id: "c-super2", name: "Super", role: "superadmin", teamsEdit: [], teamsView: [] },
    { id: "c-ent2", name: "Entrenador limitado", role: "entrenador", teamsEdit: ["t1"], teamsView: ["t2"] }
  ];
  win._setCurrentCoachId("c-ent2");

  // -- cycleAtt / setAll: no deben tocar S.sessions de un equipo que solo ve --
  win.S.teamId = "t2"; win.S.date = today;
  win.cycleAtt("p2");
  assert(win.S.sessions[win.sk("t2", today)] === undefined,
    "cycleAtt(): NO escribe nada en t2 (solo lectura para este entrenador) -- ver _requireEdit");
  win.setAll("present");
  assert(win.S.sessions[win.sk("t2", today)] === undefined,
    "setAll(): NO escribe nada en t2 (solo lectura)");

  // -- En su propio equipo (t1) SÍ debe poder --
  win.S.teamId = "t1";
  win.cycleAtt("p1");
  assert(win.S.sessions[win.sk("t1", today)] && win.S.sessions[win.sk("t1", today)].p1,
    "cycleAtt(): SÍ escribe con normalidad en t1 (su propio equipo editable)");

  // -- savePlayer / delPlayer en equipo ajeno --
  win.S.teamId = "t2";
  document.body.insertAdjacentHTML("beforeend", `<div id="m-test-player"><input id="m-test-player-n" value="Intento Ajeno"/><input id="m-test-player-d" value="99"/><select id="m-test-player-p"><option value="">-</option></select><input id="m-test-player-o" value=""/></div>`);
  const beforeCount = (win.S.players.t2 || []).length;
  const resSave = win.savePlayer("m-test-player", null);
  assert(resSave === false, "savePlayer(): devuelve false al intentar crear un jugador en un equipo ajeno (t2)");
  assert((win.S.players.t2 || []).length === beforeCount, "savePlayer(): NO añade el jugador a t2 (solo lectura)");
  document.getElementById("m-test-player")?.remove();
  win.delPlayer("p2");
  assert((win.S.players.t2 || []).some(p => p.id === "p2"), "delPlayer(): NO borra a p2 de t2 (solo lectura para este entrenador)");

  // -- saveEvento / delEvento / evtTogglePlayer en equipo ajeno --
  win.S.events.t2 = [{ id: "ev1", tipo: "partido", rival: "Rival", fecha: today, convocados: [] }];
  win.S.eventId = "ev1";
  win.evtTogglePlayer("p2");
  assert((win.S.events.t2[0].convocados || []).length === 0, "evtTogglePlayer(): no modifica convocados en un equipo ajeno (t2)");
  win.delEvento("ev1");
  assert(win.S.events.t2.some(e => e.id === "ev1"), "delEvento(): NO elimina el evento de un equipo ajeno (ni siquiera abre el confirm -- requireEdit corta antes)");

  // -- saveTeam: editar un equipo ajeno (eid=t2) debe fallar; crear uno
  // nuevo (sin eid) debe fallar para un entrenador normal (no es superadmin). --
  document.body.insertAdjacentHTML("beforeend", `<div id="m-test-team"><input id="m-test-team-n" value="NUEVO"/><select id="m-test-team-cat"><option value="cadete">Cadete</option></select></div>`);
  const teamsCountBefore = win.S.teams.length;
  const resNewTeam = win.saveTeam("m-test-team", null);
  assert(resNewTeam === false, "saveTeam(): un entrenador normal no puede crear un equipo nuevo");
  assert(win.S.teams.length === teamsCountBefore, "saveTeam(): no se añadió ningún equipo nuevo");
  const resEditForeign = win.saveTeam("m-test-team", "t2");
  assert(resEditForeign === false, "saveTeam(): un entrenador no puede editar un equipo ajeno (t2) aunque le pasen el eid directamente");
  document.getElementById("m-test-team")?.remove();

  // -- delTeam: reservado a superadmin --
  win.S.teamId = "t1"; // su PROPIO equipo, editable -- pero borrar equipos es de superadmin, no de "edita este equipo"
  document.querySelectorAll(".toast").forEach(e => e.remove());
  win.delTeam();
  assert(win.S.teams.some(t => t.id === "t1"), "delTeam(): un entrenador normal no puede borrar ni siquiera SU PROPIO equipo (acción reservada a superadmin)");
  assert(!!document.querySelector(".toast"), "delTeam(): muestra aviso de que es cosa del superadmin");

  // -- Como superadmin, todo lo anterior SÍ debe funcionar --
  win._setCurrentCoachId("c-super2");
  win.S.teamId = "t2";
  win.cycleAtt("p2");
  assert(win.S.sessions[win.sk("t2", today)] && win.S.sessions[win.sk("t2", today)].p2,
    "cycleAtt(): el superadmin SÍ puede marcar asistencia en cualquier equipo");
  const resNewTeamSuper = (() => {
    document.body.insertAdjacentHTML("beforeend", `<div id="m-test-team2"><input id="m-test-team2-n" value="NUEVO EQUIPO"/><select id="m-test-team2-cat"><option value="cadete">Cadete</option></select></div>`);
    const r = win.saveTeam("m-test-team2", null);
    document.getElementById("m-test-team2")?.remove();
    return r;
  })();
  assert(resNewTeamSuper === true, "saveTeam(): el superadmin SÍ puede crear un equipo nuevo");
  assert(win.S.teams.some(t => t.name === "NUEVO EQUIPO"), "saveTeam(): el equipo nuevo del superadmin se creó de verdad");

  // ════════════════════════════════════════════════════════════════
  // 7) Partido en vivo: liveAction/liveTeamAction/toggleTitular/setCapitan
  //    nunca escriben si no se puede editar ese equipo.
  // ════════════════════════════════════════════════════════════════
  win._setCurrentCoachId("c-ent2"); // t1 editable, t2 solo ver
  win.S.teamId = "t2";
  win.S.matches.t2 = [{ id: "mA", rival: "Rival", quarters: 4, qMins: 10, convocados: ["p2"], titulares: [], capitan: null, live: { q: 1, stats: {}, onCourt: ["p2"], log: [] } }];
  win.S.matchId = "mA";
  win.liveAction("p2", "p2m", 2);
  assert(!win.S.matches.t2[0].live.stats.p2, "liveAction(): no anota ninguna estadística en un partido de un equipo de solo lectura (t2)");
  win.toggleTitular("p2");
  assert((win.S.matches.t2[0].titulares || []).length === 0, "toggleTitular(): no modifica titulares en un equipo de solo lectura");
  win.setCapitan("p2");
  assert(!win.S.matches.t2[0].capitan, "setCapitan(): no asigna capitán en un equipo de solo lectura");

  win.S.teamId = "t1"; // su propio equipo -- sí debe funcionar
  win.S.matches.t1 = [{ id: "mB", rival: "Rival", quarters: 4, qMins: 10, convocados: ["p1"], titulares: [], capitan: null, live: { q: 1, stats: {}, onCourt: ["p1"], log: [] } }];
  win.S.matchId = "mB";
  win.liveAction("p1", "p2m", 2);
  assert(win.S.matches.t1[0].live.stats.p1 && win.S.matches.t1[0].live.stats.p1.p2m === 1,
    "liveAction(): SÍ anota con normalidad en su propio equipo editable (t1)");

  // ════════════════════════════════════════════════════════════════
  // 8) openHoyAddSheet() / _hoyAddPick / _hoyAddPickOptional: el picker de
  //    equipo para crear una actividad solo ofrece equipos EDITABLES.
  // ════════════════════════════════════════════════════════════════
  win._setCurrentCoachId("c-ent2"); // t1 editable, t2 solo ver, t3 no accesible... pero en este fixture solo hay t1/t2
  win.S.screen = "hoy"; win.S.hoyDate = null;
  win.openHoyAddSheet();
  assert(!!document.getElementById("m-hoy-add"), "openHoyAddSheet(): un entrenador con al menos un equipo editable SÍ puede abrir el sheet");
  win._hoyAddPick("training");
  // Con 1 solo equipo EDITABLE (t1 -- t2 es solo lectura para Juan, así que
  // no cuenta), _hoyAddPick salta directo al pase de lista de t1 sin
  // preguntar (mismo comportamiento que con un único equipo en el club) --
  // nunca ofrece elegir entre t1 y t2.
  assert(!document.getElementById("m-hoy-add"), "_hoyAddPick(): con 1 solo equipo editable, cierra el sheet y navega directo (no pregunta)");
  assert(win.S.screen === "att" && win.S.teamId === "t1", "_hoyAddPick(): el único equipo editable (t1) es al que navega, nunca t2 (solo lectura)");

  // -- Un director deportivo SIN equipo propio (nada editable) no puede ni
  // abrir el sheet de añadir actividad. --
  win.S.cfg.coaches.push({ id: "c-dd3", name: "DD sin equipo", role: "director_deportivo", teamsEdit: [], teamsView: [] });
  win._setCurrentCoachId("c-dd3");
  document.getElementById("m-hoy-add")?.remove();
  document.querySelectorAll(".toast").forEach(e => e.remove());
  win.openHoyAddSheet();
  assert(!document.getElementById("m-hoy-add"), "openHoyAddSheet(): un director deportivo sin ningún equipo editable no puede abrir el sheet de añadir actividad");
  assert(!!document.querySelector(".toast"), "openHoyAddSheet(): avisa con un toast de que no tiene equipos para editar");

  // ════════════════════════════════════════════════════════════════
  // 9) Gestión del roster desde Ajustes (saveCoachEdit / confirmDeleteCoach):
  //    solo superadmin, y nunca se puede dejar la lista sin ningún superadmin.
  // ════════════════════════════════════════════════════════════════
  freshFixture();
  win.S.cfg.coaches = [{ id: "c-s1", name: "Super Uno", role: "superadmin", teamsEdit: [], teamsView: [] }];
  win._setCurrentCoachId("c-s1");

  // -- Como superadmin: añadir un entrenador nuevo --
  document.body.insertAdjacentHTML("beforeend", `<div id="m-coach-test">
    <input id="coach-edit-name" value="Nuevo Entrenador"/>
    <select id="coach-edit-role"><option value="entrenador" selected>Entrenador</option></select>
    <input type="checkbox" class="coach-edit-teamedit" value="t1" checked/>
    <input type="checkbox" class="coach-edit-teamview" value="t2" checked/>
  </div>`);
  win.saveCoachEdit(null);
  assert(win.S.cfg.coaches.length === 2, "saveCoachEdit(): el superadmin añade un entrenador nuevo a la lista");
  const added = win.S.cfg.coaches.find(c => c.name === "Nuevo Entrenador");
  assert(added && added.role === "entrenador" && JSON.stringify(added.teamsEdit) === JSON.stringify(["t1"]) && JSON.stringify(added.teamsView) === JSON.stringify(["t2"]),
    "saveCoachEdit(): guarda el rol y los equipos marcados tal cual");
  document.getElementById("m-coach-test")?.remove();

  // -- Intentar dejar la lista SIN superadmin (editando al único superadmin
  // para que pase a ser entrenador) -- debe RECHAZARSE. --
  document.body.insertAdjacentHTML("beforeend", `<div id="m-coach-test2">
    <input id="coach-edit-name" value="Super Uno"/>
    <select id="coach-edit-role"><option value="entrenador" selected>Entrenador</option></select>
  </div>`);
  const coachesBefore = JSON.stringify(win.S.cfg.coaches);
  win.saveCoachEdit("c-s1");
  document.getElementById("m-coach-test2")?.remove();
  assert(JSON.stringify(win.S.cfg.coaches) === coachesBefore,
    "saveCoachEdit(): RECHAZA dejar la lista sin ningún superadmin (chicken-and-egg) -- no cambia nada");

  // -- Como NO-superadmin: no puede ni abrir el modal de edición ni guardar --
  win._setCurrentCoachId("added-will-not-exist-yet");
  win._setCurrentCoachId(added.id);
  document.querySelectorAll(".toast").forEach(e => e.remove());
  win.openCoachEditModal(null);
  assert(!document.getElementById("m-coach-edit"), "openCoachEditModal(): un entrenador normal no puede abrir el editor de la lista");
  assert(!!document.querySelector(".toast"), "openCoachEditModal(): avisa de que es cosa del superadmin");
  const coachesBefore2 = JSON.stringify(win.S.cfg.coaches);
  document.body.insertAdjacentHTML("beforeend", `<div id="m-coach-test3"><input id="coach-edit-name" value="Hackeado"/><select id="coach-edit-role"><option value="superadmin" selected>Superadmin</option></select></div>`);
  win.saveCoachEdit(null);
  document.getElementById("m-coach-test3")?.remove();
  assert(JSON.stringify(win.S.cfg.coaches) === coachesBefore2, "saveCoachEdit(): un entrenador normal nunca puede escribir en S.cfg.coaches, ni autoconcederse superadmin");

  // -- confirmDeleteCoach: no se puede quitar al último superadmin si
  // quedarían entrenadores sin nadie que gestione --
  win._setCurrentCoachId("c-s1");
  const coachesBefore3 = JSON.stringify(win.S.cfg.coaches);
  win.confirmDeleteCoach("c-s1");
  // _confirm ya habrá puesto el diálogo -- hay que pulsar "confirmar" para
  // ejecutar el callback real (igual que el resto de los tests del repo).
  const cbtn = document.querySelector("#m-confirm button");
  if (cbtn) cbtn._cb();
  assert(JSON.stringify(win.S.cfg.coaches) === coachesBefore3,
    "confirmDeleteCoach(): RECHAZA quitar al último superadmin mientras queden otros entrenadores en la lista");

  // -- Pero SÍ se puede vaciar la lista ENTERA (desactivar permisos del
  // todo) -- borrando uno a uno hasta dejarla vacía. --
  win.S.cfg.coaches = [{ id: "solo-super", name: "Solo Super", role: "superadmin", teamsEdit: [], teamsView: [] }];
  win._setCurrentCoachId("solo-super");
  win.confirmDeleteCoach("solo-super");
  const cbtn2 = document.querySelector("#m-confirm button");
  if (cbtn2) cbtn2._cb();
  assert(win.S.cfg.coaches.length === 0, "confirmDeleteCoach(): SÍ permite vaciar la lista por completo (desactivar permisos es la vía normal)");
  assert(win._permissionsActive() === false, "tras vaciar coaches: _permissionsActive() vuelve a false, todos recuperan acceso total");

  // ════════════════════════════════════════════════════════════════
  // 10) Puerta de identidad: _maybeShowIdentityGate/_showIdentityGate/_pickIdentity
  // ════════════════════════════════════════════════════════════════
  freshFixture();
  win.S.cfg.coaches = [
    { id: "g-super", name: "Gate Super", role: "superadmin", teamsEdit: [], teamsView: [] },
    { id: "g-ent", name: "Gate Entrenador", role: "entrenador", teamsEdit: ["t1"], teamsView: [] }
  ];
  win.lsSet("cbj:currentcoachid", "", true);
  document.getElementById("m-identity-gate")?.remove();
  win._maybeShowIdentityGate();
  assert(!!document.getElementById("m-identity-gate"), "_maybeShowIdentityGate(): muestra la puerta si hay permisos activos y nadie ha elegido identidad");
  const gateHtml = document.getElementById("m-identity-gate").innerHTML;
  assert(gateHtml.includes("Gate Super") && gateHtml.includes("Gate Entrenador"), "_showIdentityGate(): lista a TODOS los entrenadores de la lista para elegir");
  win._pickIdentity("g-ent");
  assert(!document.getElementById("m-identity-gate"), "_pickIdentity(): quita la puerta tras elegir");
  assert(win._getCurrentCoachId() === "g-ent", "_pickIdentity(): guarda el id elegido");
  assert(win._myRole() === "entrenador", "_pickIdentity(): el rol efectivo pasa a ser el de la identidad elegida");

  // -- Con permisos ya resueltos, _maybeShowIdentityGate() no debe reabrir nada --
  document.getElementById("m-identity-gate")?.remove();
  win._maybeShowIdentityGate();
  assert(!document.getElementById("m-identity-gate"), "_maybeShowIdentityGate(): no reabre la puerta si ya hay una identidad válida elegida");

  // -- Si entretanto se desactivan los permisos del todo, la puerta no debe
  // aparecer nunca (aunque antes hiciera falta elegir). --
  win.S.cfg.coaches = [];
  win.lsSet("cbj:currentcoachid", "", true);
  document.getElementById("m-identity-gate")?.remove();
  win._maybeShowIdentityGate();
  assert(!document.getElementById("m-identity-gate"), "_maybeShowIdentityGate(): nunca aparece si coaches está vacío (sin restricciones)");

  return report.summary();
}

module.exports = { run };
