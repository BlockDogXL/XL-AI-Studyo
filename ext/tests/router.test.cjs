const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { fakeReq, fakeRes } = require("./helpers.cjs");
const { createRouter } = require("../server/router.cjs");
const { createExtServer } = require("../server/index.cjs");

function tmpServer() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "xlai-"));
  return createExtServer({ dataDir });
}

test("GET /api/ext/health returns studio identity", async () => {
  const ext = tmpServer();
  const res = fakeRes();
  const handled = await ext.handle(fakeReq("GET", "/api/ext/health"), res);
  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.json(), { ok: true, name: "XL AI Studyo", extVersion: "0.1.0" });
  await ext.shutdown();
});

test("unknown /api/ext path is not handled and nothing is written", async () => {
  const ext = tmpServer();
  const res = fakeRes();
  const handled = await ext.handle(fakeReq("GET", "/api/ext/yok"), res);
  assert.equal(handled, false);
  assert.equal(res.ended, false);
  await ext.shutdown();
});

test("path params are extracted", async () => {
  const router = createRouter();
  let seen = null;
  router.get("/api/ext/jobs/:id", (ctx) => {
    seen = ctx.params.id;
    return { ok: true };
  });
  const handled = await router.handle(fakeReq("GET", "/api/ext/jobs/abc"), fakeRes());
  assert.equal(handled, true);
  assert.equal(seen, "abc");
});

test("query string is parsed and does not break matching", async () => {
  const router = createRouter();
  let seen = null;
  router.get("/api/ext/x", (ctx) => {
    seen = ctx.query.commercial;
    return { ok: true };
  });
  await router.handle(fakeReq("GET", "/api/ext/x?commercial=true"), fakeRes());
  assert.equal(seen, "true");
});

test("POST with invalid JSON body returns 400", async () => {
  const router = createRouter();
  router.post("/api/ext/echo", (ctx) => ({ ok: true, body: ctx.body }));
  const res = fakeRes();
  const handled = await router.handle(fakeReq("POST", "/api/ext/echo", "{bozuk"), res);
  assert.equal(handled, true);
  assert.equal(res.statusCode, 400);
  assert.equal(res.json().ok, false);
});

test("POST body larger than 1 MB returns 400", async () => {
  const router = createRouter();
  router.post("/api/ext/echo", (ctx) => ({ ok: true }));
  const res = fakeRes();
  const big = Buffer.alloc(1_000_001, 0x61);
  await router.handle(fakeReq("POST", "/api/ext/echo", big), res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.json().ok, false);
});

test("handler exception becomes 500 with ok:false", async () => {
  const router = createRouter();
  router.get("/api/ext/boom", () => {
    throw new Error("patladi");
  });
  const res = fakeRes();
  await router.handle(fakeReq("GET", "/api/ext/boom"), res);
  assert.equal(res.statusCode, 500);
  assert.deepEqual(res.json(), { ok: false, error: "patladi" });
});
