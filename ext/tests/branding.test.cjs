const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..", "..");
const OLD = "Sansursuz Lokal AI Studyosu - DD:YZ";
const FILES = [
  "app/frontend/index.html",
  "app/frontend/src/components/Sidebar.jsx",
  "windows.bat",
  "linux.sh",
  "mac.sh",
  "scripts/server/serve.cjs",
];

// Kabuk betiklerindeki "# ..." yorum satirlari kullaniciya gorunmez; onlara dokunulmaz.
const visibleLines = (file) =>
  fs
    .readFileSync(path.join(root, file), "utf8")
    .split(/\r?\n/)
    .filter((l) => !/^\s*#/.test(l));

for (const file of FILES) {
  test(`${file}: no visible DD:YZ product name and every renamed line is marked`, () => {
    const lines = visibleLines(file);
    assert.deepEqual(lines.filter((l) => l.includes(OLD)), []);
    for (const l of lines.filter((x) => x.includes("XL AI Studyo"))) {
      assert.ok(l.includes("XLAI-BRAND"), `unmarked branding line: ${l.trim()}`);
    }
    assert.ok(lines.some((l) => l.includes("XL AI Studyo")), "new name missing");
  });
}
