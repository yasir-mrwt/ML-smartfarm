import { onValue, ref, update } from "firebase/database";
import { realtimeDb } from "./firebase.js";

export const DEVICE_ID = import.meta.env.VITE_DEVICE_ID;
if (!DEVICE_ID) throw new Error("Missing VITE_DEVICE_ID in frontend/.env");

export function listenToDevice(deviceId = DEVICE_ID, onData, onError) {
  return onValue(
    ref(realtimeDb, `devices/${deviceId}`),
    (snapshot) => onData(snapshot.val() || {}),
    onError,
  );
}

export async function writeManualCommand(deviceId = DEVICE_ID, changes) {
  const actuatorChanges = { ...changes };
  if (typeof actuatorChanges.ventilation === "boolean") {
    actuatorChanges.fan = actuatorChanges.ventilation;
    if (actuatorChanges.ventilation) actuatorChanges.heater = false;
  }

  const command = {
    ...actuatorChanges,
    automationAllowed: false,
    manualOverride: true,
    source: "manual_dashboard",
    reason: changes.reason || "Manual dashboard override",
    updatedAt: Date.now(),
  };

  await update(ref(realtimeDb, `devices/${deviceId}/commands`), command);
  return command;
}

export async function enableAutomation(deviceId = DEVICE_ID) {
  const command = {
    automationAllowed: true,
    manualOverride: false,
    source: "dashboard_automation",
    reason: "Automatic ML control enabled from dashboard",
    updatedAt: Date.now(),
  };

  await update(ref(realtimeDb, `devices/${deviceId}/commands`), command);
  return command;
}
