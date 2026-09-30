param(
  [ValidateSet("Edge","Chrome","Both")]
  [string]$Browser = "Edge"
)

$ErrorActionPreference = "Stop"
$Version = "0.3.1"
$RepoZip = "https://github.com/jamienewton2269/ChatGPT_PSM/archive/refs/heads/main.zip"
$Base = Join-Path $env:LOCALAPPDATA "ProjectSessionManager"
$InstallDir = Join-Path $Base $Version
$TempDir = Join-Path $env:TEMP ("ProjectSessionManager-" + [guid]::NewGuid().ToString("N"))
$ZipPath = Join-Path $TempDir "ChatGPT_PSM-main.zip"
$ExtractDir = Join-Path $TempDir "extract"

Write-Host ""
Write-Host "Project Session Manager v$Version" -ForegroundColor Cyan
Write-Host "Browser extension installer" -ForegroundColor Cyan
Write-Host ""

New-Item -ItemType Directory -Force -Path $TempDir | Out-Null
New-Item -ItemType Directory -Force -Path $ExtractDir | Out-Null

try {
    Write-Host "[1/4] Downloading current public release source..."
    Invoke-WebRequest -Uri $RepoZip -OutFile $ZipPath -UseBasicParsing

    Write-Host "[2/4] Extracting..."
    Expand-Archive -Path $ZipPath -DestinationPath $ExtractDir -Force

    $Source = Join-Path $ExtractDir "ChatGPT_PSM-main"
    if (-not (Test-Path (Join-Path $Source "manifest.json"))) {
        throw "Downloaded package does not contain manifest.json."
    }

    Write-Host "[3/4] Installing to $InstallDir"
    if (Test-Path $InstallDir) {
        Remove-Item -Recurse -Force $InstallDir
    }
    New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null

    # Copy only files required by the unpacked extension plus public documentation.
    $items = @(
        "manifest.json",
        "background.js",
        "content.js",
        "content.css",
        "popup.html",
        "popup.js",
        "popup.css",
        "options.html",
        "options.js",
        "v031.js",
        "README.md",
        "LICENSE",
        "PRIVACY.md",
        "CHANGELOG.md",
        "ARTWORK_NOTICE.md"
    )
    foreach ($item in $items) {
        $p = Join-Path $Source $item
        if (Test-Path $p) { Copy-Item $p $InstallDir -Force }
    }
    if (Test-Path (Join-Path $Source "assets")) {
        Copy-Item (Join-Path $Source "assets") (Join-Path $InstallDir "assets") -Recurse -Force
    }

    Write-Host "[4/4] Opening browser extension manager..."
    Set-Clipboard -Value $InstallDir

    if ($Browser -eq "Edge" -or $Browser -eq "Both") {
        Start-Process "msedge.exe" "edge://extensions" -ErrorAction SilentlyContinue
    }
    if ($Browser -eq "Chrome" -or $Browser -eq "Both") {
        Start-Process "chrome.exe" "chrome://extensions" -ErrorAction SilentlyContinue
    }

    Write-Host ""
    Write-Host "Installation files are ready." -ForegroundColor Green
    Write-Host ""
    Write-Host "For security, Chrome and Edge do not allow a normal script to silently enable an unpacked extension."
    Write-Host "In the extension page:"
    Write-Host "  1. Enable Developer mode"
    Write-Host "  2. Choose 'Load unpacked'"
    Write-Host "  3. Paste/select this folder:"
    Write-Host "     $InstallDir" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "The folder path has also been copied to the clipboard."
    Write-Host "Refresh any already-open ChatGPT tabs after loading the extension."
    Write-Host ""
}
finally {
    if (Test-Path $TempDir) {
        Remove-Item -Recurse -Force $TempDir -ErrorAction SilentlyContinue
    }
}
