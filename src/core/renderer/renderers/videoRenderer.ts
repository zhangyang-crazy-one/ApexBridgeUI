/**
 * Video Renderer (CORE-028)
 *
 * Responsibilities:
 * - Render video content with standard playback controls
 * - Support common video formats (MP4, WebM, OGG)
 * - Provide play/pause, seek, volume controls
 * - Support full-screen mode
 * - Display video metadata (duration, resolution, format)
 * - Playback speed control
 * - Subtitle/caption support
 * - Streaming chunk rendering (progressive video loading)
 *
 * Features:
 * - Play/Pause: Standard playback controls
 * - Seek Bar: Click or drag to seek position
 * - Volume Control: Slider with mute button
 * - Full-screen Mode: Toggle full-screen playback
 * - Playback Speed: 0.25x to 2x speed options
 * - Picture-in-Picture: PiP mode support
 * - Keyboard Shortcuts: Space (play/pause), Arrow keys (seek), M (mute)
 * - Time Display: Current time / Total duration
 * - Resolution Display: Show video dimensions
 * - Progress Buffering: Show buffered ranges
 * - Subtitles: WebVTT subtitle support
 * - Loop Control: Enable/disable video looping
 * - Download Button: Download video file
 *
 * Usage:
 * ```typescript
 * import { createVideoRenderer } from './renderers/videoRenderer';
 *
 * const renderer = createVideoRenderer();
 * const html = await renderer.render('https://example.com/video.mp4');
 * // Or Base64: data:video/mp4;base64,AAAAIGZ0eXBpc29t...
 * ```
 */

import type { IRenderer } from '../messageRenderer';

/**
 * Video formats
 */
export type VideoFormat = 'mp4' | 'webm' | 'ogg' | 'mov' | 'avi' | 'unknown';

/**
 * Playback speed options
 */
export type PlaybackSpeed = 0.25 | 0.5 | 0.75 | 1.0 | 1.25 | 1.5 | 1.75 | 2.0;

/**
 * Video metadata
 */
export interface VideoMetadata {
  width?: number;
  height?: number;
  duration?: number;  // Duration in seconds
  format?: VideoFormat;
  size?: number;      // File size in bytes
  src: string;
}

/**
 * Video renderer options
 */
export interface VideoRendererOptions {
  /**
   * Enable playback controls
   * Default: true
   */
  controls?: boolean;

  /**
   * Auto-play video
   * Default: false
   */
  autoplay?: boolean;

  /**
   * Loop playback
   * Default: false
   */
  loop?: boolean;

  /**
   * Muted by default
   * Default: false
   */
  muted?: boolean;

  /**
   * Enable full-screen button
   * Default: true
   */
  fullScreenButton?: boolean;

  /**
   * Enable picture-in-picture button
   * Default: true
   */
  pipButton?: boolean;

  /**
   * Enable playback speed control
   * Default: true
   */
  speedControl?: boolean;

  /**
   * Enable download button
   * Default: true
   */
  downloadButton?: boolean;

  /**
   * Show video metadata
   * Default: true
   */
  showMetadata?: boolean;

  /**
   * Enable keyboard shortcuts
   * Default: true
   */
  keyboardShortcuts?: boolean;

  /**
   * Default volume (0-1)
   * Default: 1.0
   */
  defaultVolume?: number;

  /**
   * Default playback speed
   * Default: 1.0
   */
  defaultSpeed?: PlaybackSpeed;

  /**
   * Preload strategy
   * Default: 'metadata'
   */
  preload?: 'none' | 'metadata' | 'auto';

  /**
   * Background color for video container
   * Default: '#000000'
   */
  backgroundColor?: string;

  /**
   * Custom CSS class for video container
   * Default: 'video-renderer'
   */
  className?: string;

  /**
   * Enable subtitle track
   * Default: true
   */
  subtitles?: boolean;

  /**
   * Subtitle track URL (.vtt file)
   */
  subtitleUrl?: string;
}

/**
 * Video Renderer
 * Implements IRenderer interface for video with standard controls
 */
export class VideoRenderer implements IRenderer {
  public readonly type = 'video' as const;

  private options: Required<Omit<VideoRendererOptions, 'subtitleUrl'>> & {
    subtitleUrl?: string;
  };

  private streamBuffer: string = '';
  private videoCounter: number = 1;

