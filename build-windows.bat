@echo off
REM Windows build script for VCPChat
REM Builds both NSIS and MSI installers

echo ========================================
echo Building VCPChat for Windows
echo ========================================

REM Check if Rust is installed
where cargo >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Error: Cargo not found. Please install Rust from https://rustup.rs
    exit /b 1
)

REM Check if Node.js is installed
where npm >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Error: npm not found. Please install Node.js from https://nodejs.org
    exit /b 1
)

REM Install dependencies if needed
if not exist node_modules (
    echo Installing Node.js dependencies...
    call npm install
)

REM Build the application
echo.
echo Building application...
echo.

REM Build NSIS installer
echo Building NSIS installer...
call npm run build:windows:nsis
if %ERRORLEVEL% NEQ 0 (
    echo Error: NSIS build failed
    exit /b 1
)

echo.
echo NSIS installer created successfully!
echo Location: target\release\bundle\nsis\
echo.

REM Build MSI installer
echo Building MSI installer...
call npm run build:windows:msi
if %ERRORLEVEL% NEQ 0 (
    echo Error: MSI build failed
    exit /b 1
)

echo.
echo MSI installer created successfully!
echo Location: target\release\bundle\msi\
echo.

echo ========================================
echo Build completed successfully!
echo ========================================
echo.
echo Installers created:
dir /B target\release\bundle\nsis\*.exe 2>nul
dir /B target\release\bundle\msi\*.msi 2>nul

pause
