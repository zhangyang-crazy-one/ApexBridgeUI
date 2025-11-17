#!/bin/bash
# Android build script for VCPChat
# Builds APK and AAB packages

set -e  # Exit on error

echo "========================================"
echo "Building VCPChat for Android"
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

# Check if Java is installed (required for Android)
if ! command -v java &> /dev/null; then
    echo "Error: Java not found. Please install Java 17+"
    exit 1
fi

# Check Java version
JAVA_VERSION=$(java -version 2>&1 | head -n 1 | awk -F '"' '{print $2}' | awk -F '.' '{print $1}')
if [ "$JAVA_VERSION" -lt 17 ]; then
    echo "Error: Java 17+ required. Current version: $JAVA_VERSION"
    exit 1
fi

# Check if ANDROID_HOME is set
if [ -z "$ANDROID_HOME" ]; then
    echo "Error: ANDROID_HOME environment variable not set"
    echo "Please install Android Studio and set ANDROID_HOME"
    exit 1
fi

# Check if Android SDK is installed
if [ ! -d "$ANDROID_HOME/platforms/android-34" ]; then
    echo "Error: Android SDK 34 not found"
    echo "Please install Android SDK 34 using Android Studio SDK Manager"
    exit 1
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing Node.js dependencies..."
    npm install
fi

# Check if Android project is initialized
if [ ! -d "src-tauri/gen/android" ]; then
    echo "Initializing Android project..."
    npm run build:android:init
    echo ""
    echo "Android project initialized!"
    echo "You may need to configure signing keys before building release APK"
    echo ""
fi

# Build APK
echo ""
echo "Building release APK..."
echo ""

npm run build:android

if [ $? -eq 0 ]; then
    echo ""
    echo "APK created successfully!"
    echo "Location: src-tauri/gen/android/app/build/outputs/apk/release/"
    ls -lh src-tauri/gen/android/app/build/outputs/apk/release/*.apk 2>/dev/null
fi

# Build AAB (optional, for Play Store)
read -p "Build AAB for Play Store? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "Building release AAB..."
    echo ""

    npm run build:android:aab

    if [ $? -eq 0 ]; then
        echo ""
        echo "AAB created successfully!"
        echo "Location: src-tauri/gen/android/app/build/outputs/bundle/release/"
        ls -lh src-tauri/gen/android/app/build/outputs/bundle/release/*.aab 2>/dev/null
    fi
fi

echo ""
echo "========================================"
echo "Build completed!"
echo "========================================"
