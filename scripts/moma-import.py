#!/usr/bin/env python3
"""Archive twelve curated MoMA metadata records and independently licensed Commons images.
MoMA's CC0 dataset does NOT license its image URLs; those URLs are never fetched.
The pinned input files and cached original image hashes make this import reproducible.
"""
import hashlib
import json
import re
import urllib.parse
import urllib.request
import urllib.error
import time
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / '.cache/moma'
COMMIT = '3053da6addd4d210b955021f410430ac3bbf18d4'
DATA_SHA256 = '288d65589d7dadec509984c50f726454be4bbe00e68e61cf7d6116713a408807'
DATA_SIZE = 144917269
DATA_URL = f'https://media.githubusercontent.com/media/MuseumofModernArt/collection/{COMMIT}/Artworks.json'
SOURCE_URL = f'https://github.com/MuseumofModernArt/collection/tree/{COMMIT}'
MAX_IMAGE_BYTES = 40 * 1024 * 1024
HEADERS = {'User-Agent': 'ARTE-catalog/1.0 (curated public-domain artwork verification)'}


def download(url, maximum):
    # Respect server rate limits; never retry a denied/forbidden source.
    for attempt in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=HEADERS), timeout=90) as response:
                if int(response.headers.get('Content-Length', '0')) > maximum:
                    raise ValueError('Source exceeds download size limit')
                result = response.read(maximum + 1)
                if len(result) > maximum:
                    raise ValueError('Source exceeds download size limit')
                return result
        except urllib.error.HTTPError as error:
            if error.code != 429 or attempt == 2:
                raise
            retry = error.headers.get('Retry-After', '60')
            if not retry.isdigit() or int(retry) > 60:
                raise
            delay = max(10, int(retry))
            print(f'Commons rate limit: respecting {delay}-second retry delay', flush=True)
            time.sleep(delay)
    raise RuntimeError('Download retry limit reached')


def query_pages(titles):
    params = {'action': 'query', 'format': 'json', 'prop': 'imageinfo|revisions',
              'iiprop': 'url|extmetadata|sha1|size', 'rvprop': 'ids|timestamp|content',
              'rvslots': 'main', 'titles': '|'.join(titles)}
    url = 'https://commons.wikimedia.org/w/api.php?' + urllib.parse.urlencode(params)
    result = json.loads(download(url, 10 * 1024 * 1024))
    if 'error' in result:
        raise ValueError(result['error'])
    return url, {page['title']: page for page in result['query']['pages'].values()}


def validate_record(record):
    """Fail closed on missing rights, a different museum object, or unsupported media."""
    official = record['moma']
    evidence = record['_commonsEvidence']
    page = evidence['page']
    info = page['imageinfo'][0]
    metadata = info['extmetadata']
    wiki = page['revisions'][0]['slots']['main']['*']
    identity = record['_identityEvidence']
    assert record['id'] == official['ObjectID'] == identity['objectId']
    assert official['URL'] == f"https://www.moma.org/collection/works/{record['id']}"
    assert official['Classification'] == 'Painting' and official['Cataloged'] == 'Y'
    assert len(official['Artist']) == len(official['ConstituentID']) == 1
    assert all(0 < int(year) < 1926 for year in official['EndDate'])
    years = [int(year) for year in re.findall(r'\b(?:18|19)\d{2}\b', official['Date'])]
    assert years and max(years) < 1931
    assert page['title'] == identity['commonsTitle']
    assert identity['wikidata'] in wiki
    assert metadata['LicenseShortName']['value'] == 'Public domain'
    assert metadata['Copyrighted']['value'].lower() == 'false'
    assert not metadata.get('Restrictions', {}).get('value', '').strip()
    assert 'PD-Art' in wiki and 'PD-old-100-expired' in metadata['Categories']['value']
    assert 'Artworks digital representation of 2D work' in metadata['Categories']['value']
    assert 'Museum of Modern Art' in wiki or identity.get('supportingCommonsFile')
    assert info['size'] > 0 and info['size'] <= MAX_IMAGE_BYTES
    url = urllib.parse.urlparse(info['url'])
    assert url.scheme == 'https' and url.hostname == 'upload.wikimedia.org'
    assert url.path.startswith('/wikipedia/commons/') and not url.username
    assert record['_datasetSource']['commit'] == COMMIT
    assert record['_datasetSource']['dataSha256'] == DATA_SHA256
    if identity.get('supportingCommonsFile'):
        support = record['_identityEvidence']['supportingCommonsPage']
        support_wiki = support['revisions'][0]['slots']['main']['*']
        assert identity['wikidata'] in support_wiki
        assert f"Moma online|{record['id']}" in support_wiki
    return info


