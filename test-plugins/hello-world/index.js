// PLUGIN-076 & PLUGIN-077: HelloWorld Test Plugin
// Demonstrates all Plugin APIs: FileSystem, Network, Storage, Events

/**
 * PLUGIN-076: Plugin activation hook
 * Called when the plugin is activated
 */
async function activate(context) {
  console.log('[HelloWorld] Plugin activated!');

  // Register all commands
  registerCommands(context);

  // Initialize plugin state
  await initializePlugin(context);

  // Test basic functionality on activation
  await runBasicTests(context);

  console.log('[HelloWorld] Activation complete!');
}

/**
 * Plugin deactivation hook
 * Called when the plugin is deactivated
 */
async function deactivate(context) {
  console.log('[HelloWorld] Plugin deactivated!');

  // Cleanup resources
  await cleanupPlugin(context);
}

/**
 * PLUGIN-076: Register all commands
 */
function registerCommands(context) {
  // Main command
  context.commands.register('hello.run', async () => {
    console.log('[HelloWorld] Running hello.run command...');
    await runAllTests(context);
  });

  // FileSystem API test command
  context.commands.register('hello.testFileSystem', async () => {
    console.log('[HelloWorld] Testing FileSystem API...');
    await testFileSystemAPI(context);
  });

  // Network API test command
  context.commands.register('hello.testNetwork', async () => {
    console.log('[HelloWorld] Testing Network API...');
    await testNetworkAPI(context);
  });

  // Storage API test command
  context.commands.register('hello.testStorage', async () => {
    console.log('[HelloWorld] Testing Storage API...');
    await testStorageAPI(context);
  });

  // Events API test command
  context.commands.register('hello.testEvents', async () => {
    console.log('[HelloWorld] Testing Events API...');
    await testEventsAPI(context);
  });

  console.log('[HelloWorld] All commands registered');
}

/**
 * Initialize plugin state
 */
async function initializePlugin(context) {
  // Create plugin data directory
  try {
    await context.fs.createDirectory('data');
    console.log('[HelloWorld] Data directory created');
  } catch (error) {
    console.log('[HelloWorld] Data directory already exists or error:', error.message);
  }

  // Initialize storage with default values
  const hasInitialized = await context.storage.has('initialized');
  if (!hasInitialized) {
    await context.storage.set('initialized', true);
    await context.storage.set('activationCount', 0);
    await context.storage.set('lastActivated', new Date().toISOString());
    console.log('[HelloWorld] Storage initialized');
  }

  // Increment activation count
  const count = await context.storage.get('activationCount');
  await context.storage.set('activationCount', (parseInt(count) || 0) + 1);
  await context.storage.set('lastActivated', new Date().toISOString());
}

/**
 * Run basic tests on activation
 */
async function runBasicTests(context) {
  console.log('[HelloWorld] Running basic tests...');

  // Test storage read
  const activationCount = await context.storage.get('activationCount');
  console.log(`[HelloWorld] Activation count: ${activationCount}`);

  // Test event emission
  context.events.emit('hello-world:activated', {
    timestamp: new Date().toISOString(),
    count: activationCount
  });
}

/**
 * PLUGIN-077: Run all API tests
 */
async function runAllTests(context) {
  console.log('[HelloWorld] ========================================');
  console.log('[HelloWorld] Running comprehensive API tests...');
  console.log('[HelloWorld] ========================================');

  const results = {
    fileSystem: false,
    network: false,
    storage: false,
    events: false
  };

  try {
    // Test FileSystem API
    results.fileSystem = await testFileSystemAPI(context);

    // Test Network API
    results.network = await testNetworkAPI(context);

    // Test Storage API
    results.storage = await testStorageAPI(context);

    // Test Events API
    results.events = await testEventsAPI(context);

  } catch (error) {
    console.error('[HelloWorld] Test error:', error);
  }

  // Display results
  console.log('[HelloWorld] ========================================');
  console.log('[HelloWorld] Test Results:');
  console.log(`[HelloWorld]   FileSystem API: ${results.fileSystem ? '✓ PASS' : '✗ FAIL'}`);
  console.log(`[HelloWorld]   Network API:    ${results.network ? '✓ PASS' : '✗ FAIL'}`);
  console.log(`[HelloWorld]   Storage API:    ${results.storage ? '✓ PASS' : '✗ FAIL'}`);
  console.log(`[HelloWorld]   Events API:     ${results.events ? '✓ PASS' : '✗ FAIL'}`);
  console.log('[HelloWorld] ========================================');

  // Save test results
  await context.storage.set('lastTestResults', results);
  await context.storage.set('lastTestTime', new Date().toISOString());

  // Emit test completion event
  context.events.emit('hello-world:tests-completed', results);

  return results;
}

