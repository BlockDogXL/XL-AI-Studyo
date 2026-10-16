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
  "scripts/setup/setup.ps1",
  "scripts/reset/reset.ps1",
  "scripts/reset/reset.sh",
  "scripts/setup/setup-coreml-npu.sh",
  "scripts/setup/setup-openvino-npu.ps1",
  "scripts/setup/setup-openvino-npu.sh",
  "scripts/build/build_from_source.sh",
];

test("Windows first-install banner says XL AI Studyo", () => {
  const ps1 = fs.readFileSync(path.join(root, "scripts/setup/setup.ps1"), "utf8");
  assert.match(ps1, /Write-Host "   XL AI Studyo   -  Ilk Kurulum"/);
});

test("Hugging Face requests identify as XL AI Studyo, marked", () => {
  const ua = visibleLines("scripts/server/serve.cjs").filter((l) => l.includes('"User-Agent"'));
  assert.ok(ua.length >= 2);
  for (const l of ua) {
    assert.doesNotMatch(l, /DDYZ|derinedaliyoruz/);
    assert.match(l, /XL-AI-Studyo\/1\.0 \(\+https:\/\/github\.com\/BlockDogXL\/XL-AI-Studyo\)/);
    assert.ok(l.includes("XLAI-BRAND"));
  }
});

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
