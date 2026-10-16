// Arayuz app/dist icine bir kez derlenir. Yeni surum eski kurulumun ustune
// kopyalaninca baslaticilar eski derlemeyi kullaniyordu. index.html'deki
// xlai-ui damgasi derlenmis arayuze de tasinir; baslaticilar damga eslesmezse
// onarim kurulumunu (arayuzu yeniden derler) calistirir.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const root = path.resolve(__dirname, "..", "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");
const stamp = /<meta name="xlai-ui" content="(xlai-ui-\d+)" \/>/.exec(read("app/frontend/index.html"));

test("index.html carries an xlai-ui stamp", () => {
  assert.ok(stamp, "stamp meta tag missing");
});

test("windows.bat rebuilds the UI when the built stamp differs", () => {
  const bat = read("windows.bat").split(/\r?\n/);
  const check = bat.find((l) => l.includes(`findstr /c:"${stamp && stamp[1]}" "%DIST%"`));
  assert.ok(check, "findstr stamp check missing");
  assert.ok(check.includes("DDYZ-FORK"));
  assert.match(check, /\|\| set SETUP_REASON=/);
  const i = bat.indexOf(check);
  assert.match(bat[i + 1], /^if not "%SETUP_REASON%"=="" goto :run_setup& rem DDYZ-FORK$/);
});

for (const file of ["linux.sh", "mac.sh"]) {
  test(`${file} rebuilds the UI when the built stamp differs`, () => {
    const line = read(file)
      .split("\n")
      .find((l) => l.includes(`"${stamp && stamp[1]}"`));
    assert.ok(line, "stamp check missing");
    assert.ok(line.includes("DDYZ-FORK"));
  });

  test(`${file} stamp check sets SETUP_REASON only for a stale build`, () => {
    const line = read(file)
      .split("\n")
      .find((l) => l.includes(`"${stamp && stamp[1]}"`));
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "xlai-stamp-"));
    const run = (html) => {
      const dist = path.join(dir, "index.html");
      fs.writeFileSync(dist, html);
      return execFileSync("bash", ["-c", `DIST_INDEX="${dist}"; SETUP_REASON=""; ${line}\nprintf %s "$SETUP_REASON"`], {
        encoding: "utf8",
      });
    };
    assert.equal(run(`<meta name="xlai-ui" content="${stamp[1]}" />`), "");
    assert.notEqual(run("<title>eski DD:YZ</title>"), "");
  });
}