/**
 * PLUGIN-077: Test FileSystem API
 */
async function testFileSystemAPI(context) {
  console.log('[HelloWorld] Testing FileSystem API...');

  try {
    // Test 1: Write file
    const testData = {
      message: 'Hello from HelloWorld plugin!',
      timestamp: new Date().toISOString(),
      test: 'FileSystem API'
    };

    await context.fs.writeFile('data/test.json', JSON.stringify(testData, null, 2));
    console.log('[HelloWorld]   ✓ File write successful');

    // Test 2: Read file
    const readData = await context.fs.readFile('data/test.json');
    const parsed = JSON.parse(readData);

    if (parsed.message === testData.message) {
      console.log('[HelloWorld]   ✓ File read successful');
    } else {
      console.error('[HelloWorld]   ✗ File read mismatch');
      return false;
    }

    // Test 3: Check file exists
    const exists = await context.fs.exists('data/test.json');
    if (exists) {
      console.log('[HelloWorld]   ✓ File exists check successful');
    } else {
      console.error('[HelloWorld]   ✗ File exists check failed');
      return false;
    }

    // Test 4: List files
    const files = await context.fs.listFiles('data', '*.json');
    if (files && files.length > 0) {
      console.log(`[HelloWorld]   ✓ List files successful (${files.length} files)`);
    } else {
      console.error('[HelloWorld]   ✗ List files failed');
      return false;
    }

    // Test 5: Write another file
    await context.fs.writeFile('data/log.txt', `Test log entry at ${new Date().toISOString()}\n`);
    console.log('[HelloWorld]   ✓ Second file write successful');

    console.log('[HelloWorld] FileSystem API: ALL TESTS PASSED ✓');
    return true;

  } catch (error) {
    console.error('[HelloWorld] FileSystem API error:', error);
    return false;
  }
}

/**
 * PLUGIN-077: Test Network API
 */
async function testNetworkAPI(context) {
  console.log('[HelloWorld] Testing Network API...');

  try {
    // Test 1: GET request to JSONPlaceholder
    const response = await context.http.get('https://jsonplaceholder.typicode.com/posts/1');

    if (response.status === 200) {
      console.log('[HelloWorld]   ✓ GET request successful');

      const data = JSON.parse(response.body);
      if (data.id === 1) {
        console.log('[HelloWorld]   ✓ Response data valid');
      } else {
        console.error('[HelloWorld]   ✗ Response data invalid');
        return false;
      }
    } else {
      console.error('[HelloWorld]   ✗ GET request failed with status:', response.status);
      return false;
    }

    // Test 2: POST request
    const postData = {
      title: 'Hello World Test',
      body: 'Testing POST from HelloWorld plugin',
      userId: 1
    };

    const postResponse = await context.http.post(
      'https://jsonplaceholder.typicode.com/posts',
      JSON.stringify(postData),
      { 'Content-Type': 'application/json' }
    );

    if (postResponse.status === 201) {
      console.log('[HelloWorld]   ✓ POST request successful');
    } else {
      console.error('[HelloWorld]   ✗ POST request failed with status:', postResponse.status);
      return false;
    }

    // Save network test results to file
    await context.fs.writeFile('data/network-test.json', JSON.stringify({
      timestamp: new Date().toISOString(),
      getTest: response.status === 200,
      postTest: postResponse.status === 201
    }, null, 2));

    console.log('[HelloWorld] Network API: ALL TESTS PASSED ✓');
    return true;

  } catch (error) {
    console.error('[HelloWorld] Network API error:', error);
    return false;
  }
}

/**
 * PLUGIN-077: Test Storage API
 */
