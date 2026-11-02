import { chargeCostBreakdown, ownershipMaps } from "./ownership-metadata.js";

const rows = (value) => Array.isArray(value) ? value : [];

function endpoints(journey) {
  const points = rows(journey?.gps?.segments).flatMap(rows).filter((point) => Number.isFinite(Number(point?.lat)) && Number.isFinite(Number(point?.lon)));
  if (!points.length) return null;
  const key = (point) => `${Number(point.lat).toFixed(3)},${Number(point.lon).toFixed(3)}`;
  return { start: key(points[0]), end: key(points.at(-1)) };
}

function fallbackSignature(journey) {
  const distance = Math.round((Number(journey?.distanceKm) || 0) / 2) * 2, duration = Math.round((Number(journey?.durationMinutes) || 0) / 5) * 5;
  const match = String(journey?.startedAtUtc || "").match(/T(\d{2}):/), hour = match ? Number(match[1]) : NaN;
  const odometer = Number(journey?.odometerKm ?? journey?.odometerStartKm);
  return `${distance}|${duration}|${Number.isFinite(hour) ? hour : ""}|${Number.isFinite(odometer) ? Math.round(odometer / 10) * 10 : ""}`;
}

export function journeySuggestions(selected, journeys, ownershipValue) {
  const maps = ownershipMaps(ownershipValue), selectedEndpoints = endpoints(selected), selectedFallback = fallbackSignature(selected), origins = new Map(), destinations = new Map(), kinds = new Map();
  const add = (map, value) => { if (value) map.set(value, (map.get(value) || 0) + 1); };
  rows(journeys).forEach((journey) => {
    if (!journey?.journeyId || journey.journeyId === selected?.journeyId) return;
    const details = maps.journeys.get(journey.journeyId); if (!details) return;
    const candidateEndpoints = endpoints(journey), sameStart = selectedEndpoints && candidateEndpoints?.start === selectedEndpoints.start, sameEnd = selectedEndpoints && candidateEndpoints?.end === selectedEndpoints.end;
    const sameFallback = !selectedEndpoints && fallbackSignature(journey) === selectedFallback;
    if (sameStart || sameFallback) add(origins, details.origin);
    if (sameEnd || sameFallback) add(destinations, details.destination);
    if ((sameStart && sameEnd) || sameFallback) add(kinds, details.kind);
  });
  const ranked = (map) => [...map].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count || a.value.localeCompare(b.value)).slice(0, 3);
  return { origins: ranked(origins), destinations: ranked(destinations), kinds: ranked(kinds), source: selectedEndpoints ? "gps" : "pattern" };
}

export function ownershipCostSummary(charges, ownershipValue) {
  const totals = new Map(), currencies = new Set(); let cost = 0, priced = 0;
  rows(charges).forEach((charge) => {
    const result = chargeCostBreakdown(charge, ownershipValue), category = result.metadata.category || "unlabelled";
    if (result.cost == null) return;
    priced += 1; cost += result.cost; if (result.tariff?.currency) currencies.add(result.tariff.currency);
    const current = totals.get(category) || { category, sessions: 0, energyKwh: 0, cost: 0 };
    current.sessions += 1; current.energyKwh += Number(charge.wallEnergyKwh) || 0; current.cost += result.cost; totals.set(category, current);
  });
  return { cost, priced, currencies: [...currencies], categories: [...totals.values()].sort((a, b) => b.cost - a.cost) };
}

export function reminderState(reminder, { today = new Date().toISOString().slice(0, 10), odometerKm = null } = {}) {
  if (reminder?.completed) return "completed";
  const days = reminder?.dueDate ? Math.ceil((Date.parse(`${reminder.dueDate}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86_400_000) : null;
  const km = reminder?.dueOdometerKm != null && Number.isFinite(Number(odometerKm)) ? Number(reminder.dueOdometerKm) - Number(odometerKm) : null;
  if ((days != null && days < 0) || (km != null && km < 0)) return "overdue";
  if ((days != null && days <= 30) || (km != null && km <= 1_000)) return "soon";
  return "scheduled";
}
