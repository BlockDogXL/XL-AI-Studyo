const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { fakeReq, fakeRes } = require("./helpers.cjs");
const { loadRegistry, filterRegistry, sha256File } = require("../server/registry.cjs");
const { createExtServer } = require("../server/index.cjs");

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "xlai-reg-"));

const entry = (over) => ({
  id: "m1",
  module: "image",
  file: "a.safetensors",
  url: "https://example.invalid/a",
  sha256: null,
  sizeBytes: null,
  license: "MIT",
  commercial: true,
  source: "test",
  ...over,
});

function writeReg(entries) {
  const p = path.join(tmp(), "models.json");
  fs.writeFileSync(p, JSON.stringify(entries));
  return p;
}

test("filterRegistry keeps only commercial entries when asked", () => {
  const entries = loadRegistry(writeReg([entry({ id: "a" }), entry({ id: "b", commercial: false, module: "audio" })]));
  assert.deepEqual(filterRegistry(entries, { commercial: true }).map((e) => e.id), ["a"]);
  assert.deepEqual(filterRegistry(entries, { module: "audio" }).map((e) => e.id), ["b"]);
  assert.equal(filterRegistry(entries, {}).length, 2);
});

test("entry without license is rejected naming its id", () => {
  const p = writeReg([entry({ id: "lisanssiz", license: "" })]);
  assert.throws(() => loadRegistry(p), /lisanssiz/);
});

test("entry with non-boolean commercial is rejected naming its id", () => {
  const p = writeReg([entry({ id: "belirsiz", commercial: "evet" })]);
  assert.throws(() => loadRegistry(p), /belirsiz/);
});

test("sha256File hashes file contents", async () => {
  const p = path.join(tmp(), "abc.txt");
  fs.writeFileSync(p, "abc");
  assert.equal(await sha256File(p), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});

test("bundled ext/registry/models.json loads", () => {
  const entries = loadRegistry(path.resolve(__dirname, "..", "registry", "models.json"));
  assert.ok(entries.length >= 4);
  assert.ok(entries.find((e) => e.id === "sd15-default"));
});

test("GET /api/ext/models/registry?commercial=true filters", async () => {
  const p = writeReg([entry({ id: "a" }), entry({ id: "b", commercial: false })]);
  const ext = createExtServer({ dataDir: tmp(), registryPath: p });
  const res = fakeRes();
  await ext.handle(fakeReq("GET", "/api/ext/models/registry?commercial=true"), res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.json().models.map((m) => m.id), ["a"]);
  await ext.shutdown();
});
