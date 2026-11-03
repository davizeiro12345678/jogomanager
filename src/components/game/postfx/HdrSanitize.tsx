import { useEffect, useMemo } from "react";
import { createHdrSanitizePass } from "./hdr-sanitize-pass";

/** Cleans non-finite and over-bright pixels before bloom and grading. */
export function HdrSanitize({ ceiling = 24 }: { ceiling?: number }) {
  const pass = useMemo(() => createHdrSanitizePass(ceiling), [ceiling]);
  useEffect(() => () => pass.dispose(), [pass]);
  return <primitive object={pass} dispose={null} />;
}
