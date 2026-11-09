"use strict";
// v3.0.0-dev.100 · B-VOLTECH1: entrenamientos voluntarios y tecnificaciones,
// pedidos explícitamente por Mario en la auditoría exhaustiva.
//
// v3.0.0-dev.106 · B-VOLTECH3: reescrito por completo. Bug real reportado
// por Mario -- "Susituye la tecnificación a entrenamientos de ese día del
// mismo equipo, eso está mal. Son aparte y estaría bien poder poner la hora
// y mirar una opción de tenificación o entrenamiento voluntario fijos de
// algunos equipos" -- el esquema de B-VOLTECH1 guardaba la sesión opcional
// bajo LA MISMA clave que el entrenamiento normal del día (sk(tid,date)), así
// que crear una tecnificación/voluntario pisaba (o era pisada por) la
// asistencia real del entrenamiento normal de ese mismo equipo y día.
//
// Fix: las sesiones opcionales viven ahora bajo su propia clave, siempre
// distinta (skO() = sk()+"_opt"), en la MISMA colección S.sessions/Firestore
// "sessions" -- sin colección nueva, reutilizando toda la máquina de sync ya
// probada. _teamSessionEntries() decide isOpt por el SUFIJO de la clave, no
// por el campo _optType (para que un día de horario fijo sin tocar aún
// cuente igual como opcional). Añade también: hora opcional al crear una
// sesión puntual desde "Hoy", y horario semanal fijo por equipo
// (t.optSchedule), ambos confirmados con Mario vía AskUserQuestion ("como
// mucho una [sesión opcional] aparte" / "sí, horario semanal fijo").
//
// Decisiones ya confirmadas con AskUserQuestion (no se repiten aquí):
//  - Como mucho UNA sesión opcional aparte del entrenamiento normal por
//    equipo y día (no varias).
//  - Horario semanal fijo (día+hora) para que aparezcan solas en "Hoy".
//
// v3.0.0-dev.107 · B-VOLTECH4: Mario, pedido directo -- "Se tienen que poder
// eliminar entrenamientos voluntarios o tecnificaciones desde el historial
// al igual que el entrenamiento normal, hay que hacer al usuario como debe
// ser que puede cometer errores siempre, y muchos". openDeleteConfirm()/
// execDelete() ganan un 3er parámetro isOpt (igual que el resto de esta
// familia de funciones) para poder borrar también la sesión opcional, y
// hist() añade su propio botón 🗑 en el bloque de voluntarios/tecnificación.
const { loadApp, newReporter } = require("./harness");

