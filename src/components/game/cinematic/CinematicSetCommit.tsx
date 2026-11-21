import { Suspense, useLayoutEffect, type ReactNode } from "react";

/** Place inside the selected set's Suspense boundary. A completed shell frame
 * does not imply that a lazy set's light objects have committed. */
function CinematicSetCommit({ onCommitted }: { onCommitted: () => void }) {
  useLayoutEffect(onCommitted, [onCommitted]);
  return null;
}

/** Special rooms can render immediately, but only the selected set's complete
 * commit releases warmup: medical/gym also retain the lazy locker lights. */
export function CinematicSetBoundary({
  children,
  scenery,
  onCommitted,
}: {
  children: ReactNode;
  scenery?: ReactNode;
  onCommitted: () => void;
}) {
  return (
    <>
      {scenery}
      <Suspense fallback={<group />}>
        {children}
        <CinematicSetCommit onCommitted={onCommitted} />
      </Suspense>
    </>
  );
}
