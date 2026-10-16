// XL AI Studyo - ext katmaninin giris noktasi.
// serve.cjs, /api/ext/* isteklerini tek bir DDYZ-FORK satiriyla buraya devreder.
const path = require("node:path");
const { createRouter } = require("./router.cjs");
const { HttpError, sendJson } = require("./http.cjs");
const { createJobQueue, builtinRunners } = require("./jobs.cjs");
const { resolvePython, spawnWorker, callWorker, stopAllWorkers } = require("./python.cjs");
const { loadRegistry, filterRegistry } = require("./registry.cjs");

const EXT_ROOT = path.resolve(__dirname, "..");
const EXT_VERSION = "0.1.0";

function createExtServer({
  dataDir = path.join(EXT_ROOT, "data"),
  registryPath = path.join(EXT_ROOT, "registry", "models.json"),
  pythonResolver = () => resolvePython({ extRoot: EXT_ROOT }),
  workerTimeoutMs = 10 * 60 * 1000,
  maxJobs = 500,
} = {}) {
  const router = createRouter();

  async function pythonEcho(params) {
    const python = pythonResolver();
    if (!python) throw new Error("Tasinabilir Python bulunamadi. ext/setup/setup-python betigini calistirin.");
    const worker = await spawnWorker({ python, script: path.join(EXT_ROOT, "workers", "echo_worker.py"), name: "echo" });
    try {
      return await callWorker(worker, "/echo", params, { timeoutMs: workerTimeoutMs });
    } finally {
      await worker.stop();
    }
  }

  const runners = {
    system: (task, params, ctx) => (task === "python-echo" ? pythonEcho(params) : builtinRunners.system(task, params, ctx)),
  };
  const jobs = createJobQueue({ dataDir, runners, maxJobs });

  router.get("/api/ext/health", () => ({ ok: true, name: "XL AI Studyo", extVersion: EXT_VERSION }));

  router.post("/api/ext/jobs", ({ body }) => {
    const { module, task, params } = body || {};
    if (typeof module !== "string" || typeof task !== "string") {
      throw new HttpError(400, "module ve task alanlari zorunlu");
    }
    return { ok: true, job: jobs.submit(module, task, params || {}) };
  });
  router.get("/api/ext/jobs", ({ query }) => ({ ok: true, jobs: jobs.list({ limit: Number(query.limit) || 50 }) }));
  router.get("/api/ext/jobs/:id", ({ params }) => {
    const job = jobs.get(params.id);
    if (!job) throw new HttpError(404, "Is bulunamadi");
    return { ok: true, job };
  });

  router.get("/api/ext/models/registry", ({ query }) => {
    const commercial = query.commercial === undefined ? undefined : query.commercial === "true";
    const models = filterRegistry(loadRegistry(registryPath), { commercial, module: query.module });
    return { ok: true, models };
  });

  return {
    dataDir,
    registryPath,
    jobs,
    handle: (req, res) => router.handle(req, res),
    shutdown: () => stopAllWorkers(),
  };
}

let defaultServer = null;
function getDefault() {
  if (!defaultServer) defaultServer = createExtServer();
  return defaultServer;
}

// serve.cjs'in async istek isleyicisinde reddedilen bir Promise tum sunucuyu
// kapatir; bu yuzden ext hicbir kosulda reddetmez, hatayi 500 olarak yazar.
async function safeHandle(getServer, req, res) {
  try {
    return await getServer().handle(req, res);
  } catch (err) {
    console.error("  [xl-ext] istek islenemedi:", err && err.message);
    if (!res.headersSent && !res.writableEnded) {
      sendJson(res, 500, { ok: false, error: `XL AI Studyo eklentisi hatasi: ${err && err.message}` });
    }
    return true;
  }
}

module.exports = {
  createExtServer,
  safeHandle,
  handle: (req, res) => safeHandle(getDefault, req, res),
  shutdown: () => (defaultServer ? defaultServer.shutdown() : Promise.resolve()),
};
