/**
 * PDF.js Worker Configuration (CORE-031)
 *
 * Responsibilities:
 * - Configure PDF.js worker for different environments
 * - Support Tauri desktop app (offline, local worker)
 * - Support browser environment (dev server, CDN fallback)
 * - Provide unified PDF.js import interface
 *
 * Architecture:
 * - Tauri: Use bundled local worker (no network dependency)
 * - Browser: Use local worker from node_modules
 * - Production: Worker bundled with application
 */

import * as pdfjsLib from 'pdfjs-dist';

/**
 * Check if running in Tauri environment
 */
function isTauriEnvironment(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window;
}

/**
 * Configure PDF.js worker path based on environment
 * Must be called before using PDF.js functionality
 */
export function configurePDFWorker(): void {
  if (typeof window === 'undefined') {
    console.warn('[PDFWorker] Not in browser environment, skipping worker configuration');
    return;
  }

  try {
    if (isTauriEnvironment()) {
      // Tauri environment: use local bundled worker
      console.log('[PDFWorker] Configuring for Tauri environment');
      
      // Use Vite's import.meta.url to resolve worker path
      const workerUrl = new URL(
        'pdfjs-dist/build/pdf.worker.min.js',
        import.meta.url
      ).toString();
      
      pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
      console.log('[PDFWorker] Worker configured:', workerUrl);
      
    } else {
      // Browser environment: use local worker from node_modules
      console.log('[PDFWorker] Configuring for browser environment');
      
      // In development, Vite will serve from node_modules
      // In production, worker will be bundled
      pdfjsLib.GlobalWorkerOptions.workerSrc = 
        '/node_modules/pdfjs-dist/build/pdf.worker.min.js';
      
      console.log('[PDFWorker] Worker configured for browser');
    }
  } catch (error) {
    console.error('[PDFWorker] Failed to configure worker:', error);
    
    // Fallback to CDN (only works in browser with internet)
    console.warn('[PDFWorker] Falling back to CDN worker');
    pdfjsLib.GlobalWorkerOptions.workerSrc = 
      'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
  }
}

/**
 * Export PDF.js library
 */
export { pdfjsLib };

/**
 * Check if PDF.js is properly configured
 */
export function isPDFWorkerConfigured(): boolean {
  return !!pdfjsLib.GlobalWorkerOptions.workerSrc;
}

/**
 * Get current worker source URL
 */
export function getWorkerSource(): string | undefined {
  return pdfjsLib.GlobalWorkerOptions.workerSrc;
}

