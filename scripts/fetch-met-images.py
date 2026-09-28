#!/usr/bin/env python3
"""Stage exactly the requested image-ready records; failures never alter live source metadata."""
from __future__ import annotations
import argparse, concurrent.futures, datetime, hashlib, json, os, pathlib, time, urllib.parse, urllib.request
from met_import_common import atomic_json, select_records, valid_record
ROOT=pathlib.Path(__file__).resolve().parents[1]
MAX_BYTES=12*1024*1024


def main(argv=None):
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--target',type=int,default=500);parser.add_argument('--workers',type=int,default=6)
    parser.add_argument('--root',type=pathlib.Path,default=ROOT)
    parser.add_argument('--candidates',type=pathlib.Path);parser.add_argument('--prefetch-only',action='store_true')
    args=parser.parse_args(argv)
    if not 1<=args.workers<=8:parser.error('workers must be1–8')
    cache=args.root/'.met-import-cache';images=cache/'images';images.mkdir(parents=True,exist_ok=True)
    existing=json.loads((args.root/'lib/artworks/data/met-source-records.json').read_text())
    candidates=json.loads((args.candidates or cache/'candidate-records.json').read_text())
    if args.prefetch_only:args.target=len(candidates)
    old={obj['objectID']:obj for obj in existing};errors=[]
    duplicate_path=cache/'duplicate-images.json'
    rejected_outputs={entry['objectId'] for entry in json.loads(duplicate_path.read_text())} if duplicate_path.exists() else set()
    def download(obj):
        object_id=obj['objectID']
        if object_id in rejected_outputs and object_id not in old:
            errors.append({'objectID':object_id,'stage':'duplicate-optimized-image'});return None
        if not valid_record(obj):return None
        url=obj.get('primaryImageSmall') or obj['primaryImage']
        if urllib.parse.urlparse(url).hostname!='images.metmuseum.org':return None
        image_path=images/f'{object_id}.jpg';metadata_path=images/f'{object_id}.image.json'
        image=None
        if image_path.exists():
            cached=image_path.read_bytes()
            cached_meta=json.loads(metadata_path.read_text()) if metadata_path.exists() else None
            legacy_source=old.get(object_id,{}).get('primaryImageSmall') or old.get(object_id,{}).get('primaryImage')
            source_matches=(cached_meta and cached_meta.get('sourceUrl')==url and cached_meta.get('sha256')==hashlib.sha256(cached).hexdigest()) or (not cached_meta and legacy_source==url)
            if source_matches and 1000<=len(cached)<=MAX_BYTES and cached.startswith(b'\xff\xd8'):image=cached
        if image is None:
            for attempt in range(4):
                try:
                    req=urllib.request.Request(url,headers={'User-Agent':'ARTE-public-domain-catalog/2.0'})
                    with urllib.request.urlopen(req,timeout=25) as response:image=response.read(MAX_BYTES+1)
                    if len(image)>MAX_BYTES or len(image)<1000 or not image.startswith(b'\xff\xd8'):raise ValueError('Image did not pass JPEG/size checks')
                    temporary=image_path.with_suffix('.jpg.tmp');temporary.write_bytes(image);os.replace(temporary,image_path)
                    break
                except Exception as error:
                    image=None
                    if attempt==3:errors.append({'objectID':object_id,'stage':'image','error':str(error)[:200]})
                    else:time.sleep(min(.5*2**attempt,8))
        if image is None:return None
        evidence={'sourceUrl':url,'sha256':hashlib.sha256(image).hexdigest(),'sizeBytes':len(image),'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat()}
        atomic_json(metadata_path,evidence)
        return {**obj,'_imageEvidence':evidence}
    accepted=[]; seen_image_hashes={}
    # Process deterministic batches; finish at exactly target, retaining baseline order.
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as executor:
        cursor=0
        while len(accepted)<args.target and cursor<len(candidates):
            size=min(args.workers,args.target-len(accepted))
            batch=candidates[cursor:cursor+size];cursor+=len(batch)
            results=list(executor.map(download,batch))
            for obj,result in zip(batch,results):
                if result is None and obj['objectID'] in old:
                    atomic_json(cache/'image-report.json',{'status':'blocked','reason':'Published image could not be verified','objectID':obj['objectID'],'errors':errors})
                    raise SystemExit('Published artwork image could not be verified; live catalog preserved.')
                if result:
                    image_hash=result['_imageEvidence']['sha256']
                    duplicate_of=seen_image_hashes.get(image_hash)
                    if duplicate_of is not None and obj['objectID'] not in old:
                        errors.append({'objectID':obj['objectID'],'stage':'duplicate-image','duplicateOf':duplicate_of})
                        continue
                    accepted.append(result);seen_image_hashes[image_hash]=obj['objectID']
            if len(accepted)%30<len(batch):print(f'Image-ready: {len(accepted)}/{args.target}',flush=True)
    if args.prefetch_only:
        print(json.dumps({'status':'prefetched','accepted':len(accepted),'errors':errors}),flush=True)
        return
    # Validate identity coverage before writing the ready snapshot.
    published_ids=[obj['objectID'] for obj in existing]
    accepted_ids={obj['objectID'] for obj in accepted}
    if not set(published_ids)<=accepted_ids:raise SystemExit('Image-ready catalog would remove published works; live catalog preserved.')
    report={'status':'ready' if len(accepted)==args.target else 'insufficient','target':args.target,'accepted':len(accepted),'errors':errors}
    atomic_json(cache/'image-report.json',report)
    if len(accepted)!=args.target:raise SystemExit(f'Only {len(accepted)} images ready; live catalog preserved.')
    select_records(accepted[:len(existing)],accepted[len(existing):],args.target)
    atomic_json(cache/'ready-records.json',accepted)
    print(json.dumps(report),flush=True)

if __name__=='__main__':main()
