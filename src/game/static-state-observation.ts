import * as THREE from "three";

const ARRAY = Symbol("array");
const RECORD = Symbol("record");
const TEXTURE = Symbol("texture");
const VECTOR = Symbol("vector");
const COLOR = Symbol("color");
// Mirrors valueRevision's observable texture state, including direct UV edits.
const TEXTURE_KEYS = [
  "uuid",
  "offset",
  "repeat",
  "center",
  "rotation",
  "wrapS",
  "wrapT",
  "minFilter",
  "magFilter",
  "mapping",
  "matrixAutoUpdate",
  "flipY",
  "anisotropy",
  "premultiplyAlpha",
  "format",
  "type",
  "unpackAlignment",
  "colorSpace",
  "channel",
  "version",
] as const;

/** A reusable primitive tape. Clean reads compare values without formatting
 * numbers, serializing resource signatures or retaining old scene objects. */
export class StaticValueObservation {
  private values: unknown[] = [];
  private cursor = 0;
  private changed = false;

  begin() {
    this.cursor = 0;
    this.changed = false;
  }
  put(value: unknown) {
    if (!Object.is(this.values[this.cursor], value)) {
      this.changed = true;
      this.values[this.cursor] = value;
    }
    this.cursor++;
  }
  value(value: unknown): void {
    if (value === null || value === undefined) {
      this.put(null);
    } else if (Array.isArray(value)) {
      this.put(ARRAY);
      this.put(value.length);
      // Array.map in the canonical serializer distinguishes holes from an
      // explicit undefined element. Preserve that difference without strings.
      for (let index = 0; index < value.length; index++) {
        this.put(index in value);
        if (index in value) this.value(value[index]);
      }
    } else if (typeof value === "object") {
      const object = value as Record<string, unknown>;
      if (typeof object["uuid"] === "string") {
        this.put(TEXTURE);
        for (const key of TEXTURE_KEYS) this.value(object[key]);
      } else if (
        object["x"] !== undefined ||
        object["y"] !== undefined ||
        object["z"] !== undefined ||
        object["w"] !== undefined
      ) {
        this.put(VECTOR);
        this.value(object["x"]);
        this.value(object["y"]);
        this.value(object["z"]);
        this.value(object["w"]);
        this.value(object["constant"]);
      } else if (
        object["r"] !== undefined ||
        object["g"] !== undefined ||
        object["b"] !== undefined
      ) {
        this.put(COLOR);
        this.value(object["r"]);
        this.value(object["g"]);
        this.value(object["b"]);
      } else {
        const keys = Object.keys(object).sort();
        this.put(RECORD);
        this.put(keys.length);
        for (const key of keys) {
          this.put(key);
          this.value(object[key]);
        }
        if (!keys.length) this.put(String(value));
      }
    } else {
      // Rare function-valued defines use the canonical string fallback; this
      // also observes an in-place custom toString override on the same function.
      this.put(typeof value === "function" ? String(value) : value);
    }
  }
  finish() {
    if (this.values.length !== this.cursor) this.changed = true;
    this.values.length = this.cursor;
    return this.changed;
  }
  clear() {
    this.values.length = 0;
  }
}

function dynamic(object: THREE.Object3D): boolean {
  for (let current: THREE.Object3D | null = object; current; current = current.parent)
    if (
      current.userData["cinematicDynamic"] === true ||
      current.userData["staticBatchDynamic"] === true
    )
      return true;
  return false;
}

/** Object3D hierarchy events do not bubble. Subscribe to each static parent,
 * retain only the boundary of a dynamic branch, and ignore generated batches. */
export function observeStaticHierarchy(root: THREE.Group, onChange?: () => void) {
  const nodes = new Map<THREE.Object3D, boolean>();
  let revision = 0;
  let closed = false;
  const mark = () => {
    revision++;
    onChange?.();
  };
  const added = (event: { child: THREE.Object3D }) => {
    if (attach(event.child)) mark();
  };
  const removed = (event: { child: THREE.Object3D }) => {
    const wasStatic = nodes.get(event.child) === false;
    detach(event.child);
    if (wasStatic) mark();
  };
  const attach = (object: THREE.Object3D): boolean => {
    if (object.userData["staticBatchGenerated"] === true) return false;
    const isDynamic = dynamic(object);
    nodes.set(object, isDynamic);
    if (isDynamic) return false;
    object.addEventListener("childadded", added);
    object.addEventListener("childremoved", removed);
    for (const child of object.children) attach(child);
    return true;
  };
  const detach = (object: THREE.Object3D): void => {
    if (nodes.get(object) === false) {
      object.removeEventListener("childadded", added);
      object.removeEventListener("childremoved", removed);
    }
    nodes.delete(object);
    for (const child of object.children) detach(child);
  };
  attach(root);
  return {
    get revision() {
      if (closed) return revision;
      // Tags can change directly without a hierarchy event. Reconnect at the
      // first changed boundary; subsequent reads settle any other boundaries.
      for (const [object, wasDynamic] of nodes)
        if (wasDynamic !== dynamic(object)) {
          detach(object);
          attach(object);
          mark();
          break;
        }
      return revision;
    },
    dispose() {
      if (closed) return;
      closed = true;
      for (const [object, isDynamic] of nodes)
        if (!isDynamic) {
          object.removeEventListener("childadded", added);
          object.removeEventListener("childremoved", removed);
        }
      nodes.clear();
    },
  };
}
