use js_sys::Float64Array;
use wasm_bindgen::prelude::*;

const MAX_PLAYERS: usize = 64;
const PLAYER_VALUES: usize = MAX_PLAYERS * 4;
const OUTPUT_VALUES: usize = MAX_PLAYERS * 3;
// This is deliberately far outside any playable pitch. Corrupt but finite
// coordinates must not overflow the squared-distance/quantization arithmetic.
const MAX_SPATIAL_VALUE: f64 = 1_000_000.0;

fn finite(value: f64) -> f64 {
    if value.is_finite() {
        value.clamp(-MAX_SPATIAL_VALUE, MAX_SPATIAL_VALUE)
    } else {
        0.0
    }
}
fn quantize(value: f64) -> f64 {
    (value * 1e9).round() / 1e9
}

fn evaluate_pass_lanes_into_values(
    x: f64,
    z: f64,
    receivers: &[f64],
    defenders: &[f64],
    output: &mut [f64],
) -> usize {
    let x = finite(x);
    let z = finite(z);
    let count = (receivers.len() / 4).min(MAX_PLAYERS).min(output.len() / 3);
    let defender_count = (defenders.len() / 4).min(MAX_PLAYERS);
    for i in 0..count {
        let rx = finite(receivers[i * 4]);
        let rz = finite(receivers[i * 4 + 1]);
        let dx = rx - x;
        let dz = rz - z;
        let length_squared = dx * dx + dz * dz;
        let distance = length_squared.sqrt();
        let flight = distance / (10.0 + distance * 0.8).min(31.0);
        let mut cover_squared: f64 = 10000.0;
        let mut risk = 0.0;
        for j in 0..defender_count {
            let ox = finite(defenders[j * 4]);
            let oz = finite(defenders[j * 4 + 1]);
            let cx = rx - ox;
            let cz = rz - oz;
            cover_squared = cover_squared.min(cx * cx + cz * cz);
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
            let lane_squared = (ax * ax + az * az).min(px * px + pz * pz);
            if lane_squared < 2.2 * 2.2 {
                let lane_distance = lane_squared.sqrt();
                risk += (2.2 - lane_distance) * 2.8;
            }
        }
        output[i * 3] = quantize(distance);
        output[i * 3 + 1] = quantize(cover_squared.sqrt());
        output[i * 3 + 2] = quantize(risk);
    }
    count * 3
}

fn evaluate_pass_lanes_values(x: f64, z: f64, receivers: &[f64], defenders: &[f64]) -> Vec<f64> {
    let mut output = vec![0.0; (receivers.len() / 4).min(MAX_PLAYERS) * 3];
    evaluate_pass_lanes_into_values(x, z, receivers, defenders, &mut output);
    output
}

fn copy_players(values: &Float64Array) -> ([f64; PLAYER_VALUES], usize) {
    let length = (values.length() as usize / 4).min(MAX_PLAYERS) * 4;
    let mut copied = [0.0; PLAYER_VALUES];
    // &[f64] in an exported signature lets wasm-bindgen allocate and copy the
    // entire JS array before Rust can impose its 64-player contract.
    values
        .subarray(0, length as u32)
        .copy_to(&mut copied[..length]);
    (copied, length)
}

#[wasm_bindgen]
pub fn evaluate_pass_lanes(
    x: f64,
    z: f64,
    receivers: Float64Array,
    defenders: Float64Array,
) -> Vec<f64> {
    let (receivers, receiver_length) = copy_players(&receivers);
    let (defenders, defender_length) = copy_players(&defenders);
    evaluate_pass_lanes_values(
        x,
        z,
        &receivers[..receiver_length],
        &defenders[..defender_length],
    )
}

/// Writes complete records into JS-owned storage. No borrowed WASM-memory view
/// escapes, so memory.grow and later calls cannot invalidate the caller's data.
#[wasm_bindgen]
pub fn evaluate_pass_lanes_into(
    x: f64,
    z: f64,
    receivers: Float64Array,
    defenders: Float64Array,
    output: Float64Array,
) -> u32 {
    let (receivers, receiver_length) = copy_players(&receivers);
    let (defenders, defender_length) = copy_players(&defenders);
    let mut scratch = [0.0; OUTPUT_VALUES];
    let capacity = (output.length() as usize / 3).min(MAX_PLAYERS) * 3;
    let length = evaluate_pass_lanes_into_values(
        x,
        z,
        &receivers[..receiver_length],
        &defenders[..defender_length],
        &mut scratch[..capacity],
    );
    output
        .subarray(0, length as u32)
        .copy_from(&scratch[..length]);
    length as u32
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn moving_defender_can_close_a_lane() {
        let receiver = [20.0, 0.0, 0.0, 0.0];
        let open = evaluate_pass_lanes_values(0.0, 0.0, &receiver, &[10.0, 3.0, 0.0, 0.0]);
        let closing = evaluate_pass_lanes_values(0.0, 0.0, &receiver, &[10.0, 3.0, 0.0, -4.0]);
        assert_eq!(open[2], 0.0);
        assert!(closing[2] > open[2]);
    }
    #[test]
    fn incomplete_buffers_and_nan_are_safe() {
        assert!(evaluate_pass_lanes_values(0.0, 0.0, &[1.0], &[]).is_empty());
        assert!(
            evaluate_pass_lanes_values(f64::NAN, 0.0, &[2.0, 0.0, 0.0, 0.0], &[])
                .iter()
                .all(|v| v.is_finite())
        );
    }

    #[test]
    fn batches_ignore_records_past_the_sixty_four_player_bound() {
        let receivers = vec![20.0; 64 * 4];
        let defenders = vec![100.0; 64 * 4];
        let expected = evaluate_pass_lanes_values(0.0, 0.0, &receivers, &defenders);
        let mut oversized_receivers = receivers.clone();
        let mut oversized_defenders = defenders.clone();
        oversized_receivers.extend([1.0, 0.0, 0.0, 0.0]);
        oversized_defenders.extend([10.0, 10.0, 0.0, 0.0]);
        assert_eq!(expected.len(), 64 * 3);
        assert_eq!(
            evaluate_pass_lanes_values(0.0, 0.0, &oversized_receivers, &oversized_defenders),
            expected
        );
    }

    #[test]
    fn finite_but_overflowing_coordinates_never_poison_perception() {
        for value in [f64::MAX, -f64::MAX, 1e200, -1e200] {
            let result = evaluate_pass_lanes_values(
                value,
                value,
                &[value, -value, 0.0, 0.0],
                &[value, value, value, -value],
            );
            assert!(result.iter().all(|v| v.is_finite()));
        }
    }

    #[test]
    fn reusable_output_writes_only_complete_records_and_preserves_tail() {
        let receivers = [20.0, 0.0, 0.0, 0.0, 25.0, 1.0, 0.0, 0.0];
        let mut output = [123.0; 5];
        assert_eq!(
            evaluate_pass_lanes_into_values(0.0, 0.0, &receivers, &[], &mut output),
            3
        );
        assert_eq!(&output[..3], &[20.0, 100.0, 0.0]);
        assert_eq!(&output[3..], &[123.0; 2]);
    }
}
