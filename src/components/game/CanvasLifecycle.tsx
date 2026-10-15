import { useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { observeCanvasLifecycle, type CanvasStatus } from "./canvas-lifecycle";

export function CanvasLifecycle({ onStatus }: { onStatus: (status: CanvasStatus) => void }) {
  const gl = useThree((state) => state.gl);
  const invalidate = useThree((state) => state.invalidate);
  const callback = useRef(onStatus);
  callback.current = onStatus;
  useEffect(
    () => observeCanvasLifecycle(gl, invalidate, (status) => callback.current(status)),
    [gl, invalidate],
  );
  return null;
}
