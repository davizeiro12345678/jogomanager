import { SOURCE_URL, manifest, pageRecords, archiveRecords, sourceComplete, isFootballArchive } from './records.mjs';

const base = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
async function rpc(name: string, args: Record<string, unknown> = {}) {
  const response = await fetch(`${base}/rest/v1/rpc/${name}`, {
    method: 'POST', headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json' }, body: JSON.stringify(args), signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Database ${name}: ${(await response.text()).slice(0, 300)}`);
  const body = await response.text();
  return body ? JSON.parse(body) : null;
}
async function source(params: Record<string, string>) {
  const url = new URL(SOURCE_URL);
  url.search = new URLSearchParams(params).toString();
  const response = await fetch(url, { headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(12_000) });
  if (!response.ok) throw new Error(`Source HTTP ${response.status}`);
  return response.json();
}

Deno.serve(async request => {
  if (request.method !== 'POST') return Response.json({ error: 'POST required' }, { status: 405 });
  const token = request.headers.get('authorization')?.replace(/^Bearer /, '') ?? '';
  // The gateway accepts this endpoint only after our own scheduler-token check.
  if (!token || !await rpc('sportsdb_bridge_authorize', { p_token: token })) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const owner = await rpc('sportsdb_bridge_acquire');
  if (!owner) return Response.json({ status: 'busy_or_paused' }, { status: 202 });
  const deadline = Date.now() + 45_000;
  let pages = 0, archives = 0, pagesSinceArchive = 0;
  try {
    const status = await source({ status: '1', cb: String(Date.now()) });
    await rpc('sportsdb_bridge_manifest', { p_owner: owner, p_manifest: manifest(status),
      p_source_status: status, p_source_complete: sourceComplete(status) });
    while (Date.now() < deadline - 15_000) {
      const work = await rpc('sportsdb_bridge_work', { p_owner: owner });
      if (work.paused) break;
      // Import index pages first; hydrate archives throughout to provide complete league metadata.
      if (work.page && (pagesSinceArchive < 8 || !work.archives.length)) {
        const task = work.page;
        const inventory = task.entity_type === 'archive_catalog';
        if (task.next_offset >= (inventory ? 1_000_000 : 100_000)) throw new Error('Source pagination capacity reached');
        const data = await source(inventory
          ? {archives:'1',limit:'100',offset:String(task.next_offset)}
          : {entity:task.entity_type,limit:'100',offset:String(task.next_offset)});
        if (!data.rows?.length && task.next_offset < data.total) throw new Error('Source returned a premature empty page');
        if (inventory) {
          await rpc('sportsdb_bridge_archive_catalog', {p_owner:owner,p_offset:task.next_offset,
            p_consumed:data.rows.length,p_total:data.total,
            p_archives:data.rows.filter((row: {archive_key: string})=>isFootballArchive(row.archive_key))});
        } else {
          await rpc('sportsdb_bridge_page', { p_owner: owner, p_entity: task.entity_type,
            p_offset: task.next_offset, p_consumed: data.rows.length, p_total: data.total,
            p_rows: pageRecords(task.entity_type, data) });
        }
        pages++; pagesSinceArchive++;
      } else if (work.archives.length) {
        // Four bounded I/O operations; database leases prevent overlapping invocations.
        await Promise.all(work.archives.map(async (task: { archive_key: string; source_updated_at: string }) => {
          try {
            const data = await source({ archiveKey: task.archive_key });
            const rows = await archiveRecords(task.archive_key, data, task.source_updated_at);
            await rpc('sportsdb_bridge_archive', { p_owner: owner, p_key: task.archive_key,
              p_updated_at: task.source_updated_at, p_payload: data, p_rows: rows });
            archives++;
          } catch (error) {
            await rpc('sportsdb_bridge_archive_error', { p_owner: owner, p_key: task.archive_key,
              p_error: String(error).slice(0, 300) });
          }
        }));
        pagesSinceArchive = 0;
      } else break;
    }
    await rpc('sportsdb_bridge_release', { p_owner: owner, p_error: null });
    return Response.json({ status: 'ok', pages, archives, source_complete: sourceComplete(status) });
  } catch (error) {
    const message = String(error).slice(0, 300);
    await rpc('sportsdb_bridge_release', { p_owner: owner, p_error: message });
    return Response.json({ error: message, pages, archives }, { status: 503 });
  }
});
