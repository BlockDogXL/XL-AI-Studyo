#!/usr/bin/env node
// XL AI Studyo - upstream (DD:YZ) koduna olan sapmalari denetler.
// Kullanim: node ext/tools/fork-diff.cjs [upstreamRef=upstream/main]
// DD:YZ dosyalarinda isaretsiz (DDYZ-FORK veya XLAI-BRAND icermeyen) her
// eklenen/silinen satir sayilir; boyle bir satir varsa cikis kodu 1 olur.
const { execFileSync } = require("node:child_process");

const ALLOWED_PREFIXES = ["ext/", "docs/", "app/frontend/src/ext/"];
const ALLOWED_FILES = new Set([
  "README.md",
  "logo.txt",
  "logo.png",
  "app/frontend/public/logo.png",
  "app/frontend/package-lock.json",
]);
const MARKERS = ["DDYZ-FORK", "XLAI-BRAND"];

const isAllowed = (file) => ALLOWED_FILES.has(file) || ALLOWED_PREFIXES.some((p) => file.startsWith(p));

function classifyDiff(diffText) {
  const results = [];
  let current = null;
  for (const line of diffText.split("\n")) {
    const header = /^diff --git a\/(.+) b\/(.+)$/.exec(line);
    if (header) {
      current = isAllowed(header[2]) ? null : { file: header[2], unmarkedLines: 0 };
      if (current) results.push(current);
      continue;
    }
    if (!current || line.startsWith("+++") || line.startsWith("---")) continue;
    if ((line.startsWith("+") || line.startsWith("-")) && !MARKERS.some((m) => line.includes(m))) {
      current.unmarkedLines += 1;
    }
  }
  return results;
}

function main() {
  const ref = process.argv[2] || "upstream/main";
  const diff = execFileSync("git", ["diff", ref, "HEAD"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const files = classifyDiff(diff);
  let bad = 0;
  for (const f of files) {
    console.log(`${f.unmarkedLines === 0 ? "OK  " : "HATA"} ${f.file}  (isaretsiz satir: ${f.unmarkedLines})`);
    bad += f.unmarkedLines;
  }
  if (!files.length) console.log("DD:YZ dosyalarinda degisiklik yok.");
  if (bad) {
    console.log(`\n${bad} isaretsiz satir var. Her DD:YZ satirina DDYZ-FORK isareti ekleyin veya degisikligi ext/ altina tasiyin.`);
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = { classifyDiff };
