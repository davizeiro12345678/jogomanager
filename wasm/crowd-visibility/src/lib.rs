mod match_perception;

#[cfg(test)]
mod contract_tests {
    use super::select_crowd_values;

    fn planes(values: &[[f64; 4]; 6]) -> Vec<f64> {
        values
            .iter()
            .flat_map(|plane| plane.iter().copied())
            .collect()
    }

    #[test]
    fn orders_equally_distant_tiles_by_tile_index_and_packs_lod() {
        let positions = vec![
            -5.0, 0.0, 0.0, // seat 0, detailed
            5.0, 0.0, 0.0, // seat 1, detailed
            20.0, 0.0, 0.0, // seat 2, card
        ];
        let tiles = vec![
            -5.0, 0.0, 0.0, 1.0, // tile 0
            5.0, 0.0, 0.0, 1.0, // tile 1
            20.0, 0.0, 0.0, 1.0, // tile 2
        ];
        let offsets = vec![0, 1, 2, 3];
        let seats = vec![0, 1, 2];
        let frustum = planes(&[[0.0, 0.0, 0.0, 1.0]; 6]);

        let selected = select_crowd_values(
            &positions,
            &tiles,
            &offsets,
            &seats,
            &frustum,
            &[0.0, 0.0, 0.0],
            50.0,
            true,
            3,
            3,
            10.0,
            4.0,
        );

        // Two equally distant tiles must retain the fallback's index tie-break;
        // packed output is seat << 2 | tier.
        assert_eq!(selected, vec![(0 << 2) | 0, (1 << 2) | 0, (2 << 2) | 2]);
    }

    #[test]
    fn culls_visible_tiles_but_uses_first_tiles_when_the_frustum_has_none() {
        let positions = vec![0.0, 0.0, 0.0, 10.0, 0.0, 0.0];
        let tiles = vec![0.0, 0.0, 0.0, 1.0, 10.0, 0.0, 0.0, 1.0];
        let offsets = vec![0, 1, 2];
        let seats = vec![0, 1];
        let only_far_tile = planes(&[
            [1.0, 0.0, 0.0, -5.0],
            [0.0, 0.0, 0.0, 1.0],
            [0.0, 0.0, 0.0, 1.0],
            [0.0, 0.0, 0.0, 1.0],
            [0.0, 0.0, 0.0, 1.0],
            [0.0, 0.0, 0.0, 1.0],
        ]);
        let no_tile = planes(&[
            [1.0, 0.0, 0.0, -100.0],
            [0.0, 0.0, 0.0, 1.0],
            [0.0, 0.0, 0.0, 1.0],
            [0.0, 0.0, 0.0, 1.0],
            [0.0, 0.0, 0.0, 1.0],
            [0.0, 0.0, 0.0, 1.0],
        ]);

        let visible = select_crowd_values(
            &positions,
            &tiles,
            &offsets,
            &seats,
            &only_far_tile,
            &[0.0, 0.0, 0.0],
            1.0,
            false,
            1,
            1,
            5.0,
            2.0,
        );
        let fallback = select_crowd_values(
            &positions,
            &tiles,
            &offsets,
            &seats,
            &no_tile,
            &[0.0, 0.0, 0.0],
            1.0,
            false,
            1,
            1,
            5.0,
            2.0,
        );

        assert_eq!(visible, vec![(1 << 2) | 2]);
        assert_eq!(fallback, vec![(0 << 2) | 2]);
    }

    #[test]
    fn samples_each_tile_with_the_same_stride_and_stops_at_instance_limit() {
        let positions = (0..7)
            .flat_map(|seat| [seat as f64, 0.0, 0.0])
            .collect::<Vec<_>>();
        let tiles = vec![0.0, 0.0, 0.0, 1.0];
        let offsets = vec![0, 7];
        let seats = vec![0, 1, 2, 3, 4, 5, 6];

        let selected = select_crowd_values(
            &positions,
            &tiles,
            &offsets,
            &seats,
            &[],
            &[0.0, 0.0, 0.0],
            1.0,
            false,
            1,
            3,
            2.0,
            1.0,
        );

        assert_eq!(selected, vec![(0 << 2) | 1, (3 << 2) | 1, (6 << 2) | 1]);
    }

