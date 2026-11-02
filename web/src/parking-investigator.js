const rows = (value) => Array.isArray(value) ? value : [];
const finite = (value) => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));

function median(values) {
  const sorted = values.map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function isOvernight(row) {
  const start = new Date(row?.startedAtUtc || ""), end = new Date(row?.endedAtUtc || "");
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return false;
  return start.getDate() !== end.getDate() || start.getHours() >= 18 || end.getHours() <= 9;
}

export function buildParkingInvestigation(parking) {
  const eligible = rows(parking).filter((row) => Number(row?.durationHours) >= 6 && Number(row?.coveragePct) >= 40 && finite(row?.socLossPerDay));
  const nights = eligible.filter(isOvernight);
  const typicalLossPct = median(eligible.map((row) => row.socLossPerDay));
  const highThresholdPct = typicalLossPct == null ? null : Math.max(typicalLossPct * 1.75, typicalLossPct + .5);
  const unusual = highThresholdPct == null ? [] : eligible.filter((row) => Number(row.socLossPerDay) >= highThresholdPct).sort((a, b) => Number(b.socLossPerDay) - Number(a.socLossPerDay));
  const byHour = new Map();
  eligible.forEach((row) => {
    const date = new Date(row.startedAtUtc || "");
    if (!Number.isFinite(date.getTime())) return;
    const bucket = Math.floor(date.getHours() / 4) * 4;
    const values = byHour.get(bucket) || [];
    values.push(Number(row.socLossPerDay));
    byHour.set(bucket, values);
  });
  return {
    eligible,
    nights,
    typicalLossPct,
    typicalPowerWatts: median(eligible.map((row) => row.averageWatts)),
    worst: eligible.slice().sort((a, b) => Number(b.socLossPerDay) - Number(a.socLossPerDay))[0] || null,
    unusual,
    pattern: [...byHour].map(([hour, values]) => ({ hour, label: `${String(hour).padStart(2, "0")}:00`, intervals: values.length, medianLossPct: median(values) })).sort((a, b) => a.hour - b.hour),
  };
}
