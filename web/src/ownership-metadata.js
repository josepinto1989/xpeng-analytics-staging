const text = (value, max = 80) => String(value ?? "").trim().slice(0, max);
const rows = (value) => Array.isArray(value) ? value : [];
const allowedJourneyKinds = new Set(["personal", "business", "commute", "custom"]);
const allowedChargeCategories = new Set(["home", "work", "public", "custom"]);
const allowedCurrencies = new Set(["EUR", "GBP", "USD", "NOK", "SEK", "DKK", "CHF", "PLN", "CZK"]);
const allowedTariffCategories = new Set(["all", ...allowedChargeCategories]);
const allowedReminderTypes = new Set(["maintenance", "tyres", "inspection", "insurance", "odometer"]);

export const JOURNEY_LABELS = ["personal", "business", "commute", "custom"];
export const CHARGE_CATEGORIES = ["home", "work", "public", "custom"];
export const TARIFF_CURRENCIES = [...allowedCurrencies];
export const REMINDER_TYPES = [...allowedReminderTypes];

export function emptyOwnershipMetadata() {
  return { journeyLabels: [], chargeCategories: [], tariffs: [], activeTariffId: "", reminders: [] };
}

export function validateOwnershipMetadata(value) {
  const input = value && typeof value === "object" ? value : {};
  const unique = (items, mapper, limit) => {
    const output = [], seen = new Set();
    for (const item of rows(items).slice(0, limit)) {
      const mapped = mapper(item);
      if (!mapped?.id || seen.has(mapped.id)) continue;
      seen.add(mapped.id); output.push(mapped);
    }
    return output;
  };
  const journeyLabels = unique(input.journeyLabels, (item) => {
    const id = text(item?.id, 160), kind = allowedJourneyKinds.has(item?.kind) ? item.kind : "personal";
    return id ? { id, kind, label: text(item?.label), origin: text(item?.origin, 120), destination: text(item?.destination, 120), purpose: text(item?.purpose, 160), comment: text(item?.comment, 500) } : null;
  }, 20_000);
  const chargeCategories = unique(input.chargeCategories, (item) => {
    const id = text(item?.id, 160), category = allowedChargeCategories.has(item?.category) ? item.category : "home";
    const manualCost = item?.manualCost === "" || item?.manualCost == null ? null : Number(item.manualCost);
    return id ? { id, category, label: text(item?.label), free: Boolean(item?.free), manualCost: Number.isFinite(manualCost) && manualCost >= 0 && manualCost <= 100_000 ? manualCost : null, tariffId: text(item?.tariffId, 80) } : null;
  }, 20_000);
  const tariffs = unique(input.tariffs, (item) => {
    const id = text(item?.id, 80), pricePerKwh = Number(item?.pricePerKwh);
    if (!id || !Number.isFinite(pricePerKwh) || pricePerKwh < 0 || pricePerKwh > 100) return null;
    const model = item?.model === "time" ? "time" : "flat", offPeakPricePerKwh = Number(item?.offPeakPricePerKwh);
    const peakStartHour = Math.max(0, Math.min(23, Math.round(Number(item?.peakStartHour) || 17))), peakEndHour = Math.max(0, Math.min(23, Math.round(Number(item?.peakEndHour) || 22)));
    return { id, name: text(item?.name) || "Tariff", pricePerKwh, currency: allowedCurrencies.has(item?.currency) ? item.currency : "EUR", model, offPeakPricePerKwh: model === "time" && Number.isFinite(offPeakPricePerKwh) && offPeakPricePerKwh >= 0 && offPeakPricePerKwh <= 100 ? offPeakPricePerKwh : pricePerKwh, peakStartHour, peakEndHour, category: allowedTariffCategories.has(item?.category) ? item.category : "all" };
  }, 12);
  const activeTariffId = tariffs.some((item) => item.id === input.activeTariffId) ? input.activeTariffId : tariffs[0]?.id || "";
  const reminders = unique(input.reminders, (item) => {
    const id = text(item?.id, 80), type = allowedReminderTypes.has(item?.type) ? item.type : "maintenance", dueDate = /^\d{4}-\d{2}-\d{2}$/.test(String(item?.dueDate || "")) ? String(item.dueDate) : "", dueOdometerKm = Number(item?.dueOdometerKm);
    return id ? { id, type, title: text(item?.title, 120) || "Reminder", dueDate, dueOdometerKm: Number.isFinite(dueOdometerKm) && dueOdometerKm >= 0 && dueOdometerKm <= 2_000_000 ? dueOdometerKm : null, note: text(item?.note, 300), completed: Boolean(item?.completed) } : null;
  }, 100);
  return { journeyLabels, chargeCategories, tariffs, activeTariffId, reminders };
}