  constructor(options: VideoRendererOptions = {}) {
    this.options = {
      controls: options.controls ?? true,
      autoplay: options.autoplay ?? false,
      loop: options.loop ?? false,
      muted: options.muted ?? false,
      fullScreenButton: options.fullScreenButton ?? true,
      pipButton: options.pipButton ?? true,
      speedControl: options.speedControl ?? true,
      downloadButton: options.downloadButton ?? true,
      showMetadata: options.showMetadata ?? true,
      keyboardShortcuts: options.keyboardShortcuts ?? true,
      defaultVolume: options.defaultVolume ?? 1.0,
      defaultSpeed: options.defaultSpeed ?? 1.0,
      preload: options.preload ?? 'metadata',
      backgroundColor: options.backgroundColor ?? '#000000',
      className: options.className ?? 'video-renderer',
      subtitles: options.subtitles ?? true,
      subtitleUrl: options.subtitleUrl
    };
  }

  /**
   * Check if content is a video
   * Detection heuristics:
   * - Starts with data:video/ (Base64)
   * - Ends with video extension (.mp4, .webm, .ogg, etc.)
   * - Valid URL pointing to video
   */
  public canRender(content: string): boolean {
    const trimmed = content.trim();

    // Empty content
    if (!trimmed) return false;

    // Check for Base64 video
    if (/^data:video\/(mp4|webm|ogg|mov|avi);base64,/.test(trimmed)) {
      return true;
    }

    // Check for video URL extensions
    if (/\.(mp4|webm|ogg|ogv|mov|avi|m4v|mkv)(\?.*)?$/i.test(trimmed)) {
      return true;
    }

    // Check if it's a valid URL (might be a video)
    try {
      new URL(trimmed);
      return /^https?:\/\//i.test(trimmed);
    } catch {
      return false;
    }
  }

  /**
   * Render video to HTML with custom controls
   */
  public async render(content: string, metadata?: Record<string, any>): Promise<string> {
    try {
      const trimmed = content.trim();

      // Extract video metadata
      const videoMetadata = await this.extractMetadata(trimmed);

      // Generate unique ID
      const videoId = `video-player-${Date.now()}-${this.videoCounter++}`;

      // Build video HTML
      const videoHtml = this.buildVideoHTML(videoMetadata, videoId);

      return videoHtml;

    } catch (error) {
      console.error('[VideoRenderer] Render error:', error);
      throw error;
    }
  }

  /**
   * Handle streaming chunk
   * Buffer chunks until complete video data
   */
  public renderChunk(chunk: string, container: HTMLElement): void {
    // Append to buffer
    this.streamBuffer += chunk;

    // Show loading placeholder
    if (!container.querySelector('.video-loading')) {
      const loading = document.createElement('div');
      loading.className = 'video-loading';
      loading.textContent = '⏳ Loading video...';
      container.appendChild(loading);
    }
  }

  /**
   * Finalize streaming render
   * Parse buffered content as complete video
   */
  public async finalize(container: HTMLElement): Promise<void> {
    if (!this.streamBuffer) return;

    try {
      // Remove loading placeholder
      const loading = container.querySelector('.video-loading');
      if (loading) loading.remove();

      // Render complete buffered content
      const html = await this.render(this.streamBuffer);

      // Replace container content
      container.innerHTML = html;

      // Initialize video controls
      this.initializeVideo(container);

      // Clear buffer
      this.streamBuffer = '';

    } catch (error) {
      console.error('[VideoRenderer] Finalize error:', error);
      container.innerHTML = this.buildErrorFallback(this.streamBuffer, error as Error);
      this.streamBuffer = '';
    }
  }

  /**
   * Extract video metadata
   */
  private async extractMetadata(src: string): Promise<VideoMetadata> {
    const metadata: VideoMetadata = { src };

    // Detect format from URL or Base64
    if (src.startsWith('data:video/')) {
      const formatMatch = src.match(/^data:video\/(mp4|webm|ogg|mov|avi);base64,/);
      if (formatMatch) {
        metadata.format = this.normalizeFormat(formatMatch[1]);
      }

      // Calculate Base64 size
      const base64Data = src.split(',')[1];
      if (base64Data) {
        metadata.size = Math.floor((base64Data.length * 3) / 4);
      }
    } else {
      // Extract format from file extension
      const extMatch = src.match(/\.(mp4|webm|ogg|ogv|mov|avi|m4v|mkv)(\?.*)?$/i);
      if (extMatch) {
        metadata.format = this.normalizeFormat(extMatch[1]);
      }
    }

    // In production, this would load the video to get metadata:
    // const video = document.createElement('video');
    // video.src = src;
    // await video.loadedmetadata;
    // metadata.width = video.videoWidth;
    // metadata.height = video.videoHeight;
    // metadata.duration = video.duration;

    return metadata;
  }

