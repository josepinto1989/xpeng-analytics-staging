const encoder = new TextEncoder();

const SHA256_K = new Uint32Array([
  0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
  0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
  0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
  0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
  0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
  0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
  0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
  0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2,
]);

const rotr = (value, bits) => (value >>> bits) | (value << (32 - bits));

export class IncrementalSha256 {
  constructor() {
    this.state = new Uint32Array([0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]);
    this.buffer = new Uint8Array(64);
    this.bufferLength = 0;
    this.bytes = 0;
    this.finished = false;
  }

  update(input) {
    if (this.finished) throw new Error("sha256_finalised");
    const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
    this.bytes += bytes.byteLength;
    let offset = 0;
    while (offset < bytes.length) {
      const count = Math.min(64 - this.bufferLength, bytes.length - offset);
      this.buffer.set(bytes.subarray(offset, offset + count), this.bufferLength);
      this.bufferLength += count;
      offset += count;
      if (this.bufferLength === 64) { this.process(this.buffer); this.bufferLength = 0; }
    }
    return this;
  }

  process(block) {
    const words = new Uint32Array(64), view = new DataView(block.buffer, block.byteOffset, 64);
    for (let index = 0; index < 16; index++) words[index] = view.getUint32(index * 4, false);
    for (let index = 16; index < 64; index++) {
      const a = words[index - 15], b = words[index - 2];
      const s0 = rotr(a, 7) ^ rotr(a, 18) ^ (a >>> 3), s1 = rotr(b, 17) ^ rotr(b, 19) ^ (b >>> 10);
      words[index] = (words[index - 16] + s0 + words[index - 7] + s1) >>> 0;
    }
    let [a,b,c,d,e,f,g,h] = this.state;
    for (let index = 0; index < 64; index++) {
      const s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25), choose = (e & f) ^ (~e & g);
      const t1 = (h + s1 + choose + SHA256_K[index] + words[index]) >>> 0;
      const s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22), majority = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (s0 + majority) >>> 0;
      h=g; g=f; f=e; e=(d+t1)>>>0; d=c; c=b; b=a; a=(t1+t2)>>>0;
    }
    this.state[0]=(this.state[0]+a)>>>0; this.state[1]=(this.state[1]+b)>>>0;
    this.state[2]=(this.state[2]+c)>>>0; this.state[3]=(this.state[3]+d)>>>0;
    this.state[4]=(this.state[4]+e)>>>0; this.state[5]=(this.state[5]+f)>>>0;
    this.state[6]=(this.state[6]+g)>>>0; this.state[7]=(this.state[7]+h)>>>0;
  }

  digestHex() {
    if (!this.finished) {
      const bitLength = this.bytes * 8, paddingLength = this.bufferLength < 56 ? 64 : 128;
      const final = new Uint8Array(paddingLength);
      final.set(this.buffer.subarray(0, this.bufferLength)); final[this.bufferLength] = 0x80;
      const view = new DataView(final.buffer);
      view.setUint32(paddingLength - 8, Math.floor(bitLength / 0x100000000), false);
      view.setUint32(paddingLength - 4, bitLength >>> 0, false);
      for (let offset = 0; offset < final.length; offset += 64) this.process(final.subarray(offset, offset + 64));
      this.finished = true;
    }
    return [...this.state].map((value) => value.toString(16).padStart(8, "0")).join("");
  }
}

const CRC_TABLE = new Uint32Array(256);
for (let index = 0; index < 256; index++) {
  let value = index;
  for (let bit = 0; bit < 8; bit++) value = (value & 1) ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  CRC_TABLE[index] = value >>> 0;
}

export function updateCrc32(current, bytes) {
  let value = current;
  for (let index = 0; index < bytes.length; index++) value = CRC_TABLE[(value ^ bytes[index]) & 0xff] ^ (value >>> 8);
  return value >>> 0;
}

export class ExportFileBuilder {
  constructor(name, type = "text/csv;charset=utf-8") {
    this.name = name;
    this.type = type;
    this.parts = [];
    this.bytes = 0;
    this.crc = 0xffffffff;
    this.sha = new IncrementalSha256();
  }

  appendBytes(bytes) {
    const value = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    if (!value.length) return;
    this.parts.push(value); this.bytes += value.byteLength;
    this.crc = updateCrc32(this.crc, value); this.sha.update(value);
  }

  appendText(value) { this.appendBytes(encoder.encode(value)); }

  finish(extra = {}) {
    return { name: this.name, blob: new Blob(this.parts, { type: this.type }), bytes: this.bytes, crc32: (this.crc ^ 0xffffffff) >>> 0, sha256: this.sha.digestHex(), ...extra };
  }
}

function dosDateTime(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  return { time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2), date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate() };
}

function localHeader(file, nameBytes, stamp) {
  const output = new Uint8Array(30), view = new DataView(output.buffer);
  view.setUint32(0, 0x04034b50, true); view.setUint16(4, 20, true); view.setUint16(6, 0x0800, true);
  view.setUint16(8, 0, true); view.setUint16(10, stamp.time, true); view.setUint16(12, stamp.date, true);
  view.setUint32(14, file.crc32, true); view.setUint32(18, file.bytes, true); view.setUint32(22, file.bytes, true);
  view.setUint16(26, nameBytes.length, true); return output;
}

function centralHeader(file, nameBytes, stamp, offset) {
  const output = new Uint8Array(46), view = new DataView(output.buffer);
  view.setUint32(0, 0x02014b50, true); view.setUint16(4, 20, true); view.setUint16(6, 20, true); view.setUint16(8, 0x0800, true);
  view.setUint16(10, 0, true); view.setUint16(12, stamp.time, true); view.setUint16(14, stamp.date, true);
  view.setUint32(16, file.crc32, true); view.setUint32(20, file.bytes, true); view.setUint32(24, file.bytes, true);
  view.setUint16(28, nameBytes.length, true); view.setUint32(42, offset, true); return output;
}

export function createStoredZip(files, date = new Date()) {
  const parts = [], central = [], stamp = dosDateTime(date); let offset = 0, centralBytes = 0;
  for (const file of files) {
    if (!Number.isSafeInteger(file.bytes) || file.bytes < 0 || file.bytes > 0xffffffff) throw new Error("csv_export_too_large");
    const name = encoder.encode(file.name), local = localHeader(file, name, stamp), directory = centralHeader(file, name, stamp, offset);
    parts.push(local, name, file.blob); central.push(directory, name);
    offset += local.byteLength + name.byteLength + file.bytes;
    centralBytes += directory.byteLength + name.byteLength;
  }
  if (offset > 0xffffffff || centralBytes > 0xffffffff || files.length > 0xffff) throw new Error("csv_export_too_large");
  const end = new Uint8Array(22), view = new DataView(end.buffer);
  view.setUint32(0, 0x06054b50, true); view.setUint16(8, files.length, true); view.setUint16(10, files.length, true);
  view.setUint32(12, centralBytes, true); view.setUint32(16, offset, true);
  return new Blob([...parts, ...central, end], { type: "application/zip" });
}

export function csvCell(value) {
  if (value == null || value === "" || (typeof value === "number" && !Number.isFinite(value))) return "";
  const isText = typeof value === "string";
  let text = String(value);
  if (isText && /^[=+\-@]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
