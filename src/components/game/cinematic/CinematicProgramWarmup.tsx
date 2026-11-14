import { useThree } from "@react-three/fiber";
import { useEffect, useRef, type ReactNode, type RefObject } from "react";
import type { Group } from "three";
// Keep shader compilation and its generation cache off the initial cinematic
// static import graph. This code is only needed after the optional actor
// enters the idle-warmup window, never for first paint.

/** Only optional overlay actors wait here. The set, dialogue, first-frame
 * callbacks and Canvas owner continue independently. */
export function CinematicProgramWarmup({
  children,
  enabled,
  requireEnvironment,
  host,
}: {
  children: ReactNode;
  enabled: boolean;
  requireEnvironment: boolean;
  host: RefObject<HTMLDivElement | null>;
}) {
  const { gl, scene, camera, invalidate } = useThree();
  const group = useRef<Group>(null);
  useEffect(() => {
    const actor = group.current;
    if (!enabled || !actor || actor.visible) return;
    let active = true;
    let lost = false;
    let idle: number | undefined;
    let timer: number | undefined;
    let attempt: AbortController | undefined;
    const queuedAt = performance.now();
    const publish = (status: string, startedAt: number, programsBefore: number) => {
      if (!active || !host.current) return;
      const data = host.current.dataset;
      data["heroWarmupState"] = status;
      data["heroWarmupMs"] = (performance.now() - startedAt).toFixed(1);
      data["heroWarmupQueueMs"] = (startedAt - queuedAt).toFixed(1);
      data["heroWarmupProgramsBefore"] = String(programsBefore);
      data["heroWarmupProgramsAfter"] = String(gl.info.programs?.length ?? 0);
    };
    const withdraw = () => {
      if (idle !== undefined) window.cancelIdleCallback(idle);
      if (timer !== undefined) window.clearTimeout(timer);
      idle = timer = undefined;
      attempt?.abort();
      attempt = undefined;
    };
    const run = () => {
      idle = timer = undefined;
      if (!active || lost || document.hidden || actor.visible) return;
      const startedAt = performance.now();
      const programsBefore = gl.info.programs?.length ?? 0;
      // Environment's frames=1 capture commits in a layout effect. Never warm
      // the unlit permutation if an optional IBL failed to become available.
      if (requireEnvironment && !scene.environment) {
        actor.visible = true;
        publish("environment-unavailable", startedAt, programsBefore);
        invalidate();
        return;
      }
      const consumer = new AbortController();
      attempt = consumer;
      if (host.current) {
        host.current.dataset["heroWarmupState"] = "compiling";
        host.current.dataset["heroWarmupMode"] = gl.extensions.has("KHR_parallel_shader_compile")
          ? "parallel"
          : "driver-poll";
      }
      void import("@/game/graphics-warmup")
        .then(({ promoteScenePrograms }) => {
          if (!active || consumer.signal.aborted || document.hidden || lost)
            return "cancelled" as const;
          return promoteScenePrograms(gl, actor, camera, consumer.signal, scene);
        })
        .then((status) => {
          if (!active || consumer.signal.aborted || document.hidden || lost) return;
          publish(status, startedAt, programsBefore);
          invalidate();
        })
        .catch(() => {
          if (!active || consumer.signal.aborted || document.hidden || lost) return;
          // An optional shader warmup must never leave the hero actor hidden.
          actor.visible = true;
          publish("failed", startedAt, programsBefore);
          invalidate();
        });
    };
    const schedule = () => {
      if (!active || lost || document.hidden || actor.visible) return;
      if (typeof window.requestIdleCallback === "function") {
        idle = window.requestIdleCallback(run, { timeout: 250 });
      } else {
        // Explicit fallback scheduling; no synchronous renderer.compile call.
        timer = window.setTimeout(run, 0);
      }
    };
    const visibility = () => {
      withdraw();
      if (!document.hidden) schedule();
    };
    const contextLost = () => {
      lost = true;
      withdraw();
      // If the optional module was never requested it has no renderer cache.
      // Loading it now still guarantees that an in-flight import cannot start
      // compiling after the context was invalidated.
      void import("@/game/graphics-warmup")
        .then(({ invalidateScenePrograms }) => invalidateScenePrograms(gl))
        .catch(() => undefined);
    };
    document.addEventListener("visibilitychange", visibility);
    gl.domElement.addEventListener("webglcontextlost", contextLost);
    schedule();
    return () => {
      active = false;
      withdraw();
      document.removeEventListener("visibilitychange", visibility);
      gl.domElement.removeEventListener("webglcontextlost", contextLost);
    };
  }, [gl, scene, camera, invalidate, enabled, requireEnvironment, host]);
  return (
    <group ref={group} visible={false} userData={{ cinematicDynamic: true }}>
      {children}
    </group>
  );
}