async function testStorageAPI(context) {
  console.log('[HelloWorld] Testing Storage API...');

  try {
    // Test 1: Set simple values
    await context.storage.set('testString', 'Hello World');
    await context.storage.set('testNumber', 42);
    await context.storage.set('testBoolean', true);
    console.log('[HelloWorld]   ✓ Set simple values successful');

    // Test 2: Set complex object
    const testObject = {
      name: 'HelloWorld Plugin',
      version: '1.0.0',
      features: ['fs', 'network', 'storage', 'events'],
      metadata: {
        author: 'VCP Team',
        created: new Date().toISOString()
      }
    };

    await context.storage.set('testObject', testObject);
    console.log('[HelloWorld]   ✓ Set object successful');

    // Test 3: Get values
    const str = await context.storage.get('testString');
    const num = await context.storage.get('testNumber');
    const bool = await context.storage.get('testBoolean');

    if (str === 'Hello World' && num === 42 && bool === true) {
      console.log('[HelloWorld]   ✓ Get simple values successful');
    } else {
      console.error('[HelloWorld]   ✗ Get values mismatch');
      return false;
    }

    // Test 4: Get object
    const obj = await context.storage.get('testObject');
    if (obj && obj.name === testObject.name) {
      console.log('[HelloWorld]   ✓ Get object successful');
    } else {
      console.error('[HelloWorld]   ✗ Get object mismatch');
      return false;
    }

    // Test 5: Check keys
    const keys = await context.storage.keys();
    if (keys && keys.length >= 4) {
      console.log(`[HelloWorld]   ✓ Keys check successful (${keys.length} keys)`);
    } else {
      console.error('[HelloWorld]   ✗ Keys check failed');
      return false;
    }

    // Test 6: Has key
    const hasTest = await context.storage.has('testString');
    if (hasTest) {
      console.log('[HelloWorld]   ✓ Has key successful');
    } else {
      console.error('[HelloWorld]   ✗ Has key failed');
      return false;
    }

    // Test 7: Size
    const size = await context.storage.size();
    if (size >= 4) {
      console.log(`[HelloWorld]   ✓ Size check successful (${size} items)`);
    } else {
      console.error('[HelloWorld]   ✗ Size check failed');
      return false;
    }

    // Test 8: Delete
    await context.storage.delete('testBoolean');
    const hasDeleted = await context.storage.has('testBoolean');
    if (!hasDeleted) {
      console.log('[HelloWorld]   ✓ Delete successful');
    } else {
      console.error('[HelloWorld]   ✗ Delete failed');
      return false;
    }

    console.log('[HelloWorld] Storage API: ALL TESTS PASSED ✓');
    return true;

  } catch (error) {
    console.error('[HelloWorld] Storage API error:', error);
    return false;
  }
}

/**
 * PLUGIN-077: Test Events API
 */
async function testEventsAPI(context) {
  console.log('[HelloWorld] Testing Events API...');

  try {
    let eventReceived = false;
    let eventData = null;

    // Test 1: Register event listener
    context.events.on('hello-world:test-event', (data) => {
      eventReceived = true;
      eventData = data;
      console.log('[HelloWorld]   ✓ Event received:', data);
    });
    console.log('[HelloWorld]   ✓ Event listener registered');

    // Test 2: Emit event
    const testPayload = {
      message: 'Test event from HelloWorld',
      timestamp: new Date().toISOString()
    };

    context.events.emit('hello-world:test-event', testPayload);
    console.log('[HelloWorld]   ✓ Event emitted');

    // Wait for event to be processed
    await new Promise(resolve => setTimeout(resolve, 100));

    // Test 3: Verify event was received
    if (eventReceived && eventData && eventData.message === testPayload.message) {
      console.log('[HelloWorld]   ✓ Event delivery successful');
    } else {
      console.error('[HelloWorld]   ✗ Event delivery failed');
      return false;
    }

    // Test 4: Test cross-plugin event
    context.events.emit('system:plugin-message', {
      from: 'hello-world',
      message: 'Hello from HelloWorld plugin!',
      timestamp: new Date().toISOString()
    });
    console.log('[HelloWorld]   ✓ Cross-plugin event emitted');

    // Save event test results
    await context.storage.set('lastEventTest', {
      timestamp: new Date().toISOString(),
      success: true,
      eventsEmitted: 2,
      eventsReceived: eventReceived ? 1 : 0
    });

    console.log('[HelloWorld] Events API: ALL TESTS PASSED ✓');
    return true;

  } catch (error) {
    console.error('[HelloWorld] Events API error:', error);
    return false;
  }
}

/**
 * Cleanup plugin resources
 */
async function cleanupPlugin(context) {
  console.log('[HelloWorld] Cleaning up resources...');

  try {
    // Save deactivation timestamp
    await context.storage.set('lastDeactivated', new Date().toISOString());

    // Emit deactivation event
    context.events.emit('hello-world:deactivated', {
      timestamp: new Date().toISOString()
    });

    console.log('[HelloWorld] Cleanup complete');
  } catch (error) {
    console.error('[HelloWorld] Cleanup error:', error);
  }
}

// Export activation and deactivation functions
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { activate, deactivate };
}
