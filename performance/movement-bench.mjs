import assert from "node:assert/strict";
import {withCodSpeed} from "@codspeed/tinybench-plugin";
import {Bench} from "tinybench";
import * as base from "./movement-base.mjs";
import * as local from "./movement-local.mjs";
import * as holder from "./movement-holder.mjs";

const scenarios=[{name:"live",dt:1/30,time:0},{name:"coarse",dt:1/15,time:0},{name:"late",dt:1/30,time:78*60}];
function chunk(module,scenario,seed="movement-codspeed") {
 const sim=new module.MatchSim(module.buildTeamSetup("fla"),module.buildTeamSetup("pal"),seed);
 sim.time=scenario.time;
 try {
  for(let tick=0;tick<600;tick++)sim.step(scenario.dt,6);
  return {players:sim.players,ball:sim.ball,stats:sim.stats,events:sim.events,time:sim.time,checkpoint:sim.checkpoint()};
 }finally{sim.dispose();}
}
for(const scenario of scenarios)for(const seed of ["movement-1","movement-2","movement-3"])
 assert.deepEqual(chunk(local,scenario,seed),chunk(base,scenario,seed));
if(process.argv.includes("verify"))console.log("Exact movement, checkpoint and PRNG parity verified; no measurements");
else {
 const bench=withCodSpeed(new Bench({time:200,warmupTime:50}));let checksum=0;
 for(const scenario of scenarios)for(const[label,module]of[["base",base],["holder",holder],["local",local]])
  bench.add(`${label} movement ${scenario.name} 600`,()=>{const result=chunk(module,scenario);checksum+=result.players[0].x+result.ball.x+result.time;});
 await bench.run();console.log(JSON.stringify({checksum}));
}
