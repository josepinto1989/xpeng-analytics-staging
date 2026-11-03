import assert from "node:assert/strict";
import { aggregateBands, bandStart } from "../src/distribution-bands.js";

assert.equal(bandStart("10–25"), 10);
assert.equal(bandStart("150+"), 150);
assert.deepEqual(
  aggregateBands([
    { band: "25–50", seconds: 30 },
    { band: "0–10", seconds: 60 },
    { band: "10–25", seconds: 30 },
    { band: "10–25", seconds: 30 },
    { band: "75–100", seconds: 15 },
    { band: "50–75", seconds: 20 },
  ]),
  [
    { band: "0–10", minutes: 1 },
    { band: "10–25", minutes: 1 },
    { band: "25–50", minutes: .5 },
    { band: "50–75", minutes: 1 / 3 },
    { band: "75–100", minutes: .25 },
  ],
);

console.log("Driving distribution bands passed.");
