import {createServer} from 'vite';
import {readdir,readFile,writeFile} from 'node:fs/promises';
import { BASE_SOURCES } from './catalog-sources.mjs';
import { FRENCH_N2_SOURCE,FRENCH_N2_GROUPS } from './catalog-official-overrides.mjs';
const server=await createServer({configFile:false,appType:'custom',optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true}});
const {LEGACY_LEAGUES}=await server.ssrLoadModule('/src/game/data/leagues.ts');
const {SERIE_D_IDS,SERIE_D_GROUPS,SERIE_D_SOURCE}=await server.ssrLoadModule('/src/game/data/serie-d.ts');
await server.close();
const dir='verification/catalog-2026-10-02/sources';
const sources={};
for(const f of await readdir(dir)) if(/^\d+\.json$/.test(f)) { const x=JSON.parse(await readFile(`${dir}/${f}`,'utf8')); if(x.sport==='Soccer'&&x.teams.length) sources[x.id]=x; }
const normalize=s=>s.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const fullName=t=>t.slug ? t.slug.split('-').map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(' ').replace(/\b(Afc|Fc|Sc|Ac|Vfl|Vfb|Ssv|Tsv|Psv)\b/g,x=>x.toUpperCase()) : t.name;
const records={}; const aliases={}; const claims=new Map(); const pending=[];
const qualified=s=>s.match(/_([0-9]+)$/)?.[1];
const nameAliases={athleticbilbao:'athleticclub',atleticomadrid:'atleticodemadrid',
  intermilan:'inter',
  legiawarsaw:'legiawarszawa',slaviaprague:'slaviapraha',spartaprague:'spartapraha',
  wolves:'wolverhamptonwanderers',tottenham:'tottenhamhotspur',manutd:'manchesterunited',
  estudianteslaplata:'estudiantes',gimnasiayesgrimalaplata:'gimnasialaplata'};
const comparable=s=>{const n=normalize(s);return nameAliases[n]??n;};
function pick(league,t,parallel=false){
  const key=`${league.country}:${t.id}`;
  const pool=LEGACY_LEAGUES.filter(l=>l.country===league.country).flatMap(l=>l.clubs);
  // Truncated labels such as "Atlético Madrid" also match the B/C/women teams.
  // Match the full source slug; never assign a reserve team's ID to its parent.
  const sameName=c=>comparable(c.name)===comparable(t.slug?fullName(t):t.name);
  let old=league.clubs.find(c=>qualified(c.id)===t.id) ?? league.clubs.find(sameName);
  if(!old&&!parallel) old=pool.find(c=>qualified(c.id)===t.id&&!/^x(?:56|57)/.test(c.league)) ?? pool.find(sameName);
  const id=(parallel?undefined:claims.get(key)) ?? old?.id ?? `${league.id}_${t.id}`;
  if(!parallel) claims.set(key,id);
  return [id,old?.name??fullName(t),t.id];
}
const primaryBySource=Object.fromEntries(Object.entries(BASE_SOURCES).map(([id,source])=>[source,id]));
for(const league of LEGACY_LEAGUES){
  if(league.id==='y5279b'){aliases[league.id]='y5279a';continue;}
  if(league.id==='x5743'){aliases[league.id]='ven';continue;} // National teams are not clubs.
  if(league.id.startsWith('y5079')||league.id==='y4616a') continue;
  const sourceId=BASE_SOURCES[league.id]??league.id.match(/^[xy](\d+)/)?.[1];
  if(!sourceId){pending.push(league.id);continue;}
  if(/^[xy]/.test(league.id)&&primaryBySource[sourceId]){aliases[league.id]=primaryBySource[sourceId];continue;}
  const source=sources[sourceId];
  if(!source){pending.push(league.id);continue;}
  // Obsolete leagues are available to legacy saves; do not pretend their historic field is current.
  if(sourceId==='4525'||sourceId==='4673'||sourceId==='4750'){aliases[league.id]=sourceId==='4525'?'eng':sourceId==='4673'?'x5086':'y5088';continue;}
  const regional=sourceId>='5676'&&sourceId<='5775'&&league.country==='Brasil';
  records[league.id]={source:source.url,season:source.season,clubs:source.teams.map(t=>pick(league,t,regional||source.gender==='Female'))};
  if(sourceId==='5279') records[league.id].name='MLS Next Pro';
  if(sourceId==='5320') records[league.id].name='National 1 · Grupo A';
  if(sourceId==='5321') records[league.id].name='National 1 · Grupo B';
  if(sourceId==='5322') records[league.id].name='National 1 · Grupo C';
}
if(sources['4683']) {
  const league={id:'x4683',country:'Dinamarca',clubs:[]};
  records.x4683={source:sources['4683'].url,season:sources['4683'].season,clubs:sources['4683'].teams.map(t=>pick(league,t))};
}
const frenchKey=s=>normalize(s.replace(/\bII\b/g,'2').replace(/\bFC\b/gi,''))
  .replace(/brestois29/g,'brest').replace(/staderennais/g,'rennes').replace(/stad elavallois/g,'laval').replace(/lavallois/g,'laval').replace(/olympiquelyonnais/g,'lyon');
