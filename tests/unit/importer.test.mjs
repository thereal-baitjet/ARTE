import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const scripts = fileURLToPath(new URL("../../scripts/", import.meta.url));

// Exercise the real Python boundaries with in-memory HTTP responses and isolated
// temporary directories. No request may reach the network or the live catalog.
function pythonCheck(body) {
  const setup = `
import copy, datetime, importlib.util, io, json, pathlib, sys, tempfile, urllib.error
from unittest import mock
sys.path.insert(0, sys.argv[1])
import met_import_common as common
common.urllib.request.urlopen = mock.Mock(side_effect=AssertionError('Unexpected network request in offline import test'))
NOW = datetime.datetime(2026, 9, 27, 12, tzinfo=datetime.timezone.utc)
def record(identity, **changes):
    value = {
        'objectID': identity, 'title': 'Artwork ' + str(identity),
        'artistDisplayName': 'Fixture artist', 'isPublicDomain': True,
        'primaryImage': 'https://images.metmuseum.org/fixture.jpg',
        'objectURL': 'https://www.metmuseum.org/art/collection/search/' + str(identity),
        'rightsAndReproduction': '', '_verifiedAt': NOW.isoformat(),
    }
    value.update(changes)
    return value

def load_script(name):
    spec = importlib.util.spec_from_file_location(name.replace('-', '_'), pathlib.Path(sys.argv[1]) / (name + '.py'))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

def fixture_root(directory, published):
    root = pathlib.Path(directory)
    live = root / 'lib/artworks/data/met-source-records.json'
    common.atomic_json(live, published)
    cache = root / '.met-import-cache'
    cache.mkdir(exist_ok=True)
    return root, live, cache
`;
  let output;
  try {
    output = execFileSync("python3", ["-B", "-c", `${setup}\n${body}`, scripts], {
      encoding: "utf8",
      timeout: 15_000,
      // A missing mock must fail immediately rather than making a network call.
      env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    assert.fail(`Offline import check failed:\n${error.stderr?.toString() ?? error.message}`);
  }
  return output;
}

test("Met cache freshness rejects expired, invalid, future and rights-revoked records", () => {
  pythonCheck(`
fresh = record(1, _verifiedAt=(NOW - datetime.timedelta(hours=167)).isoformat())
original = copy.deepcopy(fresh)
assert common.fresh_record(fresh, now=NOW)
assert fresh == original, 'Reading a cache must not refresh its verification timestamp'
assert common.fresh_record(record(1, _verifiedAt=(NOW - datetime.timedelta(hours=168)).isoformat()), now=NOW)
for stale in [
    record(1, _verifiedAt=(NOW - datetime.timedelta(hours=168, seconds=1)).isoformat()),
    record(1, _verifiedAt=(NOW + datetime.timedelta(seconds=1)).isoformat()),
    record(1, _verifiedAt='not-a-timestamp'),
    record(1, _verifiedAt='2026-09-27T12:00:00'),
    record(1, _verifiedAt=None),
    record(1, isPublicDomain=False),
    record(1, rightsAndReproduction='Permission required'),
    record(1, objectURL='https://www.metmuseum.org.example.com/object/1'),
    record(1, artistDisplayName=' '),
    record(1, primaryImage=''),
]:
    assert not common.fresh_record(stale, now=NOW), stale
without_verification = record(1)
del without_verification['_verifiedAt']
assert not common.fresh_record(without_verification, now=NOW)
`);
});

test("Met requests retry transient failures with capped Retry-After and exponential backoff", () => {
  pythonCheck(`
url = common.API + '/v1/objects/1'
calls, delays = [], []
failures = [
    urllib.error.URLError('temporary connection failure'),
    urllib.error.HTTPError(url, 429, 'rate limited', {'Retry-After': '120'}, None),
    ValueError('temporary invalid JSON'),
]
def opener(request, timeout):
    calls.append((request.full_url, timeout))
    if len(calls) <= len(failures):
        raise failures[len(calls) - 1]
    return io.BytesIO(b'{"objectID": 1}')
assert common.request_json(url, opener=opener, sleep=delays.append) == {'objectID': 1}
assert calls == [(url, 20)] * 4
assert delays == [0.5, 30, 2], delays
`);
});

test("Met requests stop at their retry bound and propagate the last failure", () => {
  pythonCheck(`
url = common.API + '/v1/objects/1'
calls, delays = [], []
failure = urllib.error.URLError('offline fixture')
def opener(request, timeout):
    calls.append(request.full_url)
    raise failure
try:
    common.request_json(url, attempts=3, opener=opener, sleep=delays.append)
except urllib.error.URLError as error:
    assert error is failure
else:
    raise AssertionError('Exhausted retries must not return a success result')
assert len(calls) == 3
assert delays == [0.5, 1]
`);
});

test("Failed Met count and rights gates preserve prior live and staged bytes", () => {
  pythonCheck(`
with tempfile.TemporaryDirectory() as directory:
    root, live, cache = fixture_root(directory, [record(41)])
    stage = cache / 'candidate-records.json'
    stage.write_bytes(b'previous candidate snapshot\\n')
    expected_live, expected_stage = live.read_bytes(), stage.read_bytes()
    try:
        common.stage_records(stage, [record(41)], [record(2, isPublicDomain=False), record(3)], 3)
    except ValueError:
        pass
    else:
        raise AssertionError('Insufficient cleared records must fail before replacing a stage')
    assert live.read_bytes() == expected_live
    assert stage.read_bytes() == expected_stage
    missing_stage = cache / 'new-candidate-records.json'
    try:
        common.stage_records(missing_stage, [record(41, rightsAndReproduction='Restricted')], [record(3)], 2)
    except ValueError:
        pass
    else:
        raise AssertionError('Previously published rights violations must stop the import')
    assert not missing_stage.exists()
    assert live.read_bytes() == expected_live
    assert not list(cache.glob('*.tmp'))
`);
});

test("Met selection preserves published identities and order while deduplicating candidates", () => {
  pythonCheck(`
existing = [record(41, title='Published title'), record(7)]
candidates = [record(7, title='Duplicate'), record(9), record(8), record(9), record(6, isPublicDomain=False)]
original = copy.deepcopy((existing, candidates))
first = common.select_records(existing, candidates, 4)
second = common.select_records(copy.deepcopy(existing), copy.deepcopy(candidates), 4)
assert first == second
assert [item['objectID'] for item in first] == [41, 7, 9, 8]
assert first[:len(existing)] == existing
assert (existing, candidates) == original
for prior, target in [(existing, 1), ([record(41), record(41)], 3)]:
    try:
        common.select_records(prior, candidates, target)
    except ValueError:
        pass
    else:
        raise AssertionError('Dropping or duplicating a published identity must fail')
with tempfile.TemporaryDirectory() as directory:
    root, live, cache = fixture_root(directory, existing)
    before = live.read_bytes()
    selected = common.stage_records(cache / 'candidate-records.json', existing, candidates, 4)
    assert json.loads((cache / 'candidate-records.json').read_text()) == selected == first
    assert live.read_bytes() == before
    assert not list(cache.glob('*.tmp'))
`);
});

test("Met collector re-fetches expired object metadata before staging without publishing", () => {
  pythonCheck(`
collector = load_script('collect-met-catalog')
expired = record(41, _verifiedAt='2000-01-01T00:00:00+00:00')
with tempfile.TemporaryDirectory() as directory:
    root, live, cache = fixture_root(directory, [expired])
    common.atomic_json(cache / 'objects/41.json', expired)
    before = live.read_bytes()
    updated = record(41, title='Fresh museum metadata')
    with mock.patch.object(collector, 'QUERIES', []), mock.patch.object(collector, 'request_json', return_value=updated) as request:
        collector.main(['--root', str(root), '--target', '1', '--workers', '1'])
    request.assert_called_once_with(common.API + '/v1/objects/41')
    staged = json.loads((cache / 'candidate-records.json').read_text())
    assert staged[0]['objectID'] == 41
    assert staged[0]['title'] == 'Fresh museum metadata'
    assert staged[0]['_verifiedAt'] != expired['_verifiedAt']
    assert common.fresh_record(staged[0])
    assert live.read_bytes() == before
`);
});

test("Met collector blocks a revoked cached work without replacing a prior candidate snapshot", () => {
  pythonCheck(`
collector = load_script('collect-met-catalog')
expired = record(41, _verifiedAt='2000-01-01T00:00:00+00:00')
with tempfile.TemporaryDirectory() as directory:
    root, live, cache = fixture_root(directory, [expired])
    common.atomic_json(cache / 'objects/41.json', expired)
    stage = cache / 'candidate-records.json'
    stage.write_bytes(b'previous successful candidates\\n')
    before_live, before_stage = live.read_bytes(), stage.read_bytes()
    revoked = record(41, isPublicDomain=False)
    with mock.patch.object(collector, 'QUERIES', []), mock.patch.object(collector, 'request_json', return_value=revoked) as request:
        try:
            collector.main(['--root', str(root), '--target', '1', '--workers', '1'])
        except SystemExit:
            pass
        else:
            raise AssertionError('A fresh rights revocation must block the import')
    request.assert_called_once()
    assert live.read_bytes() == before_live
    assert stage.read_bytes() == before_stage
    assert json.loads((cache / 'import-report.json').read_text())['status'] == 'blocked'
`);
});

test("Met downloader invalidates a changed image URL and preserves live data on download failure", () => {
  pythonCheck(`
downloader = load_script('fetch-met-images')
prior = record(41)
candidate = record(41, primaryImage='https://images.metmuseum.org/replaced-image.jpg')
with tempfile.TemporaryDirectory() as directory:
    root, live, cache = fixture_root(directory, [prior])
    common.atomic_json(cache / 'candidate-records.json', [candidate])
    image_path = cache / 'images/41.jpg'
    image_path.parent.mkdir()
    image_path.write_bytes(b'\\xff\\xd8' + b'old image fixture' * 100)
    image_before = image_path.read_bytes()
    common.atomic_json(cache / 'images/41.image.json', {
        'sourceUrl': prior['primaryImage'],
        'sha256': downloader.hashlib.sha256(image_before).hexdigest(),
    })
    ready = cache / 'ready-records.json'
    ready.write_bytes(b'previous image-ready snapshot\\n')
    before_live, before_ready = live.read_bytes(), ready.read_bytes()
    failure = urllib.error.URLError('offline download failure')
    with mock.patch.object(downloader.urllib.request, 'urlopen', side_effect=failure) as request, mock.patch.object(downloader.time, 'sleep') as sleep:
        try:
            downloader.main(['--root', str(root), '--target', '1', '--workers', '1'])
        except SystemExit:
            pass
        else:
            raise AssertionError('A failed changed-image download must block the import')
    assert request.call_count == 4
    assert [call.args[0].full_url for call in request.call_args_list] == [candidate['primaryImage']] * 4
    assert [call.args[0] for call in sleep.call_args_list] == [0.5, 1, 2]
    assert live.read_bytes() == before_live
    assert ready.read_bytes() == before_ready
    assert image_path.read_bytes() == image_before
    report = json.loads((cache / 'image-report.json').read_text())
    assert report['status'] == 'blocked' and report['objectID'] == 41
`);
});

test("Met downloader rejects an insufficient image set without replacing its ready snapshot", () => {
  pythonCheck(`
downloader = load_script('fetch-met-images')
prior, addition = record(41), record(9)
with tempfile.TemporaryDirectory() as directory:
    root, live, cache = fixture_root(directory, [prior])
    common.atomic_json(cache / 'candidate-records.json', [prior, addition])
    image_path = cache / 'images/41.jpg'
    image_path.parent.mkdir()
    image_path.write_bytes(b'\\xff\\xd8' + b'existing image fixture' * 100)
    ready = cache / 'ready-records.json'
    ready.write_bytes(b'previous image-ready snapshot\\n')
    before_live, before_ready = live.read_bytes(), ready.read_bytes()
    # A successful HTTP response containing invalid image bytes must fail too.
    with mock.patch.object(downloader.urllib.request, 'urlopen', side_effect=lambda *args, **kwargs: io.BytesIO(b'<html>not an image</html>')) as request, mock.patch.object(downloader.time, 'sleep'):
        try:
            downloader.main(['--root', str(root), '--target', '2', '--workers', '1'])
        except SystemExit:
            pass
        else:
            raise AssertionError('An incomplete image set must not become ready')
    assert request.call_count == 4
    assert live.read_bytes() == before_live
    assert ready.read_bytes() == before_ready
    assert not (cache / 'images/9.jpg').exists()
    report = json.loads((cache / 'image-report.json').read_text())
    assert report['status'] == 'insufficient'
    assert report['accepted'] == 1 and report['target'] == 2
    assert report['errors'][0]['objectID'] == 9
`);
});

test("Met builder count and identity failures preserve every published artifact", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "arte-met-builder-"));
  try {
    const published = new Map([
      ["lib/artworks/data/met-source-records.json", Buffer.from('[{"objectID":41}]\n')],
      ["lib/artworks/metArtworks.ts", Buffer.from('export const MET_ARTWORKS: Artwork[] = [{"id":"published-id","slug":"original-slug"}];\n')],
      ["supabase/seed.sql", Buffer.from("-- Prior live seed: retain exactly\n")],
      ["lib/artworks/data/catalog-manifest.json", Buffer.from('{"release":"previous"}\n')],
      ["public/artworks/met-41.webp", Buffer.from("prior published image bytes")],
    ]);
    for (const [relative, bytes] of published) {
      const filename = path.join(root, relative);
      await mkdir(path.dirname(filename), { recursive: true });
      await writeFile(filename, bytes);
    }
    await mkdir(path.join(root, "scripts"));
    await mkdir(path.join(root, ".met-import-cache"));
    await copyFile(path.join(scripts, "build-met-catalog.mjs"), path.join(root, "scripts/build-met-catalog.mjs"));
    await symlink(path.resolve(scripts, "../node_modules"), path.join(root, "node_modules"), "dir");

    const cases = [
      { records: [{ objectID: 41 }], target: 500, error: /Ready snapshot count\/identity gate failed/ },
      { records: [{ objectID: 41 }, { objectID: 41 }], target: 2, error: /Ready snapshot count\/identity gate failed/ },
      { records: [{ objectID: 9 }], target: 1, error: /Ready snapshot would remove a published artwork/ },
    ];
    for (const fixture of cases) {
      await writeFile(path.join(root, ".met-import-cache/ready-records.json"), JSON.stringify(fixture.records));
      const result = spawnSync(process.execPath, [path.join(root, "scripts/build-met-catalog.mjs"), `--target=${fixture.target}`], {
        cwd: root,
        encoding: "utf8",
        timeout: 15_000,
      });
      assert.ifError(result.error);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, fixture.error);
      for (const [relative, bytes] of published) {
        assert.deepEqual(await readFile(path.join(root, relative)), bytes, `${relative} changed after a failed publication gate`);
      }
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
