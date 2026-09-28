/** Build typed local catalog + optimized images + idempotent SQL from verified source data.
 * Run after collect-met-catalog.py and fetch-met-images.py. No live fetch during builds.
 */
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, rename, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const requestedTarget = Number(process.argv.find(value => value.startsWith('--target='))?.split('=')[1] ?? 500);
if (!Number.isInteger(requestedTarget) || requestedTarget < 1) throw Error('Invalid target count');
const sourcePath=path.join(root,'lib/artworks/data/met-source-records.json');
const priorSource=JSON.parse(await readFile(sourcePath,'utf8'));
const source = JSON.parse(await readFile(path.join(root,'.met-import-cache/ready-records.json'),'utf8'));
if (source.length !== requestedTarget || new Set(source.map(x=>x.objectID)).size !== requestedTarget) throw Error('Ready snapshot count/identity gate failed');
if (!priorSource.every(old=>source.some(current=>current.objectID===old.objectID))) throw Error('Ready snapshot would remove a published artwork');
const existingCatalogText=await readFile(path.join(root,'lib/artworks/metArtworks.ts'),'utf8');
const existingCatalog=JSON.parse(existingCatalogText.slice(existingCatalogText.indexOf('= [')+2).trim().replace(/;$/, ''));
const existingByObject=new Map(priorSource.map((obj,index)=>[obj.objectID,{record:obj,artwork:existingCatalog[index]}]));
const buildRoot=path.join(root,'.met-import-cache','build');
await mkdir(path.join(buildRoot,'images'),{recursive:true});
const imageManifest=[];
const seenOutputHashes=new Map(); const newOutputDuplicates=[];
const uuid = (value) => { const h=createHash('sha256').update(value).digest('hex'); return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20,32)}`; };
const slug = (value) => value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const text = (value) => String(value??'').trim();
// Museum dimensions can contain CRLF and trailing spaces. Preserve their line
// boundaries and factual text while emitting clean SQL source lines.
const quote = (value) => "'"+String(value).replace(/\r\n?/g,'\n').split('\n').map(line=>line.trimEnd()).join('\n').replaceAll("'","''")+"'";
const museumId=uuid('met-museum');
const museum = { name: 'The Metropolitan Museum of Art', city:'New York', country:'United States', url:'https://www.metmuseum.org/' };
const catalog=[];
await mkdir(path.join(root,'public/artworks'),{recursive:true});
for(const obj of source) {
  if(obj.isPublicDomain!==true || !obj.objectURL?.startsWith('https://www.metmuseum.org/') || text(obj.rightsAndReproduction)) throw Error(`Uncleared source ${obj.objectID}`);
  const verifiedAt=Date.parse(obj._verifiedAt);
  if(!Number.isFinite(verifiedAt) || Date.now()-verifiedAt>7*24*60*60*1000 || verifiedAt>Date.now()) throw Error(`Stale verification ${obj.objectID}`);
  const rawImage=await readFile(path.join(root,`.met-import-cache/images/${obj.objectID}.jpg`));
  if(createHash('sha256').update(rawImage).digest('hex')!==obj._imageEvidence?.sha256) throw Error(`Image evidence mismatch ${obj.objectID}`);
  const prior=existingByObject.get(obj.objectID);
  const output=path.join(buildRoot,`images/met-${obj.objectID}.webp`);
  const currentImage=path.join(root,`public/artworks/met-${obj.objectID}.webp`);
  const sameImageSource=prior && (prior.record.primaryImageSmall || prior.record.primaryImage)===(obj.primaryImageSmall || obj.primaryImage);
  if(sameImageSource) await copyFile(currentImage,output);
  else await sharp(path.join(root,`.met-import-cache/images/${obj.objectID}.jpg`)).rotate().resize({width:1280,height:1600,fit:'inside',withoutEnlargement:true}).webp({quality:82}).toFile(output);
  const {width,height}=await sharp(output).metadata();
  if(!width || !height || width>1280 || height>1600) throw Error(`Image dimensions failed ${obj.objectID}`);
  const bytes=await readFile(output);
  const imageSha256=createHash('sha256').update(bytes).digest('hex');
  if(seenOutputHashes.has(imageSha256) && !prior) newOutputDuplicates.push({objectId:obj.objectID,duplicateOf:seenOutputHashes.get(imageSha256),imageSha256});
  else seenOutputHashes.set(imageSha256,obj.objectID);
  if(sameImageSource && imageSha256!==createHash('sha256').update(await readFile(currentImage)).digest('hex')) throw Error('Existing image changed');
  imageManifest.push({objectId:obj.objectID,imagePath:`/artworks/met-${obj.objectID}.webp`,imageSha256,sizeBytes:bytes.length,replaceExisting:!sameImageSource,verifiedAt:obj._verifiedAt,sourceUrl:obj.objectURL});
  const artistName = [obj.artistPrefix,obj.artistDisplayName,obj.artistSuffix].map(text).filter(Boolean).join(' ');
  const artistId=uuid('met-artist:'+artistName);
  const artist={id:artistId,slug:`${slug(artistName)}-met-${artistId.slice(0,8)}`,name:artistName,nationality:text(obj.artistNationality)||text(obj.culture)||'Not supplied by the museum',biography:text(obj.artistDisplayBio)||`The Met credits this work to ${artistName}. Further biographical information is not supplied in this object record.`};
  const subjects=(obj.tags||[]).map(tag=>text(tag.term).toLowerCase()).filter(Boolean);
  const category=text(obj.classification)||text(obj.objectName)||text(obj.department);
  const orientation=width/height>1.12?'landscape':height/width>1.12?'portrait':'square';
  const description=[obj.objectDate?`${obj.title} (${obj.objectDate}).`:`${obj.title}.`,obj.medium?`${artistName}; ${obj.medium}.`:`${artistName}.`,`Collection: ${museum.name}.`,obj.creditLine?`Credit: ${obj.creditLine}`:''].filter(Boolean).join(' ');
  catalog.push({id:uuid(`met-artwork:${obj.objectID}`),slug:prior?.artwork.slug??`${slug(obj.title).slice(0,85)}-met-${obj.objectID}`,title:obj.title,year:obj.objectDate||'Date not supplied',medium:obj.medium||'Medium not supplied',dimensions:obj.dimensions||'Dimensions not supplied',description,movement:category,tags:[...new Set([...subjects,category.toLowerCase(),text(obj.department).toLowerCase()])],features:{palette:[],mood:[],composition:[],subjects,mediumCategory:category.toLowerCase(),period:text(obj.period)||obj.objectDate||'Date not supplied',geography:text(obj.country)||text(obj.culture)||'Not supplied'},artist,visual:{kind:'image',aspect:orientation,aspectRatio:`${width} / ${height}`,background:'#ede8df',alt:`${obj.title} by ${artistName}, ${obj.objectDate}. ${obj.medium}. Image from The Metropolitan Museum of Art.`,src:`/artworks/met-${obj.objectID}.webp`,width,height},recommendationReason:`Explore ${category.toLowerCase()} from The Met's public-domain collection. Connections use museum catalog metadata.`,isDemo:false,museum,rights:{imageSource:'The Metropolitan Museum of Art Open Access',rightsHolder:'Public domain; image provided by The Metropolitan Museum of Art',license:'CC0 1.0 Universal',usageNotes:`The Met API marked this object isPublicDomain=true when verified ${obj._verifiedAt.slice(0,10)}. ${obj.creditLine||''} Local WebP derivative resized without cropping. Museum attribution does not imply endorsement or availability for sale.`,sourceUrl:obj.objectURL}});
}
if(newOutputDuplicates.length) {
  await writeFile(path.join(root,'.met-import-cache/duplicate-images.json'),JSON.stringify(newOutputDuplicates,null,2)+'\n');
  throw Error(`${newOutputDuplicates.length} duplicate optimized images rejected. Rerun the image stage to backfill before publishing.`);
}
if(catalog.length!==requestedTarget || new Set(catalog.map(x=>x.artist.id)).size<20) throw Error('Catalog diversity/count gate failed');
await writeFile(path.join(buildRoot,'metArtworks.ts'),`// Generated by scripts/build-met-catalog.mjs from verified Met Open Access records.\nimport type { Artwork } from './types.ts';\n\nexport const MET_ARTWORKS: Artwork[] = ${JSON.stringify(catalog,null,2)};\n`);
const sql=[`-- BEGIN GENERATED MET OPEN ACCESS CATALOG`,`-- Source: https://metmuseum.github.io/ and per-object archived verification records.`,`insert into public.museums(id,slug,name,city,country,source_url) values(${quote(museumId)},'the-metropolitan-museum-of-art',${quote(museum.name)},'New York','United States','https://www.metmuseum.org/') on conflict(id) do update set slug=excluded.slug,name=excluded.name,source_url=excluded.source_url;`];
const artists=new Map(catalog.map(x=>[x.artist.id,x]));
for(const {artist,rights} of artists.values()) sql.push(`insert into public.artists(id,slug,name,biography,biography_source_url) values(${quote(artist.id)},${quote(artist.slug)},${quote(artist.name)},${quote(artist.biography)},${quote(rights.sourceUrl)}) on conflict(id) do update set slug=excluded.slug,name=excluded.name,biography=excluded.biography,biography_source_url=excluded.biography_source_url;`);
for(const category of new Set(catalog.map(x=>x.movement))) sql.push(`insert into public.art_movements(id,name,slug) values(${quote(uuid('met-category:'+category))},${quote(category)},${quote('met-'+slug(category))}) on conflict(id) do update set name=excluded.name,slug=excluded.slug;`);
for(let index=0;index<catalog.length;index++) {
 const a=catalog[index],o=source[index],verified=quote(o._verifiedAt);
 sql.push(`insert into public.artworks(id,artist_id,museum_id,slug,title,year_display,medium,dimensions,description,source_name,source_url,source_artwork_id,metadata_source,image_source,image_creator,image_rights_state,image_license,commercial_usage_allowed,is_published,is_synthetic,data_verified_at,last_synced_at,source_adapter_version) values(${[a.id,a.artist.id,museumId,a.slug,a.title,a.year,a.medium,a.dimensions,a.description,'The Metropolitan Museum of Art',a.rights.sourceUrl,String(o.objectID),o._apiSource,a.rights.imageSource,'The Metropolitan Museum of Art','public_domain',a.rights.license].map(quote).join(',')},true,true,false,${verified},${verified},'met-open-access-v1') on conflict(id) do update set artist_id=excluded.artist_id,museum_id=excluded.museum_id,slug=excluded.slug,title=excluded.title,year_display=excluded.year_display,medium=excluded.medium,dimensions=excluded.dimensions,description=excluded.description,source_name=excluded.source_name,source_url=excluded.source_url,source_artwork_id=excluded.source_artwork_id,metadata_source=excluded.metadata_source,image_source=excluded.image_source,image_creator=excluded.image_creator,image_rights_state=excluded.image_rights_state,image_license=excluded.image_license,commercial_usage_allowed=excluded.commercial_usage_allowed,is_published=excluded.is_published,is_synthetic=excluded.is_synthetic,data_verified_at=excluded.data_verified_at,last_synced_at=excluded.last_synced_at,source_adapter_version=excluded.source_adapter_version;`);
 sql.push(`insert into public.artwork_images(id,artwork_id,url,width,height,alt_text,image_source,rights_holder,license,usage_notes,source_url,commercial_usage_allowed) values(${quote(uuid('met-image:'+o.objectID))},${quote(a.id)},${quote(a.visual.src)},${a.visual.width},${a.visual.height},${[a.visual.alt,a.rights.imageSource,a.rights.rightsHolder,a.rights.license,a.rights.usageNotes,a.rights.sourceUrl].map(quote).join(',')},true) on conflict(id) do update set url=excluded.url,width=excluded.width,height=excluded.height,alt_text=excluded.alt_text,image_source=excluded.image_source,rights_holder=excluded.rights_holder,license=excluded.license,usage_notes=excluded.usage_notes,source_url=excluded.source_url;`);
 sql.push(`insert into public.artwork_sources(id,artwork_id,source_name,source_url,source_artwork_id,metadata_source,last_synced_at,data_verified_at,source_adapter_version) values(${[uuid('met-source:'+o.objectID),a.id,'The Metropolitan Museum of Art',a.rights.sourceUrl,String(o.objectID),o._apiSource].map(quote).join(',')},${verified},${verified},'met-open-access-v1') on conflict(source_name,source_artwork_id) do update set source_url=excluded.source_url,metadata_source=excluded.metadata_source,last_synced_at=excluded.last_synced_at,data_verified_at=excluded.data_verified_at;`);
 sql.push(`insert into public.artwork_movements(artwork_id,movement_id) values(${quote(a.id)},${quote(uuid('met-category:'+a.movement))}) on conflict do nothing;`);
 for(const tag of a.tags) sql.push(`insert into public.artwork_tags(artwork_id,tag) values(${quote(a.id)},${quote(tag)}) on conflict do nothing;`);
}
const seedPath=path.join(root,'supabase/seed.sql');
const priorSeed=await readFile(seedPath,'utf8');
const seed=priorSeed.split('-- BEGIN GENERATED MET OPEN ACCESS CATALOG')[0].trimEnd();
const metEnd=priorSeed.indexOf('-- END GENERATED MET OPEN ACCESS CATALOG');
const followingMarker=metEnd>=0?priorSeed.indexOf('-- BEGIN GENERATED ',metEnd):-1;
const following=followingMarker>=0?priorSeed.slice(followingMarker):'';
await writeFile(path.join(buildRoot,'seed.sql'),seed+'\n\n'+sql.join('\n')+'\n-- END GENERATED MET OPEN ACCESS CATALOG\n'+(following?'\n'+following:''));
const manifest={schemaVersion:1,generatedAt:new Date().toISOString(),realArtworkCount:catalog.length,syntheticFixtureCount:12,totalArtworkCount:catalog.length+12,sourceCounts:{met:catalog.length},artistCount:artists.size,categoryCount:new Set(catalog.map(x=>x.movement)).size,categoryCounts:Object.fromEntries([...new Set(catalog.map(x=>x.movement))].map(category=>[category,catalog.filter(x=>x.movement===category).length])),mediumCounts:Object.fromEntries([...new Set(catalog.map(x=>x.medium))].map(medium=>[medium,catalog.filter(x=>x.medium===medium).length])),dateCounts:Object.fromEntries([...new Set(catalog.map(x=>x.year))].map(year=>[year,catalog.filter(x=>x.year===year).length])),preservedObjectIds:priorSource.map(x=>x.objectID),objectIds:source.map(x=>x.objectID),artworks:catalog.map((artwork,index)=>({id:artwork.id,source:'met',artistId:artwork.artist.id,...imageManifest[index]}))};
await writeFile(path.join(buildRoot,'catalog-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
await writeFile(path.join(buildRoot,'met-source-records.json'),JSON.stringify(source,null,2)+'\n');
// Validate everything before publication; replace files atomically with recovery copies.
// The final manifest is the release marker. A failed replacement rolls existing files back.
const recoveryRoot=path.join(buildRoot,'previous');
await mkdir(recoveryRoot,{recursive:true});
const publications=imageManifest.filter(image=>image.replaceExisting).map(image=>({
  staged:path.join(buildRoot,'images',`met-${image.objectId}.webp`),
  live:path.join(root,'public/artworks',`met-${image.objectId}.webp`)
}));
publications.push(
  {staged:path.join(buildRoot,'metArtworks.ts'),live:path.join(root,'lib/artworks/metArtworks.ts')},
  {staged:path.join(buildRoot,'seed.sql'),live:seedPath},
  {staged:path.join(buildRoot,'met-source-records.json'),live:sourcePath},
  {staged:path.join(buildRoot,'catalog-manifest.json'),live:path.join(root,'lib/artworks/data/met-catalog-manifest.json')}
);
for(let index=0;index<publications.length;index++) {
  const item=publications[index]; item.backup=path.join(recoveryRoot,String(index));
  try { await copyFile(item.live,item.backup); item.hadPrevious=true; }
  catch(error) { if(error.code!=='ENOENT') throw error; item.hadPrevious=false; }
}
const replaced=[];
try {
  for(const item of publications) { await rename(item.staged,item.live); replaced.push(item); }
} catch(error) {
  for(const item of replaced.reverse()) {
    if(item.hadPrevious) { await copyFile(item.backup,item.live+'.recovering'); await rename(item.live+'.recovering',item.live); }
    else { await rename(item.live,item.staged); }
  }
  throw error;
}
console.log(JSON.stringify({museumWorks:catalog.length,artists:artists.size,categories:[...new Set(catalog.map(x=>x.movement))],images:catalog.length},null,2));
