#!/usr/bin/env python3
"""Bounded Met Open Access collection import. Re-running refreshes source verification.
Only objects with isPublicDomain=true, an image, a source URL, and a named creator pass.
Run: python scripts/collect-met-catalog.py && node scripts/build-met-catalog.mjs
"""
import concurrent.futures, datetime, json, pathlib, time, urllib.parse, urllib.request
ROOT = pathlib.Path(__file__).resolve().parents[1]
API = 'https://collectionapi.metmuseum.org/public/collection'
QUERIES = ['Vincent van Gogh', 'Claude Monet', 'Edgar Degas', 'Auguste Renoir', 'Paul Cézanne', 'Édouard Manet', 'Georges Seurat', 'Camille Pissarro', 'Mary Cassatt', 'Berthe Morisot', 'Rembrandt', 'Johannes Vermeer', 'Frans Hals', 'El Greco', 'Francisco Goya', 'Diego Velázquez', 'Albrecht Dürer', 'Katsushika Hokusai', 'Utagawa Hiroshige', 'Auguste Rodin', 'Antonio Canova', 'Gian Lorenzo Bernini', 'Louis Comfort Tiffany', 'René Lalique', 'William Morris', 'Joseph Mallord William Turner', 'John Constable', 'Winslow Homer', 'John Singer Sargent', 'Kiyohara Yukinobu']
CACHE = ROOT / '.met-import-cache'
CACHE.mkdir(exist_ok=True)

def request(url):
    for attempt in range(2):
        try:
            req = urllib.request.Request(url, headers={'User-Agent':'ARTE-public-domain-catalog/1.0'})
            with urllib.request.urlopen(req, timeout=22) as response:
                return json.load(response)
        except Exception:
            if attempt: raise
            time.sleep(.3)

def collect(query):
    slug = ''.join(c if c.isalnum() else '-' for c in query)
    cache = CACHE / (slug + '.json')
    if cache.exists(): return json.loads(cache.read_text())
    accepted=[]; seen=set()
    for highlight in [True, False]:
        params={'q':query, 'artistOrCulture':'true', 'hasImages':'true', 'limit':'12'}
        if highlight: params['isHighlight']='true'
        try:
            found=request(API+'/v1.1/search?'+urllib.parse.urlencode(params))
            ids=found.get('objectIDs') or []
        except Exception as error:
            print(f'SEARCH WARNING {query}: {error}', flush=True); continue
        for object_id in ids[:12]:
            if object_id in seen: continue
            seen.add(object_id)
            try:
                obj=request(API+f'/v1/objects/{object_id}')
                if obj.get('isPublicDomain') is not True or not obj.get('primaryImage') or not obj.get('objectURL') or not obj.get('artistDisplayName'): continue
                if obj.get('rightsAndReproduction','').strip(): continue
                obj['_verifiedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat()
                obj['_apiSource']=API+f'/v1/objects/{object_id}'
                accepted.append(obj)
                if len(accepted)>=3: break
            except Exception as error:
                print(f'OBJECT WARNING {object_id}: {error}', flush=True)
        if len(accepted)>=3: break
    cache.write_text(json.dumps(accepted,ensure_ascii=False,indent=2)+'\n')
    print(f'{query}: {len(accepted)} cleared records',flush=True)
    return accepted

with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
    batches=list(executor.map(collect,QUERIES))
records=[]; known=set()
for batch in batches:
    for record in batch:
        if record['objectID'] not in known:
            records.append(record); known.add(record['objectID'])
(ROOT/'lib/artworks/data/met-source-records.json').write_text(json.dumps(records,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'records':len(records),'artists':len(set(obj['artistDisplayName'] for obj in records)),'classifications':sorted(set(obj['classification'] for obj in records))}),flush=True)
if len(records)<63: raise SystemExit('Fewer than 63 cleared records; inspect warnings before publishing.')
