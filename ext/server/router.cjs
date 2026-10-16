// XL AI Studyo - kucuk GET/POST yonlendirici, ":param" destegiyle.
const { HttpError, sendJson, readJsonBody } = require("./http.cjs");

function compile(pattern) {
  const names = [];
  const source = pattern
    .split("/")
    .map((part) => {
      if (part.startsWith(":")) {
        names.push(part.slice(1));
        return "([^/]+)";
      }
      return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    })
    .join("/");
  return { regex: new RegExp(`^${source}$`), names };
}

function createRouter() {
  const routes = [];

  function add(method, pattern, fn) {
    routes.push({ method, fn, ...compile(pattern) });
  }

  async function handle(req, res) {
    const url = new URL(req.url, "http://localhost");
    for (const route of routes) {
      if (route.method !== req.method) continue;
      const match = route.regex.exec(url.pathname);
      if (!match) continue;
      const params = {};
      route.names.forEach((name, i) => {
        params[name] = decodeURIComponent(match[i + 1]);
      });
      const query = Object.fromEntries(url.searchParams);
      try {
        const body = req.method === "POST" ? await readJsonBody(req) : undefined;
        const result = await route.fn({ req, res, params, query, body });
        sendJson(res, 200, result);
      } catch (err) {
        const status = err instanceof HttpError ? err.status : 500;
        sendJson(res, status, { ok: false, error: err.message });
      }
      return true;
    }
    return false;
  }

  return { get: (p, fn) => add("GET", p, fn), post: (p, fn) => add("POST", p, fn), handle };
}

module.exports = { createRouter };
