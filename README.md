# ML Smart Farm Dashboard

A local full-stack smart-farm monitoring and automation system built with an
ESP32, Firebase Realtime Database, Node.js, React, weather data, and an ML
prediction service.

This repository is configured for local development. It does not include cloud
deployment configuration.

## System Flow

```text
ESP32
  -> writes sensor readings to Firebase

Firebase Realtime Database
  -> streams live data to the React dashboard
  -> provides sensor data to the Node.js backend

Node.js backend
  -> reads the latest sensor values
  -> fetches outdoor weather
  -> sends the mapped payload to the ML service
  -> applies fallback safety rules when required
  -> writes predictions, commands, alerts, and history to Firebase

ESP32
  -> reads Firebase commands
  -> controls fan, heater, ventilation, and emergency outputs
```

## Project Structure

```text
ML-smartfarm/
|-- backend/
|   |-- serviceAccountKey.json
|   |-- .env
|   |-- package.json
|   |-- scripts/
|   `-- src/
|       |-- index.js
|       |-- routes/
|       `-- services/
|-- frontend/
|   |-- .env
|   |-- package.json
|   `-- src/
|       |-- App.jsx
|       |-- services/
|       `-- styles/
|-- ESP32_COMMAND_FLOW.md
|-- README.md
`-- .gitignore
```

## Private Files

These files contain local configuration or credentials and must not be
committed:

```text
backend/.env
frontend/.env
backend/serviceAccountKey.json
```

They are excluded by `.gitignore`.

## Backend Environment

Create `backend/.env` using your own private values:

```env
PORT=<LOCAL_BACKEND_PORT>
FRONTEND_ORIGIN=<LOCAL_FRONTEND_ORIGIN>

FIREBASE_DATABASE_URL=<YOUR_FIREBASE_DATABASE_URL>
FIREBASE_SERVICE_ACCOUNT_PATH=./serviceAccountKey.json

ML_API_URL=<YOUR_ML_API_URL>
ML_TIMEOUT_MS=<TIMEOUT_IN_MILLISECONDS>

FARM_LATITUDE=<YOUR_FARM_LATITUDE>
FARM_LONGITUDE=<YOUR_FARM_LONGITUDE>
WEATHER_REFRESH_MINUTES=<REFRESH_INTERVAL>

DEFAULT_DEVICE_ID=<YOUR_DEVICE_ID>
PROCESS_COOLDOWN_MS=<PROCESSING_COOLDOWN>
```

Do not place the Firebase Admin private key directly inside the env file.
Keep it in `backend/serviceAccountKey.json`.

## Frontend Environment

Create `frontend/.env` using your Firebase Web configuration:

```env
VITE_API_BASE_URL=<LOCAL_BACKEND_API_URL>
VITE_DEVICE_ID=<YOUR_DEVICE_ID>

VITE_FARM_LATITUDE=<YOUR_FARM_LATITUDE>
VITE_FARM_LONGITUDE=<YOUR_FARM_LONGITUDE>

VITE_FIREBASE_API_KEY=<YOUR_FIREBASE_WEB_API_KEY>
VITE_FIREBASE_AUTH_DOMAIN=<YOUR_FIREBASE_AUTH_DOMAIN>
VITE_FIREBASE_DATABASE_URL=<YOUR_FIREBASE_DATABASE_URL>
VITE_FIREBASE_PROJECT_ID=<YOUR_FIREBASE_PROJECT_ID>
VITE_FIREBASE_STORAGE_BUCKET=<YOUR_FIREBASE_STORAGE_BUCKET>
VITE_FIREBASE_MESSAGING_SENDER_ID=<YOUR_SENDER_ID>
VITE_FIREBASE_APP_ID=<YOUR_FIREBASE_APP_ID>
```

Values beginning with `VITE_` are included in browser JavaScript. Never place a
Firebase Admin private key or service-account JSON in the frontend.

## Firebase Admin Setup

1. Open your Firebase project.
2. Enable Realtime Database.
3. Generate a Firebase Admin service-account key.
4. Rename the downloaded file to:

```text
serviceAccountKey.json
```

5. Place it inside:

```text
backend/serviceAccountKey.json
```

## Firebase Paths

```text
/devices/<device-id>/sensorData
/devices/<device-id>/weather
/devices/<device-id>/mlPrediction
/devices/<device-id>/commands
/devices/<device-id>/alerts
/devices/<device-id>/history
```

## Sensor Data Format

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

If a separate gas sensor value is unavailable, `airQualityRaw` is also used as
the estimated gas-level input.

## Installation

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

## Run Locally

Start the backend:

```bash
cd backend
npm run dev
```

Start the frontend in another terminal:

```bash
cd frontend
npm run dev
```

Open the local frontend URL printed by Vite.

## Testing

Firebase Admin connection:

```bash
cd backend
npm run test:firebase
```

Weather service:

```bash
cd backend
npm run test:weather
```

ML prediction service:

```bash
cd backend
npm run test:ml
```

Complete isolated backend pipeline:

```bash
cd backend
npm run test:integration
```

Firebase Web SDK permissions:

```bash
cd frontend
npm run test:firebase
```

Frontend production build:

```bash
cd frontend
npm run build
```

## Backend API

```text
GET  <BACKEND_API_BASE_URL>/api/health
GET  <BACKEND_API_BASE_URL>/api/devices/<device-id>/latest
POST <BACKEND_API_BASE_URL>/api/devices/<device-id>/process
POST <BACKEND_API_BASE_URL>/api/devices/<device-id>/command
```

Use an isolated test device before processing a real hardware device.

## Manual Controls

The dashboard supports:

- Fan ON and OFF
- Heater or light ON and OFF
- Ventilation ON and OFF
- Emergency output ON and OFF
- Resume ML Automation
- Process Now

Manual commands write:

```json
{
  "automationAllowed": false,
  "manualOverride": true,
  "source": "manual_dashboard",
  "updatedAt": 1710000000000
}
```

Ventilation uses the physical fan relay. Enabling ventilation also sets:

```json
{
  "ventilation": true,
  "fan": true,
  "heater": false
}
```

Disabling ventilation sets both `ventilation` and `fan` to `false`.

## ESP32 Commands

The ESP32 listens to:

```text
/devices/<device-id>/commands
```

Example:

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
  "reason": "Example recommendation",
  "updatedAt": 1710000000000
}
```

## Safety Fallback

```text
High gas or air-quality reading:
  fan ON
  ventilation ON
  emergency ON
  heater OFF

High temperature:
  fan ON
  ventilation ON
  heater OFF

Low temperature:
  heater ON
  fan OFF

High humidity:
  ventilation ON
  fan ON
```

The ESP32 must keep local fallback rules in case Firebase, networking, the
backend, or the ML service becomes unavailable.

## Security

- Keep env files private.
- Keep Firebase Admin credentials backend-only.
- Use Firebase security rules.
- Add authentication before exposing manual controls publicly.
- Never commit private keys or tokens.
- Test relay wiring before controlling physical hardware.

## Disclaimer

This software can control physical electrical equipment. Use relay protection,
manual shutoff controls, safe wiring, and independent local safety rules.
