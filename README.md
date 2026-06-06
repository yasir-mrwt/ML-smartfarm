# ML Smart Farm

Full-stack smart-farm dashboard connecting an ESP32, Firebase Realtime
Database, a Node.js decision backend, Open-Meteo weather, and the hosted
Hugging Face ML model.

## Hosting

The project is structured as one GitHub monorepo with separate deployments:

```text
frontend/ -> Netlify
backend/  -> Render
```

See [DEPLOYMENT.md](./DEPLOYMENT.md) for the complete GitHub push, Render,
Netlify, environment-variable, CORS, testing, and future-update workflow.

## System Flow

```text
ESP32
  -> writes sensor readings to Firebase
Firebase Realtime Database
  -> streams live farm data to React
  -> notifies the Node backend about new sensor readings
Node backend
  -> fetches UET Peshawar outdoor weather
  -> maps sensor and weather values to the ML request
  -> calls the Hugging Face /predict endpoint
  -> writes prediction, commands, alerts, and history to Firebase
ESP32
  -> reads commands and controls fan, heater, ventilation, and emergency output
React dashboard
  -> displays all live values and can apply a manual override
```

The backend remains the automatic decision maker. The frontend writes only
explicit manual commands and asks the backend to process a reading.

## Project Structure

```text
backend/
  serviceAccountKey.json       Firebase Admin credential (you add this)
  src/
    index.js                   Express and realtime processor startup
    routes/deviceRoutes.js     Latest data, process, and command endpoints
    services/firebase.js       Firebase Admin connection
    services/weather.js        Open-Meteo UET Peshawar weather
    services/mlClient.js       Hosted ML API client
    services/mapper.js         Firebase-to-model and model-to-command mapping
    services/fallback.js       Backend safety rules
    services/processor.js      Complete processing pipeline

frontend/
  src/
    App.jsx                    Single-page live SaaS dashboard
    services/firebase.js       Firebase Web SDK configuration
    services/firebaseData.js   Realtime listener and manual command writes
    services/api.js            Process Now backend request
    styles/global.css          Responsive light/dark dashboard theme
```

## Environment Configuration

The project uses real environment files:

```text
backend/.env
frontend/.env
```

Both files, plus `backend/serviceAccountKey.json`, are excluded by
`.gitignore`. Do not force-add or commit them.

The backend env contains server-only settings:

```env
PORT=5000
FRONTEND_ORIGIN=http://localhost:5173
FIREBASE_DATABASE_URL=https://ai-smart-farm-5e26c-default-rtdb.asia-southeast1.firebasedatabase.app
FIREBASE_SERVICE_ACCOUNT_PATH=./serviceAccountKey.json
ML_API_URL=https://Yasir-mrwt-smart-farm-ml-api.hf.space
ML_TIMEOUT_MS=30000
FARM_LATITUDE=34.0016
FARM_LONGITUDE=71.4859
WEATHER_REFRESH_MINUTES=10
DEFAULT_DEVICE_ID=smartFarm001
PROCESS_COOLDOWN_MS=5000
```

The frontend env contains Vite client settings:

```env
VITE_API_BASE_URL=http://localhost:5000
VITE_DEVICE_ID=smartFarm001
VITE_FARM_LATITUDE=34.0016
VITE_FARM_LONGITUDE=71.4859
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_DATABASE_URL=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

Important: `.env` prevents accidental Git exposure, but every `VITE_*` value
is bundled into browser JavaScript. Firebase Web configuration is designed to
be public and must be protected with Realtime Database security rules. The
Firebase Admin private key is the actual secret and remains backend-only.

The configured coordinates are approximate for UET Peshawar.

## Firebase Setup

1. Open Firebase Console.
2. Select project `ai-smart-farm-5e26c`.
3. Go to **Project Settings > Service Accounts**.
4. Select **Generate new private key**.
5. Place the downloaded file at:

```text
backend/serviceAccountKey.json
```

Do not move this file into `frontend`, commit it, or expose its contents in
browser code. It is already excluded by `.gitignore`.

The supplied service account has already been installed at this path for the
current workspace.

Realtime Database security rules must allow the dashboard to read the selected
device and write its `commands` node. Use authenticated production rules for a
deployed system. The backend uses Firebase Admin and is not limited by client
rules.

## Firebase Data Paths

```text
/devices/smartFarm001/sensorData
/devices/smartFarm001/weather
/devices/smartFarm001/mlPrediction
/devices/smartFarm001/commands
/devices/smartFarm001/alerts
/devices/smartFarm001/history
```

The ESP32 writes sensor values in this shape:

```json
{
  "temperature": 28.6,
  "humidity": 48.5,
  "pressure": 963.9,
  "airQualityRaw": 267,
  "airQualityVoltage": 0.2156,
  "fanState": false,
  "heaterState": false,
  "rssi": -67,
  "systemMode": "online",
  "uptimeSeconds": 333
}
```

`airQualityRaw` is sent to the model as both `air_quality` and `gas_level` when
the ESP32 does not provide a separate `gasLevel`.

## Install and Run

Install backend dependencies:

```bash
cd backend
npm install
```

Install frontend dependencies:

```bash
cd frontend
npm install
```

Start the backend in one terminal:

```bash
cd backend
npm run dev
```

Start the frontend in another terminal:

```bash
cd frontend
npm run dev
```

Open:

```text
http://localhost:5173
```

Backend health endpoint:

```text
http://localhost:5000/api/health
```

Hosted ML health endpoint:

```text
https://Yasir-mrwt-smart-farm-ml-api.hf.space/health
```

## Test Every Layer

Run these commands from separate terminals as needed.

### 1. Firebase Admin

Tests the service account plus backend write, read, and cleanup:

```bash
cd backend
npm run test:firebase
```

Expected:

```text
PASS Firebase Admin connection, write, read, and cleanup
```

### 2. Outdoor Weather

Tests Open-Meteo using the latitude and longitude from `backend/.env`:

```bash
cd backend
npm run test:weather
```

Expected: a PASS line with current outdoor temperature and wind speed.

### 3. Hosted ML Model

Sends a safe synthetic sensor payload to the configured `/predict` endpoint:

```bash
cd backend
npm run test:ml
```

Expected: a PASS line containing model status and risk score.

### 4. Complete Backend Pipeline

Creates a temporary Firebase test device, processes weather and ML, verifies
all output paths, and deletes the test device. It never writes commands to
`smartFarm001`.

```bash
cd backend
npm run test:integration
```

Expected:

```text
PASS full pipeline on isolated test device (...)
```

### 5. Firebase Web Client and Rules

Tests that the frontend Firebase SDK can read production sensor data and write
an isolated test-device command. It does not control the real ESP32.

```bash
cd frontend
npm run test:firebase
```

If this reports `PERMISSION_DENIED`, update Realtime Database rules or add
Firebase Authentication before the live dashboard can work.

### 6. Frontend Build

```bash
cd frontend
npm run build
```

Expected: `built` with no compilation errors. A bundle-size warning is
informational.

### 7. Backend HTTP API

Start the backend:

```bash
cd backend
npm run dev
```

Open:

```text
http://localhost:5000/api/health
```

Then test the latest-data route:

```text
http://localhost:5000/api/devices/smartFarm001/latest
```

To process the current production reading intentionally:

```powershell
Invoke-RestMethod -Method Post `
  -Uri http://localhost:5000/api/devices/smartFarm001/process
```

