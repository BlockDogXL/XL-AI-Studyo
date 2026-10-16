const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { fakeReq, fakeRes } = require("./helpers.cjs");
const { createJobQueue } = require("../server/jobs.cjs");
const { createExtServer } = require("../server/index.cjs");

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "xlai-jobs-"));

test("system/echo job finishes with params as result", async () => {
  const q = createJobQueue({ dataDir: tmp(), runners: {} });
  const job = q.submit("system", "echo", { a: 1 });
  assert.equal(typeof job.id, "string");
  await q.idle();
  const done = q.get(job.id);
  assert.equal(done.status, "done");
  assert.deepEqual(done.result, { a: 1 });
  assert.ok(done.startedAt && done.finishedAt);
});

test("a failing job is marked failed and the queue moves on", async () => {
  const q = createJobQueue({
    dataDir: tmp(),
    runners: {
      bad: async () => {
        throw new Error("model yuklenemedi");
      },
    },
  });
  const bad = q.submit("bad", "x", {});
  const good = q.submit("system", "echo", { ok: 1 });
  await q.idle();
  assert.equal(q.get(bad.id).status, "failed");
  assert.equal(q.get(bad.id).error, "model yuklenemedi");
  assert.equal(q.get(good.id).status, "done");
});

test("jobs run one at a time", async () => {
  let running = 0;
  let maxRunning = 0;
  const q = createJobQueue({
    dataDir: tmp(),
    runners: {
      slow: async () => {
        running++;
        maxRunning = Math.max(maxRunning, running);
        await new Promise((r) => setTimeout(r, 20));
        running--;
        return true;
      },
    },
  });
  q.submit("slow", "a", {});
  q.submit("slow", "b", {});
  q.submit("slow", "c", {});
  await q.idle();
  assert.equal(maxRunning, 1);
});

test("a job left running at shutdown is reloaded as failed/interrupted", () => {
  const dir = tmp();
  const job = { id: "j1", module: "system", task: "echo", params: {}, status: "running", createdAt: new Date().toISOString() };
  fs.writeFileSync(path.join(dir, "jobs.jsonl"), JSON.stringify(job) + "\n");
  const q = createJobQueue({ dataDir: dir, runners: {} });
  assert.equal(q.get("j1").status, "failed");
  assert.equal(q.get("j1").error, "interrupted");
});

test("finished jobs survive a restart", async () => {
  const dir = tmp();
  const q1 = createJobQueue({ dataDir: dir, runners: {} });
  const job = q1.submit("system", "echo", { k: "v" });
  await q1.idle();
  const q2 = createJobQueue({ dataDir: dir, runners: {} });
  assert.equal(q2.get(job.id).status, "done");
  assert.deepEqual(q2.get(job.id).result, { k: "v" });
});

test("unknown module is rejected with status 400", () => {
  const q = createJobQueue({ dataDir: tmp(), runners: {} });
  assert.throws(() => q.submit("yok", "x", {}), (err) => err.status === 400 && /Bilinmeyen modul: yok/.test(err.message));
});

test("list returns newest first, limited", async () => {
  const q = createJobQueue({ dataDir: tmp(), runners: {} });
  const a = q.submit("system", "echo", { n: 1 });
  const b = q.submit("system", "echo", { n: 2 });
  await q.idle();
  const jobs = q.list({ limit: 1 });
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].id, b.id);
  assert.notEqual(jobs[0].id, a.id);
});

test("POST /api/ext/jobs with invalid JSON returns 400", async () => {
  const ext = createExtServer({ dataDir: tmp() });
  const res = fakeRes();
  await ext.handle(fakeReq("POST", "/api/ext/jobs", "{"), res);
  assert.equal(res.statusCode, 400);
  await ext.shutdown();
});

test("POST /api/ext/jobs then GET /api/ext/jobs/:id", async () => {
  const ext = createExtServer({ dataDir: tmp() });
  const res = fakeRes();
  await ext.handle(fakeReq("POST", "/api/ext/jobs", JSON.stringify({ module: "system", task: "echo", params: { x: 1 } })), res);
  assert.equal(res.statusCode, 200);
  const { job } = res.json();
  assert.ok(job.id);
  await ext.jobs.idle();
  const res2 = fakeRes();
  await ext.handle(fakeReq("GET", `/api/ext/jobs/${job.id}`), res2);
  assert.equal(res2.json().job.status, "done");
  const res3 = fakeRes();
  await ext.handle(fakeReq("GET", "/api/ext/jobs/yok-boyle-is"), res3);
  assert.equal(res3.statusCode, 404);
  await ext.shutdown();
});

test("POST /api/ext/jobs with unknown module returns 400", async () => {
  const ext = createExtServer({ dataDir: tmp() });
  const res = fakeRes();
  await ext.handle(fakeReq("POST", "/api/ext/jobs", JSON.stringify({ module: "yok", task: "x" })), res);
  assert.equal(res.statusCode, 400);
  await ext.shutdown();
});
