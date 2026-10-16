// XL AI Studyo - ext katmaninin giris noktasi.
// serve.cjs, /api/ext/* isteklerini tek bir DDYZ-FORK satiriyla buraya devreder.
const path = require("node:path");
const { createRouter } = require("./router.cjs");

const EXT_ROOT = path.resolve(__dirname, "..");
const EXT_VERSION = "0.1.0";

function createExtServer({
  dataDir = path.join(EXT_ROOT, "data"),
  registryPath = path.join(EXT_ROOT, "registry", "models.json"),
} = {}) {
  const router = createRouter();

  router.get("/api/ext/health", () => ({ ok: true, name: "XL AI Studyo", extVersion: EXT_VERSION }));

  return {
    dataDir,
    registryPath,
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
