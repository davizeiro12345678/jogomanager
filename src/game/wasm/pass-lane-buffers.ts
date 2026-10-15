/** Per-match scratch. No state from these buffers belongs in saves/checkpoints. */
export class PassLaneBuffers {
  private readonly values = new Float64Array(64 * 4);
  private readonly views: Array<Float64Array | undefined> = new Array(65);

  pack(players: readonly { x: number; z: number; vx: number; vz: number }[]): Float64Array {
    const count = Math.min(64, players.length);
    const output = (this.views[count] ??= this.values.subarray(0, count * 4));
    for (let index = 0; index < count; index++) {
      const player = players[index]!;
      const offset = index * 4;
      output[offset] = player.x;
      output[offset + 1] = player.z;
      output[offset + 2] = player.vx;
      output[offset + 3] = player.vz;
    }
    return output;
  }
}
