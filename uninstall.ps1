$ErrorActionPreference = 'Stop'
$dst = Join-Path $env:USERPROFILE '.gemini\config\plugins\agy-file-hub'
if (Test-Path $dst) {
  Remove-Item -Path $dst -Recurse -Force
  Write-Host "Uninstalled Antigravity File Hub from $dst" -ForegroundColor Green
} else {
  Write-Host "Antigravity File Hub is not installed at $dst" -ForegroundColor Yellow
}
