"""Small, testable safety boundaries shared by the offline Met import commands."""
from __future__ import annotations
import datetime, json, os, pathlib, tempfile, threading, time, urllib.error, urllib.parse, urllib.request
API = 'https://collectionapi.metmuseum.org/public/collection'
_REQUEST_LOCK = threading.Lock()
_NEXT_REQUEST_AT = 0.0

def throttle_request():
    global _NEXT_REQUEST_AT
    with _REQUEST_LOCK:
        now = time.monotonic(); delay = max(0, _NEXT_REQUEST_AT - now)
        _NEXT_REQUEST_AT = max(now, _NEXT_REQUEST_AT) + 1 / 6
    if delay: time.sleep(delay)


def atomic_json(path, value):
    path = pathlib.Path(path); path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=path.parent, prefix=path.name+'.', suffix='.tmp', delete=False) as handle:
        json.dump(value, handle, ensure_ascii=False, indent=2); handle.write('\n')
        handle.flush(); os.fsync(handle.fileno()); temporary = handle.name
    os.replace(temporary, path)


def valid_record(record):
    return isinstance(record, dict) and isinstance(record.get('objectID'), int) and record['objectID'] > 0 and record.get('isPublicDomain') is True and bool(str(record.get('artistDisplayName', '')).strip()) and bool(str(record.get('title', '')).strip()) and bool(record.get('primaryImage')) and urllib.parse.urlparse(record.get('objectURL', '')).hostname == 'www.metmuseum.org' and not str(record.get('rightsAndReproduction', '') or '').strip()


def fresh_snapshot(record, max_age_hours=168, now=None):
    if not isinstance(record, dict): return False
    try:
        verified = datetime.datetime.fromisoformat(record['_verifiedAt'])
        current = now or datetime.datetime.now(datetime.timezone.utc)
        age = (current - verified).total_seconds()
        return 0 <= age <= max_age_hours * 3600
    except (ValueError, KeyError, TypeError): return False


def fresh_record(record, max_age_hours=168, now=None):
    return valid_record(record) and fresh_snapshot(record,max_age_hours,now)

def request_json(url, attempts=4, opener=None, sleep=None):
    use_network_throttle = opener is None
    opener = opener or urllib.request.urlopen; sleep = sleep or time.sleep
    for attempt in range(attempts):
        try:
            if use_network_throttle: throttle_request()
            req = urllib.request.Request(url, headers={'User-Agent': 'ARTE-public-domain-catalog/2.0'})
            with opener(req, timeout=20) as response: return json.load(response)
        except (urllib.error.URLError, OSError, ValueError) as error:
            # Respect explicit access denials; retry only transient server/network failures.
            if isinstance(error, urllib.error.HTTPError) and error.code in (400, 401, 403, 404): raise
            if attempt + 1 == attempts: raise
            retry_after = getattr(error, 'headers', {}).get('Retry-After') if getattr(error, 'headers', None) else None
            delay = min(float(retry_after), 30) if retry_after and retry_after.isdigit() else min(0.5 * 2 ** attempt, 8)
            sleep(delay)


def select_records(existing, candidates, target):
    """Stable existing order/IDs is mandatory; deterministic new IDs follow it."""
    if target < len(existing): raise ValueError('Target cannot remove already published works')
    unique = {}
    for record in existing:
        if not valid_record(record): raise ValueError('Previously published record failed rights validation')
        if record['objectID'] in unique: raise ValueError('Duplicate published identity')
        unique[record['objectID']] = record
    for record in candidates:
        if valid_record(record) and record['objectID'] not in unique: unique[record['objectID']] = record
    if len(unique) < target: raise ValueError(f'Only {len(unique)} cleared records; {target} required. Published catalog preserved.')
    return list(unique.values())[:target]


def stage_records(path, existing, candidates, target):
    records = select_records(existing, candidates, target)
    atomic_json(path, records)
    return records
