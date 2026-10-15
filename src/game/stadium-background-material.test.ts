import { expect, it, vi } from "vitest";
import * as THREE from "three";
import { stadiumBackgroundMaterial } from "./stadium-background-material";

it("retains stadium albedo, colours and shadow flags without taking texture ownership", () => {
  const map = new THREE.Texture();
  const source = new THREE.MeshStandardMaterial({ map, color: "#6a747b", side: THREE.DoubleSide });
  const disposeMap = vi.spyOn(map, "dispose");
  const material = stadiumBackgroundMaterial(source);
  expect(material.map).toBe(map);
  expect(material.color.equals(source.color)).toBe(true);
  expect(material.color).not.toBe(source.color);
  expect(material.side).toBe(source.side);
  expect(material.depthWrite).toBe(true);
  expect(material).toBeInstanceOf(THREE.MeshLambertMaterial);
  material.dispose();
  expect(disposeMap).not.toHaveBeenCalled();
  source.dispose();
  map.dispose();
});
