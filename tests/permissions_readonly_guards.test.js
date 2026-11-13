"use strict";
// v3.0.0-dev.114 · B-PERM2 (auditoría): un entrenador que solo puede VER un
// equipo conseguía cambiar sus datos desde unos 60 botones que guardaban sin
// comprobar permiso (valoraciones, marcador por cuartos, asistencia al
// partido, reloj, cambios, deshacer, tiempos muertos...). Encontrado con la
// prueba "mono" de tests/e2e/monkey.e2e.js; este test fija en la suite normal
// los casos más representativos, y comprueba que SIN roles activados todo
// sigue funcionando igual que siempre.
const { loadApp, buildFixture, newReporter } = require("./harness.js");

async function setup(readOnly) {
  const win = await loadApp();
  buildFixture(win, { matchMode: "quarters", q: [10, 8, null, null, null, null, null, null] });
  const today = win.td();
  win.S.date = today;
  win.S.sessions = { [win.sk("t1", today)]: { p1: "present", _teamScore: 5 } };
  win.S.cfg.features = Object.assign({}, win.S.cfg.features, { teamScore: true, playerScore: true });
  if (readOnly) {
    win.S.cfg.coaches = [{ id: "sa", name: "Super", role: "superadmin", teamsEdit: [], teamsView: [] }, { id: "ro", name: "Solo ver", role: "entrenador", teamsEdit: [], teamsView: ["t1"] }];
    win._setCurrentCoachId("ro");
  }
  return { win, today };
}
const snap = win => JSON.stringify({ p: win.S.players, m: win.S.matches, s: win.S.sessions, t: win.S.teams });

