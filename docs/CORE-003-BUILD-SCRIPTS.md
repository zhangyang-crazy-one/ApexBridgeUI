# CORE-003: Build Scripts Setup

**Status**: ✅ COMPLETED
**Date**: 2025-11-02

## Overview

Set up comprehensive build scripts for all target platforms (Windows, macOS, Linux, Android) with proper dependency checking and error handling.

## Implemented Components

### 1. Package.json Script Enhancement

Added 16 new build scripts to `package.json`:

**Windows Scripts**:
```json
"build:windows": "tauri build --bundles nsis,msi",
"build:windows:nsis": "tauri build --bundles nsis",
"build:windows:msi": "tauri build --bundles msi"
```

**macOS Scripts**:
```json
"build:macos": "tauri build --target universal-apple-darwin --bundles dmg,app",
"build:macos:intel": "tauri build --target x86_64-apple-darwin --bundles dmg,app",
"build:macos:silicon": "tauri build --target aarch64-apple-darwin --bundles dmg,app"
```

**Linux Scripts**:
```json
"build:linux": "tauri build --bundles deb,appimage",
"build:linux:deb": "tauri build --bundles deb",
"build:linux:appimage": "tauri build --bundles appimage"
```

**Android Scripts**:
```json
"build:android": "tauri android build",
"build:android:aab": "tauri android build --aab",
"build:android:init": "tauri android init",
"android:dev": "tauri android dev"
```

**Verification Scripts**:
```json
"check": "cargo check --manifest-path=src-tauri/Cargo.toml",
"check:frontend": "tsc --noEmit",
"lint": "npm run check && npm run check:frontend"
```

### 2. Platform-Specific Build Scripts

Created 4 standalone build scripts with comprehensive error checking:

#### build-windows.bat (61 lines)
**Features**:
- ✅ Checks for Cargo installation
- ✅ Checks for npm installation
- ✅ Auto-installs node_modules if missing
- ✅ Builds both NSIS and MSI sequentially
- ✅ Provides clear error messages
- ✅ Lists created installers
- ✅ Pauses for user review

**Usage**:
```cmd
build-windows.bat
```

**Output**:
- `target\release\bundle\nsis\VCPChat_1.0.0_x64-setup.exe`
- `target\release\bundle\msi\VCPChat_1.0.0_x64_en-US.msi`

#### build-macos.sh (58 lines)
**Features**:
- ✅ Checks for Cargo, npm, and Xcode CLI tools
- ✅ Auto-installs Rust targets (x86_64, aarch64)
- ✅ Auto-installs node_modules if missing
- ✅ Builds universal binary (Intel + Apple Silicon)
- ✅ Exit-on-error handling (`set -e`)
- ✅ Lists created packages

**Usage**:
```bash
chmod +x build-macos.sh
./build-macos.sh
```

**Output**:
- `target/release/bundle/dmg/VCPChat_1.0.0_universal.dmg`
- `target/release/bundle/macos/VCPChat.app`

#### build-linux.sh (78 lines)
**Features**:
- ✅ Checks for Cargo and npm
- ✅ Validates system library dependencies
- ✅ Provides apt-get install command for missing libs
- ✅ Builds DEB and AppImage sequentially
- ✅ Exit-on-error handling (`set -e`)
- ✅ Lists created packages

**Required Libraries**:
- libwebkit2gtk-4.1-dev
- build-essential
- curl, wget, file
- libssl-dev
- libgtk-3-dev
- libayatana-appindicator3-dev
- librsvg2-dev

**Usage**:
```bash
chmod +x build-linux.sh
./build-linux.sh
```

**Output**:
- `target/release/bundle/deb/vcpchat_1.0.0_amd64.deb`
- `target/release/bundle/appimage/VCPChat_1.0.0_amd64.AppImage`

#### build-android.sh (100 lines)
**Features**:
- ✅ Checks for Cargo, npm, and Java 17+
- ✅ Validates ANDROID_HOME environment variable
- ✅ Checks for Android SDK 34 installation
- ✅ Auto-initializes Android project if needed
- ✅ Builds release APK
- ✅ Interactive AAB build prompt
- ✅ Exit-on-error handling (`set -e`)
- ✅ Lists created packages

