@echo off
REM Native Messaging Host Registration Script for Windows

SET HOST_NAME=com.privacy_ai.native_host
SET MANIFEST_DIR=%~dp0..\native-host
SET MANIFEST_PATH=%MANIFEST_DIR%\manifest.json

echo ----------------------------------------------------
echo Installing Local Native Messaging Host: %HOST_NAME%
echo ----------------------------------------------------

mkdir "%MANIFEST_DIR%" 2>nul

echo {> "%MANIFEST_PATH%"
echo   "name": "%HOST_NAME%",>> "%MANIFEST_PATH%"
echo   "description": "Privacy AI Guard Native Companion Host",>> "%MANIFEST_PATH%"
echo   "path": "%MANIFEST_DIR%\\target\\release\\native_host_binary.exe",>> "%MANIFEST_PATH%"
echo   "type": "stdio",>> "%MANIFEST_PATH%"
echo   "allowed_origins": [>> "%MANIFEST_PATH%"
echo     "chrome-extension://*/">> "%MANIFEST_PATH%"
echo   ]>> "%MANIFEST_PATH%"
echo }>> "%MANIFEST_PATH%"

REG ADD "HKCU\Software\Google\Chrome\NativeMessagingHosts\%HOST_NAME%" /ve /d "%MANIFEST_PATH%" /f
REG ADD "HKCU\Software\Mozilla\NativeMessagingHosts\%HOST_NAME%" /ve /d "%MANIFEST_PATH%" /f

echo ✅ Native Messaging Host registered successfully in Windows Registry.
