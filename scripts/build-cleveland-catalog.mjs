/** Extend the Cleveland catalog to --target=350 while preserving all published works.
 * Run python scripts/import-cleveland-catalog.py first. Does not edit Met/global catalog/seed.
 */
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, copyFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const cache=path.join(root,'.cache/cleveland');
const TARGET=Number(process.argv.find(argument=>argument.startsWith('--target='))?.split('=')[1]??350);
if(!Number.isInteger(TARGET)||TARGET<1)throw Error('Target must be a positive integer');
const priorRecords=JSON.parse(await readFile(path.join(root,'lib/artworks/data/cleveland-source-records.json'),'utf8'));
const priorManifest=JSON.parse(await readFile(path.join(root,'lib/artworks/data/cleveland-catalog-manifest.json'),'utf8'));
const priorText=await readFile(path.join(root,'lib/artworks/clevelandArtworks.ts'),'utf8');
const priorCatalog=JSON.parse(priorText.slice(priorText.indexOf('= [')+2).trim().replace(/;$/,''));
if(TARGET<priorRecords.length)throw Error('Target cannot remove published Cleveland works');
if(priorRecords.length!==priorCatalog.length||priorRecords.length!==priorManifest.artworks.length)throw Error('Published Cleveland artifacts do not agree');
const priorById=new Map(priorRecords.map((record,index)=>[record.id,{record,artwork:priorCatalog[index],image:priorManifest.artworks[index]}]));
const stage=path.join(cache,'build');
await mkdir(path.join(stage,'images'),{recursive:true});
const candidates=JSON.parse(await readFile(path.join(cache,'ready-records.json'),'utf8'));
const dataset=JSON.parse(await readFile(path.join(cache,'snapshot.json'),'utf8'));
const metManifest=JSON.parse(await readFile(path.join(root,'lib/artworks/data/met-catalog-manifest.json'),'utf8'));
const metSources=JSON.parse(await readFile(path.join(root,'lib/artworks/data/met-source-records.json'),'utf8'));
if(metManifest.realArtworkCount!==339) throw Error('Expected339verifiedMetworks before cross-source deduplication');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const uuid=value=>{const h=hash(value);return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20,32)}`;};
const slug=value=>String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const text=value=>String(value??'').trim();
const quote=value=>"'"+String(value).replace(/\r\n?/g,'\n').split('\n').map(line=>line.trimEnd()).join('\n').replaceAll("'","''")+"'";
const seenImages=new Set(metManifest.artworks.map(image=>image.imageSha256));
const seenRaw=new Set(metSources.map(record=>record._imageEvidence?.sha256).filter(Boolean));
const seenIds=new Set();const catalog=[];const records=[];const images=[];const skipped=[];
const museum={name:'Cleveland Museum of Art',city:'Cleveland',country:'United States',url:'https://www.clevelandart.org/'};
const museumId=uuid('cleveland-museum');
for(let record of candidates){
 if(catalog.length===TARGET)break;
 const prior=priorById.get(record.id);
 if(prior){
  // The build adds decode evidence to newly downloaded records. A repeat build
  // may read the pre-decode staged record; compare immutable source fields and
  // retain the published evidence rather than rewriting it.
  const comparable=value=>{const copy={...value,_imageEvidence:{...value._imageEvidence}};for(const key of ['width','height','format','normalizedSha256'])delete copy._imageEvidence[key];return JSON.stringify(copy);};
  if(comparable(prior.record)!==comparable(record))throw Error(`Published source metadata changed: ${record.id}`);
  record=prior.record;
 }
 const objectUrl=new URL(record.url);const imageUrl=new URL(record._imageEvidence?.url??'');
 if(record.share_license_status!=='CC0'||text(record.copyright)||objectUrl.protocol!=='https:'||!['clevelandart.org','www.clevelandart.org'].includes(objectUrl.hostname)||decodeURIComponent(objectUrl.pathname.replace(/\/$/,''))!==`/art/${record.accession_number}`||imageUrl.protocol!=='https:'||imageUrl.hostname!=='openaccess-cdn.clevelandart.org')throw Error(`Rights/source gate failed${record.id}`);
 if(record.images?.web?.url!==record._imageEvidence.url)throw Error(`Image URL evidence mismatch${record.id}`);
 if(record._datasetSource?.commit!==dataset.commit||record._datasetSource?.dataSha256!==dataset.dataSha256)throw Error(`Snapshot mismatch${record.id}`);
 if(!Number.isFinite(Date.parse(record._verifiedAt))||Date.now()-Date.parse(record._verifiedAt)>7*24*60*60*1000)throw Error(`Stale verification${record.id}`);
 if(seenIds.has(record.id)){skipped.push({objectId:record.id,reason:'duplicate-object'});continue;}
 const raw=await readFile(path.join(cache,`images/${record.id}.jpg`));
 const rawHash=hash(raw);
 if(rawHash!==record._imageEvidence.sha256)throw Error(`Raw image evidence mismatch${record.id}`);
 if(seenRaw.has(rawHash)){skipped.push({objectId:record.id,reason:'duplicate-source-image'});continue;}
 const isLocal=prior&&prior.image.imagePath.startsWith('/artworks/');
 const delivery=isLocal?'local':'remote';
 const imagePath=isLocal?prior.image.imagePath:record._imageEvidence.url;
 const destination=path.join(stage,'images',`cleveland-${record.id}.webp`);
 let dimensions,bytes,normalizedImageSha256;
 try {
  const rawDimensions=await sharp(raw).metadata();
  if(rawDimensions.format!=='jpeg'||!rawDimensions.width||!rawDimensions.height||rawDimensions.width*rawDimensions.height>80000000)throw Error('Invalid source JPEG');
  if(isLocal){
   const published=path.join(root,'public',prior.image.imagePath);
   const originalBytes=await readFile(published);
   if(hash(originalBytes)!==prior.image.imageSha256)throw Error(`Published image hash changed: ${record.id}`);
   bytes=originalBytes;
   dimensions=await sharp(originalBytes).metadata();
   normalizedImageSha256=hash(originalBytes);
  }else{
   // This ignored-cache derivative is used only to detect identical decoded
   // images across providers. Production serves the museum's original CDN URL.
   await sharp(raw).rotate().resize({width:1280,height:1600,fit:'inside',withoutEnlargement:true}).webp({quality:82}).toFile(destination);
   normalizedImageSha256=hash(await readFile(destination));
   dimensions=rawDimensions;bytes=raw;
   if(prior&&rawHash!==prior.image.imageSha256)throw Error(`Published remote image hash changed: ${record.id}`);
   if(!prior)record._imageEvidence={...record._imageEvidence,width:rawDimensions.width,height:rawDimensions.height,format:'jpeg',normalizedSha256:normalizedImageSha256};
  }
 }
 catch(error) {if(prior)throw error;skipped.push({objectId:record.id,reason:'image-decode-failed'});continue;}
 const {width,height}=dimensions;
 if(!width||!height||(isLocal&&(width>1280||height>1600)))throw Error('Verified image dimensions failed');
 const imageSha256=hash(bytes);
 if(seenImages.has(normalizedImageSha256)){skipped.push({objectId:record.id,reason:'duplicate-optimized-image'});continue;}
 seenImages.add(normalizedImageSha256);seenRaw.add(rawHash);seenIds.add(record.id);
 const creators=(record.creators||[]).filter(creator=>text(creator.description));
 if(!creators.length)throw Error(`Missing creator attribution${record.id}`);
 const attribution=creators.map(creator=>[creator.qualifier,creator.description,creator.extent?`(${creator.extent})`:null].map(text).filter(Boolean).join(' '));
 const artistName=creators.map(creator=>[creator.qualifier,text(creator.description).split(' (')[0],creator.extent?`(${creator.extent})`:null].map(text).filter(Boolean).join(' ')).join(' / ');
 const artistKey=creators.map(creator=>`${creator.id??creator.description}:${creator.qualifier??''}:${creator.extent??''}`).join('|');
 const artistId=uuid(`cleveland-artist:${artistKey}`);
 const artist={id:artistId,slug:`${slug(artistName).slice(0,100)}-cleveland-${artistId.slice(0,8)}`,name:artistName,nationality:[...new Set(creators.map(creator=>/\(([^,)]+)/.exec(creator.description)?.[1]).filter(Boolean))].join('; ')||'Not supplied by the museum',biography:attribution.join('; ')};
 const category=text(record.type)||text(record.department)||'Museum collection';const date=text(record.creation_date)||'Date not supplied';const medium=text(record.technique)||'Medium not supplied';
 const cultures=(record.culture||[]).filter(value=>typeof value==='string'&&value.trim());
 const tags=[...new Set([category,record.department,record.collection,...cultures].map(text).filter(Boolean).map(value=>value.toLowerCase()))];
 const description=[`${record.title} (${date}).`,`${attribution.join('; ')}.`,`${medium}.`,`Collection: ${museum.name}.`,record.creditline?`Credit: ${record.creditline}.`:''].filter(Boolean).join(' ');
 const orientation=width/height>1.12?'landscape':height/width>1.12?'portrait':'square';
 const artwork=prior?.artwork??{id:uuid(`cleveland-artwork:${record.id}`),slug:`${slug(record.title).slice(0,85)||'untitled'}-cleveland-${record.id}`,title:record.title,year:date,medium,dimensions:text(record.measurements)||'Dimensions not supplied',description,movement:category,tags,features:{palette:[],mood:[],composition:[],subjects:[],mediumCategory:category.toLowerCase(),period:date,geography:cultures.join('; ')||'Not supplied'},artist,visual:{kind:'image',aspect:orientation,aspectRatio:`${width} / ${height}`,background:'#ede8df',alt:`${record.title}, ${artistName}, ${date}. ${medium}. Image from Cleveland Museum of Art.`,src:imagePath,width,height},recommendationReason:`Explore ${category.toLowerCase()} from Cleveland Museum of Art’s Open Access collection. Connections use museum catalog metadata.`,isDemo:false,museum,rights:{imageSource:'Cleveland Museum of Art Open Access',rightsHolder:'Public domain; image provided by Cleveland Museum of Art',license:'CC0 1.0 Universal',usageNotes:`The official museum dataset marked this object share_license_status=CC0. Verified against GitHub snapshot ${dataset.commit} on ${record._verifiedAt.slice(0,10)}. ${record.creditline||''} Image delivered from the museum’s official Open Access CDN with original proportions preserved. Attribution does not imply museum endorsement or availability for sale.`,sourceUrl:record.url}};
 catalog.push(artwork);records.push(record);images.push({id:artwork.id,source:'cleveland',objectId:record.id,artistId,imagePath,imageSha256,normalizedImageSha256,delivery,sizeBytes:bytes.length,width,height,verifiedAt:record._verifiedAt,sourceUrl:record.url,imageSourceUrl:record._imageEvidence.url,rightsState:'public_domain',license:'CC0 1.0 Universal',sourceName:museum.name,museumSlug:'cleveland-museum-of-art'});
}
if(catalog.length!==TARGET||new Set(catalog.map(artwork=>artwork.id)).size!==TARGET)throw Error(`Expected ${TARGET} distinct artworks; got ${catalog.length}`);
if(!priorRecords.every((record,index)=>records[index]?.id===record.id&&JSON.stringify(catalog[index])===JSON.stringify(priorCatalog[index])&&images[index].imageSha256===priorManifest.artworks[index].imageSha256))throw Error('Published Cleveland identity/order/metadata/image preservation gate failed');
const counts=field=>Object.fromEntries([...new Set(catalog.map(artwork=>artwork[field]))].map(value=>[value,catalog.filter(artwork=>artwork[field]===value).length]));
const artists=new Map(catalog.map(artwork=>[artwork.artist.id,artwork]));
const manifest={schemaVersion:1,generatedAt:new Date().toISOString(),realArtworkCount:catalog.length,syntheticFixtureCount:0,totalArtworkCount:catalog.length,sourceCounts:{cleveland:catalog.length},artistCount:artists.size,categoryCount:new Set(catalog.map(artwork=>artwork.movement)).size,categoryCounts:counts('movement'),mediumCounts:counts('medium'),dateCounts:counts('year'),preservedObjectIds:priorRecords.map(record=>record.id),objectIds:records.map(record=>record.id),dataset,skipped,artworks:images};
const sql=[`-- BEGIN GENERATED CLEVELAND OPEN ACCESS CATALOG`,`-- Verified official GitHub dataset snapshot ${dataset.commit}; CC0 records/images only.`,`insert into public.museums(id,slug,name,city,country,source_url) values(${quote(museumId)},'cleveland-museum-of-art',${quote(museum.name)},'Cleveland','United States',${quote(museum.url)}) on conflict(id) do update set slug=excluded.slug,name=excluded.name,source_url=excluded.source_url;`];
for(const {artist,rights} of artists.values())sql.push(`insert into public.artists(id,slug,name,biography,nationality,biography_source_url) values(${[artist.id,artist.slug,artist.name,artist.biography,artist.nationality,rights.sourceUrl].map(quote).join(',')}) on conflict(id) do update set slug=excluded.slug,name=excluded.name,biography=excluded.biography,nationality=excluded.nationality,biography_source_url=excluded.biography_source_url;`);
for(const category of new Set(catalog.map(artwork=>artwork.movement)))sql.push(`insert into public.art_movements(id,name,slug) values(${quote(uuid('cleveland-category:'+category))},${quote(category)},${quote('cleveland-'+slug(category))}) on conflict(name) do nothing;`);
for(let index=0;index<catalog.length;index++){
 const a=catalog[index],o=records[index],verified=quote(o._verifiedAt);
 sql.push(`insert into public.artworks(id,artist_id,museum_id,slug,title,year_display,medium,dimensions,description,source_name,source_url,source_artwork_id,metadata_source,image_source,image_creator,image_rights_state,image_license,commercial_usage_allowed,is_published,is_synthetic,data_verified_at,last_synced_at,source_adapter_version) values(${[a.id,a.artist.id,museumId,a.slug,a.title,a.year,a.medium,a.dimensions,a.description,museum.name,a.rights.sourceUrl,String(o.id),dataset.sourceUrl,a.rights.imageSource,museum.name,'public_domain',a.rights.license].map(quote).join(',')},true,true,false,${verified},${verified},'cleveland-open-access-v1') on conflict(id) do update set artist_id=excluded.artist_id,museum_id=excluded.museum_id,slug=excluded.slug,title=excluded.title,year_display=excluded.year_display,medium=excluded.medium,dimensions=excluded.dimensions,description=excluded.description,source_name=excluded.source_name,source_url=excluded.source_url,source_artwork_id=excluded.source_artwork_id,metadata_source=excluded.metadata_source,image_source=excluded.image_source,image_creator=excluded.image_creator,image_rights_state=excluded.image_rights_state,image_license=excluded.image_license,commercial_usage_allowed=excluded.commercial_usage_allowed,is_published=excluded.is_published,is_synthetic=excluded.is_synthetic,data_verified_at=excluded.data_verified_at,last_synced_at=excluded.last_synced_at,source_adapter_version=excluded.source_adapter_version;`);
 sql.push(`insert into public.artwork_images(id,artwork_id,url,width,height,alt_text,image_source,rights_holder,license,usage_notes,source_url,commercial_usage_allowed) values(${quote(uuid('cleveland-image:'+o.id))},${quote(a.id)},${quote(a.visual.src)},${a.visual.width},${a.visual.height},${[a.visual.alt,a.rights.imageSource,a.rights.rightsHolder,a.rights.license,a.rights.usageNotes,a.rights.sourceUrl].map(quote).join(',')},true) on conflict(id) do update set url=excluded.url,width=excluded.width,height=excluded.height,alt_text=excluded.alt_text,image_source=excluded.image_source,rights_holder=excluded.rights_holder,license=excluded.license,usage_notes=excluded.usage_notes,source_url=excluded.source_url;`);
 sql.push(`insert into public.artwork_sources(id,artwork_id,source_name,source_url,source_artwork_id,metadata_source,last_synced_at,data_verified_at,source_adapter_version) values(${[uuid('cleveland-source:'+o.id),a.id,museum.name,a.rights.sourceUrl,String(o.id),dataset.sourceUrl].map(quote).join(',')},${verified},${verified},'cleveland-open-access-v1') on conflict(source_name,source_artwork_id) do update set source_url=excluded.source_url,metadata_source=excluded.metadata_source,last_synced_at=excluded.last_synced_at,data_verified_at=excluded.data_verified_at;`);
 sql.push(`insert into public.artwork_movements(artwork_id,movement_id) select ${quote(a.id)},id from public.art_movements where name=${quote(a.movement)} on conflict do nothing;`);
 for(const tag of a.tags)sql.push(`insert into public.artwork_tags(artwork_id,tag) values(${quote(a.id)},${quote(tag)}) on conflict do nothing;`);
}
sql.push('-- END GENERATED CLEVELAND OPEN ACCESS CATALOG');
await writeFile(path.join(stage,'clevelandArtworks.ts'),`// Generated from the official Cleveland Open Access dataset. See source manifest for pinned provenance.\nimport type { Artwork } from './types.ts';\n\nexport const CLEVELAND_ARTWORKS: Artwork[] = ${JSON.stringify(catalog,null,2)};\n`);
await writeFile(path.join(stage,'cleveland-source-records.json'),JSON.stringify(records,null,2)+'\n');
await writeFile(path.join(stage,'cleveland-catalog-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
await writeFile(path.join(stage,'cleveland-seed.sql'),sql.join('\n')+'\n');
// Existing local images remain byte-for-byte unchanged. All additions use the
// verified official CDN; publish the manifest last as the completion marker.
for(const [file,destination] of [
 ['cleveland-source-records.json','lib/artworks/data/cleveland-source-records.json'],
 ['cleveland-seed.sql','supabase/cleveland-seed.sql'],
 ['clevelandArtworks.ts','lib/artworks/clevelandArtworks.ts'],
 ['cleveland-catalog-manifest.json','lib/artworks/data/cleveland-catalog-manifest.json']
]){const target=path.join(root,destination);await copyFile(path.join(stage,file),target+'.tmp');await rename(target+'.tmp',target);}
console.log(JSON.stringify({works:catalog.length,preservedWorks:priorRecords.length,newWorks:catalog.length-priorRecords.length,artistIdentities:artists.size,categories:manifest.categoryCounts,imageBytes:images.reduce((sum,image)=>sum+image.sizeBytes,0),skipped,manifest:'lib/artworks/data/cleveland-catalog-manifest.json',seed:'supabase/cleveland-seed.sql'},null,2));
