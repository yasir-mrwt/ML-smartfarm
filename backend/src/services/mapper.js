function n(v, f=null){ const x = Number(v); return Number.isFinite(x) ? x : f; }
export function mapFirebaseToModelPayload(sensorData, weather, deviceId){
  const air = n(sensorData.airQualityRaw, 0);
  return {
    temperature: n(sensorData.temperature), humidity: n(sensorData.humidity), air_quality: air,
    gas_level: sensorData.gasLevel !== undefined ? n(sensorData.gasLevel, air) : air,
    pressure: n(sensorData.pressure), outdoor_temperature: n(weather.outdoor_temperature),
    rain_chance: n(weather.rain_chance, 0), wind_speed: n(weather.wind_speed, 0), hour: new Date().getHours(),
    device_id: deviceId, timestamp: new Date().toISOString(), weather_api_status: weather.weather_api_status || "ok",
    database_status: "ok", wifi_signal_strength: n(sensorData.rssi), sensor_status: sensorData.systemMode || "online",
    last_seen_seconds: 5, environment_type: sensorData.environmentType || "general", animal_age_days: sensorData.animalAgeDays ?? null, crop_type: sensorData.cropType ?? null
  };
}
export function mapPredictionToCommand(prediction){
  const ventilation = prediction.ventilation_alert === "ON";
  return { fan: prediction.fan_status === "ON" || ventilation, heater: ventilation ? false : prediction.heater_status === "ON", ventilation, emergency: prediction.emergency_alert === "ON", automationAllowed: !!prediction.automation_allowed, safeMode: !!prediction.safe_mode, source: prediction.status?.includes("fallback") ? "backend_fallback" : "ml_model", reason: prediction.recommendation || "No recommendation", riskType: prediction.risk_type || "Unknown", riskLevel: prediction.risk_level || "Unknown", riskScore: prediction.risk_score ?? null, updatedAt: Date.now() };
}
