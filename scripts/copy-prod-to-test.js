"use strict";
// Copia clubs/cbjaca (producción) -> clubs/cbjaca-test (pruebas).
// SOLO LECTURA en clubs/cbjaca. En clubs/cbjaca-test solo hace set() por id
// (crea o sobrescribe con el mismo contenido de producción) -- nunca borra
// nada que ya hubiera en test con un id distinto.
//
// Uso: CLUB_PIN=xxxx node copy-prod-to-test.js
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
const TEAM_SUBCOLLECTIONS = ["players", "matches", "events", "drills", "sessions", "trainingNotes"];

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