export function ownershipMaps(value) {
  const ownership = validateOwnershipMetadata(value);
  return {
    ownership,
    journeys: new Map(ownership.journeyLabels.map((item) => [item.id, item])),
    charges: new Map(ownership.chargeCategories.map((item) => [item.id, item])),
    activeTariff: ownership.tariffs.find((item) => item.id === ownership.activeTariffId) || null,
  };
}

export function chargeEstimatedCost(charge, tariff, metadata = {}) {
  if (metadata.free) return 0;
  if (metadata.manualCost != null && Number.isFinite(Number(metadata.manualCost))) return Math.max(0, Number(metadata.manualCost));
  const energy = Number(charge?.wallEnergyKwh);
  if (!Number.isFinite(energy) || !tariff) return null;
  let price = Number(tariff.pricePerKwh);
  if (tariff.model === "time") {
    const startedAt = new Date(charge?.startedAtUtc || ""), hour = Number.isFinite(startedAt.getTime()) ? startedAt.getHours() : NaN, start = Number(tariff.peakStartHour), end = Number(tariff.peakEndHour);
    const peak = Number.isFinite(hour) && (start === end || (start < end ? hour >= start && hour < end : hour >= start || hour < end));
    price = peak ? Number(tariff.pricePerKwh) : Number(tariff.offPeakPricePerKwh);
  }
  return Number.isFinite(price) ? Math.max(0, energy) * Math.max(0, price) : null;
}

export function chargeCostBreakdown(charge, value) {
  const maps = ownershipMaps(value), metadata = maps.charges.get(charge?.chargeId) || {};
  const tariff = maps.ownership.tariffs.find((item) => item.id === metadata.tariffId)
    || maps.ownership.tariffs.find((item) => item.category !== "all" && item.category === metadata.category)
    || maps.activeTariff;
  return { cost: chargeEstimatedCost(charge, tariff, metadata), tariff, metadata, source: metadata.free ? "free" : metadata.manualCost != null ? "manual" : tariff ? tariff.model : "none" };
}

export function upsertJourneyLabel(value, id, kind, label = "") {
  const current = validateOwnershipMetadata(value), cleanId = text(id, 160);
  const previous = current.journeyLabels.find((item) => item.id === cleanId) || {};
  const next = current.journeyLabels.filter((item) => item.id !== cleanId);
  if (cleanId && allowedJourneyKinds.has(kind)) next.push({ ...previous, id: cleanId, kind, label: text(label) });
  return validateOwnershipMetadata({ ...current, journeyLabels: next });
}

export function upsertJourneyDetails(value, id, details = {}) {
  const current = validateOwnershipMetadata(value), cleanId = text(id, 160), previous = current.journeyLabels.find((item) => item.id === cleanId) || { id: cleanId, kind: "personal", label: "" };
  const next = current.journeyLabels.filter((item) => item.id !== cleanId);
  if (cleanId) next.push({ ...previous, origin: text(details.origin, 120), destination: text(details.destination, 120), purpose: text(details.purpose, 160), comment: text(details.comment, 500) });
  return validateOwnershipMetadata({ ...current, journeyLabels: next });
}

export function upsertChargeCategory(value, id, category, label = "") {
  const current = validateOwnershipMetadata(value), cleanId = text(id, 160);
  const previous = current.chargeCategories.find((item) => item.id === cleanId) || {};
  const next = current.chargeCategories.filter((item) => item.id !== cleanId);
  if (cleanId && allowedChargeCategories.has(category)) next.push({ ...previous, id: cleanId, category, label: text(label) });
  return validateOwnershipMetadata({ ...current, chargeCategories: next });
}

export function upsertChargeCost(value, id, details = {}) {
  const current = validateOwnershipMetadata(value), cleanId = text(id, 160), previous = current.chargeCategories.find((item) => item.id === cleanId) || { id: cleanId, category: "public", label: "" };
  const next = current.chargeCategories.filter((item) => item.id !== cleanId), manualCost = details.manualCost === "" || details.manualCost == null ? null : Number(details.manualCost);
  if (cleanId) next.push({ ...previous, free: Boolean(details.free), manualCost: Number.isFinite(manualCost) ? manualCost : null, tariffId: text(details.tariffId, 80) });
  return validateOwnershipMetadata({ ...current, chargeCategories: next });
}

export function upsertReminder(value, reminder) {
  const current = validateOwnershipMetadata(value), id = text(reminder?.id, 80) || `reminder-${Date.now().toString(36)}`;
  return validateOwnershipMetadata({ ...current, reminders: [...current.reminders.filter((item) => item.id !== id), { ...reminder, id }] });
}

export function removeReminder(value, id) {
  const current = validateOwnershipMetadata(value);
  return validateOwnershipMetadata({ ...current, reminders: current.reminders.filter((item) => item.id !== id) });
}
