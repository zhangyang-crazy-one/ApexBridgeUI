# HelloWorld Plugin

A comprehensive test plugin demonstrating all VCP Plugin APIs.

## Overview

This plugin serves as both a testing tool and a reference implementation for the VCP Plugin System. It demonstrates all available Plugin APIs including FileSystem, Network, Storage, and Events.

## Features

### Commands

- **hello.run**: Run all API tests and display results
- **hello.testFileSystem**: Test FileSystem API operations
- **hello.testNetwork**: Test Network API with JSONPlaceholder
- **hello.testStorage**: Test Storage API operations
- **hello.testEvents**: Test Event Bus functionality

### API Demonstrations

#### FileSystem API
- Write JSON and text files
- Read file contents
- Check file existence
- List files with glob patterns
- Create directories

#### Network API
- GET requests to external APIs
- POST requests with JSON payloads
- Response handling and parsing
- Rate limiting compliance

#### Storage API
- Store primitive values (string, number, boolean)
- Store complex objects
- Retrieve values
- List keys
- Check key existence
- Delete keys
- Get storage size

#### Events API
- Register event listeners
- Emit events
- Cross-plugin communication
- Event data passing

## Installation

1. Package the plugin as a ZIP file
2. Use the Plugin Installer UI in VCP
3. Approve the requested permissions
4. Plugin will automatically activate

## Permissions

This plugin requires the following permissions:

- `filesystem.read:AppData/hello-world/*` - Read plugin data files
- `filesystem.write:AppData/hello-world/*` - Write plugin data files
- `network.request:*.jsonplaceholder.typicode.com` - Test API requests
- `storage.read` - Read plugin storage
- `storage.write` - Write plugin storage
- `system.notify` - Send notifications
- `ui.registerCommand` - Register commands

## Usage

### Via Command

```javascript
// Trigger from console or UI
hello.run
```

### Via Code

```javascript
// The plugin automatically runs basic tests on activation
// Check results in storage:
const results = await storage.get('lastTestResults');
console.log(results);
```

## Test Results

After running tests, results are saved to:
- **Storage**: `lastTestResults` key with pass/fail status
- **FileSystem**: `data/test.json`, `data/log.txt`, `data/network-test.json`
- **Events**: Emits `hello-world:tests-completed` event

## Development Notes

This plugin follows the VCP Plugin Architecture:
- **Sandboxed execution**: Runs in isolated iframe
- **Permission-based access**: All API calls validated
- **Event-driven communication**: No direct plugin references
- **Resource tracking**: Automatic cleanup on deactivation

## Version

1.0.0

## Author

VCP Team
