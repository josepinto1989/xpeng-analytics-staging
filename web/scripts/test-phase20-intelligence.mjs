import assert from "node:assert/strict";
import { assessBatteryHealth } from "../src/battery-health.js";
import { buildRouteIntelligence, routeMetricColor } from "../src/route-intelligence.js";
import { buildTyreObservations } from "../src/tyre-observations.js";

const route=buildRouteIntelligence([[{lat:38.7,lon:-9.1,timestampUtc:"2026-10-01T08:00:00Z",elevationM:20,gpsSpeedKmh:30},{lat:38.701,lon:-9.101,timestampUtc:"2026-10-01T08:01:00Z",elevationM:35,gpsSpeedKmh:60}]], [{timestampUtc:"2026-10-01T08:00:00Z",powerKw:12,speedKmh:30},{timestampUtc:"2026-10-01T08:01:00Z",powerKw:-20,speedKmh:60}]);
assert.equal(route.available.elevation,true);assert.equal(route.available.regeneration,true);assert.equal(route.elevation.length,2);assert.ok(route.points[1].distanceKm>0);assert.match(routeMetricColor("speed",60),/^#[0-9a-f]{6}$/i);
const tyres=buildTyreObservations([{date:"2026-10-01",averageKpa:255,frontImbalanceKpa:3,rearImbalanceKpa:2},{date:"2026-10-10",averageKpa:250,frontImbalanceKpa:13,rearImbalanceKpa:2},{date:"2026-10-20",averageKpa:240,frontImbalanceKpa:14,rearImbalanceKpa:2},{date:"2026-10-25",averageKpa:232,frontImbalanceKpa:15,rearImbalanceKpa:2}]);
assert.ok(tyres.observations.some((row)=>row.kind==="pressureDrop"));assert.ok(tyres.observations.some((row)=>row.kind==="persistentImbalance"));
const health=assessBatteryHealth(Array.from({length:8},(_,index)=>({date:`2026-${String(index+1).padStart(2,"0")}-01`,capacityKwh:68+index*.05,socGainPct:50,rollingCapacityKwh:68+index*.05})));
assert.ok(health.uncertaintyKwh>=0);assert.ok(health.lowerCapacityKwh<=health.upperCapacityKwh);assert.ok(health.reasons.includes("narrowInterval"));
console.log("Phase 20 route, tyre and battery intelligence passed.");
