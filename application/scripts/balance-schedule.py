"""Reproduce the 2027 schedule while preserving voting-schedule.json manual assignments.
Run from any directory; updates the Archive, schedule, and balance report.
"""
import json,random,math,time
from pathlib import Path
from collections import Counter
root=Path(__file__).resolve().parents[1]
rows=json.loads((root/'src/data/archive-directory.json').read_text())['rows']
manual={r['id']:r['votingDate'] for r in rows if r['votingDate']}
config=root/'src/data/voting-schedule.json'
if config.exists(): manual=json.loads(config.read_text())['manualAssignments']
from datetime import date,timedelta
dates=['2027-01-01']+[(date(2027,1,4)+timedelta(weeks=i)).isoformat() for i in range(52)]
locked={'2027-12-27'}
active=[d for d in dates if d not in locked]
services=sorted({s for r in rows for s in r['regularServices']+r['nightServices']})
boroughs=['M','Bk','Q','Bx','SI']
features=[]
for r in rows:
 routes=set(r['regularServices']+r['nightServices'])
 features.append([r['exits'] if r['borough']==b else 0 for b in boroughs]+[r['exits']/len(routes) if s in routes else 0 for s in services])
fixed=[[] for _ in dates]
remaining=[]
for i,r in enumerate(rows):
 if r['id'] in manual:
  if manual[r['id']] in dates:fixed[dates.index(manual[r['id']])].append(i)
 else:remaining.append(i)
