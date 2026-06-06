# Deployment: GitHub + Render + Netlify

This project uses one GitHub monorepo:

```text
ML-smartfarm/
|-- backend/                 Render web service
|-- frontend/                Netlify site
|-- render.yaml              Render Blueprint
|-- DEPLOYMENT.md
|-- ESP32_COMMAND_FLOW.md
|-- README.md
`-- .gitignore
```

The frontend and backend are not pushed to separate repositories. Both
platforms connect to the same GitHub repository and deploy only their assigned
subdirectory.

## 1. Confirm Secrets Are Ignored

These local files must never be committed:

```text
backend/.env
frontend/.env
backend/serviceAccountKey.json
```

Check before every first push:

```powershell
git status --short
git check-ignore -v backend/.env frontend/.env backend/serviceAccountKey.json
```

All three files should be reported as ignored and should not appear as staged
files.

## 2. Create the GitHub Repository

Create a new empty repository on GitHub:

```text
Repository name: ML-smartfarm
Visibility: Public or Private
Do not add README, .gitignore, or license
```

Then run from the project root:

```powershell
git init -b main
git add .
git status
git commit -m "Prepare Smart Farm for Render and Netlify"
git remote add origin https://github.com/YOUR_USERNAME/ML-smartfarm.git
git push -u origin main
```

The repository tree on GitHub will contain both `frontend/` and `backend/`.

## 3. Deploy the Backend to Render

Deploy the backend first because Netlify needs its public URL.

### Blueprint method

1. Sign in to [Render](https://dashboard.render.com/).
2. Select **New > Blueprint**.
3. Connect the GitHub `ML-smartfarm` repository.
4. Render reads the root `render.yaml`.
5. Confirm the service name and select/create the Blueprint.

The Blueprint already configures:

```text
Service type: Web Service
Plan: Free
Root directory: backend
Build command: npm ci
Start command: npm start
Health check: /api/health
```

### Render environment variables

Enter these values when Render asks for the variables marked `sync: false`:

```env
FRONTEND_ORIGIN=https://temporary.invalid
FIREBASE_DATABASE_URL=https://ai-smart-farm-5e26c-default-rtdb.asia-southeast1.firebasedatabase.app
FIREBASE_SERVICE_ACCOUNT_BASE64=YOUR_BASE64_SERVICE_ACCOUNT
ML_API_URL=https://Yasir-mrwt-smart-farm-ml-api.hf.space
```

Use the temporary frontend origin only for the first backend deployment. It is
replaced with the real Netlify URL in step 5.

Generate the Firebase Admin Base64 value locally:

```powershell
cd backend
npm run secret:base64
```

Copy the complete one-line output into
`FIREBASE_SERVICE_ACCOUNT_BASE64` on Render. Never paste it into GitHub,
README files, deployment logs, or Netlify.

Render supplies `PORT` automatically. Do not add a fixed production `PORT`.

### Manual Render method

If not using the Blueprint, create **New > Web Service** with:

```text
Repository: ML-smartfarm
Branch: main
Root Directory: backend
Runtime: Node
Build Command: npm ci
Start Command: npm start
Instance Type: Free
Health Check Path: /api/health
```

Then add the same environment variables.

### Test Render

After deployment, Render provides a URL similar to:

```text
https://smart-farm-ai-backend.onrender.com
```

Open:

```text
https://YOUR-RENDER-URL.onrender.com/api/health
https://YOUR-RENDER-URL.onrender.com/api/devices/smartFarm001/latest
```

The health response should contain `"status": "running"`.

## 4. Deploy the Frontend to Netlify

1. Sign in to [Netlify](https://app.netlify.com/).
2. Select **Add new project > Import an existing project**.
3. Choose GitHub and select the same `ML-smartfarm` repository.
4. If Netlify detects the monorepo, select `frontend`.
5. Otherwise use these build settings:

```text
Base directory: frontend
Build command: npm run build
Publish directory: dist
```

`frontend/netlify.toml` already contains the build and SPA redirect settings.

### Netlify environment variables

Under **Project configuration > Environment variables**, add:

```env
VITE_API_BASE_URL=https://YOUR-RENDER-URL.onrender.com
VITE_DEVICE_ID=smartFarm001
VITE_FARM_LATITUDE=34.0016
VITE_FARM_LONGITUDE=71.4859
VITE_FIREBASE_API_KEY=your Firebase web API key
VITE_FIREBASE_AUTH_DOMAIN=ai-smart-farm-5e26c.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://ai-smart-farm-5e26c-default-rtdb.asia-southeast1.firebasedatabase.app
VITE_FIREBASE_PROJECT_ID=ai-smart-farm-5e26c
VITE_FIREBASE_STORAGE_BUCKET=ai-smart-farm-5e26c.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your sender ID
VITE_FIREBASE_APP_ID=your web app ID
```

Use the values from the local `frontend/.env`. Variables beginning with
`VITE_` are included in browser JavaScript. Firebase Web configuration is
client configuration, not an Admin private key. Protect Firebase data with
Realtime Database rules.

Select **Deploy**. Netlify provides a URL similar to:

```text
https://smart-farm-ai.netlify.app
```

## 5. Connect Render CORS to Netlify

Return to the Render backend:

```text
Service > Environment > FRONTEND_ORIGIN
```

Replace the temporary value with the exact Netlify origin:

```env
FRONTEND_ORIGIN=https://smart-farm-ai.netlify.app
```

Do not include a trailing slash.

For multiple allowed frontends, use comma-separated origins:

```env
FRONTEND_ORIGIN=https://smart-farm-ai.netlify.app,http://localhost:5173
```

Save and redeploy the backend.

## 6. End-to-End Hosted Test

1. Open the Netlify site.
2. Confirm the dashboard displays `Firebase live`.
3. Confirm sensor cards match Firebase `sensorData`.
4. Select **Process Now**.
5. The first request can take about one minute if the free Render service is
   asleep.
6. Confirm Firebase updates:

```text
/devices/smartFarm001/weather
/devices/smartFarm001/mlPrediction
/devices/smartFarm001/commands
/devices/smartFarm001/history
```

7. Test Fan and Ventilation only after confirming the ESP32 relay wiring.

## 7. How Future Pushes Deploy Separately

Keep using one repository:

```powershell
git add .
git commit -m "Describe the update"
git push
```

Render has `rootDir: backend`, so changes under `backend/` trigger the backend
deployment. Netlify deploys the `frontend/` package.

For a frontend-only update:

```powershell
git add frontend
git commit -m "Update dashboard UI"
git push
```

For a backend-only update:

```powershell
git add backend render.yaml
git commit -m "Update backend processing"
git push
```

For documentation or shared configuration:

```powershell
git add README.md DEPLOYMENT.md ESP32_COMMAND_FLOW.md
git commit -m "Update project documentation"
git push
```

Do not create separate Git repositories inside `frontend/` or `backend/`.

## Free Hosting Limitation

Render free web services spin down after 15 minutes without inbound traffic.
While asleep:

- The React frontend still reads Firebase directly.
- The ESP32 can continue writing Firebase sensor data.
- The backend Firebase listener and automatic ML processing are paused.
- **Process Now** sends an HTTP request that wakes the backend.

Therefore, free Render hosting is suitable for demos and hobby testing but not
for uninterrupted farm automation. Always keep ESP32 local fallback rules.
Always-on backend processing requires an always-on service or moving processing
to a Firebase-triggered serverless function.

## Common Problems

### CORS error

Ensure Render `FRONTEND_ORIGIN` exactly matches the Netlify URL without a
trailing slash, then redeploy Render.

### Netlify still calls localhost

Set `VITE_API_BASE_URL` in Netlify and trigger a new frontend deploy. Vite
variables are captured at build time.

### Firebase Admin authentication fails

Regenerate `FIREBASE_SERVICE_ACCOUNT_BASE64` from the valid local JSON and
replace the Render value. It must be a single uninterrupted line.

### Direct Netlify page gives 404

The SPA redirect is provided by `frontend/netlify.toml`. Confirm Netlify is
using `frontend` as its base/package directory.

### Render takes a long time on first request

This is the normal free-service cold start after it has spun down.
