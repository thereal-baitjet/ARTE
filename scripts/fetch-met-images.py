#!/usr/bin/env python3
"""Download only verified public-domain Met primary images to a temporary cache.
No image becomes part of the catalog unless its download succeeds. Max 12 MiB/file.
"""
import concurrent.futures,json,pathlib,urllib.parse,urllib.request
ROOT=pathlib.Path(__file__).resolve().parents[1]
SOURCE=ROOT/'lib/artworks/data/met-source-records.json'
records=json.loads(SOURCE.read_text())
CACHE=ROOT/'.met-import-cache/images'; CACHE.mkdir(parents=True,exist_ok=True)

def download(obj):
    if obj.get('isPublicDomain') is not True or obj.get('rightsAndReproduction','').strip(): return None
    url=obj.get('primaryImageSmall') or obj['primaryImage']
    if urllib.parse.urlparse(url).hostname!='images.metmuseum.org': return None
    path=CACHE/f"{obj['objectID']}.jpg"
    if path.exists() and path.stat().st_size>1000: return obj
    for attempt in range(2):
        try:
            req=urllib.request.Request(url,headers={'User-Agent':'ARTE-public-domain-catalog/1.0'})
            with urllib.request.urlopen(req,timeout=30) as response: image=response.read(12*1024*1024+1)
            if len(image)>12*1024*1024: raise ValueError('Image exceeds bounded download size')
            if not image.startswith(b'\xff\xd8'): raise ValueError('Expected JPEG image')
            path.write_bytes(image)
            print(f"Image {obj['objectID']}: {len(image)} bytes",flush=True)
            return obj
        except Exception as error:
            if attempt: print(f"IMAGE WARNING {obj['objectID']}: {error}",flush=True)
    return None
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
    accepted=[record for record in executor.map(download,records) if record]
SOURCE.write_text(json.dumps(accepted,ensure_ascii=False,indent=2)+'\n')
print(f'{len(accepted)} verified records with downloaded images',flush=True)
if len(accepted)<63: raise SystemExit('Fewer than 63 downloaded images; catalog not ready to publish')
