import axios from "axios";
export async function callMlModel(payload){
  const mlApiUrl = process.env.ML_API_URL;
  if (!mlApiUrl) throw new Error("Missing ML_API_URL in backend/.env");
  const res = await axios.post(`${mlApiUrl}/predict`, payload, { timeout: Number(process.env.ML_TIMEOUT_MS || 12000), headers: { "Content-Type": "application/json" } });
  return res.data;
}
