"use strict";
// Copia clubs/cbjaca (producción) -> clubs/cbjaca-test (pruebas).
// SOLO LECTURA en clubs/cbjaca. En clubs/cbjaca-test solo hace set() por id
// (crea o sobrescribe con el mismo contenido de producción) -- nunca borra
// nada que ya hubiera en test con un id distinto.
//
// Uso: CLUB_PIN=xxxx node copy-prod-to-test.js
//
// v3.0.0-dev.78 · INCIDENTE (2026-09-30): "sessions" y "trainingNotes" se
// quitan de la lista de abajo. Ambas colecciones guardan un documento POR
// FECHA (el id del documento es literalmente el día, "YYYY-MM-DD" -- ver
// _diffSessions()/sk() en index.html), y esa fecha es la MISMA en
// producción y en test. La primera vez que se usó este script, Mario tenía
// en test un entrenamiento de HOY con un ejercicio del catálogo recién
// adjuntado -- y como producción también tenía una sesión guardada para
// ese mismo día (sin ese ejercicio, claro, porque era una prueba solo de
// test), el script trajo la versión de producción y SE LA COMIÓ. Nada de
// esto tocó producción (aquí solo se lee) ni ningún dato real del club --
// pero sí se perdió esa planificación de un día en test. "players" /
// "matches" / "events" / "drills" / "drillLive" no tienen este problema:
// cada documento tiene un id propio generado al crearlo, nunca coincide
// entre los dos clubes por casualidad. La asistencia/planificación
// día-a-día es, por diseño, algo que TIENE que poder ser distinto entre
// producción y test (cada uno se usa en fechas reales de forma
// independiente) -- así que a partir de ahora este script directamente no
// las toca, en vez de intentar copiarlas "bien".
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
const SRC_CLUB = "cbjaca";
const DST_CLUB = "cbjaca-test";
// v3.0.0-dev.77: "drillLive" (estadísticas en vivo de Contraataque de
// 11/Final de partido, B-DLS4/dev.69) se añade a la lista -- no existía
// todavía cuando se escribió este script (2026-09-17), así que una copia
// hecha con la versión anterior se dejaba ese historial sin copiar a test.
// v3.0.0-dev.78: "sessions"/"trainingNotes" QUITADAS -- ver el incidente
// documentado arriba. Solo se copian colecciones con id propio por
// documento (nunca chocan entre producción y test por casualidad).
const TEAM_SUBCOLLECTIONS = ["players", "matches", "events", "drills", "drillLive"];

async function main() {
  const pin = process.env.CLUB_PIN;
  if (!pin) { console.error("Falta CLUB_PIN (variable de entorno)"); process.exit(1); }

  firebase.initializeApp(FIREBASE_CONFIG);
  await firebase.auth().signInWithEmailAndPassword(CLUB_AUTH_EMAIL, pin);
  console.log("Autenticado como", CLUB_AUTH_EMAIL);

  const db = firebase.firestore();
  const srcClubRef = db.collection("clubs").doc(SRC_CLUB);
  const dstClubRef = db.collection("clubs").doc(DST_CLUB);

  const clubSnap = await srcClubRef.get();
  if (!clubSnap.exists) { console.error("No existe clubs/" + SRC_CLUB + " -- abortando, no se ha escrito nada."); process.exit(1); }

  let writes = 0, batch = db.batch(), pending = 0;
  async function flush() { if (pending > 0) { await batch.commit(); batch = db.batch(); pending = 0; } }
  async function setDoc(ref, data) {
    batch.set(ref, data);
    pending++; writes++;
    if (pending >= 400) await flush(); // límite de Firestore: 500 escrituras/batch
  }

  await setDoc(dstClubRef, clubSnap.data());
  console.log("Documento del club copiado.");

  const teamsSnap = await srcClubRef.collection("teams").get();
  console.log("Equipos encontrados en producción:", teamsSnap.size);

  for (const teamDoc of teamsSnap.docs) {
    const t = teamDoc.data();
    await setDoc(dstClubRef.collection("teams").doc(teamDoc.id), t);
    console.log(`\n· Equipo "${t.name || teamDoc.id}" (${teamDoc.id})`);
    for (const sub of TEAM_SUBCOLLECTIONS) {
      const subSnap = await teamDoc.ref.collection(sub).get();
      for (const d of subSnap.docs) {
        await setDoc(dstClubRef.collection("teams").doc(teamDoc.id).collection(sub).doc(d.id), d.data());
      }
      console.log(`  - ${sub}: ${subSnap.size} documento(s)`);
    }
  }

  await flush();
  console.log("\nTOTAL documentos copiados a clubs/" + DST_CLUB + ":", writes);
  process.exit(0);
}

main().catch(e => { console.error("ERROR:", e); process.exit(1); });
