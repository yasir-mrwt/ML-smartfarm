import "dotenv/config";
import { getWeather } from "../src/services/weather.js";

const weather = await getWeather();
if (
  weather.weather_api_status !== "ok" ||
  !Number.isFinite(Number(weather.outdoor_temperature))
) {
  throw new Error(`Weather verification failed: ${JSON.stringify(weather)}`);
}

console.log(
  `PASS Open-Meteo UET Peshawar weather (${weather.outdoor_temperature} C, ${weather.wind_speed} km/h)`,
);
