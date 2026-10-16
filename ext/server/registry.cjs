// XL AI Studyo - model ve lisans kaydi.
// sha256: null, dosyanin henuz dogrulanmadigi anlamina gelir.
const fs = require("node:fs");
const crypto = require("node:crypto");

function loadRegistry(filePath) {
  const entries = JSON.parse(fs.readFileSync(filePath, "utf8"));
  if (!Array.isArray(entries)) throw new Error(`Model kaydi bir dizi olmali: ${filePath}`);
  entries.forEach((e, i) => {
    const id = e && e.id ? e.id : `#${i}`;
    for (const field of ["id", "module", "license"]) {
      if (typeof e[field] !== "string" || !e[field].trim()) {
        throw new Error(`Model kaydi girdisi '${id}': '${field}' alani zorunlu`);
      }
    }
    if (typeof e.commercial !== "boolean") {
      throw new Error(`Model kaydi girdisi '${id}': 'commercial' true veya false olmali`);
    }
  });
  return entries;
}

function filterRegistry(entries, { commercial, module } = {}) {
  return entries.filter(
    (e) => (commercial === undefined || e.commercial === commercial) && (!module || e.module === module),
  );
}

function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    fs.createReadStream(filePath)
      .on("data", (chunk) => hash.update(chunk))
      .on("error", reject)
      .on("end", () => resolve(hash.digest("hex")));
  });
}

module.exports = { loadRegistry, filterRegistry, sha256File };
