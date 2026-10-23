use wasm_bindgen::prelude::*;

pub const MAX_WEATHER_INSTANCES: usize = 8192;

fn hash(index: u32, seed: u32) -> u32 {
    let mut value = index.wrapping_mul(0x1f123bb5) ^ seed;
    value ^= value >> 16;
    value = value.wrapping_mul(0x45d9f3b);
    value ^= value >> 16;
    value
}

/// Packed f32 GPU spawn data: x/y/z, fall speed, snow phase. Presentation only.
/// A bounded one-time batch; movement stays in the vertex shader.
#[wasm_bindgen]
pub fn build_weather_instances(count: f64, seed: u32) -> Vec<f32> {
    if !count.is_finite() || count.fract() != 0.0 || !(0.0..=MAX_WEATHER_INSTANCES as f64).contains(&count) {
        return Vec::new();
    }
    let mut data = Vec::with_capacity(count as usize * 5);
    for index in 0..count as u32 {
        let offset = index * 5;
        let unit = |channel| (hash(offset + channel, seed) & 0xffffff) as f32 / 16777216.0;
        data.extend_from_slice(&[
            (unit(0) * 2.0 - 1.0) * 78.5,
            unit(1) * 36.0,
            (unit(2) * 2.0 - 1.0) * 58.0,
            0.6 + unit(3) * 0.9,
            unit(4) * std::f32::consts::TAU,
        ]);
    }
    data
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn bounded_finite_repeatable_layout() {
        let a = build_weather_instances(2600.0, 42);
        assert_eq!(a.len(), 2600 * 5);
        assert_eq!(a, build_weather_instances(2600.0, 42));
        assert_ne!(a, build_weather_instances(2600.0, 43));
        assert!(a.iter().all(|v| v.is_finite()));
        for particle in a.as_chunks::<5>().0 {
            assert!(particle[0].abs() <= 78.5 && particle[2].abs() <= 58.0);
            assert!((0.0..36.0).contains(&particle[1]));
            assert!((0.6..=1.5).contains(&particle[3]));
        }
        for count in [-1.0, 1.5, 8193.0, f64::NAN, f64::INFINITY, 4294967296.0] {
            assert!(build_weather_instances(count, 42).is_empty());
        }
    }
}
