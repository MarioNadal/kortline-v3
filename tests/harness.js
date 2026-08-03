"use strict";
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const INDEX_HTML_PATH = path.join(__dirname, "..", "index.html");

// Nota: _tlPaused NO esta en esta lista a proposito -- en index.html solo
// existe como window._tlPaused (el propio codigo lo escribe ahi
// directamente), nunca como "let _tlPaused" de scope global, asi que
// intentar leerlo como identificador suelto lanzaria ReferenceError.
const EXPOSED_GLOBALS = [
  "S",
  "_liveHeartbeatMatchId",
  "_TL_PAUSABLE"
];

function buildBridgeScript() {
  // Cada asignacion va en su propio try/catch: si algun dia una de estas
  // variables cambia de nombre en index.html, que falle SOLO esa (con un
  // aviso por consola) en vez de abortar el resto del script puente.
  const assigns = EXPOSED_GLOBALS.map(name =>
    "try{window." + name + "=" + name + ";}catch(e){console.error('[harness] no se pudo exponer " + name + ":',e.message);}"
  ).join("");
  return "<script>" + assigns +
    "try{Object.defineProperty(window,\"_liveHeartbeatMatchId\",{get:()=>_liveHeartbeatMatchId,set:v=>{_liveHeartbeatMatchId=v;}});}" +
    "catch(e){console.error('[harness] no se pudo enlazar _liveHeartbeatMatchId:',e.message);}" +
    "</script>";
}

function loadApp() {
  let html = fs.readFileSync(INDEX_HTML_PATH, "utf-8");
  html = html.replace("</body>", buildBridgeScript() + "</body>");

  const dom = new JSDOM(html, {
    runScripts: "dangerously",
    resources: "usable",
    url: "https://marionadal.github.io/kortline-v3/",
    beforeParse(window) {
      window.matchMedia = window.matchMedia || function () {
        return { matches: false, addListener() {}, removeListener() {} };
      };
      window.requestAnimationFrame = window.requestAnimationFrame || (cb => setTimeout(cb, 0));
      window.cancelAnimationFrame = window.cancelAnimationFrame || clearTimeout;
    }
  });

  const win = dom.window;
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const TIMEOUT_MS = 8000;
    (function poll() {
      if (typeof win.S !== "undefined") { resolve(win); return; }
      if (Date.now() - start > TIMEOUT_MS) {
        reject(new Error("La app no termino de cargar en " + TIMEOUT_MS + "ms"));
        return;
      }
      setTimeout(poll, 100);
    })();
  });
}

function buildFixture(win, matchOverrides) {
  win.S.teamId = "t1";
  win.S.teams = [{ id: "t1", name: "Mi Equipo", color: "#F06318" }];
  win.S.players = {
    t1: [
      { id: "p1", name: "Ana García", number: 4 },
      { id: "p2", name: "Bea López", number: 5 },
      { id: "p3", name: "Cata Ruiz", number: 6 },
      { id: "p4", name: "Dana Soto", number: 7 },
      { id: "p5", name: "Eva Prat", number: 8 },
      { id: "p6", name: "Fina Ortiz", number: 9 }
    ]
  };
  const convocados = ["p1", "p2", "p3", "p4", "p5", "p6"];
  const match = Object.assign({
    id: "m1", rival: "Rival CB", quarters: 4, qMins: 10, stopOnFoul: true,
    convocados, rivalPlayers: [{ id: "r1", name: "Rival Uno", number: 10 }]
  }, matchOverrides || {});
  win.S.matches = { t1: [match] };
  win.S.matchId = "m1";
  return match;
}

function newReporter(label) {
  let passed = 0, failed = 0;
  return {
    assert(cond, msg) {
      if (cond) { passed++; console.log("  PASS: " + msg); }
      else { failed++; console.error("  FAIL: " + msg); }
    },
    summary() {
      console.log("[" + label + "] " + passed + " OK / " + failed + " fallo(s)");
      return { passed, failed };
    }
  };
}

module.exports = { loadApp, buildFixture, newReporter, INDEX_HTML_PATH };
