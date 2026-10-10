#[cfg(test)]
mod contract_tests {
    use super::{
        bounded_layout_lengths, select_crowd_into, select_crowd_values, CrowdScratch,
        MAX_REFERENCES, MAX_SEATS, MAX_TILES,
    };

    #[test]
    fn layout_boundaries_are_checked_without_allocating_the_requested_buffers() {
        assert!(bounded_layout_lengths(
            MAX_SEATS * 3,
            MAX_TILES * 4,
            MAX_TILES + 1,
            MAX_REFERENCES
        ));
        for lengths in [
            (MAX_SEATS * 3 + 1, 4, 2, 1),
            (3, MAX_TILES * 4 + 1, 2, 1),
            (3, 4, MAX_TILES + 2, 1),
            (3, 4, 2, MAX_REFERENCES + 1),
            (usize::MAX, usize::MAX, usize::MAX, usize::MAX),
        ] {
            assert!(!bounded_layout_lengths(
                lengths.0, lengths.1, lengths.2, lengths.3
            ));
        }
    }

    #[test]
    fn large_layout_partition_preserves_nearest_order_and_ties() {
        let mut tiles = Vec::new();
        let mut positions = Vec::new();
        for index in 0..128 {
            let distance = ((127 - index) / 2) as f64;
            tiles.extend([distance, 0.0, 0.0, 1.0]);
            positions.extend([distance, 0.0, 0.0]);
        }
        let selected = select_crowd_values(
            &positions,
            &tiles,
            &(0..=128).collect::<Vec<_>>(),
            &(0..128).collect::<Vec<_>>(),
            &[],
            &[0.0; 3],
            1.0,
            false,
            8,
            8,
            2.0,
            1.0,
        );
        let expected: Vec<u32> = [126, 127, 124, 125, 122, 123, 120, 121]
            .into_iter()
            .map(|seat| (seat << 2) | 1)
            .collect();
        assert_eq!(selected, expected);
    }

    #[test]
    fn overlapping_offsets_cannot_amplify_output_past_reference_buffer() {
        let selected = select_crowd_values(
            &[0.0; 3],
            &[0.0, 0.0, 0.0, 1.0, 1.0, 0.0, 0.0, 1.0, 2.0, 0.0, 0.0, 1.0],
            &[0, 2, 0, 2],
            &[0, 0],
            &[],
            &[0.0; 3],
            1.0,
            false,
            3,
            u32::MAX,
            2.0,
            1.0,
        );
        assert_eq!(selected, vec![1, 1]);
    }

    #[test]
    fn mixed_non_finite_tile_distances_do_not_trap_the_selector() {
        let mut tiles = Vec::new();
        let mut offsets = Vec::new();
        let mut indices = Vec::new();
        let mut seed = 0x12345678u32;
        for i in 0..2048 {
            seed = seed.wrapping_mul(1664525).wrapping_add(1013904223);
            let x = if seed & 3 == 0 {
                f64::NAN
            } else {
                (seed % 1000) as f64
            };
            tiles.extend([x, 0.0, 0.0, 1.0]);
            offsets.push(i);
            indices.push(0);
        }
        offsets.push(2048);
        let result = select_crowd_values(
            &[0.0; 3],
            &tiles,
            &offsets,
            &indices,
            &[],
            &[0.0; 3],
            1.0,
            false,
            2048,
            2048,
            2.0,
            1.0,
        );
        assert_eq!(result.len(), 2048);
    }

    #[test]
    fn oversized_rust_layout_clears_previous_selection() {
        let mut scratch = CrowdScratch {
            output: vec![1],
            ..CrowdScratch::default()
        };
        let positions = vec![0.0; MAX_SEATS * 3 + 1];
        select_crowd_into(
            &positions,
            &[0.0, 0.0, 0.0, 1.0],
            &[0, 1],
            &[0],
            &[],
            &[0.0; 3],
            1.0,
            false,
            1,
            1,
            2.0,
            1.0,
            &mut scratch,
        );
        assert!(scratch.output.is_empty());
        assert!(scratch.visible.is_empty());
    }

    #[test]
    fn huge_abi_budget_does_not_reserve_gigabytes() {
        let mut scratch = CrowdScratch::default();
        select_crowd_into(
            &[0.0; 3],
            &[0.0, 0.0, 0.0, 1.0],
            &[0, 1],
            &[0],
            &[],
            &[0.0; 3],
            1.0,
            false,
            1,
            u32::MAX,
            2.0,
            1.0,
            &mut scratch,
        );
        assert_eq!(scratch.output, vec![1]);
        assert!(scratch.output.capacity() < 16);
        let output_capacity = scratch.output.capacity();
        let tile_capacity = scratch.visible.capacity();
        select_crowd_into(
            &[0.0; 3],
            &[0.0, 0.0, 0.0, 1.0],
            &[0, 1],
            &[0],
            &[],
            &[0.0; 3],
            1.0,
            false,
            1,
            0,
            2.0,
            1.0,
            &mut scratch,
        );
        assert!(scratch.output.is_empty());
        assert_eq!(scratch.output.capacity(), output_capacity);
        assert_eq!(scratch.visible.capacity(), tile_capacity);
    }

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
        assert_eq!(selected, vec![0, 4, 10]);
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
        assert_eq!(fallback, vec![2]);
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

