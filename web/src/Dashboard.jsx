import React, { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Area as RechartsArea, AreaChart as RechartsAreaChart, Bar as RechartsBar, BarChart, CartesianGrid, Cell, ComposedChart as RechartsComposedChart, Legend, Line as RechartsLine, LineChart as RechartsLineChart, Pie as RechartsPie, PieChart, ReferenceLine, ResponsiveContainer, Scatter as RechartsScatter, ScatterChart, Tooltip, XAxis as RechartsXAxis, YAxis, ZAxis } from "recharts";
import "leaflet/dist/leaflet.css";
import { APP_VERSION } from "./version.js";

const ISSUE_URL = import.meta.env.VITE_RELEASE_CHANNEL === "beta" ? "https://github.com/josepinto1989/xpeng-analytics-staging/issues" : "https://github.com/josepinto1989/xpeng-analytics/issues";
import { detectPersonalAnomalies } from "./anomaly-detection.js";
import { assessBatteryHealth } from "./battery-health.js";
import { buildCoverageCalendar, coverageCalendarSummary, formatTelemetryCoverage } from "./data-coverage.js";
import { calculateDrivingPersonality } from "./driving-personality.js";
import { buildMonthlySummaries } from "./monthly-summary.js";
import { buildSeasonalPeriods, compareSeasonalPeriods } from "./seasonal-comparison.js";
import { formatStoredBytes, IMPORT_REMINDER_DAY_OPTIONS, nextReminderAt } from "./persistent-history.js";
import { telemetryPointFromChart } from "./route-sync.js";
import { buildRouteIntelligence, createRouteTimestampLookup, routeMetricColor, routeMetricValue, routePointForTelemetry } from "./route-intelligence.js";
import { buildGlobalSearchIndex, searchGlobalIndex } from "./global-search.js";
import { downloadInsightCard } from "./insight-card.js";
import { detectLikelyImportGaps } from "./drive-backup-metadata.js";
import { buildJourneyGroupView, journeyGroupDefinition } from "./journey-groups.js";
import { consumptionUnit, consumptionValue, distanceUnit, distanceValue, pressureUnitLabel, pressureValue, speedUnit, speedValue, temperatureUnit, temperatureValue } from "./units.js";
import { dismissObservation, insightObservationId, qualityObservationId, readDismissed, restoreObservations, writeDismissed } from "./observation-dismissals.js";
import { buildLifetimeHighlights, downloadLifetimeHighlightsCard } from "./lifetime-highlights.js";
import { CHARGE_CATEGORIES, JOURNEY_LABELS, REMINDER_TYPES, TARIFF_CURRENCIES, chargeCostBreakdown, ownershipMaps, removeReminder, upsertChargeCategory, upsertChargeCost, upsertJourneyDetails, upsertJourneyLabel, upsertReminder, validateOwnershipMetadata } from "./ownership-metadata.js";
import { journeySuggestions, ownershipCostSummary, reminderState } from "./ownership-intelligence.js";
import { downloadChargingCsv, downloadJourneysCsv, downloadOwnershipCsv } from "./ownership-export.js";
import { buildChargeComparison } from "./charging-lab.js";
import { buildParkingInvestigation } from "./parking-investigator.js";
import { comparePeriods, comparisonDefaults } from "./period-comparison.js";
import { assessDataProtection } from "./data-protection.js";
import { buildTyreObservations } from "./tyre-observations.js";
import { aggregateBands } from "./distribution-bands.js";
import { VEHICLE_VARIANTS, resolvedVehicleProfile, vehicleProfileLabel } from "./vehicle-catalog.js";

