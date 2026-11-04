import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { ExportFileBuilder, IncrementalSha256, csvCell } from "../src/engine/csv-export.js";
import { emptyState, exportConsolidatedCsv, importArchive } from "../src/engine/native-engine.js";

function storedZip(files) {
  const locals = [], centrals = []; let offset = 0;
  for (const [name, body] of Object.entries(files)) {
    const nameBytes = Buffer.from(name), data = Buffer.from(body), local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(nameBytes.length, 26);
    locals.push(local, nameBytes, data);
    const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt32LE(data.length, 20); central.writeUInt32LE(data.length, 24); central.writeUInt16LE(nameBytes.length, 28); central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBytes); offset += local.length + nameBytes.length + data.length;
  }
  const directory = Buffer.concat(centrals), end = Buffer.alloc(22), count = Object.keys(files).length;
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(count, 8); end.writeUInt16LE(count, 10); end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

function sourceFixture() {
  const start = 1_797_000_000;
  const operation = ["timer,vmodel,esp_vehspd,esp_vehlongaccel,esp_vehlateralaccel,cdcu_totalodometer,ldcu_accpedalsig,ldcu_brkpedalst,ldcu_currentgearlev,mystery_metric"];
  const energy = ["timer,vmodel,bms_battvolt,bms_battcurr,ldcu_chrgpwr,ldcu_bms_soc_disp,bms_batttempmax_gb,bms_batttempmin_gb,ldcu_dstbatdisp_dynamic"];
  const status = ["timer,vmodel,ldcu_tpmsprfl,ldcu_tpmsprfr,ldcu_tpmsprrl,ldcu_tpmsprrr"];
  for (let second = 0; second < 12; second++) {
    const timer = start + second;
    operation.push(`${timer},=G6,${second < 10 ? 40 : 0},0.1,0.05,${1000 + second / 1000},20,0,1,${second}`);
    energy.push(`${timer},=G6,400,15,0,60,25,23,330`);
    status.push(`${timer},=G6,250,251,249,250`);
  }
  return storedZip({ "driving_operation.csv": operation.join("\n"), "driving_power_energy.csv": energy.join("\n"), "driving_status.csv": status.join("\n") });
}

async function storedZipFiles(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer()), view = new DataView(bytes.buffer), decoder = new TextDecoder(), files = new Map(); let offset = 0;
  while (offset + 4 <= bytes.length && view.getUint32(offset, true) === 0x04034b50) {
    const size = view.getUint32(offset + 18, true), nameLength = view.getUint16(offset + 26, true), extraLength = view.getUint16(offset + 28, true);
    const nameStart = offset + 30, dataStart = nameStart + nameLength + extraLength, name = decoder.decode(bytes.subarray(nameStart, nameStart + nameLength));
    files.set(name, bytes.slice(dataStart, dataStart + size)); offset = dataStart + size;
  }
  return files;
}

assert.equal(new IncrementalSha256().update(new TextEncoder().encode("abc")).digestHex(), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
assert.equal(csvCell("=SUM(A1:A2)"), "'=SUM(A1:A2)");
assert.equal(csvCell(-12.5), "-12.5", "negative telemetry must remain numeric in spreadsheets");
const textBuilder = new ExportFileBuilder("test.txt"); textBuilder.appendText("abc");
assert.equal(textBuilder.finish().sha256, "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");

const source = sourceFixture();
const imported = await importArchive(emptyState(), source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength), "fixture.zip", () => {}, { mode: "desktop", memoryBudgetBytes: 2_000_000_000 });
const progress = [], exported = await exportConsolidatedCsv(imported.state, { applicationVersion: "test" }, (percent, phase) => progress.push({ percent, phase }));
assert.match(exported.filename, /^xpeng-consolidated-csv-\d{4}-\d{2}-\d{2}\.zip$/);
assert.equal(exported.manifest.format, "xpeng-analytics-consolidated-csv/v1");
assert.equal(exported.manifest.files.length, 3);
assert.ok(exported.manifest.warnings.includes("unknown_source_columns_not_retained_by_importer"));
assert.ok(progress.some((row) => row.phase === "csv_export_complete"));

const files = await storedZipFiles(exported.payload);
assert.deepEqual([...files.keys()], ["driving_operation.csv", "driving_power_energy.csv", "driving_status.csv", "manifest.json"]);
const manifest = JSON.parse(new TextDecoder().decode(files.get("manifest.json")));
for (const record of manifest.files) {
  const bytes = files.get(record.filename);
  assert.ok(bytes, `${record.filename} must exist`);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), record.sha256);
}
const operationText = new TextDecoder().decode(files.get("driving_operation.csv"));
assert.match(operationText.split("\r\n")[0], /^timestamp_utc,timer_unix,vmodel,/);
assert.ok(operationText.includes("'=G6"), "spreadsheet formulas in text fields must be neutralised");
assert.ok(!operationText.split("\r\n")[0].includes("mystery_metric"), "unknown source fields must be reported rather than silently fabricated");

console.log("Consolidated CSV export passed.");
