#!/usr/bin/env python3
"""Import verified CC0 candidates from the museum's official pinned GitHub dataset.
Run this, then node scripts/build-cleveland-catalog.mjs. Does not call the museum API.
"""
import argparse,concurrent.futures,datetime,hashlib,json,pathlib,time,urllib.request,urllib.parse,urllib.error
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument("--target",type=int,default=350)
parser.add_argument("--buffer",type=int,default=50)
args=parser.parse_args()
if args.target<1 or args.buffer<0:parser.error("Target must be positive and buffer nonnegative")
ROOT=pathlib.Path(__file__).resolve().parents[1]
CACHE=ROOT/'.cache/cleveland';CACHE.mkdir(parents=True,exist_ok=True)
IMAGE_CACHE=CACHE/'images';IMAGE_CACHE.mkdir(exist_ok=True)
COMMIT='4684c48c7c07b1452db7963adf4aad8052055b7d'
DATASET_SHA256='e8b29e67f3df840bca6cd1ffd37ca5d187b913af2ab2edf6ddb8cf164cd4359f'
DATASET_SIZE=343572124
DATASET_URL=f'https://media.githubusercontent.com/media/ClevelandMuseumArt/openaccess/{COMMIT}/data.json'
SOURCE_URL=f'https://github.com/ClevelandMuseumArt/openaccess/blob/{COMMIT}/data.json'
DATASET=CACHE/'data.json'
HEADERS={'User-Agent':'ARTE-open-access-catalog/1.0'}
PRIOR_PATH=ROOT/'lib/artworks/data/cleveland-source-records.json'
prior=json.loads(PRIOR_PATH.read_text()) if PRIOR_PATH.exists() else []
prior_by_id={record['id']:record for record in prior}
if args.target<len(prior):raise SystemExit('Target cannot remove already-published Cleveland works')
prior_verified=set()

def now(): return datetime.datetime.now(datetime.timezone.utc).isoformat()
def sha(path):
    with path.open('rb') as handle:return hashlib.file_digest(handle,'sha256').hexdigest()

if not DATASET.exists():
    request=urllib.request.Request(DATASET_URL,headers=HEADERS)
    with urllib.request.urlopen(request,timeout=60) as response,DATASET.open('wb') as output:
        count=0
        while chunk:=response.read(1024*1024):
            count+=len(chunk)
            if count>DATASET_SIZE:raise RuntimeError('Dataset exceeded pinned Git LFS size')
            output.write(chunk)
if DATASET.stat().st_size!=DATASET_SIZE or sha(DATASET)!=DATASET_SHA256:raise RuntimeError('Pinned dataset Git LFS hash/size mismatch')

# Stream the 343 MB top-level array instead of retaining the complete dataset in RAM.
def records(path):
    decoder=json.JSONDecoder();buffer='';started=False
    with path.open(encoding='utf-8') as handle:
        while True:
            if not buffer.strip():buffer+=handle.read(1024*1024)
            buffer=buffer.lstrip()
            if not started:
                if not buffer.startswith('['):raise RuntimeError('Expected dataset array')
                buffer=buffer[1:];started=True
            buffer=buffer.lstrip(' \n\r\t,')
            if buffer.startswith(']'):return
            try:record,end=decoder.raw_decode(buffer)
            except json.JSONDecodeError:
                chunk=handle.read(1024*1024)
                if not chunk:raise
                buffer+=chunk;continue
            yield record;buffer=buffer[end:]

