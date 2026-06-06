import admin from "firebase-admin";
import fs from "fs";
import path from "path";

let db = null;

export function initFirebase() {
  if (admin.apps.length) return admin.database();
  const databaseURL = process.env.FIREBASE_DATABASE_URL;
  if (!databaseURL) {
    throw new Error("Missing FIREBASE_DATABASE_URL in backend/.env");
  }
  let credential;
  if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    const json = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, "base64").toString("utf8");
    credential = admin.credential.cert(JSON.parse(json));
  } else {
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH
      ? path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH)
      : null;
    if (!serviceAccountPath) {
      throw new Error(
        "Missing FIREBASE_SERVICE_ACCOUNT_PATH in backend/.env",
      );
    }
    if (!fs.existsSync(serviceAccountPath)) {
      throw new Error(
        `Firebase service account not found at ${serviceAccountPath}. Add backend/serviceAccountKey.json.`,
      );
    }
    credential = admin.credential.cert(
      JSON.parse(fs.readFileSync(serviceAccountPath, "utf8")),
    );
  }
  admin.initializeApp({ credential, databaseURL });
  db = admin.database();
  return db;
}
export function getDb(){ return db || initFirebase(); }
export function deviceRef(deviceId){ return getDb().ref(`/devices/${deviceId}`); }
