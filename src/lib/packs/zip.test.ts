import { describe, expect, it } from "vitest";
import { createZip, crc32 } from "./zip";

const LOCAL_SIGNATURE = 0x04034b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const END_SIGNATURE = 0x06054b50;

function readU16(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readU32(bytes: Uint8Array, offset: number): number {
  return (
    (bytes[offset] |
      (bytes[offset + 1] << 8) |
      (bytes[offset + 2] << 16) |
      (bytes[offset + 3] << 24)) >>>
    0
  );
}

function readName(bytes: Uint8Array, offset: number, length: number): string {
  return new TextDecoder().decode(bytes.slice(offset, offset + length));
}

type ParsedEntry = {
  name: string;
  contents: string;
  crc: number;
  method: number;
  flags: number;
};

function parseZip(bytes: Uint8Array): ParsedEntry[] {
  const end = bytes.length - 22;

  expect(readU32(bytes, end)).toBe(END_SIGNATURE);

  const count = readU16(bytes, end + 10);
  const centralOffset = readU32(bytes, end + 16);
  const entries: ParsedEntry[] = [];
  let cursor = centralOffset;

  for (let index = 0; index < count; index += 1) {
    expect(readU32(bytes, cursor)).toBe(CENTRAL_SIGNATURE);

    const flags = readU16(bytes, cursor + 8);
    const method = readU16(bytes, cursor + 10);
    const crc = readU32(bytes, cursor + 16);
    const compressedSize = readU32(bytes, cursor + 20);
    const uncompressedSize = readU32(bytes, cursor + 24);
    const nameLength = readU16(bytes, cursor + 28);
    const extraLength = readU16(bytes, cursor + 30);
    const commentLength = readU16(bytes, cursor + 32);
    const localOffset = readU32(bytes, cursor + 42);
    const name = readName(bytes, cursor + 46, nameLength);

    expect(readU32(bytes, localOffset)).toBe(LOCAL_SIGNATURE);
    expect(compressedSize).toBe(uncompressedSize);

    const localNameLength = readU16(bytes, localOffset + 26);
    const localExtraLength = readU16(bytes, localOffset + 28);
    const dataOffset =
      localOffset + 30 + localNameLength + localExtraLength;
    const contents = readName(bytes, dataOffset, uncompressedSize);

    expect(crc).toBe(crc32(new TextEncoder().encode(contents)));

    entries.push({ name, contents, crc, method, flags });

    cursor += 46 + nameLength + extraLength + commentLength;
  }

  return entries;
}

describe("crc32", () => {
  it("matches the standard check value", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
  });

  it("is zero for empty input", () => {
    expect(crc32(new Uint8Array())).toBe(0);
  });
});

describe("createZip", () => {
  it("stores every file under the root folder", () => {
    const bytes = createZip(
      [
        { name: "a.cpp", contents: "int main() { return 0; }\n" },
        { name: "b.cpp", contents: "// second\n" },
      ],
      "termin-cf-1987"
    );

    const entries = parseZip(bytes);

    expect(entries.map((entry) => entry.name)).toEqual([
      "termin-cf-1987/a.cpp",
      "termin-cf-1987/b.cpp",
    ]);
    expect(entries[0].contents).toBe("int main() { return 0; }\n");
    expect(entries[1].contents).toBe("// second\n");
  });

  it("writes uncompressed entries with the UTF-8 flag", () => {
    const entries = parseZip(
      createZip([{ name: "a.cpp", contents: "x" }], "pack")
    );

    expect(entries[0].method).toBe(0);
    expect(entries[0].flags & 0x0800).toBe(0x0800);
  });

  it("writes an empty archive", () => {
    expect(parseZip(createZip([], "pack"))).toEqual([]);
  });

  it("is reproducible", () => {
    const build = () =>
      createZip([{ name: "a.cpp", contents: "same" }], "pack");

    expect(Array.from(build())).toEqual(Array.from(build()));
  });
});
