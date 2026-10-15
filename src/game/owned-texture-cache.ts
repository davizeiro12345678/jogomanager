import type * as THREE from "three";

/** Cache ownership is separate from Three materials (including texture clones).
 * Trim only at commit/release boundaries, never dispose a mounted scene's map. */
export class OwnedTextureCache<Key> {
  private entries = new Map<Key, THREE.Texture | null>();
  private users = new WeakMap<THREE.Texture, number>();
  constructor(readonly maxIdleEntries: number) {}
  get(key: Key, build: () => THREE.Texture | null): THREE.Texture | null {
    if (this.entries.has(key)) {
      const texture = this.entries.get(key)!;
      this.entries.delete(key);
      this.entries.set(key, texture);
      return texture;
    }
    const texture = build();
    this.entries.set(key, texture);
    return texture;
  }
  retain(texture: THREE.Texture | null): () => void {
    if (!texture) return () => undefined;
    this.users.set(texture, (this.users.get(texture) ?? 0) + 1);
    this.trim();
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.users.set(texture, Math.max(0, (this.users.get(texture) ?? 1) - 1));
      this.trim();
    };
  }
  private trim() {
    let idle = 0;
    for (const texture of this.entries.values()) if (!texture || !this.users.get(texture)) idle++;
    for (const [key, texture] of this.entries) {
      if (idle <= this.maxIdleEntries) break;
      if (texture && this.users.get(texture)) continue;
      this.entries.delete(key);
      texture?.dispose();
      idle--;
    }
  }
}
