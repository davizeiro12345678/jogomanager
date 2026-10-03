/**
 * CI guard for the production 3D-asset intake.
 *
 * It deliberately does not transcode arbitrary user files in CI: authors use
 * their approved DCC/asset pipeline, then this guard rejects uncompressed
 * glTF/GLB payloads before they can reach the browser bundle.
 */
import { access, readdir, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";

const assetRoot = path.resolve(process.env.GAME_ASSET_ROOT ?? "public/game-assets");
const modelExtensions = new Set([".gltf", ".glb"]);
const geometryExtensions = new Set(["KHR_draco_mesh_compression", "EXT_meshopt_compression"]);
const textureExtension = "KHR_texture_basisu";

async function exists(file) {
  try {
    await access(file, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const full = path.join(directory, entry.name);
      return entry.isDirectory() ? walk(full) : [full];
    }),
  );
  return nested.flat();
}

function glbJson(buffer, filename) {
  if (buffer.length < 20 || buffer.toString("utf8", 0, 4) !== "glTF") {
    throw new Error(`${filename}: GLB inválido (header glTF ausente).`);
  }
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32LE(offset);
    const kind = buffer.readUInt32LE(offset + 4);
    const start = offset + 8;
    const end = start + length;
    if (end > buffer.length) throw new Error(`${filename}: chunk GLB truncado.`);
    // JSON in little-endian bytes: ASCII "JSON" = 0x4e4f534a.
    if (kind === 0x4e4f534a) return JSON.parse(buffer.toString("utf8", start, end));
    offset = end;
  }
  throw new Error(`${filename}: chunk JSON ausente.`);
}

async function readModelJson(filename) {
  const buffer = await readFile(filename);
  if (path.extname(filename).toLowerCase() === ".gltf") return JSON.parse(buffer.toString("utf8"));
  return glbJson(buffer, filename);
}

function reportPath(filename) {
  return path.relative(process.cwd(), filename).replaceAll("\\", "/");
}

function validateModel(filename, json) {
  const extensions = new Set(Array.isArray(json.extensionsUsed) ? json.extensionsUsed : []);
  const errors = [];
  if (![...geometryExtensions].some((extension) => extensions.has(extension))) {
    errors.push("exige KHR_draco_mesh_compression ou EXT_meshopt_compression");
  }

  const images = Array.isArray(json.images) ? json.images : [];
  const usesImages =
    images.length > 0 || (Array.isArray(json.textures) && json.textures.length > 0);
  const hasKtx2 =
    extensions.has(textureExtension) ||
    images.some(
      (image) =>
        image.mimeType === "image/ktx2" ||
        (typeof image.uri === "string" && image.uri.toLowerCase().endsWith(".ktx2")),
    );
  if (usesImages && !hasKtx2) errors.push("texturas exigem KTX2/Basis (KHR_texture_basisu)");

  return errors.map((message) => `${reportPath(filename)}: ${message}.`);
}

if (!(await exists(assetRoot))) {
  console.log(
    "[assets] Nenhum diretório public/game-assets ainda; contrato de intake aguardando assets 3D.",
  );
  process.exit(0);
}

const files = await walk(assetRoot);
const models = files.filter((filename) =>
  modelExtensions.has(path.extname(filename).toLowerCase()),
);
if (!models.length) {
  console.log("[assets] Nenhum glTF/GLB de produção encontrado; nada para validar.");
  process.exit(0);
}

const violations = [];
for (const filename of models) {
  try {
    violations.push(...validateModel(filename, await readModelJson(filename)));
  } catch (error) {
    violations.push(
      error instanceof Error ? error.message : `${reportPath(filename)}: erro desconhecido.`,
    );
  }
}

if (violations.length) {
  console.error("[assets] Contrato de compressão falhou:");
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log(
  `[assets] ${models.length} modelo(s) validado(s): glTF + Meshopt/Draco e KTX2 quando texturizado.`,
);
