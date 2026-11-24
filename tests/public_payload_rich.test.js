"use strict";
// v3.0.0-dev.130 · B-PUBLIC3: marcador para familias con apartados.
const { loadApp, newReporter } = require("./harness.js");
async function run() {
  const r = newReporter("public_payload_rich");
  const win = await loadApp(); const doc = win.document;
  const clear = () => doc.querySelectorAll("body > div[id^='m-']").forEach(x => x.remove());
  win.S.cfg.features = Object.assign({}, win.S.cfg.features, { chainPrompt: false });
  win.S.teams = [{ id: "t1", name: "JUNIOR MASCULINO" }];
  win.S.players = { t1: ["Unai Pérez Gil", "Pablo Gil", "Hugo Sanz", "Leo Martín", "Mario Ruiz", "Iker López", "Dani Gómez"].map((n, i) => ({ id: "p" + i, name: n, number: [4, 5, 7, 8, 10, 11, 12][i] })) };
  const conv = win.S.players.t1.map(p => p.id);
  const rp = Array.from({ length: 6 }, (_, i) => ({ id: "r" + i, name: "Rival Apellido " + i, number: 20 + i }));
  win.S.matches = { t1: [{ id: "m1", date: win.td(), rival: "CB Alfindén", location: "away", quarters: 4, qMins: 10, matchMode: "live", convocados: conv, titulares: conv.slice(0, 5), rivalPlayers: rp, rivalStatsEnabled: true }] };
  win.save(); win.navTo("liveGame", { teamId: "t1", matchId: "m1" });
  const m = win.mById("t1", "m1");
  win.liveAction("p0", "p2m", 2); clear();
  win.liveAction("p1", "p3m", 3); clear();
  win.liveAction("r0", "p2m", 2); clear();
  m.live.activeTeam = "rival"; win.liveTeamAction("p1m", 1); m.live.activeTeam = "our"; clear();
  win.liveAction("p0", "rd", 0); win.liveAction("p2", "foul", 0); clear();
  m.live.q = 2; m.live.maxQ = 2; win._ensureQSlot(m.live, 1);
  win.liveAction("p3", "p2a", 0); win.liveAction("p0", "ast", 0); clear();
  win.addTimeout("our"); clear();
  const pay = win._publicPayload("t1", m);
  r.assert(pay.ours === 5 && pay.theirs === 3, "Marcador 5-3");
  r.assert(pay.plays.length >= 8 && pay.plays[0].a === "Tiempo muerto", "Jugadas: la más reciente primero");
  r.assert(pay.plays.find(x => x.a === "+3 Triple").w === "#5 Pablo" && pay.plays.find(x => x.a === "+3 Triple").s === "5-0", "Jugada con dorsal, nombre corto y marcador tras ella (5-0)");
  r.assert(pay.plays.filter(x => x.k === "r").every(x => !/Apellido/.test(x.w)) && pay.plays.some(x => x.w === "#20 CB Alfindén"), "Del rival: solo dorsal y nombre del club, nunca nombres de sus jugadores");
  r.assert(!JSON.stringify(pay).includes("Pérez Gil"), "Nunca el apellido completo de las nuestras");
  r.assert(pay.plays.some(x => x.q === "Q2") && pay.plays.some(x => x.q === "Q1"), "Cada jugada lleva su cuarto");
  r.assert(pay.stats.o.p2m === 1 && pay.stats.o.p3m === 1 && pay.stats.o.p2a === 1 && pay.stats.o.rd === 1 && pay.stats.o.ast === 1 && pay.stats.o.f === 1, "Estadísticas de nuestro equipo");
  r.assert(pay.stats.r.p2m === 1 && pay.stats.r.p1m === 1, "Estadísticas del rival (jugador + equipo)");
  const unai = pay.players.find(x => x.n === "#4 Unai");
  r.assert(unai && unai.pt === 2 && unai.rb === 1 && unai.as === 1 && unai.on === true, "Jugadoras: puntos, rebotes, asistencias y si está en pista");
  r.assert(pay.players[0].pt >= pay.players[pay.players.length - 1].pt && !pay.players.some(x => /Dani/.test(x.n)), "Jugadoras: ordenadas por puntos y solo las que han jugado");
  r.assert(pay.fouls.o === 0 && pay.tm && pay.tm.o === 1, "Faltas del cuarto actual y tiempos muertos de la mitad");
  // Si el marcador de las jugadas no cuadrara (p.ej. puntos corregidos a mano), no se inventa
  m.live.qScores[1][0] += 7;
  const pay2 = win._publicPayload("t1", m);
  r.assert(pay2.plays.every(x => x.s === undefined), "Si las jugadas no cuadran con el marcador real, no se muestra el marcador por jugada");
  r.assert(JSON.stringify(pay).length < 20000, "Tamaño pequeño (menos de 20 KB por envío)");
  r.assert("logo" in pay && pay.logo === null, "Sin escudo en Ajustes: el campo del escudo va vacío");
  const page = require("fs").readFileSync(require("path").join(__dirname, "..", "marcador.html"), "utf8");
  r.assert(/data:image\\\/\(jpeg\|png\|webp\);base64/.test(page), "La página solo pinta el escudo si es una imagen válida (data:image/jpeg|png|webp)");
  return r.summary();
}
module.exports = { run };
if (require.main === module) run().then(({ failed }) => process.exit(failed ? 1 : 0));
