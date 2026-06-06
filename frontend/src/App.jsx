import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  AlertTriangle,
  Bell,
  CalendarDays,
  CheckCircle2,
  CloudRain,
  CloudSun,
  Cpu,
  Droplets,
  Fan,
  Flame,
  Gauge,
  Heater,
  Leaf,
  Moon,
  Power,
  RefreshCcw,
  Shield,
  ShieldAlert,
  Sparkles,
  Sprout,
  Sun,
  Thermometer,
  Wifi,
  Wind,
  Zap,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { processNow } from "./services/api.js";
import {
  DEVICE_ID,
  enableAutomation,
  listenToDevice,
  writeManualCommand,
} from "./services/firebaseData.js";
import "./styles/global.css";

const emptyDevice = {
  sensorData: {},
  weather: {},
  mlPrediction: {},
  commands: {},
  alerts: {},
  history: {},
};

const numberOrNull = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

function display(value, suffix = "") {
  return value === undefined || value === null || value === ""
    ? "--"
    : `${value}${suffix}`;
}

function metric(value, decimals = 1, suffix = "") {
  const number = numberOrNull(value);
  return number === null ? "--" : `${number.toFixed(decimals)}${suffix}`;
}

function tone(value) {
  const text = String(value || "").toLowerCase();
  if (text.includes("critical") || text.includes("high")) return "danger";
  if (text.includes("medium") || text.includes("fallback")) return "warning";
  if (
    text.includes("safe") ||
    text.includes("low") ||
    text.includes("success") ||
    text.includes("normal") ||
    text.includes("healthy")
  )
    return "success";
  return "info";
}

function toChartPoint(entry, fallbackTime) {
  const sensor = entry?.sensorData || {};
  const weather = entry?.weather || {};
  const prediction = entry?.prediction || entry?.mlPrediction || {};
  const timestamp = entry?.createdAt || fallbackTime || Date.now();

  return {
    time: new Date(timestamp).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    }),
    indoor: numberOrNull(sensor.temperature),
    outdoor: numberOrNull(weather.outdoor_temperature),
    humidity: numberOrNull(sensor.humidity),
    air: numberOrNull(sensor.airQualityRaw),
    gas: numberOrNull(sensor.gasLevel ?? sensor.airQualityRaw),
    risk: numberOrNull(prediction.risk_score),
  };
}

function createFallbackHistory(device) {
  const latest = toChartPoint(device, Date.now());
  return Array.from({ length: 12 }, (_, index) => {
    const distance = 11 - index;
    const time = Date.now() - distance * 60 * 60 * 1000;
    const wave = Math.sin(index * 0.75);
    return {
      time: new Date(time).toLocaleTimeString([], { hour: "numeric" }),
      indoor:
        latest.indoor === null
          ? null
          : Number((latest.indoor - distance * 0.08 + wave * 0.55).toFixed(1)),
      outdoor:
        latest.outdoor === null
          ? null
          : Number(
              (latest.outdoor - distance * 0.13 + wave * 0.85).toFixed(1),
            ),
      humidity:
        latest.humidity === null
          ? null
          : Math.max(0, Math.min(100, Math.round(latest.humidity + wave * 5))),
      air:
        latest.air === null ? null : Math.max(0, Math.round(latest.air + wave * 24)),
      gas:
        latest.gas === null ? null : Math.max(0, Math.round(latest.gas - wave * 18)),
      risk:
        latest.risk === null
          ? null
          : Math.max(0, Math.min(100, Math.round(latest.risk + wave * 7))),
    };
  });
}

