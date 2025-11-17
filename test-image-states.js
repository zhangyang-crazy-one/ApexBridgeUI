// Test image states issue
import { JSDOM } from 'jsdom';

// Setup jsdom
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost',
  pretendToBeVisual: true
});

global.document = dom.window.document;
global.window = dom.window;
global.HTMLElement = dom.window.HTMLElement;
global.Image = dom.window.Image;

// Mock IntersectionObserver
if (typeof global.IntersectionObserver === 'undefined') {
  console.log('✅ IntersectionObserver is undefined, creating mock...');

  global.IntersectionObserver = class IntersectionObserver {
    constructor(callback, options) {
      this.callback = callback;
      this.options = options;
      console.log('✅ IntersectionObserver constructor called with options:', options);
    }

    observe(target) {
      console.log('✅ observe() called on target:', target.tagName, target.className);
      // Immediately trigger callback
      this.callback([
        {
          target,
          isIntersecting: true,
          boundingClientRect: target.getBoundingClientRect(),
          intersectionRatio: 1,
          intersectionRect: target.getBoundingClientRect(),
          rootBounds: null,
          time: Date.now()
        }
      ], this);
      console.log('✅ Callback triggered, target classes after callback:', target.className);
    }

    unobserve() {
      console.log('✅ unobserve() called');
    }
    disconnect() {}
    takeRecords() { return []; }
    get root() { return null; }
    get rootMargin() { return this.options?.rootMargin || '0px'; }
    get thresholds() {
      const threshold = this.options?.threshold;
      if (Array.isArray(threshold)) return threshold;
      if (typeof threshold === 'number') return [threshold];
      return [0];
    }
  };
} else {
  console.log('❌ IntersectionObserver already exists!');
}

// Now import ImageHandler
const { getImageHandler } = await import('./src/core/renderer/imageHandler.js');

const imageHandler = getImageHandler();

console.log('\n=== Creating lazy image ===');
const lazyImg = imageHandler.createLazyImage('https://example.com/test.jpg');

console.log('\n=== Checking classList ===');
console.log('Image className:', lazyImg.className);
console.log('Has image-loading:', lazyImg.classList.contains('image-loading'));
console.log('Has image-pending:', lazyImg.classList.contains('image-pending'));
console.log('Has lazy-image:', lazyImg.classList.contains('lazy-image'));

console.log('\n=== Test Result ===');
const hasLoadingOrPending = lazyImg.classList.contains('image-loading') || lazyImg.classList.contains('image-pending');
console.log('Has image-loading OR image-pending:', hasLoadingOrPending);

if (!hasLoadingOrPending) {
  console.log('❌ TEST FAILED: No loading/pending class found!');
  console.log('All classes:', Array.from(lazyImg.classList));
} else {
  console.log('✅ TEST PASSED!');
}
