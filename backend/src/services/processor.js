import { deviceRef, getDb } from "./firebase.js";
import { getWeather } from "./weather.js";
import { callMlModel } from "./mlClient.js";
import { mapFirebaseToModelPayload, mapPredictionToCommand } from "./mapper.js";
import { backendFallback } from "./fallback.js";
const lastProcessedAt = new Map();

export async function processDeviceReading(deviceId, io, trigger="manual"){
  const ref = deviceRef(deviceId);
  const [sensorSnap, commandSnap] = await Promise.all([
    ref.child("sensorData").once("value"),
    ref.child("commands").once("value"),
  ]);
  const sensorData = sensorSnap.val();
  const existingCommand = commandSnap.val() || {};
  if (!sensorData) throw new Error(`No sensorData for ${deviceId}`);
  const weather = await getWeather();
  await ref.child("weather").set({ ...weather, updatedAt: Date.now() });
  const modelPayload = mapFirebaseToModelPayload(sensorData, weather, deviceId);
  let prediction;
  try { prediction = await callMlModel(modelPayload); }
  catch(error){ prediction = backendFallback(sensorData, `ML API failed: ${error.message}`); }
  const predictedCommand = mapPredictionToCommand(prediction);
  const manualOverrideActive =
    existingCommand.source === "manual_dashboard" &&
    (existingCommand.manualOverride === true ||
      existingCommand.automationAllowed === false);
  const command = manualOverrideActive ? existingCommand : predictedCommand;
  const historyItem = { sensorData, weather, modelPayload, prediction, command, trigger, createdAt: Date.now() };
  const writes = [
    ref.child("mlPrediction").set(prediction),
    ref.child("history").push(historyItem),
  ];
  if (!manualOverrideActive) {
    writes.push(ref.child("commands").set(command));
  }
  await Promise.all(writes);
  if (prediction.emergency_alert === "ON" || prediction.risk_level === "Critical") await ref.child("alerts").push({ type: prediction.risk_type, level: prediction.risk_level, message: prediction.alert || prediction.recommendation, source: prediction.status, createdAt: Date.now(), active: true });
  const result = {
    deviceId,
    sensorData,
    weather,
    prediction,
    command,
    manualOverrideActive,
    updatedAt: Date.now(),
  };
  io?.emit("device:update", result);
  return result;
}

export function startRealtimeProcessor(io){
  const deviceId = process.env.DEFAULT_DEVICE_ID;
  if (!deviceId) throw new Error("Missing DEFAULT_DEVICE_ID in backend/.env");
  const cooldown = Number(process.env.PROCESS_COOLDOWN_MS || 5000);
  getDb().ref(`/devices/${deviceId}/sensorData`).on("value", async snap => {
    if (!snap.val()) return;
    const now = Date.now(), last = lastProcessedAt.get(deviceId) || 0;
    if (now - last < cooldown) return;
    lastProcessedAt.set(deviceId, now);
    try { await processDeviceReading(deviceId, io, "firebase_sensor_update"); }
    catch(e){ console.error("Processing failed", e.message); io?.emit("device:error", { deviceId, message:e.message, updatedAt:Date.now() }); }
  });
  console.log(`Listening on /devices/${deviceId}/sensorData`);
}