        assert_eq!(selected, vec![1, 13, 25]);
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

        assert_eq!(short, vec![1]);
        assert_eq!(non_finite, vec![1]);
    }
}

use std::cmp::Ordering;

use js_sys::{Float64Array, Uint32Array};
use wasm_bindgen::prelude::*;

// ABI callers can bypass the scene's budgets. Check lengths before copying JS
// arrays, bounding both retained layout memory and each selection's scratch.
pub(crate) const MAX_SEATS: usize = 262_144;
pub(crate) const MAX_TILES: usize = 65_536;
pub(crate) const MAX_REFERENCES: usize = 1_048_576;

fn bounded_layout_lengths(positions: usize, tiles: usize, offsets: usize, indices: usize) -> bool {
    positions <= MAX_SEATS * 3
        && tiles <= MAX_TILES * 4
        && offsets <= MAX_TILES + 1
        && indices <= MAX_REFERENCES
}

fn bounded_js_layout(
    positions: &Float64Array,
    tiles: &Float64Array,
    offsets: &Uint32Array,
    indices: &Uint32Array,
) -> bool {
    bounded_layout_lengths(
        positions.length() as usize,
        tiles.length() as usize,
        offsets.length() as usize,
        indices.length() as usize,
    )
}

fn copy_prefix<const N: usize>(values: &Float64Array, fill: f64) -> [f64; N] {
    let mut output = [fill; N];
    let count = (values.length() as usize).min(N);
    values
        .subarray(0, count as u32)
        .copy_to(&mut output[..count]);
    output
}

fn copy_planes(values: &Float64Array) -> [f64; 24] {
    // The fallback treats *any* incomplete frustum as visible, even when an
    // existing prefix plane would reject a tile. Do not pad just the suffix.
    if values.length() < 24 {
        [f64::NAN; 24]
    } else {
        copy_prefix(values, f64::NAN)
    }
}

#[derive(Clone, Copy)]
struct VisibleTile {
    tile: usize,
    distance: f64,
}

