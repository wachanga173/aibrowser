@echo off
setlocal enabledelayedexpansion

echo ====================================================
echo PRIVACY GUARD IN-PLACE EXTENSION AUTO-UPDATER
echo ====================================================
echo.

where node >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo Running Node.js in-place updater...
    node scripts/update-in-place.js
    goto :done
)

echo Node.js not detected in PATH. Executing PowerShell in-place updater...
powershell -NoProfile -ExecutionPolicy Bypass -Command "& {
    $repo = 'wachanga173/aibrowser'
    $targetDir = Join-Path (Get-Location) 'extension'
    $zipPath = Join-Path (Get-Location) 'temp_update.zip'
    $tempDir = Join-Path (Get-Location) 'temp_extract'

    Write-Host 'Fetching latest release from GitHub...' -ForegroundColor Cyan
    $releaseUrl = 'https://github.com/' + $repo + '/releases/latest/download/chrome-extension.zip'
    
    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        Invoke-WebRequest -Uri $releaseUrl -OutFile $zipPath -UseBasicParsing
        Write-Host 'Downloaded latest extension archive.' -ForegroundColor Green

        if (Test-Path $tempDir) { Remove-Item -Recurse -Force $tempDir }
        Expand-Archive -Path $zipPath -DestinationPath $tempDir -Force

        Write-Host 'Extracting new files over extension directory...' -ForegroundColor Cyan
        Copy-Item -Path ($tempDir + '\*') -Destination $targetDir -Recurse -Force

        Remove-Item -Recurse -Force $tempDir
        Remove-Item -Force $zipPath

        Write-Host '----------------------------------------------------' -ForegroundColor Green
        Write-Host 'IN-PLACE UPDATE COMPLETE!' -ForegroundColor Green
        Write-Host 'Old files replaced in-place. Temporary files deleted.' -ForegroundColor Green
        Write-Host 'Reload Privacy Guard in chrome://extensions to use the new version.' -ForegroundColor Yellow
        Write-Host '----------------------------------------------------' -ForegroundColor Green
    } catch {
        Write-Host 'Update failed: ' $_.Exception.Message -ForegroundColor Red
        if (Test-Path $zipPath) { Remove-Item -Force $zipPath }
        if (Test-Path $tempDir) { Remove-Item -Recurse -Force $tempDir }
    }
}"

:done
echo.
pause
