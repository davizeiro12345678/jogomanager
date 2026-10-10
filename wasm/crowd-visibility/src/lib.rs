mod crowd;
mod match_perception;
mod turf_detail;
mod rig_section;

pub use crowd::{select_crowd, CrowdSelector};

use wasm_bindgen::prelude::*;

/// Major version of the flat-buffer contract. Additive exports do not change it.
#[wasm_bindgen]
pub fn wasm_abi_version() -> u32 {
    1
}

/// Crowd=1, pass lanes=2, turf=4, persistent crowd=8, bounded crowd inputs=16,
/// reusable crowd output=32, bounded/reusable pass perception=64.
/// These capabilities do not confer authority over saves, scores or progression.
#[wasm_bindgen]
pub fn wasm_capabilities() -> u32 {
    1 | 2 | 4 | 8 | 16 | 32 | 64 | 128
}

#[wasm_bindgen]
pub fn crowd_max_seats() -> u32 {
    crowd::MAX_SEATS as u32
}

#[wasm_bindgen]
pub fn crowd_max_tiles() -> u32 {
    crowd::MAX_TILES as u32
}

#[wasm_bindgen]
pub fn crowd_max_references() -> u32 {
    crowd::MAX_REFERENCES as u32
}
