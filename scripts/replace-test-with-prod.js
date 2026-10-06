"use strict";
// Sustituye clubs/cbjaca-test por una copia EXACTA de clubs/cbjaca
// (producción) -- a diferencia de copy-prod-to-test.js (que solo
// suma/sobrescribe y nunca borra nada), este script BORRA en test
// cualquier cosa que no tenga equivalente en producción, para dejar
// clubs/cbjaca-test como un calco exacto, documento por documento.
//
// Pedido explícito por Mario (2026-10-06): "quiero copiar los datos de real
// a test pero no copiarlos sino, sustituirlos tal cual". Confirmado con
// AskUserQuestion el alcance exacto antes de escribir nada:
//   1) Se borran en test los "sobrantes" sin equivalente en producción, en
//      TODAS las subcolecciones de cada equipo (jugadores, partidos,
//      eventos, catálogo de ejercicios, ejercicios en vivo, asistencia
//      diaria y notas de entreno).
//   2) A diferencia de copy-prod-to-test.js (que por un incidente real
//      documentado ahí NUNCA toca "sessions"/"trainingNotes" ni el
//      documento del club), aquí SÍ se sustituyen también -- pedido
//      explícito, con el riesgo ya explicado (puede pisar asistencia o
//      ajustes que solo existieran en test) y aceptado por Mario.
//   3) Un equipo que exista en test pero YA NO en producción se borra
//      entero (incluidas todas sus subcolecciones).
//
// *** ESTO BORRA DATOS DE clubs/cbjaca-test. Solo lectura en clubs/cbjaca.
// No hay deshacer. *** Se recomienda hacer antes una copia de seguridad de
// test con:
//   CLUB_PIN=xxxx BACKUP_CLUB_ID=cbjaca-test node backup-club.js
//
// Uso: CLUB_PIN=xxxx node replace-test-with-prod.js
// El PIN se escribe SOLO en tu propia terminal, nunca en este archivo ni
// pegado en ningún chat.
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
// Todas las subcolecciones de un equipo. A diferencia de
// copy-prod-to-test.js, aquí SÍ se incluyen "sessions"/"trainingNotes" --
// pedido explícito, ver comentario de arriba.
const TEAM_SUBCOLLECTIONS = ["players", "matches", "events", "drills", "drillLive", "sessions", "trainingNotes"];

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
  if (!clubSnap.exists) { console.error("No existe clubs/" + SRC_CLUB + " -- abortando, no se ha escrito/borrado nada."); process.exit(1); }

  let writes = 0, deletes = 0, batch = db.batch(), pending = 0;
  async function flush() { if (pending > 0) { await batch.commit(); batch = db.batch(); pending = 0; } }
  async function setDoc(ref, data) {
    batch.set(ref, data);
    pending++; writes++;
    if (pending >= 400) await flush(); // límite de Firestore: 500 escrituras/batch
  }
  async function deleteDocRef(ref) {
    batch.delete(ref);
    pending++; deletes++;
    if (pending >= 400) await flush();
  }
  // Borra TODAS las subcolecciones de un equipo de test entero (para un
  // equipo que ya no existe en producción) y el propio documento del equipo.
  async function deleteTeamEntirely(teamRef) {
    for (const sub of TEAM_SUBCOLLECTIONS) {
      const subSnap = await teamRef.collection(sub).get();
      for (const d of subSnap.docs) await deleteDocRef(d.ref);
    }
    await deleteDocRef(teamRef);
  }

  // 1) Documento del club (nombre/logo/ajustes, S.cfg) -- sustituido entero.
  // Pedido explícito; normalmente este script NO lo tocaría (ver
  // copy-prod-to-test.js, que lo deja aparte a propósito).
  await setDoc(dstClubRef, clubSnap.data());
  console.log("Documento del club (nombre/logo/ajustes) sustituido por el de producción.");

  const srcTeamsSnap = await srcClubRef.collection("teams").get();
  const dstTeamsSnap = await dstClubRef.collection("teams").get();
  const srcTeamIds = new Set(srcTeamsSnap.docs.map(d => d.id));
  console.log("Equipos en producción:", srcTeamsSnap.size, "· Equipos en test (antes de sustituir):", dstTeamsSnap.size);

  // 2) Equipos que están en test pero YA NO en producción -> se borran enteros.
  for (const teamDoc of dstTeamsSnap.docs) {
    if (!srcTeamIds.has(teamDoc.id)) {
      console.log(`\n· Equipo "${teamDoc.data()?.name || teamDoc.id}" (${teamDoc.id}) no existe en producción -- BORRANDO entero de test.`);
      await deleteTeamEntirely(teamDoc.ref);
    }
  }

  // 3) Para cada equipo de producción: upsert del equipo + réplica exacta de
  // cada subcolección (copia lo de producción, borra en test lo que no
  // tenga equivalente).
  for (const teamDoc of srcTeamsSnap.docs) {
    const t = teamDoc.data();
    const dstTeamRef = dstClubRef.collection("teams").doc(teamDoc.id);
    await setDoc(dstTeamRef, t);
    console.log(`\n· Equipo "${t.name || teamDoc.id}" (${teamDoc.id})`);
    for (const sub of TEAM_SUBCOLLECTIONS) {
      const srcSubSnap = await teamDoc.ref.collection(sub).get();
      const dstSubSnap = await dstTeamRef.collection(sub).get();
      const srcIds = new Set(srcSubSnap.docs.map(d => d.id));
      for (const d of srcSubSnap.docs) await setDoc(dstTeamRef.collection(sub).doc(d.id), d.data());
      let subDeletes = 0;
      for (const d of dstSubSnap.docs) {
        if (!srcIds.has(d.id)) { await deleteDocRef(d.ref); subDeletes++; }
      }
      console.log(`  - ${sub}: ${srcSubSnap.size} copiado(s), ${subDeletes} borrado(s) de test (sin equivalente en producción)`);
    }
  }

  await flush();
  console.log("\nTOTAL: " + writes + " escritura(s), " + deletes + " borrado(s) en clubs/" + DST_CLUB + ".");
  console.log("clubs/" + DST_CLUB + " es ahora un calco exacto de clubs/" + SRC_CLUB + ".");
  process.exit(0);
}

main().catch(e => { console.error("ERROR:", e); process.exit(1); });
