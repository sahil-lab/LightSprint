$ErrorActionPreference = 'Stop'
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$ComposeFile = Join-Path (Join-Path (Join-Path $ProjectRoot 'infra') 'docker') 'compose.yaml'
$EnvFile = Join-Path $ProjectRoot '.env'
$Artifacts = Join-Path $ProjectRoot 'artifacts'
$Compose = @('compose', '--env-file', $EnvFile, '-p', 'lightsprint', '-f', $ComposeFile)
$PreviousLocation = Get-Location
$PreviousParallelLimit = $env:COMPOSE_PARALLEL_LIMIT
$PreviousTestUid = $env:LIGHTSPRINT_TEST_UID
$PreviousTestGid = $env:LIGHTSPRINT_TEST_GID
$Client = $null
$TestDatabaseStarted = $false
$TranscriptStarted = $false

function Invoke-Compose {
    param([string[]]$Arguments)
    $CommandText = "docker compose --env-file .env -p lightsprint -f infra/docker/compose.yaml " + ($Arguments -join ' ')
    Write-Host $CommandText
    Add-Content -LiteralPath $NativeLog -Value $CommandText -Encoding UTF8
    & docker @Compose @Arguments | ForEach-Object {
        Add-Content -LiteralPath $NativeLog -Value $_ -Encoding UTF8
        Write-Output $_
    }
    if ($LASTEXITCODE -ne 0) {
        throw "LightSprint Compose command failed with exit code ${LASTEXITCODE}: $($Arguments -join ' ')"
    }
    Add-Content -LiteralPath $NativeLog -Value 'Exit code: 0' -Encoding UTF8
}

function Get-HttpResult {
    param([string]$Url)
    $Response = $Client.GetAsync($Url).GetAwaiter().GetResult()
    try {
        return [pscustomobject]@{
            Status = [int]$Response.StatusCode
            Body = $Response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
        }
    }
    finally {
        $Response.Dispose()
    }
}

function Assert-Http {
    param([string]$Url, [int]$ExpectedStatus, [string]$ExpectedHealth)
    $Result = Get-HttpResult -Url $Url
    Write-Host ("GET {0} -> HTTP {1} {2}" -f $Url, $Result.Status, $Result.Body)
    if ($Result.Status -ne $ExpectedStatus) {
        throw "Expected HTTP $ExpectedStatus from $Url, received $($Result.Status)."
    }
    if ($ExpectedHealth -and ($Result.Body | ConvertFrom-Json).status -ne $ExpectedHealth) {
        throw "Unexpected health response from $Url."
    }
}

