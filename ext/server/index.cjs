// XL AI Studyo - ext katmaninin giris noktasi.
// serve.cjs, /api/ext/* isteklerini tek bir DDYZ-FORK satiriyla buraya devreder.
const path = require("node:path");
const { createRouter } = require("./router.cjs");
const { HttpError } = require("./http.cjs");
const { createJobQueue } = require("./jobs.cjs");

const EXT_ROOT = path.resolve(__dirname, "..");
const EXT_VERSION = "0.1.0";

function createExtServer({
  dataDir = path.join(EXT_ROOT, "data"),
  registryPath = path.join(EXT_ROOT, "registry", "models.json"),
} = {}) {
  const router = createRouter();

  const jobs = createJobQueue({ dataDir, runners: {} });

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

  return {
    dataDir,
    registryPath,
    jobs,
    handle: (req, res) => router.handle(req, res),
    async shutdown() {},
  };
}

let defaultServer = null;
function getDefault() {
  if (!defaultServer) defaultServer = createExtServer();
  return defaultServer;
}

module.exports = {
  createExtServer,
  handle: (req, res) => getDefault().handle(req, res),
  shutdown: () => (defaultServer ? defaultServer.shutdown() : Promise.resolve()),
};
