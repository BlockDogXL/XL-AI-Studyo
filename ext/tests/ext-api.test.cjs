const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const apiUrl = pathToFileURL(path.resolve(__dirname, "..", "..", "app", "frontend", "src", "ext", "extApi.js")).href;

function mockFetch(responseBody, status = 200) {
  const calls = [];
  global.fetch = async (url, options = {}) => {
    calls.push({ url, options });
    return { ok: status < 400, status, json: async () => responseBody };
  };
  return calls;
}

test("submitJob posts module, task and params", async () => {
  const api = await import(apiUrl);
  const calls = mockFetch({ ok: true, job: { id: "j1" } });
  const res = await api.submitJob("system", "echo", { x: 1 });
  assert.equal(res.job.id, "j1");
  assert.equal(calls[0].url, "/api/ext/jobs");
  assert.equal(calls[0].options.method, "POST");
  assert.deepEqual(JSON.parse(calls[0].options.body), { module: "system", task: "echo", params: { x: 1 } });
});

test("ok:false response throws its error message", async () => {
  const api = await import(apiUrl);
  mockFetch({ ok: false, error: "Bilinmeyen modul: yok" }, 400);
  await assert.rejects(() => api.submitJob("yok", "x", {}), /Bilinmeyen modul: yok/);
});

test("getRegistry passes the commercial filter", async () => {
  const api = await import(apiUrl);
  const calls = mockFetch({ ok: true, models: [] });
  await api.getRegistry({ commercial: true });
  assert.equal(calls[0].url, "/api/ext/models/registry?commercial=true");
  await api.getRegistry();
  assert.equal(calls[1].url, "/api/ext/models/registry");
});

test("getExtHealth and listJobs hit their endpoints", async () => {
  const api = await import(apiUrl);
  const calls = mockFetch({ ok: true, jobs: [] });
  await api.getExtHealth();
  await api.listJobs();
  assert.deepEqual(calls.map((c) => c.url), ["/api/ext/health", "/api/ext/jobs?limit=20"]);
});
