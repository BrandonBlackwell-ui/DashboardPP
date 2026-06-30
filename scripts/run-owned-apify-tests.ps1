param(
  [Parameter(Mandatory=$true)]
  [string]$Token
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

function Invoke-ApifyJson {
  param(
    [Parameter(Mandatory=$true)][string]$Method,
    [Parameter(Mandatory=$true)][string]$Uri,
    [object]$Body = $null
  )

  $attempts = 3
  for ($i = 1; $i -le $attempts; $i++) {
    try {
      if ($Body -ne $null) {
        $json = $Body | ConvertTo-Json -Depth 20 -Compress
        return Invoke-RestMethod -Method $Method -Uri $Uri -ContentType 'application/json' -Body $json -TimeoutSec 240
      }
      return Invoke-RestMethod -Method $Method -Uri $Uri -TimeoutSec 60
    } catch {
      if ($i -eq $attempts) { throw }
      Start-Sleep -Seconds (2 * $i)
    }
  }
}

function Run-Actor {
  param(
    [Parameter(Mandatory=$true)][string]$ActorId,
    [Parameter(Mandatory=$true)][double]$MaxCharge,
    [Parameter(Mandatory=$true)][object]$ActorInput
  )

  $encodedActor = $ActorId.Replace('/', '~')
  $runUri = "https://api.apify.com/v2/acts/$encodedActor/runs?token=$Token&waitForFinish=180&maxTotalChargeUsd=$MaxCharge"
  Write-Output "RUN $ActorId"
  $run = Invoke-ApifyJson -Method 'POST' -Uri $runUri -Body $ActorInput
  $data = $run.data
  $datasetId = $data.defaultDatasetId
  $items = @()
  if ($datasetId) {
    $itemsUri = "https://api.apify.com/v2/datasets/$datasetId/items?token=$Token&clean=true"
    $items = @(Invoke-ApifyJson -Method 'GET' -Uri $itemsUri)
  }

  [pscustomobject]@{
    actor = $ActorId
    runId = $data.id
    status = $data.status
    defaultDatasetId = $datasetId
    itemCount = $items.Count
    items = @($items | Select-Object -First 3)
  }
}

$tests = @(
  @{
    ActorId = 'scraper_one/x-profile-posts-scraper'
    MaxCharge = 0.04
    Input = @{
      profileUrls = @('https://x.com/PepeAguilar')
      resultsLimit = 10
      skipPinnedPosts = $true
    }
  },
  @{
    ActorId = 'apify/facebook-pages-scraper'
    MaxCharge = 0.04
    Input = @{
      startUrls = @(@{ url = 'https://www.facebook.com/pepeaguilaroficial/?locale=es_LA' })
      maxItems = 1
    }
  },
  @{
    ActorId = 'clockworks/tiktok-profile-scraper'
    MaxCharge = 0.03
    Input = @{
      profiles = @('pepeaguilar_oficial')
      resultsPerPage = 13
      shouldDownloadCovers = $false
      shouldDownloadSlideshowImages = $false
      shouldDownloadSubtitles = $false
      shouldDownloadVideos = $false
    }
  }
)

$results = @()
foreach ($test in $tests) {
  try {
    $results += Run-Actor -ActorId $test.ActorId -MaxCharge $test.MaxCharge -ActorInput $test.Input
  } catch {
    $results += [pscustomobject]@{
      actor = $test.ActorId
      error = $_.Exception.Message
    }
  }
}

$outDir = Join-Path $PSScriptRoot '..\src\data'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$outFile = Join-Path $outDir 'owned-apify-test-results.json'
$results | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath $outFile -Encoding UTF8
Write-Output "WROTE $outFile"
$results | ConvertTo-Json -Depth 8
