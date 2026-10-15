/** Shared immutable textures survive until the last Canvas leaves. Support
 * profiles are compared before exposing compressed blocks to another backend. */
export class TextureRendererOwners<T extends object> {
  private readonly renderers = new Map<T, { profile: string; count: number }>();
  count = 0;
  acquire(renderer: T, profile: string): () => void {
    const owner = this.renderers.get(renderer);
    if (owner) owner.count += 1;
    else this.renderers.set(renderer, { profile, count: 1 });
    this.count += 1;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      const current = this.renderers.get(renderer);
      if (current && --current.count === 0) this.renderers.delete(renderer);
      this.count -= 1;
    };
  }
  get compatible(): boolean {
    let profile: string | undefined;
    for (const owner of this.renderers.values()) {
      if (profile !== undefined && owner.profile !== profile) return false;
      profile = owner.profile;
    }
    return true;
  }
  get firstRenderer(): T | undefined {
    return this.renderers.keys().next().value;
  }
  get profile(): string | undefined {
    return this.compatible ? this.renderers.values().next().value?.profile : undefined;
  }
}
