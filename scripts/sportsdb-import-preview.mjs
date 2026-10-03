// Read-only verification page. Only the public Supabase key is used here.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const env = Object.fromEntries(
  [
    ...(await readFile(root + ".env.development.local", "utf8")).matchAll(
      /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/gm,
    ),
  ].map((m) => [m[1], m[2].trim().replace(/^['"]|['"]$/g, "")]),
);
const tables = [
  "official_leagues",
  "official_teams",
  "official_players",
  "official_seasons",
  "official_equipment",
  "official_venues",
  "official_events",
  "official_media",
];
const labels = [
  "Ligas",
  "Equipes",
  "Jogadores",
  "Temporadas",
  "Uniformes",
  "Estádios",
  "Partidas",
  "Imagens",
];
const base = "https://lguqnwvsfeefxamzeyos.supabase.co/rest/v1";
const headers = { apikey: env.VITE_SUPABASE_PUBLISHABLE_KEY };
const html = `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Catálogo TheSportsDB · Supabase</title><style>
*{box-sizing:border-box}body{margin:0;background:#10191b;color:#edf7f3;font:16px system-ui,sans-serif}main{max-width:1160px;margin:auto;padding:48px 32px}small{color:#9baba8;letter-spacing:.12em}h1{font-size:36px;line-height:1.15;margin:16px 0}p{line-height:1.6;color:#bccfc7}.tag{display:inline-block;background:#254539;color:#9aefb5;padding:8px 14px;border-radius:8px}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin:30px 0}.card{background:#1a2728;padding:22px;border:1px solid #31423f;border-radius:12px}.num{font-size:32px;font-weight:650;display:block;margin-bottom:5px}select,button{background:#223533;color:#e7f4ee;border:1px solid #517063;padding:10px;border-radius:8px;font:inherit}table{width:100%;border-collapse:collapse;background:#1a2728;margin-top:18px}td,th{text-align:left;padding:13px 18px;border-bottom:1px solid #31423f}th{color:#9bb6ac;font-weight:500}.meta{font-size:13px;color:#97aaa2;margin:14px 0}.note{border-left:3px solid #74c991;padding:12px 20px;background:#162523;margin-top:26px}@media(max-width:750px){.grid{grid-template-columns:repeat(2,1fr)}main{padding:24px 16px}h1{font-size:28px}}
</style><main><small>JOGO MANAGER / CATÁLOGO OFICIAL</small><h1>Futebol do TheSportsDB<br>no seu Supabase</h1><span class="tag">Dados gravados no Supabase</span>
<p>Dados recebidos pela integração premium do Cloudflare e gravados no projeto <b>lguqnwvsfeefxamzeyos</b>.<br>As contagens abaixo são consultadas diretamente no Supabase.</p>
<div class="grid" id="counts"></div><div class="meta" id="time">Carregando contagens...</div>
<label for="entity">Explorar dados importados</label> <select id="entity"><option value="official_leagues">Ligas</option><option value="official_teams">Equipes</option><option value="official_players">Jogadores</option><option value="official_events">Partidas</option></select> <button id="refresh">Atualizar</button>
<table><thead><tr><th>ID TheSportsDB</th><th>Registro</th><th>Informação</th></tr></thead><tbody id="rows"></tbody></table>
<p class="note">As contagens mostram os registros que já estão no Supabase. A cobertura completa é conferida pelo relatório da importação; a origem ainda pode estar processando outras etapas. Clubes, campeonatos e saves personalizados foram preservados.</p>
<p class="meta">Verificação somente de leitura · JSON original privado · imagens mantidas como URLs do provedor · <a href="https://www.thesportsdb.com/" style="color:#9aefb5">TheSportsDB</a></p></main>
<script>
async function loadCounts(){const r=await fetch('/api/counts');if(!r.ok)throw Error('Falha ao consultar contagens');const data=await r.json();document.getElementById('counts').replaceChildren(...data.map(x=>{const e=document.createElement('div');e.className='card';const n=document.createElement('span');n.className='num';n.textContent=x.count.toLocaleString('pt-BR');e.append(n,document.createTextNode(x.label));return e}));document.getElementById('time').textContent='Consultado no Supabase em '+new Date().toLocaleString('pt-BR');}
async function loadRows(){const type=document.getElementById('entity').value;const r=await fetch('/api/rows?table='+type);if(!r.ok)throw Error('Falha ao consultar registros');const data=await r.json();document.getElementById('rows').replaceChildren(...data.map(x=>{const tr=document.createElement('tr');const values=[x.source_id,x.name||[x.home_team_name,x.away_team_name].filter(Boolean).join(' × '),x.country||x.position||x.season||x.league_source_id||''];for(const v of values){const td=document.createElement('td');td.textContent=v;tr.append(td)}return tr}));}
async function update(){try{await Promise.all([loadCounts(),loadRows()]);}catch(e){document.getElementById('time').textContent=e.message;}}
document.getElementById('entity').onchange=loadRows;document.getElementById('refresh').onclick=update;update();
</script></html>`;
createServer(async (request, response) => {
  try {
    const url = new URL(request.url, "http://127.0.0.1:4339");
    if (url.pathname === "/api/counts") {
      const values = await Promise.all(
        tables.map(async (table, i) => {
          const r = await fetch(`${base}/${table}?select=*&limit=1`, {
            method: "HEAD",
            headers: { ...headers, Prefer: "count=exact" },
          });
          if (!r.ok) throw Error(`Count ${table}: ${r.status}`);
          const count = Number(r.headers.get("content-range")?.split("/")[1]);
          if (!Number.isFinite(count)) throw Error("Missing exact count");
          return { table, label: labels[i], count };
        }),
      );
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify(values));
    } else if (url.pathname === "/api/rows" && tables.includes(url.searchParams.get("table"))) {
      const r = await fetch(
        `${base}/${url.searchParams.get("table")}?select=*&order=source_id&limit=8`,
        { headers },
      );
      response.writeHead(r.status, { "Content-Type": "application/json" });
      response.end(await r.text());
    } else if (url.pathname === "/") {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end(html);
    } else {
      response.writeHead(404);
      response.end();
    }
  } catch (error) {
    response.writeHead(503, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: String(error) }));
  }
}).listen(4339, "127.0.0.1", () =>
  console.log("Read-only import verification: http://127.0.0.1:4339"),
);
