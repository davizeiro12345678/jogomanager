/** Presentation affiliation follows seating blocks, independently of shirt colour. */
export function crowdSectorTeam(sector: number, side: number): number {
  const block = (sector + (side > 0 ? 0 : 7)) % 14;
  return block < 4 || block === 10 ? 1 : block >= 11 ? -1 : 0;
}

/** Reusable exact camera key: no threshold changes and no per-check allocation. */
export class CrowdSelectionCameraCache {
  private readonly previous = new Float64Array(38);
  private initialized = false;
  invalidate() {
    this.initialized = false;
  }
  private write(index: number, value: number) {
    const same = this.previous[index] === value;
    this.previous[index] = value;
    return same;
  }
  unchanged(
    view: ArrayLike<number>,
    projection: ArrayLike<number>,
    height: number,
    instances: number,
    tiles: number,
    detailed: number,
    mesh: number,
    perspective: boolean,
  ) {
    let same = this.initialized;
    for (let i = 0; i < 16; i++) {
      if (this.previous[i] !== view[i] || this.previous[i + 16] !== projection[i]) same = false;
      this.previous[i] = view[i]!;
      this.previous[i + 16] = projection[i]!;
    }
    same = this.write(32, height) && same;
    same = this.write(33, instances) && same;
    same = this.write(34, tiles) && same;
    same = this.write(35, detailed) && same;
    same = this.write(36, mesh) && same;
    same = this.write(37, Number(perspective)) && same;
    this.initialized = true;
    return same;
  }
}
