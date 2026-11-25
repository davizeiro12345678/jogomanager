import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const sensitiveKey = /(?:^|[^a-z])(?:gps(?:latitude|longitude|info)?|geolocation|latitude|longitude|location|address|coordinates)(?:$|[^a-z])/i;
const sensitiveValue = /\b(?:GPSLatitude|GPSLongitude|GPSInfo|GPSPosition|geolocation|latitude|longitude|physical.address|street.address)\b/i;

/** Metadata-only guard. Does NOT detect addresses rendered into image pixels. */
export function findScreenshotLocationMetadata(bytes) {
  if (!Buffer.isBuffer(bytes)) throw new TypeError("Expected a Buffer");
  const issues = [];
  if (bytes.subarray(0, 8).equals(pngSignature)) {
    let offset = 8;
    let ended = false;
    while (offset + 12 <= bytes.length) {
      const length = bytes.readUInt32BE(offset);
      if (length > bytes.length - offset - 12) {
        issues.push("Malformed PNG chunk length");
        break;
      }
      const type = bytes.toString("ascii", offset + 4, offset + 8);
      const value = bytes.subarray(offset + 8, offset + 8 + length);
      if (type === "eXIf") issues.push("Embedded EXIF in PNG");
      if (["tEXt", "iTXt", "zTXt"].includes(type)) {
        const separator = value.indexOf(0);
        const keyword = value.toString("utf8", 0, separator < 0 ? value.length : separator);
        if (sensitiveKey.test(keyword) || /(?:adobe\.xmp|XMP)/i.test(keyword)) {
          issues.push("Sensitive PNG metadata field");
        } else if (type === "tEXt" && sensitiveValue.test(value.toString("utf8"))) {
          issues.push("Location identifiers in PNG text");
        }
      }
      offset += length + 12;
      if (type === "IEND") {
        ended = true;
        break;
      }
    }
    if (!ended) issues.push("Truncated PNG or missing IEND");
    return issues;
  }
  if (bytes.length >= 2 && bytes[0] === 255 && bytes[1] === 216) {
    let offset = 2;
    while (offset + 4 <= bytes.length) {
      if (bytes[offset] !== 255) {
        issues.push("Malformed JPEG marker");
        break;
      }
      const marker = bytes[offset + 1];
      offset += 2;
      if (marker === 217 || marker === 218) break;
      if (marker === 1 || (marker >= 208 && marker <= 215)) continue;
      const length = bytes.readUInt16BE(offset);
      if (length < 2 || length > bytes.length - offset) {
        issues.push("Malformed JPEG metadata length");
        break;
      }
      const segment = bytes.subarray(offset + 2, offset + length);
      if (marker === 225 || marker === 237) {
        issues.push("EXIF/XMP/IPTC metadata in JPEG");
      } else if (marker === 254 && sensitiveValue.test(segment.toString("utf8"))) {
        issues.push("Location identifiers in JPEG comment");
      }
      offset += length;
    }
    return issues;
  }
  if (
    bytes.length >= 12 &&
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP"
  ) {
    let offset = 12;
    while (offset + 8 <= bytes.length) {
      const type = bytes.toString("ascii", offset, offset + 4);
      const length = bytes.readUInt32LE(offset + 4);
      if (length > bytes.length - offset - 8) {
        issues.push("Malformed WebP metadata length");
        break;
      }
      if (type === "EXIF" || type === "XMP ") issues.push("EXIF/XMP metadata in WebP");
      offset += 8 + length + (length % 2);
    }
    return issues;
  }
  if (bytes.toString("ascii", 0, 3) === "GIF") {
    if (sensitiveValue.test(bytes.toString("latin1"))) {
      issues.push("Location identifiers in GIF metadata");
    }
    return issues;
  }
  return ["Unsupported screenshot format"];
}

export function scanTrackedScreenshots() {
  const filenames = execFileSync("git", ["ls-files", "-z", "--", "verification/"], {
    maxBuffer: 5 * 1024 * 1024,
  })
    .toString("utf8")
    .split("\0")
    .filter((path) => /\.(?:png|jpe?g|webp|gif)$/i.test(path));
  const violations = [];
  for (const path of filenames) {
    for (const reason of findScreenshotLocationMetadata(readFileSync(path))) {
      violations.push({ path, reason });
    }
  }
  return { scanned: filenames.length, violations };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { scanned, violations } = scanTrackedScreenshots();
  console.log("Screenshot metadata privacy: " + scanned + " files, " + violations.length + " issues");
  for (const item of violations) console.error(item.path + ": " + item.reason);
  if (violations.length) process.exitCode = 1;
}
