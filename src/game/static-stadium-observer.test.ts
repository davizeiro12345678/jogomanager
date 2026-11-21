import { afterEach, expect, it, vi } from "vitest";
import * as THREE from "three";
import {
  batchStaticStadium,
  captureStaticStadiumState,
  createStaticStadiumObserver,
} from "./static-stadium-batch";

afterEach(() => vi.restoreAllMocks());

function fixture() {
  const root = new THREE.Group();
  const branch = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ map: new THREE.Texture() });
  const first = new THREE.Mesh(new THREE.BoxGeometry(), material);
  const second = new THREE.Mesh(first.geometry, material);
  branch.add(first, second);
  root.add(branch);
  return { root, branch, first, second, material };
}

it("reuses the clean capture without formatting numbers or rebuilding source signatures", () => {
  const { root } = fixture();
  const observer = createStaticStadiumObserver(root);
  const state = observer.read();
  const format = vi.spyOn(Number.prototype, "toPrecision");
  for (let frame = 0; frame < 120; frame++) expect(observer.read()).toBe(state);
  expect(format).not.toHaveBeenCalled();
  observer.dispose();
});

const mutations = {
  color: ({ material }: ReturnType<typeof fixture>) => (material.color.r = 0.2),
  roughness: ({ material }: ReturnType<typeof fixture>) => (material.roughness = 0.3),
  normalScale: ({ material }: ReturnType<typeof fixture>) => (material.normalScale.x = 0.4),
  mapOffset: ({ material }: ReturnType<typeof fixture>) => (material.map!.offset.x = 0.2),
  mapVersion: ({ material }: ReturnType<typeof fixture>) => (material.map!.needsUpdate = true),
  mapReplacement: ({ material }: ReturnType<typeof fixture>) =>
    (material.map = new THREE.Texture()),
  materialReplacement: ({ first }: ReturnType<typeof fixture>) =>
    (first.material = new THREE.MeshStandardMaterial({ roughness: 0.2 })),
  define: ({ material }: ReturnType<typeof fixture>) => ((material.defines ??= {})["TEST"] = 2),
  position: ({ first }: ReturnType<typeof fixture>) => (first.position.x = 2),
  rotation: ({ first }: ReturnType<typeof fixture>) => (first.rotation.y = 0.2),
  scale: ({ first }: ReturnType<typeof fixture>) => (first.scale.y = 2),
  parentTransform: ({ branch }: ReturnType<typeof fixture>) => (branch.position.x = 2),
  manualMatrix: ({ first }: ReturnType<typeof fixture>) => {
    first.matrixAutoUpdate = false;
    first.matrix.makeTranslation(2, 0, 0);
  },
  attributeVersion: ({ first }: ReturnType<typeof fixture>) => {
    const position = first.geometry.getAttribute("position");
    position.setX(0, 3);
    position.needsUpdate = true;
  },
  attributeReplacement: ({ first }: ReturnType<typeof fixture>) =>
    first.geometry.setAttribute("position", first.geometry.getAttribute("position").clone()),
  attributeRemoval: ({ first }: ReturnType<typeof fixture>) => first.geometry.deleteAttribute("uv"),
  indexVersion: ({ first }: ReturnType<typeof fixture>) =>
    (first.geometry.index!.needsUpdate = true),
  groups: ({ first }: ReturnType<typeof fixture>) => (first.geometry.groups[0]!.count = 2),
  drawRange: ({ first }: ReturnType<typeof fixture>) => first.geometry.setDrawRange(1, 6),
  order: ({ first }: ReturnType<typeof fixture>) => (first.renderOrder = 2),
  layers: ({ first }: ReturnType<typeof fixture>) => first.layers.set(2),
  shadow: ({ first }: ReturnType<typeof fixture>) => (first.castShadow = true),
  culling: ({ first }: ReturnType<typeof fixture>) => (first.frustumCulled = false),
  transparent: ({ material }: ReturnType<typeof fixture>) => (material.transparent = true),
  alphaTest: ({ material }: ReturnType<typeof fixture>) => (material.alphaTest = 0.5),
  callback: ({ first }: ReturnType<typeof fixture>) => (first.onBeforeRender = () => undefined),
  customProgram: ({ material }: ReturnType<typeof fixture>) =>
    (material.onBeforeCompile = () => undefined),
  dynamicBoundary: ({ branch }: ReturnType<typeof fixture>) =>
    (branch.userData["cinematicDynamic"] = true),
  nestedAdd: ({ branch }: ReturnType<typeof fixture>) => branch.add(new THREE.Group()),
  remove: ({ branch, first }: ReturnType<typeof fixture>) => branch.remove(first),
};

it.each(Object.entries(mutations))(
  "matches canonical capture immediately after %s",
  (_, mutate) => {
    const setup = fixture();
    const observer = createStaticStadiumObserver(setup.root);
    observer.read();
    mutate(setup);
    const actual = observer.read();
    expect(actual).toEqual(captureStaticStadiumState(setup.root));
    expect(observer.read()).toBe(actual);
    observer.dispose();
  },
);