async function run() {
  const report = newReporter("voluntary_trainings");
  const win = await loadApp();
  const assert = (cond, msg) => report.assert(cond, msg);

  const today = win.td();

  function freshTeams() {
    win.S.teams = [
      { id: "t1", name: "Cadete Masculino", color: "#F06318", schedule: {} },
      { id: "t2", name: "Infantil Femenino", color: "#1a6fc4", schedule: {} }
    ];
    win.S.players = {
      t1: [{ id: "p1", name: "Jugador Uno", number: 4, addedAt: "2026-07-01" }, { id: "p2", name: "Jugador Dos", number: 5, addedAt: "2026-07-01" }],
      t2: [{ id: "p3", name: "Jugadora Tres", number: 6, addedAt: "2026-07-01" }]
    };
    win.S.matches = {};
    win.S.events = {};
    win.S.sessions = {};
    win.S.teamId = "t1";
    win.S.date = today;
    win.S.attOpt = false;
    win.S.histMonth = null;
  }
  freshTeams();

  // ═══ 1) EL BUG REAL: un entrenamiento NORMAL ya pasado hoy no debe
  // desaparecer ni mezclarse al crear una tecnificación el mismo día, para
  // el mismo equipo -- y viceversa. ═══
  // cycleAtt() CICLA desde el estado efectivo actual (present->absent->
  // late->excused) -- sin marca previa se asume "present" por defecto, así
  // que UN solo cycleAtt() ya avanza a "absent". Para fijar un estado
  // concreto sin depender de cuántas veces haya que pulsar, se escribe la
  // sesión normal directamente (igual que ya hacían los tests existentes
  // de hist()/att() antes de este fix).
  win.S.sessions[win.sk("t1", today)] = { p1: "present", p2: "absent" };
  const normalBefore = { ...win.S.sessions[win.sk("t1", today)] };
  assert(normalBefore.p1 === "present" && normalBefore.p2 === "absent",
    "cycleAtt(): asistencia normal guardada correctamente antes de tocar nada opcional (p1 presente, p2 ausente)");

  win.openHoyAddSheet();
  win._hoyAddPickOptional("tecnificacion");
  const checkboxes = win.document.querySelectorAll("#hoy-opt-teams input[type=checkbox]");
  checkboxes.forEach(cb => { if (cb.value === "t1") cb.checked = true; });
  win._hoyAddCommitOptional("tecnificacion");

  const normalAfter = win.S.sessions[win.sk("t1", today)];
  const optAfter = win.S.sessions[win.skO("t1", today)];
  assert(normalAfter.p1 === "present" && normalAfter.p2 === "absent",
    "B-VOLTECH3 FIX: crear una tecnificación el mismo día NO toca ni pisa la asistencia normal ya pasada (antes del fix, era la misma clave y se perdía)");
  assert(optAfter && optAfter._optType === "tecnificacion",
    "_hoyAddCommitOptional(): crea la sesión opcional bajo su PROPIA clave (skO), separada de la normal");
  assert(win.S.teamId === "t1", "_hoyAddCommitOptional(): navega al pase de lista del primer equipo elegido");

  // ── Y al revés: pasar lista normal DESPUÉS de crear la opcional tampoco
  // debe tocarla. ──
  win.S.attOpt = false;
  win.cycleAtt("p1"); // present -> absent en la sesión NORMAL
  assert(win.S.sessions[win.sk("t1", today)].p1 === "absent",
    "cycleAtt() tras crear la opcional sigue escribiendo en la clave normal con normalidad");
  assert(win.S.sessions[win.skO("t1", today)]._optType === "tecnificacion",
    "B-VOLTECH3 FIX (al revés): seguir pasando lista normal NO toca la sesión opcional ya creada");
  win.S.attOpt = true; // deja el flag como lo espera el resto del archivo

  // ═══ 2) Multi-equipo real (varios checkboxes a la vez) -- ya lo cubría
  // B-VOLTECH1, sigue cubierto con la clave nueva. ═══
  freshTeams();
  win.openHoyAddSheet();
  win._hoyAddPickOptional("voluntario");
  const cbsMulti = win.document.querySelectorAll("#hoy-opt-teams input[type=checkbox]");
  assert(cbsMulti.length === 2, "_hoyAddPickOptional(): un checkbox por cada equipo del club");
  cbsMulti.forEach(cb => { cb.checked = true; });
  win._hoyAddCommitOptional("voluntario");
  const sessT1 = win.S.sessions[win.skO("t1", today)];
  const sessT2 = win.S.sessions[win.skO("t2", today)];
  assert(sessT1 && sessT1._optType === "voluntario", "_hoyAddCommitOptional(): crea la sesión opcional de t1 (multi-equipo real)");
  assert(sessT2 && sessT2._optType === "voluntario", "_hoyAddCommitOptional(): crea la sesión opcional de t2 (multi-equipo real)");

  // ═══ 3) Hora opcional al crear una sesión puntual desde "Hoy" ═══
  freshTeams();
  win.openHoyAddSheet();
  win._hoyAddPickOptional("tecnificacion");
  win.document.getElementById("hoy-opt-time").value = "18:30";
  win.document.querySelectorAll("#hoy-opt-teams input[type=checkbox]").forEach(cb => { if (cb.value === "t1") cb.checked = true; });
  win._hoyAddCommitOptional("tecnificacion");
  assert(win.S.sessions[win.skO("t1", today)]._time === "18:30",
    "_hoyAddCommitOptional(): guarda la hora puesta en el campo opcional");

  // Sin hora puesta (campo vacío) -> no se guarda ningún _time.
  freshTeams();
  win.openHoyAddSheet();
  win._hoyAddPickOptional("voluntario");
  win.document.querySelectorAll("#hoy-opt-teams input[type=checkbox]").forEach(cb => { if (cb.value === "t2") cb.checked = true; });
  win._hoyAddCommitOptional("voluntario");
  assert(!("_time" in win.S.sessions[win.skO("t2", today)]),
    "_hoyAddCommitOptional(): sin hora puesta, no se guarda ningún campo _time");

  // ═══ 4) Cambiar de tipo (voluntario -> tecnificación) una sesión que YA
  // era opcional conserva la asistencia ya tomada (misma clave, solo
  // cambia la etiqueta _optType). ═══
  freshTeams();
  win.S.sessions[win.skO("t1", today)] = { _optType: "voluntario", p1: "present" };
  win.openHoyAddSheet();
  win._hoyAddPickOptional("tecnificacion");
  win.document.querySelectorAll("#hoy-opt-teams input[type=checkbox]").forEach(cb => { if (cb.value === "t1") cb.checked = true; });
  win._hoyAddCommitOptional("tecnificacion");
  const changed = win.S.sessions[win.skO("t1", today)];
  assert(changed._optType === "tecnificacion" && changed.p1 === "present",
    "_hoyAddCommitOptional(): permite cambiar el tipo de una sesión que YA era opcional, sin perder la asistencia ya tomada");

  // ═══ 5) att(): aviso morado + botón "Confirmar sesión" en una opcional
  // recién creada (sin nadie marcado todavía) ═══
  freshTeams();
  win.openHoyAddSheet();
  win._hoyAddPickOptional("tecnificacion");
  win.document.querySelectorAll("#hoy-opt-teams input[type=checkbox]").forEach(cb => { if (cb.value === "t1") cb.checked = true; });
  win._hoyAddCommitOptional("tecnificacion"); // navega con attOpt:true
  assert(win.S.attOpt === true, "_hoyAddCommitOptional(): navega al pase de lista con S.attOpt=true (sesión opcional)");
  let attHtml = win.att();
  assert(attHtml.includes("Tecnificación") && attHtml.includes("NO cuentan para el % oficial"),
    "att(): muestra el aviso de tecnificación cuando S.attOpt=true y la sesión opcional tiene _optType");
  assert(attHtml.includes("✅ Confirmar sesión") && !attHtml.includes("Autoguardado activo"),
    "B-VOLTECH2 (conservado): justo tras crear la sesión opcional, sin que nadie haya pasado lista aún, el botón Confirmar sesión SÍ aparece");

  win.confirmSession();
  const optAfterConfirm = win.S.sessions[win.skO("t1", today)];
  assert(optAfterConfirm.p1 === "present" && optAfterConfirm.p2 === "present",
    "confirmSession(): marca explícitamente presentes a los dos jugadores DENTRO de la sesión opcional (skO), no en la normal");
  assert(optAfterConfirm._optType === "tecnificacion", "confirmSession(): conserva el _optType de la sesión opcional");
  assert(win.S.sessions[win.sk("t1", today)] === undefined,
    "confirmSession() en una sesión opcional NUNCA crea de paso una sesión normal para ese día");

  const attHtmlAfterConfirm = win.att();
  assert(!attHtmlAfterConfirm.includes("✅ Confirmar sesión") && attHtmlAfterConfirm.includes("Autoguardado activo"),
    "tras confirmar, el botón desaparece y se sustituye por el indicador de autoguardado, igual que en un entrenamiento normal");

  // ── "Contador aparte": _optionalAttCount nunca toca el % oficial ──
  const p1 = win.S.players.t1[0], p2 = win.S.players.t1[1];
  const c1AfterConfirm = win._optionalAttCount(p1, "t1");
  const c2AfterConfirm = win._optionalAttCount(p2, "t1");
  assert(c1AfterConfirm.asistidas === 1 && c2AfterConfirm.asistidas === 1,
    "_optionalAttCount(): tras confirmar, cuenta la asistencia de los dos jugadores en la sesión opcional");

  // Reconstruir sin asistencia para los bloques de abajo.
  win.S.sessions[win.skO("t1", today)] = { _optType: "tecnificacion" };
  win.S.sessions[win.skO("t1", today)].p1 = "present";
  win.S.sessions[win.skO("t1", today)].p2 = "absent";
  const c1 = win._optionalAttCount(p1, "t1");
  const c2 = win._optionalAttCount(p2, "t1");
  assert(c1.asistidas === 1 && c1.total === 1, "_optionalAttCount(): p1 (presente) cuenta 1 asistencia de 1 sesión opcional");
  assert(c2.asistidas === 0 && c2.total === 1, "_optionalAttCount(): p2 (ausente) cuenta 0 asistencias -- la ausencia no suma, pero tampoco resta");

  // ═══ 6) hist(): fila OFICIAL navega con attOpt:false, fila OPCIONAL con
  // attOpt:true -- nunca se mezclan en el mismo listado ═══
  freshTeams();
  win.S.sessions = {
    [win.sk("t1", win._addDaysISO(today, -5))]: { p1: "present", p2: "present" },
    [win.skO("t1", today)]: { _optType: "tecnificacion", p1: "present", p2: "absent" }
  };
  win.S.teamId = "t1";
  let histHtml = "";
  try { histHtml = win.hist(); } catch (e) { report.assert(false, "hist() no debe lanzar excepción con sesiones opcionales: " + e.message); }
  assert(!!histHtml, "hist() no lanza excepción con sesiones opcionales en juego");
  if (histHtml) {
    assert(histHtml.includes("Voluntarios / tecnificación"), "hist(): muestra el bloque separado de sesiones opcionales");
    assert(histHtml.includes("1 asistieron de 2"), "hist(): cuenta bien asistencias dentro del bloque opcional (p1 presente, p2 ausente -> 1 de 2)");
    assert(histHtml.includes(`S.attOpt=false;S.date='${win._addDaysISO(today, -5)}';navTo('att')`),
      "hist(): la fila OFICIAL navega con S.attOpt=false");
    assert(histHtml.includes(`S.attOpt=true;S.date='${today}';navTo('att')`),
      "hist(): la fila OPCIONAL navega con S.attOpt=true");
    // La fila oficial NUNCA debe contar como 1 de las "Voluntarios/tecnificación".
    assert(!histHtml.includes(`<div style="font-family:var(--font-d);font-weight:900;font-size:18px">1 sesiones`),
      "hist(): el total de sesiones oficiales del encabezado no incluye la opcional");
  }

  // ═══ 7) hoy(): horario semanal FIJO de voluntario/tecnificación por
  // equipo (t.optSchedule) -- aparece solo, en su propia tarjeta, el día de
  // la semana configurado, AUNQUE AÚN NO SE HAYA CREADO NINGUNA SESIÓN. ═══
  freshTeams();
  const ti = win._weekdayIdxForDate(today);
  win.S.teams[0].optSchedule = { type: "tecnificacion", schedule: { [ti]: "19:00" } };
  win.S.hoyDate = null;
  let hoyHtml = win.hoy();
  assert(hoyHtml.includes("🎯 TECNIFICACIÓN"), "hoy(): equipo con horario fijo de tecnificación hoy muestra su propia tarjeta, sin haber creado ninguna sesión todavía");
  assert(hoyHtml.includes("🙋 VOLUNTARIOS / TECNIFICACIÓN"), "hoy(): el bloque opcional tiene su propio encabezado, separado de ENTRENAMIENTOS");
  assert(hoyHtml.includes("navTo('att',{teamId:'t1',date:'" + today + "',attOpt:true})"), "hoy(): el botón de pasar lista de la tarjeta opcional navega con attOpt:true");
  assert(hoyHtml.includes("19:00h"), "hoy(): la tarjeta opcional muestra la hora fija configurada");

  // Un equipo SIN horario fijo pero con una sesión puntual ya creada hoy
  // (vía "Hoy" -> Añadir actividad) también debe aparecer en ese bloque.
  freshTeams();
  win.S.sessions[win.skO("t2", today)] = { _optType: "voluntario" };
  win.S.hoyDate = null;
  hoyHtml = win.hoy();
  assert(hoyHtml.includes("🙋 VOLUNTARIO"), "hoy(): una sesión opcional puntual (sin horario fijo) también aparece en el bloque opcional");

  // Coexistencia real: el MISMO equipo tiene entrenamiento normal Y
  // tecnificación hoy -- deben verse DOS tarjetas distintas, cada una con
  // su propio estado de asistencia, nunca una sola tarjeta mezclada.
  freshTeams();
  win.S.teams[0].schedule = { [ti]: "17:00" };
  win.S.teams[0].optSchedule = { type: "voluntario", schedule: { [ti]: "19:00" } };
  win.S.sessions[win.sk("t1", today)] = { p1: "present" }; // normal ya pasada
  win.S.hoyDate = null;
  hoyHtml = win.hoy();
  assert(hoyHtml.includes("🏋️ ENTRENAMIENTO") && hoyHtml.includes("🙋 VOLUNTARIO"),
    "hoy(): un equipo con entrenamiento normal Y voluntario fijo el mismo día muestra las DOS tarjetas, nunca solo una");
  assert((hoyHtml.match(/CADETE MASCULINO/gi) || []).length >= 2,
    "hoy(): el nombre del equipo aparece en ambas tarjetas (normal + opcional), confirmando que son dos tarjetas separadas");

  // ═══ 8) Migración de datos antiguos (esquema buggy de B-VOLTECH1: misma
  // clave que la normal, con _optType puesto) -- load() debe moverlos a su
  // propia clave "_opt" sin perder nada, de forma automática y una sola vez. ═══
  {
    const legacyKey = win.sk("t1", win._addDaysISO(today, -3));
    win.localStorage.setItem(win._lsKey ? win._lsKey("cbj:s") : "cbj:s", JSON.stringify({
      [legacyKey]: { _optType: "voluntario", p1: "present" },
      [win.sk("t1", win._addDaysISO(today, -4))]: { p1: "present", p2: "present" } // normal real, no debe tocarse
    }));
    win.load();
    assert(!(legacyKey in win.S.sessions), "load(): migración -- la clave antigua (compartida, con _optType) ya no existe tras cargar");
    assert(win.S.sessions[legacyKey + "_opt"] && win.S.sessions[legacyKey + "_opt"]._optType === "voluntario" && win.S.sessions[legacyKey + "_opt"].p1 === "present",
      "load(): migración -- los datos se movieron intactos a la clave nueva con sufijo _opt");
    assert(win.S.sessions[win.sk("t1", win._addDaysISO(today, -4))].p1 === "present",
      "load(): migración -- una sesión normal real (sin _optType) no se toca para nada");
    // Y se persiste de inmediato en localStorage, no solo en memoria.
    const persisted = JSON.parse(win.localStorage.getItem(win._lsKey ? win._lsKey("cbj:s") : "cbj:s"));
    assert(!(legacyKey in persisted) && !!persisted[legacyKey + "_opt"],
      "load(): migración -- el resultado se guarda también en localStorage, no solo en S.sessions en memoria");
  }

  // ═══ 9) equiposScreen() / team(): las estadísticas de resumen (Entrenos,
  // Asist., Último entreno, badge de Historial) EXCLUYEN las sesiones
  // opcionales -- si no, una tecnificación inflaría esos números o rompería
  // "Último entreno" con una fecha que no debería contar como oficial. ═══
  freshTeams();
  win.S.sessions = {
    [win.sk("t1", "2026-10-01")]: { p1: "present", p2: "present" },
    [win.skO("t1", "2026-10-20")]: { _optType: "tecnificacion", p1: "present" } // más reciente, pero OPCIONAL
  };
  win.S.teamId = "t1";
  let eqHtml = "";
  try { eqHtml = win.equiposScreen(); } catch (e) { report.assert(false, "equiposScreen() no debe lanzar excepción con sesiones opcionales mezcladas: " + e.message); }
  assert(!!eqHtml, "equiposScreen() no lanza excepción con sesiones opcionales mezcladas");
  assert(!/Invalid Date/i.test(eqHtml), "equiposScreen(): nunca muestra 'Invalid Date' aunque la sesión más reciente sea opcional");
  const tsBadge = win._teamSessionEntries("t1").length;
  assert(tsBadge === 1, "_teamSessionEntries('t1') (oficial, sin includeOptional) cuenta solo 1 -- la tecnificación no cuenta como entreno oficial");
  win.S.screen = "team";
  const teamHtml = win.team();
  assert(!/Invalid Date/i.test(teamHtml), "team(): tampoco muestra 'Invalid Date' en su propia pantalla");

  // ═══ 10) B-VOLTECH4: borrar una sesión opcional desde el Historial, igual
  // que ya se podía borrar la normal -- pedido directo de Mario ("hay que
  // hacer al usuario como debe ser que puede cometer errores siempre, y
  // muchos"). ═══
  freshTeams();
  win.S.sessions[win.sk("t1", win._addDaysISO(today, -2))] = { p1: "present", p2: "present" };
  win.S.sessions[win.skO("t1", win._addDaysISO(today, -1))] = { _optType: "voluntario", p1: "present" };
  win.S.teamId = "t1";
  win.S.screen = "hist";
  const histHtmlDel = win.hist();
  assert(histHtmlDel.includes(`openDeleteConfirm('t1','${win._addDaysISO(today, -2)}',false)`),
    "hist(): la fila OFICIAL sigue teniendo su botón de borrar, con isOpt=false explícito");
  assert(histHtmlDel.includes(`openDeleteConfirm('t1','${win._addDaysISO(today, -1)}',true)`),
    "B-VOLTECH4: la fila OPCIONAL ahora también tiene su propio botón de borrar, con isOpt=true");

  // openDeleteConfirm(...,true) construye el modal sobre la sesión OPCIONAL
  // (no la normal), con su propia insignia morada, y pasa isOpt=true al
  // botón de confirmar.
  win.openDeleteConfirm("t1", win._addDaysISO(today, -1), true);
  const delModalHtml = win.document.getElementById("m-del")?.innerHTML || "";
  assert(delModalHtml.includes("🙋 Voluntario"), "openDeleteConfirm(isOpt=true): el modal identifica la sesión como voluntaria, no como un entrenamiento oficial");
  assert(delModalHtml.includes("execDelete('t1','" + win._addDaysISO(today, -1) + "',true)"),
    "openDeleteConfirm(isOpt=true): el botón de confirmar pasa isOpt=true a execDelete()");
  win.document.getElementById("m-del")?.remove();

  // execDelete(...,true) borra SOLO la clave opcional (skO) -- la sesión
  // normal de otro día (y, sobre todo, una normal del MISMO equipo que
  // existiera el mismo día) debe sobrevivir intacta.
  win.S.sessions[win.sk("t1", win._addDaysISO(today, -1))] = { p3: "present" }; // normal del MISMO día, para comprobar que no se toca
  win.execDelete("t1", win._addDaysISO(today, -1), true);
  assert(win.S.sessions[win.skO("t1", win._addDaysISO(today, -1))] === undefined,
    "execDelete(isOpt=true): borra la sesión opcional de ese día");
  assert(win.S.sessions[win.sk("t1", win._addDaysISO(today, -1))] && win.S.sessions[win.sk("t1", win._addDaysISO(today, -1))].p3 === "present",
    "B-VOLTECH4 (separación conservada): borrar la sesión OPCIONAL de un día NUNCA toca la sesión NORMAL de ese mismo día y equipo");

  // Y al revés: execDelete(...,false) (comportamiento de siempre, sin
  // cambios) borra solo la normal, deja la opcional intacta si la hay.
  const dOther = win._addDaysISO(today, -7);
  win.S.sessions[win.sk("t1", dOther)] = { p1: "present" };
  win.S.sessions[win.skO("t1", dOther)] = { _optType: "tecnificacion", p2: "present" };
  win.execDelete("t1", dOther, false);
  assert(win.S.sessions[win.sk("t1", dOther)] === undefined, "execDelete(isOpt=false): borra la sesión normal de ese día");
  assert(win.S.sessions[win.skO("t1", dOther)] && win.S.sessions[win.skO("t1", dOther)]._optType === "tecnificacion",
    "execDelete(isOpt=false): no toca la sesión opcional de ese mismo día");

  // Mismo guarda de permisos de siempre (_requireEdit), también para la
  // opcional -- un entrenador sin permiso de edición sobre ese equipo no
  // puede borrar ninguna de las dos.
  win.S.cfg.coaches = [{ id: "c1", role: "entrenador", teamsEdit: [] }];
  win._setCurrentCoachId("c1");
  const dGuard = win._addDaysISO(today, -9);
  win.S.sessions[win.skO("t1", dGuard)] = { _optType: "voluntario", p1: "present" };
  win.execDelete("t1", dGuard, true);
  assert(!!win.S.sessions[win.skO("t1", dGuard)], "execDelete(isOpt=true): respeta _requireEdit() -- un entrenador sin permiso sobre t1 no puede borrar su sesión opcional");
  win.S.cfg.coaches = [];
  win._setCurrentCoachId("");

  return report.summary();
}

module.exports = { run };
