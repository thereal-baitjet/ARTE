/** Build a bounded, rights-gated NGA catalog from verified pinned CSV records.
 * Run python scripts/import-nga-catalog.py first. Images stay in ignored cache;
 * the application uses the museum's official IIIF JPEG service.
 */
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, copyFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const cache=path.join(root,'.cache/nga');
const stage=path.join(cache,'build');
const TARGET=Number(process.argv.find(argument=>argument.startsWith('--target='))?.split('=')[1]??299);
if(!Number.isInteger(TARGET)||TARGET<1)throw Error('Target must be a positive integer');
await mkdir(stage,{recursive:true});
const candidates=JSON.parse(await readFile(path.join(cache,'ready-records.json'),'utf8'));
const dataset=JSON.parse(await readFile(path.join(cache,'snapshot.json'),'utf8'));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const uuid=value=>{const h=hash(value);return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20,32)}`;};
const slug=value=>String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const text=value=>String(value??'').trim();
const quote=value=>"'"+String(value).replace(/\r\n?/g,'\n').split('\n').map(line=>line.trimEnd()).join('\n').replaceAll("'","''")+"'";
const seenRaw=new Set(),seenNormalized=new Set(),seenIds=new Set();
const checkedProviders=[];
for(const provider of ['met','cleveland','moma']){
 let manifest,sources;
 try{
  manifest=JSON.parse(await readFile(path.join(root,`lib/artworks/data/${provider}-catalog-manifest.json`),'utf8'));
  sources=JSON.parse(await readFile(path.join(root,`lib/artworks/data/${provider}-source-records.json`),'utf8'));
 }catch(error){if(error.code==='ENOENT'&&provider==='moma')continue;throw error;}
 for(const image of manifest.artworks){seenRaw.add(image.imageSha256);seenNormalized.add(image.normalizedImageSha256??image.imageSha256);}
 for(const record of sources){if(record._imageEvidence?.sha256)seenRaw.add(record._imageEvidence.sha256);}
 checkedProviders.push(provider);
}
for(const [filename,evidence] of Object.entries(dataset.files)){
 const bytes=await readFile(path.join(cache,filename));
 if(bytes.length!==evidence.sizeBytes||hash(bytes)!==evidence.sha256)throw Error(`Pinned file checksum mismatch: ${filename}`);
}

const catalog=[],records=[],images=[],skipped=[];
const artistCounts=new Map();
const museum={name:'National Gallery of Art',city:'Washington, DC',country:'United States',url:'https://www.nga.gov/'};
const museumId=uuid('nga-museum');
const license='Public domain (NGA Open Access)';
for(const record of candidates){
 if(catalog.length===TARGET)break;
 const o=record.object,i=record.image;
 if(!Number.isInteger(record.id)||record.id<=0||String(record.id)!==o.objectid||o.objectid!==i.depictstmsobjectid||o.accessioned!=='1'||o.isvirtual!=='0')throw Error(`Object join/accession gate failed: ${record.id}`);
 if(i.openaccess!=='1'||i.viewtype!=='primary')throw Error(`Image rights gate failed: ${record.id}`);
 if(!/^https:\/\/api\.nga\.gov\/iiif\/[a-f0-9-]{36}$/.test(i.iiifurl)||i.iiifurl.split('/').at(-1)!==i.uuid)throw Error(`Image source gate failed: ${record.id}`);
 if(record.sourceUrl!==`https://www.nga.gov/collection/art-object-page.${record.id}.html`)throw Error(`Object URL gate failed: ${record.id}`);
 const imageUrl=i.iiifurl+'/full/!843,843/0/default.jpg';
 if(record._imageEvidence.url!==imageUrl||record._datasetSource.commit!==dataset.commit||JSON.stringify(record._datasetSource.files)!==JSON.stringify(dataset.files))throw Error(`Source evidence mismatch: ${record.id}`);
 if(!Number.isFinite(Date.parse(record._verifiedAt)))throw Error(`Invalid verification date: ${record.id}`);
 if(seenIds.has(record.id)){skipped.push({objectId:record.id,reason:'duplicate-object'});continue;}
 if((artistCounts.get(o.attribution)||0)>=3){skipped.push({objectId:record.id,reason:'creator-cap'});continue;}
 const raw=await readFile(path.join(cache,`images/${record.id}.jpg`));
 const imageSha256=hash(raw);
 if(imageSha256!==record._imageEvidence.sha256||raw.length!==record._imageEvidence.sizeBytes)throw Error(`Downloaded image evidence mismatch: ${record.id}`);
 if(seenRaw.has(imageSha256)){skipped.push({objectId:record.id,reason:'duplicate-source-image'});continue;}
 let dimensions,normalized;
 try{
  dimensions=await sharp(raw).metadata();
  if(dimensions.format!=='jpeg'||!dimensions.width||!dimensions.height||dimensions.width>843||dimensions.height>843)throw Error('Expected bounded JPEG dimensions');
  normalized=await sharp(raw).rotate().resize({width:1280,height:1600,fit:'inside',withoutEnlargement:true}).webp({quality:82}).toBuffer();
 }catch{skipped.push({objectId:record.id,reason:'image-decode-failed'});continue;}
 const normalizedImageSha256=hash(normalized);
 if(seenNormalized.has(normalizedImageSha256)){skipped.push({objectId:record.id,reason:'duplicate-normalized-image'});continue;}
 const {width,height}=dimensions;
 record._imageEvidence={...record._imageEvidence,width,height,format:'jpeg',normalizedSha256:normalizedImageSha256};
 seenRaw.add(imageSha256);seenNormalized.add(normalizedImageSha256);seenIds.add(record.id);artistCounts.set(o.attribution,(artistCounts.get(o.attribution)||0)+1);
 const artistId=uuid(`nga-artist:${o.attribution}`);
 const artist={id:artistId,slug:`${slug(o.attribution).slice(0,100)}-nga-${artistId.slice(0,8)}`,name:o.attribution,nationality:text(record.artistInfo?.nationality)||'Not supplied by the museum',biography:[`Museum attribution: ${o.attribution}.`,record.artistInfo?.displaydate?`${record.artistInfo.displaydate}.`:''].filter(Boolean).join(' ')};
 const category=text(o.classification)||'Museum collection',date=text(o.displaydate)||'Date not supplied',medium=text(o.medium)||'Medium not supplied';
 const tags=[...new Set([category,o.subclassification,o.departmentabbr,record.artistInfo?.nationality].map(text).filter(Boolean).map(value=>value.toLowerCase()))];
 const orientation=width/height>1.12?'landscape':height/width>1.12?'portrait':'square';
 const artwork={id:uuid(`nga-artwork:${record.id}`),slug:`${slug(o.title).slice(0,85)||'untitled'}-nga-${record.id}`,title:o.title,year:date,medium,dimensions:text(o.dimensions)||'Dimensions not supplied',description:[`${o.title} (${date}).`,`${o.attribution}.`,`${medium}.`,`Collection: ${museum.name}.`,o.creditline?`Credit: ${o.creditline}.`:''].filter(Boolean).join(' '),movement:category,tags,features:{palette:[],mood:[],composition:[],subjects:[],mediumCategory:category.toLowerCase(),period:date,geography:text(record.artistInfo?.nationality)||'Not supplied'},artist,visual:{kind:'image',aspect:orientation,aspectRatio:`${width} / ${height}`,background:'#ede8df',alt:`${o.title}, ${o.attribution}, ${date}. ${medium}. Courtesy National Gallery of Art, Washington.`,src:imageUrl,width,height},recommendationReason:`Explore ${category.toLowerCase()} from National Gallery of Art’s Open Access collection. Connections use museum catalog metadata.`,isDemo:false,museum,rights:{imageSource:'National Gallery of Art Open Access',rightsHolder:'Public domain; image provided by National Gallery of Art',license,usageNotes:`The museum’s published image record marks this primary image openaccess=1. Verified against official GitHub snapshot ${dataset.commit} on ${record._verifiedAt.slice(0,10)}. ${o.creditline||''} Courtesy National Gallery of Art, Washington. Image delivered from the official NGA IIIF service with original proportions preserved. Image clearance follows the NGA Open Access policy; metadata CC0 is recorded separately. Attribution does not imply museum endorsement or availability for sale.`,sourceUrl:record.sourceUrl}};
 catalog.push(artwork);records.push(record);images.push({id:artwork.id,source:'nga',objectId:record.id,artistId,imagePath:imageUrl,imageSha256,normalizedImageSha256,delivery:'remote',sizeBytes:raw.length,width,height,verifiedAt:record._verifiedAt,sourceUrl:record.sourceUrl,imageSourceUrl:imageUrl,rightsState:'public_domain',license,sourceName:museum.name,museumSlug:'national-gallery-of-art'});
}
if(catalog.length!==TARGET||new Set(catalog.map(artwork=>artwork.id)).size!==TARGET)throw Error(`Expected ${TARGET} distinct works; got ${catalog.length}`);
const counts=field=>Object.fromEntries([...new Set(catalog.map(artwork=>artwork[field]))].map(value=>[value,catalog.filter(artwork=>artwork[field]===value).length]));
const artists=new Map(catalog.map(artwork=>[artwork.artist.id,artwork]));
const manifest={schemaVersion:1,generatedAt:new Date().toISOString(),realArtworkCount:catalog.length,syntheticFixtureCount:0,totalArtworkCount:catalog.length,sourceCounts:{nga:catalog.length},artistCount:artists.size,categoryCount:new Set(catalog.map(artwork=>artwork.movement)).size,categoryCounts:counts('movement'),mediumCounts:counts('medium'),dateCounts:counts('year'),preservedObjectIds:[],objectIds:records.map(record=>record.id),dataset,checkedProviders,skipped,artworks:images};
const sql=[`-- BEGIN GENERATED NGA OPEN ACCESS CATALOG`,`-- Verified official GitHub dataset snapshot ${dataset.commit}; primary images with openaccess=1 only.`,`insert into public.museums(id,slug,name,city,country,source_url) values(${quote(museumId)},'national-gallery-of-art',${quote(museum.name)},${quote(museum.city)},'United States',${quote(museum.url)}) on conflict(id) do update set slug=excluded.slug,name=excluded.name,source_url=excluded.source_url;`];
for(const {artist,rights} of artists.values())sql.push(`insert into public.artists(id,slug,name,biography,nationality,biography_source_url) values(${[artist.id,artist.slug,artist.name,artist.biography,artist.nationality,rights.sourceUrl].map(quote).join(',')}) on conflict(id) do update set slug=excluded.slug,name=excluded.name,biography=excluded.biography,nationality=excluded.nationality,biography_source_url=excluded.biography_source_url;`);
for(const category of new Set(catalog.map(artwork=>artwork.movement)))sql.push(`insert into public.art_movements(id,name,slug) values(${quote(uuid('nga-category:'+category))},${quote(category)},${quote('nga-'+slug(category))}) on conflict(name) do nothing;`);
for(let index=0;index<catalog.length;index++){
 const a=catalog[index],o=records[index],verified=quote(o._verifiedAt);
 sql.push(`insert into public.artworks(id,artist_id,museum_id,slug,title,year_display,medium,dimensions,description,source_name,source_url,source_artwork_id,metadata_source,image_source,image_creator,image_rights_state,image_license,commercial_usage_allowed,is_published,is_synthetic,data_verified_at,last_synced_at,source_adapter_version) values(${[a.id,a.artist.id,museumId,a.slug,a.title,a.year,a.medium,a.dimensions,a.description,museum.name,a.rights.sourceUrl,String(o.id),dataset.sourceUrl,a.rights.imageSource,museum.name,'public_domain',a.rights.license].map(quote).join(',')},true,true,false,${verified},${verified},'nga-open-access-v1') on conflict(id) do update set artist_id=excluded.artist_id,museum_id=excluded.museum_id,slug=excluded.slug,title=excluded.title,year_display=excluded.year_display,medium=excluded.medium,dimensions=excluded.dimensions,description=excluded.description,source_name=excluded.source_name,source_url=excluded.source_url,source_artwork_id=excluded.source_artwork_id,metadata_source=excluded.metadata_source,image_source=excluded.image_source,image_creator=excluded.image_creator,image_rights_state=excluded.image_rights_state,image_license=excluded.image_license,commercial_usage_allowed=excluded.commercial_usage_allowed,is_published=excluded.is_published,is_synthetic=excluded.is_synthetic,data_verified_at=excluded.data_verified_at,last_synced_at=excluded.last_synced_at,source_adapter_version=excluded.source_adapter_version;`);
 sql.push(`insert into public.artwork_images(id,artwork_id,url,width,height,alt_text,image_source,rights_holder,license,usage_notes,source_url,commercial_usage_allowed) values(${quote(uuid('nga-image:'+o.id))},${quote(a.id)},${quote(a.visual.src)},${a.visual.width},${a.visual.height},${[a.visual.alt,a.rights.imageSource,a.rights.rightsHolder,a.rights.license,a.rights.usageNotes,a.rights.sourceUrl].map(quote).join(',')},true) on conflict(id) do update set url=excluded.url,width=excluded.width,height=excluded.height,alt_text=excluded.alt_text,image_source=excluded.image_source,rights_holder=excluded.rights_holder,license=excluded.license,usage_notes=excluded.usage_notes,source_url=excluded.source_url;`);
 sql.push(`insert into public.artwork_sources(id,artwork_id,source_name,source_url,source_artwork_id,metadata_source,last_synced_at,data_verified_at,source_adapter_version) values(${[uuid('nga-source:'+o.id),a.id,museum.name,a.rights.sourceUrl,String(o.id),dataset.sourceUrl].map(quote).join(',')},${verified},${verified},'nga-open-access-v1') on conflict(source_name,source_artwork_id) do update set source_url=excluded.source_url,metadata_source=excluded.metadata_source,last_synced_at=excluded.last_synced_at,data_verified_at=excluded.data_verified_at;`);
 sql.push(`insert into public.artwork_movements(artwork_id,movement_id) select ${quote(a.id)},id from public.art_movements where name=${quote(a.movement)} on conflict do nothing;`);
 for(const tag of a.tags)sql.push(`insert into public.artwork_tags(artwork_id,tag) values(${quote(a.id)},${quote(tag)}) on conflict do nothing;`);
}
sql.push('-- END GENERATED NGA OPEN ACCESS CATALOG');
await writeFile(path.join(stage,'ngaArtworks.ts'),`// Generated from the official National Gallery of Art Open Data snapshot.\nimport type { Artwork } from './types.ts';\n\nexport const NGA_ARTWORKS: Artwork[] = ${JSON.stringify(catalog,null,2)};\n`);
await writeFile(path.join(stage,'nga-source-records.json'),JSON.stringify(records,null,2)+'\n');
await writeFile(path.join(stage,'nga-catalog-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
await writeFile(path.join(stage,'nga-seed.sql'),sql.join('\n')+'\n');
for(const [file,destination] of [
 ['nga-source-records.json','lib/artworks/data/nga-source-records.json'],
 ['nga-seed.sql','supabase/nga-seed.sql'],
 ['ngaArtworks.ts','lib/artworks/ngaArtworks.ts'],
 ['nga-catalog-manifest.json','lib/artworks/data/nga-catalog-manifest.json'],
]){const target=path.join(root,destination);await copyFile(path.join(stage,file),target+'.tmp');await rename(target+'.tmp',target);}
console.log(JSON.stringify({works:catalog.length,artistIdentities:artists.size,categories:manifest.categoryCounts,delivery:'remote',imageBytes:images.reduce((sum,image)=>sum+image.sizeBytes,0),checkedProviders,skipped,manifest:'lib/artworks/data/nga-catalog-manifest.json',seed:'supabase/nga-seed.sql'},null,2));
