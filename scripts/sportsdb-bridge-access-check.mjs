import { readFileSync } from 'node:fs';
const config = Object.fromEntries([...readFileSync('.env.development.local','utf8').matchAll(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/gm)]
  .map(m=>[m[1],m[2].trim().replace(/^['"]|['"]$/g,'')]));
const base='https://lguqnwvsfeefxamzeyos.supabase.co/rest/v1';
for (const table of ['official_leagues','official_players','sportsdb_records','sportsdb_bridge_control']) {
  const response=await fetch(`${base}/${table}?select=*&limit=1`, {headers:{apikey:config.VITE_SUPABASE_PUBLISHABLE_KEY}});
  const data=await response.json();
  console.log(JSON.stringify({table,status:response.status,example:data}));
  const expected=table.startsWith('official_') ? 200 : 401;
  if(response.status!==expected && !(expected===401 && response.status===403)) process.exitCode=1;
}
