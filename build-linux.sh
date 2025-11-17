#!/bin/bash
# Linux build script for VCPChat
# Builds DEB and AppImage packages

set -e  # Exit on error

echo "========================================"
echo "Building VCPChat for Linux"
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

# Check required system libraries
echo "Checking system dependencies..."

# Required for building on Linux
REQUIRED_LIBS=(
    "libwebkit2gtk-4.1-dev"
    "build-essential"
    "curl"
    "wget"
    "file"
    "libssl-dev"
    "libgtk-3-dev"
    "libayatana-appindicator3-dev"
    "librsvg2-dev"
)

MISSING_LIBS=()

for lib in "${REQUIRED_LIBS[@]}"; do
    if ! dpkg -l | grep -q "^ii  $lib"; then
        MISSING_LIBS+=("$lib")
    fi
done

if [ ${#MISSING_LIBS[@]} -gt 0 ]; then
    echo "Missing required libraries:"
    printf '%s\n' "${MISSING_LIBS[@]}"
    echo ""
    echo "Install them with:"
    echo "sudo apt-get update && sudo apt-get install ${MISSING_LIBS[*]}"
    exit 1
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing Node.js dependencies..."
    npm install
fi

# Build the application
echo ""
echo "Building DEB package..."
echo ""

npm run build:linux:deb

if [ $? -eq 0 ]; then
    echo ""
    echo "DEB package created successfully!"
fi

echo ""
echo "Building AppImage..."
echo ""

npm run build:linux:appimage

if [ $? -eq 0 ]; then
    echo ""
    echo "========================================"
    echo "Build completed successfully!"
    echo "========================================"
    echo ""
    echo "Packages created:"
    ls -lh target/release/bundle/deb/*.deb 2>/dev/null || echo "No DEB found"
    ls -lh target/release/bundle/appimage/*.AppImage 2>/dev/null || echo "No AppImage found"
else
    echo "Error: Build failed"
    exit 1
fi
