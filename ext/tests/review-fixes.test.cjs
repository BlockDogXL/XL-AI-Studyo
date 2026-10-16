// Son gozden gecirmenin buldugu sorunlar icin testler (C1, C2, I1, I2, I3, M5).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { fakeReq, fakeRes } = require("./helpers.cjs");
const { createRouter } = require("../server/router.cjs");
const { safeHandle, createExtServer } = require("../server/index.cjs");
const { spawnWorker, callWorker } = require("../server/python.cjs");
const { createJobQueue } = require("../server/jobs.cjs");

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "xlai-fix-"));
const SYSTEM_PY = spawnSync("which", ["python3"], { encoding: "utf8" }).stdout.trim();

// C1
test("C1: malformed percent-encoding in a path param returns 400 instead of throwing", async () => {
  const router = createRouter();
  router.get("/api/ext/jobs/:id", () => ({ ok: true }));
  const res = fakeRes();
  const handled = await router.handle(fakeReq("GET", "/api/ext/jobs/%E0"), res);
  assert.equal(handled, true);
  assert.equal(res.statusCode, 400);
  assert.equal(res.json().ok, false);
});

test("C1: safeHandle never rejects when the ext server cannot be created", async () => {
  const res = fakeRes();
  const handled = await safeHandle(
    () => {
      throw new Error("EACCES: ext/data yazilamiyor");
    },
    fakeReq("GET", "/api/ext/health"),
    res,
  );
  assert.equal(handled, true);
  assert.equal(res.statusCode, 500);
  assert.match(res.json().error, /EACCES/);
});

// C2
test("C2: an unspawnable Python path rejects the worker start instead of crashing", async () => {
  await assert.rejects(
    () => spawnWorker({ python: "/no/such/python", script: "x.py", name: "bad" }),
    /Python baslatilamadi: \/no\/such\/python/,
  );
});

test("C2: python-echo job with an unspawnable Python fails with a clear message", async () => {
  const ext = createExtServer({ dataDir: tmp(), pythonResolver: () => "/no/such/python" });
  const job = ext.jobs.submit("system", "python-echo", {});
  await ext.jobs.idle();
  assert.equal(ext.jobs.get(job.id).status, "failed");
  assert.match(ext.jobs.get(job.id).error, /Python baslatilamadi/);
  await ext.shutdown();
});

// I1
test("I1: only the newest maxJobs jobs are kept in memory", async () => {
  const q = createJobQueue({ dataDir: tmp(), runners: {}, maxJobs: 3 });
  for (let i = 0; i < 5; i++) q.submit("system", "echo", { i });
  await q.idle();
  const jobs = q.list({ limit: 100 });
  assert.equal(jobs.length, 3);
  assert.deepEqual(jobs.map((j) => j.params.i), [4, 3, 2]);
});

test("I1: the job log is compacted on load to one line per kept job", async () => {
  const dir = tmp();
  const q1 = createJobQueue({ dataDir: dir, runners: {}, maxJobs: 3 });
  for (let i = 0; i < 5; i++) q1.submit("system", "echo", { i });
  await q1.idle();
  createJobQueue({ dataDir: dir, runners: {}, maxJobs: 3 });
  const lines = fs.readFileSync(path.join(dir, "jobs.jsonl"), "utf8").trim().split("\n");
  assert.equal(lines.length, 3);
});

// I2
test("I2: a failing log write while running a job does not crash or stall the queue", async () => {
  const dir = tmp();
  const q = createJobQueue({ dataDir: dir, runners: {} });
  const job = q.submit("system", "echo", { a: 1 });
  const file = path.join(dir, "jobs.jsonl");
  fs.rmSync(file);
  fs.mkdirSync(file); // appendFileSync artik EISDIR firlatir
  const rejections = [];
  const onRejection = (e) => rejections.push(e);
  process.on("unhandledRejection", onRejection);
  try {
    await q.idle();
    await new Promise((r) => setTimeout(r, 50));
  } finally {
    process.off("unhandledRejection", onRejection);
  }
  assert.deepEqual(rejections, []);
  assert.equal(q.get(job.id).status, "done");
});

// I3
test("I3: a worker that never answers is timed out", { skip: !SYSTEM_PY }, async () => {
  const dir = tmp();
  const script = path.join(dir, "hang_worker.py");
  fs.writeFileSync(
    script,
    [
      "import argparse, time",
      "from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer",
      "class H(BaseHTTPRequestHandler):",
      "    def do_GET(self):",
      "        self.send_response(200); self.send_header('Content-Length','2'); self.end_headers(); self.wfile.write(b'{}')",
      "    def do_POST(self):",
      "        time.sleep(30)",
      "    def log_message(self, *a): pass",
      "p = argparse.ArgumentParser(); p.add_argument('--port', type=int); a = p.parse_args()",
      "ThreadingHTTPServer(('127.0.0.1', a.port), H).serve_forever()",
    ].join("\n"),
  );
  const w = await spawnWorker({ python: SYSTEM_PY, script, name: "hang" });
  try {
    await assert.rejects(() => callWorker(w, "/echo", { a: 1 }, { timeoutMs: 300 }), /zaman asimi/);
  } finally {
    await w.stop();
  }
});

// M5 (Important'a yukseltildi)
test("M5: setup-python.ps1 uses Windows' own tar.exe and disables the slow progress bar", () => {
  const ps1 = fs.readFileSync(path.resolve(__dirname, "..", "setup", "setup-python.ps1"), "utf8");
  assert.match(ps1, /\$ProgressPreference = 'SilentlyContinue'/);
  assert.match(ps1, /\$env:SystemRoot\\System32\\tar\.exe/);
  assert.doesNotMatch(ps1, /^tar /m);
});
