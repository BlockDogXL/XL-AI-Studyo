const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const servePath = path.resolve(__dirname, "..", "..", "scripts", "server", "serve.cjs");
const serve = fs.readFileSync(servePath, "utf8");
const lines = serve.split("\n");

const REQUIRE_LINE =
  'let xlExt = null; try { xlExt = require("../../ext/server/index.cjs"); } catch (err) { console.warn("  [xl-ext] yuklenemedi:", err.message); } // DDYZ-FORK';
const HANDLE_LINE =
  'if (xlExt && req.url.startsWith("/api/ext/") && await xlExt.handle(req, res)) return; // DDYZ-FORK';

test("serve.cjs has exactly two DDYZ-FORK lines", () => {
  assert.equal(lines.filter((l) => l.includes("DDYZ-FORK")).length, 2);
});

test("ext require is guarded so a broken ext folder cannot stop DD:YZ", () => {
  assert.ok(lines.some((l) => l.trim() === REQUIRE_LINE));
});

test("ext handler runs before DD:YZ's unknown-endpoint 404", () => {
  const hook = lines.findIndex((l) => l.trim() === HANDLE_LINE);
  const notFound = lines.findIndex((l) => l.includes('"Unknown API endpoint"'));
  assert.ok(hook > 0, "handle line missing");
  assert.ok(hook < notFound, "handle line must come before the 404");
});
