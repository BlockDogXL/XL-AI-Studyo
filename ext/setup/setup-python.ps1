# XL AI Studyo - tasinabilir Python kurulumu (Windows).
# Python'u sisteme degil, ext\runtime\python\ klasorune kurar.
# Calistirma: powershell -ExecutionPolicy Bypass -File ext\setup\setup-python.ps1
$ErrorActionPreference = "Stop"
# PowerShell 5.1'de ilerleme cubugu indirmeyi cok yavaslatir.
$ProgressPreference = 'SilentlyContinue'

$SetupDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ExtDir = Split-Path -Parent $SetupDir
$Target = Join-Path $ExtDir "runtime\python"
$PythonExe = Join-Path $Target "python.exe"

if (Test-Path $PythonExe) {
    Write-Host "  [OK] Tasinabilir Python zaten kurulu: $(& $PythonExe --version)"
    exit 0
}

$Config = Get-Content (Join-Path $SetupDir "python-version.json") -Raw | ConvertFrom-Json
$Entry = $Config.'windows-x86_64'
$RuntimeDir = Join-Path $ExtDir "runtime"
New-Item -ItemType Directory -Force -Path $RuntimeDir | Out-Null
$TmpFile = Join-Path $RuntimeDir "python-download.tar.gz.part"

Write-Host "  [INFO] Tasinabilir Python indiriliyor (windows-x86_64)..."
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
Invoke-WebRequest -Uri $Entry.url -OutFile $TmpFile -UseBasicParsing

$Actual = (Get-FileHash -Algorithm SHA256 $TmpFile).Hash.ToLower()
if ($Actual -ne $Entry.sha256) {
    Remove-Item -Force $TmpFile
    Write-Host "  [HATA] SHA-256 uyusmadi. Beklenen $($Entry.sha256), gelen $Actual"
    exit 1
}

$Staging = "$Target.tmp"
if (Test-Path $Staging) { Remove-Item -Recurse -Force $Staging }
New-Item -ItemType Directory -Force -Path $Staging | Out-Null
# Windows 10 1803+ icinde tar.exe yerlesik gelir. Tam yol kullanilir; PATH'teki
# Git/MSYS tar'i "C:\..." yolunu uzak sunucu sanip basarisiz olur.
& "$env:SystemRoot\System32\tar.exe" -xzf $TmpFile -C $Staging
if ($LASTEXITCODE -ne 0) { throw "tar ile acma basarisiz oldu (cikis kodu $LASTEXITCODE)" }
Move-Item (Join-Path $Staging "python") $Target
Remove-Item -Recurse -Force $Staging
Remove-Item -Force $TmpFile
Write-Host "  [OK] Tasinabilir Python kuruldu: $(& $PythonExe --version)"