for(let i=0;i<FRENCH_N2_GROUPS.length;i++){
  const id=`y${5777+i}`, league=LEGACY_LEAGUES.find(l=>l.id===id);
  const source=sources[String(5777+i)];
  const pool=LEGACY_LEAGUES.filter(l=>l.country==='França').flatMap(l=>l.clubs);
  records[id]={source:FRENCH_N2_SOURCE,season:'2026-2027',name:`National 2 · Grupo ${String.fromCharCode(65+i)}`,clubs:FRENCH_N2_GROUPS[i].map(name=>{
    const key=frenchKey(name), t=source?.teams.find(t=>frenchKey(fullName(t))===key||frenchKey(t.name)===key);
    if(t) return pick(league,t);
    const old=pool.find(c=>frenchKey(c.name)===key);
    return [old?.id??`${id}_${normalize(name)}`,old?.name??name];
  })};
}
// AFA's two zones contain 18 different clubs each in 2026.
const argGroups=[
  ['Racing de Córdoba','Estudiantes de Buenos Aires','All Boys','Mitre','Los Andes','Almirante Brown','Godoy Cruz','Ciudad de Bolívar','Deportivo Morón','Defensores de Belgrano','Colón','Deportivo Madryn','San Miguel','Central Norte','San Telmo','Ferro Carril Oeste','Acassuso','Chaco For Ever'],
  ['Gimnasia y Esgrima de Jujuy','Midland','Atlanta','Quilmes','Gimnasia y Tiro','Colegiales','San Martín de Tucumán','Patronato','Atlético de Rafaela','Almagro','Agropecuario','Deportivo Maipú','Tristán Suárez','Temperley','Güemes','Nueva Chicago','Chacarita Juniors','San Martín de San Juan'],
];
for(let i=0;i<2;i++){
  const id=i?'arg2':'y4616a'; const original=LEGACY_LEAGUES.find(l=>l.id===id);
  const source=sources['4616'];
  records[id]={source:'https://www.afa.com.ar/agenda/posts/primera-nacional-fixture-para-la-temporada-2026',season:'2026',name:`Primera Nacional · Zona ${i?'B':'A'}`,
    clubs:argGroups[i].map(name=>{
      const t=source?.teams.find(t=>normalize(fullName(t))===normalize(name));
      if(t) return pick(original,t);
      const old=LEGACY_LEAGUES.filter(l=>l.country==='Argentina').flatMap(l=>l.clubs).find(c=>normalize(c.name)===normalize(name));
      return [old?.id??`${id}_${normalize(name)}`,old?.name??name];
    })};
}
const stateLeagues={AC:'x5676',AP:'x5678',DF:'x5685',BA:'x5684',ES:'x5686',MT:'x5762',PB:'x5765',PA:'x5764',PR:'x5766',PI:'x5769',SE:'x5773',RR:'x5772',MS:'x5774',TO:'x5775'};
const dAliases={'América':'América de Natal','XV de Piracicaba':'XV de Novembro','São Joseense':'Independiente São Joseense','Atlético-CE':'Atlético Cearense','Democrata GV':'Democrata Governador Valadares','GAS':'Grêmio Atlético Sampaio'};
const dSource=sources['5079']; const dClaimed=new Set();
for(let i=0;i<SERIE_D_IDS.length;i++){
  const id=SERIE_D_IDS[i];
  const oldD=LEGACY_LEAGUES.filter(l=>l.id.startsWith('y5079')).flatMap(l=>l.clubs);
  records[id]={source:SERIE_D_SOURCE,season:'2026',name:`Brasileirão Série D · Grupo A${i+1}`,clubs:SERIE_D_GROUPS[i].map(full=>{
    const state=full.slice(-2),raw=full.slice(0,-3),name=dAliases[full]??dAliases[raw]??raw;
    const exact=c=>[name,raw,full].some(n=>normalize(c.name)===normalize(n));
    const statePool=LEGACY_LEAGUES.find(l=>l.id===stateLeagues[state])?.clubs??[];
    const homonymous=['America','Atlético','Portuguesa','Operário','Primavera','Rio Branco','Vitória','São Raimundo','Nacional','União','Capital','Sampaio Corrêa'].includes(raw);
    const sourceTeam=dSource?.teams.find(t=>[fullName(t),t.name].some(n=>(homonymous?[full]:[name,raw,full]).some(a=>normalize(n)===normalize(a))));
    // Homonymous clubs are matched within their state; never merge Vitória-ES with Vitória-BA.
    let old=statePool.find(exact)??oldD.find(c=>exact(c)&&!dClaimed.has(c.id));
    if(['America','Atlético','Portuguesa','Operário','Primavera','Rio Branco','Vitória','São Raimundo','Nacional','União','Capital','Sampaio Corrêa'].includes(raw)&&!statePool.find(exact)) old=undefined;
    if(!old && !['America','Atlético','Portuguesa','Operário','Primavera','Rio Branco','Vitória','São Raimundo','Nacional','União','Capital','Sampaio Corrêa'].includes(raw)) old=LEGACY_LEAGUES.filter(l=>l.country==='Brasil'&&!l.id.startsWith('x')).flatMap(l=>l.clubs).find(exact);
    let cid=old?.id??`${id}_${normalize(full)}`;
    if(dClaimed.has(cid)) cid=`${id}_${normalize(full)}`;
    dClaimed.add(cid);
    return [cid,full,...(sourceTeam?[sourceTeam.id]:[])];
  })};
}
// Avoid shipping names twice: existing identities retain the legacy domain fields.
const legacyIds=new Set(LEGACY_LEAGUES.flatMap(l=>l.clubs.map(c=>c.id)));
for(const record of Object.values(records)) {
  const publicLeagueId=record.source.match(/^https:\/\/www\.thesportsdb\.com\/league\/(\d+)/)?.[1];
  if(publicLeagueId)record.source=`sdb:${publicLeagueId}`;
  for(const row of record.clubs){
    if(legacyIds.has(row[0]))row[1]=null;
    if(row[2]===qualified(row[0]))row.pop();
    if(row.length===2&&row[1]===null)row.pop();
  }
  if(record.clubs.some(row=>row.some(value=>value!=null&&/[;|]/.test(value))))
    throw new Error('Reserved membership delimiter in club data');
  record.clubs=record.clubs.map(row=>row.map(value=>value??'').join('|')).join(';');
}
const seasons=[...new Set(Object.values(records).map(record=>record.season))];
let memberships=JSON.stringify(Object.fromEntries(Object.entries(records).map(([id,r])=>[
  id,[r.source,r.season,r.clubs,...(r.name?[r.name]:[])],
])));
for(let i=0;i<seasons.length;i++) memberships=memberships.replaceAll(`,${JSON.stringify(seasons[i])},`,`,S${i},`);
const source='// Generated by scripts/catalog-source-generate.mjs. Public, seasonal membership only.\n'
  +'// Clubs use id|optional name|optional source ID rows separated by semicolons.\n'
  +'export type Membership = [source:string, season:string, clubs:string, name?:string];\n'
  +seasons.map((season,i)=>`const S${i}=${JSON.stringify(season)};\n`).join('')
  +`export const LEAGUE_MEMBERSHIPS:Record<string,Membership> = ${memberships};\n`
  +`export const CATALOG_ALIASES:Record<string,string> = ${JSON.stringify(aliases)};\n`;
await writeFile('src/game/data/league-memberships.generated.ts',source);
await writeFile('verification/catalog-2026-10-02/membership-generation.json',JSON.stringify({sourced:Object.keys(records).length,aliases,pending},null,2));
console.log(JSON.stringify({sourced:Object.keys(records).length,aliases,pending},null,2));
