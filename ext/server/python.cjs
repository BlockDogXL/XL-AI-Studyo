// XL AI Studyo - tasinabilir Python'u bulma ve Python iscilerini yonetme.
// Isciler kendi HTTP sunucusunu 127.0.0.1 uzerinde acan ayri sureclerdir.
const fs = require("node:fs");
const net = require("node:net");
const path = require("node:path");
const { spawn } = require("node:child_process");

const workers = new Set();

function resolvePython({ env = process.env, extRoot }) {
  if (env.XLAI_PYTHON) return env.XLAI_PYTHON;
  const portable =
    process.platform === "win32"
      ? path.join(extRoot, "runtime", "python", "python.exe")
      : path.join(extRoot, "runtime", "python", "bin", "python3");
  return fs.existsSync(portable) ? portable : null;
}

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

async function waitHealthy(port, proc, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (proc.spawnError) throw proc.spawnError;
    if (proc.exitCode !== null || proc.signalCode !== null) {
      throw new Error(`Isci baslarken kapandi (cikis kodu ${proc.exitCode})`);
    }
    try {
      const r = await fetch(`http://127.0.0.1:${port}/health`);
      if (r.status === 200) return;
    } catch {
      // Henuz dinlemiyor.
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`Isci ${timeoutMs} ms icinde hazir olmadi`);
}

function stopProc(proc) {
  return new Promise((resolve) => {
    if (proc.spawnError || proc.exitCode !== null || proc.signalCode !== null) return resolve();
    proc.once("exit", () => resolve());
    proc.kill();
  });
}

async function spawnWorker({ python, script, name, timeoutMs = 20000 }) {
  const port = await freePort();
  const proc = spawn(python, [script, "--port", String(port)], { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
  proc.stdout.on("data", (d) => process.stdout.write(`  [xl-ext:${name}] ${d}`));
  proc.stderr.on("data", (d) => process.stderr.write(`  [xl-ext:${name}] ${d}`));
  // Python bulunamaz veya calistirilamazsa ChildProcess 'error' yayar;
  // dinleyici olmazsa bu tum sunucuyu kapatir.
  proc.once("error", (err) => {
    proc.spawnError = new Error(`Python baslatilamadi: ${python} (${err.code || err.message})`);
    workers.delete(proc);
  });
  workers.add(proc);
  proc.once("exit", () => workers.delete(proc));
  try {
    await waitHealthy(port, proc, timeoutMs);
  } catch (err) {
    await stopProc(proc);
    throw err;
  }
  return { name, port, proc, stop: () => stopProc(proc) };
}

// Isciye JSON gonderir; yanit timeoutMs icinde gelmezse hata firlatir,
// boylece takilan bir isci kuyrugu sonsuza kadar kilitlemez.
async function callWorker(worker, route, body, { timeoutMs = 10 * 60 * 1000 } = {}) {
  let res;
  try {
    res = await fetch(`http://127.0.0.1:${worker.port}${route}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    if (err && (err.name === "TimeoutError" || err.name === "AbortError")) {
      throw new Error(`Isci ${worker.name} ${timeoutMs} ms icinde yanit vermedi (zaman asimi)`);
    }
    throw err;
  }
  const data = await res.json();
  if (!res.ok) throw new Error((data && data.error) || `Isci hatasi (HTTP ${res.status})`);
  return data;
}

async function stopAllWorkers() {
  await Promise.all([...workers].map(stopProc));
}

// DD:YZ kapanirken (process.exit dahil) kalan iscileri senkron olarak oldur.
process.on("exit", () => {
  for (const proc of workers) {
    try {
      proc.kill();
    } catch {
      // Zaten kapanmis.
    }
  }
});

module.exports = { resolvePython, spawnWorker, callWorker, stopAllWorkers };
