$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$envPath = Join-Path $repoRoot ".env"

$vars = @{}
if (Test-Path $envPath) {
  Get-Content $envPath | ForEach-Object {
    $line = $_.Trim()
    if (-not $line) { return }
    if ($line.StartsWith("#")) { return }
    $parts = $line.Split("=", 2)
    if ($parts.Length -ne 2) { return }
    $key = $parts[0].Trim()
    $value = $parts[1].Trim().Trim('"')
    if ($key) { $vars[$key] = $value }
  }
}

$baseUrl = $null
if ($vars.ContainsKey("NEXT_PUBLIC_SITE_URL")) { $baseUrl = $vars["NEXT_PUBLIC_SITE_URL"] }
if (-not $baseUrl -and $vars.ContainsKey("NEXTAUTH_URL")) { $baseUrl = $vars["NEXTAUTH_URL"] }
if (-not $baseUrl) { $baseUrl = "http://localhost:3000" }

$endpoint = "$baseUrl/api/skins/cron"
$headers = @{}
if ($vars.ContainsKey("CRON_SECRET") -and $vars["CRON_SECRET"]) {
  $headers["x-cron-secret"] = $vars["CRON_SECRET"]
}

Write-Host "Calling $endpoint"
try {
  $response = Invoke-WebRequest -Uri $endpoint -Method Post -Headers $headers -TimeoutSec 30
  Write-Host "Status: $($response.StatusCode)"
  Write-Host $response.Content
} catch {
  Write-Error $_
  exit 1
}