#[derive(Default)]
struct CrowdScratch {
    visible: Vec<VisibleTile>,
    output: Vec<u32>,
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
    // Subtraction's NaN fallback is not transitive when malformed tiles mix
    // finite and NaN distances. Rust's sort can panic on that comparator, and
    // panic=abort would trap WASM. Keep normal distances/ties identical, then
    // place malformed NaN distances last in index order to form a total order.
    match (left.is_nan(), right.is_nan()) {
        (true, true) => Ordering::Equal,
        (true, false) => Ordering::Greater,
        (false, true) => Ordering::Less,
        (false, false) => left.partial_cmp(&right).unwrap_or(Ordering::Equal),
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
    let mut scratch = CrowdScratch::default();
    select_crowd_into(
        positions,
        tiles,
        tile_offsets,
        tile_indices,
        frustum_planes,
        camera,
        projected_scale,
        perspective,
        max_tiles,
        max_instances,
        detailed_pixels,
        mesh_pixels,
        &mut scratch,
    );
    scratch.output
}

#[allow(clippy::too_many_arguments)]
fn select_crowd_into(
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
    scratch: &mut CrowdScratch,
) {
    scratch.visible.clear();
    scratch.output.clear();
    if !bounded_layout_lengths(
        positions.len(),
        tiles.len(),
        tile_offsets.len(),
        tile_indices.len(),
    ) {
        return;
    }
    let tile_count = tiles.len() / 4;
    let position_count = positions.len() / 3;
    let max_tiles = tile_count.min(max_tiles as usize);
    let max_instances = max_instances as usize;
    if tile_count == 0 || max_tiles == 0 || max_instances == 0 {
        return;
    }

    let camera_x = camera_component(camera, 0);
    let camera_y = camera_component(camera, 1);
    let camera_z = camera_component(camera, 2);
    let visible = &mut scratch.visible;
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
    // Stable deterministic ordering also covers malformed direct ABI callers.
    let order = |left: &VisibleTile, right: &VisibleTile| {
        js_distance_order(left.distance, right.distance).then_with(|| left.tile.cmp(&right.tile))
    };
    // Large layouts only need the nearest budgeted prefix. The total order
    // includes the tile index, so partitioning retains exact deterministic ties.
    if visible.len() > 64 && max_tiles < visible.len() / 2 {
        visible.select_nth_unstable_by(max_tiles, order);
        visible.truncate(max_tiles);
    }
    visible.sort_unstable_by(order);

    if visible.is_empty() {
        visible.extend((0..max_tiles).map(|tile| VisibleTile {
            tile,
            distance: 0.0,
        }));
    }
    let selected_count = visible.len().min(max_tiles);
    let per_tile = (max_instances as u64).div_ceil(selected_count as u64) as usize;
    let projected_scale = finite(projected_scale);
    let detailed_pixels = finite(detailed_pixels);
    let mesh_pixels = finite(mesh_pixels);
    let output = &mut scratch.output;
    // Never reserve a u32-sized budget supplied through the JS ABI. The work
    // stays bounded by actual tile references, even for direct WASM callers.
    let capacity = max_instances.min(tile_indices.len());
    if output.capacity() < capacity {
        output.reserve(capacity);
    }

    let mut examined = 0;
    'tiles: for candidate in visible.iter().take(selected_count) {
        let tile = candidate.tile;
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
        let stride = (end - start).div_ceil(per_tile);
        for offset in (start..end).step_by(stride.max(1)) {
            // Corrupt overlapping offsets must not multiply the same reference
            // buffer into unbounded output or quadratic scanning. Valid layouts
            // partition this buffer, so their results are unchanged.
            if output.len() >= capacity || examined >= tile_indices.len() {
                break 'tiles;
            }
            examined += 1;
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
    if max_tiles == 0
        || max_instances == 0
        || !bounded_js_layout(&positions, &tiles, &tile_offsets, &tile_indices)
    {
        return Vec::new();
    }
    let planes = copy_planes(&frustum_planes);
    let camera = copy_prefix::<3>(&camera, f64::NAN);
    select_crowd_values(
        &positions.to_vec(),
        &tiles.to_vec(),
        &tile_offsets.to_vec(),
        &tile_indices.to_vec(),
        &planes,
        &camera,
        projected_scale,
        perspective,
        max_tiles,
        max_instances,
        detailed_pixels,
        mesh_pixels,
    )
}

/// A worker owns this layout for its entire lifetime. Camera updates copy only
/// 27 doubles, instead of copying every seat and tile into WASM on every tick.
#[wasm_bindgen]
pub struct CrowdSelector {
    positions: Vec<f64>,
    tiles: Vec<f64>,
    offsets: Vec<u32>,
    indices: Vec<u32>,
    scratch: CrowdScratch,
}

#[wasm_bindgen]
impl CrowdSelector {
    #[wasm_bindgen(constructor)]
    pub fn new(
        positions: Float64Array,
        tiles: Float64Array,
        offsets: Uint32Array,
        indices: Uint32Array,
    ) -> Self {
        if !bounded_js_layout(&positions, &tiles, &offsets, &indices) {
            return Self {
                positions: Vec::new(),
                tiles: Vec::new(),
                offsets: Vec::new(),
                indices: Vec::new(),
                scratch: CrowdScratch::default(),
            };
        }
        Self {
            positions: positions.to_vec(),
            tiles: tiles.to_vec(),
            offsets: offsets.to_vec(),
            indices: indices.to_vec(),
            scratch: CrowdScratch::default(),
        }
    }

    #[allow(clippy::too_many_arguments)]
    pub fn select(
        &mut self,
        planes: Float64Array,
        camera: Float64Array,
        scale: f64,
        perspective: bool,
        max_tiles: u32,
        max_instances: u32,
        detailed_pixels: f64,
        mesh_pixels: f64,
    ) -> Vec<u32> {
        self.prepare_selection(
            &planes,
            &camera,
            scale,
            perspective,
            max_tiles,
            max_instances,
            detailed_pixels,
            mesh_pixels,
        );
        // wasm-bindgen owns the returned vector; retained scratch must not be
        // exposed as a view that a later memory.grow or select invalidates.
        self.scratch.output.clone()
    }

    /// Copy into a JS-owned reusable output; no returned Vec or borrowed view.
    /// Output capacity bounds the instance budget before selection.
    #[allow(clippy::too_many_arguments)]
    pub fn select_into(
        &mut self,
        planes: Float64Array,
        camera: Float64Array,
        scale: f64,
        perspective: bool,
        max_tiles: u32,
        max_instances: u32,
        detailed_pixels: f64,
        mesh_pixels: f64,
        output: Uint32Array,
    ) -> u32 {
        self.prepare_selection(
            &planes,
            &camera,
            scale,
            perspective,
            max_tiles,
            max_instances.min(output.length()),
            detailed_pixels,
            mesh_pixels,
        );
        let length = self.scratch.output.len() as u32;
        output.subarray(0, length).copy_from(&self.scratch.output);
        length
    }
}

impl CrowdSelector {
    #[allow(clippy::too_many_arguments)]
    fn prepare_selection(
        &mut self,
        planes: &Float64Array,
        camera: &Float64Array,
        scale: f64,
        perspective: bool,
        max_tiles: u32,
        max_instances: u32,
        detailed_pixels: f64,
        mesh_pixels: f64,
    ) {
        let planes = copy_planes(planes);
        let camera = copy_prefix::<3>(camera, f64::NAN);
        select_crowd_into(
            &self.positions,
            &self.tiles,
            &self.offsets,
            &self.indices,
            &planes,
            &camera,
            scale,
            perspective,
            max_tiles,
            max_instances,
            detailed_pixels,
            mesh_pixels,
            &mut self.scratch,
        );
    }
}
