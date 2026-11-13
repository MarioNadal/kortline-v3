"use strict";
// v3.0.0-dev.123 · B-PIN1: contraseña por entrenador.
const { loadApp, newReporter } = require("./harness.js");
async function run() {
  const r = newReporter("coach_pin");
  const win = await loadApp(); const doc = win.document;
  const $ = id => doc.getElementById(id);
  const type = (id, v) => { $(id).value = v; };
  win.S.teams = [{ id: "t1", name: "ALEVÍN" }];
  win.S.cfg.coaches = [{ id: "sa", name: "Mario", role: "superadmin", teamsEdit: [], teamsView: [] }, { id: "e", name: "Laura", role: "entrenador", teamsEdit: ["t1"], teamsView: [] }];
  win.save(); win._setCurrentCoachId(""); win._showIdentityGate();
  r.assert(/_identityTap\('e'\)/.test($("m-identity-gate").innerHTML), "B-PIN1: elegir nombre pasa por la contraseña");
  // Crear al entrar
  win._identityTap("e");
  r.assert(!!$("pin-2") && /Crea tu contraseña/.test($("m-coach-pin").textContent), "B-PIN1: sin contraseña, la crea al entrar");
  type("pin-1", "12"); type("pin-2", "12"); win._submitPinModal("e", "create");
  r.assert(/Mínimo 4/.test($("pin-msg").textContent) && win._getCurrentCoachId() === "", "B-PIN1: exige mínimo 4 caracteres");
  type("pin-1", "1234"); type("pin-2", "1235"); win._submitPinModal("e", "create");
  r.assert(/no coinciden/.test($("pin-msg").textContent), "B-PIN1: las dos tienen que coincidir");
  type("pin-1", "1234"); type("pin-2", "1234"); win._submitPinModal("e", "create");
  const laura = () => win.S.cfg.coaches.find(c => c.id === "e");
  r.assert(win._getCurrentCoachId() === "e" && !$("m-coach-pin"), "B-PIN1: al crearla entra");
  r.assert(laura().pinHash && laura().pinHash.length === 64 && !JSON.stringify(win.S.cfg).includes("1234"), "B-PIN1: solo se guarda la huella, nunca la contraseña");
  // Entrar con contraseña
  win._setCurrentCoachId(""); win._identityTap("e");
  r.assert(!$("pin-2") && /Hola, Laura/.test($("m-coach-pin").textContent), "B-PIN1: con contraseña, la pide");
  type("pin-1", "0000"); win._submitPinModal("e", "enter");
  r.assert(/incorrecta/.test($("pin-msg").textContent) && win._getCurrentCoachId() === "", "B-PIN1: contraseña mala no entra");
  type("pin-1", "1234"); win._submitPinModal("e", "enter");
  r.assert(win._getCurrentCoachId() === "e", "B-PIN1: contraseña buena entra");
  // Bloqueo tras 5 fallos
  win._setCurrentCoachId(""); win._identityTap("e");
  for (let i = 0; i < 5; i++) { type("pin-1", "9999"); win._submitPinModal("e", "enter"); }
  type("pin-1", "1234"); win._submitPinModal("e", "enter");
  r.assert(win._getCurrentCoachId() === "" && /Espera/.test($("pin-msg").textContent), "B-PIN1: tras 5 fallos hay que esperar (ni la buena entra)");
  win._pinLockUntil = 0; // (acceso de test)
  win.eval("_pinLockUntil=0");
  type("pin-1", "1234"); win._submitPinModal("e", "enter");
  r.assert(win._getCurrentCoachId() === "e", "B-PIN1: pasada la espera, entra");
  // Cambiar la propia
  win.openChangeCoachPin();
  type("pin-old", "1111"); type("pin-1", "5678"); type("pin-2", "5678"); win._submitPinModal("e", "change");
  r.assert(/actual no es correcta/.test($("pin-msg").textContent) && win._checkCoachPin(laura(), "1234"), "B-PIN1: cambiarla exige la actual");
  type("pin-old", "1234"); type("pin-1", "5678"); type("pin-2", "5678"); win._submitPinModal("e", "change");
  r.assert(win._checkCoachPin(laura(), "5678") && !win._checkCoachPin(laura(), "1234"), "B-PIN1: el entrenador cambia su contraseña");
  // Editar el entrenador no la borra; el superadmin la restablece
  win._setCurrentCoachId("sa");
  win.openCoachEditModal("e"); win.saveCoachEdit("e");
  r.assert(win._checkCoachPin(laura(), "5678"), "B-PIN1: editar el entrenador conserva su contraseña");
  win.openCoachEditModal("e");
  r.assert(/Restablecer/.test($("m-coach-edit").textContent), "B-PIN1: el superadmin ve 'Restablecer'");
  win.resetCoachPin("e"); doc.querySelector("#m-confirm button").click();
  r.assert(!laura().pinHash, "B-PIN1: el superadmin la restablece");
  win._setCurrentCoachId("e"); win.resetCoachPin("sa");
  r.assert(!doc.getElementById("m-confirm"), "B-PIN1: un entrenador no puede restablecer contraseñas");
  // Cambiar de entrenador vuelve a pedirla
  win._setCurrentCoachId("sa"); win._setCoachPin("sa", "abcd");
  win.switchCoachIdentity(); doc.querySelector("#m-confirm button").click();
  r.assert(!!$("m-identity-gate") && win._getCurrentCoachId() === "", "B-PIN1: 'Cambiar de entrenador' vuelve a '¿Quién eres?'");
  win._identityTap("sa"); r.assert(!$("pin-2"), "B-PIN1: y vuelve a pedir la contraseña");
  win._cancelPinModal("enter");
  r.assert(!$("m-coach-pin") && !!$("m-identity-gate"), "B-PIN1: '← Elegir otro nombre' vuelve a la lista");
  return r.summary();
}
module.exports = { run };
if (require.main === module) run().then(({ failed }) => process.exit(failed ? 1 : 0));
