"use strict";
// Ejecuta todos los *.test.js de esta carpeta contra el index.html real y
// muestra un resumen final. Salida != 0 si algo falla, para poder engancharlo
// a un hook de pre-commit o a CI mas adelante si se quiere.
//
// Uso:
//   cd tests && npm install && npm test
const fs = require("fs");
const path = require("path");

const testFiles = fs.readdirSync(__dirname)
  .filter(f => f.endsWith(".test.js"))
  .sort();

async function main() {
  let totalPassed = 0, totalFailed = 0, crashed = [];
  console.log("Kortline v3 · suite de regresion · " + testFiles.length + " archivos\n");

  for (const file of testFiles) {
    console.log("=== " + file + " ===");
    try {
      const mod = require(path.join(__dirname, file));
      const { passed, failed } = await mod.run();
      totalPassed += passed;
      totalFailed += failed;
    } catch (err) {
      crashed.push(file);
      console.error("  ERROR (excepcion no controlada): " + err.message);
      console.error(err.stack);
    }
    console.log("");
  }

  console.log("──────────────────────────────");
  console.log(totalPassed + " OK / " + totalFailed + " fallo(s) / " + crashed.length + " archivo(s) con excepcion");
  if (crashed.length) console.log("Archivos con excepcion: " + crashed.join(", "));

  if (totalFailed > 0 || crashed.length > 0) {
    process.exitCode = 1;
  }
}

main();
