/** Stable external-store snapshots: unrelated streamed maps must not rebuild
 * a stadium's materials, atlases and static batches. A reset affects all maps. */
export class TextureRevisions<Name extends string> {
  private shared = 0;
  private assets = new Map<Name, number>();

  touch(name?: Name): void {
    if (name) this.assets.set(name, (this.assets.get(name) ?? 0) + 1);
    else this.shared += 1;
  }

  snapshot(names: readonly Name[]): number {
    return names.reduce((value, name) => value + (this.assets.get(name) ?? 0), this.shared);
  }
}
