/** Build a curated MoMA subset; museum metadata and Commons image rights remain separate. */
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, copyFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { validateMomaRecord } from './moma-validate.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cache = path.join(root, '.cache/moma');
const stage = path.join(cache, 'build');
await mkdir(path.join(stage, 'images'), { recursive: true });
const records = JSON.parse(await readFile(path.join(cache, 'ready-records.json'), 'utf8'));
if (records.length !== 12) throw Error('Exactly 12 curated records are required');
const dataset = JSON.parse(await readFile(path.join(cache, 'snapshot.json'), 'utf8'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const uuid = value => { const h = hash(value); return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20,32)}`; };
const slug = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const plain = value => String(value ?? '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
const quote = value => "'" + String(value).replaceAll("'", "''") + "'";
const museum = { name: 'The Museum of Modern Art', city: 'New York', country: 'United States', url: 'https://www.moma.org/' };
const museumId = uuid('moma-museum');
const catalog = [], images = [];
const hashes = new Set(), originals = new Set(), identities = new Set();
for (const record of records) {
  const { official: o, metadata } = validateMomaRecord(record);
  if (identities.has(record.id)) throw Error('Duplicate MoMA object identity');
  identities.add(record.id);
  const raw = await readFile(path.join(cache, `${record.id}-original.jpg`));
  if (hash(raw) !== record._imageEvidence.sha256 || createHash('sha1').update(raw).digest('hex') !== record._imageEvidence.sha1 || raw.length !== record._imageEvidence.sizeBytes) throw Error(`Original image hash mismatch: ${record.id}`);
  if (originals.has(hash(raw))) throw Error('Duplicate original image');
  originals.add(hash(raw));
  const imagePath = `/artworks/moma-${record.id}.webp`;
  const destination = path.join(stage, 'images', path.basename(imagePath));
  const { width, height } = await sharp(raw).rotate().resize({ width: 1280, height: 1600, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toFile(destination);
  const bytes = await readFile(destination);
  if (!width || !height || width > 1280 || height > 1600 || hashes.has(hash(bytes))) throw Error('Invalid or duplicate optimized image');
  hashes.add(hash(bytes));
  const artist = { id: uuid(`moma-artist:${o.ConstituentID[0]}`), slug: `${slug(o.Artist[0])}-moma-${o.ConstituentID[0]}`, name: o.Artist[0], nationality: o.Nationality[0] || 'Not supplied', biography: o.ArtistBio[0] || 'Biography not supplied by MoMA.' };
  const credit = plain(metadata.Credit?.value) || 'Reproduction source not supplied by Commons';
  const rights = { imageSource: 'Wikimedia Commons', rightsHolder: `Public domain artwork by ${artist.name}; faithful 2D reproduction identified by Wikimedia Commons`, license: 'Public domain', usageNotes: `Image: ${record._commonsEvidence.filePageUrl}. Reproduction credit as recorded by Commons: ${credit}. Commons PD-Art and PD-old-100-expired evidence archived at ${record._commonsEvidence.permanentUrl}. Metadata: The Museum of Modern Art, CC0 dataset ${dataset.commit}; its metadata license does not license museum images. Museum credit: ${o.CreditLine}. Local WebP derivative resized without cropping. No museum endorsement or availability for sale is implied.`, sourceUrl: o.URL, imageSourceUrl: record._commonsEvidence.permanentUrl };
  const artwork = { id: uuid(`moma-artwork:${record.id}`), slug: `${slug(o.Title).slice(0,85)}-moma-${record.id}`, title: o.Title, year: o.Date, medium: o.Medium, dimensions: o.Dimensions, description: `${o.Title} (${o.Date}). ${artist.name}. ${o.Medium}. Collection: ${museum.name}. Credit: ${o.CreditLine}.`, movement: o.Classification, tags: [o.Classification.toLowerCase(), o.Department.toLowerCase(), artist.nationality.toLowerCase()], features: { palette: [], mood: [], composition: [], subjects: [], mediumCategory: o.Classification.toLowerCase(), period: o.Date, geography: 'Not supplied' }, artist, visual: { kind: 'image', aspect: width/height > 1.12 ? 'landscape' : height/width > 1.12 ? 'portrait' : 'square', aspectRatio: `${width} / ${height}`, background: '#ede8df', alt: `${o.Title}, ${artist.name}, ${o.Date}. ${o.Medium}. Public-domain reproduction from Wikimedia Commons; collection of The Museum of Modern Art.`, src: imagePath, width, height }, recommendationReason: 'Explore paintings in The Museum of Modern Art collection. Connections use museum catalog metadata.', isDemo: false, museum, rights };
  catalog.push(artwork);
  images.push({ id: artwork.id, source: 'moma', objectId: record.id, artistId: artist.id, imagePath, imageSha256: hash(bytes), sizeBytes: bytes.length, width, height, verifiedAt: record._verifiedAt, sourceUrl: o.URL, imageSourceUrl: record._imageEvidence.url, rightsState: 'public_domain', license: 'Public domain', sourceName: museum.name, museumSlug: 'the-museum-of-modern-art' });
}
const counts = field => Object.fromEntries([...new Set(catalog.map(artwork => artwork[field]))].map(value => [value, catalog.filter(artwork => artwork[field] === value).length]));
const artists = new Map(catalog.map(artwork => [artwork.artist.id, artwork]));
const manifest = { schemaVersion: 1, generatedAt: records.map(record => record._verifiedAt).sort().at(-1), realArtworkCount: 12, syntheticFixtureCount: 0, totalArtworkCount: 12, sourceCounts: { moma: 12 }, artistCount: artists.size, categoryCount: 1, categoryCounts: counts('movement'), mediumCounts: counts('medium'), dateCounts: counts('year'), preservedObjectIds: [], objectIds: records.map(record => record.id), dataset, artworks: images };
const sql = ['-- BEGIN GENERATED MOMA CURATED PUBLIC-DOMAIN CATALOG', '-- Official MoMA CC0 metadata; separately documented Wikimedia Commons public-domain reproductions.', `insert into public.museums(id,slug,name,city,country,source_url) values(${quote(museumId)},'the-museum-of-modern-art',${quote(museum.name)},'New York','United States',${quote(museum.url)}) on conflict(id) do update set slug=excluded.slug,name=excluded.name,source_url=excluded.source_url;`];
for (const { artist, rights } of artists.values()) sql.push(`insert into public.artists(id,slug,name,biography,nationality,biography_source_url) values(${[artist.id,artist.slug,artist.name,artist.biography,artist.nationality,rights.sourceUrl].map(quote).join(',')}) on conflict(id) do update set slug=excluded.slug,name=excluded.name,biography=excluded.biography,nationality=excluded.nationality,biography_source_url=excluded.biography_source_url;`);
sql.push(`insert into public.art_movements(id,name,slug) values(${quote(uuid('moma-category:Painting'))},'Painting','moma-painting') on conflict(name) do nothing;`);
for (let index = 0; index < catalog.length; index++) {
  const a = catalog[index], r = records[index], verified = quote(r._verifiedAt);
  const imageCreator = plain(r._commonsEvidence.page.imageinfo[0].extmetadata.Credit?.value) || 'Not supplied by Commons';
  sql.push(`insert into public.artworks(id,artist_id,museum_id,slug,title,year_display,medium,dimensions,description,source_name,source_url,source_artwork_id,metadata_source,image_source,image_creator,image_rights_state,image_license,commercial_usage_allowed,is_published,is_synthetic,data_verified_at,last_synced_at,source_adapter_version) values(${[a.id,a.artist.id,museumId,a.slug,a.title,a.year,a.medium,a.dimensions,a.description,museum.name,a.rights.sourceUrl,String(r.id),dataset.sourceUrl,a.rights.imageSource,imageCreator,'public_domain',a.rights.license].map(quote).join(',')},true,true,false,${verified},${verified},'moma-commons-curated-v1') on conflict(id) do update set artist_id=excluded.artist_id,museum_id=excluded.museum_id,slug=excluded.slug,title=excluded.title,year_display=excluded.year_display,medium=excluded.medium,dimensions=excluded.dimensions,description=excluded.description,source_name=excluded.source_name,source_url=excluded.source_url,source_artwork_id=excluded.source_artwork_id,metadata_source=excluded.metadata_source,image_source=excluded.image_source,image_creator=excluded.image_creator,image_rights_state=excluded.image_rights_state,image_license=excluded.image_license,commercial_usage_allowed=excluded.commercial_usage_allowed,is_published=excluded.is_published,is_synthetic=excluded.is_synthetic,data_verified_at=excluded.data_verified_at,last_synced_at=excluded.last_synced_at,source_adapter_version=excluded.source_adapter_version;`);
  sql.push(`insert into public.artwork_images(id,artwork_id,url,width,height,alt_text,image_source,rights_holder,license,usage_notes,source_url,commercial_usage_allowed) values(${quote(uuid('moma-image:'+r.id))},${quote(a.id)},${quote(a.visual.src)},${a.visual.width},${a.visual.height},${[a.visual.alt,a.rights.imageSource,a.rights.rightsHolder,a.rights.license,a.rights.usageNotes,a.rights.sourceUrl].map(quote).join(',')},true) on conflict(id) do update set url=excluded.url,width=excluded.width,height=excluded.height,alt_text=excluded.alt_text,image_source=excluded.image_source,rights_holder=excluded.rights_holder,license=excluded.license,usage_notes=excluded.usage_notes,source_url=excluded.source_url;`);
  sql.push(`insert into public.artwork_sources(id,artwork_id,source_name,source_url,source_artwork_id,metadata_source,last_synced_at,data_verified_at,source_adapter_version) values(${[uuid('moma-source:'+r.id),a.id,museum.name,a.rights.sourceUrl,String(r.id),dataset.sourceUrl].map(quote).join(',')},${verified},${verified},'moma-commons-curated-v1') on conflict(source_name,source_artwork_id) do update set source_url=excluded.source_url,metadata_source=excluded.metadata_source,last_synced_at=excluded.last_synced_at,data_verified_at=excluded.data_verified_at;`);
  sql.push(`insert into public.artwork_movements(artwork_id,movement_id) select ${quote(a.id)},id from public.art_movements where name=${quote(a.movement)} on conflict do nothing;`);
  for (const tag of a.tags) sql.push(`insert into public.artwork_tags(artwork_id,tag) values(${quote(a.id)},${quote(tag)}) on conflict do nothing;`);
}
sql.push('-- END GENERATED MOMA CURATED PUBLIC-DOMAIN CATALOG');
await writeFile(path.join(stage, 'momaArtworks.ts'), `// Official MoMA metadata; independently sourced public-domain Commons images.\nimport type { Artwork } from './types.ts';\n\nexport const MOMA_ARTWORKS: Artwork[] = ${JSON.stringify(catalog, null, 2)};\n`);
await writeFile(path.join(stage, 'moma-source-records.json'), JSON.stringify(records, null, 2) + '\n');
await writeFile(path.join(stage, 'moma-catalog-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
await writeFile(path.join(stage, 'moma-seed.sql'), sql.join('\n') + '\n');
for (const image of images) await copyFile(path.join(stage, 'images', path.basename(image.imagePath)), path.join(root, 'public', image.imagePath));
for (const [file, destination] of [['momaArtworks.ts','lib/artworks/momaArtworks.ts'],['moma-source-records.json','lib/artworks/data/moma-source-records.json'],['moma-seed.sql','supabase/moma-seed.sql'],['moma-catalog-manifest.json','lib/artworks/data/moma-catalog-manifest.json']]) {
  const target = path.join(root, destination); await copyFile(path.join(stage, file), target + '.tmp'); await rename(target + '.tmp', target);
}
console.log(JSON.stringify({ works: catalog.length, artists: artists.size, imageBytes: images.reduce((sum,image) => sum+image.sizeBytes,0), manifest: 'lib/artworks/data/moma-catalog-manifest.json' }));
