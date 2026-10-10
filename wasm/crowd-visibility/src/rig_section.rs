use wasm_bindgen::prelude::*;

fn valid(rings: &[f64], radial: u32, roundness: f64, caps: u32) -> bool {
    if rings.len() < 8 || rings.len() % 4 != 0 || rings.len() > 256 * 4 || !(3..=128).contains(&radial) ||
       !roundness.is_finite() || !(0.25..=4.0).contains(&roundness) || caps > 3 { return false; }
    for value in rings {
        if !value.is_finite() || value.abs() > 100.0 { return false; }
    }
    true
}
fn write(output: &mut Vec<f32>, x:f64, y:f64, z:f64, u:f64, v:f64) {
    output.extend_from_slice(&[x as f32,y as f32,z as f32,u as f32,v as f32]);
}
/// Bounded presentation-only ABI: x,y,z,u,v, independent owned output.
#[wasm_bindgen]
pub fn generate_rig_section(rings: &[f64], radial: u32, roundness: f64, caps: u32) -> Vec<f32> {
    if !valid(rings,radial,roundness,caps) { return Vec::new(); }
    let rows = rings.len()/4;
    let cap_count = (caps & 1 != 0) as usize + (caps & 2 != 0) as usize;
    let mut output = Vec::with_capacity((rows*(radial as usize+1)+cap_count*(radial as usize+2))*5);
    let bottom=rings[0]; let span=(rings[(rows-1)*4]-bottom).max(0.001);
    for row in 0..rows {
        let offset=row*4;
        for side in 0..=radial {
            let u=side as f64/radial as f64; let angle=u*std::f64::consts::TAU;
            let s=angle.sin(); let c=angle.cos();
            let signed_s = if s == 0.0 { s } else { s.signum()*s.abs().powf(roundness) };
            let signed_c = if c == 0.0 { c } else { c.signum()*c.abs().powf(roundness) };
            write(&mut output,signed_s*rings[offset+1],rings[offset],signed_c*rings[offset+2]+rings[offset+3],u,(rings[offset]-bottom)/span);
        }
    }
    for (row,mask) in [(0,1),(rows-1,2)] {
        if caps & mask == 0 { continue; }
        let offset=row*4; let v=if mask==1 {0.0} else {1.0};
        write(&mut output,0.0,rings[offset],rings[offset+3],0.5,v);
        for side in 0..=radial {
            let source=(row*(radial as usize+1)+side as usize)*5;
            let (x,y,z)=(output[source] as f64,output[source+1] as f64,output[source+2] as f64);
            write(&mut output,x,y,z,side as f64/radial as f64,v);
        }
    }
    output
}
#[cfg(test)] mod tests {
    use super::*;
    #[test] fn sizes_caps_and_bounds() {
        let rings=[0.0,0.2,0.1,0.0,1.0,0.3,0.2,0.01];
        for caps in 0..=3 {
            let output=generate_rig_section(&rings,12,1.0,caps);
            let count=26+14*((caps&1 != 0) as usize+(caps&2 != 0) as usize);
            assert_eq!(output.len(),count*5);
            assert!(output.iter().all(|v|v.is_finite()));
        }
        assert!(generate_rig_section(&rings,129,1.0,3).is_empty());
        assert!(generate_rig_section(&rings,12,f64::NAN,3).is_empty());
        assert!(generate_rig_section(&rings,12,1.0,4).is_empty());
        assert!(generate_rig_section(&vec![0.0;1028],12,1.0,3).is_empty());
    }
}
