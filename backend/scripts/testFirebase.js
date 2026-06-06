import "dotenv/config";
import { getDb } from "../src/services/firebase.js";

const db = getDb();
const testRef = db.ref("diagnostics/backendSmokeTest");
const value = {
  status: "ok",
  projectId: "ai-smart-farm-5e26c",
  testedAt: Date.now(),
};

await testRef.set(value);
const snapshot = await testRef.once("value");
if (snapshot.val()?.status !== "ok") {
  throw new Error("Firebase write/read verification failed");
}
await testRef.remove();

console.log("PASS Firebase Admin connection, write, read, and cleanup");
process.exit(0);
