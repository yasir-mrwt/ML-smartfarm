# ESP32 Command Flow

ESP32 writes sensor data to:

```text
/devices/smartFarm001/sensorData
```

ESP32 should listen to:

```text
/devices/smartFarm001/commands
```

When `manualOverride` is `true`, apply the dashboard command exactly. When
`automationAllowed` is `true`, the command was produced by the backend ML or
fallback flow.

Example command:

```json
{
  "fan": true,
  "heater": false,
  "ventilation": true,
  "emergency": false,
  "automationAllowed": true,
  "manualOverride": false,
  "safeMode": false,
  "source": "ml_model",
  "reason": "Turn fan ON and monitor temperature.",
  "updatedAt": 1710000000000
}
```

Report the physical relay states back in `sensorData` as `fanState` and
`heaterState` so the dashboard can distinguish a requested command from actual
device feedback.

`ventilation` uses the same physical fan relay in this project. Dashboard and
backend commands therefore write `fan: true` whenever `ventilation: true`, and
turn the heater off to avoid conflicting outputs.

## ESP32 Local Backup Rules

Even if backend/model fails, ESP32 should have local protection:

```cpp
if (temperature >= 35) {
  fan = true;
  heater = false;
}

if (temperature <= 18) {
  heater = true;
  fan = false;
}

if (airQualityRaw >= 700) {
  fan = true;
  emergency = true;
}

if (commandMissingTooLong) {
  useLocalFallback = true;
}
```
