#!/usr/bin/env python3
"""Fetch a pinned NGA open dataset and verify a diverse selection of Open Access images.
Run this, then node scripts/build-nga-catalog.mjs --target=299.
The metadata CC0 license alone is never used as image clearance: every primary
image must independently have published_images.openaccess=1.
"""
import argparse,concurrent.futures,csv,datetime,hashlib,json,pathlib,re,time,urllib.request,urllib.error,urllib.parse

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--target',type=int,default=299)
parser.add_argument('--buffer',type=int,default=30)
args=parser.parse_args()
if args.target<1 or args.buffer<0:parser.error('Target must be positive and buffer nonnegative')
ROOT=pathlib.Path(__file__).resolve().parents[1]
CACHE=ROOT/'.cache/nga';CACHE.mkdir(parents=True,exist_ok=True)
IMAGES=CACHE/'images';IMAGES.mkdir(exist_ok=True)
COMMIT='dfdbcf1a226ce1f2953f5e8422e71d923869b67e'
REPOSITORY='NationalGalleryOfArt/opendata'
SOURCE_URL=f'https://github.com/{REPOSITORY}/tree/{COMMIT}/data'
FILES={
 'objects.csv':{'sha256':'86bafc499885d0e2a461984b73179a7865103aeef3146e84ace7dbd25ba1afa4','sizeBytes':82387828},
 'published_images.csv':{'sha256':'2e0edc893b026c02231e4f3eed2532a9aa02d2653adc13beefbb36f609289496','sizeBytes':89389681},
 'constituents.csv':{'sha256':'9281525f17775f0eae943a50e41864ef226481263d9c799cada6bc12e6b0c339','sizeBytes':4490367},
}
HEADERS={'User-Agent':'ARTE-open-access-catalog/1.0'}
OBJECT_FIELDS=('objectid','uuid','accessioned','accessionnum','title','displaydate','beginyear','endyear','medium','dimensions','attribution','creditline','classification','subclassification','departmentabbr','portfolio','series','isvirtual','wikidataid')
def now():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def sha(path):
 with path.open('rb') as handle:return hashlib.file_digest(handle,'sha256').hexdigest()
def dataset_file(name):
 path=CACHE/name;expected=FILES[name]
 if not path.exists():
  request=urllib.request.Request(f'https://raw.githubusercontent.com/{REPOSITORY}/{COMMIT}/data/{name}',headers=HEADERS)
  temporary=path.with_suffix('.tmp')
  with urllib.request.urlopen(request,timeout=60) as response,temporary.open('wb') as output:
   count=0
   while chunk:=response.read(1024*1024):
    count+=len(chunk)
    if count>expected['sizeBytes']:raise RuntimeError(f'Pinned dataset size exceeded: {name}')
    output.write(chunk)
  temporary.replace(path)
 if path.stat().st_size!=expected['sizeBytes'] or sha(path)!=expected['sha256']:raise RuntimeError(f'Pinned dataset checksum mismatch: {name}')
 return path
paths={name:dataset_file(name) for name in FILES}
print('Three pinned NGA CSV checksums verified.',flush=True)

# Use only exact, unambiguous attribution/name matches for nationality and dates.
people={}
with paths['constituents.csv'].open(newline='',encoding='utf-8') as handle:
 for person in csv.DictReader(handle):
  for name in set((person['preferreddisplayname'],person['forwarddisplayname'])):
   if name:people.setdefault(name,[]).append(person)

primary={}
with paths['published_images.csv'].open(newline='',encoding='utf-8') as handle:
 for image in csv.DictReader(handle):
  object_id=image['depictstmsobjectid']
  if image['openaccess']!='1' or image['viewtype']!='primary' or not object_id.isdigit() or int(object_id)<1:continue
  if not re.fullmatch(r'https://api\.nga\.gov/iiif/[a-f0-9-]{36}',image['iiifurl']) or image['iiifurl'].split('/')[-1]!=image['uuid']:continue
  current=primary.get(int(object_id))
  if current is None or (int(image['sequence'] or 0),image['uuid'])<(int(current['sequence'] or 0),current['uuid']):primary[int(object_id)]=image

