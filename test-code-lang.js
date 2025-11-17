// Test code fence parsing
const content = '```javascript\nconst x = 10;\nconsole.log(x);\n```';

// Test the actual regex from CodeRenderer line 216
const fencedMatch = /^```(\w+)?\s*(?:\{([^}]+)\})?\n([\s\S]*?)```$/m.exec(content);

if (fencedMatch) {
  console.log('Match found!');
  console.log('Language:', fencedMatch[1]);
  console.log('Metadata:', fencedMatch[2]);
  console.log('Code:', fencedMatch[3]);

  const lang = fencedMatch[1] || 'plaintext';
  console.log('\nHTML would contain:');
  console.log('  data-language="' + lang + '"');
  console.log('  class="language-' + lang + '"');
  console.log('\nTest: Does it contain "javascript"?', lang === 'javascript');
} else {
  console.log('No match found');
  console.log('Content:', JSON.stringify(content));
}
