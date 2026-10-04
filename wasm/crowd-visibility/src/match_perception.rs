use wasm_bindgen::prelude::*;

fn finite(value: f64) -> f64 {
    if value.is_finite() {
        value
    } else {
        0.0
    }
}
fn quantize(value: f64) -> f64 {
    (value * 1e9).round() / 1e9
}

#[wasm_bindgen]
pub fn evaluate_pass_lanes(x: f64, z: f64, receivers: &[f64], defenders: &[f64]) -> Vec<f64> {
    let x = finite(x);
    let z = finite(z);
    let count = (receivers.len() / 4).min(64);
    let mut output = Vec::with_capacity(count * 3);
    for i in 0..count {
        let rx = finite(receivers[i * 4]);
        let rz = finite(receivers[i * 4 + 1]);
        let dx = rx - x;
        let dz = rz - z;
        let length_squared = dx * dx + dz * dz;
        let distance = length_squared.sqrt();
        let flight = distance / (10.0 + distance * 0.8).min(31.0);
        let mut cover: f64 = 100.0;
        let mut risk = 0.0;
        for j in 0..(defenders.len() / 4).min(64) {
            let ox = finite(defenders[j * 4]);
            let oz = finite(defenders[j * 4 + 1]);
            let cx = rx - ox;
            let cz = rz - oz;
            cover = cover.min((cx * cx + cz * cz).sqrt());
            let denominator = if length_squared == 0.0 {
                1.0
            } else {
                length_squared
            };
            let t = (((ox - x) * dx + (oz - z) * dz) / denominator).clamp(0.0, 1.0);
            let ax = ox - (x + dx * t);
            let az = oz - (z + dz * t);
            let px = ax + (finite(defenders[j * 4 + 2]) * flight * t).clamp(-1.5, 1.5);
            let pz = az + (finite(defenders[j * 4 + 3]) * flight * t).clamp(-1.5, 1.5);
            let lane_distance = (ax * ax + az * az).sqrt().min((px * px + pz * pz).sqrt());
            if lane_distance < 2.2 {
                risk += (2.2 - lane_distance) * 2.8;
            }
        }
        output.extend([quantize(distance), quantize(cover), quantize(risk)]);
    }
    output
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn moving_defender_can_close_a_lane() {
        let receiver = [20.0, 0.0, 0.0, 0.0];
        let open = evaluate_pass_lanes(0.0, 0.0, &receiver, &[10.0, 3.0, 0.0, 0.0]);
        let closing = evaluate_pass_lanes(0.0, 0.0, &receiver, &[10.0, 3.0, 0.0, -4.0]);
        assert_eq!(open[2], 0.0);
        assert!(closing[2] > open[2]);
    }
    #[test]
    fn incomplete_buffers_and_nan_are_safe() {
        assert!(evaluate_pass_lanes(0.0, 0.0, &[1.0], &[]).is_empty());
        assert!(
            evaluate_pass_lanes(f64::NAN, 0.0, &[2.0, 0.0, 0.0, 0.0], &[])
                .iter()
                .all(|v| v.is_finite())
        );
    }
}
