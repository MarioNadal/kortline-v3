"use strict";
const { loadApp, newReporter } = require("./harness");

async function run() {
  const report = newReporter("short_name");
  const win = await loadApp();
  win.S.teamId = "t1";

  // Sin colision: se usa el primer nombre (o el segundo si el primero
  // parece una inicial).
  win.S.players = { t1: [{ id: "p1", name: "Ana García" }] };
  report.assert(win._shortName("Ana García") === "Ana", "sin colision, usa el nombre de pila");

  // Colision: dos jugadoras que comparten la primera palabra del nombre
  // deben poder distinguirse (bug real arreglado antes de esta sesion:
  // ambas se mostraban como "Ana" sin forma de diferenciarlas).
  win.S.players = { t1: [{ id: "p1", name: "Ana García" }, { id: "p2", name: "Ana Soto" }] };
  const s1 = win._shortName("Ana García");
  const s2 = win._shortName("Ana Soto");
  report.assert(s1 !== s2, "dos jugadoras 'Ana' se distinguen entre si");
  report.assert(s1.startsWith("Ana") && s2.startsWith("Ana"), "ambas conservan el nombre de pila compartido como base");

  // Iniciales: si el primer "nombre" es una inicial (1-2 letras o termina en
  // punto), se usa la siguiente palabra en su lugar.
  win.S.players = { t1: [{ id: "p1", name: "M. Rodríguez" }] };
  report.assert(win._shortName("M. Rodríguez") === "Rodríguez", "una inicial al principio se salta en favor del apellido");

  return report.summary();
}

module.exports = { run };
