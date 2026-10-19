# prof.py <profile.json> [N] - a V8 CPU profile (CDP Profiler.stop) summed by function:
# SELF time (the function's own work) and TOTAL time (it and everything it called).
import json, sys
prof = json.load(open(sys.argv[1], encoding='utf-8'))
top = int(sys.argv[2]) if len(sys.argv) > 2 else 25
nodes = {n['id']: n for n in prof['nodes']}
parent = {}
for n in prof['nodes']:
    for c in n.get('children', []):
        parent[c] = n['id']
def key(n):
    cf = n['callFrame']
    url = cf.get('url', '').split('/')[-1]
    return '%s  (%s:%d)' % (cf.get('functionName') or '(anonymous)', url or '-', cf.get('lineNumber', -1) + 1)
samples, deltas = prof.get('samples', []), prof.get('timeDeltas', [])
selfT, totT = {}, {}
for sid, dt in zip(samples, deltas):
    ms = dt / 1000.0
    n = nodes.get(sid)
    if not n:
        continue
    selfT[key(n)] = selfT.get(key(n), 0) + ms
    seen = set()
    while n is not None:
        k = key(n)
        if k not in seen:
            totT[k] = totT.get(k, 0) + ms
            seen.add(k)
        n = nodes.get(parent.get(n['id']))
total = sum(d for d in deltas) / 1000.0
print('profile %.0f ms' % total)
print('--- SELF')
for k, v in sorted(selfT.items(), key=lambda x: -x[1])[:top]:
    print('%8.0f ms  %s' % (v, k))
print('--- TOTAL (inclusive)')
for k, v in sorted(totT.items(), key=lambda x: -x[1])[:top]:
    print('%8.0f ms  %s' % (v, k))
# prof.py <profile.json> [N] [functionName]: the hot LINES of one function (positionTicks)
if len(sys.argv) > 3:
    want, lines = sys.argv[3], {}
    for n in prof['nodes']:
        if n['callFrame'].get('functionName') == want:
            for pt in n.get('positionTicks', []):
                lines[pt['line']] = lines.get(pt['line'], 0) + pt['ticks']
    print('--- LINES of %s (ticks)' % want)
    for ln, t in sorted(lines.items(), key=lambda x: -x[1])[:12]:
        print('%8d  line %d' % (t, ln))
