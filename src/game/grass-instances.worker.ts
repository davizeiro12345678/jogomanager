import { buildGrassInstanceBuffers, type GrassChunkOrigin } from "./grass-instance-data";

type BuildRequest = Readonly<{
  type: "build";
  id: number;
  chunks: readonly GrassChunkOrigin[];
  count: number;
  width: number;
  depth: number;
  fieldX: number;
}>;

self.onmessage = ({ data }: MessageEvent<BuildRequest>) => {
  if (data.type !== "build") return;
  const buffers = buildGrassInstanceBuffers(
    data.chunks,
    data.count,
    data.width,
    data.depth,
    data.fieldX,
  );
  const transfer = buffers.flatMap((entry) => [entry.matrices.buffer, entry.colors.buffer]);
  self.postMessage({ type: "ready", id: data.id, buffers }, transfer);
};
