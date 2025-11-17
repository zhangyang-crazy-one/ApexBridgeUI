# VCP Plugin Development Guide

**Version**: 1.0.0
**Last Updated**: 2025-11-02
**Tauri Version**: 2.0+

## Table of Contents

1. [Introduction](#introduction)
2. [Quick Start](#quick-start)
3. [Plugin Architecture](#plugin-architecture)
4. [Manifest Specification](#manifest-specification)
5. [Plugin API Reference](#plugin-api-reference)
6. [Lifecycle Hooks](#lifecycle-hooks)
7. [Permission System](#permission-system)
8. [Best Practices](#best-practices)
9. [Testing & Debugging](#testing--debugging)
10. [Example: HelloWorld Plugin](#example-helloworld-plugin)

---

## Introduction

The VCP Plugin System is a microkernel architecture that allows third-party developers to extend VCPChat functionality safely and efficiently. Plugins run in isolated sandboxes with fine-grained permission controls.

### Key Features

- **Sandbox Isolation**: Plugins run in iframe sandboxes, preventing direct access to Tauri APIs
- **Permission-Based Access**: Fine-grained control over filesystem, network, storage, and UI resources
- **Event-Driven Communication**: Inter-plugin communication via event bus (no direct references)
- **Lifecycle Management**: Automatic resource tracking and cleanup on deactivation
- **Dependency Resolution**: Topological sorting ensures correct plugin load order

### Architecture Overview

```
┌─────────────────────────────────────────┐
│         VCPChat Application             │
├─────────────────────────────────────────┤
│  Plugin Manager (Rust)                  │
│  ├─ Lifecycle Manager                   │
│  ├─ Permission Manager                  │
│  └─ Manifest Parser                     │
├─────────────────────────────────────────┤
│  Plugin APIs                            │
│  ├─ FileSystem API (Rust + TS)          │
│  ├─ Network API (Rust + TS)             │
│  ├─ Storage API (Rust + TS)             │
│  └─ Event Bus (TypeScript)              │
├─────────────────────────────────────────┤
│  Sandbox Layer (iframe)                 │
│  └─ PluginContext (API Proxy)           │
├─────────────────────────────────────────┤
│  Your Plugin                            │
│  ├─ manifest.json                       │
│  └─ index.js                            │
└─────────────────────────────────────────┘
```

---

## Quick Start

### 1. Create Plugin Directory

```bash
mkdir my-awesome-plugin
cd my-awesome-plugin
```

### 2. Create `manifest.json`

```json
{
  "manifestVersion": "1.0.0",
  "name": "my-awesome-plugin",
  "displayName": "My Awesome Plugin",
  "version": "1.0.0",
  "description": "A plugin that does awesome things",
  "author": "Your Name",
  "main": "index.js",

  "activationEvents": [
    "onStartupFinished"
  ],

  "permissions": [
    "filesystem.read:AppData/my-awesome-plugin/*",
    "filesystem.write:AppData/my-awesome-plugin/*",
    "storage.read",
    "storage.write",
    "ui.registerCommand"
  ],

  "contributes": {
    "commands": [
      {
        "identifier": "myAwesome.run",
        "title": "Run My Awesome Plugin",
        "description": "Execute the main plugin functionality"
      }
    ]
  },

  "engines": {
    "vcp": "^1.0.0"
  }
}
```

### 3. Create `index.js`

```javascript
// Plugin activation hook
async function activate(context) {
  console.log('My Awesome Plugin activated!');

  // Register commands
  context.commands.register('myAwesome.run', async () => {
    await context.storage.set('lastRun', new Date().toISOString());
    context.events.emit('myAwesome:executed', { success: true });
  });
}

// Plugin deactivation hook
async function deactivate(context) {
  console.log('My Awesome Plugin deactivated!');
  // Cleanup will be handled automatically
}

// Export hooks
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { activate, deactivate };
}
```

### 4. Package as ZIP

```bash
zip -r my-awesome-plugin.zip manifest.json index.js
```

### 5. Install via VCP UI

1. Open VCP Settings → Plugins
2. Click "Install Plugin"
3. Select `my-awesome-plugin.zip`
4. Review and approve permissions
5. Plugin will auto-activate!

---

## Plugin Architecture

### State Machine

Plugins follow a strict lifecycle state machine:

```
Uninstalled → Installed → Loaded → Activated → Running
                 ↓                                ↓
              Uninstalled ← ── ── ← ── ← ── Deactivated
```

#### Valid State Transitions

| From | To | Description |
|------|-----|-------------|
| Uninstalled | Installed | ZIP extraction complete |
| Installed | Loaded | Manifest parsed and validated |
| Loaded | Activated | activate() hook called |
| Activated | Running | Initialization complete |
| Running | Deactivated | deactivate() hook called |
| Deactivated | Installed | Ready for reactivation |
| Installed | Uninstalled | Plugin removed |

#### Invalid Transitions

- ❌ Uninstalled → Running (must go through Installed → Loaded → Activated)
- ❌ Running → Installed (must deactivate first)
- ❌ Installed → Deactivated (plugin not running)

---

## Manifest Specification

### Required Fields

```typescript
interface PluginManifest {
  manifestVersion: string;      // Always "1.0.0"
  name: string;                  // Unique identifier (lowercase, alphanumeric, hyphens)
  displayName: string;           // Human-readable name
  version: string;               // Semantic version (e.g., "1.0.0")
  description: string;           // Brief description
  author: string;                // Author name or organization
  main: string;                  // Entry point (e.g., "index.js")
}
```

### Optional Fields

```typescript
interface PluginManifest {
  // Activation triggers
  activationEvents?: string[];   // ["onStartupFinished", "onCommand:myCmd"]

  // Permissions
  permissions?: string[];        // ["filesystem.read:AppData/plugin/*"]

  // Contributions
  contributes?: {
    commands?: Command[];
    views?: View[];
    events?: Event[];
    keybindings?: Keybinding[];
  };

  // Dependencies
  dependencies?: Record<string, string>;  // { "other-plugin": "1.0.0" }

  // Engine requirements
  engines?: Record<string, string>;       // { "vcp": "^1.0.0" }
}
```

### Activation Events

Determines when your plugin should be activated:

```json
{
  "activationEvents": [
    "onStartupFinished",           // After VCP fully loads
    "onCommand:myPlugin.run",      // When command is invoked
    "onView:myPlugin.panel",       // When view is opened
    "onLanguage:python",           // When language is detected
    "onFileOpen:*.md"              // When file type is opened
  ]
}
```

### Permission Syntax

Format: `<type>:<scope>`

**Filesystem Permissions**:
```json
"filesystem.read:AppData/my-plugin/*"      // Read files in plugin directory
"filesystem.write:AppData/my-plugin/data/*" // Write to specific subdirectory
```

**Network Permissions**:
```json
"network.request:*.example.com"   // Wildcard subdomain matching
"network.request:api.example.com" // Exact domain
```

**Storage Permissions**:
```json
"storage.read"   // Read plugin-specific key-value storage
"storage.write"  // Write to plugin storage
```

**System Permissions**:
```json
"system.notify"  // Send system notifications
```

**UI Permissions**:
```json
"ui.registerCommand"  // Register commands
"ui.registerView"     // Register views/panels
```

### Contribution Points

#### Commands

```json
{
  "contributes": {
    "commands": [
      {
        "identifier": "myPlugin.analyze",
        "title": "Analyze Data",
        "description": "Perform data analysis on selected files"
      }
    ]
  }
}
```

**Command Identifier Format**: `<pluginName>.<commandName>`

---

## Plugin API Reference

### PluginContext

Your plugin receives a `context` object in lifecycle hooks:

```typescript
interface PluginContext {
  fs: FileSystemAPI;
  http: NetworkAPI;
  storage: StorageAPI;
  events: EventBusAPI;
  commands: CommandAPI;
}
```

### FileSystem API

**Scope**: All file operations are restricted to `AppData/` directory.

```javascript
// Read file
const content = await context.fs.readFile('data/settings.json');
const data = JSON.parse(content);

// Write file (atomic operation)
await context.fs.writeFile('data/output.txt', 'Hello World');

// Check existence
const exists = await context.fs.exists('data/cache.json');

// List files with glob pattern
const files = await context.fs.listFiles('data', '*.json');
// Returns: ['settings.json', 'cache.json']

// Create directory
await context.fs.createDirectory('data/exports');

// Watch for file changes
const unwatch = await context.fs.watch('data', (event, filename) => {
  console.log(`File ${filename} changed: ${event}`);
});
// Later: unwatch() to stop watching
```

**Path Validation**:
- ✅ Valid: `data/file.txt`, `exports/report.pdf`
- ❌ Invalid: `../secret.txt`, `/etc/passwd`, `C:\Windows\System32`

### Network API

**Scope**: Requests are validated against domain whitelist and rate-limited.

```javascript
// GET request
const response = await context.http.get('https://api.example.com/data');
if (response.status === 200) {
  const data = JSON.parse(response.body);
}

// POST request
const postData = { name: 'John', value: 42 };
const postResponse = await context.http.post(
  'https://api.example.com/submit',
  JSON.stringify(postData),
  { 'Content-Type': 'application/json' }
);

// PUT request
await context.http.put(
  'https://api.example.com/update/123',
  JSON.stringify({ status: 'active' }),
  { 'Content-Type': 'application/json' }
);

// DELETE request
await context.http.delete('https://api.example.com/resource/456');
```

**Rate Limiting**: Default 100 requests/minute (configurable in manifest).

**Response Format**:
```typescript
interface HttpResponse {
  status: number;     // HTTP status code
  headers: Record<string, string>;
  body: string;       // Response body
}
```

### Storage API

**Scope**: Plugin-isolated key-value storage (persisted to disk).

```javascript
// Set values
await context.storage.set('username', 'Alice');
await context.storage.set('score', 42);
await context.storage.set('settings', {
  theme: 'dark',
  notifications: true
});

// Get values
const username = await context.storage.get('username');  // 'Alice'
const score = await context.storage.get('score');        // 42
const settings = await context.storage.get('settings');  // { theme: 'dark', ... }

// Check key existence
const hasKey = await context.storage.has('username');  // true

// Get all keys
const keys = await context.storage.keys();
// Returns: ['username', 'score', 'settings']

// Get storage size
const itemCount = await context.storage.size();  // 3

// Delete key
await context.storage.delete('score');

// Clear all storage
await context.storage.clear();
```

**Persistence**: Storage is automatically saved to `AppData/plugin-data/<plugin-id>/storage.json`.

### Event Bus API

**Scope**: Inter-plugin communication via namespaced events.

```javascript
// Register event listener
context.events.on('myPlugin:dataUpdated', (data) => {
  console.log('Data updated:', data);
});

// Emit event
context.events.emit('myPlugin:dataUpdated', {
  timestamp: Date.now(),
  changes: ['field1', 'field2']
});

// Unregister listener
const callback = (data) => console.log(data);
context.events.on('myPlugin:notification', callback);
// Later...
context.events.off('myPlugin:notification', callback);

// Cross-plugin communication
context.events.emit('system:pluginMessage', {
  from: 'my-plugin',
  to: 'other-plugin',
  message: 'Hello!'
});

// Listen to system events
context.events.on('system:themeChanged', (theme) => {
  console.log('New theme:', theme);
});
```

**Event Naming Convention**: `<pluginName>:<eventName>` or `system:<eventName>`

**Performance**: Event delivery latency <20ms (95th percentile).

### Command API

```javascript
// Register command
context.commands.register('myPlugin.analyze', async () => {
  console.log('Analyze command executed');
  const result = await performAnalysis();
  return result;
});

// Register command with parameters
context.commands.register('myPlugin.processFile', async (filename) => {
  const content = await context.fs.readFile(filename);
  return processContent(content);
});
```

**Command Invocation**: Commands can be invoked by users via UI or by other plugins via events.

---

## Lifecycle Hooks

### activate(context)

Called when the plugin is activated. Use this to:
- Register commands
- Set up event listeners
- Initialize plugin state
- Load configuration

```javascript
async function activate(context) {
  console.log('Plugin starting...');

  // Register commands
  context.commands.register('myPlugin.run', handleRun);

  // Set up event listeners
  context.events.on('system:ready', onSystemReady);

  // Initialize state
  const initialized = await context.storage.get('initialized');
  if (!initialized) {
    await context.storage.set('initialized', true);
    await context.storage.set('installDate', Date.now());
  }

  console.log('Plugin activated successfully');
}
```

### deactivate(context)

Called when the plugin is deactivated. Use this to:
- Save state
- Cleanup resources (optional, automatic cleanup provided)
- Emit shutdown events

```javascript
async function deactivate(context) {
  console.log('Plugin shutting down...');

  // Save final state
  await context.storage.set('lastDeactivated', Date.now());

  // Emit shutdown event
  context.events.emit('myPlugin:shutdown', {
    timestamp: Date.now()
  });

  // Note: Automatic cleanup will:
  // - Unregister all commands
  // - Remove all event listeners
  // - Close file watchers

  console.log('Plugin deactivated');
}
```

**Resource Cleanup**: The lifecycle manager automatically tracks and cleans up:
- Registered commands
- Event listeners
- File watchers
- Network connections

---

## Permission System

### Requesting Permissions

Declare permissions in `manifest.json`:

```json
{
  "permissions": [
    "filesystem.read:AppData/my-plugin/*",
    "filesystem.write:AppData/my-plugin/exports/*",
    "network.request:*.api.example.com",
    "storage.read",
    "storage.write",
    "system.notify",
    "ui.registerCommand"
  ]
}
```

### Permission Approval Flow

1. User selects plugin ZIP for installation
2. VCP displays permission request dialog
3. User reviews and approves/denies each permission
4. Plugin can only activate if all required permissions are granted

### Permission Validation

All API calls are validated against granted permissions:

```javascript
// If permission granted: filesystem.read:AppData/my-plugin/*
await context.fs.readFile('my-plugin/data.json');  // ✅ Allowed

// If permission NOT granted or out of scope
await context.fs.readFile('../other-plugin/secret.txt');  // ❌ Denied
```

### Security Best Practices

1. **Principle of Least Privilege**: Request only the permissions you need
2. **Scope Restrictions**: Use specific scopes instead of wildcards
3. **Audit Logging**: All permission checks are logged to `AppData/audit-logs/`

---

## Best Practices

### 1. Error Handling

Always wrap API calls in try-catch:

```javascript
async function activate(context) {
  try {
    const data = await context.fs.readFile('config.json');
    const config = JSON.parse(data);
  } catch (error) {
    console.error('Failed to load config:', error);
    // Use default configuration
    const config = getDefaultConfig();
  }
}
```

### 2. Resource Management

Clean up resources explicitly when possible:

```javascript
let fileWatcher = null;

async function activate(context) {
  fileWatcher = await context.fs.watch('data', handleFileChange);
}

async function deactivate(context) {
  if (fileWatcher) {
    fileWatcher();  // Stop watching
  }
}
```

### 3. Event Namespacing

Always prefix events with your plugin name:

```javascript
// ✅ Good
context.events.emit('myPlugin:dataReady', data);

// ❌ Bad (collision risk)
context.events.emit('dataReady', data);
```

### 4. Asynchronous Operations

Use async/await for better readability:

```javascript
// ✅ Good
async function loadData(context) {
  const content = await context.fs.readFile('data.json');
  const parsed = JSON.parse(content);
  await context.storage.set('cachedData', parsed);
  return parsed;
}

// ❌ Avoid callback hell
function loadData(context, callback) {
  context.fs.readFile('data.json').then(content => {
    const parsed = JSON.parse(content);
    context.storage.set('cachedData', parsed).then(() => {
      callback(parsed);
    });
  });
}
```

### 5. Performance Optimization

- Cache frequently accessed data
- Use storage API for persistent caching
- Minimize network requests
- Debounce event handlers

```javascript
// Debounce file change handler
let debounceTimer = null;
async function onFileChange(event, filename) {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    handleChange(filename);
  }, 300);
}
```

---

## Testing & Debugging

### Unit Testing

Test your plugin logic independently:

```javascript
// myPlugin.test.js
const { activate, deactivate } = require('./index.js');

describe('MyPlugin', () => {
  it('should initialize storage on first activation', async () => {
    const mockContext = createMockContext();
    await activate(mockContext);

    const initialized = await mockContext.storage.get('initialized');
    expect(initialized).toBe(true);
  });
});
```

### Integration Testing

Use the HelloWorld plugin as a reference for testing all APIs:

```javascript
async function testAllAPIs(context) {
  // Test FileSystem
  await context.fs.writeFile('test.json', '{"test": true}');
  const data = await context.fs.readFile('test.json');

  // Test Network
  const response = await context.http.get('https://example.com/api');

  // Test Storage
  await context.storage.set('testKey', 'testValue');
  const value = await context.storage.get('testKey');

  // Test Events
  context.events.emit('myPlugin:testComplete', { success: true });
}
```

### Debugging

Enable debug logging in your plugin:

```javascript
const DEBUG = true;

function debug(...args) {
  if (DEBUG) {
    console.log('[MyPlugin]', ...args);
  }
}

async function activate(context) {
  debug('Activation started');
  // ... plugin logic
  debug('Activation complete');
}
```

Check audit logs for permission validation:

```
AppData/audit-logs/2025-11-02.jsonl
```

---

## Example: HelloWorld Plugin

The HelloWorld plugin demonstrates all Plugin APIs. Key files:

### manifest.json

```json
{
  "manifestVersion": "1.0.0",
  "name": "hello-world",
  "displayName": "Hello World Plugin",
  "version": "1.0.0",
  "description": "Test plugin demonstrating all Plugin APIs",
  "author": "VCP Team",
  "main": "index.js",

  "activationEvents": ["onStartupFinished"],

  "permissions": [
    "filesystem.read:AppData/hello-world/*",
    "filesystem.write:AppData/hello-world/*",
    "network.request:*.jsonplaceholder.typicode.com",
    "storage.read",
    "storage.write",
    "system.notify",
    "ui.registerCommand"
  ],

  "contributes": {
    "commands": [
      {
        "identifier": "hello.run",
        "title": "Run Hello World Tests",
        "description": "Test all Plugin APIs"
      }
    ]
  }
}
```

### index.js (Simplified)

```javascript
async function activate(context) {
  // Register test commands
  context.commands.register('hello.run', async () => {
    await testFileSystemAPI(context);
    await testNetworkAPI(context);
    await testStorageAPI(context);
    await testEventsAPI(context);
  });

  // Run basic tests on activation
  await runBasicTests(context);
}

async function testFileSystemAPI(context) {
  const testData = {
    message: 'Hello from HelloWorld plugin!',
    timestamp: new Date().toISOString()
  };

  await context.fs.writeFile('data/test.json', JSON.stringify(testData));
  const readData = await context.fs.readFile('data/test.json');
  console.log('✓ FileSystem API working');
}

async function testNetworkAPI(context) {
  const response = await context.http.get(
    'https://jsonplaceholder.typicode.com/posts/1'
  );
  console.log('✓ Network API working');
}

async function testStorageAPI(context) {
  await context.storage.set('testKey', 'Hello World');
  const value = await context.storage.get('testKey');
  console.log('✓ Storage API working');
}

async function testEventsAPI(context) {
  context.events.on('hello-world:test', (data) => {
    console.log('✓ Events API working');
  });
  context.events.emit('hello-world:test', { success: true });
}

async function deactivate(context) {
  await context.storage.set('lastDeactivated', Date.now());
}

module.exports = { activate, deactivate };
```

---

## Appendix

### Performance Benchmarks

- **Permission Validation**: <10ms (average: 0.001-0.005ms)
- **Event Delivery**: <20ms (average: 0.6-6.1ms)
- **FileSystem Operations**: <50ms for typical file sizes (<1MB)
- **Network Requests**: Depends on server latency + rate limiting

### Supported File Formats

FileSystem API supports all text and binary formats:
- Text: `.txt`, `.json`, `.xml`, `.yaml`, `.md`, `.html`, `.css`, `.js`
- Binary: `.zip`, `.pdf`, `.png`, `.jpg`, `.mp3`, `.mp4`

### API Versioning

Current API version: **1.0.0**

Breaking changes will increment major version. Check `manifest.engines.vcp` for compatibility.

---

## Getting Help

- **Documentation**: See this guide
- **Example Plugins**: Check `test-plugins/hello-world/`
- **Issue Tracker**: [GitHub Issues](https://github.com/vcp/plugins/issues)
- **Community Forum**: [VCP Developers](https://forum.vcp.dev)

---

**Happy Plugin Development! 🎉**
