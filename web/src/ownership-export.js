import { chargeCostBreakdown, ownershipMaps } from "./ownership-metadata.js";

const csv = (value) => {
  if (value == null || (typeof value === "number" && !Number.isFinite(value))) return '""';
  let text = String(value);
  if (typeof value === "string" && /^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
};
const rows = (value) => Array.isArray(value) ? value : [];
const finite = (value) => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
const rounded = (value, digits = 3) => finite(value) ? Number(Number(value).toFixed(digits)) : "";
const table = (header, records) => [header, ...records].map((record) => record.map(csv).join(",")).join("\r\n");

function downloadCsv(content, filename) {
  const blob = new Blob(["\ufeff", content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob), anchor = document.createElement("a");
  anchor.href = url; anchor.download = filename; document.body.appendChild(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function dateRange(records) {
  const dates = records.map((row) => String(row?.date || row?.startedAtUtc || "").slice(0, 10)).filter(Boolean).sort();
  return dates.length ? `${dates[0]}-to-${dates.at(-1)}` : "empty";
}

export function buildOwnershipCsv(data, { startDate = "", endDate = "" } = {}) {
  const inside = (row) => { const date=String(row?.date||row?.startedAtUtc||"").slice(0,10); return date&&(!startDate||date>=startDate)&&(!endDate||date<=endDate); };
  const maps = ownershipMaps(data?.ownership);
  const header = ["record_type","id","date","start_time","end_time","classification","custom_label","origin","destination","purpose","comment","charge_type","distance_km","duration_minutes","consumption_kwh_100","battery_energy_kwh","grid_energy_kwh","estimated_cost","currency","cost_source"];
  const records = [header];
  rows(data?.journeys).filter(inside).forEach((row) => { const tag=maps.journeys.get(row.journeyId); records.push(["journey",row.journeyId,String(row.date||row.startedAtUtc).slice(0,10),row.startedAtUtc,row.endedAtUtc,tag?.kind||"unlabelled",tag?.label||"",tag?.origin||"",tag?.destination||"",tag?.purpose||"",tag?.comment||"","",row.distanceKm,row.durationMinutes,row.consumptionKwh100,"","","","",""]); });
  rows(data?.charges).filter(inside).forEach((row) => { const tag=maps.charges.get(row.chargeId),result=chargeCostBreakdown(row,data?.ownership); records.push(["charge",row.chargeId,String(row.date||row.startedAtUtc).slice(0,10),row.startedAtUtc,row.endedAtUtc,tag?.category||"unlabelled",tag?.label||"","","","","",row.chargeType,"","","",row.batteryEnergyKwh,row.wallEnergyKwh,result.cost==null?"":result.cost.toFixed(2),result.tariff?.currency||"",result.source]); });
  return records.map((record) => record.map(csv).join(",")).join("\r\n");
}

export function downloadOwnershipCsv(data, options = {}) {
  downloadCsv(buildOwnershipCsv(data, options), `xpeng-usage-${options.startDate||"all"}-${options.endDate||"all"}.csv`);
}

export function buildJourneysCsv(journeys, ownership = {}) {
  const maps = ownershipMaps(ownership);
  const header = ["journey_id","date","started_at_utc","ended_at_utc","classification","custom_label","origin","destination","purpose","comment","manual_group","source_journeys","trip_segments","gps_available","duration_minutes","driving_minutes","stopped_minutes","distance_km","average_speed_kmh","net_energy_kwh","energy_used_kwh","regenerated_kwh","regeneration_share_pct","consumption_kwh_100","max_speed_kmh","charging_sessions_during_stops"];
  const records = rows(journeys).map((row) => {
    const metadata = maps.journeys.get(row.journeyId) || {};
    const drivingMinutes = finite(row.drivingMinutes) ? Number(row.drivingMinutes) : Number(row.durationMinutes);
    const averageSpeed = finite(row.distanceKm) && drivingMinutes > 0 ? Number(row.distanceKm) / (drivingMinutes / 60) : null;
    return [row.journeyId,row.date||String(row.startedAtUtc||"").slice(0,10),row.startedAtUtc,row.endedAtUtc,metadata.kind||"unlabelled",metadata.label||"",metadata.origin||"",metadata.destination||"",metadata.purpose||"",metadata.comment||"",Boolean(row.isManualGroup),rows(row.sourceJourneys).length,rows(row.tripIds).length,Boolean(row.gps),rounded(row.durationMinutes,1),rounded(row.drivingMinutes,1),rounded(row.stoppedMinutes,1),rounded(row.distanceKm),rounded(averageSpeed,1),rounded(row.netEnergyKwh),rounded(row.energyUsedKwh),rounded(row.regeneratedKwh),rounded(row.regenerationSharePct,1),rounded(row.consumptionKwh100,2),rounded(row.maxSpeedKmh,1),rows(row.attachedCharges).length];
  });
  return table(header, records);
}

export function downloadJourneysCsv(journeys, ownership = {}) {
  const records = rows(journeys);
  downloadCsv(buildJourneysCsv(records, ownership), `xpeng-journeys-${dateRange(records)}.csv`);
}

export function buildChargingCsv(charges, ownership = {}) {
  const maps = ownershipMaps(ownership);
  const header = ["charge_id","date","started_at_utc","ended_at_utc","charge_type","category","custom_label","duration_minutes","soc_start_pct","soc_end_pct","soc_gain_pct","battery_energy_kwh","grid_energy_kwh","loss_kwh","efficiency_pct","maximum_power_kw","average_power_kw","battery_temperature_start_c","battery_temperature_end_c","battery_temperature_max_c","odometer_km","displayed_range_start_km","displayed_range_end_km","displayed_range_added_km","estimated_cost","currency","cost_source","tariff"];
  const records = rows(charges).map((row) => {
    const metadata = maps.charges.get(row.chargeId) || {}, cost = chargeCostBreakdown(row, ownership);
    const socGain = finite(row.socStartPct) && finite(row.socEndPct) ? Number(row.socEndPct) - Number(row.socStartPct) : null;
    const rangeAdded = finite(row.rangeStartKm) && finite(row.rangeEndKm) ? Number(row.rangeEndKm) - Number(row.rangeStartKm) : null;
    return [row.chargeId,row.date||String(row.startedAtUtc||"").slice(0,10),row.startedAtUtc,row.endedAtUtc,row.chargeType||"",metadata.category||"unlabelled",metadata.label||"",rounded(row.durationMinutes,1),rounded(row.socStartPct,1),rounded(row.socEndPct,1),rounded(socGain,1),rounded(row.batteryEnergyKwh),rounded(row.wallEnergyKwh),rounded(row.lossKwh),rounded(row.efficiencyPct,1),rounded(row.maxPowerKw,1),rounded(row.avgPowerKw,1),rounded(row.batteryTempStartC,1),rounded(row.batteryTempEndC,1),rounded(row.batteryTempMaxC,1),rounded(row.odometerKm,1),rounded(row.rangeStartKm,1),rounded(row.rangeEndKm,1),rounded(rangeAdded,1),cost.cost==null?"":rounded(cost.cost,2),cost.tariff?.currency||"",cost.source,cost.tariff?.name||""];
  });
  return table(header, records);
}

export function downloadChargingCsv(charges, ownership = {}) {
  const records = rows(charges);
  downloadCsv(buildChargingCsv(records, ownership), `xpeng-charging-${dateRange(records)}.csv`);
}
