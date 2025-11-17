// Verify MessageRenderer initialization with all 21 renderers
// This script tests that all renderers are correctly registered

import { getMessageRenderer } from './src/core/renderer/messageRenderer.js';

console.log('\n=== MessageRenderer Initialization Verification ===\n');

// Get MessageRenderer instance
const renderer = getMessageRenderer();

// Get stats
const stats = renderer.getStats();

console.log('Renderer Statistics:');
console.log(`  Total Renderers: ${stats.registeredRenderers}`);
console.log(`  Expected: 22 (1 plaintext + 21 specialized)`);
console.log(`  Match: ${stats.registeredRenderers === 22 ? '✅ YES' : '❌ NO'}`);

console.log('\nRegistered Renderer Types:');
stats.rendererTypes.forEach((type, index) => {
  console.log(`  ${index + 1}. ${type}`);
});

console.log('\nExpected Renderer Types:');
const expected = [
  'plaintext', 'markdown', 'code', 'latex', 'html', 'mermaid',
  'threejs', 'json', 'xml', 'csv', 'image', 'video', 'audio',
  'pdf', 'diff', 'yaml', 'graphql', 'sql', 'regex', 'ascii',
  'color', 'url'
];

console.log(`  Total Expected: ${expected.length}`);

// Check missing renderers
const missing = expected.filter(type => !stats.rendererTypes.includes(type));
if (missing.length > 0) {
  console.log('\n❌ Missing Renderers:');
  missing.forEach(type => console.log(`  - ${type}`));
} else {
  console.log('\n✅ All expected renderers registered!');
}

// Check extra renderers
const extra = stats.rendererTypes.filter(type => !expected.includes(type));
if (extra.length > 0) {
  console.log('\n⚠️ Extra Renderers (not expected):');
  extra.forEach(type => console.log(`  - ${type}`));
}

// Test individual renderer retrieval
console.log('\n=== Testing Renderer Retrieval ===\n');

const testTypes = ['markdown', 'code', 'latex', 'json', 'image'];
testTypes.forEach(type => {
  const r = renderer.getRenderer(type);
  console.log(`  ${type}: ${r ? '✅ Found' : '❌ Not Found'}`);
});

console.log('\n=== Verification Complete ===\n');
