import "dotenv/config";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import http from "http";
import { Server } from "socket.io";
import { initFirebase } from "./services/firebase.js";
import { registerDeviceRoutes } from "./routes/deviceRoutes.js";
import { startRealtimeProcessor } from "./services/processor.js";

const app = express();
const server = http.createServer(app);
const allowedOrigin = process.env.FRONTEND_ORIGIN;
const mlApi = process.env.ML_API_URL;

if (!allowedOrigin || !mlApi) {
  throw new Error("Missing FRONTEND_ORIGIN or ML_API_URL in backend/.env");
}

app.use(cors({ origin: allowedOrigin, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));

const io = new Server(server, {
  cors: { origin: allowedOrigin, methods: ["GET", "POST"] },
});

app.get("/", (req, res) => res.json({ service: "Smart Farm AI Backend", status: "running" }));
app.get("/api/health", (req, res) =>
  res.json({
    status: "running",
    mlApi,
    defaultDeviceId: process.env.DEFAULT_DEVICE_ID,
    farmLocation: "UET Peshawar",
  }),
);

initFirebase();
registerDeviceRoutes(app, io);
startRealtimeProcessor(io);

const PORT = process.env.PORT;
if (!PORT) throw new Error("Missing PORT in backend/.env");
server.listen(PORT, () =>
  console.log(`Smart Farm backend running on port ${PORT}`),
);
