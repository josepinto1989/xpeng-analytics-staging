import assert from "node:assert/strict";
import { createBatteryReportPdf } from "../src/battery-report-pdf.js";

const history=Array.from({length:8},(_,index)=>({date:`2026-${String(index+1).padStart(2,"0")}-10`,capacityKwh:78.5+index*.1,rollingCapacityKwh:78.8,socGainPct:55}));
const bytes=await createBatteryReportPdf({data:{battery:{history},ownership:{vehicleProfile:{variantId:"g6-2025-long"}}},locale:"en",t:(key)=>key});
assert.ok(bytes.length>1000,"battery report should create a non-empty PDF");
assert.equal(Buffer.from(bytes).subarray(0,4).toString(),"%PDF");
console.log("battery report PDF: ok");
