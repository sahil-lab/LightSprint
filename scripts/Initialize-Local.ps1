$ErrorActionPreference = 'Stop'
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$EnvFile = Join-Path $ProjectRoot '.env'

if (Test-Path -LiteralPath $EnvFile) {
    Write-Host 'Keeping existing LightSprint local environment; no credentials printed.'
    return
}

$Random = [System.Security.Cryptography.RandomNumberGenerator]::Create()
try {
    $Bytes = New-Object byte[] 32
    $Random.GetBytes($Bytes)
    $Password = [BitConverter]::ToString($Bytes).Replace('-', '').ToLowerInvariant()
    $Encoding = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText(
        $EnvFile,
        "LIGHTSPRINT_DB_PASSWORD=$Password`n",
        $Encoding
    )
}
finally {
    $Random.Dispose()
}

Write-Host 'Created ignored LightSprint-only .env with a random local database password.'
