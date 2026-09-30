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

  // v3.0.0-dev.79: varios tests arrancan una sesión de "Ejercicios en vivo"
  // (Contraataque de 11 / Final de partido), que usa un setInterval() real
  // de 1 segundo para el cronómetro (startDlsTimer/_dlsCmpView) -- cada test
  // individual se ejecuta con `if (require.main === module) run().then(...
  // process.exit(...))`, así que ese process.exit() de cada archivo
  // ignora esos temporizadores sin más. Pero esta suite combinada (run-all)
  // nunca llamaba a process.exit() -- así que, con bastantes archivos
  // arrancando cronómetros reales (y ninguno limpiándolos, porque no hace
  // falta cuando el test se ejecuta solo), Node se queda esperando a que
  // TODOS esos intervalos acaben de contar hacia atrás de verdad antes de
  // salir -- puede tardar minutos reales aunque el resumen ya se haya
  // impreso y todo haya ido bien. Salir explícitamente aquí, con el mismo
  // código de salida que ya se había decidido arriba, es exactamente lo que
  // ya hace cada test por su cuenta.
  process.exit(process.exitCode || 0);
}

main();