const Replay = React.lazy(() => import("./Replay.jsx"));
const MyCharts = React.lazy(() => import("./MyCharts.jsx"));
const navGroups = [
  { key: null, items: ["overview"] },
  { key: "driving", icon: "driving", items: ["journeys", "driving", "activity", "replay"] },
  { key: "energy", icon: "charging", items: ["charging", "trends"] },
  { key: "vehicle", icon: "battery", items: ["battery", "tyres", "insights", "ownership", "quality"] },
  { key: "reports", icon: "report", items: ["compare", "highlights", "mycharts", "report"] },
];
const simpleNavGroups = [
  { key: null, items: ["overview", "journeys", "charging", "battery"] },
];
const simpleSections = new Set(["overview", "journeys", "charging", "battery", "data"]);
const viewModeStorageKey = "xpeng-analytics-view-mode";
const initialViewMode = () => {
  try { return globalThis.localStorage?.getItem(viewModeStorageKey) === "advanced" ? "advanced" : "simple"; }
  catch { return "simple"; }
};
const sections = navGroups.flatMap((group) => group.items);
const iconPaths = {
  overview: "M4 13h6V4H4v9Zm10 7h6v-9h-6v9ZM4 20h6v-3H4v3Zm10-13h6V4h-6v3Z",
  journeys: "M5 19c4-8 10-3 14-14M14 5h5v5", charging: "M13 2 5 14h6l-1 8 8-12h-6l1-8Z",
  driving: "M4 16c2-5 5-8 8-8s6 3 8 8M8 16h8M12 8V4",
  battery: "M3 7h17v12H3V7Zm17 4h2v4h-2M6 10h7v6H6v-6Z", tyres: "M6 12a6 6 0 1 0 12 0 6 6 0 1 0-12 0Zm3 0a3 3 0 1 0 6 0 3 3 0 1 0-6 0Z", activity: "M4 19V9m5 10V5m5 14v-7m5 7V3",
  trends: "M4 18 9 12l4 3 7-9M15 6h5v5",
  replay: "M5 5h14v14H5V5Zm5 4 6 3-6 3V9Z",
  mycharts: "M4 19V9m5 10V5m5 14v-7m5 7V3M3 21h18",
  insights: "M4 18V9m5 9V5m5 13v-6m5 6V3M3 21h18M6 6l3-3 4 4 6-5", report: "M6 2h9l4 4v16H6V2Zm9 0v5h4M9 11h7M9 15h7M9 19h5", quality: "m4 12 5 5L20 6", data: "M12 3v12m-5-5 5 5 5-5M5 20h14",
  highlights: "M8 3h8v3h4v3c0 3-2 5-5 5h-1v3h3v3H7v-3h3v-3H9c-3 0-5-2-5-5V6h4V3Zm0 5H6v1c0 1.6.8 2.6 2.4 3-.3-1.2-.4-2.6-.4-4Zm8 0c0 1.4-.1 2.8-.4 4 1.6-.4 2.4-1.4 2.4-3V8h-2Z",
  compare: "M4 7h13m-4-4 4 4-4 4M20 17H7m4-4-4 4 4 4",
  ownership: "M4 5h16v14H4V5Zm3 4h5m-5 4h10m-10 3h7M16 8h1",
  search: "m21 21-4.35-4.35M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z",
  settings: "M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm7.4-3.5a7.7 7.7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1a8 8 0 0 0-1.8-1L14.8 3h-4l-.3 2.6a8 8 0 0 0-1.8 1l-2.4-1-2 3.4 2 1.5a8 8 0 0 0 0 2L4.3 14l2 3.4 2.4-1a8 8 0 0 0 1.8 1l.3 2.6h4l.3-2.6a8 8 0 0 0 1.8-1l2.4 1 2-3.4-2-1.5a7.7 7.7 0 0 0 .1-1Z",
  support: "M12 21s-7-4.4-9-8.5C1.2 8.7 3.5 5 7.5 5c2 0 3.5 1.1 4.5 2.5C13 6.1 14.5 5 16.5 5c4 0 6.3 3.7 4.5 7.5C19 16.6 12 21 12 21Z",
};
const C = { mint: "#20a983", teal: "#3ab5ae", cyan: "#63b7d4", amber: "#e3a62f", coral: "#e27b66", violet: "#8a82d5" };
const signalLabels = {
  speed_kmh: "speed", longitudinal_accel: "longitudinalAcceleration", lateral_accel: "lateralAcceleration", odometer_km: "odometer",
  steering_angle_deg: "steeringAngle", steering_speed_deg_s: "steeringSpeed", accelerator_pct: "acceleratorPosition", brake_status: "brakeSignal", gear_level: "gearPosition",
  front_motor_rpm: "frontMotorSpeed", rear_motor_rpm: "rearMotorSpeed", front_motor_torque_nm: "frontMotorTorque", rear_motor_torque_nm: "rearMotorTorque",
  front_rotor_temp_c: "frontRotorTemperature", rear_rotor_temp_c: "rearRotorTemperature", pack_voltage_v: "packVoltage", pack_current_a: "packCurrent",
  charge_power_kw: "chargingPower", soc_pct: "batterySoc", battery_temp_max_c: "maximumTemperature", battery_temp_min_c: "minimumTemperature",
  hottest_cell_index: "hottestCellPosition", coldest_cell_index: "coldestCellPosition", displayed_range_km: "displayedRange",
  driver_door_ajar: "driverDoor", passenger_door_ajar: "passengerDoor", rear_left_door_ajar: "rearLeftDoor", rear_right_door_ajar: "rearRightDoor",
  front_left_window_position: "frontLeftWindow", rear_left_window_position: "rearLeftWindow", front_right_window_position: "frontRightWindow", rear_right_window_position: "rearRightWindow",
  trunk_open_status: "bootStatus", tyre_pressure_fl_kpa: "frontLeftTyre", tyre_pressure_fr_kpa: "frontRightTyre", tyre_pressure_rl_kpa: "rearLeftTyre", tyre_pressure_rr_kpa: "rearRightTyre",
};
const phaseKeys = { runtime_load:"phaseRuntimeLoad", engine_init:"phaseEngineInit", archive_write:"phaseArchiveWrite", archive_import:"phaseArchiveImport", analytics_rebuild:"phaseAnalyticsRebuild", validation:"phaseValidation", history_read:"phaseHistoryRead", history_export:"phaseHistoryExport", history_export_complete:"phaseHistoryExportComplete", csv_export:"phaseCsvExport", csv_export_complete:"phaseCsvExportComplete", persistent_history_save:"phasePersistentHistorySave", persistent_history_saved:"phasePersistentHistorySaved", drive_backup_save:"phaseDriveBackupSave", drive_backup_saved:"phaseDriveBackupSaved", drive_backup_open:"phaseDriveBackupOpen", drive_original_archive:"phaseDriveOriginalArchive", drive_history_refresh:"phaseDriveHistoryRefresh", complete:"phaseComplete", reset:"phaseReset", native_ready:"phaseNativeReady", native_scan:"phaseNativeScan", native_parse:"phaseNativeParse", native_merge:"phaseNativeMerge", native_analytics:"phaseNativeAnalytics", native_snapshot:"phaseNativeSnapshot", gps_parse:"phaseGpsParse", gps_match:"phaseGpsMatch" };
const safe = (rows) => Array.isArray(rows) ? rows : [];
const finiteValue = (value) => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
const newestFirst = (rows) => safe(rows).slice().sort((a, b) => String(b?.startedAtUtc || b?.date || "").localeCompare(String(a?.startedAtUtc || a?.date || "")));
const sum = (rows, field) => safe(rows).reduce((total, row) => total + (Number(row?.[field]) || 0), 0);
const maximum = (rows, field) => { const values = safe(rows).map((row)=>Number(row?.[field])).filter(Number.isFinite); return values.length ? Math.max(...values) : null; };
const median = (values) => { const rows = safe(values).map(Number).filter(Number.isFinite).sort((a,b)=>a-b); if (!rows.length) return null; const middle = Math.floor(rows.length / 2); return rows.length % 2 ? rows[middle] : (rows[middle - 1] + rows[middle]) / 2; };
const sampleTimeline = (rows, limit = 420) => {
  const source = safe(rows);
  if (source.length <= limit) return source;
  const sampled = [source[0]], slots = limit - 2, step = (source.length - 2) / slots;
  for (let index = 0; index < slots; index++) sampled.push(source[1 + Math.floor(index * step)]);
  sampled.push(source.at(-1));
  return sampled;
};
const sampleScatter = (rows, limit = 900) => {
  const source = safe(rows);
  if (source.length <= limit) return source;
  let minX = 0, maxX = 0, minY = 0, maxY = 0;
  for (let index = 1; index < source.length; index++) {
    const x = Number(source[index]?.lateralG), y = Number(source[index]?.longitudinalG);
    if (x < Number(source[minX]?.lateralG)) minX = index;
    if (x > Number(source[maxX]?.lateralG)) maxX = index;
    if (y < Number(source[minY]?.longitudinalG)) minY = index;
    if (y > Number(source[maxY]?.longitudinalG)) maxY = index;
  }
  const indexes = new Set([0, source.length - 1, minX, maxX, minY, maxY]);
  const slots = Math.max(1, limit - indexes.size), step = (source.length - 1) / Math.max(1, slots - 1);
  for (let index = 0; index < slots; index++) indexes.add(Math.round(index * step));
  return [...indexes].sort((a, b) => a - b).slice(0, limit).map((index) => source[index]);
};
const signalText = (field, t) => signalLabels[field] ? t(signalLabels[field]) : String(field || "").replaceAll("_", " ");
const numberFormatters = new Map(), dateFormatters = new Map(), timeFormatters = new Map(), secondTimeFormatters = new Map(), monthFormatters = new Map();
const num = (value, locale, digits = 1) => {
  if (value == null || !Number.isFinite(Number(value))) return "—";
  const key = `${locale}|${digits}`;
  if (!numberFormatters.has(key)) numberFormatters.set(key, new Intl.NumberFormat(locale, { maximumFractionDigits: digits }));
  return numberFormatters.get(key).format(Number(value));
};
const dateText = (value, locale) => {
  if (!value) return "—";
  if (!dateFormatters.has(locale)) dateFormatters.set(locale, new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short", year: "numeric" }));
  return dateFormatters.get(locale).format(new Date(value));
};
const timeText = (value, locale) => {
  if (!value) return "—";
  if (!timeFormatters.has(locale)) timeFormatters.set(locale, new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }));
  return timeFormatters.get(locale).format(new Date(value));
};
const secondTimeText = (value, locale) => {
  if (!value) return "—";
  if (!secondTimeFormatters.has(locale)) secondTimeFormatters.set(locale, new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
  return secondTimeFormatters.get(locale).format(new Date(value));
};
const journeyClockText = (startedAtUtc, elapsedMinutes, locale) => {
  const startedAt = new Date(startedAtUtc).getTime(), elapsed = Number(elapsedMinutes);
  return Number.isFinite(startedAt) && Number.isFinite(elapsed) ? timeText(startedAt + elapsed * 60_000, locale) : "—";
};
const localHour = (value) => { const date = new Date(value); return Number.isFinite(date.getTime()) ? date.getHours() : null; };
const duration = (minutes, t) => minutes == null ? "—" : minutes >= 60 ? `${Math.floor(minutes / 60)} ${t("hourShort")} ${Math.round(minutes % 60)} ${t("minuteShort")}` : `${Math.round(minutes)} ${t("minuteShort")}`;
const monthText = (value, locale) => {
  if (!value) return "—";
  if (!monthFormatters.has(locale)) monthFormatters.set(locale, new Intl.DateTimeFormat(locale, { month: "short", year: "2-digit" }));
  return monthFormatters.get(locale).format(new Date(`${value}-01T00:00:00Z`));
};

const telemetrySyncProps = (data) => safe(data).some((row) => Object.hasOwn(row, "elapsed")) ? { syncId: "journey-telemetry", syncMethod: "value" } : safe(data).some((row) => Object.hasOwn(row, "elapsedMinutes")) ? { syncId: "charging-telemetry", syncMethod: "value" } : {};
const JourneyTimelineContext = React.createContext(null);
function journeyChartHandlers(data, timeline, onMouseMove, onMouseLeave) {
  if (!timeline || !safe(data).some((row) => Object.hasOwn(row, "elapsed"))) return { onMouseMove, onMouseLeave };
  return {
    onMouseMove: (state, event) => { onMouseMove?.(state, event); timeline.update(telemetryPointFromChart(state, data)); },
    onMouseLeave: (state, event) => { onMouseLeave?.(state, event); timeline.update(null); },
  };
}
function Area(props) { return <RechartsArea {...props} isAnimationActive={false} />; }
function Bar(props) { return <RechartsBar {...props} isAnimationActive={false} />; }
function Line(props) { return <RechartsLine {...props} isAnimationActive={false} />; }
function Pie(props) { return <RechartsPie {...props} isAnimationActive={false} />; }
function Scatter(props) { return <RechartsScatter {...props} isAnimationActive={false} />; }
function XAxis({ dataKey, hide, tick, ...props }) {
  const isTelemetry = dataKey === "elapsed" || dataKey === "elapsedMinutes";
  const timeline = React.useContext(JourneyTimelineContext);
  const telemetryTickFormatter = dataKey === "elapsed" && timeline?.formatTime ? timeline.formatTime : (value) => `${Math.round(Number(value) || 0)}m`;
  return <RechartsXAxis
    {...props}
    dataKey={dataKey}
    hide={isTelemetry ? false : hide}
    tick={isTelemetry ? { fill: "var(--muted)", fontSize: 9 } : tick}
    tickFormatter={isTelemetry ? telemetryTickFormatter : props.tickFormatter}
    type={isTelemetry ? "number" : props.type}
    domain={isTelemetry ? ["dataMin", "dataMax"] : props.domain}
    tickCount={isTelemetry ? 6 : props.tickCount}
    minTickGap={isTelemetry ? 35 : props.minTickGap}
    axisLine={isTelemetry ? false : props.axisLine}
    tickLine={isTelemetry ? false : props.tickLine}
  />;
}
function LineChart({ data, onMouseMove, onMouseLeave, ...props }) { const timeline=React.useContext(JourneyTimelineContext); return <RechartsLineChart data={data} {...telemetrySyncProps(data)} {...props} {...journeyChartHandlers(data,timeline,onMouseMove,onMouseLeave)} />; }
function AreaChart({ data, onMouseMove, onMouseLeave, ...props }) { const timeline=React.useContext(JourneyTimelineContext); return <RechartsAreaChart data={data} {...telemetrySyncProps(data)} {...props} {...journeyChartHandlers(data,timeline,onMouseMove,onMouseLeave)} />; }
function ComposedChart({ data, onMouseMove, onMouseLeave, ...props }) { const timeline=React.useContext(JourneyTimelineContext); return <RechartsComposedChart data={data} {...telemetrySyncProps(data)} {...props} {...journeyChartHandlers(data,timeline,onMouseMove,onMouseLeave)} />; }

function Icon({ name }) { return <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d={iconPaths[name]} /></svg>; }
function inPeriod(date, period, maxDate, customRange) { const value = String(date || "").slice(0,10); if (!value) return false; if (period === "all") return true; if (period === "custom") { const first = customRange?.start && customRange?.end && customRange.start > customRange.end ? customRange.end : customRange?.start; const last = customRange?.start && customRange?.end && customRange.start > customRange.end ? customRange.start : customRange?.end; return (!first || value >= first) && (!last || value <= last); } const boundary = new Date(`${maxDate}T00:00:00Z`); boundary.setUTCDate(boundary.getUTCDate() - Number(period) + 1); return value >= boundary.toISOString().slice(0, 10) && value <= maxDate; }
function PeriodBar({ period, setPeriod, customRange, setCustomRange, minDate, maxDate, t }) { const update=(field)=>(event)=>{const value=event.currentTarget.value;setCustomRange((current)=>({...current,[field]:value}));}; return <div className="period-bar"><span>{t("period")}</span>{[["7",t("sevenDays")],["15",t("fifteenDays")],["30",t("thirtyDays")],["all",t("allData")],["custom",t("customPeriod")]].map(([value,label])=><button key={value} className={period===value?"is-active":""} onClick={()=>setPeriod(value)}>{label}</button>)}{period==="custom"?<div className="custom-period"><label>{t("startDate")}<input type="date" min={minDate} max={maxDate} value={customRange.start} onInput={update("start")} onChange={update("start")}/></label><span>—</span><label>{t("endDate")}<input type="date" min={minDate} max={maxDate} value={customRange.end} onInput={update("end")} onChange={update("end")}/></label></div>:null}</div>; }
function Tip({ locale, suffix = "" }) { const timeline=React.useContext(JourneyTimelineContext); return <Tooltip cursor={{ stroke: "var(--muted)", strokeWidth: 1, strokeDasharray: "4 4" }} contentStyle={{ borderRadius: 10, border: "1px solid var(--line)", background: "var(--panel)", color: "var(--ink)", fontSize: 12, boxShadow: "var(--shadow)" }} labelFormatter={timeline?.formatTime || undefined} formatter={(value, name) => [`${num(value, locale, 2)}${suffix}`, name]} />; }
function ChargingTooltip({ active, label, series, locale, t, units }) {
  if (!active || label == null) return null;
  const point = safe(series).reduce((closest, row) => Math.abs(Number(row.elapsedMinutes) - Number(label)) < Math.abs(Number(closest?.elapsedMinutes ?? Infinity) - Number(label)) ? row : closest, null);
  if (!point) return null;
  const rows = [
    [t("power"), point.powerKw, "kW"], [t("peakPower"), point.powerPeakKw, "kW"], [t("soc"), point.socPct, "%"],
    [t("voltage"), point.voltageV, "V"], [t("current"), point.currentA, "A"],
    [t("batteryTemperature"), temperatureValue(point.batteryTempC, units.system), temperatureUnit(units.system)],
  ].filter(([, value]) => finiteValue(value));
  return <div className="telemetry-tooltip"><strong>{t("elapsedTime")}: {num(point.elapsedMinutes, locale, 1)} {t("minuteShort")}</strong>{rows.map(([name,value,unit])=><span key={name}><i/>{name}<b>{num(value,locale,2)} {unit}</b></span>)}</div>;
}
function ChargingTip({ series, locale, t, units }) { return <Tooltip cursor={{ stroke: "var(--muted)", strokeWidth: 1, strokeDasharray: "4 4" }} content={<ChargingTooltip series={series} locale={locale} t={t} units={units}/>} />; }
function Chart({ children, height = 285 }) { return <div className="chart-wrap" style={{ height }}><ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{width:800,height}}>{children}</ResponsiveContainer></div>; }
function Metric({ label, value, unit, note, tone = "", onActivate = null, ariaLabel = null }) {
  const activateFromKeyboard = (event) => {
    if (!onActivate || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    onActivate();
  };
  return <article className={`dash-metric ${tone ? `tone-${tone}` : ""} ${onActivate ? "is-secret-trigger" : ""}`} onClick={onActivate || undefined} onKeyDown={activateFromKeyboard} role={onActivate ? "button" : undefined} tabIndex={onActivate ? 0 : undefined} aria-label={ariaLabel || undefined}><span>{label}</span><strong>{value}{unit ? <small>{unit}</small> : null}</strong>{note ? <em>{note}</em> : null}</article>;
}
function Panel({ title, subtitle, action, children, collapsible = false, defaultCollapsed = false, scrollHeight = null, t = null }) {
  const [collapsed,setCollapsed]=useState(defaultCollapsed);
  const content=scrollHeight?<div className="dash-panel-scroll" style={{"--panel-scroll-height":typeof scrollHeight==="number"?`${scrollHeight}px`:scrollHeight}}>{children}</div>:children;
  return <section className={`dash-panel ${collapsible?"is-collapsible":""} ${collapsed?"is-collapsed":""}`}><header><div><h2>{title}</h2>{subtitle ? <p>{subtitle}</p> : null}</div>{action||collapsible?<div className="dash-panel-actions">{action}{collapsible?<button className="panel-collapse-button" type="button" aria-expanded={!collapsed} aria-label={t?.(collapsed?"expandSection":"collapseSection")||`${collapsed?"Expand":"Collapse"} ${title}`} onClick={()=>setCollapsed((value)=>!value)}><span>{t?.(collapsed?"expandSection":"collapseSection")|| (collapsed?"Expand":"Collapse")}</span><b aria-hidden="true">⌃</b></button>:null}</div>:null}</header>{collapsed?null:content}</section>;
}

function ShareInsightButton({card,t}){
  const [busy,setBusy]=useState(false),[failed,setFailed]=useState(false);
  const download=async()=>{if(busy)return;setBusy(true);setFailed(false);try{await downloadInsightCard(card);}catch(error){console.error(error);setFailed(true);}finally{setBusy(false);}};
  return <button className={`share-insight-button ${failed?"is-error":""}`} type="button" disabled={busy} onClick={download}>{busy?t("creatingCard"):failed?t("cardExportFailed"):t("shareAsImage")}</button>;
}

function GlobalSearch({data,locale,t,units,onClose,onSelect}){
  const [query,setQuery]=useState(""),[active,setActive]=useState(0),inputRef=useRef(null),deferredQuery=useDeferredValue(query);
  const index=useMemo(()=>buildGlobalSearchIndex(data,{locale,t,units}),[data,locale,t,units]);
  const results=useMemo(()=>searchGlobalIndex(index,deferredQuery),[deferredQuery,index]);
  useEffect(()=>{inputRef.current?.focus();},[]);
  useEffect(()=>setActive(0),[deferredQuery]);
  const choose=(result)=>{if(result){onSelect(result);onClose();}};
  const keyDown=(event)=>{if(event.key==="Escape")onClose();else if(event.key==="ArrowDown"){event.preventDefault();setActive((value)=>Math.min(results.length-1,value+1));}else if(event.key==="ArrowUp"){event.preventDefault();setActive((value)=>Math.max(0,value-1));}else if(event.key==="Enter"){event.preventDefault();choose(results[active]);}};
  return <div className="global-search-layer" role="presentation" onMouseDown={(event)=>{if(event.target===event.currentTarget)onClose();}}><section className="global-search-dialog" role="dialog" aria-modal="true" aria-label={t("globalSearch")} onKeyDown={keyDown}><header><Icon name="search"/><input ref={inputRef} value={query} onChange={(event)=>setQuery(event.currentTarget.value)} placeholder={t("globalSearchPlaceholder")} aria-label={t("globalSearchPlaceholder")}/><kbd>Esc</kbd></header><div className="global-search-body">{!query.trim()?<div className="global-search-hint"><strong>{t("globalSearchTitle")}</strong><p>{t("globalSearchHelp")}</p><span><kbd>↑</kbd><kbd>↓</kbd> {t("navigateResults")} · <kbd>Enter</kbd> {t("openResult")}</span></div>:results.length?<div className="global-search-results">{results.map((result,index)=><button key={result.id} type="button" className={index===active?"is-active":""} onMouseEnter={()=>setActive(index)} onClick={()=>choose(result)}><Icon name={result.type==="journey"?"journeys":result.type==="charge"?"charging":result.type==="chart"?"mycharts":result.type==="settings"?"quality":result.type==="date"?"activity":result.section||"search"}/><span><strong>{result.title}</strong><small>{result.detail}</small></span><em>{t(`searchType_${result.type}`)}</em></button>)}</div>:<div className="global-search-empty"><strong>{t("noSearchResults")}</strong><p>{t("noSearchResultsHelp")}</p></div>}</div></section></div>;
}

const DRIVING_PERSONALITY_AVATARS = {
  smoothOperator: "smooth-operator.png",
  efficiencyHunter: "efficiency-hunter.png",
  regenerationMaster: "regeneration-master.png",
  highwayCruiser: "highway-cruiser.png",
  urbanNavigator: "urban-navigator.png",
  roadTripper: "road-tripper.png",
  dynamicDriver: "dynamic-driver.png",
  nightOwl: "night-owl.png",
  earlyBird: "early-bird.png",
  weekendExplorer: "weekend-explorer.png",
  onePedalArtist: "one-pedal-artist.png",
  allRounder: "all-rounder.png",
};

function drivingPersonalityAvatar(key) {
  const file = DRIVING_PERSONALITY_AVATARS[key] || DRIVING_PERSONALITY_AVATARS.allRounder;
  return `${import.meta.env.BASE_URL}assets/personalities/${file}`;
}

function DrivingPersonalityDialog({ personality, t, onClose }) {
  useEffect(() => {
    const closeOnEscape = (event) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);
  const name = (key) => t(`drivingPersonality_${key}`), description = (key) => t(`drivingPersonality_${key}_description`);
  return <div className="driving-personality-layer" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="driving-personality-card" role="dialog" aria-modal="true" aria-labelledby="driving-personality-title"><button className="driving-personality-close" type="button" onClick={onClose} aria-label={t("close")}>×</button><div className="driving-personality-mark" aria-hidden="true"><img src={drivingPersonalityAvatar(personality.primary.key)} alt="" /></div><span>{t("drivingPersonalityUnlocked")}</span><h2 id="driving-personality-title">{name(personality.primary.key)}</h2><p>{description(personality.primary.key)}</p>{personality.secondary.length ? <div className="driving-personality-traits"><small>{t("drivingPersonalitySecondary")}</small><div>{personality.secondary.map((trait) => <span key={trait.key}><img src={drivingPersonalityAvatar(trait.key)} alt="" aria-hidden="true" />{name(trait.key)}</span>)}</div></div> : null}<footer><strong>{t("drivingPersonalityPeriod")}</strong></footer></section></div>;
}
function DrivingPersonalityMetric({ personality, profileKey, t }) {
  const [open, setOpen] = useState(false), tap = useRef(0);
  const traitKey = [personality.primary.key, ...personality.secondary.map((trait) => trait.key)].join("|");
  useEffect(() => {
    const preload = () => traitKey.split("|").forEach((key) => { const image = new Image(); image.decoding = "async"; image.src = drivingPersonalityAvatar(key); });
    if (typeof window.requestIdleCallback === "function") { const id = window.requestIdleCallback(preload, { timeout: 1200 }); return () => window.cancelIdleCallback(id); }
    const id = window.setTimeout(preload, 200); return () => window.clearTimeout(id);
  }, [traitKey]);
  const unlock = () => { const now = Date.now(); if (now - tap.current <= 650) { tap.current = 0; setOpen(true); } else tap.current = now; };
  const value = profileKey ? t(`drivingProfile_${profileKey}`) : "—";
  return <><Metric tone={profileKey === "aggressive" ? "coral" : profileKey === "dynamic" ? "amber" : "mint"} label={t("estimatedDrivingProfile")} value={value} note={<>{t("softwareEstimate")}<small className="secret-tease">{t("drivingPersonalityTease")}</small></>} onActivate={unlock} ariaLabel={`${t("estimatedDrivingProfile")}: ${value}`}/>{open ? <DrivingPersonalityDialog personality={personality} t={t} onClose={() => setOpen(false)}/> : null}</>;
}
function ProgressiveChartGrid({ children, resetKey, className = "" }) {
  const items = React.Children.toArray(children), containerRef = useRef(null);
  const [inRange, setInRange] = useState(false), [visibleCount, setVisibleCount] = useState(0);
  useEffect(() => {
    setInRange(false); setVisibleCount(0);
    const node = containerRef.current;
    if (!node || typeof IntersectionObserver === "undefined") { setInRange(true); return undefined; }
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { setInRange(true); observer.disconnect(); } }, { rootMargin: "280px 0px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [resetKey]);
  useEffect(() => {
    if (!inRange || visibleCount >= items.length) return undefined;
    const showNext = () => setVisibleCount((count) => Math.min(items.length, count + 1));
    if (typeof window.requestIdleCallback === "function") { const id = window.requestIdleCallback(showNext, { timeout: 250 }); return () => window.cancelIdleCallback(id); }
    const id = window.setTimeout(showNext, 16); return () => window.clearTimeout(id);
  }, [inRange, items.length, visibleCount]);
  return <div ref={containerRef} className={`dashboard-grid two technical-grid progressive-chart-grid ${className}`.trim()}>{items.map((item, index) => index < visibleCount ? item : <div className="progressive-chart-placeholder" aria-hidden="true" key={`placeholder-${index}`} />)}</div>;
}
function Empty({ t }) { return <div className="section-empty"><strong>{t("noResults")}</strong><p>{t("changePeriod")}</p></div>; }
function ChartEmpty({ t, message }) { return <div className="chart-empty-state"><strong>{t("noChartData")}</strong><p>{message || t("noChartDataHelp")}</p></div>; }

function percentageChange(current, previous) {
  const value = Number(current), baseline = Number(previous);
  return Number.isFinite(value) && Number.isFinite(baseline) && baseline !== 0 ? (value - baseline) / Math.abs(baseline) * 100 : null;
}

function Overview({ data, locale, t, period, maxDate, customRange, openSection, openRecord, units }) {
  const daily = safe(data.daily).filter((row) => inPeriod(row.date, period, maxDate, customRange));
  const trips = safe(data.trips).filter((row) => inPeriod(row.date, period, maxDate, customRange));
  const journeys = newestFirst(safe(data.journeys).filter((row) => inPeriod(row.date, period, maxDate, customRange)));
  const charges = newestFirst(safe(data.charges).filter((row) => inPeriod(row.date, period, maxDate, customRange)));
  const distance = sum(daily, "distanceKm"), net = sum(daily, "netEnergyKwh"), wall = sum(charges, "wallEnergyKwh"), battery = sum(charges, "batteryEnergyKwh");
  const displayDistanceUnit=distanceUnit(units.system), displayConsumptionUnit=consumptionUnit(units.system);
  const chartSource=daily.slice(-30), chartStart=chartSource[0]?.date, chartEnd=chartSource.at(-1)?.date;
  const chart = chartSource.map((row) => ({ ...row, distanceKm:distanceValue(row.distanceKm,units.system), consumptionDisplay:consumptionValue(Number(row.distanceKm)>0?Number(row.netEnergyKwh)/Number(row.distanceKm)*100:null,units.system), label: row.date?.slice(5) }));
  const priorEnd=chartStart?new Date(`${chartStart}T00:00:00Z`):null;
  if(priorEnd)priorEnd.setUTCDate(priorEnd.getUTCDate()-1);
  const priorStart=priorEnd?new Date(priorEnd):null;
  if(priorStart)priorStart.setUTCDate(priorStart.getUTCDate()-Math.max(0,chartSource.length-1));
  const previousDaily=priorStart&&priorEnd?safe(data.daily).filter((row)=>row.date>=priorStart.toISOString().slice(0,10)&&row.date<=priorEnd.toISOString().slice(0,10)):[];
  const previousDistance=sum(previousDaily,"distanceKm"),previousNet=sum(previousDaily,"netEnergyKwh");
  const consumption=distance?net/distance*100:null,previousConsumption=previousDistance?previousNet/previousDistance*100:null;
  const ownership=ownershipMaps(data.ownership),costs=charges.map((charge)=>chargeCostBreakdown(charge,data.ownership).cost).filter(Number.isFinite),estimatedCost=costs.length?costs.reduce((total,value)=>total+value,0):null;
  const previousCharges=priorStart&&priorEnd?safe(data.charges).filter((row)=>String(row.date||row.startedAtUtc||"").slice(0,10)>=priorStart.toISOString().slice(0,10)&&String(row.date||row.startedAtUtc||"").slice(0,10)<=priorEnd.toISOString().slice(0,10)):[];
  const previousCosts=previousCharges.map((charge)=>chargeCostBreakdown(charge,data.ownership).cost).filter(Number.isFinite),previousCost=previousCosts.length?previousCosts.reduce((total,value)=>total+value,0):null;
  const latestCharge=newestFirst(data.charges)[0],latestJourney=newestFirst(data.journeys)[0];
  const latestSocCandidate=[latestCharge?{date:latestCharge.endedAtUtc||latestCharge.startedAtUtc,value:latestCharge.socEndPct}:null,latestJourney?{date:latestJourney.endedAtUtc||latestJourney.startedAtUtc,value:latestJourney.socEndPct}:null].filter((row)=>finiteValue(row?.value)).sort((a,b)=>String(b.date||"").localeCompare(String(a.date||"")))[0];
  const tyreRows=safe(data.battery?.tyres).filter((row)=>inPeriod(row.date,period,maxDate,customRange)),latestTyres=tyreRows.at(-1),tyreValues=[latestTyres?.frontLeftKpa,latestTyres?.frontRightKpa,latestTyres?.rearLeftKpa,latestTyres?.rearRightKpa].filter(finiteValue).map((value)=>pressureValue(value,units.pressure));
  const parking=safe(data.battery?.parking).filter((row)=>inPeriod(row.startedAtUtc,period,maxDate,customRange)),parkedSeconds=sum(parking,"observedSeconds"),parkedEnergy=sum(parking,"energyKwh"),parkedPerDay=parkedSeconds?parkedEnergy/(parkedSeconds/86400):null;
  const events=[...journeys.slice(0,4).map((row)=>({kind:"journey",date:row.startedAtUtc,id:row.journeyId,row})),...charges.slice(0,4).map((row)=>({kind:"charge",date:row.startedAtUtc,id:row.chargeId,row}))].sort((a,b)=>String(b.date||"").localeCompare(String(a.date||""))).slice(0,4);
  const comparison=(value,inverse=false)=>value==null?null:{value:Math.abs(value),positive:inverse?value<=0:value>=0};
  const distanceDelta=comparison(percentageChange(distance,previousDistance)),consumptionDelta=comparison(percentageChange(consumption,previousConsumption),true),costDelta=comparison(percentageChange(estimatedCost,previousCost),true);
  const tyreHealthy=tyreValues.length===4&&tyreValues.every((value)=>units.pressure==="psi"?value>=32&&value<=42:value>=2.2&&value<=2.9);
  const observation=consumptionDelta?`${t(consumptionDelta.positive?"cockpitEfficiencyImproved":"cockpitEfficiencyChanged")} ${num(consumptionDelta.value,locale,0)}%` : t("cockpitObservationStable");
  const energyBalance = [
    { label: t("tractionEnergy"), energyKwh: sum(trips, "energyUsedKwh"), fill: C.teal },
    { label: t("regeneratedEnergy"), energyKwh: sum(trips, "regeneratedKwh"), fill: C.amber },
    { label: t("gridEnergy"), energyKwh: wall, fill: C.cyan },
    { label: t("batteryEnergy"), energyKwh: battery, fill: C.mint },
  ];
  return <div className="cockpit-home">
    <section className="cockpit-kpis">
      {[[t("distance"),num(distanceValue(distance,units.system),locale),displayDistanceUnit,distanceDelta],[t("averageConsumption"),num(consumptionValue(consumption,units.system),locale),displayConsumptionUnit,consumptionDelta],[t("estimatedChargingCost"),estimatedCost==null?"—":num(estimatedCost,locale,2),ownership.activeTariff?.currency||"",costDelta]].map(([label,value,unit,delta])=><article key={label}><strong>{value}<small>{unit}</small></strong><span>{label}</span>{delta?<em className={delta.positive?"is-positive":"is-negative"}>{delta.positive?"▾":"▴"} {num(delta.value,locale,0)}% {t("cockpitVsPrevious")}</em>:<em>{t("cockpitNoComparison")}</em>}</article>)}
    </section>
    <div className="cockpit-main-grid">
      <Panel title={t("cockpitPerformance")} subtitle={chartStart&&chartEnd?`${dateText(chartStart,locale)} — ${dateText(chartEnd,locale)}`:t("lastDaysInPeriod")} action={<span className="cockpit-coverage">✓ {chartSource.length} {t("observedDaysLower")}</span>}>
        {chart.length
          ? <Chart height={330}><ComposedChart data={chart} margin={{top:22,right:18,left:-8,bottom:5}}><CartesianGrid stroke="var(--grid)" vertical={false}/><XAxis dataKey="label" tick={{fill:"var(--muted)",fontSize:9}} axisLine={false} tickLine={false}/><YAxis yAxisId="distance" tick={{fill:"var(--muted)",fontSize:9}} axisLine={false} tickLine={false}/><YAxis yAxisId="consumption" orientation="right" tick={{fill:"var(--muted)",fontSize:9}} axisLine={false} tickLine={false}/><Tip locale={locale}/><Legend wrapperStyle={{fontSize:10}}/><Bar yAxisId="distance" dataKey="distanceKm" name={`${t("dailyDistance")} (${displayDistanceUnit})`} fill={C.mint} radius={[3,3,0,0]} maxBarSize={22}/><Line yAxisId="consumption" type="monotone" dataKey="consumptionDisplay" name={displayConsumptionUnit} stroke="#a6f3cf" dot={false} strokeWidth={2.5}/></ComposedChart></Chart>
          : <ChartEmpty t={t}/>
        }
      </Panel>
      <aside className="vehicle-pulse">
        <header><Icon name="activity"/><h2>{t("vehiclePulse")}</h2></header>
        <button type="button" onClick={()=>openSection("battery")}><span><Icon name="battery"/><strong>{t("nav_battery")}</strong></span><b>{finiteValue(latestSocCandidate?.value)?`${num(latestSocCandidate.value,locale,0)}%`:"—"}</b><small>{t("cockpitLatestObserved")}</small></button>
        <button type="button" onClick={()=>openSection("tyres")}><span><Icon name="tyres"/><strong>{t("nav_tyres")}</strong></span><b className={tyreHealthy?"is-good":""}>{tyreHealthy?t("cockpitTyresGood"):tyreValues.length?t("cockpitReviewTyres"):"—"}</b>{tyreValues.length?<small>{tyreValues.map((value)=>num(value,locale,units.pressure==="bar"?2:1)).join(" · ")} {pressureUnitLabel(units.pressure)}</small>:null}</button>
        <button type="button" onClick={()=>openSection("battery")}><span><Icon name="charging"/><strong>{t("parkedUse")}</strong></span><b>{parkedPerDay==null?"—":`${num(parkedPerDay,locale,2)} kWh/${t("dayShort")}`}</b><small>{t("cockpitObservedPeriod")}</small></button>
        <button type="button" onClick={()=>openSection("insights")}><span><Icon name="insights"/><strong>{t("cockpitObservation")}</strong></span><b className={consumptionDelta?.positive?"is-good":""}>{observation}</b><small>{t("cockpitOpenInsights")}</small></button>
      </aside>
    </div>
    <Panel title={t("cockpitRecentActivity")} subtitle={t("cockpitRecentActivityHelp")}><div className="cockpit-timeline">{events.map((event)=><button type="button" key={`${event.kind}-${event.id}`} onClick={()=>openRecord(event.kind==="journey"?"journeys":"charging",event.id)}><i className={event.kind}/><span><strong>{dateText(event.date,locale)}</strong><small>{event.kind==="journey"?t("journey"):t("chargingSession")}</small></span><b>{event.kind==="journey"?`${num(distanceValue(event.row.distanceKm,units.system),locale)} ${displayDistanceUnit}`:`+${num(event.row.batteryEnergyKwh,locale)} kWh`}</b><small>{event.kind==="journey"?`${num(consumptionValue(event.row.consumptionKwh100,units.system),locale)} ${displayConsumptionUnit}`:`${num(event.row.socStartPct,locale,0)} → ${num(event.row.socEndPct,locale,0)}%`}</small></button>)}</div></Panel>
    <details className="cockpit-details"><summary>{t("cockpitExploreDetails")}</summary>
    <div className="metric-grid overview-metrics"><Metric tone="mint" label={t("distance")} value={num(distanceValue(distance,units.system), locale)} unit={` ${displayDistanceUnit}`} note={`${journeys.length} ${t("journeysLower")}`} /><Metric tone="cyan" label={t("averageConsumption")} value={num(consumptionValue(consumption,units.system), locale)} unit={` ${displayConsumptionUnit}`} note={`${num(sum(daily, "regeneratedKwh"), locale)} kWh ${t("regeneratedLower")}`} /><Metric tone="violet" label={t("drivingTime")} value={num(sum(daily, "drivingHours"), locale)} unit={` ${t("hourShort")}`} note={`${trips.length} ${t("tripsLower")}`} /><Metric tone="amber" label={t("chargedEnergy")} value={num(battery, locale)} unit=" kWh" note={`${charges.length} ${t("chargesLower")}`} /><Metric tone="coral" label={t("chargeEfficiency")} value={num(wall ? battery / wall * 100 : null, locale)} unit="%" note={`${num(wall, locale)} kWh ${t("fromGrid")}`} /></div>
    <Panel title={t("totalEnergyBalance")} subtitle={t("totalEnergyBalanceHelp")} collapsible defaultCollapsed t={t}><Chart height={245}><BarChart data={energyBalance} layout="vertical" margin={{ top: 10, right: 24, left: 24 }}><CartesianGrid stroke="var(--grid)" horizontal={false}/><XAxis type="number" unit=" kWh" tick={{ fill: "var(--muted)", fontSize: 10 }}/><YAxis type="category" dataKey="label" width={145} tick={{ fill: "var(--muted)", fontSize: 10 }}/><Tip locale={locale} suffix=" kWh"/><Bar dataKey="energyKwh" name={t("energy")} radius={[0,5,5,0]}>{energyBalance.map((row)=><Cell key={row.label} fill={row.fill}/>)}</Bar></BarChart></Chart></Panel>
    </details>
  </div>;
}

function SimpleSectionIntro({ title, body }) {
  return <div className="simple-section-intro"><span>{title}</span><p>{body}</p></div>;
}

function SimpleOverview({ data, locale, t, period, maxDate, customRange, openRecord, units }) {
  const daily=safe(data.daily).filter((row)=>inPeriod(row.date,period,maxDate,customRange));
  const journeys=newestFirst(safe(data.journeys).filter((row)=>inPeriod(row.date,period,maxDate,customRange)));
  const charges=newestFirst(safe(data.charges).filter((row)=>inPeriod(row.date,period,maxDate,customRange)));
  const distance=sum(daily,"distanceKm"),energy=sum(daily,"netEnergyKwh"),consumption=distance?energy/distance*100:null;
  const chargeEnergy=sum(charges,"batteryEnergyKwh"),gridEnergy=sum(charges,"wallEnergyKwh"),chargeEfficiency=gridEnergy?chargeEnergy/gridEnergy*100:null,drivingHours=sum(daily,"drivingHours"),costs=charges.map((charge)=>chargeCostBreakdown(charge,data.ownership).cost).filter(Number.isFinite),cost=costs.length?costs.reduce((total,value)=>total+value,0):null;
  const currency=ownershipMaps(data.ownership).activeTariff?.currency||"";
  const chart=daily.slice(-30).map((row)=>({...row,label:String(row.date||"").slice(5),distanceDisplay:distanceValue(row.distanceKm,units.system)}));
  const events=[...journeys.slice(0,3).map((row)=>({kind:"journey",id:row.journeyId,date:row.startedAtUtc,row})),...charges.slice(0,3).map((row)=>({kind:"charge",id:row.chargeId,date:row.startedAtUtc,row}))].sort((a,b)=>String(b.date||"").localeCompare(String(a.date||""))).slice(0,5);
  return <div className="simple-dashboard">
    <SimpleSectionIntro title={t("simpleOverviewTitle")} body={t("simpleOverviewBody")}/>
    <div className="simple-hero-metrics is-five">
      <Metric tone="mint" label={t("distanceDriven")} value={num(distanceValue(distance,units.system),locale)} unit={` ${distanceUnit(units.system)}`} note={`${journeys.length} ${t("journeysLower")}`}/>
      <Metric tone="cyan" label={t("averageConsumption")} value={num(consumptionValue(consumption,units.system),locale)} unit={` ${consumptionUnit(units.system)}`} note={t("simpleConsumptionHelp")}/>
      <Metric tone="violet" label={t("drivingTime")} value={num(drivingHours,locale)} unit={` ${t("hourShort")}`} note={`${journeys.length} ${t("journeysLower")}`}/>
      <Metric tone="amber" label={t("chargedEnergy")} value={num(chargeEnergy,locale)} unit=" kWh" note={`${charges.length} ${t("chargesLower")}`}/>
      <Metric tone="coral" label={cost==null?t("chargeEfficiency"):t("estimatedChargingCost")} value={cost==null?num(chargeEfficiency,locale):num(cost,locale,2)} unit={cost==null?"%":` ${currency}`} note={cost==null?`${num(gridEnergy,locale)} kWh ${t("fromGrid")}`:t("costEstimateNote")}/>
    </div>
    <div className="simple-overview-grid">
      <Panel title={t("distanceByDay")} subtitle={t("simpleDistanceChartHelp")}>
        {chart.length
          ? <Chart height={260}><BarChart data={chart} margin={{top:12,right:10,left:-14}}><CartesianGrid stroke="var(--grid)" vertical={false}/><XAxis dataKey="label" tick={{fill:"var(--muted)",fontSize:9}}/><YAxis tick={{fill:"var(--muted)",fontSize:9}}/><Tip locale={locale} suffix={` ${distanceUnit(units.system)}`}/><Bar dataKey="distanceDisplay" name={t("distance")} fill={C.mint} radius={[5,5,0,0]}/></BarChart></Chart>
          : <ChartEmpty t={t}/>
        }
      </Panel>
      <Panel title={t("dailyEnergy")} subtitle={t("simpleEnergyChartHelp")}>
        {chart.length
          ? <Chart height={260}><ComposedChart data={chart} margin={{top:12,right:10,left:-14}}><CartesianGrid stroke="var(--grid)" vertical={false}/><XAxis dataKey="label" tick={{fill:"var(--muted)",fontSize:9}}/><YAxis unit=" kWh" tick={{fill:"var(--muted)",fontSize:9}}/><Tip locale={locale} suffix=" kWh"/><Area dataKey="netEnergyKwh" name={t("netEnergy")} stroke={C.teal} fill="rgba(58,181,174,.14)"/><Line dataKey="regeneratedKwh" name={t("regenerated")} stroke={C.amber} dot={false}/></ComposedChart></Chart>
          : <ChartEmpty t={t}/>
        }
      </Panel>
    </div>
    <Panel title={t("recentActivity")} subtitle={t("simpleRecentHelp")}><div className="simple-activity-list is-horizontal">{events.map((event)=><button type="button" key={`${event.kind}-${event.id}`} onClick={()=>openRecord(event.kind==="journey"?"journeys":"charging",event.id)}><i className={event.kind}/><span><strong>{event.kind==="journey"?t("journey"):t("chargingSession")}</strong><small>{dateText(event.date,locale)} · {timeText(event.date,locale)}</small></span><b>{event.kind==="journey"?`${num(distanceValue(event.row.distanceKm,units.system),locale)} ${distanceUnit(units.system)}`:`+${num(event.row.batteryEnergyKwh,locale)} kWh`}</b></button>)}</div></Panel>
  </div>;
}

function SimpleJourneyAnalysis({ journey, trips, locale, t, units }) {
  const timeline=useRef({update:()=>{},formatTime:null}).current;
  timeline.formatTime=(elapsed)=>journeyClockText(journey.startedAtUtc,elapsed,locale);
  const segments=useMemo(()=>{const byId=new Map(safe(trips).map((row)=>[row.tripId,row]));return safe(journey.tripIds).map((id)=>byId.get(id)).filter(Boolean);},[journey.tripIds,trips]);
  const series=useMemo(()=>{const started=new Date(journey.startedAtUtc).getTime(),source=segments.flatMap((trip)=>safe(trip.series));return sampleTimeline(source,300).map((point)=>{const timestamp=new Date(point.timestampUtc).getTime(),elapsed=Number.isFinite(timestamp)&&Number.isFinite(started)?(timestamp-started)/60000:Number(point.elapsedMinutes||0);return {...point,elapsed:Math.max(0,Math.round(elapsed*100)/100),speedKmh:speedValue(point.speedKmh,units.system)};});},[journey.startedAtUtc,segments,units.system]);
  return <JourneyTimelineContext.Provider value={timeline}><div className="simple-journey-analysis">{journey.gps?<Panel title={t("journeyRoute")} subtitle={t("simpleMapHelp")}><RouteMap gps={journey.gps} timeline={timeline} telemetry={series} locale={locale} t={t}/></Panel>:<div className="simple-no-map"><Icon name="journeys"/><span><strong>{t("noGpsForJourney")}</strong><small>{t("simpleNoGpsHelp")}</small></span></div>}<div className="simple-essential-charts"><Panel title={t("speedProfile")} subtitle={t("speedProfileHelp")}>{series.length?<Chart height={230}><LineChart data={series} margin={{top:12,right:12,left:-12}}><CartesianGrid stroke="var(--grid)" vertical={false}/><XAxis dataKey="elapsed"/><YAxis unit={` ${speedUnit(units.system)}`} tick={{fill:"var(--muted)",fontSize:9}}/><Tip locale={locale} suffix={` ${speedUnit(units.system)}`}/><Line dataKey="speedKmh" name={t("speed")} stroke={C.teal} dot={false} strokeWidth={2}/></LineChart></Chart>:<ChartEmpty t={t}/>}</Panel><Panel title={t("powerProfile")} subtitle={t("powerProfileHelp")}>{series.length?<Chart height={230}><AreaChart data={series} margin={{top:12,right:12,left:-12}}><CartesianGrid stroke="var(--grid)" vertical={false}/><XAxis dataKey="elapsed"/><YAxis unit=" kW" tick={{fill:"var(--muted)",fontSize:9}}/><ReferenceLine y={0} stroke="var(--muted)"/><Tip locale={locale} suffix=" kW"/><Area dataKey="powerKw" name={t("power")} stroke={C.amber} fill="rgba(227,166,47,.16)"/></AreaChart></Chart>:<ChartEmpty t={t}/>}</Panel></div></div></JourneyTimelineContext.Provider>;
}

function SimpleJourneys({ data, locale, t, period, maxDate, customRange, selectedId, setSelectedId, units, onRequestRecordDetails }) {
  const groupView=useMemo(()=>buildJourneyGroupView(data),[data]);
  const rows=useMemo(()=>{
    const grouped=groupView.membership,base=safe(data.journeys).filter((row)=>inPeriod(row.date,period,maxDate,customRange)&&!safe(row.tripIds).some((id)=>grouped.has(id)));
    return newestFirst([...groupView.groups.filter((row)=>inPeriod(row.date,period,maxDate,customRange)),...base]);
  },[customRange,data.journeys,groupView.groups,groupView.membership,maxDate,period]);
  const selected=rows.find((row)=>row.journeyId===selectedId)||rows[0];
  useEffect(()=>{if(selected&&!selected.detailLoaded&&!selected.isManualGroup)onRequestRecordDetails?.({journeyIds:[selected.journeyId]});},[onRequestRecordDetails,selected]);
  if(!rows.length)return <Empty t={t}/>;
  return <div className="simple-dashboard">
    <SimpleSectionIntro title={t("simpleJourneysTitle")} body={t("simpleJourneysBody")}/>
    <div className="simple-master-detail">
      <Panel title={t("journeyList")} subtitle={`${rows.length} ${t("journeysLower")}`}><div className="simple-record-list">{rows.map((row)=><button type="button" key={row.journeyId} className={row.journeyId===selected?.journeyId?"is-active":""} onClick={()=>setSelectedId(row.journeyId)}><span><strong>{row.isManualGroup?(row.name||t("unnamedJourneyGroup")):dateText(row.startedAtUtc,locale)}</strong><small>{timeText(row.startedAtUtc,locale)} · {duration(row.durationMinutes,t)} {row.gps?" · GPS":""}</small></span><b>{num(distanceValue(row.distanceKm,units.system),locale)} {distanceUnit(units.system)}</b></button>)}</div></Panel>
      {selected?<JourneyDetailSection selected={selected} trips={data.trips} locale={locale} t={t} units={units} mode="simple"/>:null}
    </div>
  </div>;
}

function SimpleCharging({ data, locale, t, period, maxDate, customRange, selectedId, setSelectedId, units, onRequestRecordDetails }) {
  const rows=newestFirst(safe(data.charges).filter((row)=>inPeriod(row.date||row.startedAtUtc,period,maxDate,customRange)));
  const selected=rows.find((row)=>row.chargeId===selectedId)||rows[0];
  useEffect(()=>{if(selected&&!selected.detailLoaded)onRequestRecordDetails?.({chargeIds:[selected.chargeId]});},[onRequestRecordDetails,selected]);
  if(!rows.length)return <Empty t={t}/>;
  const cost=selected?chargeCostBreakdown(selected,data.ownership):null,currency=cost?.tariff?.currency||"";
  return <div className="simple-dashboard">
    <SimpleSectionIntro title={t("simpleChargingTitle")} body={t("simpleChargingBody")}/>
    <div className="simple-master-detail">
      <Panel title={t("chargingHistory")} subtitle={`${rows.length} ${t("sessionsLower")}`}><div className="simple-record-list">{rows.map((row)=><button type="button" key={row.chargeId} className={row.chargeId===selected?.chargeId?"is-active":""} onClick={()=>setSelectedId(row.chargeId)}><span><strong>{dateText(row.startedAtUtc,locale)} <i className={`charge-type-badge type-${String(row.chargeType||"unknown").toLowerCase()}`}>{row.chargeType||"—"}</i></strong><small>{timeText(row.startedAtUtc,locale)} · {duration(row.durationMinutes,t)}</small></span><b>{num(row.batteryEnergyKwh,locale)} kWh</b></button>)}</div></Panel>
      {selected?<div className="simple-detail-stack"><Panel title={`${dateText(selected.startedAtUtc,locale)} · ${timeText(selected.startedAtUtc,locale)}`} subtitle={`${selected.chargeType||"—"} · ${num(selected.socStartPct,locale,0)} → ${num(selected.socEndPct,locale,0)}%`}><div className="simple-detail-metrics is-six"><Metric label={t("batteryEnergy")} value={num(selected.batteryEnergyKwh,locale)} unit=" kWh"/><Metric label={t("gridEnergy")} value={num(selected.wallEnergyKwh,locale)} unit=" kWh"/><Metric label={t("chargeEfficiency")} value={num(selected.efficiencyPct,locale)} unit="%"/><Metric label={t("duration")} value={duration(selected.durationMinutes,t)}/><Metric label={t("maximumPower")} value={num(selected.maxPowerKw,locale)} unit=" kW"/><Metric label={cost?.cost!=null?t("reportEstimatedCost"):t("losses")} value={cost?.cost!=null?num(cost.cost,locale,2):num(selected.lossKwh,locale)} unit={cost?.cost!=null?` ${currency}`:" kWh"}/></div></Panel><div className="simple-charge-progress"><span><i style={{width:`${Math.max(0,Math.min(100,Number(selected.socStartPct)||0))}%`}}/><b style={{width:`${Math.max(0,Math.min(100,Number(selected.socEndPct)||0))}%`}}/></span><small>{num(selected.socStartPct,locale,0)}%</small><strong>+{num((Number(selected.socEndPct)||0)-(Number(selected.socStartPct)||0),locale,0)}%</strong><small>{num(selected.socEndPct,locale,0)}%</small></div>{safe(selected.series).length?<Panel title={t("chargeCurve")} subtitle={t("powerAndSoc")}><Chart height={270}><LineChart data={selected.series} margin={{top:12,right:12,left:-12}}><CartesianGrid stroke="var(--grid)" vertical={false}/><XAxis dataKey="elapsedMinutes"/><YAxis yAxisId="a" unit=" kW" tick={{fill:"var(--muted)",fontSize:9}}/><YAxis yAxisId="b" orientation="right" domain={[0,100]} unit="%" tick={{fill:"var(--muted)",fontSize:9}}/><ChargingTip series={selected.series} locale={locale} t={t} units={units}/><Legend wrapperStyle={{fontSize:10}}/><Line yAxisId="a" dataKey="powerKw" name={t("powerKw")} stroke={C.teal} dot={false} strokeWidth={2}/><Line yAxisId="b" dataKey="socPct" name={t("soc")} stroke={C.amber} dot={false} strokeWidth={2}/></LineChart></Chart></Panel>:null}</div>:null}
    </div>
  </div>;
}

function VehicleProfileEditor({ ownership, onSave, t }) {
  const value=validateOwnershipMetadata(ownership),profile=value.vehicleProfile||{},resolved=resolvedVehicleProfile(profile);
  const [customModel,setCustomModel]=useState(profile.customModel||""),[customCapacity,setCustomCapacity]=useState(profile.usableCapacityKwh==null?"":String(profile.usableCapacityKwh));
  useEffect(()=>{setCustomModel(profile.customModel||"");setCustomCapacity(profile.usableCapacityKwh==null?"":String(profile.usableCapacityKwh));},[profile.customModel,profile.usableCapacityKwh,profile.variantId]);
  const select=(variantId)=>onSave?.(validateOwnershipMetadata({...value,vehicleProfile:{variantId,customModel:variantId==="custom"?customModel:"",usableCapacityKwh:variantId==="custom"?customCapacity:null}}));
  const saveCustom=()=>onSave?.(validateOwnershipMetadata({...value,vehicleProfile:{variantId:"custom",customModel,usableCapacityKwh:Number(String(customCapacity).replace(",","."))}}));
  return <div className="vehicle-profile-editor"><div><span><strong>{t("vehicleProfile")}</strong><small>{t("vehicleProfileHelp")}</small></span>{resolved?.sourceUrl?<a href={resolved.sourceUrl} target="_blank" rel="noreferrer">{t("officialSpecification")} ↗</a>:null}</div><select value={profile.variantId||""} onChange={(event)=>select(event.currentTarget.value)}><option value="">{t("selectVehicleVersion")}</option>{VEHICLE_VARIANTS.map((item)=><option key={item.id} value={item.id}>{item.model} · {item.generation} · {item.variant} · {item.usableCapacityKwh} kWh</option>)}<option value="custom">{t("customVehicleVersion")}</option></select>{profile.variantId==="custom"?<div className="vehicle-profile-custom"><input value={customModel} maxLength={60} placeholder={t("vehicleModelPlaceholder")} onChange={(event)=>setCustomModel(event.currentTarget.value)}/><div className="input-with-unit"><input value={customCapacity} inputMode="decimal" placeholder="80" onChange={(event)=>setCustomCapacity(event.currentTarget.value)}/><small>kWh</small></div><button className="secondary-button" type="button" onClick={saveCustom}>{t("save")}</button></div>:null}</div>;
}

function SimpleBattery({ data, locale, t, period, maxDate, customRange, onSaveOwnership, units }) {
  const history=safe(data.battery?.history).filter((row)=>inPeriod(row.date,period,maxDate,customRange)),assessment=useMemo(()=>assessBatteryHealth(history),[history]);
  const profile=resolvedVehicleProfile(data.ownership?.vehicleProfile),healthPct=profile&&assessment.capacityMedianKwh?assessment.capacityMedianKwh/profile.usableCapacityKwh*100:null;
  const daily=safe(data.daily).filter((row)=>inPeriod(row.date,period,maxDate,customRange)),distance=sum(daily,"distanceKm"),energy=sum(daily,"netEnergyKwh"),consumption=distance?energy/distance*100:null,estimatedRange=assessment.capacityMedianKwh&&consumption?assessment.capacityMedianKwh/consumption*100:null;
  const parking=safe(data.battery?.parking).filter((row)=>inPeriod(row.startedAtUtc,period,maxDate,customRange)),observedSeconds=sum(parking,"observedSeconds"),parkedEnergy=sum(parking,"energyKwh"),parkedWatts=observedSeconds?parkedEnergy/(observedSeconds/3600)*1000:null,longParking=parking.filter((row)=>Number(row.durationHours)>=6&&finiteValue(row.socLossPerDay)),parkedLoss=median(longParking.map((row)=>row.socLossPerDay));
  const [exporting,setExporting]=useState(false),[exportError,setExportError]=useState(false);
  const chart=history.map((row)=>({...row,capacity:row.rollingCapacityKwh??row.capacityKwh}));
  const exportReport=async()=>{if(!profile||!history.length||exporting)return;setExporting(true);setExportError(false);try{const {downloadBatteryReportPdf}=await import("./battery-report-pdf.js");await downloadBatteryReportPdf({data:{...data,battery:{...data.battery,history}},locale,t});}catch(error){console.error(error);setExportError(true);}finally{setExporting(false);}};
  return <div className="simple-dashboard simple-battery-page">
    <SimpleSectionIntro title={t("simpleBatteryTitle")} body={t("simpleBatteryBody")}/>
    <VehicleProfileEditor ownership={data.ownership} onSave={onSaveOwnership} t={t}/>
    {!history.length?<div className="simple-battery-empty"><strong>{t("batteryEstimateUnavailable")}</strong><p>{t("batteryEstimateUnavailableHelp")}</p></div>:<>
      <div className="battery-report-hero"><div className={`battery-health-ring status-${assessment.level}`} style={{"--health":`${Math.max(0,Math.min(100,healthPct||0))}%`}}><span><strong>{healthPct==null?"—":`${num(healthPct,locale)}%`}</strong><small>{t("batteryEstimatedHealth")}</small></span></div><div><span>{t("batteryEstimateSummary")}</span><h2>{num(assessment.capacityMedianKwh,locale)} kWh</h2><p>{profile?`${t("batteryComparedWith")} ${profile.usableCapacityKwh} kWh · ${vehicleProfileLabel(data.ownership.vehicleProfile)}`:t("batterySelectVehiclePrompt")}</p><div className="battery-report-evidence"><span><small>{t("confidence")}</small><strong>{t(`batteryConfidence_${assessment.level}`)}</strong></span><span><small>{t("qualifiedCharges")}</small><strong>{assessment.sampleCount}</strong></span><span><small>{t("observationPeriod")}</small><strong>{assessment.spanDays} {t("daysLower")}</strong></span></div></div><button className="battery-report-button" type="button" disabled={!profile||assessment.sampleCount<1||exporting} onClick={exportReport}><Icon name="report"/><span><strong>{exporting?t("reportGenerating"):t("downloadBatteryReport")}</strong><small>{profile?t("batteryReportButtonHelp"):t("batterySelectVehicleFirst")}</small></span></button></div>
      <div className="simple-battery-metrics"><Metric tone="mint" label={t("estimatedCapacity")} value={num(assessment.capacityMedianKwh,locale)} unit=" kWh" note={`${assessment.sampleCount} ${t("qualifiedChargesLower")}`}/><Metric tone="cyan" label={t("realRange100")} value={num(distanceValue(estimatedRange,units.system),locale)} unit={` ${distanceUnit(units.system)}`} note={`${num(consumptionValue(consumption,units.system),locale)} ${consumptionUnit(units.system)}`}/><Metric tone="violet" label={t("parkedObservedDraw")} value={num(parkedWatts,locale)} unit=" W" note={`${num(parkedEnergy,locale)} kWh ${t("measuredWhileParked")}`}/><Metric tone="coral" label={t("parkedLossPerDay")} value={num(parkedLoss,locale,2)} unit={`%/${t("dayShort")}`} note={`${longParking.length} ${t("longIntervals")}`}/></div>
      <div className="battery-estimate-notice"><strong>{t("batteryEstimateNoticeTitle")}</strong><p>{t("batteryReportDisclaimer")}</p></div>
      {exportError?<div className="report-error">{t("batteryReportError")}</div>:null}
      <Panel title={t("batteryCapacityHistory")} subtitle={t("batteryCapacityHistoryHelp")}>{chart.length?<Chart height={260}><LineChart data={chart} margin={{top:15,right:14,left:-8}}><CartesianGrid stroke="var(--grid)" vertical={false}/><XAxis dataKey="date" tick={{fill:"var(--muted)",fontSize:9}}/><YAxis domain={["auto","auto"]} unit=" kWh" tick={{fill:"var(--muted)",fontSize:9}}/><Tip locale={locale} suffix=" kWh"/><Line dataKey="capacity" name={t("estimatedCapacity")} stroke={C.mint} dot={{r:2}} strokeWidth={2}/>{profile?<ReferenceLine y={profile.usableCapacityKwh} stroke={C.amber} strokeDasharray="5 4" label={{value:t("batteryNewReference"),fill:"var(--muted)",fontSize:9}}/>:null}</LineChart></Chart>:<ChartEmpty t={t}/>}</Panel>
    </>}
  </div>;
}

function RouteMap({ gps, timeline, telemetry, t, locale }) {
  const containerRef = useRef(null), statusRef = useRef(null);
  const mapRef = useRef(null), leafletRef = useRef(null), activeMarkerRef = useRef(null);
  const [tileError,setTileError]=useState(false),[colorMode,setColorMode]=useState("speed"),[activeElevation,setActiveElevation]=useState(null);
  const routeModel=useMemo(()=>buildRouteIntelligence(gps?.segments,telemetry),[gps?.segments,telemetry]);
  const routePoints=routeModel.points;
  const routeTimestampLookup=useMemo(()=>createRouteTimestampLookup(routePoints),[routePoints]);
  useEffect(()=>{if(colorMode!=="route"&&!routeModel.available[colorMode])setColorMode("route");},[colorMode,routeModel.available]);
  useEffect(() => {
    let disposed = false, map = null;
    const draw = async () => {
      const module = await import("leaflet");
      if (disposed || !containerRef.current) return;
      const L = module.default || module;
      map = L.map(containerRef.current, { zoomControl: true, attributionControl: true, preferCanvas: true });
      mapRef.current=map;leafletRef.current=L;
      const tiles=L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, crossOrigin: true, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' });
      tiles.on("tileerror",()=>setTileError(true));tiles.on("load",()=>setTileError(false));tiles.addTo(map);
      const lines = routeModel.segments.filter((segment) => segment.length > 1);
      const routePointCount=lines.reduce((total,line)=>total+line.length,0),edgeBatchSize=Math.max(1,Math.ceil(routePointCount/180));
      const layers = lines.flatMap((line) => {
        const batches=[];
        for(let start=0;start<line.length-1;start+=edgeBatchSize){
          const stop=Math.min(line.length,start+edgeBatchSize+1),points=line.slice(start,stop),sample=points[Math.floor(points.length/2)];
          batches.push(L.polyline(points.map((point)=>[point.lat,point.lon]), { color: routeMetricColor(colorMode,routeMetricValue(sample,colorMode)), weight: 5, opacity: .92 }).addTo(map));
        }
        return batches;
      });
      const points = lines.flat().map((point)=>[point.lat,point.lon]);
      if (points.length) {
        L.circleMarker(points[0], { radius: 6, color: "#0d785c", fillColor: "#20a983", fillOpacity: 1 }).bindTooltip(t("routeStart")).addTo(map);
        L.circleMarker(points.at(-1), { radius: 6, color: "#b55340", fillColor: "#e27b66", fillOpacity: 1 }).bindTooltip(t("routeEnd")).addTo(map);
        const group = L.featureGroup(layers);
        map.fitBounds(group.getBounds(), { padding: [24, 24], maxZoom: 17 });
      } else map.setView([0, 0], 2);
    };
    draw();
    return () => { disposed = true; activeMarkerRef.current=null; mapRef.current=null; leafletRef.current=null; map?.remove(); };
  }, [colorMode, gps, locale, routeModel.segments, t]);
  useEffect(()=>{
    let frame=null,pending=null;
    const update=(telemetry)=>{
      pending=telemetry||null;
      if(frame!==null)return;
      frame=requestAnimationFrame(()=>{
        frame=null;
        const map=mapRef.current,L=leafletRef.current,activePoint=routePointForTelemetry(routeTimestampLookup,pending),status=statusRef.current;
        if(!map||!L)return;
        if(!activePoint){activeMarkerRef.current?.remove();activeMarkerRef.current=null;setActiveElevation(null);if(status){status.textContent=t("mapChartHint");status.classList.remove("is-active");}return;}
        const position=[activePoint.lat,activePoint.lon],label=`${t("mapChartPosition")} · ${secondTimeText(activePoint.timestampUtc,locale)}`;
        if(!activeMarkerRef.current)activeMarkerRef.current=L.circleMarker(position,{radius:8,color:"#ffffff",weight:3,fillColor:"#8a82d5",fillOpacity:1,className:"route-live-marker"}).addTo(map).bindTooltip(label,{direction:"top",offset:[0,-8]});
        else activeMarkerRef.current.setLatLng(position).setTooltipContent(label);
        activeMarkerRef.current.bringToFront();
        setActiveElevation(activePoint.distanceKm);
        if(status){status.textContent=t("mapChartPosition");status.classList.add("is-active");}
      });
    };
    timeline.update=update;
    return()=>{if(frame!==null)cancelAnimationFrame(frame);if(timeline.update===update)timeline.update=()=>{};};
  },[locale,routeTimestampLookup,t,timeline]);
  return <div className="route-map-wrap">
    <div className="route-map-toolbar"><div><strong>{t("routeMap")}</strong><small>{t("routeMapLocalTrace")}</small></div><div className="route-map-controls"><label><span>{t("routeColourBy")}</span><select value={colorMode} onChange={(event)=>setColorMode(event.currentTarget.value)}><option value="route">{t("routeColour_route")}</option>{["speed","power","regeneration","consumption"].filter((mode)=>routeModel.available[mode]).map((mode)=><option key={mode} value={mode}>{t(`routeColour_${mode}`)}</option>)}</select></label><span ref={statusRef} className="route-map-sync" aria-live="polite">{t("mapChartHint")}</span></div></div>
    <div ref={containerRef} className="route-map has-tiles" aria-label={t("routeMap")}/>
    {colorMode!=="route"?<div className="route-colour-legend"><span>{t(`routeColour_${colorMode}`)}</span><i aria-hidden="true" style={{background:`linear-gradient(90deg, ${routeMetricColor(colorMode,-40)}, ${routeMetricColor(colorMode,0)}, ${routeMetricColor(colorMode,60)}, ${routeMetricColor(colorMode,160)})`}}/><small>{t("routeColourLow")}</small><small>{t("routeColourHigh")}</small></div>:null}
    <div className="route-map-meta"><span>{t("gpsSource")}: <strong>{gps.sourceName}</strong></span><span>{t("matchConfidence")}: <strong>{num(gps.confidenceScore,locale,0)}%</strong></span><span>{t("gpsMatchCoverage")}: <strong>{num(gps.coveragePct,locale,0)}%</strong></span><span>{num(gps.points,locale,0)} {t("gpsPointsLower")}</span>{gps.trimMeters?<span>{t("trimmedRouteEnds")}: {num(gps.trimMeters,locale,0)} m</span>:null}</div>
    {routeModel.elevation.length>2?<div className="route-elevation"><strong>{t("routeElevation")}</strong><Chart height={150}><AreaChart data={routeModel.elevation} margin={{top:10,right:12,left:-12}}><CartesianGrid stroke="var(--grid)" vertical={false}/><XAxis dataKey="distanceKm" unit=" km" tick={{fill:"var(--muted)",fontSize:8}}/><YAxis unit=" m" tick={{fill:"var(--muted)",fontSize:8}}/><Tip locale={locale} suffix=" m"/>{activeElevation!=null?<ReferenceLine x={activeElevation} stroke={C.violet} strokeWidth={2}/>:null}<Area dataKey="elevationM" name={t("elevation")} stroke={C.violet} fill="rgba(138,130,213,.16)"/></AreaChart></Chart></div>:null}
    {gps.routeContext?<div className="route-context-estimate"><div><strong>{t("gpsDrivingContext")}</strong><small>{t("gpsDrivingContextHelp")}</small></div><span className={`route-context-badge is-${gps.routeContext.dominant}`}>{t(`context_${gps.routeContext.dominant}`)}</span><div className="route-context-shares"><span>{t("context_urban")} <b>{num(gps.routeContext.shares?.urban,locale,0)}%</b></span><span>{t("context_road")} <b>{num(gps.routeContext.shares?.road,locale,0)}%</b></span><span>{t("context_motorway")} <b>{num(gps.routeContext.shares?.motorway,locale,0)}%</b></span></div></div>:null}
    {gps.diagnostics?.partial||gps.diagnostics?.sparse||gps.diagnostics?.clockOffsetMinutes?<div className="gps-diagnostic-list">{gps.diagnostics.partial?<span>{t("gpsPartialMatch")}</span>:null}{gps.diagnostics.sparse?<span>{t("gpsSparseRecording")}</span>:null}{gps.diagnostics.clockOffsetMinutes?<span>{t("gpsClockAdjusted").replace("{minutes}",String(Array.isArray(gps.diagnostics.clockOffsetMinutes)?gps.diagnostics.clockOffsetMinutes.join(", "):gps.diagnostics.clockOffsetMinutes))}</span>:null}</div>:null}
    {tileError?<p className="route-map-privacy is-error">{t("mapTilesError")}</p>:null}
  </div>;
}

function MotorTelemetryPanel({ series, segments, locale, t, units }) {
  const front=series.some((row)=>finiteValue(row.frontMotorRpm)||finiteValue(row.frontMotorTorqueNm)),rear=series.some((row)=>finiteValue(row.rearMotorRpm)||finiteValue(row.rearMotorTorqueNm));
  if(!front&&!rear)return null;
  const type=front&&rear?"awd":front?"front":"rear",max=(field)=>maximum(segments,field);
  return <Panel title={t("motorTelemetry")} subtitle={t(`motorTelemetry_${type}`)} action={<span className={`powertrain-badge is-${type}`}>{t(`powertrain_${type}`)}</span>} collapsible defaultCollapsed t={t}><div className="metric-grid detail-metrics motor-metrics">{front?<><Metric tone="cyan" label={t("frontMotorSpeed")} value={num(max("maxFrontMotorRpm"),locale,0)} unit=" rpm"/><Metric tone="cyan" label={t("frontMotorTorque")} value={num(max("maxFrontTorqueNm"),locale)} unit=" Nm"/><Metric label={t("frontRotorTemperature")} value={num(temperatureValue(max("maxFrontRotorTempC"),units.system),locale)} unit={` ${temperatureUnit(units.system)}`}/></>:null}{rear?<><Metric tone="amber" label={t("rearMotorSpeed")} value={num(max("maxRearMotorRpm"),locale,0)} unit=" rpm"/><Metric tone="amber" label={t("rearMotorTorque")} value={num(max("maxRearTorqueNm"),locale)} unit=" Nm"/><Metric label={t("rearRotorTemperature")} value={num(temperatureValue(max("maxRearRotorTempC"),units.system),locale)} unit={` ${temperatureUnit(units.system)}`}/></>:null}</div><Chart height={230}><LineChart data={series} margin={{top:12,right:12,left:-8}}><CartesianGrid stroke="var(--grid)" vertical={false}/><XAxis dataKey="elapsed" hide/><YAxis unit=" Nm" tick={{fill:"var(--muted)",fontSize:9}}/><Tip locale={locale} suffix=" Nm"/><Legend wrapperStyle={{fontSize:9}}/>{front?<Line dataKey="frontMotorTorqueNm" name={t("frontMotorTorque")} stroke={C.cyan} dot={false}/>:null}{rear?<Line dataKey="rearMotorTorqueNm" name={t("rearMotorTorque")} stroke={C.amber} dot={false}/>:null}</LineChart></Chart></Panel>;
}

function JourneyDetail({ selected, trips, locale, t, units, mode="advanced" }) {
  const [activeTab,setActiveTab]=useState("overview");
  const timeline=useRef({update:()=>{},formatTime:null}).current;
  timeline.formatTime=(elapsed)=>journeyClockText(selected.startedAtUtc,elapsed,locale);
  useEffect(()=>timeline.update(null),[selected.journeyId,timeline]);
  const segments = useMemo(() => {
    const tripById = new Map(safe(trips).map((trip) => [trip.tripId, trip]));
    return safe(selected.tripIds).map((id) => tripById.get(id)).filter(Boolean);
  }, [selected.tripIds, trips]);
  const series = useMemo(() => {
    const journeyStartedAt = new Date(selected.startedAtUtc).getTime();
    const source = segments.flatMap((trip, segment) => safe(trip.series).map((point) => ({ point, segment })));
    return sampleTimeline(source, 420).map(({ point, segment }) => {
      const timestamp = new Date(point.timestampUtc).getTime();
      const elapsed = Number.isFinite(timestamp) && Number.isFinite(journeyStartedAt) ? (timestamp - journeyStartedAt) / 60000 : segment * 1000 + Number(point.elapsedMinutes || 0);
      return { ...point, speedKmh:speedValue(point.speedKmh,units.system), speedPeakKmh:speedValue(point.speedPeakKmh,units.system), displayedRangeKm:distanceValue(point.displayedRangeKm,units.system), batteryTempC:temperatureValue(point.batteryTempC,units.system), tyreFrontLeftKpa:pressureValue(point.tyreFrontLeftKpa,units.pressure), tyreFrontRightKpa:pressureValue(point.tyreFrontRightKpa,units.pressure), tyreRearLeftKpa:pressureValue(point.tyreRearLeftKpa,units.pressure), tyreRearRightKpa:pressureValue(point.tyreRearRightKpa,units.pressure), elapsed: Math.max(0, Math.round(elapsed * 100) / 100) };
    });
  }, [segments, selected.startedAtUtc, units.pressure, units.system]);
  const maxOf = (field) => maximum(segments, field);
  const telemetryGapCount = sum(segments, "gapCount");
  const hasSeries = (fields) => series.some((row) => fields.some((field) => finiteValue(row[field])));
  useEffect(()=>setActiveTab("overview"),[selected.journeyId]);
  const tabs=mode==="simple"?["overview"]:["overview","energy","driving","battery","technical"];
  const qualityLabel=telemetryGapCount?t("workspaceDataPartial"):t("workspaceDataGood");
  const overviewCharts=<div className="workspace-chart-stack"><Panel title={t("speedProfile")} subtitle={t("speedProfileHelp")}><Chart height={205}><LineChart data={series} margin={{top:12,right:16,left:-10,bottom:2}}><CartesianGrid stroke="var(--grid)" vertical={false}/><XAxis dataKey="elapsed" tickFormatter={(value)=>journeyClockText(selected.startedAtUtc,value,locale)} tick={{fill:"var(--muted)",fontSize:9}}/><YAxis tick={{fill:"var(--muted)",fontSize:9}} axisLine={false} tickLine={false}/><Tip locale={locale} suffix={` ${speedUnit(units.system)}`}/><Line type="monotone" dataKey="speedKmh" name={t("speed")} stroke={C.teal} dot={false} strokeWidth={2}/></LineChart></Chart></Panel><Panel title={t("powerProfile")} subtitle={t("powerProfileHelp")}><Chart height={205}><AreaChart data={series} margin={{top:12,right:16,left:-10,bottom:2}}><CartesianGrid stroke="var(--grid)" vertical={false}/><XAxis dataKey="elapsed" tickFormatter={(value)=>journeyClockText(selected.startedAtUtc,value,locale)} tick={{fill:"var(--muted)",fontSize:9}}/><YAxis tick={{fill:"var(--muted)",fontSize:9}} axisLine={false} tickLine={false}/><ReferenceLine y={0} stroke="var(--muted)"/><Tip locale={locale} suffix=" kW"/><Area type="monotone" dataKey="powerKw" name={t("power")} stroke={C.mint} fill="rgba(32,169,131,.17)"/></AreaChart></Chart></Panel></div>;
  return <JourneyTimelineContext.Provider value={timeline}><section className={`analytics-workspace journey-workspace is-${mode}`}>
    <header className="workspace-heading"><div><span>{t("workspaceEyebrow")}</span><h2>{t("workspaceJourneyTitle")}</h2><p>{dateText(selected.startedAtUtc,locale)} · {timeText(selected.startedAtUtc,locale)} · {segments.length} {t("segmentsLower")}</p></div>{selected.gps?<i className="route-available">GPS</i>:null}</header>
    <div className="workspace-metrics"><Metric label={t("distance")} value={num(distanceValue(selected.distanceKm,units.system),locale)} unit={` ${distanceUnit(units.system)}`}/><Metric label={t("duration")} value={duration(selected.durationMinutes,t)}/><Metric label={t("averageConsumption")} value={num(consumptionValue(selected.consumptionKwh100,units.system),locale)} unit={` ${consumptionUnit(units.system)}`}/><Metric label={t("maximumSpeed")} value={num(speedValue(selected.maxSpeedKmh,units.system),locale)} unit={` ${speedUnit(units.system)}`}/></div>
    {mode!=="simple"?<nav className="workspace-tabs" role="tablist" aria-label={t("workspaceJourneyTitle")}>{tabs.map((tab)=><button key={tab} type="button" role="tab" aria-selected={activeTab===tab} className={activeTab===tab?"is-active":""} onClick={()=>setActiveTab(tab)}>{t(`workspaceTab_${tab}`)}</button>)}</nav>:null}
    <div className="workspace-content" role="tabpanel">
      {activeTab==="overview"?<><div className={`workspace-map ${selected.gps?"has-map":"no-map"}`}>{selected.gps?<RouteMap gps={selected.gps} timeline={timeline} telemetry={series} t={t} locale={locale}/>:<div className="simple-no-map"><Icon name="journeys"/><span><strong>{t("noGpsForJourney")}</strong><small>{t("simpleNoGpsHelp")}</small></span></div>}</div><div className="workspace-context-strip"><span><small>SOC</small><strong>{num(selected.socStartPct,locale,0)}% → {num(selected.socEndPct,locale,0)}%</strong></span><span><small>{t("netEnergy")}</small><strong>{num(selected.netEnergyKwh,locale)} kWh</strong></span><span><small>{t("regenerated")}</small><strong>{num(selected.regeneratedKwh,locale)} kWh</strong></span><span className={telemetryGapCount?"is-warning":"is-good"}><small>{t("workspaceDataQuality")}</small><strong>{qualityLabel}</strong></span></div>{overviewCharts}</>:null}
      {activeTab==="energy"?<><div className="workspace-secondary-metrics"><Metric tone="mint" label={t("netEnergy")} value={num(selected.netEnergyKwh,locale)} unit=" kWh"/><Metric tone="amber" label={t("regenerated")} value={num(selected.regeneratedKwh,locale)} unit=" kWh" note={`${num(selected.regenerationSharePct,locale)}% ${t("grossEnergy")}`}/><Metric tone="cyan" label={t("peakDrivePower")} value={num(maxOf("peakDrivePowerKw"),locale)} unit=" kW"/><Metric tone="violet" label={t("peakRegeneration")} value={num(maxOf("peakRegenPowerKw"),locale)} unit=" kW"/></div><div className="workspace-grid"><Panel title={t("socAndRange")} subtitle={t("socAndRangeHelp")}><Chart><LineChart data={series}><CartesianGrid stroke="var(--grid)" vertical={false}/><XAxis dataKey="elapsed" hide/><YAxis yAxisId="a"/><YAxis yAxisId="b" orientation="right"/><Tip locale={locale}/><Line yAxisId="a" dataKey="socPct" name="SOC %" stroke={C.mint} dot={false}/><Line yAxisId="b" dataKey="displayedRangeKm" name={t("displayedRange")} stroke={C.violet} dot={false}/></LineChart></Chart></Panel><Panel title={t("temperatureProfile")} subtitle={t("temperatureProfileHelp")}><Chart><LineChart data={series}><CartesianGrid stroke="var(--grid)" vertical={false}/><XAxis dataKey="elapsed" hide/><YAxis/><Tip locale={locale} suffix={` ${temperatureUnit(units.system)}`}/><Line dataKey="batteryTempC" name={t("batteryTemperature")} stroke={C.coral} dot={false}/></LineChart></Chart></Panel></div></>:null}
      {activeTab==="driving"?<><div className="workspace-secondary-metrics"><Metric tone="mint" label={t("maximumAcceleration")} value={num(maxOf("maxAccelerationG"),locale,2)} unit=" g"/><Metric tone="coral" label={t("maximumBraking")} value={num(maxOf("maxBrakingG"),locale,2)} unit=" g"/><Metric tone="violet" label={t("maximumCornering")} value={num(maxOf("maxLateralG"),locale,2)} unit=" g"/><Metric tone="cyan" label={t("maximumSteeringAngle")} value={num(maxOf("maxSteeringAngleDeg"),locale,0)} unit="°"/></div><div className="workspace-grid"><Panel title={t("drivingForces")} subtitle={t("drivingForcesHelp")}>{hasSeries(["longitudinalG","lateralG"])?<Chart><LineChart data={series}><CartesianGrid stroke="var(--grid)" vertical={false}/><XAxis dataKey="elapsed" hide/><YAxis unit=" g"/><ReferenceLine y={0}/><Tip locale={locale}/><Line dataKey="longitudinalG" name={t("longitudinalAcceleration")} stroke={C.teal} dot={false}/><Line dataKey="lateralG" name={t("lateralAcceleration")} stroke={C.violet} dot={false}/></LineChart></Chart>:<ChartEmpty t={t}/>}</Panel><Panel title={t("pedalProfile")} subtitle={t("pedalProfileHelp")}>{hasSeries(["acceleratorPct","brakePct"])?<Chart><ComposedChart data={series}><CartesianGrid stroke="var(--grid)" vertical={false}/><XAxis dataKey="elapsed" hide/><YAxis domain={[0,100]} unit="%"/><Tip locale={locale}/><Area dataKey="acceleratorPct" name={t("averageAccelerator")} stroke={C.cyan} fill="rgba(99,183,212,.16)"/><Line dataKey="brakePct" name={t("brakeActive")} stroke={C.coral} dot={false}/></ComposedChart></Chart>:<ChartEmpty t={t}/>}</Panel></div></>:null}
      {activeTab==="battery"?<><div className="workspace-secondary-metrics"><Metric tone="mint" label="SOC" value={`${num(selected.socStartPct,locale,0)} → ${num(selected.socEndPct,locale,0)}`} unit="%"/><Metric tone="cyan" label={t("displayedRange")} value={num(distanceValue(selected.rangeEndKm,units.system),locale)} unit={` ${distanceUnit(units.system)}`}/><Metric tone="coral" label={t("rearRotorTemperature")} value={num(temperatureValue(maxOf("maxRearRotorTempC"),units.system),locale)} unit={` ${temperatureUnit(units.system)}`}/><Metric tone="amber" label={t("tyrePressureRange")} value={`${num(pressureValue(Math.min(...segments.map((row)=>row.tyrePressureMinKpa).filter(Number.isFinite)),units.pressure),locale)}–${num(pressureValue(maxOf("tyrePressureMaxKpa"),units.pressure),locale)}`} unit={` ${pressureUnitLabel(units.pressure)}`}/></div><div className="workspace-grid"><Panel title={t("temperatureProfile")}><Chart><LineChart data={series}><CartesianGrid stroke="var(--grid)" vertical={false}/><XAxis dataKey="elapsed" hide/><YAxis/><Tip locale={locale}/><Line dataKey="batteryTempC" name={t("batteryTemperature")} stroke={C.coral} dot={false}/></LineChart></Chart></Panel><Panel title={t("journeyTyrePressure")} subtitle={t("journeyTyrePressureHelp")}>{hasSeries(["tyreFrontLeftKpa","tyreFrontRightKpa","tyreRearLeftKpa","tyreRearRightKpa"])?<Chart><LineChart data={series}><CartesianGrid stroke="var(--grid)" vertical={false}/><XAxis dataKey="elapsed" hide/><YAxis/><Tip locale={locale} suffix={` ${pressureUnitLabel(units.pressure)}`}/><Line dataKey="tyreFrontLeftKpa" name={t("frontLeftShort")} stroke={C.mint} dot={false}/><Line dataKey="tyreFrontRightKpa" name={t("frontRightShort")} stroke={C.cyan} dot={false}/><Line dataKey="tyreRearLeftKpa" name={t("rearLeftShort")} stroke={C.amber} dot={false}/><Line dataKey="tyreRearRightKpa" name={t("rearRightShort")} stroke={C.coral} dot={false}/></LineChart></Chart>:<ChartEmpty t={t}/>}</Panel></div></>:null}
      {activeTab==="technical"?<><MotorTelemetryPanel series={series} segments={segments} locale={locale} t={t} units={units}/>{telemetryGapCount?<div className="data-gap-notice"><strong>{t("journeyDataGapTitle")}</strong><p>{t("journeyDataGapHelp")} ({telemetryGapCount})</p></div>:null}{selected.isManualGroup&&safe(selected.stopEvents).length?<Panel title={t("groupStopsAndCharging")} subtitle={t("groupStopsAndChargingHelp")}><div className="journey-group-stops">{selected.stopEvents.map((stop,index)=><article key={stop.stopId}><span><i>{index+1}</i><strong>{timeText(stop.startedAtUtc,locale)} — {timeText(stop.endedAtUtc,locale)}</strong><small>{duration(stop.durationMinutes,t)}</small></span>{stop.charges.length?<div>{stop.charges.map((charge)=><span key={charge.chargeId}><b>{charge.chargeType||t("charging")}</b><small>{num(charge.batteryEnergyKwh,locale)} kWh · {num(charge.socStartPct,locale,0)} → {num(charge.socEndPct,locale,0)}%</small></span>)}</div>:<em>{t("groupStopWithoutCharge")}</em>}</article>)}</div></Panel>:null}<Panel title={t("journeyStructure")} subtitle={t("journeyStructureHelp")} scrollHeight={360} t={t}><div className="detail-table">{segments.map((row,index)=><div key={row.tripId}><span className="segment-number">{index+1}</span><strong>{timeText(row.startedAtUtc,locale)}</strong><span>{num(distanceValue(row.distanceKm,units.system),locale)} {distanceUnit(units.system)}</span><span>{duration(row.durationMinutes,t)}</span><span>{num(consumptionValue(row.consumptionKwh100,units.system),locale)} {consumptionUnit(units.system)}</span><span>{num(row.socStartPct,locale,0)} → {num(row.socEndPct,locale,0)}%</span></div>)}</div></Panel></>:null}
    </div>
  </section></JourneyTimelineContext.Provider>;
}

const JourneyDetailSection = memo(JourneyDetail);

function ClassificationEditor({ kind, recordId, ownership, onSave, t }) {
  const maps=useMemo(()=>ownershipMaps(ownership),[ownership]);
  const current=kind==="journey"?maps.journeys.get(recordId):maps.charges.get(recordId), value=current?.kind||current?.category||"";
  const options=kind==="journey"?JOURNEY_LABELS:CHARGE_CATEGORIES;
  const update=(next,label=current?.label||"")=>onSave?.(kind==="journey"?upsertJourneyLabel(ownership,recordId,next,label):upsertChargeCategory(ownership,recordId,next,label));
  const label=t(kind==="journey"?"journeyClassification":"chargeLocation");
  const editor=<div className="classification-editor"><div><strong>{label}</strong><small>{t(kind==="journey"?"journeyClassificationHelp":"chargeLocationHelp")}</small></div><select name={`${kind}-classification`} aria-label={label} value={value} onChange={(event)=>update(event.currentTarget.value)}><option value="">{t("unlabelled")}</option>{options.map((option)=><option key={option} value={option}>{t(`${kind==="journey"?"journeyKind":"chargeCategory"}_${option}`)}</option>)}</select>{value==="custom"?<input name={`${kind}-custom-label`} aria-label={t("customLabelPlaceholder")} value={current?.label||""} maxLength={80} placeholder={t("customLabelPlaceholder")} onChange={(event)=>update("custom",event.currentTarget.value)}/>:null}</div>;
  return <>{editor}{kind==="charge"?<ChargeCostEditor chargeId={recordId} ownership={ownership} onSave={onSave} t={t}/>:null}</>;
}

function JourneyDetailsEditor({ journey, journeys, ownership, onSave, t }) {
  const maps=useMemo(()=>ownershipMaps(ownership),[ownership]), current=maps.journeys.get(journey?.journeyId)||{};
  const [form,setForm]=useState({origin:"",destination:"",purpose:"",comment:""});
  const [open,setOpen]=useState(false);
  useEffect(()=>setForm({origin:current.origin||"",destination:current.destination||"",purpose:current.purpose||"",comment:current.comment||""}),[current.comment,current.destination,current.origin,current.purpose,journey?.journeyId]);
  const suggestions=useMemo(()=>journeySuggestions(journey,journeys,ownership),[journey,journeys,ownership]);
  const update=(key,value)=>setForm((valueBefore)=>({...valueBefore,[key]:value}));
  return <div className={`ownership-editor journey-details-editor ${open?"is-open":"is-collapsed"}`}><div className="ownership-editor-heading"><span><strong>{t("journeyDetails")}</strong><small>{t("journeyDetailsHelp")}</small></span><div className="ownership-editor-actions">{open?<button type="button" className="secondary-button" onClick={()=>onSave?.(upsertJourneyDetails(ownership,journey.journeyId,form))}>{t("saveJourneyDetails")}</button>:null}<button type="button" className="secondary-button" aria-expanded={open} onClick={()=>setOpen((value)=>!value)}>{t(open?"collapseSection":"expandSection")}</button></div></div>{open?<><div className="ownership-editor-grid"><label><span>{t("journeyOrigin")}</span><input value={form.origin} maxLength={120} onChange={(event)=>update("origin",event.currentTarget.value)}/>{suggestions.origins.length?<small className="local-suggestions">{suggestions.origins.map((item)=><button type="button" key={item.value} onClick={()=>update("origin",item.value)}>{item.value}</button>)}</small>:null}</label><label><span>{t("journeyDestination")}</span><input value={form.destination} maxLength={120} onChange={(event)=>update("destination",event.currentTarget.value)}/>{suggestions.destinations.length?<small className="local-suggestions">{suggestions.destinations.map((item)=><button type="button" key={item.value} onClick={()=>update("destination",item.value)}>{item.value}</button>)}</small>:null}</label><label><span>{t("journeyPurpose")}</span><input value={form.purpose} maxLength={160} onChange={(event)=>update("purpose",event.currentTarget.value)}/></label><label className="is-wide"><span>{t("journeyComment")}</span><textarea value={form.comment} maxLength={500} rows={2} onChange={(event)=>update("comment",event.currentTarget.value)}/></label></div>{suggestions.origins.length||suggestions.destinations.length?<p className="ownership-editor-note">{t("localSuggestions")} · {t(`suggestionSource_${suggestions.source}`)}</p>:null}</>:null}</div>;
}

function ChargeCostEditor({ chargeId, ownership, onSave, t }) {
  const maps=useMemo(()=>ownershipMaps(ownership),[ownership]), current=maps.charges.get(chargeId)||{};
  const [free,setFree]=useState(false),[manualCost,setManualCost]=useState(""),[tariffId,setTariffId]=useState("");
  useEffect(()=>{setFree(Boolean(current.free));setManualCost(current.manualCost==null?"":String(current.manualCost));setTariffId(current.tariffId||"");},[chargeId,current.free,current.manualCost,current.tariffId]);
  const save=()=>onSave?.(upsertChargeCost(ownership,chargeId,{free,manualCost,tariffId}));
  return <div className="ownership-editor"><div className="ownership-editor-heading"><span><strong>{t("chargeCostDetails")}</strong><small>{t("chargeCostHelp")}</small></span><button type="button" className="secondary-button" onClick={save}>{t("saveChargeCost")}</button></div><div className="charge-cost-grid"><label><span>{t("tariffProfiles")}</span><select name="charge-tariff" value={tariffId} disabled={free} onChange={(event)=>setTariffId(event.currentTarget.value)}><option value="">{t("automaticTariff")}</option>{maps.ownership.tariffs.map((tariff)=><option key={tariff.id} value={tariff.id}>{tariff.name}</option>)}</select></label><label><span>{t("manualChargeCost")}</span><input name="manual-charge-cost" value={manualCost} disabled={free} inputMode="decimal" placeholder="0.00" onChange={(event)=>setManualCost(event.currentTarget.value)}/></label><label className="check-line"><input name="free-charging" type="checkbox" checked={free} onChange={(event)=>setFree(event.currentTarget.checked)}/><span>{t("freeCharge")}</span></label></div></div>;
}

function JourneyGroupDetail({group,trips,locale,t,units,onEdit,onDelete}){
  const [active,setActive]=useState("combined");
  useEffect(()=>setActive("combined"),[group.groupId]);
  const selected=active==="combined"?group:group.sourceJourneys.find((journey)=>journey.journeyId===active)||group;
  return <div className="journey-group-detail"><div className="journey-group-heading"><div><span>{t("manualJourneyGroup")}</span><h2>{group.name||t("unnamedJourneyGroup")}</h2><small>{group.sourceJourneys.length} {t("journeysLower")} · {group.attachedCharges.length} {t("chargesLower")}</small></div><div><button type="button" className="secondary-button" onClick={()=>onEdit(group)}>{t("editGroup")}</button><button type="button" className="danger-link" onClick={()=>onDelete(group)}>{t("ungroupJourneys")}</button></div></div><div className="journey-group-tabs" role="tablist" aria-label={t("analyseJourneyGroup")}><button type="button" role="tab" aria-selected={active==="combined"} className={active==="combined"?"is-active":""} onClick={()=>setActive("combined")}>{t("combinedJourney")}</button>{group.sourceJourneys.map((journey,index)=><button key={journey.journeyId} type="button" role="tab" aria-selected={active===journey.journeyId} className={active===journey.journeyId?"is-active":""} onClick={()=>setActive(journey.journeyId)}>{t("segment")} {index+1} · {timeText(journey.startedAtUtc,locale)}</button>)}</div><JourneyDetailSection selected={selected} trips={trips} locale={locale} t={t} units={units}/></div>;
}

function Journeys({ data, locale, t, period, maxDate, customRange, selectedId, setSelectedId, units, onSaveJourneyGroups, onSaveOwnership, onRequestRecordDetails }) {
  const groupView=useMemo(()=>buildJourneyGroupView(data),[data]), groupedIds=groupView.membership;
  const allBaseRows=useMemo(()=>newestFirst(safe(data.journeys)),[data.journeys]);
  const baseRows=useMemo(()=>allBaseRows.filter((row)=>inPeriod(row.date,period,maxDate,customRange)),[allBaseRows,period,maxDate,customRange]);
  const displayRows=useMemo(()=>newestFirst([...groupView.groups.filter((row)=>inPeriod(row.date,period,maxDate,customRange)),...baseRows.filter((row)=>!safe(row.tripIds).some((id)=>groupedIds.has(id)))]),[baseRows,groupView.groups,groupedIds,period,maxDate,customRange]);
  const [query,setQuery]=useState(""),[labelFilter,setLabelFilter]=useState("all"),[editing,setEditing]=useState(null),[picked,setPicked]=useState(()=>new Set()),[groupName,setGroupName]=useState("");
  const ownership=useMemo(()=>ownershipMaps(data.ownership),[data.ownership]);
  const selecting=editing!==null;
  const visible=useMemo(()=>displayRows.filter((row)=>{const tag=ownership.journeys.get(row.journeyId),matchesLabel=labelFilter==="all"?(true):labelFilter==="unlabelled"?!tag:tag?.kind===labelFilter;return matchesLabel&&`${row.name||""} ${row.date} ${row.distanceKm} ${tag?.kind||""} ${tag?.label||""}`.toLowerCase().includes(query.toLowerCase());}),[displayRows,labelFilter,ownership.journeys,query]);
  const editGroup=editing?.groupId?groupView.groups.find((group)=>group.groupId===editing.groupId):null;
  const editingTripIds=useMemo(()=>new Set(editGroup?.tripIds||[]),[editGroup]);
  const selectionSource=editing?.groupId?allBaseRows:baseRows;
  const selectable=useMemo(()=>selectionSource.filter((row)=>safe(row.tripIds).every((id)=>!groupedIds.has(id)||editingTripIds.has(id))),[selectionSource,groupedIds,editingTripIds]);
  const selected=visible.find((row)=>row.journeyId===selectedId)??visible[0];
  const deferredSelected=useDeferredValue(selected);
  useEffect(()=>{
    if(!selected)return;
    const journeyIds=selected.isManualGroup?safe(selected.sourceJourneys).filter((row)=>!row.detailLoaded).map((row)=>row.journeyId):selected.detailLoaded?[]:[selected.journeyId];
    if(journeyIds.length)onRequestRecordDetails?.({journeyIds});
  },[onRequestRecordDetails,selected]);
  const begin=(group=null)=>{setEditing({groupId:group?.groupId||null});setPicked(new Set(group?.sourceJourneys.map((journey)=>journey.journeyId)||[]));setGroupName(group?.name||"");};
  const cancel=()=>{setEditing(null);setPicked(new Set());setGroupName("");};
  const toggle=(id)=>setPicked((current)=>{const next=new Set(current);if(next.has(id))next.delete(id);else next.add(id);return next;});
  const saveGroup=()=>{const members=selectionSource.filter((row)=>picked.has(row.journeyId));if(members.length<2)return;const groupId=editing.groupId||`manual-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`;const definition=journeyGroupDefinition(groupId,groupName||t("defaultJourneyGroupName"),members);if(!definition)return;const next=groupView.definitions.filter((row)=>row.groupId!==groupId);onSaveJourneyGroups?.([...next,definition]);setSelectedId(groupId);cancel();};
  const remove=(group)=>{if(!window.confirm(t("ungroupJourneysConfirm")))return;onSaveJourneyGroups?.(groupView.definitions.filter((row)=>row.groupId!==group.groupId));setSelectedId(group.sourceJourneys[0]?.journeyId||null);};
  if(!displayRows.length&&!selecting)return <Empty t={t}/>;
  const detailSelected=deferredSelected??selected,detailPending=Boolean(selected&&(detailSelected?.journeyId!==selected.journeyId||(!selected.isManualGroup&&!selected.detailLoaded)));
  const metadata=(journey)=><details className="journey-metadata-drawer"><summary><span><strong>{t("journeyDetails")}</strong><small>{t("journeyClassificationHelp")}</small></span><b aria-hidden="true">⌄</b></summary><ClassificationEditor kind="journey" recordId={journey.journeyId} ownership={data.ownership} onSave={onSaveOwnership} t={t}/><JourneyDetailsEditor journey={journey} journeys={allBaseRows} ownership={data.ownership} onSave={onSaveOwnership} t={t}/></details>;
  return <><div className="classification-filters" role="group" aria-label={t("journeyClassification")}>{["all","unlabelled",...JOURNEY_LABELS].map((option)=><button key={option} type="button" className={labelFilter===option?"is-active":""} onClick={()=>setLabelFilter(option)}>{option==="all"?t("allData"):option==="unlabelled"?t("unlabelled"):t(`journeyKind_${option}`)}</button>)}</div><div className={`list-toolbar journey-list-toolbar ${selecting?"is-selecting":""}`}><input value={query} onChange={(event)=>setQuery(event.target.value)} placeholder={t("searchJourneys")}/>{selecting?<div className="journey-group-builder"><input value={groupName} maxLength={80} onChange={(event)=>setGroupName(event.currentTarget.value)} placeholder={t("journeyGroupName")}/><span>{picked.size} {t("selectedLower")}</span><button type="button" className="secondary-button" onClick={cancel}>{t("chartCancel")}</button><button type="button" className="primary-action" disabled={picked.size<2} onClick={saveGroup}>{editing.groupId?t("saveGroup"):t("createJourneyGroup")}</button></div>:<div><span>{visible.length} {t("journeysLower")}</span><button type="button" className="secondary-button summary-export-button" disabled={!visible.length} onClick={()=>downloadJourneysCsv(visible,data.ownership)}>{t("exportVisibleCsv")}</button><button type="button" className="secondary-button" onClick={()=>begin()}>{t("combineJourneys")}</button></div>}</div><div className="master-detail"><Panel title={selecting?t("selectJourneysToCombine"):t("journeyList")}><div className="record-list">{(selecting?selectable:visible).map((row)=>selecting?<label key={row.journeyId} className={`record-button journey-select-row ${picked.has(row.journeyId)?"is-active":""}`}><input type="checkbox" checked={picked.has(row.journeyId)} onChange={()=>toggle(row.journeyId)}/><span><strong>{dateText(row.startedAtUtc,locale)}</strong><small>{timeText(row.startedAtUtc,locale)} · {duration(row.durationMinutes,t)}</small></span><span><strong>{num(distanceValue(row.distanceKm,units.system),locale)} {distanceUnit(units.system)}</strong><small>{safe(row.tripIds).length} {t("segmentsLower")}</small></span></label>:<button key={row.journeyId} className={`record-button ${row.journeyId===selected?.journeyId?"is-active":""} ${row.isManualGroup?"is-journey-group":""}`} onClick={()=>setSelectedId(row.journeyId)}><span><strong>{row.isManualGroup?(row.name||t("unnamedJourneyGroup")):dateText(row.startedAtUtc,locale)} {row.isManualGroup?<i className="journey-group-badge">{t("groupBadge")}</i>:row.gps?<i className="route-available" title={t("routeAvailable")} aria-label={t("routeAvailable")}>GPS</i>:null}{ownership.journeys.get(row.journeyId)?<i className="classification-badge">{ownership.journeys.get(row.journeyId).kind==="custom"?(ownership.journeys.get(row.journeyId).label||t("journeyKind_custom")):t(`journeyKind_${ownership.journeys.get(row.journeyId).kind}`)}</i>:null}</strong><small>{row.isManualGroup?`${row.sourceJourneys.length} ${t("journeysLower")} · ${row.attachedCharges.length} ${t("chargesLower")}`:`${timeText(row.startedAtUtc,locale)} · ${safe(row.tripIds).length} ${t("segmentsLower")}`}</small></span><span><strong>{num(distanceValue(row.distanceKm,units.system),locale)} {distanceUnit(units.system)}</strong><small>{num(consumptionValue(row.consumptionKwh100,units.system),locale)} {consumptionUnit(units.system)}</small></span></button>)}</div></Panel><div className={`journey-detail-shell ${detailPending?"is-updating":""}`} aria-busy={detailPending}>{selecting?<div className="journey-group-empty"><strong>{t("combineJourneys")}</strong><p>{t("combineJourneysHelp")}</p></div>:detailSelected?.isManualGroup?<>{metadata(detailSelected)}<JourneyGroupDetail group={detailSelected} trips={safe(data.trips)} locale={locale} t={t} units={units} onEdit={begin} onDelete={remove}/></>:detailSelected?<>{metadata(detailSelected)}<JourneyDetailSection selected={detailSelected} trips={safe(data.trips)} locale={locale} t={t} units={units}/></>:null}</div></div></>;
}

function Driving({ data, locale, t, period, maxDate, customRange }) {
  const model = useMemo(() => {
    const filter = (row) => inPeriod(row.date,period,maxDate,customRange);
    const trips=safe(data.trips).filter(filter), speed=safe(data.driving?.speed).filter(filter), pedal=safe(data.driving?.pedal).filter(filter), gg=safe(data.driving?.gg).filter(filter), events=safe(data.driving?.events).filter(filter);
    const speedRows=aggregateBands(speed), pedalRows=aggregateBands(pedal), drivingMinutes=speedRows.reduce((total,row)=>total+row.minutes,0), regenerated=sum(trips,"regeneratedKwh"), used=sum(trips,"energyUsedKwh"), fast=speedRows.filter((row)=>row.band.startsWith("120")||row.band.startsWith("150")).reduce((total,row)=>total+row.minutes,0);
    const pedalMinutes=pedalRows.reduce((total,row)=>total+row.minutes,0), highPedal=pedalRows.filter((row)=>row.band.startsWith("50")||row.band.startsWith("75")).reduce((total,row)=>total+row.minutes,0);
    const forceSamples=safe(data.telemetry).filter((row)=>inPeriod(row.timestampUtc,period,maxDate,customRange)&&Number(row.speedKmh)>=1&&finiteValue(row.longitudinalG)&&finiteValue(row.lateralG));
    const dynamicSamples=forceSamples.filter((row)=>Math.max(Math.abs(Number(row.longitudinalG)),Math.abs(Number(row.lateralG)))>=.18).length;
    const profileInputs=[
      {available:pedalMinutes>0,value:highPedal/pedalMinutes,reference:.12,weight:35},
      {available:drivingMinutes>0,value:fast/drivingMinutes,reference:.08,weight:25},
      {available:forceSamples.length>0,value:dynamicSamples/forceSamples.length,reference:.15,weight:40},
    ].filter((row)=>row.available);
    const profileWeight=profileInputs.reduce((total,row)=>total+row.weight,0), profileScore=profileWeight?profileInputs.reduce((total,row)=>total+Math.min(1,row.value/row.reference)*row.weight,0)/profileWeight*100:null;
    const profileKey=profileScore==null?null:profileScore<25?"calm":profileScore<55?"normal":profileScore<75?"dynamic":"aggressive";
    return { trips, speedRows, pedalRows, gg:sampleScatter(gg), events:events.slice().sort((a,b)=>b.valueG-a.valueG), drivingMinutes, regenerated, used, fast, profileKey, personality:calculateDrivingPersonality({trips,speedRows,pedalRows,events,profileScore}) };
  }, [data.trips, data.telemetry, data.driving?.speed, data.driving?.pedal, data.driving?.gg, data.driving?.events, period, maxDate, customRange]);
  const { trips, speedRows, pedalRows, gg, events, drivingMinutes, regenerated, used, fast, profileKey, personality } = model;
  const peak=(kind)=>maximum(events.filter((row)=>row.kind===kind),"valueG");
  if(!trips.length)return <Empty t={t}/>;
  return <><div className="metric-grid activity-metrics"><Metric tone="mint" label={t("regeneratedEnergy")} value={num(regenerated,locale)} unit=" kWh" note={`${num(used+regenerated?regenerated/(used+regenerated)*100:null,locale)}% ${t("grossEnergy")}`}/><Metric tone="cyan" label={t("movingTime")} value={duration(drivingMinutes,t)} note={`${trips.length} ${t("segmentsLower")}`}/><Metric tone="violet" label={t("maximumAcceleration")} value={num(peak("acceleration"),locale,2)} unit=" g"/><Metric tone="amber" label={t("maximumBraking")} value={num(peak("braking"),locale,2)} unit=" g"/><Metric tone="coral" label={t("maximumCornering")} value={num(peak("cornering"),locale,2)} unit=" g"/><Metric tone="violet" label={t("timeAbove120")} value={duration(fast,t)} note={`${num(drivingMinutes?fast/drivingMinutes*100:null,locale)}%`}/><DrivingPersonalityMetric personality={personality} profileKey={profileKey} t={t}/></div>
    <div className="method-note"><strong>{t("observationalMetrics")}</strong><p>{t("drivingDisclaimer")}</p></div>
    <div className="dashboard-grid two"><Panel title={t("speedDistribution")} subtitle={t("speedDistributionHelp")}><Chart><BarChart data={speedRows} margin={{top:12,right:12,left:-12}}><CartesianGrid stroke="var(--grid)" vertical={false}/><XAxis dataKey="band" tick={{fill:"var(--muted)",fontSize:9}}/><YAxis tick={{fill:"var(--muted)",fontSize:10}}/><Tip locale={locale} suffix={` ${t("minuteShort")}`}/><Bar dataKey="minutes" fill={C.mint} radius={[4,4,0,0]}/></BarChart></Chart></Panel><Panel title={t("acceleratorUse")} subtitle={t("acceleratorUseHelp")}><Chart><BarChart data={pedalRows} margin={{top:12,right:12,left:-12}}><CartesianGrid stroke="var(--grid)" vertical={false}/><XAxis dataKey="band" tick={{fill:"var(--muted)",fontSize:9}}/><YAxis tick={{fill:"var(--muted)",fontSize:10}}/><Tip locale={locale} suffix={` ${t("minuteShort")}`}/><Bar dataKey="minutes" fill={C.cyan} radius={[4,4,0,0]}/></BarChart></Chart></Panel><Panel title={t("ggDiagram")} subtitle={t("ggDiagramHelp")}><Chart><ScatterChart margin={{top:12,right:12,left:-12}}><CartesianGrid stroke="var(--grid)"/><XAxis type="number" dataKey="lateralG" name={t("lateralAcceleration")} unit=" g" tick={{fill:"var(--muted)",fontSize:10}}/><YAxis type="number" dataKey="longitudinalG" name={t("longitudinalAcceleration")} unit=" g" tick={{fill:"var(--muted)",fontSize:10}}/><Tip locale={locale}/><Scatter data={gg} fill={C.violet}/></ScatterChart></Chart></Panel><Panel title={t("dynamicEvents")} subtitle={t("dynamicEventsHelp")}><div className="compact-records">{events.slice(0,12).map((row,index)=><div key={`${row.timestampUtc}-${index}`}><span><strong>{t(`event_${row.kind}`)}</strong><small>{dateText(row.timestampUtc,locale)} · {timeText(row.timestampUtc,locale)}</small></span><span><strong>{num(row.valueG,locale,2)} g</strong><small>{num(row.speedKmh,locale)} km/h</small></span></div>)}</div></Panel></div></>;
}

function ChargingLab({charges,locale,t,units,onRequestRecordDetails}){
  const availableTypes=useMemo(()=>["DC","AC"].filter((type)=>charges.filter((row)=>row.chargeType===type).length>=2),[charges]);
  const [type,setType]=useState(()=>availableTypes[0]||"DC"),[firstId,setFirstId]=useState(""),[secondId,setSecondId]=useState("");
  const candidates=useMemo(()=>newestFirst(charges.filter((row)=>row.chargeType===type)),[charges,type]);
  useEffect(()=>{if(!availableTypes.includes(type)&&availableTypes[0])setType(availableTypes[0]);},[availableTypes,type]);
  useEffect(()=>{setFirstId((current)=>candidates.some((row)=>row.chargeId===current)?current:(candidates[0]?.chargeId||""));setSecondId((current)=>candidates.some((row)=>row.chargeId===current)&&current!==firstId?current:(candidates.find((row)=>row.chargeId!==firstId)?.chargeId||""));},[candidates,firstId]);
  const selected=useMemo(()=>[candidates.find((row)=>row.chargeId===firstId),candidates.find((row)=>row.chargeId===secondId)].filter(Boolean),[candidates,firstId,secondId]);
  useEffect(()=>{const missing=selected.filter((row)=>!row.detailLoaded).map((row)=>row.chargeId);if(missing.length)onRequestRecordDetails?.({chargeIds:missing});},[onRequestRecordDetails,selected]);
  const comparison=useMemo(()=>buildChargeComparison(selected),[selected]);
  if(!availableTypes.length)return <Panel title={t("chargingLab")} subtitle={t("chargingLabHelp")} collapsible defaultCollapsed t={t}><ChartEmpty t={t} message={t("chargingLabNeedsSessions")}/></Panel>;
  const colours=[C.teal,C.violet], temperatureDelta=(value)=>value==null?null:units.system==="imperial"?Number(value)*9/5:Number(value);
  return <Panel title={t("chargingLab")} subtitle={t("chargingLabHelp")} action={<div className="charge-history-filters">{availableTypes.map((item)=><button type="button" key={item} className={type===item?"is-active":""} onClick={()=>setType(item)}>{item}</button>)}</div>} collapsible defaultCollapsed t={t}>
    <div className="charging-lab-selectors"><label><span>{t("comparisonA")}</span><select value={firstId} onChange={(event)=>setFirstId(event.currentTarget.value)}>{candidates.map((row)=><option key={row.chargeId} value={row.chargeId}>{dateText(row.startedAtUtc,locale)} · {num(row.socStartPct,locale,0)}–{num(row.socEndPct,locale,0)}%</option>)}</select></label><label><span>{t("comparisonB")}</span><select value={secondId} onChange={(event)=>setSecondId(event.currentTarget.value)}>{candidates.filter((row)=>row.chargeId!==firstId).map((row)=><option key={row.chargeId} value={row.chargeId}>{dateText(row.startedAtUtc,locale)} · {num(row.socStartPct,locale,0)}–{num(row.socEndPct,locale,0)}%</option>)}</select></label></div>
    <div className="charging-lab-layout"><div className="charging-lab-summaries">{comparison.analyses.map((row,index)=><article key={row.chargeId} style={{borderColor:colours[index]}}><strong>{index===0?t("comparisonA"):t("comparisonB")}</strong><span>{t("observed10to80")}<b>{row.tenToEightyMinutes==null?"—":duration(row.tenToEightyMinutes,t)}</b></span><span>{t("observed20to80")}<b>{row.twentyToEightyMinutes==null?"—":duration(row.twentyToEightyMinutes,t)}</b></span><span>{t("taperStarts")}<b>{row.taperSocPct==null?"—":`${num(row.taperSocPct,locale,0)}%`}</b></span><span>{t("peakPower")}<b>{num(row.peakPowerKw,locale)} kW</b></span><span>{t("batteryTemperatureRise")}<b>{num(temperatureDelta(row.temperatureRiseC),locale)} {temperatureUnit(units.system)}</b></span></article>)}</div>{comparison.curve.length?<Chart height={300}><LineChart data={comparison.curve} margin={{top:15,right:16,left:-8}}><CartesianGrid stroke="var(--grid)" vertical={false}/><XAxis dataKey="socPct" unit="%" tick={{fill:"var(--muted)",fontSize:9}}/><YAxis unit=" kW" tick={{fill:"var(--muted)",fontSize:10}}/><Tip locale={locale} suffix=" kW"/><Legend wrapperStyle={{fontSize:11}}/>{selected.map((row,index)=><Line key={row.chargeId} dataKey={`session${index+1}`} name={`${index===0?t("comparisonA"):t("comparisonB")} · ${dateText(row.startedAtUtc,locale)}`} stroke={colours[index]} dot={false} strokeWidth={2}/>)}</LineChart></Chart>:<ChartEmpty t={t} message={t("chargingLabLoading")}/>}</div>
    <p className="analysis-disclaimer">{t("chargingLabDisclaimer")}</p>
  </Panel>;
}

function ChargeTechnicalSummary({ selected, locale, t, units }) {
  const rangeAdded = finiteValue(selected.rangeStartKm) && finiteValue(selected.rangeEndKm) ? Number(selected.rangeEndKm) - Number(selected.rangeStartKm) : null;
  return <Panel title={t("chargingTechnicalDetails")} subtitle={t("chargingTechnicalDetailsHelp")} collapsible defaultCollapsed t={t}><div className="metric-grid detail-metrics"><Metric label={t("voltageRange")} value={`${num(selected.voltageMinV,locale)}–${num(selected.voltageMaxV,locale)}`} unit=" V"/><Metric label={t("peakCurrent")} value={num(selected.peakCurrentA,locale)} unit=" A"/><Metric label={t("batteryTemperatureRange")} value={`${num(temperatureValue(selected.batteryTempStartC,units.system),locale)}–${num(temperatureValue(selected.batteryTempMaxC,units.system),locale)}`} unit={` ${temperatureUnit(units.system)}`}/><Metric label={t("displayedRangeAdded")} value={num(distanceValue(rangeAdded,units.system),locale)} unit={` ${distanceUnit(units.system)}`}/><Metric label={t("cellTemperaturePositions")} value={`${num(selected.coldestCellIndex,locale,0)} / ${num(selected.hottestCellIndex,locale,0)}`} note={t("coldestHottest")}/><Metric label={t("odometer")} value={num(distanceValue(selected.odometerKm,units.system),locale,0)} unit={` ${distanceUnit(units.system)}`}/></div></Panel>;
}

function Charging({ data, locale, t, period, maxDate, customRange, selectedId, setSelectedId, units, onSaveOwnership, onRequestRecordDetails }) {
  const [chargeFilter,setChargeFilter]=useState("all"),[categoryFilter,setCategoryFilter]=useState("all");
  const ownership=useMemo(()=>ownershipMaps(data.ownership),[data.ownership]);
  const rows = newestFirst(safe(data.charges).filter((row) => inPeriod(row.date, period, maxDate, customRange))); const selected = rows.find((row) => row.chargeId === selectedId) ?? rows[0];
  useEffect(()=>{if(selected&&!selected.detailLoaded)onRequestRecordDetails?.({chargeIds:[selected.chargeId]});},[onRequestRecordDetails,selected]);
  const summary = rows.slice().reverse().map((row) => ({ ...row, label: row.date?.slice(5), acEnergyKwh: row.chargeType === "AC" ? row.batteryEnergyKwh : 0, dcEnergyKwh: row.chargeType === "DC" ? row.batteryEnergyKwh : 0 })), series = safe(selected.series), temperatureSeries=series.map((row)=>({...row,batteryTemperatureDisplay:temperatureValue(row.batteryTempC,units.system)}));
  const hourCounts=rows.reduce((map,row)=>{const hour=localHour(row.startedAtUtc);if(Number.isFinite(hour))map.set(hour,(map.get(hour)||0)+1);return map;},new Map()), common=[...hourCounts].sort((a,b)=>b[1]-a[1])[0], hourShare=common?common[1]/rows.length:0;
  const chargeTypes=["AC","DC"].map((type)=>{const sessions=rows.filter((row)=>row.chargeType===type);return {type,sessions:sessions.length,batteryEnergyKwh:sum(sessions,"batteryEnergyKwh"),wallEnergyKwh:sum(sessions,"wallEnergyKwh"),durationMinutes:sum(sessions,"durationMinutes")};});
  const historyRows=rows.filter((row)=>{const category=ownership.charges.get(row.chargeId)?.category;return (chargeFilter==="all"||row.chargeType===chargeFilter)&&(categoryFilter==="all"||(categoryFilter==="unlabelled"?!category:category===categoryFilter));});
  useEffect(()=>{if(historyRows.length&&!historyRows.some((row)=>row.chargeId===selectedId))setSelectedId(historyRows[0].chargeId);},[categoryFilter,chargeFilter,historyRows.length,selectedId,setSelectedId]);
  if (!selected) return <Empty t={t} />;
  const selectedCost=ownership.activeTariff?chargeCostBreakdown(selected,data.ownership).cost:null;
  const totalTypedEnergy=sum(chargeTypes,"batteryEnergyKwh");
  const limitCounts=rows.filter((row)=>(row.socEndPct??100)<99&&((row.socEndPct??0)-(row.socStartPct??0))>=5).reduce((map,row)=>{const value=Math.round(row.socEndPct);map.set(value,(map.get(value)||0)+1);return map;},new Map()), recurring=[...limitCounts].filter(([,count])=>count>=3).sort((a,b)=>b[1]-a[1])[0], typicalGain=median(rows.map((row)=>(row.socEndPct??0)-(row.socStartPct??0)));
  return <><div className="metric-grid charging-metrics"><Metric tone="mint" label={t("chargedEnergy")} value={num(sum(rows, "batteryEnergyKwh"), locale)} unit=" kWh" note={`${rows.length} ${t("chargesLower")}`} /><Metric tone="cyan" label={t("gridEnergy")} value={num(sum(rows, "wallEnergyKwh"), locale)} unit=" kWh" /><Metric tone="amber" label={t("chargeEfficiency")} value={num(sum(rows, "wallEnergyKwh") ? sum(rows, "batteryEnergyKwh") / sum(rows, "wallEnergyKwh") * 100 : null, locale)} unit="%" /><Metric tone="violet" label={t("totalChargingTime")} value={duration(sum(rows,"durationMinutes"),t)} /><Metric tone="mint" label={t("maximumPower")} value={num(maximum(rows,"maxPowerKw"),locale)} unit=" kW" /><Metric tone="coral" label={t("losses")} value={num(sum(rows, "lossKwh"), locale)} unit=" kWh" note={t("totalEstimatedLosses")} /></div>
    <Panel title={t("chargingHabits")} subtitle={t("chargingHabitsHelp")} collapsible t={t}><div className="metric-grid detail-metrics charging-habits-metrics"><Metric tone="mint" label={t("mostCommonHour")} value={common?`${String(common[0]).padStart(2,"0")}:00`:"—"} note={common?`${common[1]} ${t("ofLower")} ${rows.length} ${t("chargesLower")}`:null}/><Metric tone="cyan" label={t("possibleSchedule")} value={common&&common[1]>=3&&hourShare>=.35?`${String(common[0]).padStart(2,"0")}:00`:t("noStrongPattern")} note={`${num(hourShare*100,locale)}% ${t("ofSample")}`}/><Metric tone="amber" label={t("recurringLimit")} value={recurring?`${recurring[0]}%`:t("noStrongPattern")} note={recurring?`${recurring[1]} ${t("sessionsLower")}`:t("minimumThreeSessions")}/><Metric tone="violet" label={t("typicalSocGain")} value={num(typicalGain,locale)} unit=" pp" note={`${rows.length} ${t("sessionsLower")}`}/></div></Panel>
    <Panel title={t("chargingByType")} subtitle={t("chargingByTypeHelp")} collapsible t={t}><div className="charging-type-layout"><div className="metric-grid charge-type-metrics">{chargeTypes.map((row)=><Metric key={row.type} tone={row.type==="AC"?"cyan":"violet"} label={t(`chargeType_${row.type}`)} value={num(row.batteryEnergyKwh,locale)} unit=" kWh" note={`${row.sessions} ${t("sessionsLower")} · ${num(row.wallEnergyKwh,locale)} kWh ${t("fromGrid")}`}/>)}</div>{totalTypedEnergy>0?<Chart height={230}><PieChart><Pie data={chargeTypes} dataKey="batteryEnergyKwh" nameKey="type" innerRadius={52} outerRadius={82} paddingAngle={3}>{chargeTypes.map((row)=><Cell key={row.type} fill={row.type==="AC"?C.cyan:C.violet}/>)}</Pie><Tip locale={locale} suffix=" kWh"/><Legend wrapperStyle={{fontSize:11}}/></PieChart></Chart>:<ChartEmpty t={t}/>}</div></Panel>
    <ChargingLab charges={rows} locale={locale} t={t} units={units} onRequestRecordDetails={onRequestRecordDetails}/>
    <div className="dashboard-grid two"><Panel title={t("energyByCharge")} subtitle={t("energyByChargeHelp")}><Chart><BarChart data={summary} margin={{ top: 15, right: 10, left: -8 }}><CartesianGrid stroke="var(--grid)" vertical={false} /><XAxis dataKey="label" tick={{ fill: "var(--muted)", fontSize: 9 }} /><YAxis tick={{ fill: "var(--muted)", fontSize: 10 }} /><Tip locale={locale} suffix=" kWh" /><Legend wrapperStyle={{ fontSize: 11 }} /><Bar stackId="energy" dataKey="acEnergyKwh" name="AC" fill={C.cyan} /><Bar stackId="energy" dataKey="dcEnergyKwh" name="DC" fill={C.violet} /><Bar stackId="energy" dataKey="lossKwh" name={t("losses")} fill={C.coral} radius={[4,4,0,0]} /></BarChart></Chart></Panel><Panel title={t("efficiencyTrend")}><Chart><LineChart data={summary} margin={{ top: 15, right: 10, left: -14 }}><CartesianGrid stroke="var(--grid)" vertical={false} /><XAxis dataKey="label" tick={{ fill: "var(--muted)", fontSize: 9 }} /><YAxis domain={[0,100]} tick={{ fill: "var(--muted)", fontSize: 10 }} /><Tip locale={locale} suffix="%" /><Line dataKey="efficiencyPct" name={t("efficiency")} stroke={C.amber} dot={{ r: 3 }} strokeWidth={2} /></LineChart></Chart></Panel></div>
    <div className="section-export-toolbar"><span>{historyRows.length} {t("sessionsLower")}</span><button type="button" className="secondary-button summary-export-button" disabled={!historyRows.length} onClick={()=>downloadChargingCsv(historyRows,data.ownership)}>{t("exportVisibleCsv")}</button></div>
    <div className="master-detail"><Panel title={t("chargeList")} action={<div className="charge-filter-stack"><div className="charge-history-filters">{["all","AC","DC"].map((type)=><button key={type} type="button" className={chargeFilter===type?"is-active":""} onClick={()=>setChargeFilter(type)}>{type==="all"?t("allData"):type}</button>)}</div><div className="charge-history-filters">{["all","unlabelled",...CHARGE_CATEGORIES].map((category)=><button key={category} type="button" className={categoryFilter===category?"is-active":""} onClick={()=>setCategoryFilter(category)}>{category==="all"?t("allLocations"):category==="unlabelled"?t("unlabelled"):t(`chargeCategory_${category}`)}</button>)}</div></div>}><div className="record-list">{historyRows.map((row) => <button key={row.chargeId} className={`record-button ${row.chargeId === selected.chargeId ? "is-active" : ""}`} onClick={() => setSelectedId(row.chargeId)}><span><strong>{dateText(row.startedAtUtc, locale)}</strong><small>{timeText(row.startedAtUtc, locale)} <i className={`charge-type-badge type-${String(row.chargeType||"unknown").toLowerCase()}`}>{row.chargeType||"—"}</i>{ownership.charges.get(row.chargeId)?<i className="classification-badge">{ownership.charges.get(row.chargeId).category==="custom"?(ownership.charges.get(row.chargeId).label||t("chargeCategory_custom")):t(`chargeCategory_${ownership.charges.get(row.chargeId).category}`)}</i>:null}</small></span><span><strong>{num(row.batteryEnergyKwh, locale)} kWh</strong><small>{num(row.socStartPct, locale, 0)} → {num(row.socEndPct, locale, 0)}%</small></span></button>)}</div>{!historyRows.length?<div className="inline-success">{t("noChargingTypeResults")}</div>:null}</Panel><div className="detail-stack"><ClassificationEditor kind="charge" recordId={selected.chargeId} ownership={data.ownership} onSave={onSaveOwnership} t={t}/><Panel title={`${dateText(selected.startedAtUtc, locale)} · ${timeText(selected.startedAtUtc, locale)}`} subtitle={`${selected.chargeType} · ${duration(selected.durationMinutes, t)}`}><div className="metric-grid detail-metrics"><Metric label={t("batteryEnergy")} value={num(selected.batteryEnergyKwh, locale)} unit=" kWh" /><Metric label={t("gridEnergy")} value={num(selected.wallEnergyKwh, locale)} unit=" kWh" /><Metric label={t("efficiency")} value={num(selected.efficiencyPct, locale)} unit="%" /><Metric label={t("maximumPower")} value={num(selected.maxPowerKw, locale)} unit=" kW" /><Metric label={t("losses")} value={num(selected.lossKwh, locale)} unit=" kWh" />{selectedCost!=null?<Metric label={t("reportEstimatedCost")} value={num(selectedCost,locale,2)} unit={` ${ownership.activeTariff.currency}`} note={ownership.activeTariff.name}/>:null}</div></Panel><ChargeTechnicalSummary selected={selected} locale={locale} t={t} units={units}/><div className="dashboard-grid two technical-grid"><Panel title={t("chargeCurve")} subtitle={t("powerAndSoc")}><Chart><LineChart data={series} margin={{ top: 12, right: 12, left: -12 }}><CartesianGrid stroke="var(--grid)" vertical={false} /><XAxis dataKey="elapsedMinutes" tick={{ fill: "var(--muted)", fontSize: 9 }} /><YAxis yAxisId="a" tick={{ fill: "var(--muted)", fontSize: 10 }} /><YAxis yAxisId="b" orientation="right" domain={[0,100]} tick={{ fill: "var(--muted)", fontSize: 10 }} /><ChargingTip series={series} locale={locale} t={t} units={units}/><Legend wrapperStyle={{ fontSize: 11 }} /><Line yAxisId="a" dataKey="powerKw" name={t("powerKw")} stroke={C.teal} dot={false} strokeWidth={2} /><Line yAxisId="b" dataKey="socPct" name={t("soc")} stroke={C.amber} dot={false} strokeWidth={2} /></LineChart></Chart></Panel><Panel title={t("voltageCurrent")}><Chart><LineChart data={series} margin={{ top: 12, right: 12, left: -12 }}><CartesianGrid stroke="var(--grid)" vertical={false} /><XAxis dataKey="elapsedMinutes" hide /><YAxis yAxisId="a" tick={{ fill: "var(--muted)", fontSize: 10 }} /><YAxis yAxisId="b" orientation="right" tick={{ fill: "var(--muted)", fontSize: 10 }} /><ChargingTip series={series} locale={locale} t={t} units={units}/><Legend wrapperStyle={{ fontSize: 11 }} /><Line yAxisId="a" dataKey="voltageV" name={t("voltage")} stroke={C.violet} dot={false} /><Line yAxisId="b" dataKey="currentA" name={t("current")} stroke={C.cyan} dot={false} /></LineChart></Chart></Panel><Panel title={t("temperatureProfile")}><Chart><LineChart data={series} margin={{ top: 12, right: 12, left: -12 }}><CartesianGrid stroke="var(--grid)" vertical={false} /><XAxis dataKey="elapsedMinutes" tick={{ fill: "var(--muted)", fontSize: 9 }} /><YAxis tick={{ fill: "var(--muted)", fontSize: 10 }} /><ChargingTip series={series} locale={locale} t={t} units={units}/><Line dataKey="batteryTempC" name={t("batteryTemperature")} stroke={C.coral} dot={false} strokeWidth={2} /></LineChart></Chart></Panel><Panel title={t("powerPeakProfile")}><Chart><LineChart data={series} margin={{ top: 12, right: 12, left: -12 }}><CartesianGrid stroke="var(--grid)" vertical={false} /><XAxis dataKey="elapsedMinutes" tick={{ fill: "var(--muted)", fontSize: 9 }} /><YAxis tick={{ fill: "var(--muted)", fontSize: 10 }} /><ChargingTip series={series} locale={locale} t={t} units={units}/><Line dataKey="powerPeakKw" name={t("peakPower")} stroke={C.amber} dot={false} strokeWidth={2} /></LineChart></Chart></Panel></div></div></div></>;
}

function ParkingInvestigator({parking,locale,t}){
  const model=useMemo(()=>buildParkingInvestigation(parking),[parking]);
  if(!model.eligible.length)return <Panel title={t("parkingInvestigator")} subtitle={t("parkingInvestigatorHelp")}><ChartEmpty t={t} message={t("parkingInvestigatorNeedsData")}/></Panel>;
  const stats=[
    {tone:"mint",label:t("typicalNightLoss"),value:num(model.typicalLossPct,locale,2),unit:"%/day",note:`${model.nights.length} ${t("overnightIntervals")}`},
    {tone:"cyan",label:t("typicalParkedPower"),value:num(model.typicalPowerWatts,locale,0),unit:" W"},
    {tone:"coral",label:t("worstObservedStop"),value:num(model.worst?.socLossPerDay,locale,2),unit:"%/day",note:dateText(model.worst?.startedAtUtc,locale)},
    {tone:"amber",label:t("outsideUsualPattern"),value:num(model.unusual.length,locale,0),note:t("observationsLower")},
  ];
  return <Panel title={t("parkingInvestigator")} subtitle={t("parkingInvestigatorHelp")}>
    <div className="parking-investigator-summary">{stats.map((stat)=><article className={`parking-stat tone-${stat.tone}`} key={stat.label}><span>{stat.label}</span><strong>{stat.value}<small>{stat.unit}</small></strong>{stat.note?<em>{stat.note}</em>:null}</article>)}</div>
    <div className="dashboard-grid two parking-investigator-grid"><div>{model.pattern.length?<Chart height={220}><BarChart data={model.pattern} margin={{top:12,right:12,left:-12}}><CartesianGrid stroke="var(--grid)" vertical={false}/><XAxis dataKey="label" tick={{fill:"var(--muted)",fontSize:9}}/><YAxis unit="%" tick={{fill:"var(--muted)",fontSize:10}}/><Tip locale={locale} suffix="%/day"/><Bar dataKey="medianLossPct" name={t("medianParkedLoss")} fill={C.violet} radius={[4,4,0,0]}/></BarChart></Chart>:<ChartEmpty t={t}/>}</div><div className="parking-watch-list"><strong>{t("stopsToReview")}</strong>{(model.unusual.length?model.unusual:model.eligible.slice().sort((a,b)=>Number(b.socLossPerDay)-Number(a.socLossPerDay)).slice(0,3)).slice(0,5).map((row)=><article key={row.stopId||row.startedAtUtc}><span><b>{dateText(row.startedAtUtc,locale)} · {timeText(row.startedAtUtc,locale)}</b><small>{num(row.durationHours,locale)} h · {num(row.coveragePct,locale,0)}% {t("coverageLower")}</small></span><strong>{num(row.socLossPerDay,locale,2)}%/{t("dayShort")}</strong></article>)}</div></div>
    <p className="analysis-disclaimer">{t("parkingInvestigatorDisclaimer")}</p>
  </Panel>;
}

function Battery({ data, locale, t, period, maxDate, customRange, units, onSaveOwnership }) {
  const battery = data.battery || {};
  const daily = safe(data.daily).filter((row)=>inPeriod(row.date,period,maxDate,customRange));
  const charges = safe(data.charges).filter((row)=>inPeriod(row.date,period,maxDate,customRange));
  const history = safe(battery.history).filter((row)=>inPeriod(row.date,period,maxDate,customRange));
  const healthConfidence = useMemo(()=>assessBatteryHealth(history),[history]);
  const parking = safe(battery.parking).filter((row)=>inPeriod(row.startedAtUtc,period,maxDate,customRange));
  const capacity = median(history.map((row)=>row.capacityKwh));
  const distance = sum(daily,"distanceKm"), consumption = distance ? sum(daily,"netEnergyKwh") / distance * 100 : null;
  const range100 = capacity && consumption ? capacity / consumption * 100 : null, range70 = range100 == null ? null : range100 * .7;
  const observedSeconds = sum(parking,"observedSeconds"), parkedEnergy = sum(parking,"energyKwh");
  const parkedWatts = observedSeconds ? parkedEnergy / (observedSeconds / 3600) * 1000 : null;
  const longParking = parking.filter((row)=>Number(row.durationHours)>=6 && finiteValue(row.socLossPerDay));
  const parkedLoss = median(longParking.map((row)=>row.socLossPerDay));
  const parkedLossHour = parkedLoss == null ? null : parkedLoss / 24;
  const parkedRangeLoss = capacity && consumption && parkedLoss != null ? capacity * parkedLoss / consumption : null;
  const temp = charges.filter((row)=>row.batteryTempMaxC!=null && row.efficiencyPct!=null).map((row)=>({temperature:temperatureValue(row.batteryTempMaxC,units.system),efficiency:row.efficiencyPct}));
  const parkedPowerChart = parking.filter((row)=>finiteValue(row.averageWatts)).slice(0,40).reverse();
  const parkedLossChart = longParking.slice(0,40).reverse();
  const dailyByDate = new Map(daily.map((row)=>[row.date,row]));
  const batteryDaily=safe(battery.daily).filter((row)=>inPeriod(row.date,period,maxDate,customRange)).map((row)=>{const activity=dailyByDate.get(row.date), dailyConsumption=activity?.distanceKm>0 ? Number(activity.netEnergyKwh)/Number(activity.distanceKm)*100 : null; return {...row,label:row.date?.slice(5),realRangeKm:capacity&&dailyConsumption>0?capacity/dailyConsumption*100:null};});
  const rangeSamples=safe(battery.rangeSamples).filter((row)=>inPeriod(row.date,period,maxDate,customRange));
  const tripTemperatureConsumption=safe(data.trips).filter((row)=>inPeriod(row.date,period,maxDate,customRange)&&Number(row.distanceKm)>=5&&finiteValue(row.batteryTempMaxC)&&finiteValue(row.consumptionKwh100)).map((row)=>({temperature:temperatureValue(row.batteryTempMaxC,units.system),consumption:consumptionValue(row.consumptionKwh100,units.system),distance:distanceValue(row.distanceKm,units.system),date:row.date}));
  const xpengRange=median(rangeSamples.map((row)=>row.impliedFullRangeKm));
  return <>
    <VehicleProfileEditor ownership={data.ownership} onSave={onSaveOwnership} t={t}/>
    <div className="metric-grid battery-metrics"><Metric tone="mint" label={t("realRange100")} value={num(distanceValue(range100,units.system),locale)} unit={` ${distanceUnit(units.system)}`} note={`${num(consumptionValue(consumption,units.system),locale)} ${consumptionUnit(units.system)} ${t("inPeriodLower")}`} /><Metric tone="violet" label={t("range80to10")} value={num(distanceValue(range70,units.system),locale)} unit={` ${distanceUnit(units.system)}`} note={t("usableWindow70")} /><Metric tone="cyan" label={t("xpengPredictedRange100")} value={num(distanceValue(xpengRange,units.system),locale)} unit={` ${distanceUnit(units.system)}`} note={`${rangeSamples.length} ${t("eligibleSamples")}`}/><Metric tone="mint" label={t("estimatedCapacity")} value={num(capacity,locale)} unit=" kWh" note={`${history.length} ${t("qualifiedChargesLower")}`} /><Metric tone="amber" label={t("relativeSoh")} value={num(history.at(-1)?.relativeSohPct,locale)} unit="%" note={t("notBmsReading")} /><Metric tone="cyan" label={t("parkedObservedDraw")} value={num(parkedWatts,locale)} unit=" W" note={`${num(parkedEnergy,locale)} kWh ${t("measuredWhileParked")}`} /><Metric tone="coral" label={t("parkedLossPerDay")} value={num(parkedLoss,locale,2)} unit={`%/${t("dayShort")}`} note={`${num(parkedLossHour,locale,2)}%/h · ${num(distanceValue(parkedRangeLoss,units.system),locale)} ${distanceUnit(units.system)}/${t("dayShort")}`} /></div>
    <div className="method-note"><strong>{t("calculatedMetrics")}</strong><p>{t("calculatedMetricsHelp")}</p></div>
    <ParkingInvestigator parking={parking} locale={locale} t={t}/>
    <Panel title={t("batteryConfidenceTitle")} subtitle={t("batteryConfidenceHelp")}>
      <div className={`battery-confidence status-${healthConfidence.level}`}>
        <div className="battery-confidence-score"><span>{t("confidence")}</span><strong>{t(`batteryConfidence_${healthConfidence.level}`)}</strong><div><i style={{width:`${healthConfidence.score}%`}}/></div><small>{healthConfidence.level==="insufficient"?t("batteryConfidenceNeedsData"):`${healthConfidence.score}/100`}</small></div>
        <div className="battery-confidence-metrics"><span><small>{t("qualifiedCharges")}</small><strong>{num(healthConfidence.sampleCount,locale,0)}</strong></span><span><small>{t("observationPeriod")}</small><strong>{num(healthConfidence.spanDays,locale,0)} {t("daysLower")}</strong></span><span><small>{t("medianSocGain")}</small><strong>{num(healthConfidence.medianSocGainPct,locale)}%</strong></span><span><small>{t("estimateVariability")}</small><strong>{num(healthConfidence.variabilityPct,locale,1)}%</strong></span><span><small>{t("capacityConfidenceRange")}</small><strong>{healthConfidence.lowerCapacityKwh==null?"—":`${num(healthConfidence.lowerCapacityKwh,locale,1)}–${num(healthConfidence.upperCapacityKwh,locale,1)} kWh`}</strong></span><span><small>{t("capacityUncertainty")}</small><strong>{healthConfidence.uncertaintyKwh==null?"—":`±${num(healthConfidence.uncertaintyKwh,locale,1)} kWh`}</strong></span></div>
        <div className="battery-confidence-reasons">{healthConfidence.reasons.map((reason)=><span key={reason}>{t(`batteryReason_${reason}`)}</span>)}</div>
      </div>
    </Panel>
    <div className="dashboard-grid two">
      <Panel title={t("socBand")} subtitle={t("socBandHelp")}>{batteryDaily.length?<Chart><AreaChart data={batteryDaily} margin={{top:12,right:12,left:-12}}><CartesianGrid stroke="var(--grid)" vertical={false}/><XAxis dataKey="label" tick={{fill:"var(--muted)",fontSize:9}}/><YAxis domain={[0,100]} unit="%" tick={{fill:"var(--muted)",fontSize:10}}/><Tip locale={locale}/><Legend wrapperStyle={{fontSize:11}}/><Area dataKey="socMaxPct" name={t("maximumSoc")} stroke={C.mint} fill="rgba(32,169,131,.20)"/><Area dataKey="socMinPct" name={t("minimumSoc")} stroke={C.amber} fill="var(--panel)"/></AreaChart></Chart>:<ChartEmpty t={t}/>}</Panel>
      <Panel title={t("thermalSpread")} subtitle={t("thermalSpreadHelp")}>{batteryDaily.length?<Chart><ComposedChart data={batteryDaily} margin={{top:12,right:12,left:-12}}><CartesianGrid stroke="var(--grid)" vertical={false}/><XAxis dataKey="label" tick={{fill:"var(--muted)",fontSize:9}}/><YAxis unit=" °C" tick={{fill:"var(--muted)",fontSize:10}}/><Tip locale={locale}/><Legend wrapperStyle={{fontSize:11}}/><Line dataKey="batteryTempMaxC" name={t("maximumTemperature")} stroke={C.coral} dot={false}/><Line dataKey="batteryTempMinC" name={t("minimumTemperature")} stroke={C.cyan} dot={false}/><Bar dataKey="temperatureSpreadMaxC" name={t("spread")} fill={C.amber}/></ComposedChart></Chart>:<ChartEmpty t={t}/>}</Panel>
      <Panel title={t("rangeComparison")} subtitle={t("rangeComparisonHelp")}>{batteryDaily.some((row)=>row.impliedRangeMedianKm!=null||row.realRangeKm!=null)?<Chart><LineChart data={batteryDaily} margin={{top:12,right:12,left:-12}}><CartesianGrid stroke="var(--grid)" vertical={false}/><XAxis dataKey="label" tick={{fill:"var(--muted)",fontSize:9}}/><YAxis unit=" km" tick={{fill:"var(--muted)",fontSize:10}}/><Tip locale={locale}/><Legend wrapperStyle={{fontSize:11}}/><Line dataKey="impliedRangeMedianKm" name={t("xpengPredictedRange100")} stroke={C.violet} dot={{r:2}} strokeWidth={2}/><Line dataKey="realRangeKm" name={t("realRange100")} stroke={C.mint} dot={{r:2}} strokeWidth={2}/></LineChart></Chart>:<ChartEmpty t={t}/>}</Panel>
      <Panel title={t("temperatureConsumption")} subtitle={t("temperatureConsumptionHelp")}>{tripTemperatureConsumption.length?<Chart><ScatterChart margin={{top:12,right:18,left:-8}}><CartesianGrid stroke="var(--grid)"/><XAxis type="number" dataKey="temperature" name={t("maximumTemperature")} unit="°C" tick={{fill:"var(--muted)",fontSize:10}}/><YAxis type="number" dataKey="consumption" name={t("consumption")} unit=" kWh/100" tick={{fill:"var(--muted)",fontSize:10}}/><ZAxis type="number" dataKey="distance" name={t("distance")} unit=" km" range={[45,220]}/><Tip locale={locale}/><Scatter data={tripTemperatureConsumption} fill={C.coral}/></ScatterChart></Chart>:<ChartEmpty t={t}/>}</Panel>
    </div>
    <div className="dashboard-grid two"><Panel title={t("capacityAndSoh")} subtitle={t("notBmsSoh")}>{history.length?<Chart height={320}><LineChart data={history} margin={{top:16,right:18,left:-8}}><CartesianGrid stroke="var(--grid)" vertical={false}/><XAxis dataKey="date" tick={{fill:"var(--muted)",fontSize:9}}/><YAxis yAxisId="a" tick={{fill:"var(--muted)",fontSize:10}}/><YAxis yAxisId="b" orientation="right" tick={{fill:"var(--muted)",fontSize:10}}/><Tip locale={locale}/><Legend wrapperStyle={{fontSize:11}}/><Line yAxisId="a" dataKey="capacityKwh" name={t("individualCapacityEstimate")} stroke={C.cyan} dot={{r:2}} strokeWidth={1} strokeOpacity={.55}/><Line yAxisId="a" dataKey="rollingCapacityKwh" name={t("rollingCapacity")} stroke={C.mint} dot={{r:3}} strokeWidth={2}/><Line yAxisId="b" dataKey="relativeSohPct" name={t("relativeSoh")} stroke={C.amber} dot={false} strokeWidth={2}/></LineChart></Chart>:<ChartEmpty t={t}/>}</Panel><Panel title={t("thermalEfficiency")} subtitle={t("thermalEfficiencyHelp")}>{temp.length?<Chart height={320}><ScatterChart margin={{top:16,right:18,left:-8}}><CartesianGrid stroke="var(--grid)"/><XAxis type="number" dataKey="temperature" name={t("temperature")} unit="°C" tick={{fill:"var(--muted)",fontSize:10}}/><YAxis type="number" dataKey="efficiency" name={t("efficiency")} unit="%" tick={{fill:"var(--muted)",fontSize:10}}/><Tip locale={locale}/><Scatter data={temp} fill={C.cyan}>{temp.map((_,index)=><Cell key={index} fill={index%2?C.cyan:C.teal}/>)}</Scatter></ScatterChart></Chart>:<ChartEmpty t={t}/>}</Panel></div>
    <div className="dashboard-grid two"><Panel title={t("energyBalance")} subtitle={t("energyBalanceHelp")}>{charges.length?<Chart><BarChart data={charges.slice(-20)} margin={{top:16,right:12,left:-12}}><CartesianGrid stroke="var(--grid)" vertical={false}/><XAxis dataKey="date" tick={{fill:"var(--muted)",fontSize:9}}/><YAxis tick={{fill:"var(--muted)",fontSize:10}}/><Tip locale={locale}/><Legend wrapperStyle={{fontSize:11}}/><Bar stackId="e" dataKey="batteryEnergyKwh" name={t("batteryEnergy")} fill={C.mint}/><Bar stackId="e" dataKey="lossKwh" name={t("losses")} fill={C.coral}/></BarChart></Chart>:<ChartEmpty t={t}/>}</Panel><Panel title={t("parkedPower")} subtitle={t("parkedPowerHelp")}>{parkedPowerChart.length?<Chart><BarChart data={parkedPowerChart} margin={{top:16,right:12,left:-12}}><CartesianGrid stroke="var(--grid)" vertical={false}/><XAxis dataKey="startedAtUtc" tickFormatter={(v)=>v?.slice(5,10)} tick={{fill:"var(--muted)",fontSize:9}}/><YAxis unit=" W" tick={{fill:"var(--muted)",fontSize:10}}/><Tip locale={locale} suffix=" W"/><Bar dataKey="averageWatts" name={t("parkedPower")} fill={C.cyan} radius={[4,4,0,0]}/></BarChart></Chart>:<ChartEmpty t={t}/>}</Panel></div>
    <Panel title={t("parkedBatteryLoss")} subtitle={`${longParking.length} ${t("longIntervals")} · ${num(sum(longParking,"durationHours"),locale)} h ${t("analysedLower")}`} collapsible t={t}>{parkedLossChart.length?<Chart><BarChart data={parkedLossChart} margin={{top:16,right:12,left:-12}}><CartesianGrid stroke="var(--grid)" vertical={false}/><XAxis dataKey="startedAtUtc" tickFormatter={(v)=>v?.slice(5,10)} tick={{fill:"var(--muted)",fontSize:9}}/><YAxis unit="%" tick={{fill:"var(--muted)",fontSize:10}}/><Tip locale={locale} suffix="%"/><ReferenceLine y={parkedLoss} stroke={C.amber} strokeDasharray="5 4" label={{value:t("median"),fill:"var(--muted)",fontSize:10}}/><Bar dataKey="socLossPerDay" name={t("socLossPerDay")} fill={C.amber} radius={[4,4,0,0]}/></BarChart></Chart>:<ChartEmpty t={t} message={t("noParkingChartData")}/>}</Panel>
    <Panel title={t("parkingIntervals")} subtitle={t("parkingTableHelp")} collapsible defaultCollapsed scrollHeight={340} t={t}><div className="data-table parking-table detailed"><div className="table-head"><span>{t("date")}</span><span>{t("duration")}</span><span>{t("socChange")}</span><span>{t("socLoss")}</span><span>{t("socLossPerHour")}</span><span>{t("socLossPerDay")}</span><span>{t("energy")}</span><span>{t("averagePower")}</span><span>{t("coverage")}</span><span>{t("confidence")}</span></div>{parking.slice(0,40).map((row)=><div key={row.stopId}><span>{dateText(row.startedAtUtc,locale)}</span><span>{num(row.durationHours,locale)} h</span><span>{num(row.socStartPct,locale,0)} → {num(row.socEndPct,locale,0)}%</span><span>{num(row.socLossPct,locale,1)}%</span><span>{num(row.socLossPerHour,locale,2)}%</span><span>{num(row.socLossPerDay,locale,2)}%</span><span>{num(row.energyKwh,locale,2)} kWh</span><span>{num(row.averageWatts,locale,0)} W</span><span>{num(row.coveragePct,locale)}%</span><span className={`confidence confidence-${row.confidence}`}>{t(`confidence_${row.confidence}`)}</span></div>)}</div></Panel>
  </>;
}

function Tyres({ data, locale, t, period, maxDate, customRange, units }) {
  const tyres=safe(data.battery?.tyres).filter((row)=>inPeriod(row.date,period,maxDate,customRange)).map((row)=>({...row,label:row.date?.slice(5)}));
  if (!tyres.length) return <Empty t={t}/>;
  const latest=tyres.at(-1), first=tyres[0], pressureChange=finiteValue(latest?.averageKpa)&&finiteValue(first?.averageKpa)?Number(latest.averageKpa)-Number(first.averageKpa):null;
  const pressures=tyres.flatMap((row)=>[row.frontLeftKpa,row.frontRightKpa,row.rearLeftKpa,row.rearRightKpa]).map(Number).filter(Number.isFinite);
  const pressureLabel=pressureUnitLabel(units.pressure), displayTyres=tyres.map((row)=>({...row,frontLeftKpa:pressureValue(row.frontLeftKpa,units.pressure),frontRightKpa:pressureValue(row.frontRightKpa,units.pressure),rearLeftKpa:pressureValue(row.rearLeftKpa,units.pressure),rearRightKpa:pressureValue(row.rearRightKpa,units.pressure),frontImbalanceKpa:pressureValue(row.frontImbalanceKpa,units.pressure),rearImbalanceKpa:pressureValue(row.rearImbalanceKpa,units.pressure)}));
  const displayPressures=pressures.map((value)=>pressureValue(value,units.pressure)), padding=units.pressure==="psi"?1:.1;
  const pressureMin=displayPressures.length?Math.floor(Math.min(...displayPressures)/padding)*padding-padding:1, pressureMax=displayPressures.length?Math.ceil(Math.max(...displayPressures)/padding)*padding+padding:4;
  const maximumImbalance=maximum(tyres.flatMap((row)=>[{value:row.frontImbalanceKpa},{value:row.rearImbalanceKpa}]),"value");
  const tyreObservations=buildTyreObservations(tyres);
  return <>
    <div className="metric-grid tyres-metrics"><Metric tone="mint" label={t("currentAveragePressure")} value={num(pressureValue(latest?.averageKpa,units.pressure),locale,units.pressure==="bar"?2:1)} unit={` ${pressureLabel}`} note={latest?.date}/><Metric tone="cyan" label={t("pressureChange")} value={num(pressureValue(pressureChange,units.pressure),locale,units.pressure==="bar"?2:1)} unit={` ${pressureLabel}`} note={t("fourTyreMedian")}/><Metric tone="amber" label={t("maximumTyreImbalance")} value={num(pressureValue(maximumImbalance,units.pressure),locale,units.pressure==="bar"?2:1)} unit={` ${pressureLabel}`}/><Metric tone="violet" label={t("daysWithReadings")} value={num(tyres.length,locale,0)} note={`${num(sum(tyres,"samples"),locale,0)} ${t("samplesLower")}`}/></div>
    {tyreObservations.observations.length?<div className="tyre-observation-list"><header><strong>{t("tyreObservations")}</strong><small>{t("tyreObservationsHelp")}</small></header>{tyreObservations.observations.map((observation)=><article key={observation.kind} className={`severity-${observation.severity}`}><span><strong>{t(`tyreObservation_${observation.kind}`)}</strong><small>{t(`tyreObservation_${observation.kind}_help`)}</small></span><b>{num(pressureValue(observation.valueKpa,units.pressure),locale,units.pressure==="bar"?2:1)} {pressureLabel}</b></article>)}<p>{t("tyreObservationDisclaimer")}</p></div>:null}
    <div className="dashboard-grid two">
      <Panel title={t("tyrePressureTrend")} subtitle={t("tyrePressureTrendHelp")}><Chart><LineChart data={displayTyres} margin={{top:12,right:12,left:4}}><CartesianGrid stroke="var(--grid)" vertical={false}/><XAxis dataKey="label" tick={{fill:"var(--muted)",fontSize:9}}/><YAxis width={48} domain={[pressureMin,pressureMax]} tickFormatter={(value)=>num(value,locale,units.pressure==="bar"?1:0)} tick={{fill:"var(--muted)",fontSize:10}}/><Tip locale={locale} suffix={` ${pressureLabel}`}/><Legend wrapperStyle={{fontSize:11}}/><Line dataKey="frontLeftKpa" name={t("frontLeftShort")} stroke={C.mint} dot={false}/><Line dataKey="frontRightKpa" name={t("frontRightShort")} stroke={C.cyan} dot={false}/><Line dataKey="rearLeftKpa" name={t("rearLeftShort")} stroke={C.amber} dot={false}/><Line dataKey="rearRightKpa" name={t("rearRightShort")} stroke={C.coral} dot={false}/></LineChart></Chart></Panel>
      <Panel title={t("tyreImbalanceTrend")} subtitle={t("tyreImbalanceTrendHelp")}><Chart><LineChart data={displayTyres} margin={{top:12,right:12,left:4}}><CartesianGrid stroke="var(--grid)" vertical={false}/><XAxis dataKey="label" tick={{fill:"var(--muted)",fontSize:9}}/><YAxis width={48} domain={[0,"auto"]} tickFormatter={(value)=>num(value,locale,units.pressure==="bar"?2:1)} tick={{fill:"var(--muted)",fontSize:10}}/><Tip locale={locale} suffix={` ${pressureLabel}`}/><Legend wrapperStyle={{fontSize:11}}/><Line dataKey="frontImbalanceKpa" name={t("frontAxle")} stroke={C.cyan} dot={{r:2}}/><Line dataKey="rearImbalanceKpa" name={t("rearAxle")} stroke={C.amber} dot={{r:2}}/></LineChart></Chart></Panel>
    </div>
  </>;
}

function DrivingHeatmap({ rows, t }) {
  const labels=[t("mondayShort"),t("tuesdayShort"),t("wednesdayShort"),t("thursdayShort"),t("fridayShort"),t("saturdayShort"),t("sundayShort")], values=new Map();
  rows.forEach((row)=>{const key=`${row.weekdayIndex}|${row.hourIndex}`;values.set(key,(values.get(key)||0)+Number(row.drivingMinutes||0));});
  const maximumValue=Math.max(1,...values.values());
  return <div className="driving-heatmap"><div className="heatmap-hours"><span/>{Array.from({length:24},(_,hour)=><small key={hour}>{hour%3===0?String(hour).padStart(2,"0"):""}</small>)}</div>{labels.map((label,weekday)=><div className="heatmap-row" key={label}><strong>{label}</strong>{Array.from({length:24},(_,hour)=>{const value=values.get(`${weekday}|${hour}`)||0;return <i key={hour} title={`${label} ${String(hour).padStart(2,"0")}:00 · ${Math.round(value)} min`} style={{opacity:value?Math.max(.18,value/maximumValue):.04}}/>;})}</div>)}</div>;
}

function contextRows(data) {
  const calculated=safe(data.driving?.contexts);
  if(calculated.length)return calculated;
  return safe(data.trips).map((row)=>{
    const average=Number(row.avgSpeedKmh)||0, maximumSpeed=Number(row.maxSpeedKmh)||0;
    const context=average>=80||maximumSpeed>=110?"motorway":average>=40||maximumSpeed>=70?"road":"urban";
    return {segmentId:`fallback-${row.tripId}`,tripId:row.tripId,date:row.date,startedAtUtc:row.startedAtUtc,context,confidence:"low",confidenceScore:null,durationMinutes:row.durationMinutes,distanceKm:row.distanceKm,averageSpeedKmh:row.avgSpeedKmh,energyUsedKwh:row.energyUsedKwh,regeneratedKwh:row.regeneratedKwh,netEnergyKwh:row.netEnergyKwh,consumptionKwh100:row.consumptionKwh100,stopCount:0};
  });
}

function Trends({ data, locale, t, period, maxDate, customRange, units }) {
  const battery=data.battery||{}, monthMap=new Map();
  const month=(date)=>{const key=String(date||"").slice(0,7);if(!key)return null;if(!monthMap.has(key))monthMap.set(key,{month:key,distanceKm:0,netEnergyKwh:0,regeneratedKwh:0,drivingHours:0,wallEnergyKwh:0,batteryEnergyKwh:0,charges:0,capacity:[],soh:[],range:[],parkedEnergyKwh:0,parkedSeconds:0,parkedLoss:[],pressure:[]});return monthMap.get(key);};
  safe(data.daily).filter((row)=>inPeriod(row.date,period,maxDate,customRange)).forEach((row)=>{const target=month(row.date);if(!target)return;target.distanceKm+=Number(row.distanceKm)||0;target.netEnergyKwh+=Number(row.netEnergyKwh)||0;target.regeneratedKwh+=Number(row.regeneratedKwh)||0;target.drivingHours+=Number(row.drivingHours)||0;target.wallEnergyKwh+=Number(row.wallEnergyKwh)||0;target.batteryEnergyKwh+=Number(row.batteryEnergyKwh)||0;target.charges+=Number(row.charges)||0;});
  safe(battery.history).filter((row)=>inPeriod(row.date,period,maxDate,customRange)).forEach((row)=>{const target=month(row.date);if(!target)return;if(finiteValue(row.rollingCapacityKwh))target.capacity.push(Number(row.rollingCapacityKwh));if(finiteValue(row.relativeSohPct))target.soh.push(Number(row.relativeSohPct));});
  safe(battery.daily).filter((row)=>inPeriod(row.date,period,maxDate,customRange)).forEach((row)=>{const target=month(row.date);if(target&&finiteValue(row.impliedRangeMedianKm))target.range.push(Number(row.impliedRangeMedianKm));});
  safe(battery.parking).filter((row)=>inPeriod(row.startedAtUtc,period,maxDate,customRange)).forEach((row)=>{const target=month(row.startedAtUtc);if(!target)return;target.parkedEnergyKwh+=Number(row.energyKwh)||0;target.parkedSeconds+=Number(row.observedSeconds)||0;if(finiteValue(row.socLossPerDay))target.parkedLoss.push(Number(row.socLossPerDay));});
  safe(battery.tyres).filter((row)=>inPeriod(row.date,period,maxDate,customRange)).forEach((row)=>{const target=month(row.date);if(target&&finiteValue(row.averageKpa))target.pressure.push(Number(row.averageKpa));});
  const monthly=[...monthMap.values()].sort((a,b)=>a.month.localeCompare(b.month)).map((row)=>({
    ...row,label:monthText(row.month,locale),distanceDisplay:distanceValue(row.distanceKm,units.system),consumptionDisplay:consumptionValue(row.distanceKm?row.netEnergyKwh/row.distanceKm*100:null,units.system),rangeDisplay:distanceValue(median(row.range),units.system),capacityKwh:median(row.capacity),relativeSohPct:median(row.soh),parkedWatts:row.parkedSeconds?row.parkedEnergyKwh/(row.parkedSeconds/3600)*1000:null,parkedLossPct:median(row.parkedLoss),chargeEfficiencyPct:row.wallEnergyKwh?row.batteryEnergyKwh/row.wallEnergyKwh*100:null,pressureDisplay:pressureValue(median(row.pressure),units.pressure),
  }));
  const segments=contextRows(data).filter((row)=>inPeriod(row.date,period,maxDate,customRange));
  const contextTotals=["urban","road","motorway"].map((context)=>{const rows=segments.filter((row)=>row.context===context),distance=sum(rows,"distanceKm"),used=sum(rows,"energyUsedKwh"),regenerated=sum(rows,"regeneratedKwh"),net=sum(rows,"netEnergyKwh"),minutes=sum(rows,"durationMinutes"),weightedConfidence=rows.reduce((total,row)=>total+(Number(row.confidenceScore)||0)*(Number(row.distanceKm)||0),0);return {context,rows:rows.length,distanceKm:distance,distanceDisplay:distanceValue(distance,units.system),minutes,energyUsedKwh:used,regeneratedKwh:regenerated,netEnergyKwh:net,consumptionDisplay:consumptionValue(distance?net/distance*100:null,units.system),confidenceScore:distance?weightedConfidence/distance:null};});
  const totalDistance=sum(contextTotals,"distanceKm"), totalMonths=monthly.length, latest=monthly.at(-1);
  if(!monthly.length&&!segments.length)return <Empty t={t}/>;
  const has=(field)=>monthly.some((row)=>finiteValue(row[field]));
  return <>
    <div className="metric-grid trends-metrics"><Metric tone="mint" label={t("monthsTracked")} value={num(totalMonths,locale,0)} note={monthly.length?(monthly.length>1?`${monthly[0].label} — ${latest.label}`:latest.label):null}/><Metric tone="cyan" label={t("distance")} value={num(distanceValue(sum(monthly,"distanceKm"),units.system),locale)} unit={` ${distanceUnit(units.system)}`}/><Metric tone="violet" label={t("averageConsumption")} value={num(consumptionValue(sum(monthly,"distanceKm")?sum(monthly,"netEnergyKwh")/sum(monthly,"distanceKm")*100:null,units.system),locale)} unit={` ${consumptionUnit(units.system)}`}/><Metric tone="amber" label={t("gridEnergy")} value={num(sum(monthly,"wallEnergyKwh"),locale)} unit=" kWh" note={`${num(sum(monthly,"charges"),locale,0)} ${t("sessionsLower")}`}/></div>
    <div className="method-note"><strong>{t("longTermTrends")}</strong><p>{t("longTermTrendsHelp")}</p></div>
    <div className="dashboard-grid two trends-grid">
      <Panel title={t("monthlyDistanceConsumption")} subtitle={t("monthlyDistanceConsumptionHelp")}>{has("distanceDisplay")?<Chart><ComposedChart data={monthly} margin={{top:16,right:18,left:-8}}><CartesianGrid stroke="var(--grid)" vertical={false}/><XAxis dataKey="label" tick={{fill:"var(--muted)",fontSize:9}}/><YAxis yAxisId="a" tick={{fill:"var(--muted)",fontSize:10}}/><YAxis yAxisId="b" orientation="right" tick={{fill:"var(--muted)",fontSize:10}}/><Tip locale={locale}/><Legend wrapperStyle={{fontSize:11}}/><Bar yAxisId="a" dataKey="distanceDisplay" name={`${t("distance")} (${distanceUnit(units.system)})`} fill={C.mint}/><Line yAxisId="b" dataKey="consumptionDisplay" name={consumptionUnit(units.system)} stroke={C.coral} strokeWidth={2}/></ComposedChart></Chart>:<ChartEmpty t={t}/>}</Panel>
      <Panel title={t("monthlyRangeTrend")} subtitle={t("monthlyRangeTrendHelp")}>{has("rangeDisplay")?<Chart><LineChart data={monthly} margin={{top:16,right:18,left:-8}}><CartesianGrid stroke="var(--grid)" vertical={false}/><XAxis dataKey="label" tick={{fill:"var(--muted)",fontSize:9}}/><YAxis tick={{fill:"var(--muted)",fontSize:10}}/><Tip locale={locale} suffix={` ${distanceUnit(units.system)}`}/><Line dataKey="rangeDisplay" name={t("xpengPredictedRange100")} stroke={C.violet} dot={{r:3}} strokeWidth={2}/></LineChart></Chart>:<ChartEmpty t={t}/>}</Panel>
      <Panel title={t("monthlyBatteryHealth")} subtitle={t("notBmsSoh")}>{has("capacityKwh")||has("relativeSohPct")?<Chart><LineChart data={monthly} margin={{top:16,right:18,left:-8}}><CartesianGrid stroke="var(--grid)" vertical={false}/><XAxis dataKey="label" tick={{fill:"var(--muted)",fontSize:9}}/><YAxis yAxisId="a" tick={{fill:"var(--muted)",fontSize:10}}/><YAxis yAxisId="b" orientation="right" tick={{fill:"var(--muted)",fontSize:10}}/><Tip locale={locale}/><Legend wrapperStyle={{fontSize:11}}/><Line yAxisId="a" dataKey="capacityKwh" name={t("estimatedCapacity")} stroke={C.mint} dot={{r:3}}/><Line yAxisId="b" dataKey="relativeSohPct" name={t("relativeSoh")} stroke={C.amber} dot={{r:3}}/></LineChart></Chart>:<ChartEmpty t={t}/>}</Panel>
      <Panel title={t("monthlyParkedUse")} subtitle={t("monthlyParkedUseHelp")}>{has("parkedWatts")||has("parkedLossPct")?<Chart><ComposedChart data={monthly} margin={{top:16,right:18,left:-8}}><CartesianGrid stroke="var(--grid)" vertical={false}/><XAxis dataKey="label" tick={{fill:"var(--muted)",fontSize:9}}/><YAxis yAxisId="a" tick={{fill:"var(--muted)",fontSize:10}}/><YAxis yAxisId="b" orientation="right" tick={{fill:"var(--muted)",fontSize:10}}/><Tip locale={locale}/><Legend wrapperStyle={{fontSize:11}}/><Bar yAxisId="a" dataKey="parkedWatts" name={t("parkedPower")} fill={C.cyan}/><Line yAxisId="b" dataKey="parkedLossPct" name={t("parkedLossPerDay")} stroke={C.coral}/></ComposedChart></Chart>:<ChartEmpty t={t}/>}</Panel>
      <Panel title={t("monthlyCharging")} subtitle={t("monthlyChargingHelp")}>{has("wallEnergyKwh")?<Chart><BarChart data={monthly} margin={{top:16,right:12,left:-8}}><CartesianGrid stroke="var(--grid)" vertical={false}/><XAxis dataKey="label" tick={{fill:"var(--muted)",fontSize:9}}/><YAxis tick={{fill:"var(--muted)",fontSize:10}}/><Tip locale={locale} suffix=" kWh"/><Legend wrapperStyle={{fontSize:11}}/><Bar dataKey="wallEnergyKwh" name={t("gridEnergy")} fill={C.cyan}/><Bar dataKey="batteryEnergyKwh" name={t("batteryEnergy")} fill={C.mint}/></BarChart></Chart>:<ChartEmpty t={t}/>}</Panel>
      <Panel title={t("monthlyTyrePressure")} subtitle={t("monthlyTyrePressureHelp")}>{has("pressureDisplay")?<Chart><LineChart data={monthly} margin={{top:16,right:18,left:-2}}><CartesianGrid stroke="var(--grid)" vertical={false}/><XAxis dataKey="label" tick={{fill:"var(--muted)",fontSize:9}}/><YAxis domain={["auto","auto"]} tick={{fill:"var(--muted)",fontSize:10}}/><Tip locale={locale} suffix={` ${pressureUnitLabel(units.pressure)}`}/><Line dataKey="pressureDisplay" name={t("currentAveragePressure")} stroke={C.teal} dot={{r:3}} strokeWidth={2}/></LineChart></Chart>:<ChartEmpty t={t}/>}</Panel>
    </div>
    <Panel title={t("estimatedDrivingContext")} subtitle={t("estimatedDrivingContextHelp")}>
      <div className="metric-grid context-metrics">{contextTotals.map((row,index)=><Metric key={row.context} tone={["mint","cyan","violet"][index]} label={t(`context_${row.context}`)} value={num(row.distanceDisplay,locale)} unit={` ${distanceUnit(units.system)}`} note={`${num(row.consumptionDisplay,locale)} ${consumptionUnit(units.system)} · ${duration(row.minutes,t)}`}/>)}</div>
      <div className="context-layout"><div>{totalDistance?<Chart height={250}><PieChart><Pie data={contextTotals} dataKey="distanceDisplay" nameKey="context" innerRadius={52} outerRadius={86} paddingAngle={3}>{contextTotals.map((row,index)=><Cell key={row.context} fill={[C.mint,C.cyan,C.violet][index]}/>)}</Pie><Tooltip formatter={(value,name)=>[`${num(value,locale)} ${distanceUnit(units.system)}`,t(`context_${name}`)]}/><Legend formatter={(value)=>t(`context_${value}`)} wrapperStyle={{fontSize:11}}/></PieChart></Chart>:<ChartEmpty t={t}/>}</div><div className="context-table"><div className="table-head"><span>{t("drivingContext")}</span><span>{t("distance")}</span><span>{t("time")}</span><span>{t("averageConsumption")}</span><span>{t("energyUsed")}</span><span>{t("regenerated")}</span><span>{t("confidence")}</span></div>{contextTotals.map((row)=><div key={row.context}><strong>{t(`context_${row.context}`)}</strong><span>{num(row.distanceDisplay,locale)} {distanceUnit(units.system)}</span><span>{duration(row.minutes,t)}</span><span>{num(row.consumptionDisplay,locale)} {consumptionUnit(units.system)}</span><span>{num(row.energyUsedKwh,locale)} kWh</span><span>{num(row.regeneratedKwh,locale)} kWh</span><span>{row.confidenceScore==null?t("confidence_low"):`${num(row.confidenceScore,locale,0)}%`}</span></div>)}</div></div>
    </Panel>
    <div className="method-note context-disclaimer"><strong>{t("softwareEstimate")}</strong><p>{t("drivingContextDisclaimer")}</p></div>
  </>;
}

function Activity({ data, locale, t, period, maxDate, customRange, units }) {
  const weekdays = [t("mondayShort"),t("tuesdayShort"),t("wednesdayShort"),t("thursdayShort"),t("fridayShort"),t("saturdayShort"),t("sundayShort")];
  const daily = safe(data.daily).filter((row)=>inPeriod(row.date,period,maxDate,customRange)).map((row)=>({...row,consumptionDisplay:consumptionValue(row.consumptionKwh100,units.system),label:row.date?.slice(5)}));
  const trips = safe(data.trips).filter((row)=>inPeriod(row.date,period,maxDate,customRange));
  const journeys = safe(data.journeys).filter((row)=>inPeriod(row.date,period,maxDate,customRange));
  const weekdayTotals = Array.from({length:7},()=>({trips:0,distanceKm:0}));
  const hourTotals = Array.from({length:24},(_,hour)=>({hour,trips:0}));
  trips.forEach((row)=>{ const weekday=(new Date(`${row.date}T00:00:00Z`).getUTCDay()+6)%7; weekdayTotals[weekday].trips+=1; weekdayTotals[weekday].distanceKm+=Number(row.distanceKm)||0; const hour=localHour(row.startedAtUtc); if(Number.isFinite(hour)) hourTotals[hour].trips+=1; });
  const weekday = weekdayTotals.map((row,index)=>({...row,distanceKm:distanceValue(row.distanceKm,units.system),label:weekdays[index]}));
  const hours = hourTotals.map((row)=>({...row,label:`${String(row.hour).padStart(2,"0")}h`}));
  const monthlyMap = new Map(); daily.forEach((row)=>{ const key=row.date.slice(0,7), current=monthlyMap.get(key)||{month:key,distanceKm:0,journeys:0}; current.distanceKm+=Number(row.distanceKm)||0; current.journeys+=Number(row.journeys)||0; monthlyMap.set(key,current); });
  const monthly = [...monthlyMap.values()].map((row)=>({...row,distanceKm:distanceValue(row.distanceKm,units.system),label:row.month}));
  const heatmap=safe(data.activity?.heatmap).filter((row)=>inPeriod(row.date,period,maxDate,customRange));
  const bar = (rows,key,color) => rows.some((row)=>Number(row[key]))?<Chart><BarChart data={rows} margin={{top:12,right:12,left:-12}}><CartesianGrid stroke="var(--grid)" vertical={false}/><XAxis dataKey="label" tick={{fill:"var(--muted)",fontSize:9}}/><YAxis tick={{fill:"var(--muted)",fontSize:10}}/><Tip locale={locale}/><Bar dataKey={key} fill={color} radius={[4,4,0,0]}/></BarChart></Chart>:<ChartEmpty t={t}/>;
  if (!daily.length && !trips.length) return <Empty t={t}/>;
  return <><div className="metric-grid activity-metrics"><Metric tone="mint" label={t("activeDays")} value={num(daily.filter((row)=>row.trips||row.charges).length,locale,0)}/><Metric tone="cyan" label={t("distance")} value={num(distanceValue(sum(daily,"distanceKm"),units.system),locale)} unit={` ${distanceUnit(units.system)}`}/><Metric tone="violet" label={t("drivingTime")} value={num(sum(daily,"drivingHours"),locale)} unit={` ${t("hourShort")}`}/><Metric tone="amber" label={t("journeys")} value={num(journeys.length,locale,0)} note={`${trips.length} ${t("segmentsLower")}`}/></div><Panel title={t("actualMovementHeatmap")} subtitle={t("actualMovementHeatmapHelp")}><DrivingHeatmap rows={heatmap} t={t}/></Panel><div className="dashboard-grid two activity-grid">
    <Panel title={t("dailyEnergy")} subtitle={t("dailyEnergyHelp")}><Chart><BarChart data={daily} margin={{top:12,right:12,left:-12}}><CartesianGrid stroke="var(--grid)" vertical={false}/><XAxis dataKey="label" tick={{fill:"var(--muted)",fontSize:9}}/><YAxis tick={{fill:"var(--muted)",fontSize:10}}/><Tip locale={locale} suffix=" kWh"/><Legend wrapperStyle={{fontSize:11}}/><Bar dataKey="energyUsedKwh" name={t("used")} fill={C.amber}/><Bar dataKey="regeneratedKwh" name={t("regenerated")} fill={C.mint}/></BarChart></Chart></Panel>
    <Panel title={t("dailyConsumption")} subtitle={t("dailyConsumptionHelp")}><Chart><LineChart data={daily} margin={{top:12,right:12,left:-12}}><CartesianGrid stroke="var(--grid)" vertical={false}/><XAxis dataKey="label" tick={{fill:"var(--muted)",fontSize:9}}/><YAxis tick={{fill:"var(--muted)",fontSize:10}}/><Tip locale={locale} suffix={` ${consumptionUnit(units.system)}`}/><Line dataKey="consumptionDisplay" name={t("consumption")} stroke={C.coral} dot={{r:2}} strokeWidth={2}/></LineChart></Chart></Panel>
    <Panel title={t("distanceByMonth")}>{bar(monthly,"distanceKm",C.mint)}</Panel><Panel title={t("journeysByMonth")} subtitle={t("journeysByMonthHelp")}>{bar(monthly,"journeys",C.cyan)}</Panel>
    <Panel title={t("weekdayActivity")}>{bar(weekday,"distanceKm",C.violet)}</Panel><Panel title={t("tripStartsByHour")} subtitle={t("localTimeZone")}>{bar(hours,"trips",C.amber)}</Panel>
    <Panel title={t("chargedEnergyPerDay")} subtitle={t("gridVsBattery")}><Chart><BarChart data={daily} margin={{top:12,right:12,left:-12}}><CartesianGrid stroke="var(--grid)" vertical={false}/><XAxis dataKey="label" tick={{fill:"var(--muted)",fontSize:9}}/><YAxis tick={{fill:"var(--muted)",fontSize:10}}/><Tip locale={locale} suffix=" kWh"/><Legend wrapperStyle={{fontSize:11}}/><Bar dataKey="wallEnergyKwh" name={t("gridEnergy")} fill={C.cyan}/><Bar dataKey="batteryEnergyKwh" name={t("batteryEnergy")} fill={C.mint}/></BarChart></Chart></Panel>
    <Panel title={t("chargingSessionsPerDay")}>{bar(daily,"charges",C.teal)}</Panel>
  </div></>;
}

function TariffManager({ ownership, onSave, t }) {
  const value=validateOwnershipMetadata(ownership),active=value.tariffs.find((row)=>row.id===value.activeTariffId);
  const [name,setName]=useState(""),[price,setPrice]=useState(""),[offPeak,setOffPeak]=useState(""),[currency,setCurrency]=useState("EUR"),[model,setModel]=useState("flat"),[category,setCategory]=useState("all"),[peakStart,setPeakStart]=useState("17"),[peakEnd,setPeakEnd]=useState("22");
  const add=()=>{const amount=Number(price.replace(",",".")),offPeakAmount=Number(offPeak.replace(",","."));if(!name.trim()||!Number.isFinite(amount)||amount<0||(model==="time"&&(!Number.isFinite(offPeakAmount)||offPeakAmount<0)))return;const tariff={id:`tariff-${Date.now().toString(36)}`,name:name.trim(),pricePerKwh:amount,offPeakPricePerKwh:model==="time"?offPeakAmount:amount,currency,model,category,peakStartHour:Number(peakStart),peakEndHour:Number(peakEnd)};onSave?.(validateOwnershipMetadata({...value,tariffs:[...value.tariffs,tariff],activeTariffId:tariff.id}));setName("");setPrice("");setOffPeak("");};
  const remove=(id)=>onSave?.(validateOwnershipMetadata({...value,tariffs:value.tariffs.filter((row)=>row.id!==id)}));
  return <div className="tariff-manager"><div className="tariff-heading"><div><strong>{t("tariffProfiles")}</strong><small>{t("tariffProfilesHelp")}</small></div>{value.tariffs.length?<select value={value.activeTariffId} onChange={(event)=>onSave?.(validateOwnershipMetadata({...value,activeTariffId:event.currentTarget.value}))}>{value.tariffs.map((row)=><option key={row.id} value={row.id}>{row.name} · {row.pricePerKwh} {row.currency}/kWh</option>)}</select>:null}</div>{active?<div className="active-tariff"><span>{active.name} · {t(`chargeCategory_${active.category}`)||active.category}</span><strong>{active.model==="time"?`${active.offPeakPricePerKwh}–${active.pricePerKwh}`:active.pricePerKwh} {active.currency}/kWh</strong><button type="button" className="danger-link" onClick={()=>remove(active.id)}>{t("remove")}</button></div>:null}<div className="tariff-form tariff-form-advanced"><input value={name} maxLength={80} placeholder={t("tariffName")} onChange={(event)=>setName(event.currentTarget.value)}/><select value={category} onChange={(event)=>setCategory(event.currentTarget.value)}><option value="all">{t("allLocations")}</option>{CHARGE_CATEGORIES.map((item)=><option value={item} key={item}>{t(`chargeCategory_${item}`)}</option>)}</select><select value={model} onChange={(event)=>setModel(event.currentTarget.value)}><option value="flat">{t("flatTariff")}</option><option value="time">{t("timeOfUseTariff")}</option></select><input value={price} inputMode="decimal" placeholder={model==="time"?t("peakPrice"):"0.20"} onChange={(event)=>setPrice(event.currentTarget.value)}/>{model==="time"?<><input value={offPeak} inputMode="decimal" placeholder={t("offPeakPrice")} onChange={(event)=>setOffPeak(event.currentTarget.value)}/><input type="number" min="0" max="23" value={peakStart} aria-label={t("peakStart")} onChange={(event)=>setPeakStart(event.currentTarget.value)}/><input type="number" min="0" max="23" value={peakEnd} aria-label={t("peakEnd")} onChange={(event)=>setPeakEnd(event.currentTarget.value)}/></>:null}<select value={currency} onChange={(event)=>setCurrency(event.currentTarget.value)}>{TARIFF_CURRENCIES.map((item)=><option key={item}>{item}</option>)}</select><button type="button" className="secondary-button" onClick={add}>{t("addTariff")}</button></div>{model==="time"?<small className="tariff-method-note">{t("timeTariffEstimateHelp")}</small>:null}</div>;
}

function ReminderManager({ ownership, currentOdometer, onSave, locale, t }) {
  const value=validateOwnershipMetadata(ownership),[type,setType]=useState("maintenance"),[title,setTitle]=useState(""),[dueDate,setDueDate]=useState(""),[dueOdometer,setDueOdometer]=useState(""),[note,setNote]=useState("");
  const add=()=>{if(!title.trim()||(!dueDate&&!dueOdometer))return;onSave?.(upsertReminder(value,{type,title:title.trim(),dueDate,dueOdometerKm:dueOdometer,note}));setTitle("");setDueDate("");setDueOdometer("");setNote("");};
  const toggle=(item)=>onSave?.(upsertReminder(value,{...item,completed:!item.completed}));
  return <div className="reminder-manager"><div className="ownership-editor-heading"><span><strong>{t("reminders")}</strong><small>{t("remindersHelp")}</small></span><small>{t("currentOdometer")}: {currentOdometer==null?"—":`${num(currentOdometer,locale,0)} km`}</small></div><div className="reminder-form"><select value={type} onChange={(event)=>setType(event.currentTarget.value)}>{REMINDER_TYPES.map((item)=><option key={item} value={item}>{t(`reminderType_${item}`)}</option>)}</select><input value={title} maxLength={120} placeholder={t("reminderTitle")} onChange={(event)=>setTitle(event.currentTarget.value)}/><input type="date" value={dueDate} aria-label={t("reminderDate")} onChange={(event)=>setDueDate(event.currentTarget.value)}/><input inputMode="numeric" value={dueOdometer} placeholder={t("reminderOdometer")} onChange={(event)=>setDueOdometer(event.currentTarget.value)}/><input value={note} maxLength={300} placeholder={t("reminderNote")} onChange={(event)=>setNote(event.currentTarget.value)}/><button type="button" className="secondary-button" onClick={add}>{t("addReminder")}</button></div><div className="reminder-list">{value.reminders.length?value.reminders.slice().sort((a,b)=>a.completed-b.completed||String(a.dueDate).localeCompare(String(b.dueDate))).map((item)=>{const state=reminderState(item,{odometerKm:currentOdometer});return <article key={item.id} className={`reminder-${state}`}><span><i>{t(`reminderType_${item.type}`)}</i><strong>{item.title}</strong><small>{[item.dueDate?dateText(`${item.dueDate}T12:00:00Z`,locale):"",item.dueOdometerKm!=null?`${num(item.dueOdometerKm,locale,0)} km`:"",item.note].filter(Boolean).join(" · ")}</small></span><b>{t(`reminderState_${state}`)}</b><button type="button" onClick={()=>toggle(item)}>{t(item.completed?"reopen":"markComplete")}</button><button type="button" className="danger-link" onClick={()=>onSave?.(removeReminder(value,item.id))}>{t("remove")}</button></article>}):<p className="ownership-empty">{t("noReminders")}</p>}</div></div>;
}

function OwnershipCentre({ data, locale, t, onSaveOwnership }) {
  const summary=useMemo(()=>ownershipCostSummary(data.charges,data.ownership),[data.charges,data.ownership]);
  const currentOdometer=useMemo(()=>{const values=safe(data.charges).map((row)=>Number(row.odometerKm)).filter(Number.isFinite);return values.length?Math.max(...values):null;},[data.charges]);
  const currency=summary.currencies.length===1?summary.currencies[0]:"";
  return <div className="ownership-page"><div className="metric-grid"><Metric tone="mint" label={t("pricedSessions")} value={num(summary.priced,locale,0)} note={`${safe(data.charges).length} ${t("sessionsLower")}`}/><Metric tone="amber" label={t("totalEstimatedCost")} value={summary.priced?num(summary.cost,locale,2):"—"} unit={currency?` ${currency}`:""} note={summary.currencies.length>1?t("multipleCurrencies"):t("costEstimateNote")}/><Metric tone="cyan" label={t("classifiedJourneys")} value={num(validateOwnershipMetadata(data.ownership).journeyLabels.length,locale,0)}/><Metric tone="violet" label={t("reminders")} value={num(validateOwnershipMetadata(data.ownership).reminders.filter((item)=>!item.completed).length,locale,0)}/></div><Panel title={t("tariffProfiles")} subtitle={t("tariffProfilesHelp")}><TariffManager ownership={data.ownership} onSave={onSaveOwnership} t={t}/>{summary.categories.length?<div className="cost-category-list">{summary.categories.map((item)=><span key={item.category}><b>{item.category==="unlabelled"?t("unlabelled"):t(`chargeCategory_${item.category}`)}</b><small>{item.sessions} {t("sessionsLower")} · {num(item.energyKwh,locale)} kWh</small><strong>{num(item.cost,locale,2)} {currency}</strong></span>)}</div>:null}</Panel><Panel title={t("reminders")} subtitle={t("remindersHelp")}><ReminderManager ownership={data.ownership} currentOdometer={currentOdometer} onSave={onSaveOwnership} locale={locale} t={t}/></Panel></div>;
}

function Report({ data, locale, t, minDate, maxDate, units, onSaveOwnership }) {
  const [startDate,setStartDate]=useState(minDate), [endDate,setEndDate]=useState(maxDate), [energyPrice,setEnergyPrice]=useState(""), [reference,setReference]=useState(""), [includeMaps,setIncludeMaps]=useState(false), [includeMonthly,setIncludeMonthly]=useState(true), [includeHighlights,setIncludeHighlights]=useState(true), [selectedCharts,setSelectedCharts]=useState([]), [exporting,setExporting]=useState(false), [exportError,setExportError]=useState(false);
  const ownership=useMemo(()=>ownershipMaps(data.ownership),[data.ownership]), tariff=ownership.activeTariff;
  const firstDate=startDate&&endDate&&startDate>endDate?endDate:startDate, lastDate=startDate&&endDate&&startDate>endDate?startDate:endDate;
  const range={start:firstDate,end:lastDate};
  const daily=safe(data.daily).filter((row)=>inPeriod(row.date,"custom",maxDate,range));
  const journeys=safe(data.journeys).filter((row)=>inPeriod(row.date,"custom",maxDate,range));
  const trips=safe(data.trips).filter((row)=>inPeriod(row.date,"custom",maxDate,range));
  const charges=safe(data.charges).filter((row)=>inPeriod(row.date,"custom",maxDate,range));
  const distance=sum(daily,"distanceKm"), netEnergy=sum(daily,"netEnergyKwh"), wallEnergy=sum(charges,"wallEnergyKwh"), batteryEnergy=sum(charges,"batteryEnergyKwh");
  const consumption=distance?netEnergy/distance*100:null, efficiency=wallEnergy?batteryEnergy/wallEnergy*100:null;
  const normalizedPrice=energyPrice.trim()?Number(energyPrice.replace(",",".")):(tariff?.pricePerKwh??null);
  const hasPrice=normalizedPrice!=null&&Number.isFinite(normalizedPrice)&&normalizedPrice>=0;
  const displayDistance=distanceValue(distance,units.system), displayDistanceUnit=distanceUnit(units.system), displayConsumption=consumptionValue(consumption,units.system), displayConsumptionUnit=consumptionUnit(units.system);
  const estimatedCost=hasPrice?wallEnergy*normalizedPrice:null, costPer100=hasPrice&&displayDistance?estimatedCost/displayDistance*100:null;
  const mostActiveDay=daily.reduce((best,row)=>Number(row.distanceKm)>Number(best?.distanceKm||0)?row:best,null), averageJourney=journeys.length?distance/journeys.length:null, longestJourney=journeys.reduce((best,row)=>Number(row.distanceKm)>Number(best?.distanceKm||0)?row:best,null);
  const usedEnergy=sum(trips,"energyUsedKwh"), regeneratedEnergy=sum(trips,"regeneratedKwh"), regenerationShare=usedEnergy+regeneratedEnergy?regeneratedEnergy/(usedEnergy+regeneratedEnergy)*100:null;
  const acEnergy=sum(charges.filter((row)=>row.chargeType==="AC"),"batteryEnergyKwh"), dcEnergy=sum(charges.filter((row)=>row.chargeType==="DC"),"batteryEnergyKwh");
  const mappedJourneys=journeys.filter((row)=>safe(row.gps?.segments).length);
  const hasRows=daily.length>0||charges.length>0;
  const exportPdf=async()=>{if(!hasRows||exporting)return;setExporting(true);setExportError(false);try{const {downloadReportPdf}=await import("./report-pdf.js");await downloadReportPdf({data,locale,t,startDate,endDate,energyPrice:hasPrice?normalizedPrice:null,currency:tariff?.currency||"EUR",reference,units,includeMaps,includeMonthly,includeHighlights,selectedChartIds:selectedCharts});}catch(error){console.error(error);setExportError(true);}finally{setExporting(false);}};
  return <div className="report-page">
    <Panel title={t("reportSettings")} subtitle={t("reportSettingsHelp")}>
      <div className="report-form">
        <label><span>{t("startDate")}</span><input type="date" min={minDate} max={maxDate} value={startDate} onChange={(event)=>setStartDate(event.currentTarget.value)}/></label>
        <label><span>{t("endDate")}</span><input type="date" min={minDate} max={maxDate} value={endDate} onChange={(event)=>setEndDate(event.currentTarget.value)}/></label>
        <label><span>{t("reportEnergyPrice")}</span><div className="input-with-unit"><input type="text" inputMode="decimal" placeholder={tariff?String(tariff.pricePerKwh):"0,20"} value={energyPrice} onChange={(event)=>setEnergyPrice(event.currentTarget.value)}/><small>{tariff?.currency||"EUR"}/kWh</small></div></label>
        <label><span>{t("reportReference")}</span><input type="text" maxLength="80" placeholder={t("reportReferencePlaceholder")} value={reference} onChange={(event)=>setReference(event.currentTarget.value)}/></label>
        <label className="report-map-option"><span>{t("includeRouteMaps")}</span><span className="report-checkbox"><input type="checkbox" checked={includeMaps} disabled={!mappedJourneys.length} onChange={(event)=>setIncludeMaps(event.currentTarget.checked)}/><small>{mappedJourneys.length?t("includeRouteMapsHelp"):t("noRouteMapsInPeriod")}</small></span></label>
        <button className="report-export" type="button" disabled={!hasRows||exporting||(energyPrice.trim()&&!hasPrice)} onClick={exportPdf}><Icon name="report"/><span><strong>{exporting?t("reportGenerating"):t("reportExportPdf")}</strong><small>{t("reportExportHelp")}</small></span></button>
      </div>
      <TariffManager ownership={data.ownership} onSave={onSaveOwnership} t={t}/>
      <div className="report-options"><label><input type="checkbox" checked={includeMonthly} onChange={(event)=>setIncludeMonthly(event.currentTarget.checked)}/><span><strong>{t("includeMonthlySummary")}</strong><small>{t("includeMonthlySummaryHelp")}</small></span></label><label><input type="checkbox" checked={includeHighlights} onChange={(event)=>setIncludeHighlights(event.currentTarget.checked)}/><span><strong>{t("includeLifetimeHighlights")}</strong><small>{t("includeLifetimeHighlightsHelp")}</small></span></label></div>
      {safe(data.customCharts).length?<div className="report-chart-picker"><strong>{t("includeMyCharts")}</strong><small>{t("includeMyChartsHelp")}</small><div>{safe(data.customCharts).map((chart)=><label key={chart.id}><input type="checkbox" checked={selectedCharts.includes(chart.id)} onChange={()=>setSelectedCharts((current)=>current.includes(chart.id)?current.filter((id)=>id!==chart.id):[...current,chart.id])}/><span>{chart.title||t("nav_mycharts")}</span></label>)}</div></div>:null}
      <div className="report-local-note"><strong>{t("privacyTitle")}</strong><span>{t("reportLocalHelp")}</span></div>
      {energyPrice.trim()&&!hasPrice?<div className="report-error">{t("reportInvalidPrice")}</div>:null}
      {exportError?<div className="report-error">{t("reportExportError")}</div>:null}
    </Panel>
    {!hasRows?<Empty t={t}/>:<>
      <div className="report-period"><span>{t("reportPreview")}</span><strong>{dateText(firstDate,locale)} — {dateText(lastDate,locale)}</strong><small>{[includeMonthly?t("automaticMonthlySummary"):null,includeHighlights?t("nav_highlights"):null,selectedCharts.length?`${selectedCharts.length} ${t("chartsLower")}`:null].filter(Boolean).join(" · ")}</small>{reference?<small>{reference}</small>:null}<button type="button" className="secondary-button" onClick={()=>downloadOwnershipCsv(data,{startDate:firstDate,endDate:lastDate})}>{t("exportCsvSummary")}</button></div>
      <div className="metric-grid report-metrics">
        <Metric tone="mint" label={t("distance")} value={num(displayDistance,locale)} unit={` ${displayDistanceUnit}`} note={`${journeys.length} ${t("journeysLower")}`} />
        <Metric tone="cyan" label={t("averageConsumption")} value={num(displayConsumption,locale)} unit={` ${displayConsumptionUnit}`} note={`${num(sum(daily,"drivingHours"),locale)} ${t("hourShort")}`} />
        <Metric tone="violet" label={t("charges")} value={num(charges.length,locale,0)} note={`${num(wallEnergy,locale)} kWh ${t("fromGrid")}`} />
        <Metric tone="amber" label={t("chargeEfficiency")} value={num(efficiency,locale)} unit="%" note={`${num(sum(charges,"lossKwh"),locale)} kWh ${t("losses").toLowerCase()}`} />
        <Metric label={t("reportEstimatedCost")} value={hasPrice?num(estimatedCost,locale,2):"—"} unit={hasPrice?` ${tariff?.currency||"EUR"}`:""} note={hasPrice?`${num(normalizedPrice,locale,2)} ${tariff?.currency||"EUR"}/kWh`:t("reportPriceNeeded")} />
        <Metric tone="coral" label={`${t("reportCostPer100")} ${displayDistanceUnit}`} value={hasPrice?num(costPer100,locale,2):"—"} unit={hasPrice?` ${tariff?.currency||"EUR"}`:""} note={`${trips.length} ${t("tripsLower")}`} />
      </div>
      <Panel title={t("reportInsights")} subtitle={t("reportInsightsHelp")}><div className="metric-grid report-insights"><Metric label={t("reportMostActiveDay")} value={mostActiveDay?dateText(mostActiveDay.date,locale):"—"} note={mostActiveDay?`${num(distanceValue(mostActiveDay.distanceKm,units.system),locale)} ${displayDistanceUnit}`:null}/><Metric label={t("reportAverageJourney")} value={num(distanceValue(averageJourney,units.system),locale)} unit={` ${displayDistanceUnit}`}/><Metric label={t("reportLongestJourney")} value={num(distanceValue(longestJourney?.distanceKm,units.system),locale)} unit={` ${displayDistanceUnit}`}/><Metric label={t("reportRegenerationShare")} value={num(regenerationShare,locale)} unit="%"/><Metric label={t("reportAcDcSplit")} value={`${num(acEnergy,locale)} / ${num(dcEnergy,locale)}`} unit=" kWh" note="AC / DC"/><Metric label={t("reportPeakChargingPower")} value={num(maximum(charges,"maxPowerKw"),locale)} unit=" kW"/></div></Panel>
      <div className="method-note"><strong>{t("reportEstimateTitle")}</strong><p>{t("reportDisclaimer")}</p></div>
      <div className="dashboard-grid two report-tables">
        <Panel title={t("reportDailyBreakdown")} subtitle={t("reportDailyBreakdownHelp")}><div className="report-mini-table"><div className="table-head"><span>{t("date")}</span><span>{t("distance")}</span><span>{t("consumption")}</span><span>{t("gridEnergy")}</span></div>{daily.slice(-14).reverse().map((row)=><div key={row.date}><strong>{dateText(row.date,locale)}</strong><span>{num(distanceValue(row.distanceKm,units.system),locale)} {displayDistanceUnit}</span><span>{num(consumptionValue(row.consumptionKwh100,units.system),locale)} {displayConsumptionUnit}</span><span>{num(row.wallEnergyKwh,locale)} kWh</span></div>)}</div></Panel>
        <Panel title={t("reportChargingDetails")} subtitle={t("reportChargingDetailsHelp")}><div className="report-mini-table"><div className="table-head"><span>{t("date")}</span><span>{t("chargeType")}</span><span>{t("batteryEnergy")}</span><span>{t("gridEnergy")}</span></div>{charges.slice(-14).reverse().map((row)=><div key={row.chargeId}><strong>{dateText(row.startedAtUtc,locale)}</strong><span>{row.chargeType||"—"}</span><span>{num(row.batteryEnergyKwh,locale)} kWh</span><span>{num(row.wallEnergyKwh,locale)} kWh</span></div>)}</div></Panel>
      </div>
    </>}
  </div>;
}

const anomalyTargets={consumption:"activity",parkedLoss:"battery",chargingEfficiency:"charging",batteryTemperature:"battery",tyrePressure:"tyres",tyreImbalance:"tyres"};
function anomalyMeasurement(event,locale,units){
  let value=event.value,baseline=event.baseline,unit="",digits=1;
  if(event.metric==="consumption"){value=consumptionValue(value,units.system);baseline=consumptionValue(baseline,units.system);unit=consumptionUnit(units.system);}
  else if(event.metric==="batteryTemperature"){value=temperatureValue(value,units.system);baseline=temperatureValue(baseline,units.system);unit=temperatureUnit(units.system);}
  else if(event.metric==="tyrePressure"||event.metric==="tyreImbalance"){value=pressureValue(value,units.pressure);baseline=pressureValue(baseline,units.pressure);unit=pressureUnitLabel(units.pressure);digits=units.pressure==="bar"?2:1;}
  else if(event.metric==="parkedLoss"){unit="%/day";digits=2;}
  else if(event.metric==="chargingEfficiency")unit="%";
  return {value:num(value,locale,digits),baseline:num(baseline,locale,digits),unit};
}

function MonthlySummary({data,locale,t,units}){
  const summaries=useMemo(()=>buildMonthlySummaries(data),[data]);
  const latestMonth=summaries.at(-1)?.month||"";
  const [selectedMonth,setSelectedMonth]=useState(latestMonth);
  useEffect(()=>{if(!summaries.some((row)=>row.month===selectedMonth))setSelectedMonth(latestMonth);},[latestMonth,selectedMonth,summaries]);
  const summary=summaries.find((row)=>row.month===selectedMonth)||summaries.at(-1);
  if(!summary)return null;
  const ownership=ownershipMaps(data.ownership),monthCost=ownership.activeTariff?Number(summary.wallEnergyKwh||0)*ownership.activeTariff.pricePerKwh:null;
  const monthName=(month)=>new Intl.DateTimeFormat(locale,{month:"long",year:"numeric",timeZone:"UTC"}).format(new Date(`${month}-01T12:00:00Z`));
  const distanceDisplay=distanceValue(summary.distanceKm,units.system),distanceLabel=distanceUnit(units.system);
  const consumptionDisplay=consumptionValue(summary.consumptionKwh100,units.system),consumptionLabel=consumptionUnit(units.system);
  const gpsNote=summary.journeys?`${summary.gpsJourneys}/${summary.journeys} ${t("journeysLower")}`:t("noJourneysThisMonth");
  const monthDaily=safe(data.daily).filter((row)=>String(row.date).startsWith(summary.month)).map((row)=>({...row,label:String(row.date).slice(8),distanceDisplay:distanceValue(row.distanceKm,units.system),consumptionDisplay:consumptionValue(row.consumptionKwh100,units.system)}));
  const chargeDays=new Map();safe(data.charges).filter((row)=>String(row.date||row.startedAtUtc).startsWith(summary.month)).forEach((row)=>{const date=String(row.date||row.startedAtUtc).slice(0,10),current=chargeDays.get(date)||{date,label:date.slice(8),AC:0,DC:0};const type=row.chargeType==="DC"?"DC":"AC";current[type]+=Number(row.batteryEnergyKwh)||0;chargeDays.set(date,current);});
  const monthCharges=[...chargeDays.values()].sort((a,b)=>a.date.localeCompare(b.date));
  const shareCard={kind:t("automaticMonthlySummary"),title:monthName(summary.month),subtitle:t("monthlyCardSubtitle"),fileName:"monthly-summary",metrics:[{label:t("distance"),value:`${num(distanceDisplay,locale)} ${distanceLabel}`,note:`${summary.journeys} ${t("journeysLower")}`},{label:t("averageConsumption"),value:`${num(consumptionDisplay,locale)} ${consumptionLabel}`},{label:t("gridEnergy"),value:`${num(summary.wallEnergyKwh,locale)} kWh`,note:`${summary.charges} ${t("sessionsLower")}`},{label:t("regeneratedEnergy"),value:`${num(summary.regeneratedKwh,locale)} kWh`},{label:t("gpsCoverage"),value:`${num(summary.gpsCoveragePct,locale,0)}%`,note:gpsNote},{label:t("chargeEfficiency"),value:`${num(summary.chargingEfficiencyPct,locale)}%`}],note:t("shareCardPrivacyNote")};
  return <section className="monthly-summary"><Panel title={t("automaticMonthlySummary")} subtitle={t("automaticMonthlySummaryHelp")} action={<div className="insight-panel-actions"><label className="monthly-summary-picker"><span className="sr-only">{t("selectMonth")}</span><select value={summary.month} onChange={(event)=>setSelectedMonth(event.currentTarget.value)}>{summaries.slice().reverse().map((row)=><option key={row.month} value={row.month}>{monthName(row.month)}</option>)}</select></label><ShareInsightButton card={shareCard} t={t}/></div>}>
    <div className="monthly-summary-period"><strong>{monthName(summary.month)}</strong><span>{summary.observedDays} {t("observedDaysLower")}</span></div>
    <div className="metric-grid monthly-summary-metrics"><Metric tone="mint" label={t("distance")} value={num(distanceDisplay,locale)} unit={` ${distanceLabel}`} note={`${summary.journeys} ${t("journeysLower")}`}/><Metric tone="cyan" label={t("averageConsumption")} value={num(consumptionDisplay,locale)} unit={` ${consumptionLabel}`}/><Metric tone="violet" label={t("gridEnergy")} value={num(summary.wallEnergyKwh,locale)} unit=" kWh" note={`${summary.charges} ${t("sessionsLower")}`}/><Metric tone="amber" label={t("regeneratedEnergy")} value={num(summary.regeneratedKwh,locale)} unit=" kWh"/><Metric tone="coral" label={t("gpsCoverage")} value={num(summary.gpsCoveragePct,locale,0)} unit="%" note={gpsNote}/><Metric label={t("parkedUse")} value={num(summary.parkedEnergyKwh,locale)} unit=" kWh" note={summary.parkedLossPctPerDay!=null?`${num(summary.parkedLossPctPerDay,locale,2)}%/${t("dayLower")}`:t("insufficientSamples")}/><Metric label={t("estimatedChargingCost")} value={monthCost==null?"—":num(monthCost,locale,2)} unit={monthCost==null?"":` ${ownership.activeTariff.currency}`} note={ownership.activeTariff?.name||t("reportPriceNeeded")}/></div>
    <div className="monthly-summary-charts"><div><strong>{t("monthlyDailyMovement")}</strong>{monthDaily.length?<Chart height={190}><ComposedChart data={monthDaily} margin={{top:12,right:12,left:-12}}><CartesianGrid stroke="var(--grid)" vertical={false}/><XAxis dataKey="label" tick={{fill:"var(--muted)",fontSize:8}}/><YAxis yAxisId="distance" tick={{fill:"var(--muted)",fontSize:9}}/><YAxis yAxisId="consumption" orientation="right" tick={{fill:"var(--muted)",fontSize:9}}/><Tip locale={locale}/><Bar yAxisId="distance" dataKey="distanceDisplay" name={`${t("distance")} (${distanceLabel})`} fill={C.mint}/><Line yAxisId="consumption" dataKey="consumptionDisplay" name={consumptionLabel} stroke={C.coral} dot={false}/></ComposedChart></Chart>:<ChartEmpty t={t}/>}</div><div><strong>{t("monthlyChargingMix")}</strong>{monthCharges.length?<Chart height={190}><BarChart data={monthCharges} margin={{top:12,right:12,left:-12}}><CartesianGrid stroke="var(--grid)" vertical={false}/><XAxis dataKey="label" tick={{fill:"var(--muted)",fontSize:8}}/><YAxis tick={{fill:"var(--muted)",fontSize:9}}/><Tip locale={locale} suffix=" kWh"/><Legend wrapperStyle={{fontSize:9}}/><Bar dataKey="AC" stackId="charge" fill={C.cyan}/><Bar dataKey="DC" stackId="charge" fill={C.violet}/></BarChart></Chart>:<ChartEmpty t={t}/>}</div></div>
    <div className="monthly-summary-details"><span><small>{t("chargeEfficiency")}</small><strong>{num(summary.chargingEfficiencyPct,locale)}%</strong></span><span><small>{t("estimatedCapacity")}</small><strong>{num(summary.estimatedCapacityKwh,locale)} kWh</strong><em>{summary.sampleCounts.health} {t("eligibleSessionsLower")}</em></span><span><small>{t("relativeSoh")}</small><strong>{num(summary.relativeSohPct,locale)}%</strong></span><span><small>{t("monthlyBatteryTemperature")}</small><strong>{num(temperatureValue(summary.batteryTemperatureMaxC,units.system),locale)}°{temperatureUnit(units.system)}</strong><em>{summary.sampleCounts.batteryDays} {t("observedDaysLower")}</em></span></div>
    <div className={`monthly-comparison ${summary.comparison.comparable?"is-comparable":"is-limited"}`}><div><strong>{t("comparedWithPreviousMonth")}</strong><span>{summary.previousMonth?monthName(summary.previousMonth):t("noPreviousMonth")}</span></div>{summary.comparison.comparable?(summary.comparison.changes.length?<div className="monthly-change-list">{summary.comparison.changes.map((change)=><span key={change.metric} className={change.value>0?"is-up":"is-down"}><b>{change.value>0?"↑":"↓"} {num(Math.abs(change.value),locale,0)}%</b> {t(`monthlyChange_${change.metric}`)}</span>)}</div>:<p>{t("monthlyNoNotableChanges")}</p>):<p>{t("monthlyComparisonLimited")}</p>}</div>
  </Panel></section>;
}

function SeasonalComparison({data,locale,t,units}){
  const periods=useMemo(()=>buildSeasonalPeriods(data),[data]);
  const latest=periods.at(-1)?.key||"",previous=periods.at(-2)?.key||"";
  const [firstKey,setFirstKey]=useState(latest),[secondKey,setSecondKey]=useState(previous);
  useEffect(()=>{if(!periods.some((row)=>row.key===firstKey))setFirstKey(latest);if(!periods.some((row)=>row.key===secondKey))setSecondKey(periods.find((row)=>row.key!==latest)?.key||"");},[firstKey,latest,periods,secondKey]);
  const first=periods.find((row)=>row.key===firstKey),second=periods.find((row)=>row.key===secondKey),comparison=compareSeasonalPeriods(first,second);
  const label=(row)=>row?`${t(`season_${row.season}`)} ${row.year}`:"—";
  const option=(row)=><option key={row.key} value={row.key}>{label(row)}</option>;
  const metric=(name,firstValue,secondValue,unit,delta)=><div className="seasonal-metric"><small>{name}</small><div><span><em>{label(first)}</em><strong>{num(firstValue,locale)}{unit}</strong></span><i aria-hidden="true">↔</i><span><em>{label(second)}</em><strong>{num(secondValue,locale)}{unit}</strong></span></div>{comparison.comparable&&delta!=null?<b className={delta>0?"is-up":delta<0?"is-down":""}>{delta>0?"↑":delta<0?"↓":""} {num(Math.abs(delta),locale,0)}{name===t("monthlyBatteryTemperature")?`°${temperatureUnit(units.system)}`:"%"}</b>:null}</div>;
  if(periods.length<2)return <section className="seasonal-comparison"><Panel title={t("seasonalComparison")} subtitle={t("seasonalComparisonHelp")}><div className="seasonal-empty"><strong>{t("seasonalNeedsMoreHistory")}</strong><p>{t("seasonalNeedsMoreHistoryHelp")}</p>{periods.length?<span>{label(periods[0])} · {periods[0].observedDays} {t("observedDaysLower")} · {num(distanceValue(periods[0].distanceKm,units.system),locale)} {distanceUnit(units.system)}</span>:null}</div></Panel></section>;
  const firstDistance=first?.observedDays?distanceValue(first.distanceKm/first.observedDays,units.system):null,secondDistance=second?.observedDays?distanceValue(second.distanceKm/second.observedDays,units.system):null;
  const firstRegen=first?.distanceKm?first.regeneratedKwh/first.distanceKm*100:null,secondRegen=second?.distanceKm?second.regeneratedKwh/second.distanceKm*100:null;
  const shareCard={kind:t("seasonalComparison"),title:`${label(first)} ${t("versus")} ${label(second)}`,subtitle:t("seasonalCardSubtitle"),fileName:"seasonal-comparison",metrics:[{label:t("dailyDistance"),value:`${num(firstDistance,locale)} / ${num(secondDistance,locale)} ${distanceUnit(units.system)}`},{label:t("averageConsumption"),value:`${num(consumptionValue(first?.consumptionKwh100,units.system),locale)} / ${num(consumptionValue(second?.consumptionKwh100,units.system),locale)} ${consumptionUnit(units.system)}`},{label:t("regenerationPer100"),value:`${num(firstRegen,locale)} / ${num(secondRegen,locale)} kWh`},{label:t("monthlyBatteryTemperature"),value:`${num(temperatureValue(first?.temperatureC,units.system),locale)} / ${num(temperatureValue(second?.temperatureC,units.system),locale)} °${temperatureUnit(units.system)}`}],note:t("shareCardPrivacyNote")};
  return <section className="seasonal-comparison"><Panel title={t("seasonalComparison")} subtitle={t("seasonalComparisonHelp")} action={<div className="insight-panel-actions"><span className={`confidence confidence-${comparison.strength}`}>{t("comparisonStrength")}: {t(`confidence_${comparison.strength}`)}</span><ShareInsightButton card={shareCard} t={t}/></div>}>
    <div className="seasonal-selectors"><label><span>{t("periodA")}</span><select value={first?.key||""} onChange={(event)=>setFirstKey(event.currentTarget.value)}>{periods.map(option)}</select></label><b>{t("versus")}</b><label><span>{t("periodB")}</span><select value={second?.key||""} onChange={(event)=>setSecondKey(event.currentTarget.value)}>{periods.map(option)}</select></label></div>
    <div className="seasonal-samples"><span><strong>{label(first)}</strong><small>{first?.observedDays||0} {t("observedDaysLower")} · {first?.journeys||0} {t("journeysLower")} · {num(distanceValue(first?.distanceKm,units.system),locale)} {distanceUnit(units.system)}</small></span><span><strong>{label(second)}</strong><small>{second?.observedDays||0} {t("observedDaysLower")} · {second?.journeys||0} {t("journeysLower")} · {num(distanceValue(second?.distanceKm,units.system),locale)} {distanceUnit(units.system)}</small></span></div>
    {!comparison.comparable?<div className="seasonal-warning"><strong>{t("seasonalInsufficientComparison")}</strong><p>{t("seasonalInsufficientComparisonHelp")}</p></div>:null}
    <div className="seasonal-metric-grid">{metric(t("dailyDistance"),firstDistance,secondDistance,` ${distanceUnit(units.system)}`,comparison.deltas?.distancePerDay)}{metric(t("averageConsumption"),consumptionValue(first?.consumptionKwh100,units.system),consumptionValue(second?.consumptionKwh100,units.system),` ${consumptionUnit(units.system)}`,comparison.deltas?.consumption)}{metric(t("regenerationPer100"),firstRegen,secondRegen," kWh/100 km",comparison.deltas?.regeneration)}{metric(t("monthlyBatteryTemperature"),temperatureValue(first?.temperatureC,units.system),temperatureValue(second?.temperatureC,units.system),`°${temperatureUnit(units.system)}`,comparison.deltas?.temperature)}</div>
    <div className="seasonal-context"><header><strong>{t("drivingContextMix")}</strong><span>{t("drivingContextMixHelp")}</span></header>{["urban","road","motorway"].map((context)=><div key={context}><b>{t(`context_${context}`)}</b><span><i style={{width:`${Math.max(0,Math.min(100,first?.contexts?.[context]||0))}%`}}/></span><em>{num(first?.contexts?.[context],locale,0)}%</em><span><i style={{width:`${Math.max(0,Math.min(100,second?.contexts?.[context]||0))}%`}}/></span><em>{num(second?.contexts?.[context],locale,0)}%</em></div>)}</div>
    <div className="seasonal-note">{t("seasonalMethodNote")}</div>
  </Panel></section>;
}

function OwnershipInsights({data,locale,t,period,maxDate,customRange,units}){
  const maps=useMemo(()=>ownershipMaps(data.ownership),[data.ownership]),[filter,setFilter]=useState("all");
  const journeys=safe(data.journeys).filter((row)=>inPeriod(row.date,period,maxDate,customRange)&&(filter==="all"||maps.journeys.get(row.journeyId)?.kind===filter));
  const charges=safe(data.charges).filter((row)=>inPeriod(row.date,period,maxDate,customRange));
  const distance=sum(journeys,"distanceKm"),cost=charges.reduce((total,row)=>total+(chargeCostBreakdown(row,data.ownership).cost||0),0);
  const business=sum(journeys.filter((row)=>maps.journeys.get(row.journeyId)?.kind==="business"),"distanceKm"),personal=sum(journeys.filter((row)=>maps.journeys.get(row.journeyId)?.kind==="personal"),"distanceKm");
  if(!maps.ownership.journeyLabels.length&&!maps.ownership.chargeCategories.length&&!maps.activeTariff)return null;
  return <Panel title={t("ownershipInsights")} subtitle={t("ownershipInsightsHelp")} action={<div className="classification-filters">{["all",...JOURNEY_LABELS].map((item)=><button type="button" key={item} className={filter===item?"is-active":""} onClick={()=>setFilter(item)}>{item==="all"?t("allData"):t(`journeyKind_${item}`)}</button>)}</div>}><div className="metric-grid"><Metric tone="mint" label={t("filteredDistance")} value={num(distanceValue(distance,units.system),locale)} unit={` ${distanceUnit(units.system)}`} note={`${journeys.length} ${t("journeysLower")}`}/><Metric tone="cyan" label={t("businessDistance")} value={num(distanceValue(business,units.system),locale)} unit={` ${distanceUnit(units.system)}`}/><Metric tone="violet" label={t("personalDistance")} value={num(distanceValue(personal,units.system),locale)} unit={` ${distanceUnit(units.system)}`}/><Metric tone="amber" label={t("estimatedChargingCost")} value={maps.activeTariff?num(cost,locale,2):"—"} unit={maps.activeTariff?` ${maps.activeTariff.currency}`:""} note={maps.activeTariff?.name||t("reportPriceNeeded")}/></div></Panel>;
}

function Insights({data,locale,t,period,maxDate,customRange,units,onOpenDetails}){
  const [dismissed,setDismissed]=useState(()=>readDismissed("insights"));
  const result=useMemo(()=>detectPersonalAnomalies(data),[data]);
  const anomalies=result.anomalies.filter((row)=>inPeriod(row.date,period,maxDate,customRange));
  const activeAnomalies=anomalies.filter((row)=>!dismissed.has(insightObservationId(row)));
  const visible=[] , counts=new Map();
  for(const anomaly of activeAnomalies){const count=counts.get(anomaly.metric)||0;if(count>=3)continue;counts.set(anomaly.metric,count+1);visible.push(anomaly);if(visible.length>=12)break;}
  const categoryCount=new Set(activeAnomalies.map((row)=>row.metric)).size,readyCount=Object.values(result.coverage).filter((row)=>row.ready).length;
  const dismiss=(event)=>setDismissed(dismissObservation("insights",insightObservationId(event)));
  const restore=()=>setDismissed(restoreObservations("insights"));
  return <>
    <div className="insights-intro"><div><span>{t("personalBaseline")}</span><strong>{t("anomalyTitle")}</strong><p>{t("anomalyIntro")}</p></div><i>{t("softwareObservation")}</i></div>
    <MonthlySummary data={data} locale={locale} t={t} units={units}/>
    <OwnershipInsights data={data} locale={locale} t={t} period={period} maxDate={maxDate} customRange={customRange} units={units}/>
    <SeasonalComparison data={data} locale={locale} t={t} units={units}/>
    <div className="metric-grid insights-metrics"><Metric tone="coral" label={t("unusualObservations")} value={num(activeAnomalies.length,locale,0)} note={t("selectedPeriod")}/><Metric tone="amber" label={t("affectedCategories")} value={num(categoryCount,locale,0)} note={`${Object.keys(result.coverage).length} ${t("categoriesChecked")}`}/><Metric tone="mint" label={t("baselinesReady")} value={`${readyCount}/${Object.keys(result.coverage).length}`} note={t("personalHistoryOnly")}/><Metric tone="cyan" label={t("latestObservation")} value={activeAnomalies[0]?dateText(`${activeAnomalies[0].date}T12:00:00Z`,locale):"—"} note={activeAnomalies.length?t("outsidePersonalPattern"):t("noneInPeriod")}/></div>
    <Panel title={t("baselineCoverage")} subtitle={t("baselineCoverageHelp")}><div className="baseline-coverage">{Object.entries(result.coverage).map(([metric,row])=><span key={metric} className={row.ready?"is-ready":"is-building"}><i/><b>{t(`anomalyMetric_${metric}`)}</b><small>{row.ready?t("baselineReady"):t("baselineBuilding")} · {row.eligible}/{row.minimum+1} {t("observationsLower")}</small></span>)}</div></Panel>
    <Panel title={t("unusualObservations")} subtitle={t("anomalyListHelp")} action={dismissed.size?<button className="restore-observations" type="button" onClick={restore}>{t("showDismissed")}</button>:null}>
      {visible.length?<div className="anomaly-grid">{visible.map((event)=>{const measurement=anomalyMeasurement(event,locale,units),target=anomalyTargets[event.metric],shareCard={kind:t("personalBaseline"),title:t(`anomalyMetric_${event.metric}`),subtitle:t(`anomalyDirection_${event.direction}`),fileName:"personal-insight",metrics:[{label:t("observed"),value:`${measurement.value} ${measurement.unit}`},{label:t("usualForVehicle"),value:`${measurement.baseline} ${measurement.unit}`},{label:t("comparisonStrength"),value:t(`confidence_${event.comparisonStrength}`),note:`${event.comparisonSamples} ${t("previousObservations")}`}],note:t("shareCardAnomalyNote")};return <article key={event.id} className={`anomaly-card strength-${event.comparisonStrength}`}><header><span><i/>{t(`anomalyMetric_${event.metric}`)}{event.group!=="all"?` · ${event.group}`:""}</span><time>{dateText(`${event.date}T12:00:00Z`,locale)}</time></header><strong>{t(`anomalyDirection_${event.direction}`)}</strong><div className="anomaly-values"><span><small>{t("observed")}</small><b>{measurement.value} {measurement.unit}</b></span><span><small>{t("usualForVehicle")}</small><b>{measurement.baseline} {measurement.unit}</b></span></div><p>{t("anomalyComparison")} {event.comparisonSamples} {t("previousObservations")}</p><footer><span className={`confidence confidence-${event.comparisonStrength}`}>{t("comparisonStrength")}: {t(`confidence_${event.comparisonStrength}`)}</span><div className="anomaly-actions"><ShareInsightButton card={shareCard} t={t}/><button type="button" onClick={()=>onOpenDetails(target,event)}>{t("viewDetails")} →</button><button className="observation-ok" type="button" onClick={()=>dismiss(event)}>{t("observationOk")}</button></div></footer></article>;})}</div>:<div className="anomaly-empty"><strong>{readyCount?t("noAnomaliesTitle"):t("baselinesNotReadyTitle")}</strong><p>{dismissed.size?t("allObservationsDismissed"):readyCount?t("noAnomaliesHelp"):t("baselinesNotReadyHelp")}</p></div>}
    </Panel>
    <div className="method-note"><strong>{t("anomalyDisclaimerTitle")}</strong><p>{t("anomalyDisclaimer")}</p></div>
  </>;
}

const coverageMonthKey = (date) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2,"0")}`;
const coverageMonthDate = (value) => new Date(`${value}-01T12:00:00Z`);
const shiftCoverageMonth = (value, amount) => { const date=coverageMonthDate(value);date.setUTCMonth(date.getUTCMonth()+amount);return coverageMonthKey(date); };

function CoverageMonth({ month, calendar, locale, t }) {
  const first=coverageMonthDate(month), year=first.getUTCFullYear(), monthIndex=first.getUTCMonth(), offset=(first.getUTCDay()+6)%7;
  const dayCount=new Date(Date.UTC(year,monthIndex+1,0)).getUTCDate();
  const formatter=new Intl.DateTimeFormat(locale,{month:"long",year:"numeric",timeZone:"UTC"});
  const weekdayFormatter=new Intl.DateTimeFormat(locale,{weekday:"narrow",timeZone:"UTC"});
  const weekdays=Array.from({length:7},(_,index)=>weekdayFormatter.format(new Date(Date.UTC(2024,0,index+1))));
  const cells=[...Array(offset).fill(null),...Array.from({length:dayCount},(_,index)=>index+1)];
  const types=["journeys","charges","parking","tyres","gps"];
  return <section className="coverage-month"><h4>{formatter.format(first)}</h4><div className="coverage-weekdays">{weekdays.map((day,index)=><span key={`${day}-${index}`}>{day}</span>)}</div><div className="coverage-days">{cells.map((day,index)=>{
    if(!day)return <span key={`blank-${index}`} className="is-blank"/>;
    const date=`${month}-${String(day).padStart(2,"0")}`,row=calendar.days.get(date),withinRange=(!calendar.firstDate||date>=calendar.firstDate)&&(!calendar.lastDate||date<=calendar.lastDate);
    const observed=types.filter((type)=>Number(row?.[type])>0);
    const details=observed.map((type)=>`${t(`coverageType_${type}`)}: ${row[type]}`).join(" · ");
    const label=`${dateText(`${date}T12:00:00Z`,locale)} — ${details||t(withinRange?"coverageNoSummary":"coverageOutsideRange")}`;
    return <div key={date} className={`coverage-day ${withinRange?"is-in-range":"is-outside-range"} ${observed.length?"has-observations":""}`} tabIndex={observed.length?0:undefined} aria-label={label} title={label}><b>{day}</b>{observed.length?<span>{observed.map((type)=><i key={type} className={`type-${type}`} aria-hidden="true"/>)}</span>:null}</div>;
  })}</div></section>;
}

function CoverageCalendar({ data, locale, t }) {
  const calendar=useMemo(()=>buildCoverageCalendar(data),[data]),summary=useMemo(()=>coverageCalendarSummary(calendar),[calendar]);
  const latestMonth=(calendar.lastDate||new Date().toISOString().slice(0,10)).slice(0,7),earliestMonth=(calendar.firstDate||latestMonth).slice(0,7);
  const [endMonth,setEndMonth]=useState(latestMonth);
  useEffect(()=>setEndMonth(latestMonth),[latestMonth]);
  const months=[shiftCoverageMonth(endMonth,-2),shiftCoverageMonth(endMonth,-1),endMonth];
  return <Panel title={t("coverageCalendarTitle")} subtitle={t("coverageCalendarHelp")} action={<div className="coverage-calendar-nav"><button type="button" disabled={months[0]<=earliestMonth} onClick={()=>setEndMonth((current)=>shiftCoverageMonth(current,-1))} aria-label={t("coveragePreviousMonths")}>←</button><button type="button" disabled={endMonth>=latestMonth} onClick={()=>setEndMonth((current)=>shiftCoverageMonth(current,1))} aria-label={t("coverageNextMonths")}>→</button></div>}>
    <div className="coverage-calendar-summary"><span><strong>{summary.observedDays}</strong>{t("coverageObservedDays")}</span><span><strong>{summary.journeyDays}</strong>{t("coverageJourneyDays")}</span><span><strong>{summary.chargingDays}</strong>{t("coverageChargingDays")}</span><span><strong>{summary.gpsDays}</strong>{t("coverageGpsDays")}</span></div>
    <div className="coverage-calendar-grid">{months.map((month)=><CoverageMonth key={month} month={month} calendar={calendar} locale={locale} t={t}/>)}</div>
    <div className="coverage-calendar-legend">{["journeys","charges","parking","tyres","gps"].map((type)=><span key={type}><i className={`type-${type}`}/>{t(`coverageType_${type}`)}</span>)}</div>
    <p className="coverage-calendar-note">{t("coverageCalendarNote")}</p>
  </Panel>;
}

function PeriodComparison({data,locale,t,minDate,maxDate,units}){
  const defaults=useMemo(()=>comparisonDefaults(minDate,maxDate),[maxDate,minDate]);
  const [first,setFirst]=useState(defaults.a),[second,setSecond]=useState(defaults.b);
  useEffect(()=>{setFirst(defaults.a);setSecond(defaults.b);},[defaults]);
  const model=useMemo(()=>comparePeriods(data,first,second),[data,first,second]);
  const metricRows=[
    ["distanceKm","distance",(value)=>distanceValue(value,units.system),distanceUnit(units.system),0],
    ["journeys","journeys",Number,"",0],
    ["drivingHours","drivingTime",Number," h",1],
    ["consumptionKwh100","averageConsumption",(value)=>consumptionValue(value,units.system),consumptionUnit(units.system),1],
    ["regeneratedKwh","regeneratedEnergy",Number," kWh",1],
    ["wallEnergyKwh","gridEnergy",Number," kWh",1],
    ["chargingEfficiencyPct","chargeEfficiency",Number,"%",1],
    ["parkedLossPctPerDay","parkedLossPerDay",Number,"%/day",2],
  ];
  const update=(setter,field)=>(event)=>setter((current)=>({...current,[field]:event.currentTarget.value}));
  const chart=model.timeline.map((row)=>({...row,distanceA:distanceValue(row.distanceA,units.system),distanceB:distanceValue(row.distanceB,units.system),consumptionA:consumptionValue(row.consumptionA,units.system),consumptionB:consumptionValue(row.consumptionB,units.system)}));
  return <>
    <Panel title={t("periodComparison")} subtitle={t("periodComparisonHelp")}><div className="comparison-periods"><fieldset><legend>{t("comparisonA")}</legend><label>{t("startDate")}<input type="date" min={minDate} max={maxDate} value={first.start} onChange={update(setFirst,"start")}/></label><label>{t("endDate")}<input type="date" min={minDate} max={maxDate} value={first.end} onChange={update(setFirst,"end")}/></label></fieldset><fieldset><legend>{t("comparisonB")}</legend><label>{t("startDate")}<input type="date" min={minDate} max={maxDate} value={second.start} onChange={update(setSecond,"start")}/></label><label>{t("endDate")}<input type="date" min={minDate} max={maxDate} value={second.end} onChange={update(setSecond,"end")}/></label></fieldset></div></Panel>
    <div className="comparison-table"><div className="comparison-table-head"><span>{t("metric")}</span><span>{t("comparisonA")}</span><span>{t("comparisonB")}</span><span>{t("change")}</span></div>{metricRows.map(([key,label,convert,unit,digits])=>{const change=model.differences[key],valueA=model.a[key]==null?null:convert(model.a[key]),valueB=model.b[key]==null?null:convert(model.b[key]);return <div key={key}><strong>{t(label)}</strong><span>{num(valueA,locale,digits)}{valueA==null?"":unit}</span><span>{num(valueB,locale,digits)}{valueB==null?"":unit}</span><span className={change>0?"change-up":change<0?"change-down":""}>{change==null?"—":`${change>0?"+":""}${num(change,locale,1)}%`}</span></div>;})}</div>
    <div className="dashboard-grid two"><Panel title={t("dailyDistanceComparison")} subtitle={t("relativeDayHelp")}><Chart><LineChart data={chart} margin={{top:12,right:12,left:-12}}><CartesianGrid stroke="var(--grid)" vertical={false}/><XAxis dataKey="day" tick={{fill:"var(--muted)",fontSize:9}}/><YAxis unit={` ${distanceUnit(units.system)}`} tick={{fill:"var(--muted)",fontSize:10}}/><Tip locale={locale} suffix={` ${distanceUnit(units.system)}`}/><Legend wrapperStyle={{fontSize:11}}/><Line dataKey="distanceA" name={t("comparisonA")} stroke={C.cyan} dot={false}/><Line dataKey="distanceB" name={t("comparisonB")} stroke={C.violet} dot={false}/></LineChart></Chart></Panel><Panel title={t("dailyConsumptionComparison")} subtitle={t("relativeDayHelp")}><Chart><LineChart data={chart} margin={{top:12,right:12,left:-12}}><CartesianGrid stroke="var(--grid)" vertical={false}/><XAxis dataKey="day" tick={{fill:"var(--muted)",fontSize:9}}/><YAxis tick={{fill:"var(--muted)",fontSize:10}}/><Tip locale={locale} suffix={` ${consumptionUnit(units.system)}`}/><Legend wrapperStyle={{fontSize:11}}/><Line dataKey="consumptionA" name={t("comparisonA")} stroke={C.amber} dot={false}/><Line dataKey="consumptionB" name={t("comparisonB")} stroke={C.mint} dot={false}/></LineChart></Chart></Panel></div>
    <p className="analysis-disclaimer">{t("comparisonDisclaimer")}</p>
  </>;
}

function LifetimeHighlights({data,locale,t,units,onClose}){
  const highlights=useMemo(()=>buildLifetimeHighlights(data),[data]);
  const [exporting,setExporting]=useState(false);
  useEffect(()=>{const previous=document.body.style.overflow;document.body.style.overflow="hidden";const close=(event)=>{if(event.key==="Escape")onClose();};document.addEventListener("keydown",close);return()=>{document.body.style.overflow=previous;document.removeEventListener("keydown",close);};},[onClose]);
  const distanceLabel=distanceUnit(units.system),speedLabel=speedUnit(units.system),dateNote=(row)=>row?.startedAtUtc?dateText(row.startedAtUtc,locale):row?.date?dateText(`${row.date}T12:00:00Z`,locale):null;
  const powerKw=Number(highlights.power?.peakDrivePowerKw),powerHp=Number.isFinite(powerKw)?powerKw*1.34102:null;
  const metrics=[
    {key:"speed",label:t("highlightTopSpeed"),value:`${num(speedValue(highlights.fastest?.maxSpeedKmh,units.system),locale)} ${speedLabel}`,note:dateNote(highlights.fastest)},
    {key:"power",label:t("highlightPeakPower"),value:`${num(powerKw,locale)} kW`,note:powerHp!=null?`${num(powerHp,locale,0)} hp · ${dateNote(highlights.power)||""}`:null},
    {key:"distance",label:t("highlightLongestDistance"),value:`${num(distanceValue(highlights.distance?.distanceKm,units.system),locale)} ${distanceLabel}`,note:dateNote(highlights.distance)},
    {key:"duration",label:t("highlightLongestTime"),value:duration(highlights.duration?.durationMinutes,t),note:dateNote(highlights.duration)},
    {key:"sprint",label:t("highlightZeroToHundred"),value:highlights.sprint?`${num(highlights.sprint.zeroToHundredSeconds,locale,2)} s`:t("notObserved"),note:highlights.sprint?dateNote(highlights.sprint):t("zeroToHundredHelp")},
    {key:"acceleration",label:t("highlightAcceleration"),value:`${num(highlights.acceleration?.maxAccelerationG,locale,2)} g`,note:dateNote(highlights.acceleration)},
    {key:"braking",label:t("highlightBraking"),value:`${num(highlights.braking?.maxBrakingG,locale,2)} g`,note:dateNote(highlights.braking)},
    {key:"cornering",label:t("highlightCornering"),value:`${num(highlights.cornering?.maxLateralG,locale,2)} g`,note:dateNote(highlights.cornering)},
    {key:"charging",label:t("highlightChargingPower"),value:`${num(highlights.charge?.maxPowerKw,locale)} kW`,note:dateNote(highlights.charge)},
    {key:"regeneration",label:t("highlightRegenerated"),value:`${num(highlights.totalRegeneratedKwh,locale)} kWh`,note:`${num(distanceValue(highlights.totalDistanceKm,units.system),locale)} ${distanceLabel} ${t("analysedLower")}`},
  ];
  const exportCard=async()=>{setExporting(true);try{await downloadLifetimeHighlightsCard({title:t("lifetimeHighlightsTitle"),subtitle:t("lifetimeHighlightsSubtitle"),metrics,note:t("lifetimeHighlightsDisclaimer")});}finally{setExporting(false);}};
  return <div className="lifetime-highlights" role="dialog" aria-modal="true" aria-label={t("lifetimeHighlightsTitle")}><div className="highlights-glow"/><header><div><span>XPENG ANALYTICS</span><h2>{t("lifetimeHighlightsTitle")}</h2><p>{t("lifetimeHighlightsSubtitle")}</p></div><div><button type="button" onClick={exportCard} disabled={exporting}>{exporting?t("creatingCard"):t("downloadHighlights")}</button><button className="highlights-close" type="button" onClick={onClose} aria-label={t("close")}>×</button></div></header><main><section className="highlights-hero"><span>{t("highlightTopSpeed")}</span><strong>{num(speedValue(highlights.fastest?.maxSpeedKmh,units.system),locale)}<small>{speedLabel}</small></strong><p>{dateNote(highlights.fastest)||t("notObserved")}</p></section><section className="highlights-grid">{metrics.slice(1).map((metric,index)=><article key={metric.key} className={`highlight-card highlight-${index+1}`}><span>{metric.label}</span><strong>{metric.value}</strong>{metric.note?<small>{metric.note}</small>:null}</article>)}</section><p className="highlights-disclaimer">{t("lifetimeHighlightsDisclaimer")}</p></main></div>;
}

function Quality({ data, locale, t }) {
  const [dismissed,setDismissed]=useState(()=>readDismissed("quality"));
  const [alertsOpen,setAlertsOpen]=useState(false);
  const coverage = safe(data.quality?.coverage), allEvents = safe(data.quality?.events).filter((row)=>row.severity!=="low");
  const events=allEvents.filter((row)=>!dismissed.has(qualityObservationId(row)));
  const odometerGaps=events.filter((row)=>row.rule==="odometer_coverage_gap"),legacyTripGaps=odometerGaps.length?0:sum(data.trips,"gapCount"),coverageGapCount=odometerGaps.length||legacyTripGaps,reviewEvents=events.filter((row)=>row.severity==="high"||row.severity==="medium"),possibleMissingDistance=sum(odometerGaps,"missingDistanceKm");
  const dismiss=(row)=>setDismissed(dismissObservation("quality",qualityObservationId(row)));
  const dismissAll=()=>{const next=new Set(dismissed);allEvents.forEach((row)=>next.add(qualityObservationId(row)));setDismissed(writeDismissed("quality",next));};
  const restore=()=>setDismissed(restoreObservations("quality"));
  return <>
    <div className="quality-summary"><div><span>{t("qualityStatus")}</span><strong>{reviewEvents.length ? t("reviewRecommended") : t("noCriticalIssues")}</strong><p>{t("qualityStatusHelp")}</p></div><div className="quality-count"><strong>{reviewEvents.length}</strong><span>{t("qualityEvents")}</span></div></div>
    <div className="data-gap-disclaimer"><strong>{t("journeyDataDisclaimerTitle")}</strong><p>{t("journeyDataDisclaimer")}</p></div>
    <section className={`quality-alerts ${alertsOpen?"is-open":""}`}><header><button type="button" onClick={()=>setAlertsOpen((value)=>!value)} aria-expanded={alertsOpen}><span><strong>{t("qualityAlertsTitle")}</strong><small>{coverageGapCount?`${coverageGapCount} ${t("qualityAlertsPending")} · ${num(possibleMissingDistance,locale)} km`:t("noQualityEvents")}</small></span><b>{alertsOpen?"−":"+"}</b></button>{dismissed.size?<button className="restore-observations" type="button" onClick={restore}>{t("showDismissed")}</button>:null}</header>{alertsOpen?<div className="quality-alert-body">{odometerGaps.length?<div className="odometer-gap-list">{odometerGaps.map((row)=><article key={qualityObservationId(row)}><span><strong>{dateText(row.startedAtUtc,locale)} · {timeText(row.startedAtUtc,locale)} — {timeText(row.endedAtUtc,locale)}</strong><small>{num(row.missingDistanceKm,locale)} km · {duration(row.durationMinutes,t)}</small></span><button type="button" onClick={()=>dismiss(row)}>{t("dismiss")}</button></article>)}</div>:coverageGapCount?<div className="data-gap-notice"><strong>{t("qualityMissingDataTitle")}</strong><p>{t("qualityTelemetryGapHelp")} {coverageGapCount}.</p></div>:<div className="inline-success">{t("noQualityEvents")}</div>}<div className="quality-alert-actions">{events.length?<button type="button" onClick={dismissAll}>{t("dismissAll")}</button>:null}</div></div>:null}</section>
    <CoverageCalendar data={data} locale={locale} t={t}/>
    <div className="metric-grid quality-metrics">{coverage.map((row) => <Metric key={row.family} label={t(`family_${row.family}`)} value={num(row.rows, locale,0)} note={`${dateText(row.firstUtc,locale)} — ${dateText(row.lastUtc,locale)}`} />)}</div>
    <Panel title={t("signalAvailability")} subtitle={t("signalAvailabilityHelp")}>
      <div className="signal-availability">{coverage.map((row)=>{const available=safe(row.availableColumns),empty=safe(row.emptyColumns),unknown=safe(row.unknownColumns),total=Number(row.totalColumns)||available.length+empty.length,share=total?available.length/total*100:0;return <article key={row.family}><header><strong>{t(`family_${row.family}`)}</strong><span>{available.length}/{total} {t("signalsAvailable")}</span></header><div className="signal-bar" aria-label={`${num(share,locale,0)}%`}><i style={{width:`${share}%`}}/></div><div className="signal-group"><span>{t("availableMetrics")}</span><div>{available.map((field)=><small key={field} className="is-available">{signalText(field,t)}</small>)}</div></div>{empty.length?<div className="signal-group"><span>{t("noDataSignals")}</span><div>{empty.map((field)=><small key={field} className="is-empty">{signalText(field,t)}</small>)}</div></div>:null}{unknown.length?<details><summary>{unknown.length} {t("newFieldsFound")}</summary><p>{t("newFieldsHelp")}</p></details>:null}</article>;})}</div>
    </Panel>
    <Panel title={t("qualityEvents")} subtitle={t("qualityEventsHelp")} action={dismissed.size?<button className="restore-observations" type="button" onClick={restore}>{t("showDismissed")}</button>:null}><div className="data-table quality-events-table"><div className="table-head"><span>{t("severity")}</span><span>{t("family")}</span><span>{t("rule")}</span><span>{t("affected")}</span><span>{t("field")}</span><span/></div>{events.map((row,index)=><div key={`${row.rule}-${index}`}><span><i className={`severity severity-${row.severity}`}>{t(`severity_${row.severity}`)}</i></span><span>{t(`family_${row.family}`)}</span><span>{t(`rule_${row.rule}`)}{row.rule==="odometer_coverage_gap"&&row.startedAtUtc?<small className="quality-event-detail">{dateText(row.startedAtUtc,locale)} · {num(row.missingDistanceKm,locale)} km</small>:null}</span><span>{num(row.affectedRows,locale,0)}</span><span>{row.field || "—"}</span><button type="button" onClick={()=>dismiss(row)}>{t("dismiss")}</button></div>)}</div>{!events.length?<div className="inline-success">{dismissed.size?t("qualityAreaCleared"):t("noQualityEvents")}</div>:null}</Panel>
    <div className="threshold-note"><strong>{t("interpretationRules")}</strong><p>{t("interpretationRulesHelp")}</p></div>
  </>;
}

function DataProtectionCentre({data,locale,t,persistence,drive}){
  const assessment=useMemo(()=>assessDataProtection(data,{persistence,drive}),[data,drive,persistence]);
  const statusKey=`dataProtection_${assessment.level}`;
  return <section className={`data-protection-centre status-${assessment.level}`}><header><div><span>{t("dataProtectionKicker")}</span><h2>{t("dataProtectionTitle")}</h2><p>{t("dataProtectionHelp")}</p></div><strong>{t(statusKey)}</strong></header><div className="data-protection-grid"><article><small>{t("latestTelemetry")}</small><b>{dateText(assessment.coverage.endUtc,locale)}</b><span>{assessment.ageDays==null?t("dataUnavailable"):`${num(assessment.ageDays,locale,0)} ${t("daysAgo")}`}</span></article><article><small>{t("recoverableWindow")}</small><b>{assessment.recoverableDays==null?"—":`${num(assessment.recoverableDays,locale,0)} ${t("daysLower")}`}</b><span>{t("recoverableWindowHelp")}</span></article><article><small>{t("portableProtection")}</small><b>{assessment.hasPortableProtection?t("protectedStatus"):t("notProtectedStatus")}</b><span>{drive?.hasBackup?t("protectedByDrive"):persistence?.hasSavedHistory?t("protectedOnDevice"):t("protectionNeeded")}</span></article><article><small>{t("driveBackupStatus")}</small><b>{!drive?.hasBackup?t("driveBackupMissing"):assessment.backupCurrent?t("upToDate"):t("updateNeeded")}</b><span>{assessment.rawCount?`${assessment.rawCount} ${t("rawSourcesProtected")}`:t("noRawSourcesProtected")}</span></article><article><small>{t("coverageWarnings")}</small><b>{assessment.importGaps.length+assessment.odometerGaps.length}</b><span>{assessment.importGaps.length?`${assessment.importGaps.length} ${t("possibleExportGaps")}`:assessment.odometerGaps.length?`${assessment.odometerGaps.length} ${t("odometerGaps")}`:t("noCoverageWarnings")}</span></article></div><p className="analysis-disclaimer">{t("dataProtectionDisclaimer")}</p></section>;
}

function DataSection({ data, locale, t, busy, onChooseAdditional, onChooseHistory, onExport, onExportConsolidatedCsv, onReset, persistence, onToggleRememberHistory, onToggleImportReminder, onSetImportReminderDays, onForgetSavedHistory, drive, onConnectDrive, onSaveDrive, onOpenDrive, onDisconnectDrive, onToggleDriveAutoSync, onToggleDriveOriginalArchive, onToggleDriveGpsArchive, onDownloadDriveOriginal, onDeleteDriveOriginal }) {
  const [trimMeters,setTrimMeters]=useState(0);
  const [dragging,setDragging]=useState(false);
  const driveGaps=useMemo(()=>detectLikelyImportGaps(data.imports),[data.imports]);
  return <div className="dashboard-grid two data-layout">
    <DataProtectionCentre data={data} locale={locale} t={t} persistence={persistence} drive={drive}/>
    <Panel title={t("addMoreData")} subtitle={t("addMoreHelp")}><div className="data-actions"><label className={`dashboard-upload ${busy ? "is-disabled" : ""} ${dragging ? "is-dragging" : ""}`} onDragEnter={(event)=>{event.preventDefault();if(!busy)setDragging(true);}} onDragOver={(event)=>event.preventDefault()} onDragLeave={(event)=>{event.preventDefault();if(!event.currentTarget.contains(event.relatedTarget))setDragging(false);}} onDrop={(event)=>{event.preventDefault();setDragging(false);if(!busy)onChooseAdditional(event.dataTransfer.files,{trimMeters});}}><input type="file" multiple accept=".zip,.gpx,.csv,application/zip,application/gpx+xml,text/csv" disabled={busy} onChange={(event)=>{onChooseAdditional(event.target.files,{trimMeters});event.target.value="";}}/><Icon name="data"/><strong>{busy?t("importing"):dragging?t("dropActive"):t("chooseFiles")}</strong><small>{t("additionalDropHint")}</small></label><label className="gps-trim-control unified-route-privacy"><span>{t("routePrivacyTrim")}</span><select value={trimMeters} disabled={busy} onChange={(event)=>setTrimMeters(Number(event.currentTarget.value))}><option value="0">{t("trimNone")}</option><option value="100">100 m</option><option value="250">250 m</option><option value="500">500 m</option></select><small>{t("routePrivacyTrimHelp")}</small></label><label className="secondary-action"><input type="file" accept=".xpeng,.json.gz,.gz,application/octet-stream,application/gzip" disabled={busy} onChange={(event)=>{onChooseHistory(event.target.files);event.target.value="";}}/><strong>{t("replaceFromHistory")}</strong></label><button className="primary-action" type="button" disabled={busy} onClick={onExport}>{t("exportHistory")}</button><p className="export-help">{t("exportHistoryHelp")}</p><p className="history-warning">{t("historySensitiveWarning")}</p><button className="danger-link" type="button" disabled={busy} onClick={onReset}>{t("reset")}</button></div></Panel>
    <Panel title={t("importHistory")} subtitle={`${safe(data.imports).length} ${t("filesLower")}`}><div className="import-history">{safe(data.imports).map((row)=><div key={row.sha256}><span><strong>{row.name}</strong><small>{dateText(row.completedAtUtc,locale)} · {num(row.rows,locale,0)} {t("rowsLower")}</small>{row.sourceStartUtc&&row.sourceEndUtc?<small className="import-coverage">{dateText(row.sourceStartUtc,locale)} — {dateText(row.sourceEndUtc,locale)}</small>:null}</span><code>{row.sha256?.slice(0,10)}…</code></div>)}</div></Panel>
    <div className="advanced-export-panel">
      <Panel title={t("advancedDataExport")} subtitle={t("advancedDataExportHelp")}>
        <div className="advanced-export-content">
          <div><strong>{t("consolidatedCsvExport")}</strong><p>{t("consolidatedCsvExportHelp")}</p><div className="advanced-export-files"><span>{t("consolidatedCsvOperation")}.csv</span><span>{t("consolidatedCsvEnergy")}.csv</span><span>{t("consolidatedCsvStatus")}.csv</span><span>manifest.json</span></div></div>
          <button className="primary-action" type="button" disabled={busy} onClick={onExportConsolidatedCsv}>{t("consolidatedCsvExport")}</button>
        </div>
        <p className="export-help">{t("consolidatedCsvLocal")}</p>
        <p className="history-warning">{t("consolidatedCsvSensitive")}</p>
        <p className="advanced-export-next">{t("encryptedHistoryNext")}</p>
      </Panel>
    </div>
    <div className="gps-management-panel">
      <Panel title={t("gpsRoutes")} subtitle={t("gpsRoutesHelp")}>
        <div className="gps-summary"><span><strong>{num(safe(data.gpsImports).length,locale,0)}</strong>{t("gpsSources")}</span><span><strong>{num(data.gps?.matchedCount||0,locale,0)}</strong>{t("matchedRoutes")}</span><span><strong>{num(data.gps?.matchedTripCount||0,locale,0)}</strong>{t("matchedTripRoutes")}</span><span><strong>{num(data.gps?.duplicateCount||0,locale,0)}</strong>{t("duplicateRoutesIgnored")}</span></div>
        {data.gps?.diagnosticCounts?<div className="gps-diagnostic-summary"><span>{t("gpsPartialMatches")}: <strong>{num(data.gps.diagnosticCounts.partial||0,locale,0)}</strong></span><span>{t("gpsSparseTracks")}: <strong>{num(data.gps.diagnosticCounts.sparse||0,locale,0)}</strong></span><span>{t("gpsClockCorrections")}: <strong>{num(data.gps.diagnosticCounts.clockAdjusted||0,locale,0)}</strong></span></div>:null}
        <div className="gps-auto-note"><strong>{t("automaticGpsMatching")}</strong><p>{t("automaticGpsMatchingHelp")}</p></div>
        <p className="history-warning gps-sensitive-warning">{t("gpsSensitiveWarning")}</p>
        {!data.gps?.matchedCount?<div className="section-empty gps-empty"><strong>{t("noGpsTracks")}</strong><p>{t("noGpsTracksHelp")}</p></div>:null}
      </Panel>
    </div>
    <div className="persistent-history-panel">
      <Panel title={t("persistentHistoryTitle")} subtitle={t("persistentHistoryHelp")}>
        <div className="persistent-history-settings">
          {!persistence.supported ? <div className="persistent-history-error">{t("persistentHistoryUnsupported")}</div> : <>
            <label className="setting-toggle"><span><strong>{t("rememberHistory")}</strong><small>{t("rememberHistoryHelp")}</small></span><input type="checkbox" checked={persistence.enabled} disabled={busy || persistence.loading} onChange={(event)=>onToggleRememberHistory(event.currentTarget.checked)}/></label>
            {persistence.enabled ? <>
              <div className="persistent-history-status">
                <span><small>{t("savedHistoryStatus")}</small><strong>{persistence.hasSavedHistory ? t("savedHistoryReady") : t("savedHistoryPending")}</strong></span>
                <span><small>{t("savedHistorySize")}</small><strong>{formatStoredBytes(persistence.byteLength, locale)}</strong></span>
                <span><small>{t("savedHistoryDate")}</small><strong>{dateText(persistence.savedAtUtc, locale)}</strong></span>
                <span><small>{t("lastDataImport")}</small><strong>{dateText(persistence.lastImportAtUtc, locale)}</strong></span>
              </div>
              <label className="setting-toggle is-secondary"><span><strong>{t("monthlyImportReminder")}</strong><small>{t("monthlyImportReminderHelp")}</small></span><input type="checkbox" checked={persistence.reminderEnabled} disabled={busy} onChange={(event)=>onToggleImportReminder(event.currentTarget.checked)}/></label>
              {persistence.reminderEnabled ? <div className="reminder-schedule">
                <label><span>{t("importReminderInterval")}</span><select value={persistence.reminderDays} disabled={busy} onChange={(event)=>onSetImportReminderDays(Number(event.currentTarget.value))}>{IMPORT_REMINDER_DAY_OPTIONS.map((days)=><option value={days} key={days}>{days} {t("daysLower")}</option>)}</select></label>
                <span><small>{t("nextImportReminder")}</small><strong>{dateText(nextReminderAt(persistence.lastImportAtUtc, persistence.reminderDays), locale)}</strong></span>
              </div> : null}
              {persistence.reminderDue ? <div className="persistent-history-reminder"><strong>{t("importReminderDue")}</strong><p>{t("importReminderDueHelp")}</p></div> : null}
              <p className="history-warning persistent-warning">{t("persistentHistoryWarning")}</p>
              <button className="danger-link" type="button" disabled={busy || !persistence.hasSavedHistory} onClick={onForgetSavedHistory}>{t("forgetSavedHistory")}</button>
            </> : null}
            {persistence.error ? <div className="persistent-history-error">{t(persistence.error)}</div> : null}
          </>}
        </div>
      </Panel>
    </div>
    <div className="google-drive-panel">
      <Panel title={t("driveBackupTitle")} subtitle={t("driveBackupHelp")}>
        <div className="drive-backup-settings">
          {!drive.configured ? <div className="persistent-history-error">{t("driveNotConfigured")}</div> : <>
            <div className="drive-privacy-note"><strong>{t("driveOptionalTitle")}</strong><p>{t("drivePrivacyHelp")}</p></div>
            <div className="drive-status-grid">
              <span><small>{t("driveConnection")}</small><strong>{drive.connected ? t("driveConnected") : t("driveDisconnected")}</strong></span>
              <span><small>{t("driveAccount")}</small><strong>{drive.account?.emailAddress || "—"}</strong></span>
              <span><small>{t("driveBackupStatus")}</small><strong>{drive.hasBackup ? t("driveBackupReady") : t("driveBackupMissing")}</strong></span>
              <span><small>{t("savedHistorySize")}</small><strong>{formatStoredBytes(drive.byteLength, locale)}</strong></span>
              <span><small>{t("savedHistoryDate")}</small><strong>{drive.modifiedTime ? `${dateText(drive.modifiedTime, locale)} · ${timeText(drive.modifiedTime, locale)}` : "—"}</strong></span>
              <span><small>{t("driveCoverage")}</small><strong>{drive.coverageStartUtc && drive.coverageEndUtc ? `${dateText(drive.coverageStartUtc,locale)} — ${dateText(drive.coverageEndUtc,locale)}` : "—"}</strong></span>
              <span><small>{t("driveHistoryVersion")}</small><strong>{drive.historyVersion ? `v${drive.historyVersion}` : "—"}</strong></span>
            </div>
            {!drive.connected ? <button className="primary-action" type="button" disabled={busy || drive.busy} onClick={onConnectDrive}>{drive.busy ? t("driveWorking") : t("driveConnect")}</button> : <>
              <div className="drive-actions"><button className="primary-action" type="button" disabled={busy || drive.busy} onClick={onSaveDrive}>{drive.busy ? t("driveWorking") : drive.hasBackup ? t("driveUpdate") : t("driveSave")}</button><button className="secondary-button" type="button" disabled={busy || drive.busy || !drive.hasBackup} onClick={()=>onOpenDrive()}>{t("driveOpen")}</button></div>
              <label className="setting-toggle is-secondary"><span><strong>{t("driveAutoSync")}</strong><small>{t("driveAutoSyncHelp")}</small></span><input type="checkbox" checked={drive.autoSync} disabled={busy || drive.busy} onChange={(event)=>onToggleDriveAutoSync(event.currentTarget.checked)}/></label>
              <div className="drive-original-archive">
                <label className="setting-toggle is-secondary"><span><strong>{t("driveOriginalArchive")}</strong><small>{t("driveOriginalArchiveHelp")}</small></span><input type="checkbox" checked={Boolean(drive.archiveOriginals)} disabled={busy || drive.busy || drive.originalArchiveBusy} onChange={(event)=>onToggleDriveOriginalArchive(event.currentTarget.checked)}/></label>
                <div className="drive-original-warning"><strong>{t("driveOriginalWarningTitle")}</strong><p>{t("driveOriginalWarning")}</p></div>
                {drive.originalArchiveError ? <div className="persistent-history-error" role="alert">{t(drive.originalArchiveError)}</div> : null}
                {drive.originals?.length ? <div className="drive-original-list"><header><strong>{t("driveOriginalFiles")}</strong><small>{drive.originals.length} {t("filesLower")}</small></header>{drive.originals.map((file)=><article key={file.id}><div><strong>{file.name}</strong><small>{dateText(file.createdTime||file.modifiedTime,locale)} · {formatStoredBytes(file.size,locale)}</small>{file.coverageStartUtc&&file.coverageEndUtc?<small>{dateText(file.coverageStartUtc,locale)} — {dateText(file.coverageEndUtc,locale)}</small>:null}</div><div><button className="secondary-button" type="button" disabled={busy||drive.busy||drive.originalArchiveBusy} onClick={()=>onDownloadDriveOriginal(file.id)}>{t("driveOriginalDownload")}</button><button className="danger-link" type="button" disabled={busy||drive.busy||drive.originalArchiveBusy} onClick={()=>onDeleteDriveOriginal(file.id)}>{t("driveOriginalDelete")}</button></div></article>)}</div>:<p className="drive-original-empty">{t("driveOriginalEmpty")}</p>}
                <label className="setting-toggle is-secondary drive-gps-archive-toggle"><span><strong>{t("driveGpsArchive")}</strong><small>{t("driveGpsArchiveHelp")}</small></span><input type="checkbox" checked={Boolean(drive.archiveGps)} disabled={busy || drive.busy || drive.originalArchiveBusy} onChange={(event)=>onToggleDriveGpsArchive(event.currentTarget.checked)}/></label>
                <div className="drive-original-warning is-location"><strong>{t("driveGpsWarningTitle")}</strong><p>{t("driveGpsWarning")}</p></div>
                {drive.gpsOriginals?.length ? <div className="drive-original-list"><header><strong>{t("driveGpsFiles")}</strong><small>{drive.gpsOriginals.length} {t("filesLower")}</small></header>{drive.gpsOriginals.map((file)=><article key={file.id}><div><strong>{file.name}</strong><small>{dateText(file.createdTime||file.modifiedTime,locale)} · {formatStoredBytes(file.size,locale)}</small></div><div><button className="secondary-button" type="button" disabled={busy||drive.busy||drive.originalArchiveBusy} onClick={()=>onDownloadDriveOriginal(file.id)}>{t("driveOriginalDownload")}</button><button className="danger-link" type="button" disabled={busy||drive.busy||drive.originalArchiveBusy} onClick={()=>onDeleteDriveOriginal(file.id)}>{t("driveOriginalDelete")}</button></div></article>)}</div>:<p className="drive-original-empty">{t("driveGpsEmpty")}</p>}
              </div>
              {drive.backups?.length ? <div className="drive-recovery"><header><strong>{t("driveRecoveryTitle")}</strong><small>{t("driveRecoveryHelp")}</small></header><div className="drive-recovery-list">{drive.backups.map((file)=><article key={file.id}><div><strong>{file.role === "current" ? t("driveCurrentBackup") : t("driveRecoveryBackup")}</strong><small>{dateText(file.modifiedTime || file.createdTime,locale)} · {formatStoredBytes(file.size,locale)}{file.historyVersion ? ` · v${file.historyVersion}` : ""}</small><small>{file.coverageStartUtc && file.coverageEndUtc ? `${dateText(file.coverageStartUtc,locale)} — ${dateText(file.coverageEndUtc,locale)}` : t("driveCoverageUnavailable")}</small></div><button className="secondary-button" type="button" disabled={busy||drive.busy} onClick={()=>onOpenDrive(file.id)}>{t("driveRestoreThis")}</button></article>)}</div></div> : null}
              {driveGaps.length ? <div className="drive-gap-warning"><strong>{t("driveGapTitle")}</strong><p>{t("driveGapHelp")}</p><ul>{driveGaps.slice(0,3).map((gap)=><li key={`${gap.startUtc}-${gap.endUtc}`}>{dateText(gap.startUtc,locale)} — {dateText(gap.endUtc,locale)} · {num(gap.durationHours/24,locale,1)} {t("daysLower")}</li>)}</ul></div> : null}
              <button className="danger-link" type="button" disabled={busy || drive.busy} onClick={onDisconnectDrive}>{t("driveDisconnect")}</button>
            </>}
            {drive.error ? <div className="persistent-history-error" role="alert">{t(drive.error)}</div> : null}
          </>}
        </div>
      </Panel>
    </div>
  </div>;
}

const OverviewSection = memo(Overview);
const JourneysSection = memo(Journeys);
const DrivingSection = memo(Driving);
const ChargingSection = memo(Charging);
const BatterySection = memo(Battery);
const TyresSection = memo(Tyres);
const ActivitySection = memo(Activity);
const TrendsSection = memo(Trends);
const InsightsSection = memo(Insights);
const PeriodComparisonSection = memo(PeriodComparison);
const ReportSection = memo(Report);
const QualitySection = memo(Quality);

export default function Dashboard({ data, locale, setLocale, t, busy, progress, error, onChooseAdditional, onChooseHistory, onExport, onExportConsolidatedCsv, onSaveCustomCharts, onSaveJourneyGroups, onSaveOwnership, onRequestRecordDetails, onReset, onCancel, canCancel, persistence, onToggleRememberHistory, onToggleImportReminder, onSetImportReminderDays, onForgetSavedHistory, drive, onConnectDrive, onSaveDrive, onOpenDrive, onDisconnectDrive, onToggleDriveAutoSync, onToggleDriveOriginalArchive, onToggleDriveGpsArchive, onDownloadDriveOriginal, onDeleteDriveOriginal, theme, onToggleTheme, onStartTutorial }) {
  const [section,setSection]=useState("overview"), [viewMode,setViewModeState]=useState(initialViewMode), [period,setPeriod]=useState("all"), [selectedJourneyId,setSelectedJourneyId]=useState(null), [selectedChargeId,setSelectedChargeId]=useState(null), [selectedChartId,setSelectedChartId]=useState(null), [measurementSystem,setMeasurementSystem]=useState("metric"), [pressureUnit,setPressureUnit]=useState("bar"), [settingsOpen,setSettingsOpen]=useState(false), [searchOpen,setSearchOpen]=useState(false), [compactNavigation,setCompactNavigation]=useState(()=>typeof window!=="undefined"&&window.matchMedia("(max-width: 1050px)").matches);
  const [expandedNavGroups,setExpandedNavGroups]=useState(()=>new Set());
  const settingsRef=useRef(null);
  const [minDate,maxDate]=useMemo(()=>{
    const availableDates=[...safe(data.daily).map((row)=>row.date),...safe(data.trips).map((row)=>row.date),...safe(data.journeys).map((row)=>row.date),...safe(data.charges).map((row)=>row.date),...safe(data.battery?.history).map((row)=>row.date),...safe(data.battery?.parking).map((row)=>String(row.startedAtUtc||"").slice(0,10))].filter(Boolean).sort();
    return [availableDates.at(0)??"",availableDates.at(-1)??new Date().toISOString().slice(0,10)];
  },[data]);
  const [customRange,setCustomRange]=useState(()=>({start:minDate,end:maxDate}));
  const dataCoverage=useMemo(()=>formatTelemetryCoverage(data,locale),[data,locale]);
  const units=useMemo(()=>({system:measurementSystem,pressure:pressureUnit}),[measurementSystem,pressureUnit]);
  const shared={data,locale,t,period,maxDate,customRange,units};
  const activeNavGroups=viewMode==="simple"?simpleNavGroups:navGroups;
  const setViewMode=useCallback((next)=>{const mode=next==="advanced"?"advanced":"simple";setViewModeState(mode);try{globalThis.localStorage?.setItem(viewModeStorageKey,mode);}catch{}if(mode==="simple"&&!simpleSections.has(section))setSection("overview");requestAnimationFrame(()=>window.scrollTo({top:0,behavior:"auto"}));},[section]);
  useEffect(()=>{
    if(!settingsOpen)return undefined;
    const dismiss=(event)=>{if(!settingsRef.current?.contains(event.target))setSettingsOpen(false);};
    const escape=(event)=>{if(event.key==="Escape")setSettingsOpen(false);};
    document.addEventListener("pointerdown",dismiss);
    document.addEventListener("keydown",escape);
    return()=>{document.removeEventListener("pointerdown",dismiss);document.removeEventListener("keydown",escape);};
  },[settingsOpen]);
  useEffect(()=>{
    const media=window.matchMedia("(max-width: 1050px)"),sync=()=>{setCompactNavigation(media.matches);setSettingsOpen(false);};
    sync();media.addEventListener("change",sync);return()=>media.removeEventListener("change",sync);
  },[]);
  useEffect(()=>{const shortcut=(event)=>{const editing=/^(INPUT|TEXTAREA|SELECT)$/.test(event.target?.tagName);if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="k"){event.preventDefault();setSearchOpen(true);}else if(event.key==="/"&&!editing&&!event.ctrlKey&&!event.metaKey&&!event.altKey){event.preventDefault();setSearchOpen(true);}};document.addEventListener("keydown",shortcut);return()=>document.removeEventListener("keydown",shortcut);},[]);
  const openSection=useCallback((target)=>{setSection(target);setSettingsOpen(false);const group=navGroups.find((candidate)=>candidate.key&&candidate.items.includes(target));if(group)setExpandedNavGroups(new Set([group.key]));requestAnimationFrame(()=>window.scrollTo({top:0,behavior:"auto"}));},[]);
  const toggleNavGroup=useCallback((key)=>setExpandedNavGroups((current)=>{const next=new Set(current);if(next.has(key))next.delete(key);else next.add(key);return next;}),[]);
  const openRecord=useCallback((target,id)=>{if(target==="journeys")setSelectedJourneyId(id);if(target==="charging")setSelectedChargeId(id);openSection(target);},[openSection]);
  const openInsightDetails=useCallback((target,event)=>{
    const date=String(event?.date||"").slice(0,10);
    if(date){setCustomRange({start:date,end:date});setPeriod("custom");}
    if(target==="charging"&&event?.sourceId)setSelectedChargeId(event.sourceId);
    openSection(target);
  },[openSection]);
  const openSearchResult=useCallback((result)=>{if(result.type==="settings"){setSettingsOpen(true);return;}if(result.date){setCustomRange({start:result.date,end:result.date});setPeriod("custom");}if(result.type==="journey"&&result.sourceId)setSelectedJourneyId(result.sourceId);if(result.type==="charge"&&result.sourceId)setSelectedChargeId(result.sourceId);if(result.type==="chart"&&result.sourceId)setSelectedChartId(result.sourceId);const target=result.section||"overview";if(!simpleSections.has(target))setViewMode("advanced");openSection(target);},[openSection,setViewMode]);
  let content;
  if(viewMode==="simple"&&section==="overview")content=<SimpleOverview {...shared} openRecord={openRecord}/>;
  else if(viewMode==="simple"&&section==="journeys")content=<SimpleJourneys {...shared} selectedId={selectedJourneyId} setSelectedId={setSelectedJourneyId} onRequestRecordDetails={onRequestRecordDetails}/>;
  else if(viewMode==="simple"&&section==="charging")content=<SimpleCharging {...shared} selectedId={selectedChargeId} setSelectedId={setSelectedChargeId} onRequestRecordDetails={onRequestRecordDetails}/>;
  else if(viewMode==="simple"&&section==="battery")content=<SimpleBattery {...shared} onSaveOwnership={onSaveOwnership}/>;
  else if(section==="overview")content=<OverviewSection {...shared} openSection={openSection} openRecord={openRecord}/>;
  else if(section==="journeys")content=<JourneysSection {...shared} selectedId={selectedJourneyId} setSelectedId={setSelectedJourneyId} onSaveJourneyGroups={onSaveJourneyGroups} onSaveOwnership={onSaveOwnership} onRequestRecordDetails={onRequestRecordDetails}/>;
  else if(section==="driving")content=<DrivingSection {...shared}/>;
  else if(section==="charging")content=<ChargingSection {...shared} selectedId={selectedChargeId} setSelectedId={setSelectedChargeId} onSaveOwnership={onSaveOwnership} onRequestRecordDetails={onRequestRecordDetails}/>;
  else if(section==="battery")content=<BatterySection {...shared} onSaveOwnership={onSaveOwnership}/>;
  else if(section==="tyres")content=<TyresSection {...shared}/>;
  else if(section==="activity")content=<ActivitySection {...shared}/>;
  else if(section==="trends")content=<TrendsSection {...shared}/>;
  else if(section==="insights")content=<InsightsSection {...shared} onOpenDetails={openInsightDetails}/>;
  else if(section==="ownership")content=<OwnershipCentre data={data} locale={locale} t={t} onSaveOwnership={onSaveOwnership}/>;
  else if(section==="compare")content=<PeriodComparisonSection data={data} locale={locale} t={t} minDate={minDate} maxDate={maxDate} units={units}/>;
  else if(section==="highlights")content=<LifetimeHighlights data={data} locale={locale} t={t} units={units} onClose={()=>openSection("overview")}/>;
  else if(section==="replay")content=<React.Suspense fallback={<div className="section-empty"><strong>{t("replayLoading")}</strong></div>}><Replay data={data} locale={locale} t={t} units={units} onRequestRecordDetails={onRequestRecordDetails}/></React.Suspense>;
  else if(section==="mycharts")content=<React.Suspense fallback={<div className="section-empty"><strong>{t("loadingEngine")}</strong></div>}><MyCharts data={data} locale={locale} t={t} units={units} onSave={onSaveCustomCharts} focusId={selectedChartId}/></React.Suspense>;
  else if(section==="report")content=<ReportSection data={data} locale={locale} t={t} minDate={minDate} maxDate={maxDate} units={units} onSaveOwnership={onSaveOwnership}/>;
  else if(section==="quality")content=<QualitySection data={data} locale={locale} t={t}/>;
  else content=<DataSection data={data} locale={locale} t={t} busy={busy} onChooseAdditional={onChooseAdditional} onChooseHistory={onChooseHistory} onExport={onExport} onExportConsolidatedCsv={onExportConsolidatedCsv} onReset={onReset} persistence={persistence} onToggleRememberHistory={onToggleRememberHistory} onToggleImportReminder={onToggleImportReminder} onSetImportReminderDays={onSetImportReminderDays} onForgetSavedHistory={onForgetSavedHistory} drive={drive} onConnectDrive={onConnectDrive} onSaveDrive={onSaveDrive} onOpenDrive={onOpenDrive} onDisconnectDrive={onDisconnectDrive} onToggleDriveAutoSync={onToggleDriveAutoSync} onToggleDriveOriginalArchive={onToggleDriveOriginalArchive} onToggleDriveGpsArchive={onToggleDriveGpsArchive} onDownloadDriveOriginal={onDownloadDriveOriginal} onDeleteDriveOriginal={onDeleteDriveOriginal}/>;
  const filteredSections=["overview","journeys","driving","charging","battery","tyres","activity","trends","insights"];
  const modeSwitch=<div className="view-mode-switch" role="group" aria-label={t("viewMode")}><button type="button" className={viewMode==="simple"?"is-active":""} onClick={()=>setViewMode("simple")}><span>{t("simpleMode")}</span><small>{t("simpleModeHelp")}</small></button><button type="button" className={viewMode==="advanced"?"is-active":""} onClick={()=>setViewMode("advanced")}><span>{t("advancedMode")}</span><small>{t("advancedModeHelp")}</small></button></div>;
  const utilityActions=<div className={`dashboard-utility-actions ${compactNavigation?"is-mobile":"is-sidebar"}`}><button className="topbar-data-action search-trigger" title={t("globalSearch")} type="button" onClick={()=>setSearchOpen(true)} aria-label={`${t("globalSearch")} (${t("searchShortcut")})`}><Icon name="search"/><span>{t("globalSearch")}</span><kbd>{compactNavigation?"⌕":"Ctrl K"}</kbd></button><button className={`topbar-data-action ${section==="data"?"is-active":""}`} title={t("addMoreData")} aria-label={t("addMoreData")} type="button" onClick={()=>openSection("data")}><Icon name="data"/><span>{t("addMoreData")}</span></button><div className="settings-popover" ref={settingsRef}><button className={`settings-trigger ${settingsOpen?"is-active":""}`} title={t("settings")} type="button" aria-label={t("settings")} aria-expanded={settingsOpen} aria-controls="dashboard-settings" onClick={()=>setSettingsOpen((current)=>!current)}><Icon name="settings"/><span>{t("settings")}</span></button>{settingsOpen?<div className="settings-panel" id="dashboard-settings" role="dialog" aria-label={t("settings")}><header><span><strong>{t("settings")}</strong><small>{t("settingsHelp")}</small></span><button type="button" onClick={()=>setSettingsOpen(false)}>{t("close")}</button></header>{modeSwitch}<button className="settings-theme-button" type="button" onClick={onToggleTheme} aria-label={theme==="light"?t("darkTheme"):t("lightTheme")}><span><strong>{t("theme")}</strong><small>{theme==="light"?t("light"):t("dark")}</small></span><i className={theme==="dark"?"is-dark":""}/></button><label><span>{t("language")}</span><select value={locale} onChange={(event)=>setLocale(event.target.value)}><option value="pt-PT">Português</option><option value="en">English</option></select></label><label><span>{t("measurementUnits")}</span><select value={measurementSystem} onChange={(event)=>setMeasurementSystem(event.currentTarget.value)}><option value="metric">{t("metricUnits")}</option><option value="imperial">{t("imperialUnits")}</option></select></label><label><span>{t("tyrePressureUnit")}</span><select value={pressureUnit} onChange={(event)=>setPressureUnit(event.currentTarget.value)}><option value="bar">bar</option><option value="psi">psi</option></select></label><button className="settings-tutorial-button" type="button" onClick={()=>{setSettingsOpen(false);onStartTutorial?.();}}><span><strong>{t("tutorialOpen")}</strong><small>{t("tutorialRestartHelp")}</small></span><b aria-hidden="true">→</b></button></div>:null}</div>{!compactNavigation?<a className="sidebar-utility-link" href="https://ko-fi.com/mpinto" target="_blank" rel="noreferrer" title={t("supportCta")} aria-label={t("supportCta")}><Icon name="support"/><span>{t("supportCta")}</span></a>:null}</div>;
  return <div className="dashboard-shell cockpit-shell">
    <aside className="dashboard-sidebar">
      <button className="dashboard-brand" type="button" onClick={()=>openSection("overview")} aria-label={`XPENG Analytics — ${t("nav_overview")}${dataCoverage?` — ${dataCoverage}`:""}`}><span className="brand-mark"><img src={`${import.meta.env.BASE_URL}assets/xpeng-analytics-mark-96.png`} alt="" /></span><span className="dashboard-brand-copy"><strong>XPENG</strong><small>Analytics</small>{dataCoverage?<span className="brand-data-range" title={`${t("dataCoverage")}: ${dataCoverage}`}>{dataCoverage}</span>:null}</span></button>
      <nav aria-label={t("navigation")}>{activeNavGroups.map((group)=>{const active=group.items.includes(section),expanded=!group.key||expandedNavGroups.has(group.key);return <div className={`nav-group ${group.key?"is-collapsible":"nav-group-primary"} ${active?"is-active":""} ${expanded?"is-expanded":""}`} data-tutorial={group.key||"overview"} key={group.key||"primary"}>{group.key?<button className="nav-group-toggle" type="button" aria-expanded={expanded} onClick={()=>{if(expanded)toggleNavGroup(group.key);else if(active)setExpandedNavGroups(new Set([group.key]));else openSection(group.items[0]);}}><Icon name={group.icon}/><span>{t(`navGroup_${group.key}`)}</span><b aria-hidden="true">⌄</b></button>:null}<div className="nav-group-items">{group.items.map((item)=><button key={item} type="button" className={section===item?"is-active":""} aria-current={section===item?"page":undefined} onClick={()=>openSection(item)}><Icon name={item}/><span>{t(`nav_${item}`)}</span></button>)}</div></div>;})}</nav>
      <div className="sidebar-bottom">{!compactNavigation?utilityActions:null}<a className="sidebar-kofi" href="https://ko-fi.com/mpinto" target="_blank" rel="noreferrer">{t("supportCta")}</a><div className="privacy-mini"><i/><span><strong>{t("localOnly")}</strong><small>{persistence.enabled ? t("savedOnThisDevice") : t("sessionOnly")}</small></span></div><small className="sidebar-version">XPENG Analytics · v{APP_VERSION}</small></div>
    </aside>
    <main className="dashboard-main">
      <header className="dashboard-topbar"><div><span className="dashboard-eyebrow">{t("dashboard")}</span><h1>{t(`section_${section}`)}</h1><p>{t(`section_${section}_help`)}</p></div><div className="dashboard-topbar-actions">{modeSwitch}<time>{new Intl.DateTimeFormat(locale,{day:"numeric",month:"long",year:"numeric"}).format(new Date())}</time></div>{compactNavigation?utilityActions:null}</header>
      <label className="mobile-nav"><span>{t("navigation")}</span><select name="dashboard-navigation" value={section} onChange={(event)=>openSection(event.currentTarget.value)}>{activeNavGroups.map((group)=>group.key?<optgroup key={group.key} label={t(`navGroup_${group.key}`)}>{group.items.map((item)=><option key={item} value={item}>{t(`nav_${item}`)}</option>)}</optgroup>:group.items.map((item)=><option key={item} value={item}>{t(`nav_${item}`)}</option>))}</select>{dataCoverage?<small className="mobile-data-range" title={t("dataCoverage")}>{dataCoverage}</small>:null}</label>
      {filteredSections.includes(section)?<PeriodBar period={period} setPeriod={setPeriod} customRange={customRange} setCustomRange={setCustomRange} minDate={minDate} maxDate={maxDate} t={t}/>:null}
      {busy?<div className="dashboard-progress"><div className="dashboard-progress-heading"><strong>{Math.round(progress.percent||0)}%</strong><span>{t(phaseKeys[progress.phase]||"loadingEngine")}{progress.detail?` · ${progress.detail}`:""}</span>{canCancel?<button className="cancel-processing" type="button" onClick={onCancel}>{t("cancelProcessing")}</button>:null}</div>{["drive_backup_save","drive_original_archive","drive_history_refresh"].includes(progress.phase)?<small className="drive-progress-warning">{t("driveLongOperationWarning")}</small>:null}<div><i style={{width:`${Math.max(3,progress.percent||0)}%`}}/></div></div>:null}
      {error?<div className="dashboard-error">{t(`error_${error}`)}</div>:null}<div className="dashboard-content">{content}</div><footer className="site-footer dashboard-footer"><span>{t("unofficial")}</span><span>{t("ownerLabel")}: Miguel Pinto</span><span>v{APP_VERSION}</span><a href={`${import.meta.env.BASE_URL}about.html`} target="_blank" rel="noreferrer">{t("aboutProject")}</a><a href={`${import.meta.env.BASE_URL}privacy.html`} target="_blank" rel="noreferrer">{t("privacyPolicy")}</a><a href={ISSUE_URL} target="_blank" rel="noreferrer">{t("reportIssue")}</a><a href="https://ko-fi.com/mpinto" target="_blank" rel="noreferrer">Ko-fi</a></footer>
    </main>{searchOpen?<GlobalSearch data={data} locale={locale} t={t} units={units} onClose={()=>setSearchOpen(false)} onSelect={openSearchResult}/>:null}
  </div>;
}
