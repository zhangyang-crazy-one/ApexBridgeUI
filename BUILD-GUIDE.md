# VCPChat Build Guide

## Quick Start

### Development
```bash
npm run dev
```

### Production Build

#### Windows
```bash
# Using build script (recommended)
build-windows.bat

# Or using npm scripts
npm run build:windows           # Build both NSIS and MSI
npm run build:windows:nsis      # NSIS installer only
npm run build:windows:msi       # MSI installer only
```

#### macOS
```bash
# Using build script (recommended)
./build-macos.sh

# Or using npm scripts
npm run build:macos             # Universal binary (Intel + Apple Silicon)
npm run build:macos:intel       # Intel-only build
npm run build:macos:silicon     # Apple Silicon-only build
```

#### Linux
```bash
# Using build script (recommended)
./build-linux.sh

# Or using npm scripts
npm run build:linux             # Build both DEB and AppImage
npm run build:linux:deb         # DEB package only
npm run build:linux:appimage    # AppImage only
```

#### Android
```bash
# Using build script (recommended)
./build-android.sh

# Or using npm scripts
npm run build:android:init      # Initialize Android project (one-time)
npm run build:android           # Build APK
npm run build:android:aab       # Build AAB for Play Store
npm run android:dev             # Run on emulator/device
```

## Platform-Specific Requirements

### Windows
- **OS**: Windows 10 1809+ (64-bit)
- **Prerequisites**:
  - Rust 1.75+: https://rustup.rs
  - Node.js 18+: https://nodejs.org
  - Visual Studio Build Tools (C++ workload)
- **Output**:
  - NSIS: `target/release/bundle/nsis/VCPChat_1.0.0_x64-setup.exe`
  - MSI: `target/release/bundle/msi/VCPChat_1.0.0_x64_en-US.msi`

### macOS
- **OS**: macOS 10.15 (Catalina)+
- **Prerequisites**:
  - Rust 1.75+: https://rustup.rs
  - Node.js 18+: https://nodejs.org
  - Xcode Command Line Tools: `xcode-select --install`
- **Rust Targets**:
  ```bash
  rustup target add x86_64-apple-darwin
  rustup target add aarch64-apple-darwin
  ```
- **Output**:
  - DMG: `target/release/bundle/dmg/VCPChat_1.0.0_universal.dmg`
  - APP: `target/release/bundle/macos/VCPChat.app`

### Linux
- **OS**: Ubuntu 20.04+, Debian 11+, or equivalent
- **Prerequisites**:
  - Rust 1.75+: https://rustup.rs
  - Node.js 18+: https://nodejs.org
  - System libraries:
    ```bash
    sudo apt-get update && sudo apt-get install \
      libwebkit2gtk-4.1-dev \
      build-essential \
      curl \
      wget \
      file \
      libssl-dev \
      libgtk-3-dev \
      libayatana-appindicator3-dev \
      librsvg2-dev
    ```
- **Output**:
  - DEB: `target/release/bundle/deb/vcpchat_1.0.0_amd64.deb`
  - AppImage: `target/release/bundle/appimage/VCPChat_1.0.0_amd64.AppImage`

### Android
- **OS**: Android 8.0 (API 26)+
- **Prerequisites**:
  - Rust 1.75+: https://rustup.rs
  - Node.js 18+: https://nodejs.org
  - Java 17+: https://adoptium.net
  - Android Studio: https://developer.android.com/studio
  - Android SDK 34
  - Android NDK r25c+
- **Environment Variables**:
  ```bash
  export ANDROID_HOME=$HOME/Android/Sdk
  export PATH=$PATH:$ANDROID_HOME/tools:$ANDROID_HOME/platform-tools
  ```
- **Output**:
  - APK: `src-tauri/gen/android/app/build/outputs/apk/release/app-release.apk`
  - AAB: `src-tauri/gen/android/app/build/outputs/bundle/release/app-release.aab`

## Build Script Features

### build-windows.bat
- ✅ Checks for Rust and Node.js installation
- ✅ Installs npm dependencies if needed
- ✅ Builds both NSIS and MSI installers
- ✅ Lists created installers at the end
- ✅ Pauses for user to review output

### build-macos.sh
- ✅ Checks for Rust, Node.js, and Xcode CLI tools
- ✅ Installs required Rust targets (x86_64, aarch64)
- ✅ Builds universal binary (Intel + Apple Silicon)
- ✅ Error handling with exit codes

### build-linux.sh
- ✅ Checks for Rust and Node.js installation
- ✅ Verifies system library dependencies
- ✅ Provides installation command for missing libraries
- ✅ Builds both DEB and AppImage packages
- ✅ Error handling with exit codes

### build-android.sh
- ✅ Checks for Rust, Node.js, and Java installation
- ✅ Verifies Java version (17+)
- ✅ Checks ANDROID_HOME environment variable
- ✅ Verifies Android SDK 34 installation
- ✅ Initializes Android project if needed
- ✅ Builds APK and optionally AAB
- ✅ Interactive AAB build prompt

## Troubleshooting

### Windows

**Error: "Cargo not found"**
- Install Rust from https://rustup.rs
- Restart terminal after installation

**Error: "MSBuild not found"**
- Install Visual Studio Build Tools with C++ workload
- Or install Visual Studio Community Edition

### macOS

**Error: "xcode-select: error: tool 'xcodebuild' requires Xcode"**
- Install Xcode Command Line Tools: `xcode-select --install`

**Error: "Target aarch64-apple-darwin not found"**
- Install target: `rustup target add aarch64-apple-darwin`

### Linux

**Error: "Package 'libwebkit2gtk-4.1-dev' has no installation candidate"**
- Update package list: `sudo apt-get update`
- Try alternative: `libwebkit2gtk-4.0-dev`

**Error: "linker 'cc' not found"**
- Install build-essential: `sudo apt-get install build-essential`

### Android

**Error: "ANDROID_HOME not set"**
- Set environment variable: `export ANDROID_HOME=$HOME/Android/Sdk`
- Add to `.bashrc` or `.zshrc` for persistence

**Error: "Android SDK 34 not found"**
- Open Android Studio SDK Manager
- Install "Android 14.0 (API 34)"

**Error: "NDK not found"**
- Open Android Studio SDK Manager
- Install "NDK (Side by side)" under SDK Tools

## Code Verification

Before building, verify code integrity:

```bash
# Check Rust backend
npm run check

# Check TypeScript frontend
npm run check:frontend

# Run both checks
npm run lint
```

## Testing

```bash
# Run all tests
npm test

# Run tests with UI
npm run test:ui
```

## Continuous Integration

For CI/CD pipelines, use the npm scripts directly:

```yaml
# GitHub Actions example
- name: Build for Windows
  run: npm run build:windows

- name: Build for macOS
  run: npm run build:macos

- name: Build for Linux
  run: npm run build:linux
```

## Output Artifacts

All build outputs are located in:
- `target/release/bundle/nsis/` - Windows NSIS installers
- `target/release/bundle/msi/` - Windows MSI installers
- `target/release/bundle/dmg/` - macOS DMG images
- `target/release/bundle/macos/` - macOS APP bundles
- `target/release/bundle/deb/` - Linux DEB packages
- `target/release/bundle/appimage/` - Linux AppImages
- `src-tauri/gen/android/app/build/outputs/apk/` - Android APKs
- `src-tauri/gen/android/app/build/outputs/bundle/` - Android AABs

## License

MIT License - See LICENSE file for details
