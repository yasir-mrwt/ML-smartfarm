import axios from "axios";
let cachedWeather = null;
let cachedAt = 0;
export async function getWeather(){
  const maxAge = Number(process.env.WEATHER_REFRESH_MINUTES || 10) * 60 * 1000;
  if (!process.env.FARM_LATITUDE || !process.env.FARM_LONGITUDE) {
    throw new Error("Missing FARM_LATITUDE or FARM_LONGITUDE in backend/.env");
  }
  if (cachedWeather && Date.now() - cachedAt < maxAge) return cachedWeather;
  try {
    const response = await axios.get("https://api.open-meteo.com/v1/forecast", {
      timeout: 8000,
      params: {
        latitude: process.env.FARM_LATITUDE,
        longitude: process.env.FARM_LONGITUDE,
        current:
          "temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation",
        hourly: "precipitation_probability",
        forecast_days: 1,
      }
    });
    const current = response.data.current || {};
    const hourly = response.data.hourly || {};
    cachedWeather = { outdoor_temperature: current.temperature_2m ?? null, outdoor_humidity: current.relative_humidity_2m ?? null, rain_chance: hourly.precipitation_probability?.[0] ?? 0, wind_speed: current.wind_speed_10m ?? null, weather_api_status: "ok", updatedAt: Date.now() };
    cachedAt = Date.now();
    return cachedWeather;
  } catch (error) {
    return {
      outdoor_temperature: cachedWeather?.outdoor_temperature ?? null,
      outdoor_humidity: cachedWeather?.outdoor_humidity ?? null,
      rain_chance: cachedWeather?.rain_chance ?? null,
      wind_speed: cachedWeather?.wind_speed ?? null,
      weather_api_status: cachedWeather ? "cached_after_error" : "failed",
      error: error.message,
      updatedAt: Date.now(),
    };
  }
}
