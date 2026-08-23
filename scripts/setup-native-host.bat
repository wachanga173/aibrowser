@echo off
setlocal enabledelayedexpansion

echo ====================================================
echo  PRIVACY AI GUARD - AUTO-UPDATE SETUP
echo  One-time setup for automatic extension updates
echo ====================================================
echo.

REM Determine the extension directory (where this script is located or common install paths)
SET SCRIPT_DIR=%~dp0
SET PROJECT_ROOT=%SCRIPT_DIR%

REM If run from scripts/ subfolder or external Downloads folder, scan standard locations
if exist "%SCRIPT_DIR%extension\manifest.json" (
    SET PROJECT_ROOT=%SCRIPT_DIR%
) else if exist "%SCRIPT_DIR%..\extension\manifest.json" (
    SET PROJECT_ROOT=%SCRIPT_DIR%..\
) else if exist "%USERPROFILE%\OneDrive\visual code\GitHub\ai\extension\manifest.json" (
    SET PROJECT_ROOT=%USERPROFILE%\OneDrive\visual code\GitHub\ai\
) else if exist "%USERPROFILE%\Downloads\ai\extension\manifest.json" (
    SET PROJECT_ROOT=%USERPROFILE%\Downloads\ai\
) else if exist "%USERPROFILE%\Downloads\chrome-extension\manifest.json" (
    SET PROJECT_ROOT=%USERPROFILE%\Downloads\chrome-extension\
) else if exist "%LOCALAPPDATA%\PrivacyAIGuard\extension\manifest.json" (
    SET PROJECT_ROOT=%LOCALAPPDATA%\PrivacyAIGuard\
)

SET INSTALL_DIR=%LOCALAPPDATA%\PrivacyAIGuard
SET HOST_NAME=com.privacy_ai.native_host
SET MANIFEST_PATH=%INSTALL_DIR%\native-host-manifest.json
SET BINARY_PATH=%INSTALL_DIR%\native_host_binary.exe
SET CONFIG_PATH=%INSTALL_DIR%\config.json
SET REPO=wachanga173/aibrowser

echo [1/4] Creating installation directory...
mkdir "%INSTALL_DIR%" 2>nul

REM Check if binary already exists locally (bundled with extension download)
SET LOCAL_BINARY=
if exist "%PROJECT_ROOT%native_host_binary.exe" (
    SET LOCAL_BINARY=%PROJECT_ROOT%native_host_binary.exe
) else if exist "%SCRIPT_DIR%native_host_binary.exe" (
    SET LOCAL_BINARY=%SCRIPT_DIR%native_host_binary.exe
)

if defined LOCAL_BINARY (
    echo [2/4] Copying native host binary from local bundle...
    copy /Y "%LOCAL_BINARY%" "%BINARY_PATH%" >nul
) else (
    echo [2/4] Downloading native host binary from GitHub...
    powershell -NoProfile -ExecutionPolicy Bypass -Command ^
        "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; " ^
        "Invoke-WebRequest -Uri 'https://github.com/%REPO%/releases/latest/download/native_host_binary.exe' -OutFile '%BINARY_PATH%' -UseBasicParsing"

    if not exist "%BINARY_PATH%" (
        echo.
        echo ERROR: Failed to download native host binary.
        echo Please check your internet connection and try again.
        pause
        exit /b 1
    )
)

echo [3/4] Registering native messaging host...

REM Resolve the extension directory to an absolute path for config
pushd "%PROJECT_ROOT%"
SET ABS_PROJECT_ROOT=%CD%
popd

REM Write the native host manifest (Chrome Native Messaging format)
REM Must use forward slashes in the path for the JSON
SET BINARY_PATH_ESCAPED=%BINARY_PATH:\=\\%

> "%MANIFEST_PATH%" (
    echo {
    echo   "name": "%HOST_NAME%",
    echo   "description": "Privacy AI Guard Native Companion Host",
    echo   "path": "%BINARY_PATH_ESCAPED%",
    echo   "type": "stdio",
    echo   "allowed_origins": [
    echo     "chrome-extension://*/"
    echo   ]
    echo }
)

REM Write config file so native host knows where the extension lives
SET ABS_PROJECT_ESCAPED=%ABS_PROJECT_ROOT:\=\\%

> "%CONFIG_PATH%" (
    echo {
    echo   "extension_dir": "%ABS_PROJECT_ESCAPED%\\extension",
    echo   "project_root": "%ABS_PROJECT_ESCAPED%"
    echo }
)

REM Register with Chrome and Firefox
REG ADD "HKCU\Software\Google\Chrome\NativeMessagingHosts\%HOST_NAME%" /ve /d "%MANIFEST_PATH%" /f >nul 2>&1
REG ADD "HKCU\Software\Microsoft\Edge\NativeMessagingHosts\%HOST_NAME%" /ve /d "%MANIFEST_PATH%" /f >nul 2>&1
REG ADD "HKCU\Software\Mozilla\NativeMessagingHosts\%HOST_NAME%" /ve /d "%MANIFEST_PATH%" /f >nul 2>&1

echo [4/4] Verifying installation...

if exist "%BINARY_PATH%" (
    if exist "%MANIFEST_PATH%" (
        echo.
        echo ====================================================
        echo  SETUP COMPLETE
        echo ====================================================
        echo.
        echo  Binary:   %BINARY_PATH%
        echo  Manifest: %MANIFEST_PATH%
        echo  Config:   %CONFIG_PATH%
        echo.
        echo  The extension can now update itself automatically.
        echo  Go back to the extension popup and click
        echo  "Verify Setup" to confirm everything works.
        echo.
        echo ====================================================
    ) else (
        echo.
        echo ERROR: Manifest file was not created properly.
    )
) else (
    echo.
    echo ERROR: Binary was not installed properly.
)

echo.
pause
