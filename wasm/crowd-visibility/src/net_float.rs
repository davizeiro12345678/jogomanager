use wasm_bindgen::prelude::*;

/// Presentation-only Float32 cloth. No match state, clock, seed or RNG input.
#[wasm_bindgen]
pub struct FloatNet {
    cols: usize,
    rows: usize,
    width: f32,
    height: f32,
    step: f64,
    accumulator: f64,
    displacement: Vec<f32>,
    velocity: Vec<f32>,
    next: Vec<f32>,
    breeze: Vec<f32>,
}

#[wasm_bindgen]
impl FloatNet {
    #[wasm_bindgen(constructor)]
    pub fn new(cols: u32, rows: u32, width: f32, height: f32) -> Result<FloatNet, JsValue> {
        if !(2..=64).contains(&cols) || !(2..=64).contains(&rows)
            || !width.is_finite() || !height.is_finite()
            || !(0.5..=20.0).contains(&width) || !(0.5..=20.0).contains(&height) {
            return Err(JsValue::NULL);
        }
        let size = ((cols + 1) * (rows + 1)) as usize;
        let stiffness = 10.0 * ((cols as f64 / width as f64).powi(2) + (rows as f64 / height as f64).powi(2));
        Ok(Self { cols: cols as usize, rows: rows as usize, width, height,
            step: (1.0 / 120.0f64).min(0.42 / stiffness.sqrt()), accumulator: 0.0,
            displacement: vec![0.0;size], velocity: vec![0.0;size], next: vec![0.0;size], breeze: vec![0.0;size] })
    }
    pub fn data_ptr(&self) -> *const f32 { self.displacement.as_ptr() }
    pub fn data_len(&self) -> usize { self.displacement.len() }
    pub fn restore(&mut self, displacement: &[f32], velocity: &[f32], accumulator: f64) -> bool {
        if displacement.len() != self.displacement.len() || velocity.len() != self.velocity.len()
            || !displacement.iter().chain(velocity).all(|x| x.is_finite())
            || !accumulator.is_finite() || accumulator < 0.0 || accumulator >= self.step { return false; }
        self.displacement.copy_from_slice(displacement);
        self.velocity.copy_from_slice(velocity);
        self.accumulator = accumulator;
        true
    }
    pub fn impact(&mut self, u: f32, v: f32, speed: f32) {
        if !u.is_finite() || !v.is_finite() || !speed.is_finite() || !(0.0..=1.0).contains(&u) || !(0.0..=1.0).contains(&v) { return; }
        let stride = self.cols + 1;
        let force = (speed.max(0.0) * 0.3).min(9.0);
        for y in 1..self.rows { for x in 1..self.cols {
            let dx = (x as f32 / self.cols as f32 - u) * self.width;
            let dy = (y as f32 / self.rows as f32 - v) * self.height;
            let i = y * stride + x;
            self.velocity[i] = (self.velocity[i] + force * (-(dx*dx + dy*dy) / 0.32).exp()).min(12.0);
        }}
    }
    pub fn step(&mut self, dt: f64, time: f32, wind: f32, wet: f32) {
        if !dt.is_finite() || dt <= 0.0 { return; }
        let time = if time.is_finite() {time} else {0.0};
        let wind = if wind.is_finite() {wind.clamp(0.0,1.0)} else {0.0};
        let wet = if wet.is_finite() {wet.clamp(0.0,1.0)} else {0.0};
        self.accumulator += dt.min(0.1);
        // High-refresh rendering can call us before a physical substep is due.
        // Avoid all coefficient/trigonometry work while retaining its time.
        if self.accumulator + 1e-9 < self.step { return; }
        let step = self.step as f32;
        let sx = 10.0 * (self.cols as f32 / self.width).powi(2) / (1.0 + wet * 0.2);
        let sy = 10.0 * (self.rows as f32 / self.height).powi(2) / (1.0 + wet * 0.2);
        let decay = (-(4.2 + wet*1.2) * step).exp();
        let stride = self.cols + 1;
        // Time and wind are constant for this call: evaluate sin once per cell,
        // not again in every fixed substep. Buffers are reused for the lifetime.
        if wind > 0.0 { for y in 1..self.rows { for x in 1..self.cols {
            self.breeze[y*stride+x] = (time*1.7+x as f32*0.3+y as f32*0.25).sin()*wind*0.45;
        }}}
        while self.accumulator + 1e-9 >= self.step {
            self.accumulator = (self.accumulator - self.step).max(0.0);
            for y in 1..self.rows { for x in 1..self.cols {
                let i = y*stride+x;
                let d = self.displacement[i];
                let lap = (self.displacement[i-1]+self.displacement[i+1]-2.0*d)*sx
                    + (self.displacement[i-stride]+self.displacement[i+stride]-2.0*d)*sy;
                let breeze = if wind > 0.0 {self.breeze[i]} else {0.0};
                let velocity = (self.velocity[i]+(lap-d*24.0+breeze)*step)*decay;
                self.velocity[i] = velocity;
                self.next[i] = (d+velocity*step).clamp(-0.18,0.85);
            }}
            // Keep the exposed pointer stable for zero-copy JavaScript views.
            self.displacement.copy_from_slice(&self.next);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn bounded_and_tied_after_hard_impacts() {
        let mut net = FloatNet::new(28,16,1.9,2.44).unwrap();
        for _ in 0..100 {
            net.impact(0.5,0.5,45.0);
            net.step(0.1,5.0,1.0,1.0);
        }
        assert!(net.displacement.iter().all(|d| d.is_finite() && *d >= -0.18 && *d <= 0.85));
        for y in 0..=16 { assert_eq!(net.displacement[y*29],0.0); assert_eq!(net.displacement[y*29+28],0.0); }
        for x in 0..29 { assert_eq!(net.displacement[x],0.0); assert_eq!(net.displacement[16*29+x],0.0); }
    }
    #[test]
    fn render_cadence_does_not_change_fixed_step_response() {
        let mut a = FloatNet::new(28,16,7.32,2.44).unwrap();
        let mut b = FloatNet::new(28,16,7.32,2.44).unwrap();
        a.impact(0.4,0.6,18.0); b.impact(0.4,0.6,18.0);
        for _ in 0..30 {a.step(1.0/30.0,0.0,0.0,0.5);}
        for _ in 0..120 {b.step(1.0/120.0,0.0,0.0,0.5);}
        assert_eq!(a.displacement,b.displacement);
    }
}
