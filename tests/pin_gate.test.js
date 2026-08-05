"use strict";
// v1.8.37 · B-PIN1: el input del codigo/PIN de club llevaba
// inputmode="numeric", que en movil fuerza el teclado SOLO numerico -- pero
// el "PIN" es literalmente la contraseña de la cuenta de Firebase Auth
// compartida y puede llevar letras. Con ese atributo era imposible
// escribirlas (no hay forma de cambiar de teclado en ese modo). Comprueba
// que ya no se restringe el teclado y que el campo sigue enmascarando el
// valor como contraseña.
const { loadApp, newReporter } = require("./harness");

async function run() {
  const report = newReporter("pin_gate");
  const assert = (cond, msg) => report.assert(cond, msg);

  const win = await loadApp();
  win._showPinGate();
  const input = win.document.getElementById("pin-input");
  assert(!!input, "_showPinGate() crea el campo del código del club");
  assert(input.getAttribute("inputmode") !== "numeric", "el campo ya NO fuerza el teclado numérico -- ANTES no dejaba escribir letras en el código real");
  assert(input.type === "password", "el campo sigue siendo de tipo password (oculta el código al escribirlo)");

  // El propio valor del campo nunca estuvo restringido a dígitos (no hay
  // pattern ni oninput que filtre) -- comprobamos que de verdad se puede
  // escribir un código con letras y números mezclados sin que se pierda nada.
  input.value = "Jaca2026!";
  assert(input.value === "Jaca2026!", "se puede escribir un código con letras, números y símbolos sin que el campo lo recorte o filtre");

  return report.summary();
}

module.exports = { run };
if (require.main === module) {
  run().then(({ failed }) => process.exit(failed > 0 ? 1 : 0));
}
