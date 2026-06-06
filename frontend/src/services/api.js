import axios from "axios";

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
if (!API_BASE_URL) {
  throw new Error("Missing VITE_API_BASE_URL in frontend/.env");
}

export async function processNow(deviceId) {
  const response = await axios.post(
    `${API_BASE_URL}/api/devices/${deviceId}/process`,
  );
  return response.data.result;
}
