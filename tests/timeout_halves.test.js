"use strict";
const { loadApp, newReporter } = require("./harness");

async function run() {
  const report = newReporter("timeout_halves");
  const win = await loadApp();

  // Formato estandar de 4 cuartos: mitad = periodos 1-2 / 3-4.
  {
    const live = { q: 3, timeouts: { our: [1, 0, 0, 0, 0, 0], rival: [0, 0, 0, 0, 0, 0] } };
    const c = win._tmCounts(live, 4);
    report.assert(c.isH2 === true, "cuarto 3 de 4 cae en la 2a mitad");
    report.assert(c.ourUsed === 0, "el TM gastado en el cuarto 1 no cuenta para la 2a mitad (formato 4 cuartos)");
  }

  // Formato "Escuela" de 6 periodos (el que la app propone por defecto):
  // mitad = periodos 1-3 / 4-6. Antes de la B-ADV3 el corte estaba mal
  // hardcodeado a q<=2 / q===3||4, dando limites incorrectos a partir del
  // periodo 3.
  {
    const live = { q: 3, timeouts: { our: [1, 0, 0, 0, 0, 0], rival: [0, 0, 0, 0, 0, 0] } };
    const c = win._tmCounts(live, 6);
    report.assert(c.isH1 === true, "periodo 3 de 6 SIGUE en la 1a mitad (mitad = 3 primeros periodos)");
    report.assert(c.ourUsed === 1, "el TM del periodo 1 SI cuenta en la 1a mitad de un formato de 6 periodos");
  }
  {
    const live = { q: 4, timeouts: { our: [1, 0, 0, 0, 0, 0], rival: [0, 0, 0, 0, 0, 0] } };
    const c = win._tmCounts(live, 6);
    report.assert(c.isH2 === true, "periodo 4 de 6 cae YA en la 2a mitad");
    report.assert(c.ourUsed === 0, "el TM del periodo 1 (1a mitad) no arrastra limite a la 2a mitad en formato de 6 periodos");
  }

  // Prorroga: cuenta solo los TM de ese periodo de prorroga, limite 1.
  {
    const live = { q: 5, timeouts: { our: [0, 0, 0, 0, 1, 0], rival: [0, 0, 0, 0, 0, 0] } };
    const c = win._tmCounts(live, 4);
    report.assert(c.isOT === true, "periodo 5 con formato de 4 cuartos es prorroga");
    report.assert(c.limit === 1, "el limite de TM en prorroga es 1");
    report.assert(c.ourUsed === 1 && c.ourRem === 0, "el TM ya gastado en la prorroga actual se refleja correctamente");
  }

  return report.summary();
}

module.exports = { run };
