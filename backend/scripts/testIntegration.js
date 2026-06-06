import "dotenv/config";
import admin from "firebase-admin";
import { deviceRef } from "../src/services/firebase.js";
import { processDeviceReading } from "../src/services/processor.js";
import { safeSensorData } from "./fixtures.js";

const testDeviceId = `smartFarmSmokeTest-${Date.now()}`;
const ref = deviceRef(testDeviceId);

try {
  await ref.child("sensorData").set(safeSensorData);
  const result = await processDeviceReading(
    testDeviceId,
    null,
    "integration_smoke_test",
  );

  if (!result.weather || !result.prediction || !result.command) {
    throw new Error("Integration result is missing required sections");
  }

  const snapshot = await ref.once("value");
  const stored = snapshot.val();
  if (
    !stored?.weather ||
    !stored?.mlPrediction ||
    !stored?.commands ||
    !stored?.history
  ) {
    throw new Error("Integration data was not written to Firebase");
  }

  console.log(
    `PASS full pipeline on isolated test device (${result.prediction.status})`,
  );
} finally {
  await ref.remove();
  await Promise.all(admin.apps.map((app) => app.delete()));
}
