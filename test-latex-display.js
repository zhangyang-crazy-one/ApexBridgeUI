// Test LaTeX display pattern
const latexDisplay = /\$\$[\s\S]+?\$\$/g;
const latexInline = /\$[^\$\n]+?\$/g;

const test1 = '$$E = mc^2$$';

console.log('Test:', test1);
console.log('latexDisplay:', latexDisplay.test(test1));
latexDisplay.lastIndex = 0;
console.log('latexInline:', latexInline.test(test1));
