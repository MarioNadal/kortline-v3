"use strict";
// Vuelca clubs/cbjaca-test (copia fiel de producción) a un JSON local, con la
// forma exacta que usa S.* dentro de la app (teams array, players[tid] array,
// sessions[sk] map, trainingNotes[sk] map, matches[tid]/events[tid]/drills[tid]
// arrays), para poder cargarlo en el harness de jsdom sin volver a pegarle a
// Firestore en cada ejecución de la auditoría.
const fs = require("fs");
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
const CLUB_ID = "cbjaca-test"; // leemos de la COPIA, nunca de produccion

async function main() {
  const pin = process.env.CLUB_PIN;
  if (!pin) { console.error("Falta CLUB_PIN"); process.exit(1); }
  firebase.initializeApp(FIREBASE_CONFIG);
  await firebase.auth().signInWithEmailAndPassword(CLUB_AUTH_EMAIL, pin);
  const db = firebase.firestore();
  const clubRef = db.collection("clubs").doc(CLUB_ID);

  const clubSnap = await clubRef.get();
  const out = { club: clubSnap.data() || {}, teams: [], players: {}, sessions: {}, trainingNotes: {}, matches: {}, events: {}, drills: {} };

  const teamsSnap = await clubRef.collection("teams").get();
  for (const teamDoc of teamsSnap.docs) {
    const tid = teamDoc.id;
    out.teams.push(Object.assign({ id: tid }, teamDoc.data()));

    const playersSnap = await teamDoc.ref.collection("players").get();
    out.players[tid] = playersSnap.docs.map(d => Object.assign({ id: d.id }, d.data()));

    const sessSnap = await teamDoc.ref.collection("sessions").get();
    sessSnap.docs.forEach(d => { out.sessions[tid + "_" + d.id] = d.data(); });

    const tnSnap = await teamDoc.ref.collection("trainingNotes").get();
    tnSnap.docs.forEach(d => { out.trainingNotes[tid + "_" + d.id] = d.data(); });

    const matchesSnap = await teamDoc.ref.collection("matches").get();
    out.matches[tid] = matchesSnap.docs.map(d => Object.assign({ id: d.id }, d.data()));

    const eventsSnap = await teamDoc.ref.collection("events").get();
    out.events[tid] = eventsSnap.docs.map(d => Object.assign({ id: d.id }, d.data()));

    const drillsSnap = await teamDoc.ref.collection("drills").get();
    out.drills[tid] = drillsSnap.docs.map(d => Object.assign({ id: d.id }, d.data()));
  }

  fs.writeFileSync(__dirname + "/real-data-dump.json", JSON.stringify(out));
  console.log("Volcado guardado. Equipos:", out.teams.length,
    "| jugadores:", Object.values(out.players).reduce((a, arr) => a + arr.length, 0),
    "| sesiones:", Object.keys(out.sessions).length,
    "| notas:", Object.keys(out.trainingNotes).length);
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