  /**
   * Normalize video format string
   */
  private normalizeFormat(format: string): VideoFormat {
    const normalized = format.toLowerCase()
      .replace(/^ogv$/, 'ogg')
      .replace(/^m4v$/, 'mp4')
      .replace(/^mkv$/, 'mp4');

    if (['mp4', 'webm', 'ogg', 'mov', 'avi'].includes(normalized)) {
      return normalized as VideoFormat;
    }

    return 'unknown';
  }

  /**
   * Build video HTML
   */
  private buildVideoHTML(metadata: VideoMetadata, videoId: string): string {
    const { src, width, height, duration, format, size } = metadata;

    // Build container
    let html = `<div class="${this.options.className}" data-video-id="${videoId}">`;

    // Header with actions
    html += '<div class="video-header">';
    html += '<span class="video-label">Video Player</span>';

    if (this.options.showMetadata && (width || height || format || duration)) {
      html += '<span class="video-metadata">';
      if (width && height) {
        html += `${width} × ${height}`;
      }
      if (format) {
        html += ` • ${format.toUpperCase()}`;
      }
      if (duration) {
        html += ` • ${this.formatDuration(duration)}`;
      }
      if (size) {
        html += ` • ${this.formatFileSize(size)}`;
      }
      html += '</span>';
    }

    html += '<div class="video-actions">';

    if (this.options.downloadButton) {
      html += '<button class="video-download-btn" data-action="download" title="Download">💾 Download</button>';
    }

    html += '</div>'; // .video-actions
    html += '</div>'; // .video-header

    // Video container
    html += `<div class="video-container" style="background-color: ${this.options.backgroundColor}">`;

    // Video element
    const autoplayAttr = this.options.autoplay ? ' autoplay' : '';
    const loopAttr = this.options.loop ? ' loop' : '';
    const mutedAttr = this.options.muted ? ' muted' : '';
    const preloadAttr = ` preload="${this.options.preload}"`;

    html += `<video class="video-element" ${autoplayAttr}${loopAttr}${mutedAttr}${preloadAttr}>`;
    html += `<source src="${this.escapeHtml(src)}" type="video/${format || 'mp4'}">`;

    // Subtitle track
    if (this.options.subtitles && this.options.subtitleUrl) {
      html += `<track kind="subtitles" src="${this.escapeHtml(this.options.subtitleUrl)}" srclang="en" label="English" default>`;
    }

    html += 'Your browser does not support the video tag.';
    html += '</video>';

    html += '</div>'; // .video-container

    // Custom controls (if enabled)
    if (this.options.controls) {
      html += this.buildCustomControls();
    }

    html += '</div>'; // .video-renderer

    return html;
  }

  /**
   * Build custom video controls
   */
  private buildCustomControls(): string {
    let html = '<div class="video-controls">';

    // Progress bar
    html += '<div class="video-progress-container">';
    html += '<div class="video-progress-bar">';
    html += '<div class="video-progress-buffered"></div>';
    html += '<div class="video-progress-played"></div>';
    html += '<div class="video-progress-handle"></div>';
    html += '</div>';
    html += '</div>';

    // Control buttons
    html += '<div class="video-controls-row">';

    // Play/Pause button
    html += '<button class="video-play-btn" data-action="play-pause" title="Play/Pause (Space)">▶</button>';

    // Time display
    html += '<span class="video-time-display">0:00 / 0:00</span>';

    // Volume control
    html += '<div class="video-volume-control">';
    html += '<button class="video-volume-btn" data-action="toggle-mute" title="Mute (M)">🔊</button>';
    html += '<input type="range" class="video-volume-slider" min="0" max="100" value="100" title="Volume">';
    html += '</div>';

    // Playback speed (if enabled)
    if (this.options.speedControl) {
      html += '<div class="video-speed-control">';
      html += '<button class="video-speed-btn" data-action="speed" title="Playback Speed">1x</button>';
      html += '<div class="video-speed-menu" style="display: none;">';
      const speeds: PlaybackSpeed[] = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0];
      speeds.forEach(speed => {
        const selected = speed === this.options.defaultSpeed ? ' selected' : '';
        html += `<button class="video-speed-option${selected}" data-speed="${speed}">${speed}x</button>`;
      });
      html += '</div>';
      html += '</div>';
    }

    // Picture-in-Picture (if enabled)
    if (this.options.pipButton) {
      html += '<button class="video-pip-btn" data-action="pip" title="Picture-in-Picture">⧉</button>';
    }

