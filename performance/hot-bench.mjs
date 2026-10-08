import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { withCodSpeed } from "@codspeed/tinybench-plugin";
import { Bench } from "tinybench";

async function crowdFixture(folder, tileCount = 36) {
 const wasm = await import(`./${folder}/pkg/crowd_visibility_wasm.js`);
 const crowd = await import(`./${folder}/crowd-visibility.ts`);
 wasm.initSync({ module: readFileSync(new URL(`./${folder}/pkg/crowd_visibility_wasm_bg.wasm`, import.meta.url)) });
 const { createCrowdVisibilityLayout } = crowd;
const positions = Array.from({ length: tileCount * 240 }, (_, seat) => {
  const tile = Math.floor(seat / 240);
  const angle = ((tile % 12) * Math.PI) / 6 + (seat % 20) * 0.006;
  const radius = 64 + Math.floor(tile / 12) * 6 + Math.floor((seat % 240) / 20) * 0.3;
  return {
    x: Math.cos(angle) * radius,
    y: 4 + Math.floor(tile / 12) * 6,
    z: Math.sin(angle) * radius,
  };
});
const layout = createCrowdVisibilityLayout(
  positions,
  Array.from({ length: tileCount }, (_, tile) => ({
    indices: Array.from({ length: 240 }, (_, seat) => tile * 240 + seat),
    center: positions[tile * 240 + 115],
    radius: 8,
  })),
);
const planes = new Float64Array([
  1, 0, 0, 100, -1, 0, 0, 100, 0, 1, 0, 100, 0, -1, 0, 100, 0, 0, 1, 100, 0, 0, -1, 100,
]);
const camera = new Float64Array([60, 12, 10]);

 const selector = wasm.CrowdSelector ? new wasm.CrowdSelector(layout.positions,layout.tiles,layout.tileOffsets,layout.tileIndices) : null;
 const scratch = crowd.CrowdFallbackBuffers ? new crowd.CrowdFallbackBuffers(layout) : undefined;
 let decoded = null;
 const reusable = new Uint32Array(5120);
 return {
  select(kind,budget) {
   if(kind === "fallback") return crowd.selectCrowdFallback({layout,frustumPlanes:planes,camera:{x:camera[0],y:camera[1],z:camera[2]},projectedScale:640,perspective:true,maxTiles:18,maxInstances:budget,detailedPixels:42,meshPixels:28},scratch);
   let packed;
   if(kind === "production" && selector?.select_into) {
    const length=selector.select_into(planes,camera,640,true,18,budget,42,28,reusable);
    packed=reusable.subarray(0,length);
   } else packed = (kind === "production" || kind === "owned") && selector
    ? selector.select(planes,camera,640,true,18,budget,42,28)
    : wasm.select_crowd(layout.positions,layout.tiles,layout.tileOffsets,layout.tileIndices,planes,camera,640,true,18,budget,42,28);
   decoded = crowd.decodeCrowdSelection(packed,decoded);
   return decoded;
  },
  free() {selector?.free();}
 };
}
const base = await crowdFixture("wasm-base");
const local = await crowdFixture("wasm-snapshot");
const largePrevious = await crowdFixture("wasm-previous", 256);
const largeLocal = await crowdFixture("wasm-snapshot", 256);
assert.deepEqual(largeLocal.select("production",4096),largePrevious.select("production",4096));
const replayBase = await import("./replay-snapshot/replay-codec.ts");
const replayLocal = await import("./replay-local/replay-codec.ts");
const replayNullFast = await import("./replay-null-fast/replay-codec.ts");
const meta = Array.from({length:22}, (_,i)=>({id:`player-${i}`, side:i<11?"home":"away"}));
const frames = Array.from({length:1200},(_,f)=>({
 t:f/10, b:[f%100,0.25,0], p:Array.from({length:88},(_,i)=>(i+f)%64),
 a:Array.from({length:22},(_,i)=>i===f%22?"shot":null),
 timing:Array.from({length:44},()=>0.25), hg:1, ag:0, poss:"home",
 v:{version:2,actionContexts:Array.from({length:22},(_,i)=>i===f%22?{kind:"shot",power:0.75}:null),contactContexts:Array(22).fill(null)}
}));
const replay={meta,frames,rosterFrames:[]};

const packed = replayBase.encodeReplayV3(replay);
for(const budget of [768,4096,5120]) for(const kind of ["production","stateless","fallback"])
 assert.deepEqual(local.select(kind,budget),base.select(kind,budget));
assert.deepEqual(replayLocal.encodeReplayV3(replay),packed);
assert.deepEqual(replayLocal.decodeReplay(packed),replayBase.decodeReplay(packed));
const denseReplay={...replay,frames:replay.frames.map((frame)=>({...frame,v:{version:2,
 actionContexts:Array.from({length:22},(_,player)=>({kind:"shot",power:0.75,player})),
 contactContexts:Array.from({length:22},(_,player)=>({kind:"contact",strength:0.5,player}))
}}))};
const densePacked=replayBase.encodeReplayV3(denseReplay);
assert.deepEqual(replayLocal.encodeReplayV3(denseReplay),densePacked);
assert.deepEqual(replayLocal.decodeReplay(densePacked),replayBase.decodeReplay(densePacked));
if(process.argv.includes("verify")) {
 console.log("Hot benchmark parity and replay ownership fixture verified; no measurements");
} else {
 const bench=withCodSpeed(new Bench({time:200,warmupTime:50}));
 let checksum=0;
for(const [label, fixture] of [["previous",largePrevious],["local",largeLocal]]) bench.add(`${label} large crowd 4096`,()=>{const result=fixture.select("production",4096);checksum+=result.indices.length+result.indices[0];});
 for(const [label, fixture] of [["base",base],["local",local]]) {
  for(const budget of [768,4096,5120]) for(const kind of (label === "local" ? ["production","stateless","fallback","owned"] : ["production","stateless","fallback"]))
   bench.add(`${label} crowd ${kind} ${budget}`,()=>{const result=fixture.select(kind,budget);checksum+=result.indices.length+result.indices[0];});
 }
 for(const [label,codec] of [["base",replayBase],["local",replayLocal]]) {
  bench.add(`${label} replay encode`,()=>{checksum+=codec.encodeReplayV3(replay).motion.length;});
  bench.add(`${label} replay decode`,()=>{checksum+=codec.decodeReplay(packed).frames.length;});
  bench.add(`${label} replay dense encode`,()=>{checksum+=codec.encodeReplayV3(denseReplay).motion.length;});
  bench.add(`${label} replay dense decode`,()=>{checksum+=codec.decodeReplay(densePacked).frames.length;});
 }
 bench.add("previous replay decode",()=>{checksum+=replayNullFast.decodeReplay(packed).frames.length;});
 bench.add("previous replay dense decode",()=>{checksum+=replayNullFast.decodeReplay(densePacked).frames.length;});
 await bench.run();
 console.log(JSON.stringify({checksum}));
}
base.free();local.free();largePrevious.free();largeLocal.free();
