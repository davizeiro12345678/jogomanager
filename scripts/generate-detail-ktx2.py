"""Generate original periodic material tiles; use Khronos KTX 4.4.2, no external artwork."""
import math
import pathlib
import struct
import subprocess
import sys
import tempfile
import zlib

SIZE = 1024
TAU = math.tau
OUTPUT = pathlib.Path(__file__).resolve().parents[1] / "public/textures/detail-v1"

def chunk(name, data):
    return struct.pack(">I", len(data)) + name + data + struct.pack(">I", zlib.crc32(name + data))

def png(path, rgb):
    stride = SIZE * 3
    raw = b"".join(b"\0" + rgb[y * stride:(y + 1) * stride] for y in range(SIZE))
    path.write_bytes(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", SIZE, SIZE, 8, 2, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw, 6)) + chunk(b"IEND", b""))

def field(kind):
    values = []
    for y in range(SIZE):
        v = y * TAU / SIZE
        for x in range(SIZE):
            u = x * TAU / SIZE
            if kind == "hair":
                phase = u * 89 + 0.7 * math.sin(v * 3) + 0.25 * math.sin(v * 11)
                h = 0.52 * math.sin(phase) + 0.18 * math.sin(phase * 2) + 0.18 * math.sin(u * 53 + v * 2)
            elif kind == "fabric":
                warp = math.sin(u * 48 + 0.2 * math.sin(v * 48))
                weft = math.sin(v * 48 + 0.2 * math.sin(u * 48))
                h = 0.42 * warp + 0.42 * weft + 0.16 * warp * weft
            else:
                h = (0.45 * math.sin(u * 49 + v * 8 + 0.9 * math.sin(v * 9)) +
                     0.24 * math.sin(u * 79 - v * 13) + 0.18 * math.sin(v * 37 + u * 11) +
                     0.13 * math.sin(u * 7 + v * 5))
            values.append(h)
    return values

def normal(values, strength):
    out = bytearray(SIZE * SIZE * 3)
    for y in range(SIZE):
        for x in range(SIZE):
            dx = (values[y * SIZE + (x + 1) % SIZE] - values[y * SIZE + (x - 1) % SIZE]) * strength
            dy = (values[((y + 1) % SIZE) * SIZE + x] - values[((y - 1) % SIZE) * SIZE + x]) * strength
            scale = 127.5 / math.sqrt(1 + dx * dx + dy * dy)
            i = (y * SIZE + x) * 3
            out[i:i+3] = bytes((round(127.5 - dx * scale), round(127.5 - dy * scale), round(127.5 + scale)))
    return out

def rough(values, center, amount):
    out = bytearray(SIZE * SIZE * 3)
    for i, v in enumerate(values):
        r = max(0, min(255, round(center + amount * v)))
        out[i*3:i*3+3] = bytes((r, r, r))
    return out

def main():
    ktx = sys.argv[1]
    OUTPUT.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as temp:
        temp = pathlib.Path(temp)
        for kind in ("hair", "fabric", "turf"):
            values = field(kind)
            maps = [(f"{kind}-normal", normal(values, 0.65 if kind == "hair" else 0.9), True)]
            if kind != "hair":
                maps.append((f"{kind}-rough", rough(values, 214, 34), False))
            for name, rgb, is_normal in maps:
                source = temp / (name + ".png")
                dest = OUTPUT / (name + ".ktx2")
                png(source, rgb)
                args = ["--encode", "uastc", "--uastc-quality", "1", "--zstd", "9", "--normalize"] if is_normal else ["--encode", "basis-lz", "--qlevel", "160"]
                subprocess.run([ktx, "create", "--format", "R8G8B8_UNORM", "--assign-tf", "linear", "--assign-primaries", "none", "--generate-mipmap", "--threads", "2", *args, str(source), str(dest)], check=True)
                subprocess.run([ktx, "validate", "--gltf-basisu", "--warnings-as-errors", str(dest)], check=True)
                print(name, dest.stat().st_size, flush=True)

if __name__ == "__main__":
    main()
