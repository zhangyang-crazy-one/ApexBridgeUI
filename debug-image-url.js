// Test the actual detection logic
const url = /https?:\/\/[^\s<>"\]]+/gi;
const imageExt = /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)$/i;

const samples = [
  'https://example.com/image.png',
  '![Alt text](https://example.com/photo.jpg)',
  'https://cdn.example.com/pic.webp?size=large'
];

samples.forEach((sample, i) => {
  console.log(`\nSample ${i+1}: ${JSON.stringify(sample)}`);

  // Reset regex
  url.lastIndex = 0;
  const isURL = url.test(sample);
  console.log(`  Is URL: ${isURL}`);

  // Reset regex again
  url.lastIndex = 0;

  if (isURL) {
    try {
      const urlObj = new URL(sample);
      console.log(`  Pathname: ${urlObj.pathname}`);
      console.log(`  Pathname matches imageExt: ${imageExt.test(urlObj.pathname)}`);
    } catch (e) {
      console.log(`  URL parsing failed: ${e.message}`);
    }
  }
});
