// Test CodeRenderer output
import { createCodeRenderer } from './src/core/renderer/renderers/codeRenderer.js';

const renderer = createCodeRenderer();
const content = '```javascript\nconst x = 10;\nconsole.log(x);\n```';

renderer.render(content).then(html => {
  console.log('=== CodeRenderer Output ===');
  console.log(html);
  console.log('\n=== Check if contains "javascript" ===');
  console.log('Contains "javascript":', html.includes('javascript'));
  console.log('Contains "JavaScript":', html.includes('JavaScript'));

  // Find all occurrences
  const matches = html.match(/javascript/gi);
  console.log('\nAll matches:', matches);
});