    #[test]
    fn short_or_non_finite_frustum_preserves_the_defensive_visible_path() {
        let positions = vec![4.0, 0.0, 0.0];
        let tiles = vec![4.0, 0.0, 0.0, 1.0];
        let offsets = vec![0, 1];
        let seats = vec![0];

        let short = select_crowd_values(
            &positions,
            &tiles,
            &offsets,
            &seats,
            &[],
            &[0.0, 0.0, 0.0],
            1.0,
            false,
            1,
            1,
            2.0,
            1.0,
        );
        let non_finite = select_crowd_values(
            &positions,
            &tiles,
            &offsets,
            &seats,
            &[f64::NAN; 24],
            &[0.0, 0.0, 0.0],
            1.0,
            false,
            1,
            1,
            2.0,
            1.0,
        );

        assert_eq!(short, vec![(0 << 2) | 1]);
        assert_eq!(non_finite, vec![(0 << 2) | 1]);
    }
}

use std::cmp::Ordering;

use js_sys::{Float64Array, Uint32Array};
use wasm_bindgen::prelude::*;

#[derive(Clone, Copy)]
struct VisibleTile {
    tile: usize,
    distance: f64,
}

fn finite(value: f64) -> f64 {
    if value.is_finite() {
        value
    } else {
        0.0
    }
}

fn camera_component(camera: &[f64], index: usize) -> f64 {
    // A normal façade call always supplies exactly three values. NaN mirrors
    // JavaScript's `undefined` arithmetic if a direct consumer supplies less.
    camera.get(index).copied().unwrap_or(f64::NAN)
}

fn intersects_frustum(planes: &[f64], x: f64, y: f64, z: f64, radius: f64) -> bool {
    // This follows the defensive TypeScript fallback: an incomplete or bad
    // frustum must never blank the entire audience during a camera update.
    if planes.len() < 24 {
        return true;
    }
    for index in (0..24).step_by(4) {
        let nx = planes[index];
        let ny = planes[index + 1];
        let nz = planes[index + 2];
        let constant = planes[index + 3];
        if !(nx.is_finite() && ny.is_finite() && nz.is_finite() && constant.is_finite()) {
            return true;
        }
        if nx * x + ny * y + nz * z + constant < -radius {
            return false;
        }
    }
    true
}

fn js_distance_order(left: f64, right: f64) -> Ordering {
    // `Array.sort((a, b) => a.distance - b.distance || a.tile - b.tile)`
    // falls through to the index comparison for NaN and equal distances.
    let delta = left - right;
    if delta.is_nan() || delta == 0.0 {
        Ordering::Equal
    } else if delta < 0.0 {
        Ordering::Less
    } else {
        Ordering::Greater
    }
}

fn hypot3(x: f64, y: f64, z: f64) -> f64 {
    // Keep the arithmetic identical to the Three.js-compatible fallback:
    // sqrt((x * x + y * y) + z * z). WebAssembly has separate multiply/add
    // operations here, so this avoids hypot's normalization and any FMA path.
    let x_squared = x * x;
    let y_squared = y * y;
    let xy_sum = x_squared + y_squared;
    let z_squared = z * z;
    (xy_sum + z_squared).sqrt()
}

fn max_one(value: f64) -> f64 {
    // `f64::max` intentionally ignores NaN, unlike `Math.max`; spell out the
    // JavaScript behavior so invalid direct inputs retain the fallback result.
    if value.is_nan() {
        f64::NAN
    } else if value > 1.0 {
        value
    } else {
        1.0
    }
}