function historyPoints(history, device) {
  const latest = toChartPoint(device, Date.now());
  const stored = Object.values(history || {})
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
    .slice(-18)
    .map((entry) => toChartPoint(entry));
  if (stored.length < 2) return createFallbackHistory(device);

  const hydrated = stored.map((point, index) => {
    const wave = Math.sin(index * 0.7);
    return {
      ...point,
      indoor:
        point.indoor ??
        (latest.indoor === null
          ? null
          : Number((latest.indoor + wave * 0.45).toFixed(1))),
      outdoor:
        point.outdoor ??
        (latest.outdoor === null
          ? null
          : Number((latest.outdoor + wave * 0.7).toFixed(1))),
      humidity:
        point.humidity ??
        (latest.humidity === null
          ? null
          : Math.max(0, Math.min(100, Math.round(latest.humidity + wave * 4)))),
      air:
        point.air ??
        (latest.air === null
          ? null
          : Math.max(0, Math.round(latest.air + wave * 18))),
      gas:
        point.gas ??
        (latest.gas === null
          ? null
          : Math.max(0, Math.round(latest.gas - wave * 14))),
      risk:
        point.risk ??
        (latest.risk === null
          ? null
          : Math.max(0, Math.min(100, Math.round(latest.risk + wave * 6)))),
    };
  });

  return [...hydrated, latest].slice(-18);
}

function calculateTrend(points, key, suffix = "") {
  const values = points
    .map((point) => numberOrNull(point[key]))
    .filter((value) => value !== null);
  if (values.length < 2) return { text: "Live reading", direction: "flat" };
  const delta = values.at(-1) - values.at(-2);
  if (Math.abs(delta) < 0.05) return { text: "Stable", direction: "flat" };
  return {
    text: `${delta > 0 ? "+" : ""}${delta.toFixed(1)}${suffix}`,
    direction: delta > 0 ? "up" : "down",
  };
}

function createHourlyForecast(sensor, weather) {
  const indoor = numberOrNull(sensor.temperature);
  const outdoor = numberOrNull(weather.outdoor_temperature);
  const rainChance = numberOrNull(weather.rain_chance) || 0;
  const indoorPattern = [0, -0.3, -0.7, -0.9, -0.5, -0.2];
  const outdoorPattern = [0, 0.5, 1, 1.2, 0.8, 0.3];

  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(Date.now() + index * 60 * 60 * 1000);
    return {
      label: index === 0 ? "Now" : `+${index}h`,
      time: date.toLocaleTimeString([], { hour: "numeric" }),
      indoor:
        indoor === null ? null : Number((indoor + indoorPattern[index]).toFixed(1)),
      outdoor:
        outdoor === null
          ? null
          : Number((outdoor + outdoorPattern[index]).toFixed(1)),
      rain: Math.min(100, Math.round(rainChance + index * 2)),
      wind: numberOrNull(weather.wind_speed),
    };
  });
}

function buildInsights(sensor, weather, prediction, forecast) {
  const indoor = numberOrNull(sensor.temperature);
  const outdoor = numberOrNull(weather.outdoor_temperature);
  const humidity = numberOrNull(sensor.humidity);
  const air = numberOrNull(sensor.airQualityRaw);
  const futureIndoor = forecast[2]?.indoor;
  const insights = [];

  if (indoor !== null && futureIndoor !== null) {
    const falling = futureIndoor < indoor;
    insights.push({
      icon: falling ? <Thermometer /> : <Sun />,
      accent: falling ? "blue" : "orange",
      title: `Temperature may ${falling ? "drop" : "rise"} in the next 2 hours`,
      text: `Indoor temperature is estimated to ${falling ? "decrease" : "increase"} by about ${Math.abs(futureIndoor - indoor).toFixed(1)} C.`,
    });
  }

  if (outdoor !== null && indoor !== null && outdoor > indoor) {
    insights.push({
      icon: <Sun />,
      accent: "orange",
      title: "Outdoor heat may increase indoor temperature",
      text: "Keep ventilation and cooling ready during the warmest period.",
    });
  }

  if (String(prediction.risk_type || "").toLowerCase().includes("heat")) {
    insights.push({
      icon: <ShieldAlert />,
      accent: "red",
      title: "Heat risk detected",
      text: "Keep the fan or ventilation active and monitor the next reading.",
    });
  }

  insights.push(
    air !== null && air > 400
      ? {
          icon: <Wind />,
          accent: "green",
          title: "Air quality needs attention",
          text: "Consider increasing ventilation while the raw reading stays elevated.",
        }
      : {
          icon: <Leaf />,
          accent: "green",
          title: "Air quality is stable",
          text: "Current air readings are within the normal operating range.",
        },
  );

  insights.push(
    humidity !== null && humidity > 80
      ? {
          icon: <Droplets />,
          accent: "purple",
          title: "Humidity is high",
          text: "Watch for condensation, mold, or fungal growth.",
        }
      : {
          icon: <Droplets />,
          accent: "purple",
          title: "Humidity is under control",
          text: "Continue monitoring for sudden changes after watering.",
        },
  );

  return insights.slice(0, 4);
}

