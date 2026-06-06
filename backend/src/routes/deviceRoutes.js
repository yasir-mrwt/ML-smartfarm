import { deviceRef } from "../services/firebase.js";
import { processDeviceReading } from "../services/processor.js";
export function registerDeviceRoutes(app, io){
  app.get("/api/devices/:deviceId/latest", async (req,res)=>{ try { const snap = await deviceRef(req.params.deviceId).once("value"); res.json({ success:true, deviceId:req.params.deviceId, data:snap.val() }); } catch(e){ res.status(500).json({ success:false, message:e.message }); } });
  app.post("/api/devices/:deviceId/process", async (req,res)=>{ try { const result = await processDeviceReading(req.params.deviceId, io, "api_process"); res.json({ success:true, result }); } catch(e){ res.status(500).json({ success:false, message:e.message }); } });
  app.post("/api/devices/:deviceId/command", async (req,res)=>{ try {
    const commandRef = deviceRef(req.params.deviceId).child("commands");
    const current = (await commandRef.once("value")).val() || {};
    const requested = { ...req.body };
    if (typeof requested.ventilation === "boolean") {
      requested.fan = requested.ventilation;
      if (requested.ventilation) requested.heater = false;
    }
    const command = {
      ...current,
      ...requested,
      automationAllowed:false,
      manualOverride:true,
      source:"manual_dashboard",
      reason:req.body.reason || "Manual dashboard override",
      updatedAt:Date.now()
    };
    await commandRef.set(command);
    io?.emit("device:command", { deviceId:req.params.deviceId, command });
    res.json({ success:true, command });
  } catch(e){ res.status(500).json({ success:false, message:e.message }); } });
}
