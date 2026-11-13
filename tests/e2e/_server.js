"use strict";
// Utilidades comunes de las pruebas en Chromium: servidor estático del repo y
// página con las librerías CDN servidas desde tests/cdn-mirror (sin red, sin
// Firebase: nunca toca ninguna base de datos).
const path = require("path"), http = require("http"), fs = require("fs");
const { chromium, devices } = require("playwright");
const ROOT = path.join(__dirname, "..", "..");
const MIRROR = path.join(__dirname, "..", "cdn-mirror", "node_modules") + "/";
const MAP = { "chart.umd.min.js": "chart.js/dist/chart.umd.js", "driver.min.js.iife.js": "driver.js/dist/driver.js.iife.js", "driver.min.css": "driver.js/dist/driver.css", "jspdf.umd.min.js": "jspdf/dist/jspdf.umd.min.js", "jspdf.plugin.autotable.min.js": "jspdf-autotable/dist/jspdf.plugin.autotable.min.js", "xlsx.full.min.js": "xlsx/dist/xlsx.full.min.js" };
async function openApp(device, opts) {
  opts = opts || {};
  const types = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".css": "text/css" };
  const srv = http.createServer((req, res) => {
    const f = path.join(ROOT, decodeURIComponent(req.url.split("?")[0]));
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "Content-Type": types[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(res);
  }).listen(0);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices[device || "Pixel 7"], serviceWorkers: "block", acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push("pageerror: " + e.message + " @ " + String(e.stack || "").split("\n")[1]));
  page.on("console", m => { if (m.type() === "error" && !/Failed to load resource|net::|ERR_/.test(m.text())) errors.push("console: " + m.text().slice(0, 300)); });
  await page.route("**/*", r => { const u = r.request().url();
    if (!u.startsWith("http://localhost")) { const f = Object.keys(MAP).find(k => u.endsWith(k)); return f ? r.fulfill({ path: MIRROR + MAP[f] }) : r.abort(); }
    return r.continue(); });
  const index = process.env.KORTLINE_TEST_INDEX || "index.html";
  await page.goto(`http://localhost:${srv.address().port}/${index}`);
  await page.evaluate(() => { localStorage.clear(); ["cbj-ios-never", "cbj-android-never"].forEach(k => localStorage.setItem(k, "1")); localStorage.setItem("cbj:tour_seen", "true"); localStorage.setItem("cbj:coachname_skipped", "true"); });
  await page.reload(); await page.waitForTimeout(500);
  const close = async () => { await browser.close(); srv.close(); };
  return { page, errors, close };
}
module.exports = { openApp };
