import fs from "node:fs";
import crypto from "node:crypto";
import * as THREE from "three";
import { buildRigSkin } from "../../src/game/rig-skin.ts";
import { AthleteCloth } from "../../src/game/athlete-cloth.ts";
import { lookFor, proportionsFor } from "../../src/game/player-model.ts";
import { playerMaterials } from "../../src/game/player-materials.ts";

const output = process.argv[2];
if (!output) throw new Error("Expected output JSON path");
const kit = {
  base: "#0a8f3c",
  shorts: "#101418",
  socks: "#0a8f3c",
  detail: "#f5f5f2",
  pattern: "solid",
};
const clone = THREE.BufferGeometry.prototype.clone;
let copiedBytes = 0,
  cloneCount = 0;
THREE.BufferGeometry.prototype.clone = function () {
  const stack = new Error().stack ?? "";
  if (stack.includes("rig-skin.ts:")) {
    cloneCount++;
    const arrays = new Set(Object.values(this.attributes).map((attribute) => attribute.array));
    if (this.index) arrays.add(this.index.array);
    for (const attributes of Object.values(this.morphAttributes))
      for (const attribute of attributes) arrays.add(attribute.array);
    for (const array of arrays) copiedBytes += array.byteLength;
  }
  return clone.call(this);
};
const results = [];
try {
  for (const [id, keeper, radial, mergeLods, staffStyle] of [
    ["athlete", false, 16, false, undefined],
    ["keeper", true, 16, false, undefined],
    ["cinematic", false, 16, true, undefined],
    ["staff", false, 12, true, "jacket"],
    ["medium", false, 8, false, undefined],
  ]) {
    const look = lookFor(`ownership-${id}`, keeper ? "GK" : "MF", keeper);
    const p = proportionsFor(look);
    const mats = playerMaterials(look, kit, null, "alta");
    const beforeCount = cloneCount,
      beforeBytes = copiedBytes;
    const skin = buildRigSkin(
      {
        P: p,
        look,
        mats,
        hi: radial >= 12,
        segs: { radial, cap: 4 },
        jerseyInk: "#f5f5f2",
        handR: p.handR,
        handMat: keeper ? mats.glove : mats.skin,
        ...(staffStyle ? { staffStyle, trousers: true } : {}),
      },
      [12.5, 0, -7.25],
      { mergeLods },
    );
    new AthleteCloth(skin, p);
    const hash = crypto.createHash("sha256");
    let outputBytes = 0;
    const bytes = (array) => {
      const buffer = Buffer.from(array.buffer, array.byteOffset, array.byteLength);
      outputBytes += buffer.byteLength;
      hash.update(buffer);
    };
    for (const group of skin.groups) {
      const geometry = group.geometry;
      hash.update(
        JSON.stringify({
          material: group.materialKey ?? group.material.type,
          lod: group.lod,
          castShadow: group.castShadow,
          bone: group.bone,
          groups: geometry.groups,
          boundingBox: geometry.boundingBox,
          boundingSphere: geometry.boundingSphere,
          morphTargetsRelative: geometry.morphTargetsRelative,
        }),
      );
      for (const name of Object.keys(geometry.attributes).sort()) {
        const attribute = geometry.attributes[name];
        hash.update(
          JSON.stringify([
            name,
            attribute.itemSize,
            attribute.normalized,
            attribute.array.constructor.name,
          ]),
        );
        bytes(attribute.array);
      }
      if (geometry.index) bytes(geometry.index.array);
      for (const name of Object.keys(geometry.morphAttributes).sort()) {
        hash.update(name);
        for (const attribute of geometry.morphAttributes[name]) bytes(attribute.array);
      }
    }
    results.push({
      id,
      keeper,
      radial,
      mergeLods,
      staffStyle,
      cloneCount: cloneCount - beforeCount,
      copiedBytes: copiedBytes - beforeBytes,
      outputBytes,
      groupCount: skin.groups.length,
      geometryAndMorphSha256: hash.digest("hex"),
    });
    skin.dispose();
  }
} finally {
  THREE.BufferGeometry.prototype.clone = clone;
}
fs.writeFileSync(output, JSON.stringify({ node: process.version, results }, null, 2) + "\n");
console.log(JSON.stringify({ output, results }, null, 2));
