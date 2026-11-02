const rows = (value) => Array.isArray(value) ? value : [];
const finite = (value) => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
const inside = (value, start, end) => { const date = String(value || "").slice(0, 10); return date && (!start || date >= start) && (!end || date <= end); };
const sum = (items, field) => items.reduce((total, item) => total + (Number(item?.[field]) || 0), 0);

function shiftDate(value, days) {
  const date = new Date(`${value}T12:00:00Z`);
  if (!Number.isFinite(date.getTime())) return value;
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function comparisonDefaults(minDate, maxDate) {
  const end = maxDate || new Date().toISOString().slice(0, 10);
  const start = minDate && minDate <= end ? minDate : end;
  const inclusiveDays = Math.max(1, Math.round((Date.parse(`${end}T12:00:00Z`) - Date.parse(`${start}T12:00:00Z`)) / 86_400_000) + 1);
  const periodDays = Math.max(1, Math.min(30, Math.floor(inclusiveDays / 2) || 1));
  const secondStart = shiftDate(end, -(periodDays - 1));
  const firstEnd = shiftDate(secondStart, -1);
  const firstStart = firstEnd < start ? start : shiftDate(firstEnd, -(periodDays - 1));
  return firstEnd < start
    ? { a: { start, end }, b: { start, end } }
    : { a: { start: firstStart, end: firstEnd }, b: { start: secondStart, end } };
}

function median(values) {
  const sorted = values.map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function summarisePeriod(data, start, end) {
  const daily = rows(data?.daily).filter((row) => inside(row?.date, start, end));
  const journeys = rows(data?.journeys).filter((row) => inside(row?.date || row?.startedAtUtc, start, end));
  const charges = rows(data?.charges).filter((row) => inside(row?.date || row?.startedAtUtc, start, end));
  const parking = rows(data?.battery?.parking).filter((row) => inside(row?.startedAtUtc, start, end));
  const distanceKm = sum(daily, "distanceKm"), netEnergyKwh = sum(daily, "netEnergyKwh"), wallEnergyKwh = sum(charges, "wallEnergyKwh"), batteryEnergyKwh = sum(charges, "batteryEnergyKwh");
  return { start, end, observedDays: new Set(daily.map((row) => row.date)).size, distanceKm, journeys: journeys.length, drivingHours: sum(daily, "drivingHours"), consumptionKwh100: distanceKm > 0 ? netEnergyKwh / distanceKm * 100 : null, regeneratedKwh: sum(daily, "regeneratedKwh"), charges: charges.length, wallEnergyKwh, chargingEfficiencyPct: wallEnergyKwh > 0 ? batteryEnergyKwh / wallEnergyKwh * 100 : null, parkedLossPctPerDay: median(parking.filter((row) => Number(row?.durationHours) >= 6 && finite(row?.socLossPerDay)).map((row) => row.socLossPerDay)), daily: daily.map((row, index) => ({ ...row, relativeDay: index + 1 })) };
}

export function comparePeriods(data, first, second) {
  const a = summarisePeriod(data, first?.start, first?.end), b = summarisePeriod(data, second?.start, second?.end);
  const metrics = ["distanceKm", "journeys", "drivingHours", "consumptionKwh100", "regeneratedKwh", "wallEnergyKwh", "chargingEfficiencyPct", "parkedLossPctPerDay"];
  const differences = Object.fromEntries(metrics.map((metric) => {
    if (a[metric] == null || b[metric] == null) return [metric, null];
    const before = Number(a[metric]), after = Number(b[metric]);
    return [metric, Number.isFinite(before) && Number.isFinite(after) && before !== 0 ? (after / before - 1) * 100 : null];
  }));
  const length = Math.max(a.daily.length, b.daily.length);
  const timeline = Array.from({ length }, (_, index) => ({ day: index + 1, distanceA: a.daily[index]?.distanceKm ?? null, distanceB: b.daily[index]?.distanceKm ?? null, consumptionA: a.daily[index]?.consumptionKwh100 ?? null, consumptionB: b.daily[index]?.consumptionKwh100 ?? null }));
  return { a, b, differences, timeline };
}
