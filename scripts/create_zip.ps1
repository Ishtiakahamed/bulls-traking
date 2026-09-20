$targetZip = "D:\bulltrack\bulls-traking-latest.zip"
$sourceDir = "D:\bulltrack"

if (Test-Path $targetZip) {
    Remove-Item -Force $targetZip
}

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$zipStream = [System.IO.File]::Open($targetZip, [System.IO.FileMode]::CreateNew)
$archive = New-Object System.IO.Compression.ZipArchive($zipStream, [System.IO.Compression.ZipArchiveMode]::Create)

$excludeDirs = @("node_modules", ".git", "scratch", ".tempmediaStorage", ".user_uploaded")
$excludeExts = @(".zip", ".db-wal", ".db-shm")

$allFiles = Get-ChildItem -Path $sourceDir -Recurse -File -Force

$count = 0
foreach ($file in $allFiles) {
    $relative = $file.FullName.Substring($sourceDir.Length + 1)
    
    # Check directory exclusion
    $skip = $false
    foreach ($d in $excludeDirs) {
        if ($relative.StartsWith($d + "\") -or $relative.StartsWith($d + "/") -or $relative -eq $d) {
            $skip = $true
            break
        }
    }
    if ($skip) { continue }
    
    # Check extension exclusion
    if ($excludeExts -contains $file.Extension.ToLower()) {
        continue
    }
    
    $entryName = $relative.Replace("\", "/")
    $compressionLevel = [System.IO.Compression.CompressionLevel]::Optimal
    
    try {
        # Open file with FileShare.ReadWrite so even active database files copy without lock errors
        $entry = $archive.CreateEntry($entryName, $compressionLevel)
        $entryStream = $entry.Open()
        $fileStream = [System.IO.File]::Open($file.FullName, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
        $fileStream.CopyTo($entryStream)
        $fileStream.Dispose()
        $entryStream.Dispose()
        $count++
    } catch {
        Write-Warning "Could not add $relative : $_"
    }
}

$archive.Dispose()
$zipStream.Dispose()

$zipSize = (Get-Item $targetZip).Length
$zipSizeMb = [math]::Round($zipSize / 1MB, 2)

Write-Host "========================================="
Write-Host "SUCCESS: Created $targetZip"
Write-Host "Total files included: $count"
Write-Host "Archive size: $zipSizeMb MB ($zipSize bytes)"
Write-Host "========================================="
