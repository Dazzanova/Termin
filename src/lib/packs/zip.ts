/**
 * A minimal ZIP writer for the starter-pack fallback.
 *
 * The archive is the only reason this exists: browsers without the File
 * System Access API cannot write into a folder, so they download a zip
 * instead. Every entry is stored uncompressed (method 0), which keeps the
 * writer to a few dozen lines and makes the output reproducible — no
 * dependency, no timestamps beyond a fixed DOS epoch.
 */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);

  for (let index = 0; index < 256; index += 1) {
    let value = index;

    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }

    table[index] = value >>> 0;
  }

  return table;
})();

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;

  for (const byte of bytes) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

/** Fixed 1980-01-01 so two builds of the same pack produce identical bytes. */
const DOS_TIME = 0;
const DOS_DATE = (1 << 5) | 1;

const UTF8_FLAG = 0x0800;
const STORED = 0;

type Entry = {
  name: string;
  contents: string;
};

function header(size: number): { bytes: Uint8Array; view: DataView } {
  const bytes = new Uint8Array(size);
  return { bytes, view: new DataView(bytes.buffer) };
}

export function createZip(entries: Entry[], root: string): Uint8Array {
  const encoder = new TextEncoder();
  const prepared = entries.map((entry) => {
    const name = encoder.encode(`${root}/${entry.name}`);
    const data = encoder.encode(entry.contents);

    return {
      name,
      data,
      crc: crc32(data),
    };
  });

  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const entry of prepared) {
    const local = header(30 + entry.name.length);
    local.view.setUint32(0, 0x04034b50, true);
    local.view.setUint16(4, 20, true);
    local.view.setUint16(6, UTF8_FLAG, true);
    local.view.setUint16(8, STORED, true);
    local.view.setUint16(10, DOS_TIME, true);
    local.view.setUint16(12, DOS_DATE, true);
    local.view.setUint32(14, entry.crc, true);
    local.view.setUint32(18, entry.data.length, true);
    local.view.setUint32(22, entry.data.length, true);
    local.view.setUint16(26, entry.name.length, true);
    local.view.setUint16(28, 0, true);
    local.bytes.set(entry.name, 30);

    const central = header(46 + entry.name.length);
    central.view.setUint32(0, 0x02014b50, true);
    central.view.setUint16(4, 20, true);
    central.view.setUint16(6, 20, true);
    central.view.setUint16(8, UTF8_FLAG, true);
    central.view.setUint16(10, STORED, true);
    central.view.setUint16(12, DOS_TIME, true);
    central.view.setUint16(14, DOS_DATE, true);
    central.view.setUint32(16, entry.crc, true);
    central.view.setUint32(20, entry.data.length, true);
    central.view.setUint32(24, entry.data.length, true);
    central.view.setUint16(28, entry.name.length, true);
    central.view.setUint16(30, 0, true);
    central.view.setUint16(32, 0, true);
    central.view.setUint16(34, 0, true);
    central.view.setUint16(36, 0, true);
    central.view.setUint32(38, 0, true);
    central.view.setUint32(42, offset, true);
    central.bytes.set(entry.name, 46);

    localParts.push(local.bytes, entry.data);
    centralParts.push(central.bytes);

    offset += local.bytes.length + entry.data.length;
  }

  const centralSize = centralParts.reduce(
    (total, part) => total + part.length,
    0
  );
  const end = header(22);
  end.view.setUint32(0, 0x06054b50, true);
  end.view.setUint16(4, 0, true);
  end.view.setUint16(6, 0, true);
  end.view.setUint16(8, prepared.length, true);
  end.view.setUint16(10, prepared.length, true);
  end.view.setUint32(12, centralSize, true);
  end.view.setUint32(16, offset, true);
  end.view.setUint16(20, 0, true);

  const parts = [...localParts, ...centralParts, end.bytes];
  const total = parts.reduce((length, part) => length + part.length, 0);
  const archive = new Uint8Array(total);
  let cursor = 0;

  for (const part of parts) {
    archive.set(part, cursor);
    cursor += part.length;
  }

  return archive;
}
