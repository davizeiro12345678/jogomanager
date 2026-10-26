/** Keep explicit pauses/loading outside frame cadence, without hiding visible stalls. */
export class CinematicFrameBoundary {
  private wasStopped = true;

  sample(rawDelta: number, stopped: boolean): number | null {
    const resuming = this.wasStopped;
    this.wasStopped = stopped;
    if (stopped || resuming || !Number.isFinite(rawDelta) || rawDelta <= 0) return null;
    return rawDelta;
  }
}
