const test = require("node:test");
const assert = require("node:assert/strict");
const { classifyDiff } = require("../tools/fork-diff.cjs");

const diff = `diff --git a/scripts/server/serve.cjs b/scripts/server/serve.cjs
index 111..222 100644
--- a/scripts/server/serve.cjs
+++ b/scripts/server/serve.cjs
@@ -10,6 +10,7 @@
 const path = require("path");
+let xlExt = null; // DDYZ-FORK
 const x = 1;
diff --git a/app/frontend/src/App.jsx b/app/frontend/src/App.jsx
index 333..444 100644
--- a/app/frontend/src/App.jsx
+++ b/app/frontend/src/App.jsx
@@ -1,3 +1,4 @@
-const old = 1;
+const yeni = 2;
+import X from "./ext/X"; // DDYZ-FORK
diff --git a/ext/server/index.cjs b/ext/server/index.cjs
new file mode 100644
--- /dev/null
+++ b/ext/server/index.cjs
@@ -0,0 +1 @@
+module.exports = {};
diff --git a/README.md b/README.md
--- a/README.md
+++ b/README.md
@@ -1 +1 @@
-# DD:YZ
+# XL AI Studyo
`;

test("marked lines are not counted", () => {
  const serve = classifyDiff(diff).find((f) => f.file === "scripts/server/serve.cjs");
  assert.deepEqual(serve, { file: "scripts/server/serve.cjs", unmarkedLines: 0 });
});

test("unmarked added and removed lines are counted", () => {
  const app = classifyDiff(diff).find((f) => f.file === "app/frontend/src/App.jsx");
  assert.equal(app.unmarkedLines, 2);
});

test("a line replaced by a marked line is not counted", () => {
  const rename = `diff --git a/linux.sh b/linux.sh
--- a/linux.sh
+++ b/linux.sh
@@ -229 +229 @@
-echo "  Eski Ad"
+echo "  Yeni Ad" # XLAI-BRAND
@@ -300,2 +300,1 @@
-silinen1
-silinen2
+yeni # XLAI-BRAND
`;
  assert.deepEqual(classifyDiff(rename), [{ file: "linux.sh", unmarkedLines: 1 }]);
});

test(".gitattributes (no comment syntax for markers) is an allowed deviation", () => {
  const d = `diff --git a/.gitattributes b/.gitattributes
--- a/.gitattributes
+++ b/.gitattributes
@@ -1 +1,2 @@
 *.sh text eol=lf
+*.bat text eol=crlf
`;
  assert.deepEqual(classifyDiff(d), []);
});

test("ext/ and allowed files are not listed", () => {
  const files = classifyDiff(diff).map((f) => f.file);
  assert.ok(!files.includes("ext/server/index.cjs"));
  assert.ok(!files.includes("README.md"));
});
