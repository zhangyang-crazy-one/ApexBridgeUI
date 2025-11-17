#!/bin/bash
# macOS build script for VCPChat
# Builds universal binary (Intel + Apple Silicon) DMG and APP bundle

set -e  # Exit on error

echo "========================================"
echo "Building VCPChat for macOS"
echo "========================================"

# Check if Rust is installed
if ! command -v cargo &> /dev/null; then
    echo "Error: Cargo not found. Please install Rust from https://rustup.rs"
    exit 1
fi

# Check if Node.js is installed
if ! command -v npm &> /dev/null; then
    echo "Error: npm not found. Please install Node.js from https://nodejs.org"
    exit 1
fi

# Check if Xcode Command Line Tools are installed
if ! xcode-select -p &> /dev/null; then
    echo "Error: Xcode Command Line Tools not found"
    echo "Please install with: xcode-select --install"
    exit 1
fi

# Install Rust targets if needed
echo "Checking Rust targets..."
rustup target add x86_64-apple-darwin
rustup target add aarch64-apple-darwin

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing Node.js dependencies..."
    npm install
fi

# Build the application
echo ""
echo "Building universal binary (Intel + Apple Silicon)..."
echo ""

npm run build:macos

if [ $? -eq 0 ]; then
    echo ""
    echo "========================================"
    echo "Build completed successfully!"
    echo "========================================"
    echo ""
    echo "Installers created:"
    ls -lh target/release/bundle/dmg/*.dmg 2>/dev/null || echo "No DMG found"
    ls -lh target/release/bundle/macos/*.app 2>/dev/null || echo "No APP found"
else
    echo "Error: Build failed"
    exit 1
fi
