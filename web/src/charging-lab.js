const rows = (value) => Array.isArray(value) ? value : [];
const finite = (value) => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));

function median(values) {
  const sorted = values.map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function crossing(series, target) {
  for (let index = 1; index < series.length; index += 1) {
    const before = series[index - 1], after = series[index];
    const a = Number(before?.socPct), b = Number(after?.socPct);
    if (!finite(a) || !finite(b) || b < a || target < a || target > b) continue;
    const ratio = b === a ? 0 : (target - a) / (b - a);
    return Number(before.elapsedMinutes) + (Number(after.elapsedMinutes) - Number(before.elapsedMinutes)) * ratio;
  }
  return null;
}

function taperSoc(series, peakPowerKw) {
  if (!(peakPowerKw > 0)) return null;
  const threshold = peakPowerKw * .8;
  const peakIndex = series.reduce((best, point, index) => Number(point?.powerKw) > Number(series[best]?.powerKw) ? index : best, 0);
  for (let index = peakIndex + 1; index < series.length - 2; index += 1) {
    const window = series.slice(index, index + 3);
    if (window.every((point) => finite(point?.powerKw) && Number(point.powerKw) <= threshold) && finite(series[index]?.socPct)) return Number(series[index].socPct);
  }
  return null;
}

export function analyseChargeSession(charge) {
  const series = rows(charge?.series).filter((point) => finite(point?.elapsedMinutes) && finite(point?.socPct) && finite(point?.powerKw)).sort((a, b) => Number(a.elapsedMinutes) - Number(b.elapsedMinutes));
  const peakPowerKw = finite(charge?.maxPowerKw) ? Number(charge.maxPowerKw) : Math.max(...series.map((point) => Number(point.powerKw)), 0);
  const at10 = crossing(series, 10), at20 = crossing(series, 20), at80 = crossing(series, 80);
  return {
    chargeId: charge?.chargeId || "",
    hasSeries: series.length > 1,
    tenToEightyMinutes: at10 != null && at80 != null && at80 >= at10 ? at80 - at10 : null,
    twentyToEightyMinutes: at20 != null && at80 != null && at80 >= at20 ? at80 - at20 : null,
    taperSocPct: charge?.chargeType === "DC" ? taperSoc(series, peakPowerKw) : null,
    peakPowerKw,
    averagePowerKw: finite(charge?.avgPowerKw) ? Number(charge.avgPowerKw) : median(series.map((point) => point.powerKw)),
    temperatureRiseC: finite(charge?.batteryTempStartC) && finite(charge?.batteryTempEndC) ? Number(charge.batteryTempEndC) - Number(charge.batteryTempStartC) : null,
  };
}

export function buildChargeComparison(charges) {
  const selected = rows(charges).slice(0, 3);
  const analyses = selected.map(analyseChargeSession);
  const bySoc = new Map();
  selected.forEach((charge, sessionIndex) => {
    const bestByBin = new Map();
    rows(charge?.series).forEach((point) => {
      if (!finite(point?.socPct) || !finite(point?.powerKw)) return;
      const soc = Math.max(0, Math.min(100, Math.round(Number(point.socPct))));
      const existing = bestByBin.get(soc);
      if (!existing || Number(point.powerKw) > Number(existing.powerKw)) bestByBin.set(soc, point);
    });
    bestByBin.forEach((point, soc) => {
      const row = bySoc.get(soc) || { socPct: soc };
      row[`session${sessionIndex + 1}`] = Number(point.powerKw);
      bySoc.set(soc, row);
    });
  });
  return { analyses, curve: [...bySoc.values()].sort((a, b) => a.socPct - b.socPct) };
}
