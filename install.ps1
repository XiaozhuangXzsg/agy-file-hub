$ErrorActionPreference = 'Stop'
$src = Split-Path -Parent $MyInvocation.MyCommand.Path
$dst = Join-Path $env:USERPROFILE '.gemini\config\plugins\agy-file-hub'

Write-Host "Installing Antigravity File Hub -> $dst" -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path $dst | Out-Null

$copyItems = @('plugin.json','package.json','README.md','README_EN.md','LICENSE','assets','rules','skills','sidecars','lib','ui')
foreach ($item in $copyItems) {
  $from = Join-Path $src $item
  if (Test-Path $from) {
    Copy-Item -Path $from -Destination $dst -Recurse -Force
  }
}

Write-Host "Installed successfully!" -ForegroundColor Green
Write-Host "Open Antigravity -> Customizations -> Enable 'Antigravity File Hub', then click the File Hub side-pane tab." -ForegroundColor Gray
