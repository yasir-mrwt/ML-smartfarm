import { deleteApp, initializeApp } from "firebase/app";
import {
  get,
  getDatabase,
  goOffline,
  ref,
  remove,
  set,
} from "firebase/database";
import { loadEnv } from "vite";

const env = loadEnv("development", process.cwd(), "");
const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: env.VITE_FIREBASE_DATABASE_URL,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
});
const db = getDatabase(app);
const productionDeviceRef = ref(
  db,
  `devices/${env.VITE_DEVICE_ID}/sensorData`,
);
const testCommandRef = ref(
  db,
  `devices/smartFarmFrontendSmokeTest-${Date.now()}/commands`,
);

try {
  await get(productionDeviceRef);
  await set(testCommandRef, {
    fan: false,
    source: "frontend_smoke_test",
    updatedAt: Date.now(),
  });
  const snapshot = await get(testCommandRef);
  if (snapshot.val()?.source !== "frontend_smoke_test") {
    throw new Error("Firebase Web SDK read-back failed");
  }
  console.log("PASS Firebase Web SDK read and isolated command write");
} finally {
  await remove(testCommandRef).catch(() => {});
  goOffline(db);
  await deleteApp(app);
}
