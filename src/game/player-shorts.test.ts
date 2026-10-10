import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { lookFor, lookWithPhysique, proportionsFor } from "./player-model";
import { footballShorts } from "./player-shorts";
import { anatomicalLimb } from "./rig-geometry";
import { buildRigSkin } from "./rig-skin";
import { playerMaterials } from "./player-materials";
import { kitFor } from "./kits";
import { cinematicActorPose, cinematicLook } from "./cinematic-actor";
import { updateRigCorrectives } from "./rig-correctives";
import { AthleteCloth } from "./athlete-cloth";
import { compactCinematicSkin } from "./cinematic-skin";

describe("tailored player shorts", () => {
  it("keeps visible thigh overlap behind the posed seated garment", () => {
    for (const radial of [6, 8, 12, 16])
      for (const seed of [2, 5, 9, 13]) {
        const look = cinematicLook(seed),
          p = proportionsFor(look);
        const mats = playerMaterials(look, kitFor("fla", "#cc1e32", "#161b21"), null, "alta");
        const skin = buildRigSkin(
          {
            P: p,
            look,
            mats,
            hi: radial > 8,
            portrait: radial > 8,
            segs: { radial, cap: 4 },
            handR: p.handR,
            handMat: mats.skin,
            jerseyInk: "#fff",
          },
          [0, 0, 0],
        );
        const seated = cinematicActorPose(0, seed, "sit", seed === 5, p);
        skin.boneOf.hips.position.y = p.hipY + seated.hipY;
        skin.boneOf.legL.rotation.x = seated.legLPitch;
        skin.boneOf.legR.rotation.x = seated.legRPitch;
        skin.boneOf.kneeL.rotation.x = skin.boneOf.kneeR.rotation.x = Math.PI / 2;
        updateRigCorrectives(skin.boneOf);
        skin.root.updateMatrixWorld(true);
        skin.skeleton.update();
        const clothGroup = skin.groups.find((group) => group.material === mats.shorts)!;
        const clothMesh = new THREE.SkinnedMesh(clothGroup.geometry, clothGroup.material);
        const cloth = new AthleteCloth(skin, p, radial > 8);
        cloth.bind(clothMesh);
        for (let frame = 0; frame < 120; frame++)
          cloth.update(1 / 60, { x: 0, z: 0, lift: 0, effort: 0, bend: 0.02, legL: 1, legR: 1 });
        clothMesh.skeleton = skin.skeleton;
        clothMesh.bindMatrix.copy(skin.bindMatrix);
        clothMesh.bindMatrixInverse.copy(skin.bindMatrix).invert();
        const posed = clothGroup.geometry.clone(),
          posedPosition = posed.getAttribute("position");
        const scratch = new THREE.Vector3();
        for (let i = 0; i < posedPosition.count; i++) {
          clothMesh.getVertexPosition(i, scratch);
          posedPosition.setXYZ(i, scratch.x, scratch.y, scratch.z);
        }
        posed.computeBoundingSphere();
        posed.computeBoundingBox();
        const surface = new THREE.Mesh(
          posed,
          new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }),
        );
        surface.updateMatrixWorld(true);
        const ray = new THREE.Raycaster();
        const legIndex = skin.bones.indexOf(skin.boneOf.legL),
          pivotY = p.hipY - p.hipH * 0.4;
        let probes = 0,
          failures = 0;
        const problems: unknown[] = [];
        for (const group of skin.groups.filter((group) => group.material === mats.skin)) {
          const mesh = new THREE.SkinnedMesh(group.geometry, group.material);
          mesh.skeleton = skin.skeleton;
          mesh.bindMatrix.copy(skin.bindMatrix);
          mesh.bindMatrixInverse.copy(skin.bindMatrix).invert();
          const pos = group.geometry.getAttribute("position"),
            indices = group.geometry.getAttribute("skinIndex");
          for (let i = 0; i < pos.count; i++) {
            const u = (pivotY - pos.getY(i)) / p.thigh;
            if (
              indices.getX(i) !== legIndex ||
              u < 0.43 - 1e-6 ||
              u > 0.49 + 1e-6 ||
              pos.getZ(i) < 0.001 ||
              pos.getX(i) - p.hipW * 0.36 < -p.legR * 0.65
            )
              continue;
            const axis = new THREE.Vector3(0, -u * p.thigh, 0).applyMatrix4(
              skin.boneOf.legL.matrixWorld,
            );
            const point = mesh.applyBoneTransform(
              i,
              new THREE.Vector3().fromBufferAttribute(pos, i),
            );
            const distance = point.distanceTo(axis),
              direction = point.clone().sub(axis).normalize();
            ray.set(axis, direction);
            const hit = ray.intersectObject(surface, false)[0];
            if (hit) {
              probes++;
              if (hit.distance < distance - 0.0005) {
                failures++;
                problems.push({
                  u,
                  x: pos.getX(i) - p.hipW * 0.36,
                  z: pos.getZ(i),
                  gap: hit.distance - distance,
                });
              }
            }
          }
          const triangles = group.geometry.getIndex()!;
          for (let tri = 0; tri < triangles.count; tri += 3) {
            const ia = triangles.getX(tri),
              ib = triangles.getX(tri + 1),
              ic = triangles.getX(tri + 2);
            if ([ia, ib, ic].some((i) => indices.getX(i) !== legIndex)) continue;
            for (const weights of [
              [0.5, 0.25, 0.25],
              [0.25, 0.5, 0.25],
              [0.25, 0.25, 0.5],
              [1 / 3, 1 / 3, 1 / 3],
            ]) {
              const original = new THREE.Vector3(),
                point = new THREE.Vector3();
              for (let corner = 0; corner < 3; corner++) {
                const i = [ia, ib, ic][corner]!;
                original.addScaledVector(
                  new THREE.Vector3().fromBufferAttribute(pos, i),
                  weights[corner]!,
                );
                point.addScaledVector(
                  mesh.getVertexPosition(i, new THREE.Vector3()),
                  weights[corner]!,
                );
              }
              const u = (pivotY - original.y) / p.thigh;
              if (
                u < 0.43 ||
                u > 0.49 ||
                original.z < 0.001 ||
                original.x - p.hipW * 0.36 < -p.legR * 0.65
              )
                continue;
              const axis = new THREE.Vector3(0, -u * p.thigh, 0).applyMatrix4(
                skin.boneOf.legL.matrixWorld,
              );
              const distance = point.distanceTo(axis);
              ray.set(axis, point.clone().sub(axis).normalize());
              const hit = ray.intersectObject(surface, false)[0];
              if (hit) {
                probes++;
                if (hit.distance < distance - 0.0005) {
                  failures++;
                  problems.push({
                    u,
                    x: original.x - p.hipW * 0.36,
                    z: original.z,
                    gap: hit.distance - distance,
                    triangle: true,
                  });
                }
              }
            }
          }
        }
        expect(probes).toBeGreaterThan(0);
        expect(failures, JSON.stringify({ radial, seed, problems })).toBe(0);
        if (radial <= 8) {
          // Baixa renders these exact vertices through the compact costume.
          // Verify the merger preserves posed skin/garment coordinates too.
          const expected: THREE.Vector3[] = [];
          for (const group of skin.groups) {
            const material = group.material as THREE.MeshStandardMaterial;
            if (!material.color || material.map || material.alphaMap || material.transparent)
              continue;
            const mesh = new THREE.SkinnedMesh(group.geometry, group.material);
            mesh.skeleton = skin.skeleton;
            mesh.bindMatrix.copy(skin.bindMatrix);
            mesh.bindMatrixInverse.copy(skin.bindMatrix).invert();
            for (let i = 0; i < group.geometry.getAttribute("position").count; i++)
              expected.push(mesh.getVertexPosition(i, new THREE.Vector3()));
          }
          const compact = compactCinematicSkin(skin);
          const group = compact.groups[0]!;
          const mesh = new THREE.SkinnedMesh(group.geometry, group.material);
          mesh.skeleton = compact.skeleton;
          mesh.bindMatrix.copy(compact.bindMatrix);
          mesh.bindMatrixInverse.copy(compact.bindMatrix).invert();
          expect(group.geometry.getAttribute("position").count).toBe(expected.length);
          for (let i = 0; i < expected.length; i += 17)
            expect(mesh.getVertexPosition(i, scratch).distanceTo(expected[i]!)).toBeLessThan(1e-6);
          compact.dispose();
        } else skin.dispose();
        posed.dispose();
        (surface.material as THREE.Material).dispose();
      }
  });
  it("contains bare thigh corners inside coarse opening facets used by seated extras", () => {
    const p = proportionsFor(lookFor("seated-opening-facets", "MF"));
    for (const radial of [6, 8, 16]) {
      const shorts = footballShorts(p, radial),
        thigh = anatomicalLimb("thigh", p.thigh, p.legR, radial);
      const cloth = shorts.getAttribute("position"),
        leg = thigh.getAttribute("position");
      const hem = -p.hipH * 0.4 - p.thigh * 0.49;
      const opening = shorts.getAttribute("openingLeg");
      const polygon: [number, number][] = [];
      for (let i = 0; i < cloth.count; i++)
        if (Math.abs(cloth.getY(i) - hem) < 1e-6 && opening.getX(i) === 1)
          polygon.push([cloth.getX(i) - p.hipW * 0.36, cloth.getZ(i)]);
      polygon.pop(); // duplicated UV seam
      const rows = leg.count / (radial + 1);
      const skinY = -p.thigh * 0.49;
      let row = 0;
      while (row < rows - 2 && leg.getY((row + 1) * (radial + 1)) < skinY) row++;
      const y0 = leg.getY(row * (radial + 1)),
        y1 = leg.getY((row + 1) * (radial + 1));
      const t = (skinY - y0) / (y1 - y0);
      for (let vertex = 0; vertex < radial; vertex++) {
        const a = row * (radial + 1) + vertex,
          b = a + radial + 1;
        const x = THREE.MathUtils.lerp(leg.getX(a), leg.getX(b), t);
        const z = THREE.MathUtils.lerp(leg.getZ(a), leg.getZ(b), t);
        let inside = false;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
          const [xi, zi] = polygon[i]!,
            [xj, zj] = polygon[j]!;
          if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
        }
        expect(inside, `${radial}-sided opening excludes skin corner ${vertex}`).toBe(true);
      }
      shorts.dispose();
      thigh.dispose();
    }
  });
  it("contains the outer quadriceps at the split instead of exposing skin triangles", () => {
    for (const weight of [55, 78, 110]) {
      const p = proportionsFor(
        lookWithPhysique(lookFor("shorts-coverage", "MF"), { height: 183, weight }),
      );
      const geometry = footballShorts(p, 16);
      const pos = geometry.getAttribute("position");
      const splitY = -p.hipH * 0.73;
      let outer = 0,
        front = 0;
      for (let i = 0; i < pos.count; i++) {
        if (Math.abs(pos.getY(i) - splitY) < 1e-6) {
          outer = Math.max(outer, Math.abs(pos.getX(i)));
          front = Math.max(front, pos.getZ(i));
        }
      }
      expect(outer).toBeGreaterThan(p.hipW * 0.36 + p.legR * 1.22);
      expect(front).toBeGreaterThan(p.legR * 1.16);
      geometry.dispose();
    }
  });
  it("keeps the waist narrower than the shoulders and hems well above the knee", () => {
    for (const dimensions of [
      { height: 170, weight: 60 },
      { height: 183, weight: 78 },
      { height: 198, weight: 99 },
    ]) {
      const p = proportionsFor(lookWithPhysique(lookFor("shorts-body", "MF"), dimensions));
      const geometry = footballShorts(p);
      geometry.computeBoundingBox();
      const box = geometry.boundingBox!;
      expect(box.max.x - box.min.x).toBeLessThan(p.shoulderW * 1.04 + p.armR * 2.36);
      const legPivot = -p.hipH * 0.4;
      expect((legPivot - box.min.y) / p.thigh).toBeGreaterThan(0.4);
      expect((legPivot - box.min.y) / p.thigh).toBeLessThan(0.6);
      for (const name of ["position", "normal", "uv"]) {
        expect(Array.from(geometry.getAttribute(name).array).every(Number.isFinite)).toBe(true);
      }
      geometry.dispose();
    }
  });

  it("keeps the waistband planted while a hem follows a raised femur", () => {
    const look = lookFor("shorts-flexion", "MF");
    const p = proportionsFor(look);
    const kit = kitFor("fla", "#cc1e32", "#161b21");
    const mats = playerMaterials(look, kit, null, "alta");
    const rig = buildRigSkin(
      {
        P: p,
        look,
        segs: { radial: 16, cap: 4 },
        hi: true,
        mats,
        handR: p.handR,
        handMat: mats.skin,
        jerseyInk: "#fff",
      },
      [0, 0, 0],
    );
    const group = rig.groups.find((g) => g.material === mats.shorts && g.lod === "core")!;
    const mesh = new THREE.SkinnedMesh(group.geometry, group.material);
    mesh.bind(rig.skeleton, rig.bindMatrix);
    rig.root.updateMatrixWorld(true);
    rig.skeleton.update();
    const pos = group.geometry.getAttribute("position");
    let waist = 0,
      hem = 0;
    for (let i = 0; i < pos.count; i++) {
      if (pos.getY(i) > pos.getY(waist)) waist = i;
      if (pos.getX(i) > 0.05 && pos.getY(i) < pos.getY(hem)) hem = i;
    }
    const beforeWaist = mesh.applyBoneTransform(
      waist,
      new THREE.Vector3().fromBufferAttribute(pos, waist),
    );
    const beforeHem = mesh.applyBoneTransform(
      hem,
      new THREE.Vector3().fromBufferAttribute(pos, hem),
    );
    rig.boneOf.legL.rotation.x = -0.9;
    rig.root.updateMatrixWorld(true);
    rig.skeleton.update();
    const afterWaist = mesh.applyBoneTransform(
      waist,
      new THREE.Vector3().fromBufferAttribute(pos, waist),
    );
    const afterHem = mesh.applyBoneTransform(
      hem,
      new THREE.Vector3().fromBufferAttribute(pos, hem),
    );
    expect(afterWaist.distanceTo(beforeWaist)).toBeLessThan(0.002);
    expect(afterHem.distanceTo(beforeHem)).toBeGreaterThan(0.14);
    rig.dispose();
  });

  it("keeps both inner hems on their own femur when the openings cross the centre plane", () => {
    const look = lookFor("shorts-inner-hem", "MF"),
      p = proportionsFor(look),
      mats = playerMaterials(look, kitFor("fla", "#cc1e32", "#161b21"), null, "alta");
    const rig = buildRigSkin(
      {
        P: p,
        look,
        segs: { radial: 16, cap: 4 },
        hi: true,
        mats,
        handR: p.handR,
        handMat: mats.skin,
        jerseyInk: "#fff",
      },
      [0, 0, 0],
    );
    const group = rig.groups.find((g) => g.material === mats.shorts && g.lod === "core")!;
    const mesh = new THREE.SkinnedMesh(group.geometry, group.material);
    mesh.bind(rig.skeleton, rig.bindMatrix);
    rig.root.updateMatrixWorld(true);
    rig.skeleton.update();
    const pos = group.geometry.getAttribute("position"),
      uv = group.geometry.getAttribute("uv");
    const hemY = Math.min(...Array.from({ length: pos.count }, (_, i) => pos.getY(i)));
    let left = -1,
      right = -1;
    for (let i = 0; i < pos.count; i++) {
      if (Math.abs(pos.getY(i) - hemY) > 1e-6) continue;
      // The duplicated u=.5 seam belongs to both loops; select their interiors.
      if (uv.getX(i) < 0.5 && pos.getX(i) < 0) left = i;
      if (uv.getX(i) > 0.5 && pos.getX(i) > 0) right = i;
    }
    expect(left).toBeGreaterThanOrEqual(0);
    expect(right).toBeGreaterThanOrEqual(0);
    const skinPoint = (i: number) =>
      mesh.applyBoneTransform(i, new THREE.Vector3().fromBufferAttribute(pos, i));
    const beforeLeft = skinPoint(left),
      beforeRight = skinPoint(right);
    rig.boneOf.legL.rotation.x = -0.9;
    rig.root.updateMatrixWorld(true);
    rig.skeleton.update();
    expect(skinPoint(left).distanceTo(beforeLeft)).toBeGreaterThan(0.1);
    expect(skinPoint(right).distanceTo(beforeRight)).toBeLessThan(0.002);
    expect(group.geometry.hasAttribute("openingLeg")).toBe(false);
    rig.dispose();
  });
});
