import json,itertools,statistics,platform,hashlib,subprocess
from pathlib import Path
out=Path('/workspace/scratch/codspeed-target-evidence')
files=sorted(out.glob('third-??-?.json'))
assert len(files)==12
runs=[json.loads(p.read_text())for p in files]
assert all(len(j['results'])==25 for j in runs)
assert all(j['node']==runs[0]['node'] and j['plan']==runs[0]['plan'] for j in runs)
pairs=[(0,1),(3,2),(4,5),(7,6),(8,9),(11,10)]
resamples=list(itertools.product(range(6),repeat=6))
results=[]
for k,item in enumerate(runs[0]['results']):
 a=[statistics.median(runs[i]['results'][k]['samplesMs'])for i,j in pairs]
 b=[statistics.median(runs[j]['results'][k]['samplesMs'])for i,j in pairs]
 assert all(j['results'][k]['name']==item['name']for j in runs)
 ratios=sorted(statistics.median(b[i]for i in draw)/statistics.median(a[i]for i in draw)for draw in resamples)
 ratio=statistics.median(b)/statistics.median(a)
 ci=[ratios[int(.005*(len(ratios)-1))],ratios[int(.995*(len(ratios)-1))]]
 results.append({'name':item['name'],'iterationsPerSample':item['iterations'],'beforeMs':statistics.median(a),'afterMs':statistics.median(b),'ratio':ratio,'reductionPercent':(1-ratio)*100,'pairedBaselineBlockMediansMs':a,'pairedCandidateBlockMediansMs':b,'bootstrap99Ratio':ci,'medianMeets79':ratio<=.79,'upper99Meets79':ci[1]<=.79})
summary={'baseline':'76f51b6a784d6f6b4fc0ff5bf06a7e08173cf639','targetRatio':.79,'interpretation':'79% of previous duration = 21% reduction','protocol':'ABBA repeated three times; six paired blocks per revision; five samples per block; same fixed iteration plan; >=32 warmup calls and >=100ms per benchmark; callbacks registered by unchanged benchmark files, outside CodSpeed instrumentation','node':runs[0]['node'],'arch':platform.machine(),'cpu':next(x.split(':',1)[1].strip()for x in Path('/proc/cpuinfo').read_text().splitlines()if x.startswith('model name')),'bootstrap':'exact paired resampling 6^6=46656; percentile99 exploratory, no serial-dependence or multiple-comparison correction','count':25,'medianMeets79':sum(x['medianMeets79']for x in results),'upper99Meets79':sum(x['upper99Meets79']for x in results),'results':results}
(out/'summary.json').write_text(json.dumps(summary,indent=2)+'\n')
for r in results: print(f"{r['ratio']:.4f} [{r['bootstrap99Ratio'][0]:.4f},{r['bootstrap99Ratio'][1]:.4f}] {r['name']}")
print('Counts',summary['medianMeets79'],summary['upper99Meets79'])