it("observes nested record/array edits and deletion without a material version bump", () => {
  const { root, material } = fixture();
  const defines = material.defines as Record<string, unknown>;
  defines["NESTED"] = { samples: [1, 2] };
  const observer = createStaticStadiumObserver(root);
  const initial = observer.read();
  (defines["NESTED"] as { samples: number[] }).samples[1] = 3;
  expect(observer.read().revision).not.toBe(initial.revision);
  expect(observer.read()).toEqual(captureStaticStadiumState(root));
  delete defines["NESTED"];
  expect(observer.read()).toEqual(captureStaticStadiumState(root));
  observer.dispose();
});

it("observes sparse arrays and custom string values in supported material records", () => {
  const { root, material } = fixture();
  const defines = (material.defines ??= {}) as Record<string, unknown>;
  const values = new Array<unknown>(2);
  const custom = () => undefined;
  defines["VALUES"] = values;
  defines["CUSTOM"] = custom;
  const observer = createStaticStadiumObserver(root);
  const before = observer.read();
  values[0] = undefined;
  expect(observer.read().revision).not.toBe(before.revision);
  expect(observer.read()).toEqual(captureStaticStadiumState(root));
  custom.toString = () => "changed";
  expect(observer.read()).toEqual(captureStaticStadiumState(root));
  observer.dispose();
});

it("preserves the needsUpdate boundary for raw buffer edits", () => {
  const { root, first } = fixture();
  const observer = createStaticStadiumObserver(root);
  const initial = observer.read();
  const position = first.geometry.getAttribute("position");
  position.setX(0, 4);
  expect(observer.read()).toBe(initial);
  expect(observer.read()).toEqual(captureStaticStadiumState(root));
  position.needsUpdate = true;
  expect(observer.read().revision).not.toBe(initial.revision);
  expect(observer.read()).toEqual(captureStaticStadiumState(root));
  observer.dispose();
});

it("keeps hidden batch sources normalized and observes an excluded mesh's eligible child", () => {
  const { root, first } = fixture();
  const child = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
  first.add(child);
  const observer = createStaticStadiumObserver(root);
  const before = observer.read();
  const batch = batchStaticStadium(root);
  expect(observer.read().revision).toBe(before.revision);
  const exclude = new Set([first]);
  observer.read({ exclude });
  child.position.x = 2;
  expect(observer.read({ exclude })).toEqual(captureStaticStadiumState(root, { exclude }));
  exclude.clear();
  expect(observer.read({ exclude })).toEqual(captureStaticStadiumState(root, { exclude }));
  batch();
  expect(observer.read()).toEqual(captureStaticStadiumState(root));
  observer.dispose();
});

it("ignores dynamic and generated churn and reconnects a dynamic branch when it becomes static", () => {
  const { root } = fixture();
  const actor = new THREE.Group();
  actor.userData["cinematicDynamic"] = true;
  root.add(actor);
  const changed = vi.fn();
  const observer = createStaticStadiumObserver(root, changed);
  const before = observer.read();
  const revision = observer.hierarchyRevision;
  actor.add(new THREE.Group());
  const generated = new THREE.Group();
  generated.userData["staticBatchGenerated"] = true;
  root.add(generated);
  generated.add(new THREE.Group());
  actor.position.x = 4;
  expect(observer.hierarchyRevision).toBe(revision);
  expect(observer.read()).toBe(before);
  expect(changed).not.toHaveBeenCalled();
  actor.userData["cinematicDynamic"] = false;
  expect(observer.hierarchyRevision).toBeGreaterThan(revision);
  expect(observer.read()).toEqual(captureStaticStadiumState(root));
  const next = observer.hierarchyRevision;
  actor.children[0]!.add(new THREE.Group());
  expect(observer.hierarchyRevision).toBeGreaterThan(next);
  observer.dispose();
});

it("unsubscribes detached subtrees and releases all listeners on idempotent disposal", () => {
  const { root, branch, first } = fixture();
  const changed = vi.fn();
  const observer = createStaticStadiumObserver(root, changed);
  root.remove(branch);
  expect(changed).toHaveBeenCalledTimes(1);
  branch.add(new THREE.Group());
  expect(changed).toHaveBeenCalledTimes(1);
  root.add(branch);
  expect(changed).toHaveBeenCalledTimes(2);
  const removeRoot = vi.spyOn(root, "removeEventListener");
  const removeBranch = vi.spyOn(branch, "removeEventListener");
  const sourceDispose = vi.spyOn(first.geometry, "dispose");
  observer.dispose();
  observer.dispose();
  expect(removeRoot).toHaveBeenCalledTimes(2);
  expect(removeBranch).toHaveBeenCalledTimes(2);
  root.add(new THREE.Group());
  expect(changed).toHaveBeenCalledTimes(2);
  expect(sourceDispose).not.toHaveBeenCalled();
});
