const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync, spawn } = require("node:child_process");
const { resolvePython, spawnWorker } = require("../server/python.cjs");
const { createExtServer } = require("../server/index.cjs");

const SYSTEM_PY = spawnSync(process.platform === "win32" ? "where" : "which", ["python3"], { encoding: "utf8" }).stdout.split(/\r?\n/)[0].trim();
const ECHO = path.resolve(__dirname, "..", "workers", "echo_worker.py");
const tmp = (prefix = "xlai-py-") => fs.mkdtempSync(path.join(os.tmpdir(), prefix));

test("resolvePython returns null when nothing is installed", () => {
  assert.equal(resolvePython({ env: {}, extRoot: tmp() }), null);
});

test("resolvePython prefers XLAI_PYTHON", () => {
  assert.equal(resolvePython({ env: { XLAI_PYTHON: "/x/python" }, extRoot: tmp() }), "/x/python");
});

test("resolvePython finds the portable runtime", () => {
  const root = tmp();
  const rel = process.platform === "win32" ? ["runtime", "python", "python.exe"] : ["runtime", "python", "bin", "python3"];
  const p = path.join(root, ...rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, "");
  assert.equal(resolvePython({ env: {}, extRoot: root }), p);
});

test("echo worker starts, echoes and stops", { skip: !SYSTEM_PY }, async () => {
  const w = await spawnWorker({ python: SYSTEM_PY, script: ECHO, name: "echo" });
  const r = await fetch(`http://127.0.0.1:${w.port}/echo`, { method: "POST", body: JSON.stringify({ a: 1 }) });
  assert.deepEqual(await r.json(), { a: 1 });
  await w.stop();
  assert.ok(w.proc.exitCode !== null || w.proc.signalCode !== null);
});

test("worker starts from a folder whose path contains spaces", { skip: !SYSTEM_PY }, async () => {
  const dir = tmp("xl ai bosluklu ");
  const script = path.join(dir, "echo worker.py");
  fs.copyFileSync(ECHO, script);
  const w = await spawnWorker({ python: SYSTEM_PY, script, name: "echo-space" });
  const r = await fetch(`http://127.0.0.1:${w.port}/health`);
  assert.equal(r.status, 200);
  await w.stop();
});

test("python-echo job fails with a clear message when Python is missing", async () => {
  const ext = createExtServer({ dataDir: tmp(), pythonResolver: () => null });
  const job = ext.jobs.submit("system", "python-echo", { a: 1 });
  await ext.jobs.idle();
  const done = ext.jobs.get(job.id);
  assert.equal(done.status, "failed");
  assert.match(done.error, /^Tasinabilir Python bulunamadi/);
  await ext.shutdown();
});

test("python-echo job round-trips through a real worker", { skip: !SYSTEM_PY }, async () => {
  const ext = createExtServer({ dataDir: tmp(), pythonResolver: () => SYSTEM_PY });
  const job = ext.jobs.submit("system", "python-echo", { merhaba: "dunya" });
  await ext.jobs.idle();
  assert.deepEqual(ext.jobs.get(job.id).result, { merhaba: "dunya" });
  await ext.shutdown();
});

test("workers do not outlive the Node process", { skip: !SYSTEM_PY || process.platform === "win32" }, async () => {
  const child = path.join(tmp(), "child.cjs");
  fs.writeFileSync(
    child,
    `const { spawnWorker } = require(${JSON.stringify(path.resolve(__dirname, "..", "server", "python.cjs"))});
     spawnWorker({ python: ${JSON.stringify(SYSTEM_PY)}, script: ${JSON.stringify(ECHO)}, name: "orphan" })
       .then((w) => { console.log(w.proc.pid); process.exit(0); });`,
  );
  const out = spawnSync(process.execPath, [child], { encoding: "utf8", timeout: 30000 });
  const pid = Number(out.stdout.trim());
  assert.ok(pid > 0, out.stderr);
  const deadline = Date.now() + 2000;
  let alive = true;
  while (Date.now() < deadline) {
    try {
      process.kill(pid, 0);
    } catch {
      alive = false;
      break;
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  assert.equal(alive, false, `worker ${pid} still alive`);
});