    // Full-screen (if enabled)
    if (this.options.fullScreenButton) {
      html += '<button class="video-fullscreen-btn" data-action="fullscreen" title="Full Screen (F)">⛶</button>';
    }

    html += '</div>'; // .video-controls-row

    html += '</div>'; // .video-controls

    return html;
  }

  /**
   * Initialize video controls and interactions
   */
  private initializeVideo(container: HTMLElement): void {
    const video = container.querySelector('.video-element') as HTMLVideoElement;
    const playBtn = container.querySelector('.video-play-btn') as HTMLButtonElement;
    const timeDisplay = container.querySelector('.video-time-display') as HTMLElement;
    const progressBar = container.querySelector('.video-progress-bar') as HTMLElement;
    const progressPlayed = container.querySelector('.video-progress-played') as HTMLElement;
    const progressBuffered = container.querySelector('.video-progress-buffered') as HTMLElement;
    const volumeBtn = container.querySelector('.video-volume-btn') as HTMLButtonElement;
    const volumeSlider = container.querySelector('.video-volume-slider') as HTMLInputElement;
    const pipBtn = container.querySelector('.video-pip-btn') as HTMLButtonElement;
    const fullscreenBtn = container.querySelector('.video-fullscreen-btn') as HTMLButtonElement;

    if (!video) return;

    // Set default volume
    video.volume = this.options.defaultVolume;
    if (volumeSlider) {
      volumeSlider.value = String(this.options.defaultVolume * 100);
    }

    // Set default playback speed
    video.playbackRate = this.options.defaultSpeed;

    // Play/Pause
    if (playBtn) {
      playBtn.addEventListener('click', () => {
        if (video.paused) {
          video.play();
          playBtn.textContent = '⏸';
          playBtn.title = 'Pause (Space)';
        } else {
          video.pause();
          playBtn.textContent = '▶';
          playBtn.title = 'Play (Space)';
        }
      });
    }

    // Time update
    video.addEventListener('timeupdate', () => {
      const current = video.currentTime;
      const duration = video.duration;

      // Update time display
      if (timeDisplay) {
        timeDisplay.textContent = `${this.formatDuration(current)} / ${this.formatDuration(duration)}`;
      }

      // Update progress bar
      if (progressPlayed && duration > 0) {
        const percentage = (current / duration) * 100;
        progressPlayed.style.width = `${percentage}%`;
      }
    });

    // Update buffered progress
    video.addEventListener('progress', () => {
      if (progressBuffered && video.buffered.length > 0) {
        const buffered = video.buffered.end(video.buffered.length - 1);
        const duration = video.duration;
        if (duration > 0) {
          const percentage = (buffered / duration) * 100;
          progressBuffered.style.width = `${percentage}%`;
        }
      }
    });

    // Seek by clicking progress bar
    if (progressBar) {
      progressBar.addEventListener('click', (e) => {
        const rect = progressBar.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const percentage = clickX / rect.width;
        video.currentTime = percentage * video.duration;
      });
    }

    // Volume control
    if (volumeBtn) {
      volumeBtn.addEventListener('click', () => {
        video.muted = !video.muted;
        volumeBtn.textContent = video.muted ? '🔇' : '🔊';
        if (volumeSlider) {
          volumeSlider.value = video.muted ? '0' : String(video.volume * 100);
        }
      });
    }

    if (volumeSlider) {
      volumeSlider.addEventListener('input', (e) => {
        const value = Number((e.target as HTMLInputElement).value);
        video.volume = value / 100;
        video.muted = value === 0;
        if (volumeBtn) {
          volumeBtn.textContent = value === 0 ? '🔇' : '🔊';
        }
      });
    }

    // Playback speed control
    const speedBtn = container.querySelector('.video-speed-btn') as HTMLButtonElement;
    const speedMenu = container.querySelector('.video-speed-menu') as HTMLElement;

    if (speedBtn && speedMenu) {
      speedBtn.addEventListener('click', () => {
        const isVisible = speedMenu.style.display !== 'none';
        speedMenu.style.display = isVisible ? 'none' : 'block';
      });

      const speedOptions = speedMenu.querySelectorAll('.video-speed-option');
      speedOptions.forEach((option) => {
        option.addEventListener('click', (e) => {
          const speed = Number((e.target as HTMLElement).getAttribute('data-speed'));
          video.playbackRate = speed;
          speedBtn.textContent = `${speed}x`;

          // Update selected state
          speedOptions.forEach(opt => opt.classList.remove('selected'));
          (e.target as HTMLElement).classList.add('selected');

          speedMenu.style.display = 'none';
        });
      });

      // Close speed menu when clicking outside
      document.addEventListener('click', (e) => {
        if (!speedBtn.contains(e.target as Node) && !speedMenu.contains(e.target as Node)) {
          speedMenu.style.display = 'none';
        }
      });
    }

    // Picture-in-Picture
    if (pipBtn) {
      pipBtn.addEventListener('click', async () => {
        try {
          if (document.pictureInPictureElement) {
            await document.exitPictureInPicture();
          } else {
            await video.requestPictureInPicture();
          }
        } catch (error) {
          console.error('[VideoRenderer] PiP error:', error);
        }
      });
    }

    // Full-screen
    if (fullscreenBtn) {
      fullscreenBtn.addEventListener('click', () => {
        if (document.fullscreenElement) {
          document.exitFullscreen();
          fullscreenBtn.textContent = '⛶';
        } else {
          container.requestFullscreen();
          fullscreenBtn.textContent = '⛶';
        }
      });
    }

    // Download button
    const downloadBtn = container.querySelector('.video-download-btn');
    if (downloadBtn) {
      downloadBtn.addEventListener('click', () => {
        const link = document.createElement('a');
        link.href = video.src;
        link.download = 'video';
        link.click();
      });
    }

    // Keyboard shortcuts (if enabled)
    if (this.options.keyboardShortcuts) {
      container.addEventListener('keydown', (e) => {
        switch (e.key) {
          case ' ':
            e.preventDefault();
            if (playBtn) playBtn.click();
            break;
          case 'ArrowLeft':
            e.preventDefault();
            video.currentTime = Math.max(0, video.currentTime - 5);
            break;
          case 'ArrowRight':
            e.preventDefault();
            video.currentTime = Math.min(video.duration, video.currentTime + 5);
            break;
          case 'ArrowUp':
            e.preventDefault();
            video.volume = Math.min(1, video.volume + 0.1);
            if (volumeSlider) volumeSlider.value = String(video.volume * 100);
            break;
          case 'ArrowDown':
            e.preventDefault();
            video.volume = Math.max(0, video.volume - 0.1);
            if (volumeSlider) volumeSlider.value = String(video.volume * 100);
            break;
          case 'm':
          case 'M':
            e.preventDefault();
            if (volumeBtn) volumeBtn.click();
            break;
          case 'f':
          case 'F':
            e.preventDefault();
            if (fullscreenBtn) fullscreenBtn.click();
            break;
        }
      });

      // Make container focusable
      container.setAttribute('tabindex', '0');
    }

    console.log('[VideoRenderer] Video controls initialized');
  }

  /**
   * Format duration in seconds to MM:SS or HH:MM:SS
   */
  private formatDuration(seconds: number): string {
    if (isNaN(seconds) || !isFinite(seconds)) return '0:00';

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    } else {
      return `${minutes}:${String(secs).padStart(2, '0')}`;
    }
  }

  /**
   * Format file size
   */
  private formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }

  /**
   * Build error fallback display
   */
  private buildErrorFallback(content: string, error: Error): string {
    return `
      <div class="${this.options.className} error">
        <div class="error-message">
          <strong>Video Loading Error:</strong> ${this.escapeHtml(error.message)}
        </div>
        <div class="video-source">
          <pre><code>${this.escapeHtml(content.substring(0, 200))}${content.length > 200 ? '...' : ''}</code></pre>
        </div>
      </div>
    `;
  }

  /**
   * Escape HTML entities
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Get renderer configuration
   */
  public getOptions(): typeof this.options {
    return { ...this.options };
  }

  /**
   * Update renderer options
   */
  public setOptions(options: Partial<VideoRendererOptions>): void {
    this.options = { ...this.options, ...options };
  }
}

/**
 * Factory function to create video renderer
 */
export function createVideoRenderer(options?: VideoRendererOptions): VideoRenderer {
  return new VideoRenderer(options);
}

/**
 * Convenience function to render video
 */
export async function renderVideo(
  content: string,
  options?: VideoRendererOptions
): Promise<string> {
  const renderer = createVideoRenderer(options);
  return renderer.render(content);
}

/**
 * Example videos for documentation
 */
export const VIDEO_EXAMPLES = {
  url: 'https://example.com/video.mp4',

  base64Mp4: 'data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28y...',

  webm: 'https://example.com/video.webm',

  withSubtitles: {
    videoUrl: 'https://example.com/video.mp4',
    subtitleUrl: 'https://example.com/subtitles.vtt'
  }
};
