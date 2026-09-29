import assert from "node:assert/strict";
import test from "node:test";
import { InteractionStore } from "../../lib/account/interaction-store.ts";
import { readAllRows } from "../../lib/collections/storage.ts";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const settle = () => new Promise<void>((resolve) => setImmediate(resolve));

test("mounted artwork controls share one read per table and owner", async () => {
  let reads = 0;
  const store = new InteractionStore({ read: async () => { reads++; return ["art-1"]; }, write: async () => {} });
  store.activate("owner-a");
  for (let card = 0; card < 24; card++) store.request("saves");
  await settle();
  assert.equal(reads, 1);
  assert.equal(store.get("saves").values.has("art-1"), true);
  store.activate("owner-a");
  await settle();
  assert.equal(reads, 1, "token refreshes for the same owner do not reload all artwork controls");
});

test("overlapping saves preserve both optimistic values and defer invalidation until writes finish", async () => {
  const first = deferred<void>();
  const second = deferred<void>();
  const persisted = new Set<string>();
  let reads = 0;
  const store = new InteractionStore({
    read: async () => { reads++; return [...persisted]; },
    write: async (_owner, _table, id) => { await (id === "first" ? first.promise : second.promise); persisted.add(id); },
  });
  store.activate("owner-a"); store.request("saves"); await settle();
  const one = store.set("saves", "first", true);
  const two = store.set("saves", "second", true);
  await store.refresh("saves");
  assert.deepEqual([...store.get("saves").values].sort(), ["first", "second"]);
  assert.equal(reads, 1);
  second.resolve(); await two;
  assert.equal(store.get("saves").pending.has("first"), true);
  assert.equal(store.get("saves").values.has("first"), true);
  first.resolve(); await one; await settle();
  assert.deepEqual([...store.get("saves").values].sort(), ["first", "second"]);
  assert.equal(reads, 2);
  assert.equal(store.get("saves").pending.size, 0);
});

test("old account reads and writes cannot repopulate the new account", async () => {
  const oldRead = deferred<string[]>();
  const oldWrite = deferred<void>();
  let oldReads = 0;
  const store = new InteractionStore({
    read: async (owner) => owner === "owner-a" ? (++oldReads === 1 ? ["private-a"] : oldRead.promise) : ["private-b"],
    write: () => oldWrite.promise,
  });
  store.activate("owner-a"); store.request("saves"); await settle();
  const read = store.refresh("saves");
  const write = store.set("saves", "new-private-a", true);
  store.activate("owner-b");
  assert.equal(store.get("saves").ready, false);
  assert.equal(store.get("saves").values.size, 0);
  await settle();
  oldRead.resolve(["private-a"]); oldWrite.resolve(); await read;
  assert.equal(await write, false);
  assert.deepEqual([...store.get("saves").values], ["private-b"]);
  assert.equal(store.get("saves").owner, "owner-b");
});

test("a failed save rolls back only its own item and a retry can succeed", async () => {
  const failed = deferred<void>();
  let attempts = 0;
  const store = new InteractionStore({
    read: async () => [],
    write: async (_owner, _table, id) => { if (id === "first" && attempts++ === 0) await failed.promise; },
  });
  store.activate(null); store.request("saves"); await settle();
  const one = store.set("saves", "first", true);
  assert.equal(await store.set("saves", "second", true), true);
  failed.reject(new Error("offline"));
  assert.equal(await one, false);
  assert.deepEqual([...store.get("saves").values], ["second"]);
  assert.equal(store.get("saves").failures.has("first"), true);
  assert.equal(await store.set("saves", "first", true), true);
  assert.equal(store.get("saves").failures.has("first"), false);
});

test("a refresh that predates a mutation cannot replace its result", async () => {
  const stale = deferred<string[]>();
  let reads = 0;
  const store = new InteractionStore({ read: async () => ++reads === 1 ? [] : reads === 2 ? stale.promise : ["new"], write: async () => {} });
  store.activate("owner"); store.request("saves"); await settle();
  const refresh = store.refresh("saves");
  await store.set("saves", "new", true);
  stale.resolve([]); await refresh; await settle();
  assert.equal(store.get("saves").values.has("new"), true);
});

test("notebook reads beyond the API row cap instead of silently dropping later collection items", async () => {
  const source = Array.from({ length: 1251 }, (_, id) => ({ id }));
  const ranges: number[][] = [];
  const rows = await readAllRows(async (from, to) => { ranges.push([from, to]); return { data: source.slice(from, to + 1), error: null }; }, "Could not load.");
  assert.equal(rows.length, 1251);
  assert.deepEqual(ranges, [[0, 499], [500, 999], [1000, 1499]]);
});

test("notebook pagination rejects a failed later page instead of reporting a partial notebook", async () => {
  await assert.rejects(readAllRows(async (from) => from === 0 ? { data: Array(500).fill("id"), error: null } : { data: null, error: { code: "offline" } }, "Could not load all artworks."), /Could not load all artworks/);
});