async function run() {
  const r = newReporter("permissions_readonly_guards");

  // ═══ 1) Solo lectura: nada de esto puede cambiar datos ═══
  {
    const { win } = await setup(true);
    r.assert(win._canViewTeam("t1") && !win._canEditTeam("t1"), "el entrenador de prueba puede VER t1 pero no EDITARLO");
    const acts = {
      "valoración del equipo (stepTeamScore)": () => win.stepTeamScore(1),
      "valoración individual (stepPlayerScore)": () => win.stepPlayerScore("p1", 1),
      "valoración automática (revertTeamScoreAuto)": () => win.revertTeamScoreAuto(),
      "marcador por cuartos (_qStep)": () => win._qStep(0, 1),
      "prórroga manual (addManualOT)": () => win.addManualOT(),
      "asistencia al partido (_mdCycleAtt)": () => win._mdCycleAtt("p1"),
      "quitar foto (removePhoto)": () => win.removePhoto(),
      "puntual (_guestPlayerCommit)": () => win._guestPlayerCommit("att"),
      "reordenar equipos (moveTeamUp)": () => win.moveTeamUp("t1")
    };
    win.S.screen = "att";
    for (const [name, fn] of Object.entries(acts)) {
      const before = snap(win);
      try { fn(); } catch (e) { r.assert(false, name + " lanza excepción: " + e.message); continue; }
      r.assert(snap(win) === before, "solo lectura: " + name + " no cambia ningún dato");
    }
    // Partido en directo YA empezado por otro: se puede mirar, no tocar
    const m = win.S.matches.t1[0];
    m.matchMode = "live";
    m.live = { q: 1, maxQ: 1, qScores: [[4, 2], [0, 0], [0, 0], [0, 0], [0, 0]], teamFouls: [0, 0, 0, 0, 0], stats: {}, rivalStats: {}, log: [{ pid: "p1", action: "p2m", pts: 2, q: 1 }], onCourt: ["p1", "p2", "p3", "p4", "p5"], rivalOnCourt: [], activeTeam: "our", clockSec: 600, clockMins: 10, clockRunning: false, timeouts: { our: [0, 0, 0, 0, 0, 0], rival: [0, 0, 0, 0, 0, 0] }, otCount: 0 };
    win.S.screen = "liveGame"; win.S.matchId = "m1";
    let html = ""; try { html = win.liveGame(); } catch (e) { r.assert(false, "liveGame() en solo lectura lanza: " + e.message); }
    r.assert(typeof html === "string" && html.length > 500, "solo lectura: un directo ya empezado se puede abrir para mirarlo");
    const liveActs = {
      "reloj (toggleClock)": () => win.toggleClock(),
      "cambio (subPlayer)": () => win.subPlayer("p6", "p1"),
      "deshacer (undoLiveAction)": () => win.undoLiveAction(),
      "tiempo muerto (addTimeout)": () => win.addTimeout("our"),
      "puntos del rival (rivalScoreLive)": () => win.rivalScoreLive(2),
      "cambiar de cuarto (setLiveQ)": () => win.setLiveQ(1),
      "anotar (liveAction)": () => win.liveAction("p1", "p2m", 2),
      "terminar (_finishAndShowSummary)": () => win._finishAndShowSummary("t1", "m1"),
      "salir (exitLiveGame)": () => win.exitLiveGame(),
      "guardar cualquier otra cosa (save) no deja latido de presencia": () => { win.S.screen = "liveGame"; win.save(); }
    };
    for (const [name, fn] of Object.entries(liveActs)) {
      const before = snap(win);
      try { fn(); } catch (e) { r.assert(false, name + " lanza excepción: " + e.message); continue; }
      r.assert(snap(win) === before, "solo lectura (directo): " + name + " no cambia ningún dato");
      win.document.querySelectorAll("body > div[id^='m-']").forEach(x => x.remove());
      win.S.screen = "liveGame"; win.S.teamId = "t1"; win.S.matchId = "m1";
    }
    // Un directo SIN empezar no se inicia solo por entrar
    delete m.live; win.S.screen = "liveGame";
    win.liveGame();
    r.assert(!win.S.matches.t1[0].live, "solo lectura: entrar a un directo sin empezar NO lo inicia");
  }

  // ═══ 2) Sin roles (club sin permisos activados): todo sigue funcionando ═══
  {
    const { win, today } = await setup(false);
    win.S.screen = "att";
    win.stepTeamScore(1);
    r.assert(win.S.sessions[win.sk("t1", today)]._teamScore === 6, "sin roles: la valoración del equipo se sigue pudiendo cambiar");
    win.stepPlayerScore("p1", 1);
    r.assert(JSON.stringify(win.S.sessions[win.sk("t1", today)]).includes("p1_score") || /"_ps"|score/.test(JSON.stringify(win.S.sessions[win.sk("t1", today)])), "sin roles: la valoración individual se sigue pudiendo cambiar");
    win.S.screen = "matchDetail";
    const q0 = win.S.matches.t1[0].q[0];
    win._qStep(0, 1);
    r.assert(win.S.matches.t1[0].q[0] === q0 + 1, "sin roles: el marcador por cuartos se sigue pudiendo cambiar");
  }

  // ═══ 3) v3.0.0-dev.116 · B-ROVIEW1: "modo ver" en vez de botones de editar ═══
  {
    const { win, today } = await setup(true);
    const ti = win._weekdayIdxForDate(today);
    win.S.teams.push({ id: "t9", name: "MIO", schedule: { [ti]: "17:00" } });
    win.S.teams[0].schedule = { [ti]: "18:00" };
    win.S.players.t9 = [{ id: "x1", name: "Mía", number: 1 }];
    win.S.matches.t1[0].date = today;
    win.S.cfg.coaches[1].teamsEdit = ["t9"];
    win.navRoot("hoy");
    const h = win.document.getElementById("root").textContent;
    r.assert(/Ver asistencia/.test(h) && /Ver partido/.test(h), "modo ver: en Hoy, el equipo de solo ver ofrece 'Ver asistencia' y 'Ver partido'");
    r.assert((h.match(/Pasar lista/g) || []).length === 1, "modo ver: 'Pasar lista' solo sale en el equipo que sí se puede editar");
    win.navTo("att", { teamId: "t1", date: today, attOpt: false });
    r.assert(!!win.document.querySelector("#root .ro-banner") && win.document.body.classList.contains("ro-mode"), "modo ver: el pase de lista de un equipo de solo ver muestra el aviso y activa el modo ver");
    r.assert([...win.document.querySelectorAll("#root textarea")].every(x => x.readOnly), "modo ver: las notas son de solo lectura");
    win.navTo("att", { teamId: "t9", date: today, attOpt: false });
    r.assert(!win.document.querySelector("#root .ro-banner") && !win.document.body.classList.contains("ro-mode"), "modo ver: en el equipo propio no hay aviso ni modo ver");
    win.navTo("matchList", { teamId: "t1" });
    r.assert(!/Anotar partido|Empezar partido/.test(win.document.getElementById("root").textContent), "modo ver: la lista de partidos no ofrece Anotar/Empezar");
  }

  // ═══ 4) v3.0.0-dev.119 · B-PERM3: lo que un rol no puede hacer NI SE LE
  // OFRECE (antes llegaba hasta el final y un aviso, tapado por la ventana,
  // le decía que no). ═══
  {
    const roles = { entrenador: "e1", director_deportivo: "dd", superadmin: "sa" };
    for (const [role, id] of Object.entries(roles)) {
      const win = await loadApp();
      const today = win.td(), ti = win._weekdayIdxForDate(today);
      win.S.teams = [{ id: "t1", name: "UNO", schedule: { [ti]: "17:00" } }, { id: "t2", name: "DOS" }];
      win.S.players = { t1: [{ id: "p1", name: "Ana", number: 1 }], t2: [] };
      win.S.cfg.seasonStart = "2026-09-01";
      win.S.cfg.seasons = [{ id: "s1", label: "2025-2026", startDate: "2025-09-01", endDate: "2026-08-31" }];
      win.S.cfg.coaches = [{ id: "sa", name: "Super", role: "superadmin", teamsEdit: [], teamsView: [] }, { id: "dd", name: "Dire", role: "director_deportivo", teamsEdit: ["t1"], teamsView: [] }, { id: "e1", name: "Entre", role: "entrenador", teamsEdit: ["t1"], teamsView: ["t2"] }];
      win._setCurrentCoachId(id);
      win.openClubSettings();
      const st = win.document.getElementById("m-club-settings");
      const html = st.innerHTML;
      const canSeasons = role !== "entrenador";
      r.assert(html.includes("openArchiveSeasonModal()") === canSeasons, `${role}: el botón Archivar temporada ${canSeasons ? "aparece" : "NO aparece"}`);
      r.assert(html.includes("confirmDeleteArchivedSeason(") === canSeasons, `${role}: deshacer/quitar temporada ${canSeasons ? "aparece" : "NO aparece"}`);
      r.assert(st.querySelector("#cfg-season-start").disabled === !canSeasons, `${role}: la fecha de inicio de temporada ${canSeasons ? "se puede" : "NO se puede"} cambiar`);
      if (!canSeasons) {
        r.assert(/Solo el superadmin o el director deportivo/.test(st.textContent), "entrenador: se le explica ANTES por qué no puede gestionar temporadas");
        st.querySelector("#cfg-season-start").value = "2026-11-01";
        win.saveClubSettings();
        r.assert(win.S.cfg.seasonStart === "2026-09-01", "entrenador: guardar Ajustes no cambia el inicio de temporada aunque se fuerce el campo");
      }
      r.assert(html.includes("openCoachEditModal(null)") === (role === "superadmin"), `${role}: añadir entrenador ${role === "superadmin" ? "aparece" : "NO aparece"}`);
      win.document.getElementById("m-club-settings")?.remove();
      win.navTo("team", { teamId: "t1" });
      r.assert(win.document.getElementById("root").innerHTML.includes("delTeam()") === (role === "superadmin"), `${role}: Eliminar equipo ${role === "superadmin" ? "aparece" : "NO aparece"} en un equipo que puede editar`);
    }
    // Sin ningún equipo editable, el ＋ de Hoy no se ofrece
    const win = await loadApp();
    win.S.teams = [{ id: "t2", name: "DOS" }];
    win.S.cfg.coaches = [{ id: "sa", name: "Super", role: "superadmin", teamsEdit: [], teamsView: [] }, { id: "v", name: "Ve", role: "entrenador", teamsEdit: [], teamsView: ["t2"] }];
    win._setCurrentCoachId("v");
    win.navRoot("hoy");
    r.assert(!win.document.querySelector("#root .fab-add"), "sin equipos editables, Hoy no ofrece el ＋ de añadir actividad");
    // Los avisos salen por ENCIMA de cualquier ventana
    const z = parseInt(win.getComputedStyle((() => { win.toast("x"); return win.document.querySelector(".toast"); })()).zIndex, 10);
    r.assert(z > 99999, "los avisos (toast) salen por encima de cualquier ventana abierta (z-index " + z + ")");
  }

  return r.summary();
}

module.exports = { run };
if (require.main === module) run().then(({ failed }) => process.exit(failed ? 1 : 0));
