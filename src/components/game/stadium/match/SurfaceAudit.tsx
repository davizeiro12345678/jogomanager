import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
export default function SurfaceAudit() {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);
  useEffect(() => {
    if (!location.pathname.endsWith("/mobile-match.html")) return;
    const inspect = () => {
      const surfaces = ["pitch-underlay", "pitch-surface"].map((name) => {
        const mesh = scene.getObjectByName(name) as import("three").Mesh | undefined;
        const material = mesh?.material as import("three").MeshStandardMaterial | undefined;
        const image = material?.map?.image as { width?: number; height?: number } | undefined;
        return {
          name,
          found: Boolean(mesh),
          visible: mesh?.visible,
          vertices: mesh?.geometry.getAttribute("position")?.count,
          position: mesh?.position.toArray(),
          rotation: mesh?.rotation.toArray(),
          material: material?.type,
          color: material?.color?.getHexString(),
          opacity: material?.opacity,
          side: material?.side,
          map: image ? { width: image.width ?? null, height: image.height ?? null } : null,
          positions: Array.from(mesh?.geometry.getAttribute("position")?.array ?? []),
          world: mesh?.matrixWorld.toArray(),
          camera: camera.position.toArray(),
          transparent: material?.transparent,
          depthTest: material?.depthTest,
          depthWrite: material?.depthWrite,
          context: gl.getContext().getContextAttributes(),
        };
      });
      window.dispatchEvent(new CustomEvent("graphics-inspected", { detail: surfaces }));
    };
    window.addEventListener("graphics-inspect", inspect);
    return () => window.removeEventListener("graphics-inspect", inspect);
  }, [scene, gl, camera]);
  return null;
}
