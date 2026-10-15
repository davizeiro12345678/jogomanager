use wasm_bindgen::prelude::*;

fn hash(x: u32, y: u32, seed: u32) -> u32 {
    let mut v = x.wrapping_mul(0x1f123bb5) ^ y.wrapping_mul(0x5f356495) ^ seed;
    v ^= v >> 16;
    v = v.wrapping_mul(0x45d9f3b);
    v ^= v >> 16;
    v
}

/// A seamless fibre normal tile and roughness tile, packed RGBA then RGBA.
/// Integer arithmetic keeps native Rust, WASM and the JS fallback byte-identical.
#[wasm_bindgen]
pub fn build_turf_detail(size: f64, seed: u32) -> Vec<u8> {
    // Accept the JS number without wasm-bindgen's implicit u32 truncation.
    // Fractions and wrapped integers must match the TypeScript rejection path.
    if !size.is_finite() || size.fract() != 0.0 || !(32.0..=1024.0).contains(&size) {
        return Vec::new();
    }
    let size = size as u32;
    if !size.is_power_of_two() {
        return Vec::new();
    }
    let pixels = (size * size) as usize;
    let mut out = vec![0u8; pixels * 8];
    for y in 0..size {
        for x in 0..size {
            let h = hash(x, y, seed);
            // Adjacent rows retain a blade's direction; clumps vary across the tile.
            let fibre = hash(x / 2, y / 8, seed ^ 0x71b2);
            let dx = ((fibre & 63) as i32 - 31) / 2 + ((h & 15) as i32 - 7);
            let dy = (((fibre >> 8) & 63) as i32 - 31) / 2 + (((h >> 8) & 15) as i32 - 7);
            let i = ((y * size + x) * 4) as usize;
            out[i] = (128 + dx) as u8;
            out[i + 1] = (128 + dy) as u8;
            out[i + 2] = (255 - (dx * dx + dy * dy) / 255) as u8;
            out[i + 3] = 255;
            let r = (190 + ((h >> 20) & 31) + ((fibre >> 16) & 15)) as u8;
            let j = pixels * 4 + i;
            out[j] = r;
            out[j + 1] = r;
            out[j + 2] = r;
            out[j + 3] = 255;
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rejects_unbounded_or_invalid_allocations() {
        for size in [
            -1.0,
            0.0,
            31.0,
            33.0,
            64.5,
            2048.0,
            u32::MAX as f64,
            4294967360.0,
            -4294967232.0,
            f64::MAX,
            f64::NAN,
            f64::INFINITY,
        ] {
            assert!(build_turf_detail(size, 1).is_empty());
        }
    }
    #[test]
    fn deterministic_two_tiles_have_neutral_normals_and_opaque_alpha() {
        let output = build_turf_detail(64.0, 2106);
        assert_eq!(output.len(), 64 * 64 * 8);
        assert_eq!(output, build_turf_detail(64.0, 2106));
        assert_ne!(output, build_turf_detail(64.0, 2107));
        for px in output[..64 * 64 * 4].as_chunks::<4>().0 {
            assert!((104..=152).contains(&px[0]));
            assert!((104..=152).contains(&px[1]));
            assert!(px[2] >= 251);
            assert_eq!(px[3], 255);
        }
    }
}
