$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$manifest = Get-Content -LiteralPath (Join-Path $projectRoot 'manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$packageDir = Join-Path $projectRoot 'dist'
New-Item -ItemType Directory -Path $packageDir -Force | Out-Null
$package = Join-Path $packageDir ("x-focus-reader-$($manifest.version).zip")
$files = @('manifest.json', 'background.js', 'content.js', 'focus.css', 'icons')
Push-Location $projectRoot
try {
  Compress-Archive -Path $files -DestinationPath $package -Force
} finally {
  Pop-Location
}
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead($package)
try {
  $entries = @($zip.Entries | ForEach-Object FullName)
  foreach ($required in @('manifest.json', 'icons/icon128.png', 'background.js', 'content.js', 'focus.css')) {
    if ($entries -notcontains $required) { throw "Missing ZIP entry: $required" }
  }
} finally {
  $zip.Dispose()
}
Write-Output $package
