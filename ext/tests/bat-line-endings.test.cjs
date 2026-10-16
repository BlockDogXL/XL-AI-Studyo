// cmd.exe, yalnizca LF satir sonlu .bat dosyalarinda 512 baytlik okuma sinirina
// denk gelen etiketleri (ornegin :run_setup) bulamaz ve pencere aninda kapanir.
// Bu yuzden .bat dosyalari diske ve GitHub ZIP'ine CRLF ile cikmalidir.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const root = path.resolve(__dirname, "..", "..");
const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "buffer" });

test("windows.bat has the eol=crlf attribute", () => {
  assert.match(git("check-attr", "eol", "windows.bat").toString(), /eol: crlf/);
});

test("windows.bat is exported with CRLF on every line (as in the GitHub ZIP)", () => {
  // git archive, GitHub'in ZIP indirmesiyle ayni donusumleri uygular; calisma kopyasi kullanilir.
  const tree = git("stash", "create").toString().trim() || "HEAD";
  const tar = git("archive", "--format=tar", tree, "windows.bat");
  const text = tar.toString("latin1");
  const start = text.indexOf("@echo off");
  const body = text.slice(start, text.indexOf("exit /b 0", text.lastIndexOf(":is_port_available")) + "exit /b 0".length);
  const lfOnly = body.split("\n").slice(0, -1).filter((l) => !l.endsWith("\r"));
  assert.deepEqual(lfOnly, []);
});