#[allow(clippy::too_many_arguments)]
fn select_crowd_values(
    positions: &[f64],
    tiles: &[f64],
    tile_offsets: &[u32],
    tile_indices: &[u32],
    frustum_planes: &[f64],
    camera: &[f64],
    projected_scale: f64,
    perspective: bool,
    max_tiles: u32,
    max_instances: u32,
    detailed_pixels: f64,
    mesh_pixels: f64,
) -> Vec<u32> {
    let tile_count = tiles.len() / 4;
    let position_count = positions.len() / 3;
    let max_tiles = tile_count.min(max_tiles as usize);
    let max_instances = max_instances as usize;
    if tile_count == 0 || max_tiles == 0 || max_instances == 0 {
        return Vec::new();
    }

    let camera_x = camera_component(camera, 0);
    let camera_y = camera_component(camera, 1);
    let camera_z = camera_component(camera, 2);
    let mut visible = Vec::with_capacity(tile_count);
    for tile in 0..tile_count {
        let offset = tile * 4;
        let x = tiles[offset];
        let y = tiles[offset + 1];
        let z = tiles[offset + 2];
        let radius = tiles[offset + 3];
        if intersects_frustum(frustum_planes, x, y, z, radius) {
            visible.push(VisibleTile {
                tile,
                distance: hypot3(x - camera_x, y - camera_y, z - camera_z),
            });
        }
    }
    visible.sort_by(|left, right| {
        js_distance_order(left.distance, right.distance).then_with(|| left.tile.cmp(&right.tile))
    });

    let selected_tiles: Vec<usize> = if visible.is_empty() {
        (0..max_tiles).collect()
    } else {
        visible
            .into_iter()
            .take(max_tiles)
            .map(|candidate| candidate.tile)
            .collect()
    };
    let per_tile = ((max_instances as u64 + selected_tiles.len() as u64 - 1)
        / selected_tiles.len() as u64) as usize;
    let projected_scale = finite(projected_scale);
    let detailed_pixels = finite(detailed_pixels);
    let mesh_pixels = finite(mesh_pixels);
    let mut output = Vec::with_capacity(max_instances);

    for tile in selected_tiles {
        let Some(&start) = tile_offsets.get(tile) else {
            continue;
        };
        let Some(&end) = tile_offsets.get(tile + 1) else {
            continue;
        };
        let start = start as usize;
        let end = (end as usize).min(tile_indices.len());
        if start >= end || start >= tile_indices.len() {
            continue;
        }
        let stride = ((end - start) + per_tile - 1) / per_tile;
        for offset in (start..end).step_by(stride.max(1)) {
            if output.len() >= max_instances {
                break;
            }
            let seat = tile_indices[offset];
            let seat_index = seat as usize;
            if seat_index >= position_count {
                continue;
            }
            let position_offset = seat_index * 3;
            let distance = hypot3(
                positions[position_offset] - camera_x,
                positions[position_offset + 1] - camera_y,
                positions[position_offset + 2] - camera_z,
            );
            let pixels = if perspective {
                projected_scale / max_one(distance)
            } else {
                projected_scale
            };
            let tier = if pixels >= detailed_pixels {
                0
            } else if pixels >= mesh_pixels {
                1
            } else {
                2
            };
            output.push(seat.wrapping_shl(2) | tier);
        }
    }
    output
}

/// Selects only presentation seats and their LOD tier. The surrounding game
/// keeps ownership of Three.js matrices, simulation, saves and replay state.
/// Each item is encoded as `seat << 2 | tier`, where tier is 0, 1 or 2.
#[wasm_bindgen]
#[allow(clippy::too_many_arguments)]
pub fn select_crowd(
    positions: Float64Array,
    tiles: Float64Array,
    tile_offsets: Uint32Array,
    tile_indices: Uint32Array,
    frustum_planes: Float64Array,
    camera: Float64Array,
    projected_scale: f64,
    perspective: bool,
    max_tiles: u32,
    max_instances: u32,
    detailed_pixels: f64,
    mesh_pixels: f64,
) -> Vec<u32> {
    select_crowd_values(
        &positions.to_vec(),
        &tiles.to_vec(),
        &tile_offsets.to_vec(),
        &tile_indices.to_vec(),
        &frustum_planes.to_vec(),
        &camera.to_vec(),
        projected_scale,
        perspective,
        max_tiles,
        max_instances,
        detailed_pixels,
        mesh_pixels,
    )
}
