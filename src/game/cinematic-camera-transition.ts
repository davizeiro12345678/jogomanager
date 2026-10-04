/**
 * A cut is reserved for a meaningful change of cinematic grammar. Keeping the
 * beat out of this signature lets a continuing performance settle into its
 * next line instead of snapping the camera a few centimetres every time text
 * advances.
 */
export interface CinematicCameraTransitionInput {
  /** A new set requires an editorial cut; easing across rooms crosses geometry. */
  scene: string;
  framing: "establishing" | "dialogue";
  subject: string;
  size: "geral" | "medio" | "proximo" | "close";
  reaction: boolean;
  opening: boolean;
}

export function cinematicCameraTransition(
  previous: CinematicCameraTransitionInput | null,
  next: CinematicCameraTransitionInput,
): "cut" | "ease" {
  if (!previous || previous.opening || next.opening) return "cut";
  if (previous.scene !== next.scene) return "cut";
  if (previous.framing !== next.framing) return "cut";
  if (previous.subject !== next.subject) return "cut";
  if (previous.size !== next.size) return "cut";
  if (previous.reaction !== next.reaction) return "cut";
  return "ease";
}