rng=random.Random(20271017)
# 1,948 exits across 52 open dates: 24 dates at 38, 28 at 37.
higher={d for i,d in enumerate(active) if (i+1)*24//52 > i*24//52}
if '2027-11-29' not in higher:
 higher.remove(sorted(higher)[0]);higher.add('2027-11-29')
targets=[40 if d in locked else 38 if d in higher else 37 for d in dates]
assert sum(targets)+sum(r['exits'] for r in rows if manual.get(r['id'])=='2027-04-01')==2018
for attempt in range(500):
 bins=[x.copy() for x in fixed]; totals=[sum(rows[i]['exits'] for i in b) for b in bins]
 order=sorted(remaining,key=lambda i: (-rows[i]['exits'],rng.random()))
 ok=True
 for i in order:
  n=rows[i]['exits']
  candidates=[j for j,d in enumerate(dates) if d in active and targets[j]-totals[j]>=n and targets[j]-totals[j]-n!=1 and (d!='2027-11-29' or n==2)]
  if not candidates:ok=False;break
  # Mix boroughs and services while filling the emptiest eligible date.
  def cost(j):
   same=sum(rows[k]['exits'] for k in bins[j] if rows[k]['borough']==rows[i]['borough'])
   overlap=sum(len(set(rows[k]['regularServices']) & set(rows[i]['regularServices'])) for k in bins[j])
   return totals[j]*.7+same*.8+overlap*1.2+rng.random()*8
  j=min(candidates,key=cost);bins[j].append(i);totals[j]+=n
 if ok and totals==targets:break
else:raise RuntimeError('Could not fill exact exit targets')
N=len(features[0])
vectors=[[sum(features[i][k] for i in b) for k in range(N)] for b in bins]
# Penalize exit concentration, missing borough variety, and repeated lines on consecutive voting dates (excluding the fixed April special).
def local(j):
 v=vectors[j];t=targets[j]
 borough=sum(x*x for x in v[:5])/(t*t)
 routes=sum(x*x for x in v[5:])/(t*t)
 variety=sum(x>0 for x in v[:5])
 return 140*borough+170*routes+20*max(0,3-variety)**2

def edge(j):
 if j<0 or j>=len(dates)-1:return 0
 return 220*sum(a*b for a,b in zip(vectors[j][5:],vectors[j+1][5:]))/(targets[j]*targets[j+1])

def objective():return sum(local(j) for j in range(len(dates)))+sum(edge(j) for j in range(len(dates)-1))
initial=objective();best=initial;bestbins=[b.copy() for b in bins]
location={i:j for j,b in enumerate(bins) for i in b}
groups={n:[i for i in remaining if rows[i]['exits']==n] for n in set(rows[i]['exits'] for i in remaining)}
start=time.time()
for step in range(180000):
 i=rng.choice(remaining);h=rng.choice(groups[rows[i]['exits']]);a=location[i];b=location[h]
 if a==b:continue
 edges={j for j in [a-1,a,b-1,b] if 0<=j<len(dates)-1}
 before=local(a)+local(b)+sum(edge(j) for j in edges)
 delta=[features[h][k]-features[i][k] for k in range(N)]
 for k,x in enumerate(delta):vectors[a][k]+=x;vectors[b][k]-=x
 after=local(a)+local(b)+sum(edge(j) for j in edges)
 temp=1.5*(1-step/180000)**3+.002
 if after<before or rng.random()<math.exp(min(0,(before-after)/temp)):
  bins[a].remove(i);bins[a].append(h);bins[b].remove(h);bins[b].append(i);location[i]=b;location[h]=a
  value=objective() if step%500==0 else None
  if value is not None and value<best:best=value;bestbins=[x.copy() for x in bins]
 else:
  for k,x in enumerate(delta):vectors[a][k]-=x;vectors[b][k]+=x
if objective()<best:best=objective();bestbins=bins
bins=bestbins
generated={rows[i]['id']:dates[j] for j,b in enumerate(bins) for i in b if rows[i]['id'] not in manual}
assert len(generated)==len(remaining)
for r in rows:r['votingDate']=manual.get(r['id']) or generated[r['id']]
assert all(r['votingDate']==d for r in rows for id,d in manual.items() if r['id']==id)
config.write_text(json.dumps({'manualAssignments':manual,'generatedAssignments':generated},ensure_ascii=False,indent=2)+'\n')
(root/'src/data/archive-directory.json').write_text(json.dumps({'metadata':json.loads((root/'src/data/archive-directory.json').read_text())['metadata'],'rows':rows},ensure_ascii=False,indent=2)+'\n')
report=['# 2027 voting schedule balance','',f'All {len(manual)} pre-existing assignments preserved. Scheduled {len(generated)} remaining station/complex entries ({sum(rows[i]["exits"] for i in remaining)} exits).','', 'All 103 manual assignments remain fixed. January 1 and November 29 accept additions. April 1 remains unchanged at 30 exits; December 27 remains unchanged at 40. All other voting dates have 37 or 38 exits (28 dates at 37, 24 at 38). November 29 has 38, below its ceiling of 39.', '', 'The allocation uses exits as the primary constraint, then reduces borough and service concentration and consecutive-date service overlap. Regular and overnight service labels inform diversity; planned services do not. Multi-service stations divide their exit weight across their service labels. Stations and complexes remain intact.','', 'The search is deterministic (seed 20271017) and heuristic; it does not prove a globally optimal arrangement. Repeated services remain possible because many stations serve multiple routes, the year covers all 493 stations, and manual dates are fixed.','', '| Date | Exits | Archive entries | Boroughs | Services also on next regular voting date |','|---|---:|---:|---|---|']
for j,d in enumerate(dates):
 rs=[r for r in rows if r['votingDate']==d];ns=[r for r in rows if j<len(dates)-1 and r['votingDate']==dates[j+1]]
 svc=lambda rr:set(s for r in rr for s in r['regularServices']+r['nightServices'])
 bc=Counter()
 for r in rs:bc[r['borough']]+=r['exits']
 report.append(f'| {d} | {sum(r["exits"] for r in rs)} | {len(rs)} | '+', '.join(f'{b}: {n}' for b,n in sorted(bc.items()))+' | '+', '.join(sorted(svc(rs)&svc(ns)))+' |')
(root/'reference-files/planning/2027-balance.md').write_text('\n'.join(report)+'\n')
print('attempt',attempt,'seconds',round(time.time()-start,1),'objective',round(initial,2),round(best,2))
print('Borough coverage',dict(Counter(len({rows[i]['borough'] for i in b}) for b in bins)))