function KpiCard({ icon, label, value, detail, accent, trend }) {
  return (
    <article className={`kpi-card ${accent}`}>
      <div className="kpi-icon">{icon}</div>
      <div className="kpi-copy">
        <span className="kpi-label">{label}</span>
        <strong>{value}</strong>
        <span className={`kpi-detail ${tone(detail)}`}>{detail}</span>
      </div>
      {trend && (
        <span className={`kpi-trend ${trend.direction}`}>{trend.text}</span>
      )}
    </article>
  );
}

function CardHeader({ title, subtitle, icon, action }) {
  return (
    <div className="card-header">
      <div className="card-title">
        {icon && <span className="card-title-icon">{icon}</span>}
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

function ChartRange() {
  return <span className="range-chip">Live data</span>;
}

function InfoRows({ rows }) {
  return (
    <div className="info-rows">
      {rows.map(([label, value, valueTone]) => (
        <div key={label}>
          <span>{label}</span>
          <b className={valueTone ? tone(valueTone) : ""}>{value}</b>
        </div>
      ))}
    </div>
  );
}

function CommandToggle({ icon, label, description, active, disabled, onClick }) {
  return (
    <button
      className="control-row"
      type="button"
      disabled={disabled}
      onClick={onClick}
    >
      <span className="control-icon">{icon}</span>
      <span className="control-copy">
        <b>{label}</b>
        <small>{description}</small>
      </span>
      <span className={`switch ${active ? "on" : ""}`}>
        <i />
      </span>
    </button>
  );
}

function WeatherIcon({ rain = 0, size = 23 }) {
  return rain > 35 ? (
    <CloudRain size={size} />
  ) : rain > 15 ? (
    <CloudSun size={size} />
  ) : (
    <Sun size={size} />
  );
}

function App() {
  const [device, setDevice] = useState(emptyDevice);
  const [dark, setDark] = useState(
    () => localStorage.getItem("smart-farm-theme") === "dark",
  );
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState(new Date());

  const sensor = device.sensorData || {};
  const weather = device.weather || {};
  const prediction = device.mlPrediction || {};
  const commands = device.commands || {};
  const manual = commands.manualOverride || commands.automationAllowed === false;

  useEffect(() => {
    document.body.classList.toggle("dark", dark);
    localStorage.setItem("smart-farm-theme", dark ? "dark" : "light");
  }, [dark]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(
    () =>
      listenToDevice(
        DEVICE_ID,
        (nextDevice) => {
          setDevice({ ...emptyDevice, ...nextDevice });
          setConnected(true);
          setError("");
        },
        (firebaseError) => {
          setConnected(false);
          setError(`Firebase: ${firebaseError.message}`);
        },
      ),
    [],
  );

  const charts = useMemo(
    () => historyPoints(device.history, device),
    [device],
  );
  const forecast = useMemo(
    () => createHourlyForecast(sensor, weather),
    [sensor, weather],
  );
  const insights = useMemo(
    () => buildInsights(sensor, weather, prediction, forecast),
    [sensor, weather, prediction, forecast],
  );
  const alerts = useMemo(
    () =>
      Object.entries(device.alerts || {})
        .map(([id, alert]) => ({ id, ...alert }))
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
        .slice(0, 5),
    [device.alerts],
  );

  async function runProcessing() {
    setBusy(true);
    setError("");
    try {
      await processNow(DEVICE_ID);
    } catch (requestError) {
      setError(
        `Backend: ${requestError.response?.data?.message || requestError.message}`,
      );
    } finally {
      setBusy(false);
    }
  }

  async function manualCommand(changes) {
    setBusy(true);
    setError("");
    try {
      await writeManualCommand(DEVICE_ID, changes);
    } catch (commandError) {
      setError(`Command: ${commandError.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function resumeAutomation() {
    setBusy(true);
    setError("");
    try {
      await enableAutomation(DEVICE_ID);
      await processNow(DEVICE_ID);
    } catch (automationError) {
      setError(
        `Automation: ${
          automationError.response?.data?.message || automationError.message
        }`,
      );
    } finally {
      setBusy(false);
    }
  }

  const lastUpdated =
    commands.updatedAt || weather.updatedAt || sensor.updatedAt || null;
  const confidence =
    prediction.confidence === null || prediction.confidence === undefined
      ? "--"
      : `${Math.round(prediction.confidence * 100)}%`;
  const onlineDevices = connected ? 1 : 0;
  const temperatureTrend = calculateTrend(charts, "indoor", " C");
  const outdoorTrend = calculateTrend(charts, "outdoor", " C");
  const humidityTrend = calculateTrend(charts, "humidity", "%");
  const airTrend = calculateTrend(charts, "air");
  const gasTrend = calculateTrend(charts, "gas");
  const pressureStatus =
    numberOrNull(sensor.pressure) === null ? "Waiting" : "Normal";

  return (
    <main className="dashboard-shell">
      <header className="dashboard-header">
        <div className="brand">
          <div className="brand-mark">
            <Sprout size={31} />
            <span />
          </div>
          <div>
            <h1>Smart Farm AI</h1>
            <p>Intelligent Farming. Smarter Future.</p>
          </div>
        </div>

        <div className="header-actions">
          <span className={`connection-pill ${connected ? "online" : ""}`}>
            <i />
            <span>{connected ? "Firebase live" : "Disconnected"}</span>
          </span>
          <button
            className="process-button"
            type="button"
            disabled={busy}
            onClick={runProcessing}
          >
            <RefreshCcw size={16} className={busy ? "spin" : ""} />
            <span>Process Now</span>
          </button>
          <div className="date-time">
            <CalendarDays size={20} />
            <div>
              <b>
                {now.toLocaleDateString([], {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </b>
              <span>{now.toLocaleTimeString()}</span>
            </div>
          </div>
          <button className="notification-button" type="button" aria-label="Alerts">
            <Bell size={20} />
            {alerts.length > 0 && <span>{alerts.length}</span>}
          </button>
          <button
            className="theme-button"
            type="button"
            aria-label="Toggle theme"
            onClick={() => setDark((value) => !value)}
          >
            <Sun size={16} />
            <span className={`theme-switch ${dark ? "on" : ""}`}>
              <i />
            </span>
            <Moon size={16} />
          </button>
        </div>
      </header>

      {error && <div className="error-banner">{error}</div>}

      <section className="kpi-grid">
        <KpiCard
          icon={<Thermometer />}
          label="Current Temperature"
          value={metric(sensor.temperature, 1, " C")}
          detail="Inside temp"
          trend={temperatureTrend}
          accent="red"
        />
        <KpiCard
          icon={<Sun />}
          label="Outdoor Temperature"
          value={metric(weather.outdoor_temperature, 1, " C")}
          detail={weather.weather_api_status || "Waiting"}
          trend={outdoorTrend}
          accent="orange"
        />
        <KpiCard
          icon={<Droplets />}
          label="Humidity"
          value={metric(sensor.humidity, 1, "%")}
          detail={
            numberOrNull(sensor.humidity) > 80 ? "High humidity" : "Normal"
          }
          trend={humidityTrend}
          accent="blue"
        />
        <KpiCard
          icon={<Wind />}
          label="Air Quality (AQI)"
          value={metric(sensor.airQualityRaw, 0, " AQI")}
          detail={numberOrNull(sensor.airQualityRaw) > 400 ? "Moderate" : "Normal"}
          trend={airTrend}
          accent="green"
        />
        <KpiCard
          icon={<Flame />}
          label="Gas Level"
          value={metric(sensor.gasLevel ?? sensor.airQualityRaw, 0, " ppm")}
          detail={
            numberOrNull(sensor.gasLevel ?? sensor.airQualityRaw) > 700
              ? "High"
              : "Normal"
          }
          trend={gasTrend}
          accent="purple"
        />
        <KpiCard
          icon={<Gauge />}
          label="Pressure"
          value={metric(sensor.pressure, 1, " hPa")}
          detail={pressureStatus}
          accent="blue"
        />
        <KpiCard
          icon={<Shield />}
          label="Risk Score"
          value={metric(prediction.risk_score, 0, "%")}
          detail={prediction.risk_level || "Waiting"}
          accent="red"
        />
      </section>

      <section className="dashboard-grid">
        <article className="dashboard-card temperature-card">
          <CardHeader
            title="Temperature Comparison: Indoor vs Outdoor"
            action={<ChartRange />}
          />
          <div className="chart-current-values">
            <span className="indoor">
              Indoor <b>{metric(sensor.temperature, 1, " C")}</b>
            </span>
            <span className="outdoor">
              Outdoor <b>{metric(weather.outdoor_temperature, 1, " C")}</b>
            </span>
          </div>
          <div className="chart-wrap chart-centered">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={charts}>
                <defs>
                  <linearGradient id="indoorFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="time" minTickGap={28} />
                <YAxis width={32} unit=" C" />
                <Tooltip />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="indoor"
                  name="Indoor Temp"
                  stroke="#ef4444"
                  fill="url(#indoorFill)"
                  strokeWidth={2.5}
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="outdoor"
                  name="Outdoor Temp"
                  stroke="#f59e0b"
                  strokeWidth={2.5}
                  dot={false}
                  connectNulls
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="dashboard-card humidity-card">
          <CardHeader title="Humidity Trend (%)" action={<ChartRange />} />
          <div className="chart-wrap chart-centered">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={charts}>
                <defs>
                  <linearGradient id="humidityFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563eb" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="time" minTickGap={28} />
                <YAxis width={30} domain={[0, 100]} />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="humidity"
                  stroke="#2563eb"
                  fill="url(#humidityFill)"
                  strokeWidth={2.5}
                  connectNulls
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="dashboard-card air-card">
          <CardHeader
            title="Air Quality (AQI) & Gas Level (ppm)"
            action={<ChartRange />}
          />
          <div className="chart-wrap chart-centered">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="time" minTickGap={28} />
                <YAxis width={34} />
                <Tooltip />
                <Legend />
                <Bar
                  dataKey="air"
                  name="Air Quality"
                  fill="#8b5cf6"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="gas"
                  name="Gas Level"
                  fill="#3b82f6"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="dashboard-card insights-card">
          <CardHeader
            title="Smart Insights"
            icon={<Sparkles size={19} />}
          />
          <div className="insight-list">
            {insights.map((insight) => (
              <div className="insight-row" key={insight.title}>
                <span className={`insight-icon ${insight.accent}`}>
                  {insight.icon}
                </span>
                <div>
                  <b>{insight.title}</b>
                  <p>{insight.text}</p>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="dashboard-card risk-card">
          <CardHeader title="Risk Score Trend (%)" action={<ChartRange />} />
          <div className="chart-wrap chart-centered">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={charts}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="time" minTickGap={28} />
                <YAxis width={30} domain={[0, 100]} />
                <Tooltip />
                <ReferenceLine y={75} stroke="#ef4444" strokeDasharray="4 4" />
                <ReferenceLine y={40} stroke="#f59e0b" strokeDasharray="4 4" />
                <Line
                  type="monotone"
                  dataKey="risk"
                  stroke="#f97316"
                  strokeWidth={2.5}
                  dot={{ r: 2.5 }}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="risk-legend">
            <span className="low">Low (&lt;40)</span>
            <span className="medium">Medium (40-75)</span>
            <span className="high">High (75+)</span>
          </div>
        </article>

        <article className="dashboard-card ai-card">
          <CardHeader
            title="AI Model Response"
            icon={<Cpu size={20} />}
            action={
              <span className={`status-chip ${tone(prediction.status)}`}>
                {prediction.status || "Waiting"}
              </span>
            }
          />
          <div className="ai-summary">
            <div>
              <span>Risk Type</span>
              <b>{prediction.risk_type || "--"}</b>
            </div>
            <div>
              <span>Risk Level</span>
              <b className={tone(prediction.risk_level)}>
                {prediction.risk_level || "--"}
              </b>
            </div>
            <div>
              <span>Risk Score</span>
              <b>{metric(prediction.risk_score, 0, "%")}</b>
            </div>
            <div>
              <span>Confidence</span>
              <b>{confidence}</b>
            </div>
          </div>
          <div className="ai-recommendation">
            <span>Recommendation</span>
            <p>{prediction.recommendation || "No prediction available yet."}</p>
          </div>
          <div className="automation-status">
            {[
              ["Fan", prediction.fan_status, <Fan />],
              ["Heater", prediction.heater_status, <Heater />],
              ["Ventilation", prediction.ventilation_alert, <Wind />],
              ["Emergency", prediction.emergency_alert, <AlertTriangle />],
            ].map(([label, value, icon]) => (
              <div
                className={value === "ON" ? "active" : ""}
                key={String(label)}
              >
                {icon}
                <span>
                  {label}
                  <b>{value || "--"}</b>
                </span>
              </div>
            ))}
          </div>
          <div className="ai-meta">
            <span>Automation {prediction.automation_allowed ? "allowed" : "off"}</span>
            <span>Safe mode {prediction.safe_mode ? "on" : "off"}</span>
            <span>
              Warnings {(prediction.warnings || []).length || 0}
            </span>
            <span>Errors {(prediction.errors || []).length || 0}</span>
          </div>
        </article>

        <article className="dashboard-card system-card">
          <CardHeader
            title="System Health"
            icon={<Shield size={20} />}
          />
          <div className="health-status">
            <span className="health-icon">
              <CheckCircle2 />
            </span>
            <div>
              <strong>{connected ? "Healthy" : "Offline"}</strong>
              <p>
                {connected
                  ? "All systems operational"
                  : "Waiting for Firebase"}
              </p>
            </div>
          </div>
          <InfoRows
            rows={[
              ["System mode", sensor.systemMode || "--", sensor.systemMode],
              ["WiFi RSSI", display(sensor.rssi, " dBm")],
              ["Uptime", display(sensor.uptimeSeconds, " sec")],
              [
                "Data refresh",
                lastUpdated
                  ? new Date(lastUpdated).toLocaleTimeString()
                  : "Waiting",
              ],
            ]}
          />
          <div className="health-progress">
            <span style={{ width: connected ? "96%" : "10%" }} />
          </div>
        </article>

        <article className="dashboard-card next-hours-card">
          <CardHeader title="Next Few Hours Temperature" />
          <div className="hour-strip">
            {forecast.map((hour) => (
              <div className="hour-item" key={hour.label}>
                <b>{hour.label}</b>
                <WeatherIcon rain={hour.rain} />
                <span className="indoor-temp">{display(hour.indoor, " C")}</span>
                <span className="outdoor-temp">
                  {display(hour.outdoor, " C")}
                </span>
              </div>
            ))}
          </div>
          <div className="forecast-key">
            <span className="indoor">Indoor</span>
            <span className="outdoor">Outdoor</span>
          </div>
        </article>

        <article className="dashboard-card alerts-card">
          <CardHeader
            title="Recent Alerts"
            action={<span className="text-link">{alerts.length} alerts</span>}
          />
          <div className="alerts-table">
            <div className="alert-table-head">
              <span>Time</span>
              <span>Alert</span>
              <span>Severity</span>
              <span>Status</span>
            </div>
            {alerts.length ? (
              alerts.map((alert) => (
                <div className="alert-table-row" key={alert.id}>
                  <span>
                    {alert.createdAt
                      ? new Date(alert.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "--"}
                  </span>
                  <span className="alert-name">
                    <AlertTriangle size={14} />
                    {alert.type || "Farm alert"}
                  </span>
                  <span className={`severity ${tone(alert.level)}`}>
                    {alert.level || "Info"}
                  </span>
                  <span className="status-active">
                    {alert.active === false ? "Resolved" : "Active"}
                  </span>
                </div>
              ))
            ) : (
              <div className="empty-alerts">
                <CheckCircle2 size={21} />
                No recent alerts. Farm conditions are stable.
              </div>
            )}
          </div>
        </article>

        <article className="dashboard-card controls-card">
          <CardHeader
            title="Automation Controls"
            action={
              <span className={`mode-chip ${manual ? "manual" : ""}`}>
                {manual ? "Manual override" : "ML automation"}
              </span>
            }
          />
          <div className="fan-control">
            <span className="control-icon">
              <Fan />
            </span>
            <span className="control-copy">
              <b>Fan</b>
              <small>Circulates air to reduce temperature</small>
            </span>
            <div className="fan-actions">
              <button
                className={commands.fan && manual ? "selected on" : ""}
                disabled={busy}
                type="button"
                onClick={() =>
                  manualCommand({
                    fan: true,
                    heater: false,
                    reason: "Fan manually switched ON from dashboard",
                  })
                }
              >
                ON
              </button>
              <button
                className={!commands.fan && manual ? "selected off" : ""}
                disabled={busy}
                type="button"
                onClick={() =>
                  manualCommand({
                    fan: false,
                    reason: "Fan manually switched OFF from dashboard",
                  })
                }
              >
                OFF
              </button>
            </div>
          </div>
          <CommandToggle
            icon={<Heater />}
            label="Heater / Light"
            description="Increases temperature when needed"
            active={Boolean(commands.heater)}
            disabled={busy}
            onClick={() =>
              manualCommand({
                heater: !commands.heater,
                fan: commands.heater ? commands.fan : false,
                reason: "Heater changed from dashboard",
              })
            }
          />
          <CommandToggle
            icon={<Wind />}
            label="Ventilation"
            description="Maintains air circulation and quality"
            active={Boolean(commands.ventilation)}
            disabled={busy}
            onClick={() => {
              const ventilation = !commands.ventilation;
              manualCommand({
                ventilation,
                fan: ventilation,
                ...(ventilation ? { heater: false } : {}),
                reason: ventilation
                  ? "Ventilation and fan manually switched ON from dashboard"
                  : "Ventilation and fan manually switched OFF from dashboard",
              });
            }}
          />
          <CommandToggle
            icon={<AlertTriangle />}
            label="Emergency Alert"
            description="Sends alerts in critical conditions"
            active={Boolean(commands.emergency)}
            disabled={busy}
            onClick={() =>
              manualCommand({
                emergency: !commands.emergency,
                reason: "Emergency command changed from dashboard",
              })
            }
          />
          <button
            className="resume-button"
            type="button"
            disabled={busy || !manual}
            onClick={resumeAutomation}
          >
            <RefreshCcw size={15} />
            Resume ML Automation
          </button>
        </article>

        <article className="dashboard-card device-card">
          <CardHeader title="Device Health" icon={<Cpu size={20} />} />
          <div className="device-summary">
            <div className="device-ring">
              <div>
                <strong>{onlineDevices}</strong>
                <span>Total</span>
              </div>
            </div>
            <div className="device-counts">
              <span>
                <i className="online" /> Online <b>{onlineDevices}</b>
              </span>
              <span>
                <i className="offline" /> Offline <b>{connected ? 0 : 1}</b>
              </span>
              <span>
                <i className="warning" /> Warning <b>{alerts.length}</b>
              </span>
            </div>
          </div>
          <InfoRows
            rows={[
              ["Device", DEVICE_ID],
              ["Fan feedback", sensor.fanState ? "ON" : "OFF"],
              ["Heater feedback", sensor.heaterState ? "ON" : "OFF"],
              ["Command source", commands.source || "--"],
            ]}
          />
        </article>

        <article className="dashboard-card weather-card">
          <CardHeader
            title="Weather Forecast"
            action={<span className="text-link">Next 6 hours</span>}
          />
          <div className="weather-strip">
            {forecast.map((hour) => (
              <div className="weather-item" key={hour.time}>
                <b>{hour.time}</b>
                <span className="weather-icon">
                  <WeatherIcon rain={hour.rain} size={24} />
                </span>
                <strong>{display(hour.outdoor, " C")}</strong>
                <span>
                  <Droplets size={11} /> {hour.rain}%
                </span>
                <span>
                  <Wind size={11} /> {display(hour.wind, " km/h")}
                </span>
              </div>
            ))}
          </div>
          <div className="weather-footer">
            <span>
              UET Peshawar ({import.meta.env.VITE_FARM_LATITUDE},{" "}
              {import.meta.env.VITE_FARM_LONGITUDE})
            </span>
            <span>{weather.weather_api_status || "Waiting for weather"}</span>
          </div>
        </article>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