pools={}
with paths['objects.csv'].open(newline='',encoding='utf-8') as handle:
 for row in csv.DictReader(handle):
  if not row['objectid'].isdigit() or int(row['objectid']) not in primary:continue
  if row['accessioned']!='1' or row['isvirtual']!='0' or not row['title'].strip() or not row['attribution'].strip():continue
  if len(row['title'])>240 or re.search(r'\b(unknown|anonymous|unidentified)\b',row['attribution'],re.I):continue
  record={'id':int(row['objectid']),'object':{key:row[key] for key in OBJECT_FIELDS},'image':primary[int(row['objectid'])],
   'sourceUrl':f"https://www.nga.gov/collection/art-object-page.{row['objectid']}.html"}
  matches={person['constituentid']:person for person in people.get(row['attribution'],[])}
  if len(matches)==1:
   person=next(iter(matches.values()))
   record['artistInfo']={key:person[key] for key in ('constituentid','preferreddisplayname','forwarddisplayname','nationality','displaydate','beginyear','endyear','constituenttype')}
  pools.setdefault(row['classification'] or 'Museum collection',[]).append(record)

eligible=sum(map(len,pools.values()))
for pool in pools.values():pool.sort(key=lambda record:record['id'])
attribution_counts={};selected=[]
while len(selected)<args.target+args.buffer:
 progress=False
 for category in sorted(pools):
  pool=pools[category]
  pool[:]=[record for record in pool if attribution_counts.get(record['object']['attribution'],0)<3]
  if not pool:continue
  index=next((index for index,record in enumerate(pool) if record['object']['attribution'] not in attribution_counts),0)
  record=pool.pop(index);name=record['object']['attribution']
  selected.append(record);attribution_counts[name]=attribution_counts.get(name,0)+1;progress=True
  if len(selected)>=args.target+args.buffer:break
 if not progress:break
print(f'{eligible} eligible accessioned works; {len(pools)} classifications. Downloading {len(selected)} candidates with at most3 per attribution.',flush=True)

def download(record):
 url=record['image']['iiifurl']+'/full/!843,843/0/default.jpg';path=IMAGES/f"{record['id']}.jpg"
 for attempt in range(2):
  try:
   if not path.exists():
    with urllib.request.urlopen(urllib.request.Request(url,headers=HEADERS),timeout=40) as response:
     if urllib.parse.urlparse(response.url).hostname!='api.nga.gov':raise RuntimeError('Image redirected outside official NGA image service')
     raw=response.read(12*1024*1024+1)
    if len(raw)>12*1024*1024 or not raw.startswith(b'\xff\xd8'):raise RuntimeError('Expected bounded JPEG image')
    temporary=path.with_suffix('.tmp');temporary.write_bytes(raw);temporary.replace(path)
   else:raw=path.read_bytes()
   if not raw.startswith(b'\xff\xd8'):raise RuntimeError('Cached image is not JPEG')
   record['_datasetSource']={'repository':REPOSITORY,'commit':COMMIT,'url':SOURCE_URL,'files':FILES}
   record['_verifiedAt']=now()
   record['_imageEvidence']={'url':url,'sha256':hashlib.sha256(raw).hexdigest(),'sizeBytes':len(raw),'downloadedAt':datetime.datetime.fromtimestamp(path.stat().st_mtime,datetime.timezone.utc).isoformat()}
   return record
  except Exception as error:
   if isinstance(error,urllib.error.HTTPError) and error.code in (401,403):
    print(f"IMAGE DENIED {record['id']}: HTTP{error.code}; not retried",flush=True);return None
   if attempt:print(f"IMAGE FAILED {record['id']}: {error}",flush=True);return None
   time.sleep(.3)

accepted=[]
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as executor:
 for index,record in enumerate(executor.map(download,selected),1):
  if record:accepted.append(record)
  if index%20==0:print(f'Images checked:{index}; accepted:{len(accepted)}',flush=True)
if len(accepted)<args.target:raise SystemExit(f'Only {len(accepted)} downloads; target {args.target} not met')
for filename,value in [
 ('ready-records.json',accepted),
 ('snapshot.json',{'repository':REPOSITORY,'commit':COMMIT,'sourceUrl':SOURCE_URL,'files':FILES,'verifiedAt':now(),'target':args.target,'eligibleRecords':eligible,'imageRightsPolicyUrl':'https://www.nga.gov/terms-and-notices','imageRightsGate':"published_images.openaccess === '1' && viewtype === 'primary'"})
]:
 temporary=CACHE/(filename+'.tmp');temporary.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n');temporary.replace(CACHE/filename)
print(f'Ready:{len(accepted)} verified Open Access image downloads. Build stage selects {args.target} after decoding and cross-source deduplication.',flush=True)