try {
    Set-Location $ProjectRoot
    $env:COMPOSE_PARALLEL_LIMIT = '1'
    if ($env:OS -ne 'Windows_NT') {
        $env:LIGHTSPRINT_TEST_UID = (& id -u).Trim()
        if ($LASTEXITCODE -ne 0) { throw 'Cannot determine test artifact owner.' }
        $env:LIGHTSPRINT_TEST_GID = (& id -g).Trim()
        if ($LASTEXITCODE -ne 0) { throw 'Cannot determine test artifact group.' }
    }
    New-Item -ItemType Directory -Path $Artifacts -Force | Out-Null
    New-Item -ItemType Directory -Path (Join-Path $Artifacts 'e2e') -Force | Out-Null
    $Log = Join-Path $Artifacts ("verify-" + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.log')
    $NativeLog = $Log.Replace('.log', '-commands.log')
    Start-Transcript -Path $Log | Out-Null
    $TranscriptStarted = $true

    & (Join-Path $PSScriptRoot 'Initialize-Local.ps1')
    & docker version --format 'Docker server {{.Server.Version}} / {{.Server.Os}}'
    if ($LASTEXITCODE -ne 0) { throw 'Docker is unavailable.' }
    Invoke-Compose -Arguments @('config', '--quiet')

    Write-Host 'Checking dependencies before restoring only missing or inconsistent installations.'
    & docker @Compose --profile tools run --rm --no-deps web-tool npm ls --depth=0
    if ($LASTEXITCODE -ne 0) {
        Invoke-Compose -Arguments @('--profile', 'tools', 'run', '--rm', '--no-deps', 'web-tool', 'npm', 'ci', '--no-fund', '--no-audit')
    }
    & docker @Compose --profile tools run --rm --no-deps e2e-tool npm ls --depth=0
    if ($LASTEXITCODE -ne 0) {
        Invoke-Compose -Arguments @('--profile', 'tools', 'run', '--rm', '--no-deps', 'e2e-tool', 'npm', 'ci', '--no-fund', '--no-audit')
    }

    Invoke-Compose -Arguments @('--profile', 'tools', 'run', '--rm', '--no-deps', 'web-tool', 'npm', 'run', 'format:check')
    $TestDatabaseStarted = $true
    Invoke-Compose -Arguments @('--profile', 'tools', 'run', '--rm', 'api-tool', 'mvn', '-B', '-ntp', 'verify')
    Invoke-Compose -Arguments @('stop', 'test-db')
    $TestDatabaseStarted = $false
    Invoke-Compose -Arguments @('--profile', 'tools', 'run', '--rm', '--no-deps', 'web-tool', 'npm', 'test')
    Invoke-Compose -Arguments @('--profile', 'tools', 'run', '--rm', '--no-deps', 'web-tool', 'npm', 'run', 'build')
    Invoke-Compose -Arguments @('build', 'api', 'web')
    # The web server must start while the API's host name cannot be resolved, which is the
    # case whenever the web container is started before the API container.
    Write-Host 'docker run --rm --network none --entrypoint nginx lightsprint-web:local -t'
    & docker run --rm --network none --memory 64m --cpus 0.25 --pids-limit 64 --entrypoint nginx lightsprint-web:local -t
    if ($LASTEXITCODE -ne 0) { throw 'The web server cannot start without a resolvable API host name.' }
    Invoke-Compose -Arguments @('up', '-d', '--wait', '--wait-timeout', '180', 'db', 'api', 'web')

    Add-Type -AssemblyName System.Net.Http
    $Handler = New-Object System.Net.Http.HttpClientHandler
    $Handler.UseProxy = $false
    $Client = [System.Net.Http.HttpClient]::new($Handler)
    $Client.Timeout = [TimeSpan]::FromSeconds(15)
    Assert-Http -Url 'http://127.0.0.1:18105/healthz' -ExpectedStatus 200
    Assert-Http -Url 'http://127.0.0.1:18205/actuator/health/readiness' -ExpectedStatus 200 -ExpectedHealth 'UP'
    Assert-Http -Url 'http://127.0.0.1:18205/api/v1/system' -ExpectedStatus 200

    $InspectIds = & docker @Compose ps -q db api web
    if ($LASTEXITCODE -ne 0) { throw 'Cannot inspect LightSprint containers.' }
    if (@($InspectIds).Count -ne 3) { throw 'Expected three running application services.' }
    $PrivateNetwork = & docker network inspect lightsprint_private --format '{{.Internal}}'
    if ($LASTEXITCODE -ne 0 -or $PrivateNetwork -ne 'true') { throw 'Runtime network must be internal.' }
    foreach ($ContainerId in $InspectIds) {
        $Raw = & docker inspect $ContainerId
        if ($LASTEXITCODE -ne 0) { throw "Cannot inspect container $ContainerId." }
        $Inspection = ($Raw | ConvertFrom-Json)[0]
        $Service = $Inspection.Config.Labels.'com.docker.compose.service'
        if ($Inspection.Config.Labels.'com.docker.compose.project' -ne 'lightsprint') {
            throw 'Unexpected Compose ownership.'
        }
        if ($Inspection.HostConfig.Memory -le 0 -or $Inspection.HostConfig.NanoCpus -le 0 -or $Inspection.HostConfig.PidsLimit -le 0) {
            throw "Missing resource ceiling on $Service."
        }
        $Bindings = @($Inspection.NetworkSettings.Ports.PSObject.Properties | Where-Object { $null -ne $_.Value -and @($_.Value).Count -gt 0 })
        if ($Service -eq 'db' -and $Bindings.Count -gt 0) { throw 'Database host port is forbidden.' }
        if ($Service -ne 'db' -and $Bindings.Count -ne 1) { throw "Expected one loopback binding on $Service." }
        foreach ($Binding in $Bindings) {
            foreach ($Port in $Binding.Value) {
                if ($Port.HostIp -ne '127.0.0.1') { throw "Non-loopback port on $Service." }
                $ExpectedPort = if ($Service -eq 'api') { '18205' } else { '18105' }
                if ($Port.HostPort -ne $ExpectedPort) { throw "Unexpected host port on $Service." }
            }
        }
        if ($Service -ne 'db' -and @($Inspection.Mounts | Where-Object { $_.Type -eq 'bind' }).Count -gt 0) {
            throw "Unexpected host bind mount on application service $Service."
        }
        Write-Host ("Isolation verified: {0}, memory={1}, nanoCPUs={2}, pids={3}" -f $Service, $Inspection.HostConfig.Memory, $Inspection.HostConfig.NanoCpus, $Inspection.HostConfig.PidsLimit)
    }

    $SnapshotQuery = "SELECT schema_version::text || '|' || created_at::text FROM app_metadata WHERE id = 1;"
    $Before = Invoke-Compose -Arguments @('exec', '-T', 'db', 'psql', '-U', 'lightsprint', '-d', 'lightsprint', '-Atc', $SnapshotQuery)
    try {
        Invoke-Compose -Arguments @('stop', 'db')
        Assert-Http -Url 'http://127.0.0.1:18205/actuator/health/readiness' -ExpectedStatus 503 -ExpectedHealth 'DOWN'
        Assert-Http -Url 'http://127.0.0.1:18205/api/v1/system' -ExpectedStatus 503
        Assert-Http -Url 'http://127.0.0.1:18205/actuator/health/liveness' -ExpectedStatus 200 -ExpectedHealth 'UP'
    }
    finally {
        Invoke-Compose -Arguments @('up', '-d', '--wait', '--wait-timeout', '180', 'db', 'api', 'web')
    }
    Invoke-Compose -Arguments @('restart', 'api')
    Invoke-Compose -Arguments @('up', '-d', '--wait', '--wait-timeout', '180', 'db', 'api', 'web')
    $After = Invoke-Compose -Arguments @('exec', '-T', 'db', 'psql', '-U', 'lightsprint', '-d', 'lightsprint', '-Atc', $SnapshotQuery)
    if (($Before -join "`n") -ne ($After -join "`n") -or -not $Before) {
        throw 'Bootstrap metadata was not retained across database/application restarts.'
    }
    $Migrations = Invoke-Compose -Arguments @('exec', '-T', 'db', 'psql', '-U', 'lightsprint', '-d', 'lightsprint', '-Atc', "SELECT count(*) FROM flyway_schema_history WHERE version = '1' AND success;")
    if (($Migrations -join '').Trim() -ne '1') { throw 'Expected exactly one successful version-1 migration.' }
    Write-Host ("Persistence verified: unchanged bootstrap row {0}; one successful migration." -f ($After -join ''))

    Invoke-Compose -Arguments @('--profile', 'tools', 'run', '--rm', '--no-deps', 'e2e')
    Invoke-Compose -Arguments @('ps')
    Write-Host 'VERIFIED: formatting, compilation, unit/integration tests, isolation, persistence, failure/recovery and real Chromium smoke.'
    Write-Host 'Phase 0 Git exception remains: no Git repository initialized. Remote CI was not run.'
    Write-Host "Evidence: $Log"
    Write-Host "Native command output: $NativeLog"
}
finally {
    if ($TestDatabaseStarted) {
        Invoke-Compose -Arguments @('stop', 'test-db')
    }
    if ($null -ne $Client) { $Client.Dispose() }
    if ($TranscriptStarted) { Stop-Transcript | Out-Null }
    $env:COMPOSE_PARALLEL_LIMIT = $PreviousParallelLimit
    $env:LIGHTSPRINT_TEST_UID = $PreviousTestUid
    $env:LIGHTSPRINT_TEST_GID = $PreviousTestGid
    Set-Location $PreviousLocation
}
