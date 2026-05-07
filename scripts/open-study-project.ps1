param(
  [string]$ProjectFile = "mgt-011a-accounting-cram.json",
  [string]$Section = "ch2-scenarios",
  [string]$ReminderName = "Accounting",
  [string]$Until = "2026-05-06T00:00:00-07:00",
  [int]$Port = 3000
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$LogDir = Join-Path $ProjectRoot "logs"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$LauncherLog = Join-Path $LogDir "study-reminder.log"
$DevLog = Join-Path $LogDir "study-tool-dev.log"

function Write-StudyLog {
  param([string]$Message)
  $stamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  Add-Content -Path $LauncherLog -Value "[$stamp] $Message"
}

if ($Until) {
  $untilTime = [DateTimeOffset]::Parse($Until)
  if ([DateTimeOffset]::Now -gt $untilTime) {
    Write-StudyLog "Skipped expired reminder for $ProjectFile; until=$Until"
    exit 0
  }
}

function Test-StudyServer {
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$Port/" -TimeoutSec 2
    return $response.StatusCode -ge 200 -and $response.StatusCode -lt 500
  } catch {
    return $false
  }
}

if (-not (Test-StudyServer)) {
  Write-StudyLog "Starting study-tool dev server on port $Port"
  $rootLiteral = $ProjectRoot.Replace("'", "''")
  $devLogLiteral = $DevLog.Replace("'", "''")
  $command = "Set-Location -LiteralPath '$rootLiteral'; npm run dev -- --host 127.0.0.1 *> '$devLogLiteral'"
  Start-Process powershell.exe -WindowStyle Hidden -ArgumentList @(
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    $command
  ) | Out-Null

  $ready = $false
  for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 1
    if (Test-StudyServer) {
      $ready = $true
      break
    }
  }
  if (-not $ready) {
    Write-StudyLog "Server did not become ready on port $Port"
    exit 1
  }
}

$query = [ordered]@{
  projectFile = $ProjectFile
  section = $Section
  studyReminder = $ReminderName
  forceProjectConfig = "1"
}
$queryString = ($query.GetEnumerator() | ForEach-Object {
  "{0}={1}" -f [uri]::EscapeDataString($_.Key), [uri]::EscapeDataString([string]$_.Value)
}) -join "&"
$url = "http://localhost:$Port/?$queryString"
Write-StudyLog "Opening $url"
Start-Process $url
