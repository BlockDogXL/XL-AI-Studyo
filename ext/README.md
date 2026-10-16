# ext/ — XL AI Stüdyo eklenti katmanı

XL AI Stüdyo'nun bütün yeni kodu burada (sunucu) ve `app/frontend/src/ext/` altında (arayüz) yaşar. DD:YZ'nin kendi dosyalarına yalnızca aşağıdaki işaretli satırlar eklenir. Böylece DD:YZ'nin yeni sürümleri az çakışmayla birleştirilebilir.

## DD:YZ dosyalarındaki bağlantı satırları

| Dosya | Satır | Amaç |
| --- | --- | --- |
| `scripts/server/serve.cjs` | `let xlExt = null; try { xlExt = require(...) } ... // DDYZ-FORK` | ext sunucusunu yükler; `ext/` eksik veya bozuksa DD:YZ yine açılır |
| `scripts/server/serve.cjs` | `if (xlExt && req.url.startsWith("/api/ext/") && ...) return; // DDYZ-FORK` | `/api/ext/*` isteklerini ext'e devreder ("Unknown API endpoint" satırından önce) |
| `app/frontend/src/components/Sidebar.jsx` | `import ExtNavItems ... // DDYZ-FORK` | Kenar çubuğu girdisini içe aktarır |
| `app/frontend/src/components/Sidebar.jsx` | `<ExtNavItems ... /> {/* DDYZ-FORK */}` | "XL Studyo" girdisi, "Model Yoneticisi"nin hemen üstünde |
| `app/frontend/src/App.jsx` | `import ExtTabs ... // DDYZ-FORK` | Sekme içeriklerini içe aktarır |
| `app/frontend/src/App.jsx` | `<ExtTabs activeTab={activeTab} /> {/* DDYZ-FORK */}` | Sekmeler, Ayarlar sekmesinin hemen altında |

Marka (isim ve logo) değişiklikleri `XLAI-BRAND` işaretiyle ayrıca işaretlenir.

DD:YZ'den bilerek farklı tutulan dosyalar: `README.md`, `logo.txt`, `logo.png`, `app/frontend/public/logo.png`, `app/frontend/package-lock.json`.

## Klasörler

| Klasör | İçerik |
| --- | --- |
| `server/` | `index.cjs` (giriş), `router.cjs`, `http.cjs`, `jobs.cjs` (iş kuyruğu), `registry.cjs` (model/lisans kaydı), `python.cjs` (Python işçileri) |
| `registry/models.json` | Model ve lisans kaydı |
| `workers/` | Python işçileri (her biri `--port` alan küçük bir HTTP sunucusu) |
| `setup/` | Taşınabilir Python kurulumu (`setup-python.sh`, `setup-python.ps1`, sabitlenmiş sürüm `python-version.json`) |
| `tools/fork-diff.cjs` | DD:YZ'ye olan sapmaları denetler |
| `tests/` | `node --test ext/tests/*.test.cjs` |
| `data/`, `runtime/` | Çalışma verisi ve taşınabilir Python (git'e girmez) |

## DD:YZ güncellemesini birleştirme

```bash
git fetch upstream
git merge upstream/main
# Çakışma olursa: DD:YZ'nin yeni satırını koruyun, işaretli satırı yeniden ekleyin.
node ext/tools/fork-diff.cjs            # yalnızca işaretli satırlar sapmalı, çıkış kodu 0
node --test ext/tests/*.test.cjs
node --test scripts/tests/issue-regressions.test.cjs
```

## Taşınabilir Python

```bash
bash ext/setup/setup-python.sh                                        # Linux / macOS
powershell -ExecutionPolicy Bypass -File ext\setup\setup-python.ps1   # Windows
```

Python, sisteme değil `ext/runtime/python/` altına kurulur; stüdyo sistem Python'unu kullanmaz. Geliştirme için `XLAI_PYTHON` ortam değişkeniyle başka bir Python gösterilebilir.
