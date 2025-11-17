# VCPChat Tauri Development Guide

**Version**: 1.0.0
**Last Updated**: 2025-10-30
**Target Platforms**: Windows, macOS, Linux, Android

This guide provides comprehensive instructions for building, debugging, and deploying VCPChat built with Tauri 2.0+.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Project Setup](#project-setup)
3. [Development Workflow](#development-workflow)
4. [Build Configuration](#build-configuration)
5. [Cross-Platform Building](#cross-platform-building)
6. [Debugging and Logging](#debugging-and-logging)
7. [Testing](#testing)
8. [Code Signing and Distribution](#code-signing-and-distribution)
9. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Tools

#### Windows
- **Node.js** 18+ (LTS recommended)
- **Rust** 1.75+ ([rustup.rs](https://rustup.rs/))
- **Visual Studio 2022** Build Tools or full IDE
- **Git** for version control
- **Python** 3.8+ (for audio_engine)

```powershell
# Install Rust
winget install Rustlang.Rustup

# Install Node.js
winget install OpenJS.NodeJS.LTS

# Verify installations
node --version
npm --version
rustc --version
cargo --version
```

#### macOS
- **Node.js** 18+ (via Homebrew)
- **Rust** 1.75+ ([rustup.rs](https://rustup.rs/))
- **Xcode Command Line Tools**
- **Python** 3.8+ (usually pre-installed)

```bash
# Install Homebrew (if not installed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install dependencies
brew install node rust python3

# Install Xcode Command Line Tools
xcode-select --install

# Verify installations
node --version
rustc --version
```

#### Linux (Debian/Ubuntu)
- **Node.js** 18+
- **Rust** 1.75+
- **Build essentials**
- **Python** 3.8+

```bash
# Update package lists
sudo apt update

# Install dependencies
sudo apt install -y \
  libwebkit2gtk-4.0-dev \
  build-essential \
  curl \
  wget \
  file \
  libssl-dev \
  libgtk-3-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev \
  nodejs \
  npm \
  python3 \
  python3-pip

# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Verify installations
node --version
rustc --version
```

### Optional Tools

- **Android Studio** (for Android builds)
- **Android SDK** + **NDK** (API 24+)
- **Code signing certificates** (for production releases)

---

## Project Setup

### Initial Setup

```bash
# Clone repository
cd VCP-CHAT-Rebuild

# Install NPM dependencies
npm install

# Install Tauri CLI
npm install --save-dev @tauri-apps/cli

# Install Python audio engine dependencies
pip install -r requirements.txt

# Build frontend and backend once
npm run build
```

### Directory Structure

```
VCP-CHAT-Rebuild/
├── src/                    # Frontend (TypeScript + HTML/CSS)
│   ├── modules/            # Feature modules
│   ├── core/               # Core utilities
│   └── components/         # Reusable UI components
├── src-tauri/              # Rust backend
│   ├── src/                # Rust source code
│   │   ├── commands/       # Tauri IPC commands
│   │   ├── models/         # Data models
│   │   └── lib.rs          # Main library
│   ├── icons/              # Platform icons
│   ├── Cargo.toml          # Rust dependencies
│   └── tauri.conf.json     # Tauri configuration
├── audio_engine/           # Python audio processing
└── AppData/                # Runtime data directory
```

---

## Development Workflow

### Development Mode

Start the application in development mode with hot reload:

```bash
# Start development server
npm run dev
```

**What happens**:
1. Vite starts frontend dev server at `http://localhost:1420`
2. Tauri builds Rust backend with `debug` profile
3. Application launches with WebView pointing to dev server
4. **Hot Module Replacement (HMR)** enabled for instant frontend updates
5. Terminal shows unified logs from both frontend and backend

**Features in Development Mode**:
- ✅ Frontend HMR (instant reload on file changes)
- ✅ Rust backend recompilation on .rs file changes
- ✅ Terminal logging with `debug!`, `info!`, `warn!`, `error!` macros
- ✅ Web debug mirror at `http://localhost:1420` (accessible in browser)
- ✅ Source maps for debugging
- ✅ Unminified code

### Web Debug Mirror

Access the frontend in a regular browser (no Tauri):

```bash
# Start Vite dev server only
npm run dev:frontend

# Open in browser
# Navigate to: http://localhost:1420
```

**Use Cases**:
- Debug frontend code in browser DevTools
- Test responsive design
- Inspect network requests
- Faster iteration (no Rust rebuild required)

**Limitations**:
- Tauri commands (`invoke()`) will fail
- No file system access
- No window controls
- WebSocket may require CORS configuration

**Feature Flags**:
The `platform.ts` utility automatically detects debug mirror mode:

```typescript
import { platform, features } from '@/core/utils/platform';

if (platform().isDebugMirror) {
  console.log('Running in web debug mirror');
  // Disable Tauri-specific features
}

if (features.hasTauriCommands()) {
  // Safe to call invoke()
}
```

---

## Build Configuration

### Frontend Build (Vite)

**vite.config.ts**:
```typescript
export default defineConfig({
  plugins: [/* ... */],
  server: {
    port: 1420,
    strictPort: true,
    hmr: true, // Hot module replacement
  },
  build: {
    target: 'es2021',
    outDir: 'dist',
    minify: 'esbuild',
    sourcemap: false, // Disable in production
  },
  resolve: {
    alias: {
      '@': '/src',
      '@modules': '/src/modules',
      '@core': '/src/core',
    },
  },
});
```

### Backend Build (Rust + Tauri)

**Cargo.toml**:
```toml
[package]
name = "app"
version = "1.0.0"
edition = "2021"

[dependencies]
tauri = { version = "2.0", features = ["protocol-asset"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
log = "0.4"
env_logger = "0.11"
chrono = "0.4"
uuid = { version = "1.6", features = ["v4", "serde"] }

[profile.release]
opt-level = 3        # Maximum optimization
lto = true           # Link-time optimization
codegen-units = 1    # Better optimization at cost of compile time
strip = true         # Strip debug symbols
```

**tauri.conf.json**:
- Build targets: `nsis`, `msi` (Windows), `deb`, `appimage` (Linux), `dmg`, `app` (macOS)
- Bundle identifier: `com.vcp.chat`
- Icon paths configured for all platforms

---

## Cross-Platform Building

### Windows Build

```powershell
# Build for Windows x64
npm run build

# Output:
# - src-tauri/target/release/VCPChat.exe (portable)
# - src-tauri/target/release/bundle/nsis/VCPChat_1.0.0_x64-setup.exe (installer)
# - src-tauri/target/release/bundle/msi/VCPChat_1.0.0_x64_en-US.msi (MSI installer)
```

**Bundle Formats**:
- **NSIS**: Modern installer with custom UI
- **MSI**: Windows Installer package (enterprise-friendly)

### macOS Build

```bash
# Build for macOS (current architecture)
npm run build

# Output:
# - src-tauri/target/release/bundle/dmg/VCPChat_1.0.0_x64.dmg (Intel)
# - src-tauri/target/release/bundle/dmg/VCPChat_1.0.0_aarch64.dmg (Apple Silicon)
# - src-tauri/target/release/bundle/macos/VCPChat.app (app bundle)
```

**Architecture Support**:
- **x64**: Intel Macs
- **aarch64**: Apple Silicon (M1/M2/M3)

**Build for specific architecture**:
```bash
# Intel
rustup target add x86_64-apple-darwin
cargo build --release --target x86_64-apple-darwin

# Apple Silicon
rustup target add aarch64-apple-darwin
cargo build --release --target aarch64-apple-darwin
```

### Linux Build

```bash
# Build for Linux x64
npm run build

# Output:
# - src-tauri/target/release/bundle/deb/vcpchat_1.0.0_amd64.deb (Debian/Ubuntu)
# - src-tauri/target/release/bundle/appimage/vcpchat_1.0.0_amd64.AppImage (Universal)
```

**Bundle Formats**:
- **.deb**: Debian/Ubuntu package
- **.AppImage**: Portable executable (works on any distro)

**Test Installation**:
```bash
# Debian/Ubuntu
sudo dpkg -i vcpchat_1.0.0_amd64.deb

# AppImage
chmod +x vcpchat_1.0.0_amd64.AppImage
./vcpchat_1.0.0_amd64.AppImage
```

### Android Build

**Prerequisites**:
1. Install Android Studio
2. Install Android SDK (API 24+)
3. Install Android NDK
4. Configure Tauri Android plugin

```bash
# Initialize Android project
npm install @tauri-apps/cli-android
npx tauri android init

# Build APK
npx tauri android build

# Output:
# - src-tauri/gen/android/app/build/outputs/apk/release/app-release.apk
```

**Run on emulator**:
```bash
npx tauri android dev
```

---

## Debugging and Logging

### Rust Backend Logging

The backend uses `env_logger` with log macros:

```rust
use log::{debug, info, warn, error};

info!("Application started");
debug!("Loading configuration: {:?}", config);
warn!("Cache size exceeding threshold");
error!("Failed to connect to backend: {}", err);
```

**Log Levels**:
- `debug!` - Detailed debugging info (dev only)
- `info!` - General information messages
- `warn!` - Warning messages (non-critical issues)
- `error!` - Error messages (critical failures)

**Configure Log Level**:
```bash
# Set via environment variable (Windows)
$env:RUST_LOG="debug"
npm run dev

# Set via environment variable (macOS/Linux)
RUST_LOG=debug npm run dev
```

**Log Levels**:
- `error` - Errors only
- `warn` - Warnings and errors
- `info` - Info, warnings, and errors (default)
- `debug` - All messages
- `trace` - Maximum verbosity

### Frontend Logging

Use the unified `Logger` utility:

```typescript
import { createLogger } from '@/core/utils/logger';

const logger = createLogger('ChatManager');

logger.debug('Loading conversation', { topicId });
logger.info('Message sent successfully');
logger.warn('WebSocket reconnecting...');
logger.error('Failed to load settings', error);
```

**Features**:
- Logs to browser console
- Forwards to Rust backend (visible in terminal)
- Includes source component name
- Automatically disabled in web debug mirror (no Tauri)

### Development Tools

**Tauri DevTools** (Chromium DevTools):
- Press `F12` or `Ctrl+Shift+I` (Windows/Linux)
- Press `Cmd+Option+I` (macOS)
- Inspect DOM, debug JavaScript, monitor network

**Rust Debugging**:
```bash
# Build with debug symbols
cargo build

# Run with debugger (VS Code)
# Add breakpoints in .rs files
# Start "Debug Tauri App" configuration
```

---

## Testing

### Contract Tests (Tauri IPC)

Test all Tauri commands to ensure frontend-backend contract:

```bash
# Run contract tests
npm run test:contract
```

**Example Contract Test**:
```typescript
// src/tests/contract/ipc-contract.test.ts
import { invoke } from '@tauri-apps/api/tauri';

describe('IPC Contract Tests', () => {
  it('should read settings correctly', async () => {
    const settings = await invoke('read_settings');
    expect(settings).toBeDefined();
    expect(settings.backend_url).toBeDefined();
  });
});
```

### Integration Tests

Test full user flows across frontend and backend:

```bash
# Run integration tests
npm run test:integration
```

**Example Integration Test**:
```typescript
// src/tests/integration/chat-flow.test.ts
describe('Chat Flow', () => {
  it('should send message and receive streaming response', async () => {
    // Create topic
    const topicId = await createTopic();

    // Send message
    await sendMessage(topicId, 'Hello AI');

    // Verify streaming response
    const messages = await loadMessages(topicId);
    expect(messages).toHaveLength(2); // User + AI response
  });
});
```

### Unit Tests (Frontend)

Test individual utilities and components:

```bash
# Run unit tests
npm run test:unit
```

### Rust Tests

Test Rust backend logic:

```bash
# Run Rust tests
cd src-tauri
cargo test

# Run with output
cargo test -- --nocapture

# Run specific test
cargo test test_agent_validation
```

---

## Code Signing and Distribution

### Windows Code Signing

**Prerequisites**:
- Code signing certificate (.pfx file)
- Certificate password

**Configure in `tauri.conf.json`**:
```json
{
  "bundle": {
    "windows": {
      "certificateThumbprint": null,
      "digestAlgorithm": "sha256",
      "timestampUrl": ""
    }
  }
}
```

**Sign manually**:
```powershell
# Sign NSIS installer
signtool.exe sign /f cert.pfx /p PASSWORD /tr http://timestamp.digicert.com /td sha256 /fd sha256 VCPChat_setup.exe

# Verify signature
signtool.exe verify /pa VCPChat_setup.exe
```

### macOS Code Signing

**Prerequisites**:
- Apple Developer account
- Developer ID Application certificate

**Sign and notarize**:
```bash
# Sign app bundle
codesign --deep --force --verify --verbose --sign "Developer ID Application: YOUR_NAME" VCPChat.app

# Create DMG and sign
hdiutil create -volname "VCPChat" -srcfolder VCPChat.app -ov -format UDZO VCPChat.dmg
codesign --sign "Developer ID Application: YOUR_NAME" VCPChat.dmg

# Notarize (requires Xcode)
xcrun notarytool submit VCPChat.dmg --keychain-profile "notarytool-profile" --wait

# Staple notarization ticket
xcrun stapler staple VCPChat.dmg
```

### Android APK Signing

**Generate keystore**:
```bash
keytool -genkey -v -keystore vcpchat-release.keystore -alias vcpchat -keyalg RSA -keysize 2048 -validity 10000
```

**Configure in `build.gradle`**:
```gradle
android {
  signingConfigs {
    release {
      storeFile file("vcpchat-release.keystore")
      storePassword System.getenv("KEYSTORE_PASSWORD")
      keyAlias "vcpchat"
      keyPassword System.getenv("KEY_PASSWORD")
    }
  }
}
```

**Build signed APK**:
```bash
npx tauri android build --release
```

---

## Troubleshooting

### Common Issues

#### "Rust compiler not found"
```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Add to PATH (Windows)
$env:PATH += ";$HOME\.cargo\bin"

# Add to PATH (macOS/Linux)
export PATH="$HOME/.cargo/bin:$PATH"
```

#### "WebView2 not found" (Windows)
```powershell
# Download and install WebView2 Runtime
# https://developer.microsoft.com/en-us/microsoft-edge/webview2/
```

#### "webkit2gtk not found" (Linux)
```bash
sudo apt install libwebkit2gtk-4.0-dev
```

#### "Port 1420 already in use"
```bash
# Kill process using port 1420 (Windows)
netstat -ano | findstr :1420
taskkill /PID <PID> /F

# Kill process using port 1420 (macOS/Linux)
lsof -ti:1420 | xargs kill -9
```

#### "Failed to parse tauri.conf.json"
- Validate JSON syntax (no trailing commas)
- Check icon paths exist
- Ensure bundle identifier follows reverse domain notation

#### "Cargo build failed"
```bash
# Clean build cache
cd src-tauri
cargo clean

# Rebuild
cargo build
```

---

## Performance Optimization

### Production Build Optimizations

**Enabled by default in `Cargo.toml`**:
- Link-time optimization (`lto = true`)
- Maximum optimization level (`opt-level = 3`)
- Single codegen unit (`codegen-units = 1`)
- Debug symbol stripping (`strip = true`)

**Result**: 30-40% smaller binary size, 10-20% faster runtime

### Bundle Size Optimization

```bash
# Analyze bundle size
npm run build
ls -lh src-tauri/target/release/bundle/
```

**Tips**:
- Remove unused dependencies
- Use tree-shaking in Vite
- Compress assets (images, fonts)
- Enable gzip compression for web assets

---

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Build and Release

on:
  push:
    tags:
      - 'v*'

jobs:
  build-windows:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 18
      - uses: dtolnay/rust-toolchain@stable
      - run: npm install
      - run: npm run build
      - uses: actions/upload-artifact@v4
        with:
          name: windows-installer
          path: src-tauri/target/release/bundle/nsis/*.exe

  build-macos:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 18
      - uses: dtolnay/rust-toolchain@stable
      - run: npm install
      - run: npm run build
      - uses: actions/upload-artifact@v4
        with:
          name: macos-dmg
          path: src-tauri/target/release/bundle/dmg/*.dmg

  build-linux:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 18
      - uses: dtolnay/rust-toolchain@stable
      - run: |
          sudo apt update
          sudo apt install -y libwebkit2gtk-4.0-dev build-essential curl wget
      - run: npm install
      - run: npm run build
      - uses: actions/upload-artifact@v4
        with:
          name: linux-packages
          path: |
            src-tauri/target/release/bundle/deb/*.deb
            src-tauri/target/release/bundle/appimage/*.AppImage
```

---

## Resources

- **Tauri Documentation**: https://tauri.app/v2/
- **Rust Book**: https://doc.rust-lang.org/book/
- **Vite Documentation**: https://vitejs.dev/
- **TypeScript Handbook**: https://www.typescriptlang.org/docs/

---

## Support

For issues and questions:
- File a bug report in GitHub Issues
- Check existing documentation in `specs/003-tauri-migration/`
- Review `CLAUDE.md` for project-specific guidance

---

**Happy coding! 🚀**
