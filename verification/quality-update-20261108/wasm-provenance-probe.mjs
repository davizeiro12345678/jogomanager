import fs from "node:fs";
import crypto from "node:crypto";

const sha256 = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
function decodeProducers(buffer) {
  const bytes = new Uint8Array(buffer);
  let offset = 0;
  const integer = () => {
    let value = 0,
      shift = 0,
      byte;
    do {
      byte = bytes[offset++];
      value |= (byte & 127) << shift;
      shift += 7;
    } while (byte & 128);
    return value;
  };
  const string = () => {
    const length = integer();
    const value = new TextDecoder().decode(bytes.subarray(offset, offset + length));
    offset += length;
    return value;
  };
  const fields = {};
  const count = integer();
  for (let index = 0; index < count; index++) {
    const field = string(),
      values = integer();
    fields[field] = Array.from({ length: values }, () => ({ name: string(), version: string() }));
  }
  return fields;
}
const artifacts = ["../quality-baseline-20261108", "."].map((root) => {
  const path = `${root}/src/game/wasm/pkg/crowd_visibility_wasm_bg.wasm`;
  const bytes = fs.readFileSync(path);
  const module = new WebAssembly.Module(bytes);
  return {
    root,
    path,
    bytes: bytes.length,
    sha256: sha256(bytes),
    producers: WebAssembly.Module.customSections(module, "producers").map(decodeProducers),
    cargoLockSha256: sha256(fs.readFileSync(`${root}/wasm/crowd-visibility/Cargo.lock`)),
    cargoManifestSha256: sha256(fs.readFileSync(`${root}/wasm/crowd-visibility/Cargo.toml`)),
  };
});
const report = {
  capturedAt: new Date().toISOString(),
  artifacts,
  producerVersionsEqual:
    JSON.stringify(artifacts[0].producers) === JSON.stringify(artifacts[1].producers),
  cargoLockEqual: artifacts[0].cargoLockSha256 === artifacts[1].cargoLockSha256,
  cargoManifestEqual: artifacts[0].cargoManifestSha256 === artifacts[1].cargoManifestSha256,
  baselineRebuiltDuringThisCampaign: false,
  limitation:
    "Baseline was the committed binary, not rebuilt during this campaign. Embedded compiler and postprocessor versions plus checked-in Cargo lock/profile match, but historical build invocation/environment is not independently reconstructed.",
};
fs.writeFileSync(
  "verification/quality-update-20261108/wasm-artifact-provenance.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report, null, 2));
