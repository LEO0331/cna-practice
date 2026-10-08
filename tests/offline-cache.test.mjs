import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import vm from "node:vm";
import { buildOfflineCache } from "../scripts/build-offline-cache.mjs";

async function fixture(t, entries) {
  const directory = await mkdtemp(path.join(tmpdir(), "cna-offline-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  for (const [name, content] of Object.entries(entries)) {
    await mkdir(path.dirname(path.join(directory, name)), { recursive: true });
    await writeFile(path.join(directory, name), content);
  }
  return directory;
}

test("manifest is deterministic and covers directory HTML, RSC payloads, and assets", async (t) => {
  const directory = await fixture(t, {
    "index.html": "home", "practice/index.html": "practice",
    "practice/index.txt": "RSC", "practice/__next.tree.txt": "tree",
    "_next/static/app.js": "app", "_next/static/app.js.map": "map",
    "styles.css": "style", "sw.js": "old worker",
  });
  const first = await buildOfflineCache(directory);
  const worker = await readFile(path.join(directory, "sw.js"), "utf8");
  const second = await buildOfflineCache(directory);
  assert.deepEqual(second, first);
  assert.equal(await readFile(path.join(directory, "sw.js"), "utf8"), worker);
  assert.deepEqual(first.files, ["_next/static/app.js", "./", "practice/__next.tree.txt", "practice/", "practice/index.txt", "styles.css"]);
  assert.match(worker, new RegExp(`const OFFLINE_VERSION = "${first.version}";`));
  assert.ok(!worker.includes("/* OFFLINE_MANIFEST */"));
  await writeFile(path.join(directory, "practice/index.txt"), "updated RSC");
  assert.notEqual((await buildOfflineCache(directory)).version, first.version);
});

async function workerHarness(files = ["./", "practice/", "practice/index.txt"], options = {}) {
  const template = await readFile(new URL("../scripts/offline-worker.js", import.meta.url), "utf8");
  const handlers = new Map();
  const batches = [];
  const deleted = [];
  const matches = [];
  const network = [];
  const cached = new Map();
  let claims = 0;
  let skips = 0;
  let activeBatches = 0;
  let maxActiveBatches = 0;
  const cacheName = "cna-offline-%2Fapp%2F-test-version";
  const cache = {
    async addAll(requests) {
      batches.push(requests);
      activeBatches++;
      maxActiveBatches = Math.max(maxActiveBatches, activeBatches);
      await new Promise((resolve) => setImmediate(resolve));
      activeBatches--;
      if (options.failBatch === batches.length) throw new Error("download failed");
    },
    async match(url, matchOptions) {
      matches.push({ url, options: matchOptions });
      return cached.get(url);
    },
  };
  const self = {
    registration: { scope: "https://example.com/app/" },
    addEventListener(name, handler) { handlers.set(name, handler); },
    clients: { async claim() { claims++; } },
    skipWaiting() { skips++; },
  };
  vm.runInNewContext(template.replace("/* OFFLINE_MANIFEST */", `const OFFLINE_VERSION = "test-version"; const OFFLINE_FILES = ${JSON.stringify(files)};`), {
    self, URL, Request,
    caches: {
      async open(name) { assert.equal(name, cacheName); return cache; },
      async keys() { return options.cacheNames ?? []; },
      async delete(name) { deleted.push(name); return true; },
    },
    async fetch(request) { network.push(request); return { source: "network" }; },
  });
  return {
    batches, deleted, matches, network, cached, cacheName,
    get claims() { return claims; }, get skips() { return skips; },
    get maxActiveBatches() { return maxActiveBatches; },
    lifecycle(name) {
      let pending;
      handlers.get(name)({ waitUntil(promise) { pending = promise; } });
      return pending;
    },
    request(url, method = "GET") {
      const request = new Request(url, { method });
      let response;
      handlers.get("fetch")({ request, respondWith(promise) { response = promise; } });
      return { request, response };
    },
  };
}

test("install downloads sequential bounded batches without forcing activation", async () => {
  const worker = await workerHarness(Array.from({ length: 19 }, (_, index) => `asset-${index}.js`));
  await worker.lifecycle("install");
  assert.deepEqual(worker.batches.map((batch) => batch.length), [8, 8, 3]);
  assert.equal(worker.maxActiveBatches, 1);
  assert.ok(worker.batches.flat().every((request) => request.cache === "reload"));
  assert.equal(worker.deleted.length, 0);
  assert.equal(worker.skips, 0);
});

test("failed install deletes the incomplete version and preserves the error", async () => {
  const worker = await workerHarness(Array.from({ length: 19 }, (_, index) => `asset-${index}.js`), { failBatch: 2 });
  await assert.rejects(worker.lifecycle("install"), /download failed/);
  assert.deepEqual(worker.deleted, [worker.cacheName]);
  assert.equal(worker.batches.length, 2);
  assert.equal(worker.skips, 0);
});

test("activate cleans only older caches belonging to this scope and claims clients", async () => {
  const worker = await workerHarness(undefined, { cacheNames: [
    "cna-offline-%2Fapp%2F-old", "cna-offline-%2Fapp%2F-test-version",
    "cna-offline-%2Fother%2F-old", "unrelated-cache",
  ] });
  await worker.lifecycle("activate");
  assert.deepEqual(worker.deleted, ["cna-offline-%2Fapp%2F-old"]);
  assert.equal(worker.claims, 1);
  assert.equal(worker.skips, 0);
});

test("document queries use cached HTML while RSC payload paths remain distinct", async () => {
  const worker = await workerHarness();
  const html = { source: "HTML" };
  const rsc = { source: "RSC" };
  worker.cached.set("https://example.com/app/practice/", html);
  worker.cached.set("https://example.com/app/practice/index.txt", rsc);
  assert.equal(await worker.request("https://example.com/app/practice/?year=2025").response, html);
  assert.equal(await worker.request("https://example.com/app/practice/index.txt?_rsc=abc").response, rsc);
  assert.equal(worker.network.length, 0);
  assert.ok(worker.matches.every((match) => match.options.ignoreVary === true));
});

test("foreign, outside-scope, non-GET, and unknown requests pass through", async () => {
  const worker = await workerHarness();
  for (const [url, method] of [
    ["https://other.com/app/practice/", "GET"],
    ["https://example.com/elsewhere/", "GET"],
    ["https://example.com/application/practice/", "GET"],
    ["https://example.com/app/practice/", "POST"],
    ["https://example.com/app/unknown/", "GET"],
  ]) assert.equal(worker.request(url, method).response, undefined);
  assert.equal(worker.matches.length, 0);
  assert.equal(worker.network.length, 0);
});

test("missing known cache entry falls back to the original network request", async () => {
  const worker = await workerHarness();
  const result = worker.request("https://example.com/app/practice/?year=2025");
  assert.deepEqual(await result.response, { source: "network" });
  assert.equal(worker.network[0], result.request);
  assert.equal(worker.matches[0].url, "https://example.com/app/practice/");
});
