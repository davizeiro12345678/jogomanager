import assert from "node:assert/strict";
import { encodeReplayV3, decodeReplay } from "./replay-snapshot/replay-codec.ts";
const mode = process.argv[2] ?? "verify";
const meta = Array.from({length:22}, (_,i)=>({id:`player-${i}`, side:i<11?"home":"away"}));
const frames = Array.from({length:1200},(_,f)=>({
 t:f/10, b:[f%100,0.25,0], p:Array.from({length:88},(_,i)=>(i+f)%64),
 a:Array.from({length:22},(_,i)=>i===f%22?"shot":null),
 timing:Array.from({length:44},()=>0.25), hg:1, ag:0, poss:"home",
 v:{version:1,actionContexts:Array.from({length:22},(_,i)=>i===f%22?{kind:"shot",power:0.75}:null),contactContexts:Array(22).fill(null)}
}));
const replay={meta,frames,rosterFrames:[]};
const packed=encodeReplayV3(replay);
if(mode==="verify") {
 assert.deepEqual(decodeReplay(packed).frames,frames);
 console.log("Replay workload roundtrip verified; no timing measurement");
} else {
 if(!["encode","decode"].includes(mode))throw new Error("Unknown replay workload");
 let checksum=0;
 for(let i=0;i<8;i++){
  const result=mode==="encode"?encodeReplayV3(replay):decodeReplay(packed);
  checksum+=mode==="encode"?result.motion.length:result.frames.length;
 }
 console.log(JSON.stringify({mode,checksum,frames:1200,players:22,calls:8}));
}
