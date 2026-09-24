import { quickSimulate } from "./game/career";
import { LEAGUES } from "./game/data/leagues";
const clubs = LEAGUES.slice(0,20).flatMap(l=>l.clubs.map(c=>c.id));
let g=0,d=0,hw=0,big=0,n=20000,zz=0;
for(let i=0;i<n;i++){const L=LEAGUES[i%20]!.clubs;const h=L[i%L.length]!.id,a=L[(i*7+3)%L.length]!.id;if(h===a)continue;const r=quickSimulate(h,a,"s"+i);g+=r.hg+r.ag;if(r.hg===r.ag)d++;if(r.hg>r.ag)hw++;if(Math.abs(r.hg-r.ag)>=4)big++;if(r.hg+r.ag===0)zz++;}
console.log({gpg:(g/n).toFixed(2),draw:(d/n).toFixed(3),home:(hw/n).toFixed(3),goleada:(big/n).toFixed(3),zeroZero:(zz/n).toFixed(3)});
