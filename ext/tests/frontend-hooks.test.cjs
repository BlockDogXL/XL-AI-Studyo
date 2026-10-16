const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const src = path.resolve(__dirname, "..", "..", "app", "frontend", "src");
const read = (f) => fs.readFileSync(path.join(src, f), "utf8");
const forkLines = (text) => text.split("\n").filter((l) => l.includes("DDYZ-FORK"));

test("Sidebar.jsx has exactly two DDYZ-FORK lines and renders ExtNavItems", () => {
  const s = read("components/Sidebar.jsx");
  assert.equal(forkLines(s).length, 2);
  assert.match(s, /<ExtNavItems activeTab=\{activeTab\} setActiveTab=\{setActiveTab\} \/>/);
});

test("App.jsx has exactly two DDYZ-FORK lines and renders ExtTabs", () => {
  const s = read("App.jsx");
  assert.equal(forkLines(s).length, 2);
  assert.match(s, /<ExtTabs activeTab=\{activeTab\} \/>/);
});

test("ExtNavItems sits right above Model Yoneticisi", () => {
  const s = read("components/Sidebar.jsx");
  const nav = s.indexOf("<ExtNavItems");
  assert.ok(nav > 0, "ExtNavItems missing");
  assert.ok(nav < s.indexOf('activeTab === "models"'));
});
