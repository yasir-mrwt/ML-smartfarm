import "dotenv/config";
import { callMlModel } from "../src/services/mlClient.js";
import { mapFirebaseToModelPayload } from "../src/services/mapper.js";
import { safeSensorData } from "./fixtures.js";

const weather = {
  outdoor_temperature: 31,
  rain_chance: 10,
  wind_speed: 8,
  weather_api_status: "ok",
};
const payload = mapFirebaseToModelPayload(
  safeSensorData,
  weather,
  "smartFarmSmokeTest",
);
const prediction = await callMlModel(payload);

if (!prediction || !prediction.status || prediction.risk_score === undefined) {
  throw new Error(`Unexpected ML response: ${JSON.stringify(prediction)}`);
}

console.log(
  `PASS ML prediction (${prediction.status}, risk ${prediction.risk_score})`,
);
