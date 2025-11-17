// Test regex pattern matching
const pattern = /^```(\w+)?\s*(?:\{([^}]+)\})?\n([\s\S]*?)```$/gm;
const sample = '```javascript\nconst x = 10;\n```';

console.log('Testing pattern:', pattern);
console.log('Sample:', JSON.stringify(sample));

const match = pattern.exec(sample);
console.log('Match result:', match ? 'YES' : 'NO');
if (match) {
  console.log('Language:', match[1]);
  console.log('Code:', match[3]);
}

// Test with .test()
pattern.lastIndex = 0; // Reset
console.log('Test result:', pattern.test(sample));

// Try simpler pattern
const simplePattern = /^```/m;
console.log('Simple pattern test:', simplePattern.test(sample));

// Check Mermaid pattern
const mermaidPattern = /```mermaid\n([\s\S]*?)```/g;
const mermaidSample = '```mermaid\ngraph TD\nA --> B\n```';
const mermaidMatch = mermaidPattern.exec(mermaidSample);
console.log('Mermaid match:', mermaidMatch ? 'YES' : 'NO');
