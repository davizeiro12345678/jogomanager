interface CinematicAudio {
  readonly ended: boolean;
  play(): Promise<void>;
  pause(): void;
}

/** A browser play promise may finish after a pause, tab hide or dialogue change.
 * Check ownership on both sides of that boundary before publishing its clock. */
export async function playCinematicVoice(
  audio: CinematicAudio,
  canPlay: () => boolean,
): Promise<boolean> {
  if (!canPlay() || audio.ended) return false;
  await audio.play();
  if (!canPlay()) {
    audio.pause();
    return false;
  }
  return true;
}
