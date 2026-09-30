"use strict";
// v3.0.0-dev.77 · Copia de seguridad SOLO LECTURA de un club completo a un
// JSON local con fecha, para tener una foto de seguridad "ahora que todo
// está bien" -- pedido explícito de Mario, 2026-09-30. NUNCA escribe nada en
// Firestore (a diferencia de copy-prod-to-test.js) -- este script solo lee y
// guarda en disco.
//
// Por defecto vuelca PRODUCCIÓN (clubs/cbjaca). Para volcar la copia de
// pruebas en su lugar: CLUB_PIN=xxxx BACKUP_CLUB_ID=cbjaca-test node backup-club.js
//
// Uso normal (producción): CLUB_PIN=xxxx node backup-club.js
// El PIN se escribe SOLO en tu propia terminal, nunca en este archivo ni
// pegado en ningún chat -- así lo pide el proyecto.
//
// Guarda scripts/backups/<club>-<fecha-hora>.json -- esa carpeta está en
// .gitignore (ver más abajo): son datos reales de menores, nunca deben
// subirse al repo.
const fs = require("fs");
const path = require("path");
const firebase = require("firebase/compat/app");
require("firebase/compat/auth");
require("firebase/compat/firestore");

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBE8o8TdkI9j4cNtBk--Ro18f_mLN4Iz8s",
  authDomain: "kortline-v3.firebaseapp.com",
  projectId: "kortline-v3",
  storageBucket: "kortline-v3.firebasestorage.app",
  messagingSenderId: "1073570899301",
  appId: "1:1073570899301:web:b1af40b12563bce9016d8c"
};
const CLUB_AUTH_EMAIL = "club-cbjaca@kortline.app";
const CLUB_ID = process.env.BACKUP_CLUB_ID || "cbjaca";
const TEAM_SUBCOLLECTIONS = ["players", "matches", "events", "drills", "sessions", "trainingNotes", "drillLive"];

async function main() {
  const pin = process.env.CLUB_PIN;
  if (!pin) { console.error("Falta CLUB_PIN (variable de entorno) -- nunca lo escribas dentro de este archivo."); process.exit(1); }

  firebase.initializeApp(FIREBASE_CONFIG);
  await firebase.auth().signInWithEmailAndPassword(CLUB_AUTH_EMAIL, pin);
  console.log("Autenticado como", CLUB_AUTH_EMAIL, "-- volcando SOLO LECTURA clubs/" + CLUB_ID);

  const db = firebase.firestore();
  const clubRef = db.collection("clubs").doc(CLUB_ID);

  const clubSnap = await clubRef.get();
  if (!clubSnap.exists) { console.error("No existe clubs/" + CLUB_ID + " -- abortando."); process.exit(1); }

  const out = { _backupOf: CLUB_ID, _backupAt: new Date().toISOString(), club: clubSnap.data(), teams: [] };

  const teamsSnap = await clubRef.collection("teams").get();
  console.log("Equipos encontrados:", teamsSnap.size);

  for (const teamDoc of teamsSnap.docs) {
    const team = Object.assign({ id: teamDoc.id }, teamDoc.data());
    team._sub = {};
    for (const sub of TEAM_SUBCOLLECTIONS) {
      const subSnap = await teamDoc.ref.collection(sub).get();
      team._sub[sub] = subSnap.docs.map(d => Object.assign({ id: d.id }, d.data()));
      console.log(`  · ${team.name || teamDoc.id} / ${sub}: ${subSnap.size} documento(s)`);
    }
    out.teams.push(team);
  }

  const dir = path.join(__dirname, "backups");
  fs.mkdirSync(dir, { recursive: true });
  const stamp = out._backupAt.replace(/[:.]/g, "-");
  const file = path.join(dir, `${CLUB_ID}-${stamp}.json`);
  fs.writeFileSync(file, JSON.stringify(out, null, 2));

  const totalPlayers = out.teams.reduce((a, t) => a + (t._sub.players?.length || 0), 0);
  const totalSessions = out.teams.reduce((a, t) => a + (t._sub.sessions?.length || 0), 0);
  console.log("\nCopia de seguridad guardada en:", file);
  console.log("Equipos:", out.teams.length, "| jugadores:", totalPlayers, "| sesiones de asistencia:", totalSessions);
  process.exit(0);
}
main().catch(e => { console.error("ERROR:", e); process.exit(1); });
