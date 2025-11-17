// Test LaTeX regex pattern
const pattern = /\$[^\$\n]+?\$/g;

const testCases = [
  '$$E = mc^2$$',
  '$x^2 + y^2 = z^2$',
  '\\[\\frac{a}{b}\\]',
  '\\(\\sum_{i=1}^{n} i\\)'
];

console.log('LaTeX Inline Pattern:', pattern);
console.log('\n');

testCases.forEach((test, index) => {
  pattern.lastIndex = 0; // Reset before each test
  const result = pattern.test(test);
  console.log(`Test ${index + 1}: "${test}"`);
  console.log(`  Match: ${result}`);
  console.log('');
});
