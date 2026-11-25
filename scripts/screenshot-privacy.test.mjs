import assert from "node:assert/strict";
import test from "node:test";
import { findScreenshotLocationMetadata } from "./screenshot-privacy.mjs";

function pngChunk(type, value) {
  const data = Buffer.from(value);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  return Buffer.concat([length, Buffer.from(type), data, Buffer.alloc(4)]);
}

function png(...chunks) {
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    ...chunks,
    pngChunk("IEND", ""),
  ]);
}

function jpegSection(marker, value) {
  const content = Buffer.from(value);
  const length = Buffer.alloc(2);
  length.writeUInt16BE(content.length + 2);
  return Buffer.concat([Buffer.from([255, marker]), length, content]);
}

function jpeg(...parts) {
  return Buffer.concat([Buffer.from([255, 216]), ...parts, Buffer.from([255, 217])]);
}

test("accepts generic chart metadata without a geolocation field", () => {
  const chart = png(
    pngChunk("tEXt", "Software\0Matplotlib"),
    pngChunk("iTXt", "Description\0Performance chart"),
  );
  assert.deepEqual(findScreenshotLocationMetadata(chart), []);
});

test("rejects PNG EXIF, GPS labels and XMP fields", () => {
  assert.ok(findScreenshotLocationMetadata(png(pngChunk("eXIf", "Exif"))).length);
  assert.ok(findScreenshotLocationMetadata(png(pngChunk("tEXt", "GPSLatitude\0redacted"))).length);
  assert.ok(
    findScreenshotLocationMetadata(png(pngChunk("iTXt", "XML:com.adobe.xmp\0data"))).length,
  );
});

test("rejects JPEG EXIF and IPTC while allowing non-private JFIF", () => {
  assert.ok(findScreenshotLocationMetadata(jpeg(jpegSection(225, "Exif\0\0"))).length);
  assert.ok(findScreenshotLocationMetadata(jpeg(jpegSection(237, "IPTC"))).length);
  assert.deepEqual(findScreenshotLocationMetadata(jpeg(jpegSection(224, "JFIF"))), []);
});

test("rejects WebP EXIF while allowing ordinary WebP chunks", () => {
  const webp = (code) => {
    const payload = Buffer.from("test");
    const length = Buffer.alloc(4);
    length.writeUInt32LE(4 + 8 + payload.length);
    const chunkLength = Buffer.alloc(4);
    chunkLength.writeUInt32LE(payload.length);
    return Buffer.concat([
      Buffer.from("RIFF"),
      length,
      Buffer.from("WEBP"),
      Buffer.from(code),
      chunkLength,
      payload,
    ]);
  };
  assert.ok(findScreenshotLocationMetadata(webp("EXIF")).length);
  assert.deepEqual(findScreenshotLocationMetadata(webp("VP8 ")), []);
});

test("fails closed for unknown and malformed images", () => {
  assert.ok(findScreenshotLocationMetadata(Buffer.from("not-an-image")).length);
  assert.ok(
    findScreenshotLocationMetadata(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 20, ...Buffer.from("tEXt")]),
    ).length,
  );
});
