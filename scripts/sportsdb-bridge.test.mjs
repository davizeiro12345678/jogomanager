import test from 'node:test';
import assert from 'node:assert/strict';
import { archiveContext, archiveRecords, manifest, pageRecords, sourceComplete, PHASES, isFootballArchive } from '../supabase/functions/sportsdb-bridge/records.mjs';

test('a partial upstream import never certifies the complete football database', () => {
  assert.equal(sourceComplete({ phases: [{phase:'catalog',complete:true}] }), false);
  assert.equal(sourceComplete({ phases: PHASES.map(phase => ({phase,complete:true})) }), true);
});
test('only football entities are selected, with source freshness in their fingerprint', () => {
  const counts = ['league','snapshot_team','sport','livescore_all','table_row'].map(entity_type => ({entity_type,records:3,updated_at:'2026-10-02'}));
  assert.deepEqual(manifest({source:'TheSportsDB',counts,archive:{objects:9}}).map(r=>r.entity_type), ['league','table_row','archive_catalog']);
  assert.throws(()=>manifest({source:'unexpected',counts}));
});
test('the complete archive inventory avoids the source index pagination ceiling', () => {
  assert.equal(isFootballArchive('sportsdb/v2/all/sports/all/_/_.json'),false);
  assert.equal(isFootballArchive('sportsdb/v2/livescore/all/all/_/_.json'),false);
  assert.equal(isFootballArchive('sportsdb/v2/lookup/event/1/_/_.json'),true);
  assert.equal(isFootballArchive('sportsdb/v2/lookup/player_contracts/1/_/_.json'),true);
  assert.equal(isFootballArchive('sportsdb/v2/lookuptable/4328/4328/2026-2027.json'),true);
});
test('source context separates the same player in different team indexes', () => {
  const base = {sourceId:'1',season:'',updatedAt:'2026-10-02T00:00:00Z',data:{strPlayer:'Player'}};
  const rows = pageRecords('player_index',{entityType:'player_index',total:2,rows:[{...base,parentId:'A'},{...base,parentId:'B'}]});
  assert.notEqual(rows[0].parent_id,rows[1].parent_id);
  assert.throws(()=>pageRecords('player',{entityType:'team',total:1,rows:[]}));
});
test('archive traversal is rejected and league lists exclude other sports', async () => {
  assert.throws(()=>archiveContext('sportsdb/v2/lookup/../a/b/c.json'));
  const rows = await archiveRecords('sportsdb/v2/all/leagues/all/_/_.json',{
    all:[{idLeague:'1',strSport:'Soccer'},{idLeague:'2',strSport:'Basketball'}]
  },'2026-10-02T00:00:00Z');
  assert.deepEqual(rows.map(r=>r.source_id),['1']);
});
test('full squad archives retain all fields and use the actual team ID', async () => {
  const payload = {list:[{idPlayer:'1',idTeam:'9',strPlayer:'A',strNationality:'Brazil',strWeight:'70 kg'}]};
  const [row] = await archiveRecords('sportsdb/v2/list/players/8/8/_.json',payload,'2026-10-02T00:00:00Z');
  assert.equal(row.parent_id,'9'); assert.equal(row.payload.strWeight,'70 kg');
});
test('ID-less detail rows get deterministic content identities without being discarded', async () => {
  const key='sportsdb/v2/lookup/player_stats/7/_/_.json';
  const payload={lookup:[{strStatistic:'Goals',intValue:'5'},{strStatistic:'Goals',intValue:'7'}]};
  const a=await archiveRecords(key,payload,'2026-10-02T00:00:00Z');
  const b=await archiveRecords(key,payload,'2026-10-02T00:00:00Z');
  assert.equal(a[0].source_id,b[0].source_id); assert.notEqual(a[0].source_id,a[1].source_id);
  assert.equal(a[0].parent_id,'7'); assert.match(a[0].source_id,/^sha256:/);
});
test('table and round endpoints match the upstream archive format', async () => {
  const [table] = await archiveRecords('sportsdb/v2/lookuptable/4328/4328/2025-2026.json', {table:[{idTeam:'9',intRank:'1'}]},'2026-10-02T00:00:00Z');
  assert.equal(table.entity_type,'table_row'); assert.equal(table.season,'2025-2026');
  const [event] = await archiveRecords('sportsdb/v2/eventsround/1/4328/2025-2026.json',{events:[{idEvent:'3'}]},'2026-10-02T00:00:00Z');
  assert.equal(event.entity_type,'event_index'); assert.equal(event.parent_id,'4328');
});
test('provider errors are retried rather than certified as empty complete archives', async () => {
  await assert.rejects(()=>archiveRecords('sportsdb/v2/lookup/league/4328/_/_.json',
    {error:'temporary provider failure'},'2026-10-02T00:00:00Z'),/contains an error/);
  assert.deepEqual(await archiveRecords('sportsdb/v2/lookup/league/4328/_/_.json',
    {lookup:null},'2026-10-02T00:00:00Z'),[]);
});
