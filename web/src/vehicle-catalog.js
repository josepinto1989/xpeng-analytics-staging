const XPENG_G6_2024_SOURCE = "https://s-cdn.xpeng.com/commoncms/prod/2025-05-21/206396d2a8934ed588fbd6218d333533.pdf";
const XPENG_G6_2025_SOURCE = "https://s-cdn.xpeng.com/commoncms/prod/2026-02-17/1e59f0f585b946bab92a490f63db1d8c.pdf";
const XPENG_G9_2024_SOURCE = "https://s-cdn.xpeng.com/commoncms/prod/2025-05-21/c4e7464cd68c4ca892e2b8b6feab7c87.pdf";
const XPENG_G9_2025_SOURCE = "https://s-cdn.xpeng.com/commoncms/prod/2026-02-17/29c223a7813c40d5976fd1717282436a.pdf";
const XPENG_P7_SOURCE = "https://store.xpeng.com/de/configurator/p7";

export const VEHICLE_VARIANTS = [
  { id: "g6-2024-standard", model: "G6", generation: "2024", variant: "RWD Standard Range", chemistry: "LFP", usableCapacityKwh: 66, sourceUrl: XPENG_G6_2024_SOURCE },
  { id: "g6-2024-long", model: "G6", generation: "2024", variant: "RWD Long Range", chemistry: "NCM", usableCapacityKwh: 87.5, sourceUrl: XPENG_G6_2024_SOURCE },
  { id: "g6-2024-performance", model: "G6", generation: "2024", variant: "AWD Performance", chemistry: "NCM", usableCapacityKwh: 87.5, sourceUrl: XPENG_G6_2024_SOURCE },
  { id: "g6-2025-standard", model: "G6", generation: "2025 facelift", variant: "RWD Standard Range", chemistry: "LFP", usableCapacityKwh: 67.8, sourceUrl: XPENG_G6_2025_SOURCE },
  { id: "g6-2025-long", model: "G6", generation: "2025 facelift", variant: "RWD Long Range", chemistry: "LFP", usableCapacityKwh: 80, sourceUrl: XPENG_G6_2025_SOURCE },
  { id: "g6-2025-performance", model: "G6", generation: "2025 facelift", variant: "AWD Performance", chemistry: "LFP", usableCapacityKwh: 80, sourceUrl: XPENG_G6_2025_SOURCE },
  { id: "g9-2024-standard", model: "G9", generation: "2024", variant: "RWD Standard Range", chemistry: "LFP", usableCapacityKwh: 75.8, sourceUrl: XPENG_G9_2024_SOURCE },
  { id: "g9-2024-long", model: "G9", generation: "2024", variant: "RWD Long Range", chemistry: "NCM", usableCapacityKwh: 93.1, sourceUrl: XPENG_G9_2024_SOURCE },
  { id: "g9-2024-performance", model: "G9", generation: "2024", variant: "AWD Performance", chemistry: "NCM", usableCapacityKwh: 93.1, sourceUrl: XPENG_G9_2024_SOURCE },
  { id: "g9-2025-standard", model: "G9", generation: "2025 facelift", variant: "RWD Standard Range", chemistry: "LFP", usableCapacityKwh: 78.2, sourceUrl: XPENG_G9_2025_SOURCE },
  { id: "g9-2025-long", model: "G9", generation: "2025 facelift", variant: "RWD Long Range", chemistry: "LFP", usableCapacityKwh: 92.2, sourceUrl: XPENG_G9_2025_SOURCE },
  { id: "g9-2025-performance", model: "G9", generation: "2025 facelift", variant: "AWD Performance", chemistry: "LFP", usableCapacityKwh: 92.2, sourceUrl: XPENG_G9_2025_SOURCE },
  { id: "p7-2024-long", model: "P7", generation: "2024", variant: "RWD Long Range", chemistry: "NCM", usableCapacityKwh: 82.7, sourceUrl: XPENG_P7_SOURCE },
  { id: "p7-2024-performance", model: "P7", generation: "2024", variant: "AWD Performance", chemistry: "NCM", usableCapacityKwh: 82.7, sourceUrl: XPENG_P7_SOURCE },
];

export const vehicleVariant = (id) => VEHICLE_VARIANTS.find((item) => item.id === id) || null;

export function resolvedVehicleProfile(profile) {
  const selected = vehicleVariant(profile?.variantId);
  if (selected) return { ...selected, sourceKind: "official" };
  const usableCapacityKwh = Number(profile?.usableCapacityKwh);
  if (profile?.variantId === "custom" && Number.isFinite(usableCapacityKwh) && usableCapacityKwh >= 20 && usableCapacityKwh <= 200) {
    return { id: "custom", model: String(profile?.customModel || "XPENG").trim().slice(0, 60) || "XPENG", generation: "", variant: "", chemistry: "", usableCapacityKwh, sourceUrl: "", sourceKind: "owner" };
  }
  return null;
}

export function vehicleProfileLabel(profile) {
  const resolved = resolvedVehicleProfile(profile);
  if (!resolved) return "";
  return [resolved.model, resolved.generation, resolved.variant].filter(Boolean).join(" · ");
}