**Prerequisites Check**:
- Java version verification (requires 17+)
- ANDROID_HOME environment variable
- Android SDK 34 platform
- Android NDK (implicit check via build)

**Usage**:
```bash
chmod +x build-android.sh
./build-android.sh

# Follow prompts:
# - APK will always be built
# - AAB requires user confirmation (y/N)
```

**Output**:
- `src-tauri/gen/android/app/build/outputs/apk/release/app-release.apk`
- `src-tauri/gen/android/app/build/outputs/bundle/release/app-release.aab` (optional)

### 3. Documentation

Created comprehensive `BUILD-GUIDE.md` (200+ lines) covering:

**Sections**:
1. Quick Start (npm commands)
2. Platform-Specific Requirements (detailed prerequisites)
3. Build Script Features (what each script does)
4. Troubleshooting (common errors and solutions)
5. Code Verification (lint and type checking)
6. Testing (unit and integration tests)
7. Continuous Integration (CI/CD examples)
8. Output Artifacts (file locations)

**Troubleshooting Examples**:
- Windows: "Cargo not found", "MSBuild not found"
- macOS: "xcode-select error", "Target not found"
- Linux: "libwebkit2gtk not found", "linker 'cc' not found"
- Android: "ANDROID_HOME not set", "SDK 34 not found", "NDK not found"

## File Summary

### Modified Files
- `package.json` - Added 16 new build scripts

### New Files Created
- `build-windows.bat` - Windows build script (61 lines)
- `build-macos.sh` - macOS build script (58 lines, executable)
- `build-linux.sh` - Linux build script (78 lines, executable)
- `build-android.sh` - Android build script (100 lines, executable)
- `BUILD-GUIDE.md` - Comprehensive build documentation (200+ lines)

## Build Workflow

### Simple Workflow (Recommended for Most Users)
```bash
# Windows
build-windows.bat

# macOS
./build-macos.sh

# Linux
./build-linux.sh

# Android
./build-android.sh
```

### Advanced Workflow (CI/CD or Custom Builds)
```bash
# Install dependencies
npm install

# Verify code
npm run lint

# Run tests
npm test

# Build for specific platform
npm run build:windows:nsis
npm run build:macos:intel
npm run build:linux:deb
npm run build:android:aab

# Or build all for current platform
npm run build
```

## CI/CD Integration

Scripts are designed for easy CI/CD integration:

**GitHub Actions Example**:
```yaml
name: Build

on: [push, pull_request]

jobs:
  build-windows:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm run build:windows

  build-macos:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm run build:macos

  build-linux:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: sudo apt-get install libwebkit2gtk-4.1-dev ...
      - run: npm run build:linux
```

## Verification Tests

### Script Execution Permissions
```bash
$ ls -l build-*.sh
-rwxr-xr-x build-android.sh
-rwxr-xr-x build-linux.sh
-rwxr-xr-x build-macos.sh
```
✅ All shell scripts are executable

### Package.json Validation
```bash
$ npm run --list
Scripts available:
  dev
  build
  build:windows
  build:windows:nsis
  build:windows:msi
  build:macos
  build:macos:intel
  build:macos:silicon
  build:linux
  build:linux:deb
  build:linux:appimage
  build:android
  build:android:aab
  build:android:init
  android:dev
  test
  test:ui
  check
  check:frontend
  lint
```
✅ All 20 scripts registered

## Success Criteria ✅

**CORE-003 Requirements**:
- [X] Set up build scripts for Windows (NSIS, MSI)
- [X] Set up build scripts for macOS (DMG, APP, Universal)
- [X] Set up build scripts for Linux (DEB, AppImage)
- [X] Set up build scripts for Android (APK, AAB)
- [X] Add dependency checking to all scripts
- [X] Add error handling and reporting
- [X] Create comprehensive build documentation
- [X] Make scripts executable on Unix systems
- [X] Add npm script shortcuts in package.json
- [X] Document troubleshooting for common issues

**Status**: ✅ **CORE-003 COMPLETED**

---

**Component 1 (Tauri Project Initialization) Status**: ✅ **3/3 TASKS COMPLETED (100%)**

---

**Last Updated**: 2025-11-02
**Next Component**: Component 2 (UI Framework - 7 days, 6 tasks)
