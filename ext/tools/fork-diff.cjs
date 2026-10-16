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

// Bir hunk icinde, isaretli eklenen satirlar ayni sayida silinen satiri "karsilar"
// (ornegin bir ismin degistirilmesi). Hunk'ta isaretsiz bir ekleme varsa
// silinen satirlarin hicbiri karsilanmis sayilmaz.
function classifyDiff(diffText) {
  const results = [];
  let current = null;
  let hunk = null;
  const closeHunk = () => {
    if (!current || !hunk) return;
    const uncovered = hunk.unmarkedAdded > 0 ? hunk.removed : Math.max(0, hunk.removed - hunk.markedAdded);
    current.unmarkedLines += hunk.unmarkedAdded + uncovered;
    hunk = null;
  };
  for (const line of diffText.split("\n")) {
    const header = /^diff --git a\/(.+) b\/(.+)$/.exec(line);
    if (header) {
      closeHunk();
      current = isAllowed(header[2]) ? null : { file: header[2], unmarkedLines: 0 };
      if (current) results.push(current);
      continue;
    }
    if (!current || line.startsWith("+++") || line.startsWith("---")) continue;
    if (line.startsWith("@@")) {
      closeHunk();
      hunk = { removed: 0, markedAdded: 0, unmarkedAdded: 0 };
      continue;
    }
    if (!hunk) continue;
    const marked = MARKERS.some((m) => line.includes(m));
    if (line.startsWith("+")) hunk[marked ? "markedAdded" : "unmarkedAdded"] += 1;
    else if (line.startsWith("-") && !marked) hunk.removed += 1;
  }
  closeHunk();
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
