"use strict";
// v3.0.0-dev.113 · Prueba E2E "a nivel usuario" (pedida por Mario: "hacer
// muchas pruebas también a nivel usuario"). Abre la app real en Chromium con
// tamaño de móvil y PULSA LOS BOTONES como un entrenador: crea un equipo con
// entreno y voluntario fijo, añade jugadoras, pasa lista del voluntario
// marcando solo a las que faltan, comprueba Hoy / Historial / contador morado
// de la plantilla, añade y quita un puntual, crea una tecnificación desde ＋,
// crea un partido, abre Estadísticas y Compartir -- y falla si salta
// cualquier error de JavaScript.
//
// No forma parte de run-all.js (necesita Chromium + Playwright). Uso:
//   cd tests && npm ci --prefix cdn-mirror   # una vez
//   node e2e/user_flow.e2e.js [carpeta_capturas] ["Pixel 7"|"iPhone SE"|...]
const { chromium, devices } = require('playwright');
const path = require('path'), http = require('http'), fs = require('fs');
const ROOT = path.join(__dirname, '..', '..');
const MIRROR = path.join(__dirname, '..', 'cdn-mirror', 'node_modules') + "/";
const INDEX = process.env.KORTLINE_TEST_INDEX || "index.html";
const map = { "chart.umd.min.js": "chart.js/dist/chart.umd.js", "driver.min.js.iife.js": "driver.js/dist/driver.js.iife.js", "driver.min.css": "driver.js/dist/driver.css", "jspdf.umd.min.js": "jspdf/dist/jspdf.umd.min.js", "jspdf.plugin.autotable.min.js": "jspdf-autotable/dist/jspdf.plugin.autotable.min.js", "xlsx.full.min.js": "xlsx/dist/xlsx.full.min.js" };
const SHOTS = process.argv[2] || require('os').tmpdir();
const results = [];
const ok = (c, m) => { results.push((c ? "PASS " : "FAIL ") + m); };
(async () => {
  // servidor estático mínimo del repo (los service workers no van con file://)
  const types = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".css": "text/css" };
  const srv = http.createServer((req, res) => {
    const f = path.join(ROOT, decodeURIComponent(req.url.split("?")[0]));
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "Content-Type": types[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(res);
  }).listen(0);
  const PORT = srv.address().port;
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices[process.argv[3] || 'Pixel 7'] });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push("pageerror: " + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_FAILED|net::/.test(m.text())) errors.push("console: " + m.text()); });
  page.on('dialog', d => d.accept());
  await page.route('**/*', r => { const u = r.request().url();
    if (u.includes('gstatic.com') || u.includes('googleapis') || u.includes('googletagmanager')) return r.abort();
    const f = Object.keys(map).find(k => u.endsWith(k)); if (f) return r.fulfill({ path: MIRROR + map[f] });
    if (u.includes('cdnjs')) return r.abort(); return r.continue(); });
  await page.goto(`http://localhost:${PORT}/${INDEX}`);
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem("cbj-ios-never", "1"); localStorage.setItem("cbj-android-never", "1"); localStorage.setItem("cbj:tour_seen", "true"); localStorage.setItem("cbj:coachname_skipped", "true"); });
  await page.reload(); await page.waitForTimeout(800);
  const ti = await page.evaluate(() => { const d = new Date().getDay(); return d === 0 ? 6 : d - 1; });
  const click = async (sel, desc) => { try { await page.locator(sel).first().click({ timeout: 4000 }); await page.waitForTimeout(250); return true; } catch (e) { ok(false, "no se pudo pulsar: " + desc + " (" + sel + ")"); return false; } };
  const shot = async n => page.screenshot({ path: `${SHOTS}/e2e_${n}.png`, fullPage: true });

  // 1) Crear equipo desde Equipos → ＋
  await click("[onclick=\"navRoot('equipos')\"]", 'pestaña Equipos');
  await click('button.bbtn:has-text("＋")', '＋ nuevo equipo');
  await page.fill('#m-add-team-n', 'Alevín Femenino');
  await page.check(`#m-add-team-day-${ti}`); await page.fill(`#m-add-team-time-${ti}`, '17:00');
  await page.check(`#m-add-team-optv-day-${ti}`); await page.fill(`#m-add-team-optv-time-${ti}`, '18:30');
  await click('#m-add-team button.btn-p', 'Crear Equipo');
  ok(await page.locator('text=ALEVÍN FEMENINO').count() > 0, "1) equipo creado y visible en Equipos");

  // 2) Entrar al equipo y añadir 6 jugadoras
  await click('text=ALEVÍN FEMENINO', 'abrir equipo');
  for (let i = 1; i <= 6; i++) {
    if (!await click('button[onclick="openPlayerModal()"]', 'añadir jugadora')) break;
    await page.fill('#m-add-pl-n', 'Jugadora ' + i);
    await page.fill('#m-add-pl-d', String(i + 3));
    await click('#m-add-pl button.btn-p', 'guardar jugadora');
  }
  ok(await page.locator('text=Jugadora 6').count() > 0, "2) seis jugadoras añadidas desde la plantilla");
  await shot('2_plantilla');

  // 3) Hoy: entreno 17:00 + voluntario fijo 18:30 en la línea de tiempo
  await click("[onclick=\"navRoot('hoy')\"]", 'pestaña Hoy');
  const divs = await page.locator('.tl-divider').allTextContents();
  ok(divs.join("|").includes("ENTRENAMIENTOS") && divs.join("|").includes("VOLUNTARIO"), "3) Hoy muestra ENTRENAMIENTOS y VOLUNTARIO (fijo del equipo) -- " + divs.join(" | "));
  await shot('3_hoy');

  // 4) Pasar lista del voluntario marcando solo a 2 que faltan
  await click('.tl-row:has-text("VOLUNTARIO") button:has-text("Pasar lista")', 'Pasar lista del voluntario');
  ok(await page.locator('text=NO cuentan para el % oficial').count() > 0, "4) se abre el pase de lista del voluntario (aviso morado)");
  await click('.pr:has-text("Jugadora 2") button[onclick^="cycleAtt"]', 'marcar Jugadora 2');
  await click('.pr:has-text("Jugadora 5") button[onclick^="cycleAtt"]', 'marcar Jugadora 5');
  await click('button.bbtn:has-text("←")', 'volver');
  await click("[onclick=\"navRoot('hoy')\"]", 'pestaña Hoy');
  const volCard = await page.locator('.tl-row:has-text("VOLUNTARIO")').first().textContent();
  ok(/Pasada/.test(volCard) && /67%/.test(volCard), "4) tarjeta del voluntario: Pasada · 67% (4 de 6)");

  // 5) Historial y plantilla del equipo con el contador morado
  await click("[onclick=\"navRoot('equipos')\"]", 'Equipos'); await click('text=ALEVÍN FEMENINO', 'abrir equipo');
  const teamTxt = await page.locator('#root').textContent();
  const badges = await page.locator('span[title^="Asistencias a entrenamientos voluntarios"]').count();
  ok(badges === 4, "5) la plantilla muestra el contador morado 🙋 en las 4 que vinieron (hay " + badges + ")");
  await click('button[onclick="navTo(\'hist\')"]', 'Historial');
  const histTxt = await page.locator('#root').textContent();
  ok(/4 asistieron de 6/.test(histTxt), "5) Historial: '✓ 4 asistieron de 6' en el voluntario (antes 0)");
  await shot('5_historial');

  // 6) Entreno normal: pasar lista + puntual añadido por error y quitarlo
  await click("[onclick=\"navRoot('hoy')\"]", 'Hoy');
  await click('.tl-row:has-text("ENTRENAMIENTO") button:has-text("Pasar lista")', 'Pasar lista entreno');
  await click('.pr:has-text("Jugadora 1") button[onclick^="cycleAtt"]', 'marcar Jugadora 1');
  if (await click('button[onclick*="openGuestPlayerModal"]', 'añadir puntual')) {
    if (await page.locator('#gp-name').count() === 0) await click('button[onclick="_guestToggleManualOpen()"]', 'formulario manual');
    await page.fill('#gp-name', 'Nombre Equivocado');
    await click('button[onclick="_guestPlayerCommit(\'att\')"]', 'guardar puntual');
  }
  ok(await page.locator('.pr:has-text("Nombre Equivocado")').count() === 1, "6) puntual añadido al entreno");
  await click('.pr:has-text("Nombre Equivocado") button:has-text("Quitar")', '✕ Quitar puntual');
  await click('#m-confirm button:has-text("Quitar")', 'confirmar quitar');
  ok(await page.locator('.pr:has-text("Nombre Equivocado")').count() === 0, "6) ✕ Quitar elimina el puntual del pase de lista");
  await click('button.bbtn:has-text("←")', 'volver');

  // 7) Tecnificación desde ＋ con hora
  await click("[onclick=\"navRoot('hoy')\"]", 'Hoy');
  await click('button.fab-add', '＋ añadir actividad');
  await click('button:has-text("Tecnificación")', 'Tecnificación');
  await page.locator('#hoy-opt-teams input[type=checkbox]').first().check();
  await page.fill('#hoy-opt-time', '20:00');
  await click('button:has-text("Crear tecnificación")', 'crear tecnificación');
  ok(await page.locator('text=NO cuentan para el % oficial').count() > 0, "7) se abre el pase de lista de la tecnificación");
  await click('button:has-text("Confirmar sesión")', 'Confirmar sesión');
  await click("[onclick=\"navRoot('hoy')\"]", 'Hoy');
  const divs2 = await page.locator('.tl-divider').allTextContents();
  ok(divs2.join("|").includes("TECNIFICACIÓN"), "7) la tecnificación sale en la línea de tiempo -- " + divs2.join(" | "));
  await shot('7_hoy');

  // 8) Partido desde el equipo
  await click("[onclick=\"navRoot('equipos')\"]", 'Equipos'); await click('text=ALEVÍN FEMENINO', 'abrir equipo');
  await click("button[onclick=\"navTo('matchList')\"]", 'Partidos');
  if (await click('button.bbtn:has-text("＋")', '＋ partido')) {
    await page.fill('#m-add-match-rival', 'CB Huesca');
    await click('#m-add-match button.btn-p', 'guardar partido');
  }
  ok(await page.locator('text=CB Huesca').count() > 0, "8) partido creado");

  // 9) Estadísticas, compartir y ajustes no revientan
  await click("[onclick=\"navRoot('statsHome')\"]", 'Stats'); await page.waitForTimeout(400);
  ok(await page.locator('#root').textContent().then(t => !/NaN|undefined/.test(t)), "9) Estadísticas sin NaN/undefined");
  await click("[onclick=\"navRoot('hoy')\"]", 'Hoy');
  await click('.tl-row:has-text("VOLUNTARIO") button:has-text("📤")', 'compartir voluntario');
  const shareTxt = await page.locator('#root').textContent();
  ok(!/NaN|undefined/.test(shareTxt), "9) Compartir el voluntario sin NaN/undefined");
  await click('button.bbtn:has-text("←")', 'volver');

  ok(errors.length === 0, "0 errores de JavaScript durante toda la prueba" + (errors.length ? " -- " + errors.slice(0, 5).join(" || ") : ""));
  console.log(results.join("\n"));
  await b.close(); srv.close();
  const failed = results.filter(r => r.startsWith("FAIL")).length;
  console.log(`\n${results.length - failed} OK / ${failed} fallo(s)`);
  process.exit(failed ? 1 : 0);
})();
