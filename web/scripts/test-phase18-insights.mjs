import { analyseChargeSession, buildChargeComparison } from "../src/charging-lab.js";
import { buildParkingInvestigation } from "../src/parking-investigator.js";
import { comparePeriods, comparisonDefaults } from "../src/period-comparison.js";
import { assessDataProtection } from "../src/data-protection.js";

const charge = { chargeId:"c1", chargeType:"DC", maxPowerKw:100, avgPowerKw:70, batteryTempStartC:20, batteryTempEndC:30, series:[
  {elapsedMinutes:0,socPct:10,powerKw:95},{elapsedMinutes:10,socPct:40,powerKw:100},{elapsedMinutes:20,socPct:70,powerKw:90},{elapsedMinutes:25,socPct:80,powerKw:70},{elapsedMinutes:30,socPct:90,powerKw:55},{elapsedMinutes:35,socPct:95,powerKw:45},
] };
const analysed=analyseChargeSession(charge);
if(Math.round(analysed.tenToEightyMinutes)!==25||analysed.taperSocPct!==80)throw new Error("Charging Lab window or taper calculation failed");
if(buildChargeComparison([charge]).curve.length<4)throw new Error("Charging Lab curve failed");

const parking=buildParkingInvestigation([
  {startedAtUtc:"2026-10-01T22:00:00Z",endedAtUtc:"2026-10-02T07:00:00Z",durationHours:9,coveragePct:90,socLossPerDay:.5,averageWatts:100},
  {startedAtUtc:"2026-10-02T22:00:00Z",endedAtUtc:"2026-10-03T07:00:00Z",durationHours:9,coveragePct:90,socLossPerDay:2,averageWatts:300},
]);
if(parking.nights.length!==2||parking.worst.socLossPerDay!==2)throw new Error("Parking investigation failed");

const data={daily:[{date:"2026-09-01",distanceKm:100,netEnergyKwh:20,drivingHours:2,regeneratedKwh:2},{date:"2026-10-01",distanceKm:120,netEnergyKwh:18,drivingHours:2,regeneratedKwh:3}],journeys:[{date:"2026-09-01"},{date:"2026-10-01"}],charges:[],battery:{parking:[]}};
const compared=comparePeriods(data,{start:"2026-09-01",end:"2026-09-30"},{start:"2026-10-01",end:"2026-10-31"});
if(compared.a.distanceKm!==100||compared.b.distanceKm!==120||Math.round(compared.differences.distanceKm)!==20)throw new Error("Period comparison failed");
if(compared.differences.parkedLossPctPerDay!==null)throw new Error("Missing period metrics must not be reported as a 100% change");
const shortDefaults=comparisonDefaults("2026-10-01","2026-10-10");
if(shortDefaults.a.start>shortDefaults.a.end||shortDefaults.b.start>shortDefaults.b.end)throw new Error("Short-history comparison defaults are invalid");

const protection=assessDataProtection({overview:{firstUtc:"2026-10-01T00:00:00Z",lastUtc:"2026-10-20T00:00:00Z"},imports:[],quality:{coverage:[],events:[]}},{now:Date.parse("2026-10-25T00:00:00Z"),persistence:{enabled:true,hasSavedHistory:true}});
if(Math.round(protection.recoverableDays)!==25||protection.level!=="good")throw new Error("Data protection assessment failed");

console.log("Phase 18 analytics tests passed.");