This final command can update real ESP32 commands. Use the isolated integration
test first.

### 8. Live Dashboard

With the backend running, start:

```bash
cd frontend
npm run dev
```

Open `http://localhost:5173` and verify:

1. The header says `Firebase live`.
2. Sensor cards match `/devices/smartFarm001/sensorData`.
3. Weather, AI response, command status, and charts populate.
4. **Process Now** updates weather, prediction, and history.
5. **Fan ON** writes `fan: true`, `manualOverride: true`.
6. **Fan OFF** writes `fan: false`, `manualOverride: true`.
7. **Resume ML Automation** clears manual override and processes a new result.

Fan button tests control the real Firebase command path and may operate
connected hardware. Confirm relay wiring and local safety rules first.

## Backend Processing

Automatic processing listens to:

```text
/devices/smartFarm001/sensorData
```

It processes at most once every five seconds. A manual run is also available:

```http
POST /api/devices/smartFarm001/process
```

Each run:

1. Reads the latest sensor data.
2. Fetches UET Peshawar weather from Open-Meteo.
3. Builds the complete ML payload.
4. Calls the hosted `/predict` endpoint.
5. Uses backend fallback rules if the model request fails.
6. Writes `weather` and `mlPrediction`.
7. Writes automatic `commands` unless manual override is active.
8. Adds a `history` record.
9. Adds an alert for critical predictions.

## Manual Fan Control

The dashboard provides separate **Fan ON** and **Fan OFF** buttons. Selecting
either button writes a command like:

```json
{
  "fan": true,
  "heater": false,
  "automationAllowed": false,
  "manualOverride": true,
  "source": "manual_dashboard",
  "reason": "Fan manually switched ON from dashboard",
  "updatedAt": 1710000000000
}
```

While manual override is active, backend processing continues to update
weather, predictions, alerts, and history but does not replace the manual
command. Select **Resume ML Automation** to clear manual override and
immediately process the latest reading.

Heater, ventilation, and emergency outputs also have manual controls.
Ventilation uses the physical fan relay, so enabling ventilation also writes
`fan: true` and `heater: false`. Disabling ventilation writes `fan: false`.

## ESP32 Command Reading

The ESP32 must listen to:

```text
/devices/smartFarm001/commands
```

Automatic command example:

```json
{
  "fan": true,
  "heater": false,
  "ventilation": true,
  "emergency": false,
  "automationAllowed": true,
  "safeMode": false,
  "source": "ml_model",
  "reason": "Turn fan ON and monitor temperature.",
  "riskType": "Heat Risk",
  "riskLevel": "High",
  "riskScore": 75,
  "updatedAt": 1710000000000
}
```

The firmware should map `fan`, `heater`, `ventilation`, and `emergency` to the
appropriate relays, buzzer, or LED. It should also report physical output state
as `fanState` and `heaterState` in `sensorData`.

## Safety Fallback

If the ML API is unavailable, backend rules still issue a command:

```text
gasLevel >= 700 or airQualityRaw >= 850:
  fan ON, ventilation ON, emergency ON, heater OFF

temperature >= 35 C:
  fan ON, ventilation ON, heater OFF

temperature <= 18 C:
  heater ON, fan OFF

humidity >= 85%:
  ventilation ON
```

The fallback prediction is marked `backend_fallback` and `safe_mode: true`.
The ESP32 must keep its own local fallback rules as the final protection layer
when Firebase or the backend cannot be reached.

## Dashboard Features

- Live Firebase sensor, weather, prediction, command, alert, and history data
- Indoor and outdoor temperature
- Humidity, pressure, raw air quality, voltage, and estimated gas
- Risk score, confidence, recommendation, warnings, and errors
- Temperature, humidity, air/gas, and risk charts
- Device RSSI, uptime, mode, fan feedback, and heater feedback
- Separate manual Fan ON and Fan OFF actions
- Heater, ventilation, emergency, and automation controls
- Process Now backend action
- Responsive single-page layout without a sidebar
- Persistent light and dark themes