def main():
    CACHE.mkdir(parents=True, exist_ok=True)
    selection = json.loads((ROOT / 'scripts/moma-selection.json').read_text())
    assert len(selection) == len({item['objectId'] for item in selection}) == 12
    dataset_file = CACHE / 'Artworks.json'
    data = dataset_file.read_bytes() if dataset_file.exists() else b''
    if len(data) != DATA_SIZE or hashlib.sha256(data).hexdigest() != DATA_SHA256:
        data = download(DATA_URL, DATA_SIZE)
        assert len(data) == DATA_SIZE and hashlib.sha256(data).hexdigest() == DATA_SHA256
        temporary = CACHE / 'Artworks.verified.tmp'
        temporary.write_bytes(data)
        temporary.replace(dataset_file)
    assert len(data) == DATA_SIZE and hashlib.sha256(data).hexdigest() == DATA_SHA256
    records = {item['ObjectID']: item for item in json.loads(data)}
    # One metadata batch minimizes API load. Preserve the exact response for replay.
    metadata_file = CACHE / 'selected-commons-response.json'
    if metadata_file.exists():
        archived = json.loads(metadata_file.read_text())
        api_url, pages, verified_at = archived['apiUrl'], archived['pages'], archived['retrievedAt']
    else:
        titles = [item['commonsTitle'] for item in selection]
        titles += [item['supportingCommonsFile'] for item in selection if item.get('supportingCommonsFile')]
        api_url, pages = query_pages(titles)
        verified_at = datetime.now(timezone.utc).isoformat()
        metadata_file.write_text(json.dumps({'apiUrl': api_url, 'pages': pages, 'retrievedAt': verified_at}, ensure_ascii=False, indent=2) + '\n')
    snapshot = {'sourceUrl': SOURCE_URL, 'dataUrl': DATA_URL, 'commit': COMMIT,
                'dataSha256': DATA_SHA256, 'dataSizeBytes': DATA_SIZE,
                'metadataLicense': 'CC0 1.0 Universal',
                'imageLicenseNotice': 'MoMA metadata CC0 excludes images; images are independently sourced from Wikimedia Commons.'}
    output = []
    for selected in selection:
        object_id = selected['objectId']
        page = pages[selected['commonsTitle']]
        revision = page['revisions'][0]
        info = page['imageinfo'][0]
        identity = dict(selected)
        if selected.get('supportingCommonsFile'):
            identity['supportingCommonsPage'] = pages[selected['supportingCommonsFile']]
        per_file_api_url = 'https://commons.wikimedia.org/w/api.php?' + urllib.parse.urlencode({
            'action': 'query', 'format': 'json', 'prop': 'imageinfo|revisions',
            'iiprop': 'url|extmetadata|sha1|size', 'rvprop': 'ids|timestamp|content',
            'rvslots': 'main', 'titles': selected['commonsTitle']})
        evidence = {'apiUrl': per_file_api_url,
                    'retrievalNote': 'Retrieved in batched Commons API queries; this URL reproduces the individual file query.',
                    'page': page, 'pageId': page['pageid'],
                    'revisionId': revision['revid'], 'revisionTimestamp': revision['timestamp'],
                    'permanentUrl': f"https://commons.wikimedia.org/w/index.php?oldid={revision['revid']}",
                    'filePageUrl': info['descriptionurl'],
                    'requiredMetadataFields': {key: info['extmetadata'].get(key) for key in
                       ['LicenseShortName', 'Copyrighted', 'Artist', 'Attribution', 'Credit', 'LicenseUrl']},
                    'missingFieldNote': 'Null fields were not supplied by the Commons API; no license URL or attribution value has been invented.',
                    'publicDomainBasis': 'Commons labels this faithful 2D reproduction PD-Art and PD-old-100-expired. MoMA records creation before 1931 and artist death before 1926; original wikitext, categories, and artist dates are archived.',
                    'retrievedAt': verified_at}
        record = {'id': object_id, 'moma': records[object_id], '_datasetSource': snapshot,
                  '_commonsEvidence': evidence, '_identityEvidence': identity, '_verifiedAt': verified_at}
        validate_record(record)
        image_file = CACHE / f'{object_id}-original.jpg'
        if not image_file.exists():
            time.sleep(3)
            original_bytes = download(info['url'], MAX_IMAGE_BYTES)
            assert len(original_bytes) == info['size'] and hashlib.sha1(original_bytes).hexdigest() == info['sha1']
            temporary_image = image_file.with_suffix('.tmp')
            temporary_image.write_bytes(original_bytes)
            temporary_image.replace(image_file)
        original = image_file.read_bytes()
        assert len(original) == info['size'] and hashlib.sha1(original).hexdigest() == info['sha1']
        record['_imageEvidence'] = {'url': info['url'], 'sha1': info['sha1'],
                                   'sha256': hashlib.sha256(original).hexdigest(),
                                   'sizeBytes': len(original), 'width': info['width'], 'height': info['height']}
        output.append(record)
        print(f"Verified {object_id}: {record['moma']['Title']} ({len(original):,} original bytes)", flush=True)
    assert len({record['_imageEvidence']['sha256'] for record in output}) == 12
    (CACHE / 'ready-records.json').write_text(json.dumps(output, ensure_ascii=False, indent=2) + '\n')
    (CACHE / 'snapshot.json').write_text(json.dumps(snapshot, indent=2) + '\n')


if __name__ == '__main__':
    main()
