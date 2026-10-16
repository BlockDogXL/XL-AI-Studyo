# F1 Çekirdek Mimari Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** DD:YZ'nin ana koduna yalnızca 6 işaretli satır ekleyerek, yeni modüllerin takılacağı `ext/` katmanını kurmak: API yönlendiricisi, iş kuyruğu, model/lisans kaydı, taşınabilir Python işçileri ve arayüzde bir "XL Stüdyo" sekmesi.

**Architecture:** `serve.cjs`, `/api/ext/*` isteklerini tek bir korumalı satırla `ext/server/index.cjs`'e devreder. Yeni sunucu kodu yalnızca Node.js standart kütüphanesini kullanır; ağır işler ayrı Python süreçlerinde (işçiler) çalışır. Arayüz eklentileri `app/frontend/src/ext/` altında yaşar ve `Sidebar.jsx` ile `App.jsx`'e birer satırla bağlanır.

**Tech Stack:** Node.js 22.12 (DD:YZ'nin taşınabilir sürümü), `node:test`, React 19 + Vite (mevcut), Python 3.11 (python-build-standalone), Python standart kütüphanesi (`http.server`).

**Spec:** `docs/tasarim.md` (bölümler: Temel ilkeler, Genel mimari, Teknoloji yığını, Çevrimdışı / çevrimiçi mod, Lisans uyumluluğu, Yol haritası F1)

## Global Constraints

- Ana koda dokunma: DD:YZ dosyalarında toplam **6** satır değişir, her biri `DDYZ-FORK` işareti taşır (`serve.cjs` 2, `Sidebar.jsx` 2, `App.jsx` 2). Bunun dışındaki tek istisnalar `README.md` (fork'un ön sayfası), `logo.txt` (başlatıcıların gösterdiği logo), `logo.png` ve `app/frontend/public/logo.png` (XLAi logosu) ve `app/frontend/package-lock.json`.
- Yeni sunucu kodu **npm bağımlılığı eklemez**; yalnızca Node.js standart kütüphanesi. (Tasarımdaki SQLite, Node 22.12'de `node:sqlite` bayraksız çalışmadığı ve `better-sqlite3` yerel derleme gerektirdiği için F1'de **JSONL dosyalarıyla** değiştirildi.)
- `ext` API'si yalnızca **GET ve POST** kullanır; DD:YZ'nin CORS ön kontrolü yalnızca bunlara izin veriyor. (Tasarımdaki `PUT` uç noktaları `POST` olur.)
- Çalışma verisi `ext/data/`, taşınabilir Python `ext/runtime/python/` altında durur; ikisi `ext/.gitignore` ile dışlanır. DD:YZ'nin `.gitignore`'una dokunulmaz.
- Çevrimdışı öncelik: Python kurulumu dışında hiçbir F1 özelliği internet istemez; telemetri yok.
- Arayüz metinleri DD:YZ gibi ASCII Türkçe yazılır (ör. "Model Yoneticisi").
- Testler: `node --test ext/tests/*.test.cjs` ve mevcut `node --test scripts/tests/issue-regressions.test.cjs` (6/6) her görevin sonunda geçer.

## Review Focus

1. `ext/` klasörü eksik veya `require` sırasında hata verirse DD:YZ yine açılmalı; yalnızca `/api/ext/*` çalışmaz (Görev 1'de test).
2. `POST /api/ext/jobs` bozuk JSON veya 1 MB'tan büyük gövde alırsa 400 dönmeli, sunucu çökmemeli (Görev 1 ve 2'de test).
3. Bir iş hata fırlatırsa işin durumu `failed` olmalı ve kuyruk sonraki işe geçmeli; sunucu yeniden başlarken yarım kalan `running` işler `failed` ("interrupted") olarak yüklenmeli (Görev 2'de test).
4. Python bulunamazsa iş anlaşılır bir mesajla `failed` olmalı; boşluk içeren klasör yollarında (ör. `D:\XL AI\`) işçi yine başlamalı (Görev 4'te test).
5. Sunucu kapanınca Python işçileri yetim süreç olarak kalmamalı (Görev 4'te test).

---

## Dosya yapısı

```
ext/
  .gitignore                 data/, runtime/
  README.md                  DDYZ-FORK satırlarının listesi, upstream senkron adımları
  server/
    index.cjs                handle(req,res), shutdown(); bileşenleri birleştirir
    http.cjs                 sendJson, readJsonBody, HttpError
    router.cjs               küçük GET/POST yönlendirici, :param desteği
    jobs.cjs                 iş kuyruğu + JSONL kalıcılık
    registry.cjs             model/lisans kaydı okuma, filtreleme, sha256
    python.cjs               Python bulma, işçi başlatma/durdurma
  registry/models.json       başlangıç model kaydı
  workers/echo_worker.py     test işçisi (stdlib http.server)
  setup/python-version.json  sabitlenmiş python-build-standalone sürümü, URL'ler, sha256
  setup/setup-python.sh
  setup/setup-python.ps1
  tools/fork-diff.cjs        upstream'den sapan DD:YZ dosyalarını listeler
  tests/*.test.cjs
app/frontend/src/ext/
  extApi.js                  fetch sarmalayıcıları
  ExtNavItems.jsx            kenar çubuğu girdisi
  ExtTabs.jsx                "XL Studyo" sekmesi
```

---

### Görev 1: ext sunucu iskeleti ve serve.cjs bağlantısı

**Files:**
- Create: `ext/.gitignore`, `ext/server/http.cjs`, `ext/server/router.cjs`, `ext/server/index.cjs`
- Modify: `scripts/server/serve.cjs` (dosyanın başındaki `require` bloğunun sonu; `if (req.url.startsWith("/api/")) { return json(res, 404, ...` satırının hemen üstü, şu an 7361. satır)
- Test: `ext/tests/router.test.cjs`, `ext/tests/serve-hook.test.cjs`

**Interfaces:**
- Produces:
  - `http.cjs`: `sendJson(res, code: number, obj: object): void` (DD:YZ'nin `json()` ile aynı başlıklar: `Content-Type: application/json`, `Access-Control-Allow-Origin: *`); `readJsonBody(req, { limitBytes = 1_000_000 } = {}): Promise<object>` (boş gövde → `{}`); `class HttpError extends Error { status: number }`.
  - `router.cjs`: `createRouter()` → `{ get(path, fn), post(path, fn), handle(req, res): Promise<boolean> }`; `fn(ctx)` imzası `ctx = { req, res, params, query, body }`; `body` yalnızca POST'ta okunur. Eşleşme yoksa `false` döner. `HttpError` yakalanır ve `{ ok:false, error }` + `status` olarak yazılır; diğer hatalar 500.
  - `index.cjs`: `module.exports = { handle(req, res): Promise<boolean>, shutdown(): Promise<void>, createExtServer(opts) }`. `opts = { dataDir, registryPath }`, varsayılanlar `ext/data` ve `ext/registry/models.json`. F1'in ilk rotası: `GET /api/ext/health` → `{ ok: true, name: "XL AI Studyo", extVersion: "0.1.0" }`.

- [ ] **Step 1: Yönlendirici testlerini yaz** (`ext/tests/router.test.cjs`)
  - `GET /api/ext/health` → `handle` `true` döner, gövde `{ ok: true, name: "XL AI Studyo", extVersion: "0.1.0" }`.
  - `GET /api/ext/yok` → `handle` `false` döner, yanıt yazılmaz.
  - `/api/ext/jobs/:id` deseni `/api/ext/jobs/abc` için `params.id === "abc"`.
  - Geçersiz JSON gövdeli POST → 400, `{ ok: false }`.
  - 1.000.001 baytlık gövde → 400.
  - Test için sahte `req` (`Readable.from([...])` + `method`, `url`) ve yazılan kod/gövdeyi yakalayan sahte `res`.

- [ ] **Step 2: Testi çalıştır, başarısız olduğunu gör**
  Run: `node --test ext/tests/router.test.cjs`
  Expected: FAIL, `Cannot find module '../server/router.cjs'`

- [ ] **Step 3: `http.cjs`, `router.cjs`, `index.cjs`'i yaz; `ext/.gitignore` içine `data/` ve `runtime/` ekle**

- [ ] **Step 4: serve.cjs bağlantı testini yaz** (`ext/tests/serve-hook.test.cjs`)
  - `scripts/server/serve.cjs` içinde tam olarak 2 satır `DDYZ-FORK` içerir.
  - `require` satırı `try { ... } catch` ile korunur: dosyada `let xlExt = null; try { xlExt = require("../../ext/server/index.cjs"); } catch (err) { console.warn("  [xl-ext] yuklenemedi:", err.message); } // DDYZ-FORK` metni geçer.
  - İstek satırı: `if (xlExt && req.url.startsWith("/api/ext/") && await xlExt.handle(req, res)) return; // DDYZ-FORK` metni, `"Unknown API endpoint"` satırından önce gelir.

- [ ] **Step 5: serve.cjs'e bu iki satırı ekle** (require satırı, dosyanın başındaki diğer `require`'ların hemen altına)

- [ ] **Step 6: Tüm testleri çalıştır**
  Run: `node --test ext/tests/*.test.cjs && node --test scripts/tests/issue-regressions.test.cjs`
  Expected: hepsi PASS; regresyon 6/6.

- [ ] **Step 7: Elle doğrula**
  Run: `node scripts/server/serve.cjs` (arka planda), sonra `curl -s localhost:1420/api/ext/health`
  Expected: `{"ok":true,"name":"XL AI Studyo","extVersion":"0.1.0"}`. Ardından `ext/` geçici olarak yeniden adlandırılıp sunucu tekrar başlatılınca `/api/health` yine 200 döner, `/api/ext/health` "Unknown API endpoint" (404) döner.

- [ ] **Step 8: Commit** — `feat(ext): ext sunucu iskeleti ve serve.cjs bağlantısı`

---

### Görev 2: İş kuyruğu

**Files:**
- Create: `ext/server/jobs.cjs`
- Modify: `ext/server/index.cjs` (kuyruğu oluştur, rotaları ekle)
- Test: `ext/tests/jobs.test.cjs`

**Interfaces:**
- Consumes: `createRouter`, `HttpError` (Görev 1).
- Produces:
  - `createJobQueue({ dataDir, runners })` → `{ submit(module, task, params): Job, get(id): Job | undefined, list({ limit = 50 } = {}): Job[], idle(): Promise<void> }`.
  - `runners` biçimi: `{ [module: string]: async (task: string, params: object, ctx: { jobId: string }) => any }`.
  - `Job = { id, module, task, params, status: "queued" | "running" | "done" | "failed", result?, error?, createdAt, startedAt?, finishedAt? }`; zamanlar ISO metni, `id` `crypto.randomUUID()`.
  - İşler **tek tek, sırayla** çalışır (VRAM kuralı: aynı anda tek ağır iş).
  - Kalıcılık: her durum değişikliği `dataDir/jobs.jsonl`'e bir satır olarak eklenir; açılışta dosya okunur, son durum geçerlidir, `running` kalanlar `failed` + `error: "interrupted"` olur.
  - Bilinmeyen `module` → `submit` `HttpError(400, "Bilinmeyen modul: <ad>")` fırlatır.
  - Yerleşik runner: `system` modülü, `echo` görevi `params`'ı aynen döndürür.
  - Rotalar: `POST /api/ext/jobs` (gövde `{ module, task, params }`) → `{ ok: true, job }`; `GET /api/ext/jobs` → `{ ok: true, jobs }`; `GET /api/ext/jobs/:id` → `{ ok: true, job }` veya 404.

- [ ] **Step 1: Testleri yaz** (geçici `dataDir` için `fs.mkdtempSync`)
  - `system/echo` gönderilir, `await q.idle()` sonrası `status === "done"`, `result` gönderilen `params`'a eşit.
  - Hata fırlatan runner → `status === "failed"`, `error` mesajı korunur; ardından gönderilen ikinci iş `done` olur.
  - İki iş aynı anda gönderilir; runner'da sayaç ile aynı anda en fazla 1 işin çalıştığı doğrulanır.
  - `jobs.jsonl`'e elle `running` durumunda bir satır yazılır; yeni kuyruk açılınca o iş `failed`, `error === "interrupted"`.
  - Bilinmeyen modül → 400 hatası.
  - Rota testi: `POST /api/ext/jobs` geçersiz JSON → 400; geçerli istek → 200 ve `job.id` dolu.

- [ ] **Step 2: Çalıştır, başarısız olduğunu gör** — `node --test ext/tests/jobs.test.cjs`, Expected: FAIL (modül yok)
- [ ] **Step 3: `jobs.cjs`'i yaz, `index.cjs`'e bağla**
- [ ] **Step 4: Tüm testler** — `node --test ext/tests/*.test.cjs`, Expected: PASS
- [ ] **Step 5: Commit** — `feat(ext): JSONL kalıcılıklı iş kuyruğu`

---

### Görev 3: Model ve lisans kaydı

**Files:**
- Create: `ext/server/registry.cjs`, `ext/registry/models.json`
- Modify: `ext/server/index.cjs`
- Test: `ext/tests/registry.test.cjs`

**Interfaces:**
- Produces:
  - `ModelEntry = { id, module, file, url, sha256: string | null, sizeBytes: number | null, license, commercial: boolean, source }`. `sha256: null` = "henüz doğrulanmadı".
  - `loadRegistry(filePath): ModelEntry[]` — `id`, `module`, `license` boş olan veya `commercial` boolean olmayan girdide, girdinin `id`'sini içeren bir hata fırlatır.
  - `filterRegistry(entries, { commercial?: boolean, module?: string }): ModelEntry[]`.
  - `sha256File(filePath): Promise<string>` (akışla okur, büyük dosyada bellek şişmez).
  - Rota: `GET /api/ext/models/registry?commercial=true&module=image` → `{ ok: true, models }`.

- [ ] **Step 1: Testleri yaz**
  - Geçerli örnek dosya yüklenir; `filterRegistry(..., { commercial: true })` yalnızca ticari girdileri döndürür.
  - `license` alanı eksik girdi → hata mesajında girdinin `id`'si geçer.
  - `sha256File`, içeriği `"abc"` olan geçici dosya için `ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad` döndürür.
  - Gerçek `ext/registry/models.json` hatasız yüklenir.
- [ ] **Step 2: Çalıştır, başarısız olduğunu gör**
- [ ] **Step 3: `registry.cjs`'i yaz; `models.json`'u DD:YZ'nin varsayılan modelleriyle doldur**
  Girdiler (URL'ler `serve.cjs` içindeki `DEFAULT_MODELS`'ten aynen alınır, `sha256: null`):
  - `sd15-default`: module `image`, file `v1-5-pruned-emaonly.safetensors`, license `CreativeML OpenRAIL-M`, commercial `true`.
  - `qwen25-coder-7b-q4`: module `llm`, license `Apache-2.0`, commercial `true`.
  - `whisper-base-en`: module `speech`, license `MIT`, commercial `true`.
  - `kokoro-82m-onnx-q8`: module `tts`, source `onnx-community/Kokoro-82M-v1.0-ONNX`, license `Apache-2.0`, commercial `true`.
- [ ] **Step 4: Tüm testler** — Expected: PASS
- [ ] **Step 5: Commit** — `feat(ext): model ve lisans kaydı`

---

### Görev 4: Taşınabilir Python ve işçi yöneticisi

**Files:**
- Create: `ext/server/python.cjs`, `ext/workers/echo_worker.py`, `ext/setup/python-version.json`, `ext/setup/setup-python.sh`, `ext/setup/setup-python.ps1`
- Modify: `ext/server/index.cjs` (`python-echo` runner'ı, `shutdown`)
- Test: `ext/tests/python.test.cjs`

**Interfaces:**
- Consumes: `createJobQueue` runner biçimi (Görev 2).
- Produces:
  - `resolvePython({ env = process.env, extRoot }): string | null` — sıra: `env.XLAI_PYTHON` → `extRoot/runtime/python/bin/python3` (Linux/macOS) veya `extRoot\runtime\python\python.exe` (Windows) → `null`. Sistem Python'una **düşmez** (taşınabilirlik).
  - `spawnWorker({ python, script, name, timeoutMs = 20000 }): Promise<{ name, port, proc, stop(): Promise<void> }>` — boş bir port seçer, `spawn(python, [script, "--port", String(port)])` (argüman dizisi, kabuk yok), `GET http://127.0.0.1:<port>/health` 200 dönene kadar bekler; süre dolarsa süreci öldürüp hata fırlatır.
  - `stopAllWorkers(): Promise<void>`; modül yüklenince `process.on("exit")` ile kalan işçileri senkron öldürür.
  - `echo_worker.py`: yalnızca stdlib; `GET /health` → `{"ok": true}`, `POST /echo` → gövdeyi aynen döndürür.
  - Runner: `system` modülüne `python-echo` görevi; Python yoksa `Error("Tasinabilir Python bulunamadi. ext/setup/setup-python betigini calistirin.")`.

- [ ] **Step 1: Testleri yaz** (`XLAI_PYTHON` olarak testte sistemdeki `python3` verilir)
  - `resolvePython({ env: {}, extRoot: <boş geçici klasör> })` → `null`.
  - `spawnWorker` ile echo işçisi başlar, `/echo` `{ "a": 1 }` için `{ "a": 1 }` döner, `stop()` sonrası `proc.exitCode !== null` veya `proc.signalCode !== null`.
  - Betik **adında boşluk olan** geçici bir klasöre kopyalanıp oradan başlatıldığında da çalışır.
  - Python yokken `system/python-echo` işi `failed`, `error` "Tasinabilir Python bulunamadi" ile başlar.
  - Ayrı bir alt Node sürecinde işçi başlatılıp alt süreç `process.exit()` ile kapanınca, işçinin PID'i 2 saniye içinde yaşamıyor (`process.kill(pid, 0)` hata fırlatır).
- [ ] **Step 2: Çalıştır, başarısız olduğunu gör**
- [ ] **Step 3: `python.cjs`'i ve `echo_worker.py`'yi yaz, runner'ı bağla**
- [ ] **Step 4: Tüm testler** — Expected: PASS
- [ ] **Step 5: Kurulum betikleri**
  - `python-version.json`: astral-sh/python-build-standalone'dan **uygulama sırasında doğrulanmış** bir CPython 3.11 `install_only` sürümü; `linux-x86_64`, `windows-x86_64`, `macos-arm64` için URL ve sha256.
  - `setup-python.sh` / `.ps1`: dosyayı indirir, sha256'yı doğrular, `ext/runtime/python/` altına açar; zaten varsa hiçbir şey yapmaz. DD:YZ'nin setup betikleriyle aynı mesaj tarzı (ASCII Türkçe).
  Run (Linux): `bash ext/setup/setup-python.sh && ext/runtime/python/bin/python3 --version`
  Expected: `Python 3.11.x`; ikinci çalıştırmada "zaten kurulu" mesajı.
- [ ] **Step 6: Commit** — `feat(ext): taşınabilir Python ve işçi yöneticisi`

---

### Görev 5: Arayüz: "XL Studyo" sekmesi

**Files:**
- Create: `app/frontend/src/ext/extApi.js`, `app/frontend/src/ext/ExtNavItems.jsx`, `app/frontend/src/ext/ExtTabs.jsx`
- Modify: `app/frontend/src/components/Sidebar.jsx` (import + "Model Yoneticisi" `nav-item`'ının hemen üstü), `app/frontend/src/App.jsx` (import + Settings sekmesi `div`'inin hemen altı)
- Test: `ext/tests/ext-api.test.cjs`, `ext/tests/frontend-hooks.test.cjs`

**Interfaces:**
- Consumes: `GET /api/ext/health`, `GET|POST /api/ext/jobs`, `GET /api/ext/models/registry` (Görev 1–3).
- Produces:
  - `extApi.js`: `getExtHealth()`, `listJobs()`, `submitJob(module, task, params)`, `getRegistry({ commercial } = {})`; her biri JSON döndürür, `ok: false` gelirse `Error(error)` fırlatır.
  - `ExtNavItems({ activeTab, setActiveTab })`: tek `nav-item`, sekme kimliği `"xl-studio"`, metin `"XL Studyo"`, lucide `Sparkles` simgesi (DD:YZ zaten `lucide-react` kullanıyor).
  - `ExtTabs({ activeTab })`: `activeTab === "xl-studio"` iken DD:YZ'nin diğer sekmeleriyle aynı `display` deseni. İçerik: ext sağlık durumu, son 20 iş (durum rozetiyle), "Test isi gonder" düğmesi (`system/echo`), model kaydı tablosu ve "Yalnizca ticari kullanima uygun" onay kutusu.

- [ ] **Step 1: Testleri yaz**
  - `ext-api.test.cjs`: `extApi.js` dinamik `import()` ile yüklenir, `global.fetch` sahtelenir; `submitJob("system","echo",{x:1})` doğru URL/gövdeyle POST atar; `ok:false` yanıtında hata fırlatır.
  - `frontend-hooks.test.cjs`: `Sidebar.jsx` ve `App.jsx` dosyalarının her birinde tam 2 satır `DDYZ-FORK` geçer; `App.jsx`'te `<ExtTabs activeTab={activeTab} />` bulunur.
- [ ] **Step 2: Çalıştır, başarısız olduğunu gör**
- [ ] **Step 3: Bileşenleri yaz ve 4 bağlantı satırını ekle** (JSX satırlarında işaret `{/* DDYZ-FORK */}` biçiminde)
- [ ] **Step 4: Testler ve derleme**
  Run: `node --test ext/tests/*.test.cjs && node --test scripts/tests/issue-regressions.test.cjs && (cd app/frontend && npm run build)`
  Expected: hepsi PASS, Vite derlemesi hatasız.
- [ ] **Step 5: Elle doğrula** — sunucu açıkken tarayıcıda "XL Studyo" sekmesi görünür, "Test isi gonder" ile gönderilen iş birkaç saniye içinde `done` olur; DD:YZ'nin diğer sekmeleri eskisi gibi çalışır.
- [ ] **Step 6: Commit** — `feat(ext): arayüzde XL Studyo sekmesi`

---

### Görev 6: Upstream senkron aracı ve ext belgeleri

**Files:**
- Create: `ext/tools/fork-diff.cjs`, `ext/README.md`
- Test: `ext/tests/fork-diff.test.cjs`

**Interfaces:**
- Produces: `node ext/tools/fork-diff.cjs [upstreamRef=upstream/main]` — `git diff --name-only <ref>` çıktısından `ext/`, `docs/`, `README.md`, `logo.txt`, `logo.png`, `app/frontend/public/logo.png`, `app/frontend/package-lock.json` dışındaki dosyaları listeler; her biri için `DDYZ-FORK` içermeyen değişmiş satır sayısını yazar. İzin verilmeyen bir sapma varsa çıkış kodu 1.
  - Saf fonksiyon: `classifyDiff(diffText: string): { file: string, unmarkedLines: number }[]` (birleşik diff metnini ayrıştırır; test edilebilirlik için dışa aktarılır).

- [ ] **Step 1: Testleri yaz** — örnek birleşik diff metninde: `DDYZ-FORK` işaretli eklenen satır sayılmaz; işaretsiz eklenen satır `unmarkedLines: 1` verir; `ext/` altındaki dosyalar hiç listelenmez.
- [ ] **Step 2: Çalıştır, başarısız olduğunu gör**
- [ ] **Step 3: `fork-diff.cjs`'i yaz**
- [ ] **Step 4: Gerçek repoda çalıştır**
  Run: `git fetch --depth 50 upstream main && node ext/tools/fork-diff.cjs`
  Expected: yalnızca `serve.cjs`, `Sidebar.jsx`, `App.jsx` listelenir, hepsinde `unmarkedLines: 0`, çıkış kodu 0.
- [ ] **Step 5: `ext/README.md`** — 6 `DDYZ-FORK` satırının dosya ve amaç listesi; upstream güncellemesini birleştirme adımları (`git fetch upstream`, `git merge upstream/main`, çakışmada DD:YZ'nin satırını koruyup işaretli satırı yeniden ekleme, ardından `fork-diff` ve testler).
- [ ] **Step 6: Tüm testler** — Expected: PASS
- [ ] **Step 7: Commit** — `chore(ext): upstream senkron aracı ve ext belgeleri`

---

## F1 geçiş kriteri (tasarım dokümanı)

"DD:YZ özellikleri değişmeden çalışır": regresyon testleri 6/6, `fork-diff` temiz, ve RTX 3060 Laptop'ta kullanıcı tarafından elle doğrulanmış olarak görsel üretim, sohbet, konuşma tanıma, TTS ve yeni "XL Studyo" sekmesi çalışır.