pools={};eligible=0
for record in records(DATASET):
    image=(record.get('images') or {}).get('web') or {}
    uri=urllib.parse.urlparse(record.get('url') or '')
    image_uri=urllib.parse.urlparse(image.get('url') or '')
    allowed=(record.get('share_license_status')=='CC0' and not record.get('copyright')
      and uri.scheme=='https' and uri.hostname in {'clevelandart.org','www.clevelandart.org'}
      and urllib.parse.unquote(uri.path.rstrip('/'))=='/art/'+str(record.get('accession_number') or '')
      and image_uri.scheme=='https' and image_uri.hostname=='openaccess-cdn.clevelandart.org')
    if record['id'] in prior_by_id:
        previous=prior_by_id[record['id']]
        original={key:value for key,value in previous.items() if not key.startswith('_')}
        source_hash=hashlib.sha256(json.dumps(record,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()).hexdigest()
        unchanged=previous.get('_sourceRecordSha256')==source_hash if previous.get('_sourceRecordSha256') else original==record
        if not allowed or not unchanged:raise RuntimeError(f"Published record changed or lost clearance: {record['id']}")
        if previous.get('_datasetSource',{}).get('commit')!=COMMIT:raise RuntimeError('Published snapshot differs; explicit refresh required')
        prior_verified.add(record['id']);continue
    if not allowed:continue
    creators=record.get('creators') or []
    if not creators or not creators[0].get('description') or len(record.get('title') or '')>200:continue
    if 'unknown' in creators[0]['description'].lower():continue
    eligible+=1
    pools.setdefault(record.get('type') or 'Museum collection',[]).append(record)
if prior_verified!=set(prior_by_id):raise RuntimeError('The snapshot is missing a published object')

def creator(record):
    first=record['creators'][0]
    return first.get('id') or first['description']
def priority(record):return (not bool(record.get('current_location')),record['id'])
for pool in pools.values():pool.sort(key=priority)
# Round-robin museum categories and prefer a new creator within each category.
# The preserved paintings remain first; additions intentionally broaden the media.
ordered=sorted(pools, key=lambda category:(category=='Painting',category))
used_creators={creator(record) for record in prior}
added_creators={}
needed=args.target-len(prior)
candidate_count=needed+args.buffer if needed else 0
candidates=[]
while len(candidates)<candidate_count:
    made_progress=False
    for category in ordered:
        pool=pools[category]
        pool[:]=[record for record in pool if added_creators.get(creator(record),0)<3]
        if not pool:continue
        index=next((index for index,record in enumerate(pool) if creator(record) not in used_creators),0)
        record=pool.pop(index)
        candidates.append(record);used_creators.add(creator(record));added_creators[creator(record)]=added_creators.get(creator(record),0)+1;made_progress=True
        if len(candidates)>=candidate_count:break
    if not made_progress:break
print(f'Pinned snapshot verified; preserving {len(prior)} published works. {eligible} additional eligible records in {len(pools)} categories. Downloading up to {len(candidates)} new candidates for target {args.target}.',flush=True)

# Six bounded workers. HTTP authorization denials are never retried.
def download(record):
    image=record['images']['web'];url=image['url'];target=IMAGE_CACHE/f"{record['id']}.jpg"
    for attempt in range(2):
        try:
            if not target.exists():
                request=urllib.request.Request(url,headers=HEADERS)
                with urllib.request.urlopen(request,timeout=35) as response:
                    resolved=urllib.parse.urlparse(response.url)
                    if resolved.hostname!='openaccess-cdn.clevelandart.org':raise RuntimeError('Image redirected outside approved museum CDN')
                    raw=response.read(12*1024*1024+1)
                if len(raw)>12*1024*1024:raise RuntimeError('Image exceeds12MiB')
                if not raw.startswith(b'\xff\xd8'):raise RuntimeError('Image is not JPEG')
                target.write_bytes(raw)
            else:raw=target.read_bytes()
            source_record_hash=hashlib.sha256(json.dumps(record,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()).hexdigest()
            # Preserve fields used by the catalog and rights checks. The pinned full
            # snapshot and canonical record hash retain an anchor for omitted essays.
            keep=('id','accession_number','title','url','share_license_status','copyright','creators','type','department','collection','culture','creation_date','technique','measurements','creditline')
            record={key:record.get(key) for key in keep}
            record['images']={'web':image}
            record['_sourceRecordSha256']=source_record_hash
            record['_verifiedAt']=now()
            record['_datasetSource']={'repository':'ClevelandMuseumArt/openaccess','commit':COMMIT,'url':SOURCE_URL,'dataSha256':DATASET_SHA256}
            record['_apiSource']=SOURCE_URL
            record['_imageEvidence']={'url':url,'sha256':hashlib.sha256(raw).hexdigest(),'sizeBytes':len(raw),'downloadedAt':datetime.datetime.fromtimestamp(target.stat().st_mtime,datetime.timezone.utc).isoformat()}
            return record
        except Exception as error:
            if isinstance(error,urllib.error.HTTPError) and error.code in (401,403):
                print(f"IMAGE DENIED {record['id']}: HTTP{error.code}; not retried",flush=True);return None
            if attempt:print(f"IMAGE FAILED {record['id']}: {error}",flush=True);return None
            time.sleep(.3)

accepted=list(prior)
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as executor:
    for index,record in enumerate(executor.map(download,candidates),1):
        if record:accepted.append(record)
        if index%20==0:print(f'Images checked:{index}; accepted:{len(accepted)}',flush=True)
if len(accepted)<args.target:raise SystemExit(f'Only {len(accepted)} cleared images; target {args.target} not met. Previous staged/live files preserved.')
for filename,value in [
 ('ready-records.json',accepted),
 ('snapshot.json',{'repository':'ClevelandMuseumArt/openaccess','commit':COMMIT,'sourceUrl':SOURCE_URL,'dataSha256':DATASET_SHA256,'dataSizeBytes':DATASET_SIZE,'verifiedAt':now(),'apiUnavailable':True,'eligibleRecords':eligible,'target':args.target,'preservedCount':len(prior)})
]:
    temporary=CACHE/(filename+'.tmp')
    temporary.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n')
    temporary.replace(CACHE/filename)
print(f'Ready: {len(accepted)} downloaded rights-cleared candidates including {len(prior)} unchanged published works. Build stage will select {args.target} after image decode and exact-hash deduplication.',flush=True)
