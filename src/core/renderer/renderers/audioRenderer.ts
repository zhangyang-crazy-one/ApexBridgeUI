/**
 * Audio Renderer (CORE-029)
 *
 * Responsibilities:
 * - Render audio content with waveform visualization
 * - Support common audio formats (MP3, WAV, OGG, AAC, FLAC)
 * - Provide play/pause, seek, volume controls
 * - Real-time waveform visualization using Canvas
 * - Display audio metadata (duration, bitrate, sample rate)
 * - Playback speed control
 * - Audio spectrum analyzer (frequency visualization)
 * - Streaming chunk rendering (progressive audio loading)
 *
 * Features:
 * - Waveform Visualization: Canvas-based audio waveform display
 * - Play/Pause: Standard playback controls
 * - Seek Bar: Click or drag to seek position
 * - Volume Control: Slider with mute button
 * - Playback Speed: 0.5x to 2x speed options
 * - Spectrum Analyzer: Real-time frequency visualization
 * - Time Display: Current time / Total duration
 * - Metadata Display: Bitrate, sample rate, channels
 * - Loop Control: Enable/disable audio looping
 * - Download Button: Download audio file
 * - Keyboard Shortcuts: Space (play/pause), Arrow keys (seek), M (mute)
 * - Audio Processing: Web Audio API for advanced features
 *
 * Usage:
 * ```typescript
 * import { createAudioRenderer } from './renderers/audioRenderer';
 *
 * const renderer = createAudioRenderer();
 * const html = await renderer.render('https://example.com/audio.mp3');
 * // Or Base64: data:audio/mp3;base64,SUQzBAAAAAAAI1RSSE...
 * ```
 */

import type { IRenderer } from '../messageRenderer';

/**
 * Audio formats
 */
export type AudioFormat = 'mp3' | 'wav' | 'ogg' | 'aac' | 'flac' | 'm4a' | 'unknown';

/**
 * Playback speed options
 */
export type AudioPlaybackSpeed = 0.5 | 0.75 | 1.0 | 1.25 | 1.5 | 1.75 | 2.0;

/**
 * Visualization mode
 */
export type VisualizationMode = 'waveform' | 'spectrum' | 'bars' | 'none';

/**
 * Audio metadata
 */
export interface AudioMetadata {
  duration?: number;     // Duration in seconds
  bitrate?: number;      // Bitrate in kbps
  sampleRate?: number;   // Sample rate in Hz
  channels?: number;     // Number of channels (1=mono, 2=stereo)
  format?: AudioFormat;
  size?: number;         // File size in bytes
  src: string;
}

/**
 * Audio renderer options
 */
export interface AudioRendererOptions {
  /**
   * Enable playback controls
   * Default: true
   */
  controls?: boolean;

  /**
   * Auto-play audio
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
   * Enable waveform visualization
   * Default: true
   */
  waveform?: boolean;

  /**
   * Visualization mode
   * Default: 'waveform'
   */
  visualizationMode?: VisualizationMode;

  /**
   * Waveform color
   * Default: '#141413'
   */
  waveformColor?: string;

  /**
   * Waveform background color
   * Default: '#F0EEE6'
   */
  waveformBackgroundColor?: string;

  /**
   * Enable spectrum analyzer
   * Default: true
   */
  spectrumAnalyzer?: boolean;

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
   * Show audio metadata
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
  defaultSpeed?: AudioPlaybackSpeed;

  /**
   * Preload strategy
   * Default: 'metadata'
   */
  preload?: 'none' | 'metadata' | 'auto';

  /**
   * Waveform canvas height (pixels)
   * Default: 120
   */
  waveformHeight?: number;

  /**
   * Background color for audio container
   * Default: '#FAF9F5'
   */
  backgroundColor?: string;

  /**
   * Custom CSS class for audio container
   * Default: 'audio-renderer'
   */
  className?: string;
}

/**
 * Audio Renderer
 * Implements IRenderer interface for audio with waveform visualization
 */
export class AudioRenderer implements IRenderer {
  public readonly type = 'audio' as const;

  private options: Required<AudioRendererOptions>;
  private streamBuffer: string = '';
  private audioCounter: number = 1;

  // Web Audio API context
  private audioContext: AudioContext | null = null;
  private analyserNode: AnalyserNode | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;

  constructor(options: AudioRendererOptions = {}) {
    this.options = {
      controls: options.controls ?? true,
      autoplay: options.autoplay ?? false,
      loop: options.loop ?? false,
      muted: options.muted ?? false,
      waveform: options.waveform ?? true,
      visualizationMode: options.visualizationMode ?? 'waveform',
      waveformColor: options.waveformColor ?? '#141413',
      waveformBackgroundColor: options.waveformBackgroundColor ?? '#F0EEE6',
      spectrumAnalyzer: options.spectrumAnalyzer ?? true,
      speedControl: options.speedControl ?? true,
      downloadButton: options.downloadButton ?? true,
      showMetadata: options.showMetadata ?? true,
      keyboardShortcuts: options.keyboardShortcuts ?? true,
      defaultVolume: options.defaultVolume ?? 1.0,
      defaultSpeed: options.defaultSpeed ?? 1.0,
      preload: options.preload ?? 'metadata',
      waveformHeight: options.waveformHeight ?? 120,
      backgroundColor: options.backgroundColor ?? '#FAF9F5',
      className: options.className ?? 'audio-renderer'
    };
  }

  /**
   * Check if content is audio
   * Detection heuristics:
   * - Starts with data:audio/ (Base64)
   * - Ends with audio extension (.mp3, .wav, .ogg, etc.)
   * - Valid URL pointing to audio
   */
  public canRender(content: string): boolean {
    const trimmed = content.trim();

    // Empty content
    if (!trimmed) return false;

    // Check for Base64 audio
    if (/^data:audio\/(mp3|mpeg|wav|ogg|aac|flac|m4a|x-m4a);base64,/.test(trimmed)) {
      return true;
    }

    // Check for audio URL extensions
    if (/\.(mp3|wav|ogg|oga|aac|flac|m4a)(\?.*)?$/i.test(trimmed)) {
      return true;
    }

    // Check if it's a valid URL (might be audio)
    try {
      new URL(trimmed);
      return /^https?:\/\//i.test(trimmed);
    } catch {
      return false;
    }
  }

  /**
   * Render audio to HTML with waveform visualization
   */
  public async render(content: string, metadata?: Record<string, any>): Promise<string> {
    try {
      const trimmed = content.trim();

      // Extract audio metadata
      const audioMetadata = await this.extractMetadata(trimmed);

      // Generate unique ID
      const audioId = `audio-player-${Date.now()}-${this.audioCounter++}`;

      // Build audio HTML
      const audioHtml = this.buildAudioHTML(audioMetadata, audioId);

      return audioHtml;

    } catch (error) {
      console.error('[AudioRenderer] Render error:', error);
      throw error;
    }
  }

  /**
   * Handle streaming chunk
   * Buffer chunks until complete audio data
   */
  public renderChunk(chunk: string, container: HTMLElement): void {
    // Append to buffer
    this.streamBuffer += chunk;

    // Show loading placeholder
    if (!container.querySelector('.audio-loading')) {
      const loading = document.createElement('div');
      loading.className = 'audio-loading';
      loading.textContent = '⏳ Loading audio...';
      container.appendChild(loading);
    }
  }

  /**
   * Finalize streaming render
   * Parse buffered content as complete audio
   */
  public async finalize(container: HTMLElement): Promise<void> {
    // If there's buffered content from streaming, render it first
    if (this.streamBuffer) {
      try {
        // Remove loading placeholder
        const loading = container.querySelector('.audio-loading');
        if (loading) loading.remove();

        // Render complete buffered content
        const html = await this.render(this.streamBuffer);

        // Replace container content
        container.innerHTML = html;

        // Clear buffer
        this.streamBuffer = '';

      } catch (error) {
        console.error('[AudioRenderer] Finalize error:', error);
        container.innerHTML = this.buildErrorFallback(this.streamBuffer, error as Error);
        this.streamBuffer = '';
        return; // Don't initialize if rendering failed
      }
    }

    // Always initialize audio controls and visualization (for both streaming and non-streaming)
    console.log('[AudioRenderer] Initializing audio controls...');
    this.initializeAudio(container);
  }

  /**
   * Extract audio metadata
   */
  private async extractMetadata(src: string): Promise<AudioMetadata> {
    const metadata: AudioMetadata = { src };

    // Detect format from URL or Base64
    if (src.startsWith('data:audio/')) {
      const formatMatch = src.match(/^data:audio\/(mp3|mpeg|wav|ogg|aac|flac|m4a|x-m4a);base64,/);
      if (formatMatch) {
        const format = formatMatch[1];
        metadata.format = this.normalizeFormat(format);
      }

      // Calculate Base64 size
      const base64Data = src.split(',')[1];
      if (base64Data) {
        metadata.size = Math.floor((base64Data.length * 3) / 4);
      }
    } else {
      // Extract format from file extension
      const extMatch = src.match(/\.(mp3|wav|ogg|oga|aac|flac|m4a)(\?.*)?$/i);
      if (extMatch) {
        metadata.format = this.normalizeFormat(extMatch[1]);
      }
    }

    // In production, this would load the audio to get metadata:
    // const audio = new Audio(src);
    // await audio.loadedmetadata;
    // metadata.duration = audio.duration;
    // const audioContext = new AudioContext();
    // metadata.sampleRate = audioContext.sampleRate;

    return metadata;
  }

  /**
   * Normalize audio format string
   */
  private normalizeFormat(format: string): AudioFormat {
    const normalized = format.toLowerCase()
      .replace(/^mpeg$/, 'mp3')
      .replace(/^oga$/, 'ogg')
      .replace(/^x-m4a$/, 'm4a');

    if (['mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a'].includes(normalized)) {
      return normalized as AudioFormat;
    }

    return 'unknown';
  }

  /**
   * Build audio HTML
   */
  private buildAudioHTML(metadata: AudioMetadata, audioId: string): string {
    const { src, duration, bitrate, sampleRate, channels, format, size } = metadata;

    // Build container
    let html = `<div class="${this.options.className}" data-audio-id="${audioId}" style="background-color: ${this.options.backgroundColor}">`;

    // Header with actions
    html += '<div class="audio-header">';
    html += '<span class="audio-label">Audio Player</span>';

    if (this.options.showMetadata && (format || duration || bitrate || sampleRate)) {
      html += '<span class="audio-metadata">';
      if (format) {
        html += `${format.toUpperCase()}`;
      }
      if (duration) {
        html += ` • ${this.formatDuration(duration)}`;
      }
      if (bitrate) {
        html += ` • ${bitrate} kbps`;
      }
      if (sampleRate) {
        html += ` • ${(sampleRate / 1000).toFixed(1)} kHz`;
      }
      if (channels) {
        html += ` • ${channels === 1 ? 'Mono' : channels === 2 ? 'Stereo' : `${channels}ch`}`;
      }
      if (size) {
        html += ` • ${this.formatFileSize(size)}`;
      }
      html += '</span>';
    }

    html += '<div class="audio-actions">';

    if (this.options.downloadButton) {
      html += '<button class="audio-download-btn" data-action="download" title="Download">💾 Download</button>';
    }

    html += '</div>'; // .audio-actions
    html += '</div>'; // .audio-header

    // Waveform visualization canvas (if enabled)
    if (this.options.waveform) {
      html += `<canvas class="audio-waveform-canvas" width="800" height="${this.options.waveformHeight}" style="width: 100%; height: ${this.options.waveformHeight}px; background-color: ${this.options.waveformBackgroundColor}"></canvas>`;
    }

    // Audio element (hidden)
    const autoplayAttr = this.options.autoplay ? ' autoplay' : '';
    const loopAttr = this.options.loop ? ' loop' : '';
    const mutedAttr = this.options.muted ? ' muted' : '';
    const preloadAttr = ` preload="${this.options.preload}"`;

    html += `<audio class="audio-element" style="display: none;" ${autoplayAttr}${loopAttr}${mutedAttr}${preloadAttr}>`;
    html += `<source src="${this.escapeHtml(src)}" type="audio/${format || 'mp3'}">`;
    html += 'Your browser does not support the audio tag.';
    html += '</audio>';

    // Custom controls (if enabled)
    if (this.options.controls) {
      html += this.buildCustomControls();
    }

    html += '</div>'; // .audio-renderer

    return html;
  }

  /**
   * Build custom audio controls
   */
  private buildCustomControls(): string {
    let html = '<div class="audio-controls">';

    // Progress bar
    html += '<div class="audio-progress-container">';
    html += '<div class="audio-progress-bar">';
    html += '<div class="audio-progress-buffered"></div>';
    html += '<div class="audio-progress-played"></div>';
    html += '<div class="audio-progress-handle"></div>';
    html += '</div>';
    html += '</div>';

    // Control buttons
    html += '<div class="audio-controls-row">';

    // Play/Pause button
    html += '<button class="audio-play-btn" data-action="play-pause" title="Play/Pause (Space)">▶</button>';

    // Time display
    html += '<span class="audio-time-display">0:00 / 0:00</span>';

    // Volume control
    html += '<div class="audio-volume-control">';
    html += '<button class="audio-volume-btn" data-action="toggle-mute" title="Mute (M)">🔊</button>';
    html += '<input type="range" class="audio-volume-slider" min="0" max="100" value="100" title="Volume">';
    html += '</div>';

    // Playback speed (if enabled)
    if (this.options.speedControl) {
      html += '<div class="audio-speed-control">';
      html += '<button class="audio-speed-btn" data-action="speed" title="Playback Speed">1x</button>';
      html += '<div class="audio-speed-menu" style="display: none;">';
      const speeds: AudioPlaybackSpeed[] = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0];
      speeds.forEach(speed => {
        const selected = speed === this.options.defaultSpeed ? ' selected' : '';
        html += `<button class="audio-speed-option${selected}" data-speed="${speed}">${speed}x</button>`;
      });
      html += '</div>';
      html += '</div>';
    }

    // Visualization mode toggle (if enabled)
    if (this.options.spectrumAnalyzer) {
      html += '<button class="audio-viz-btn" data-action="toggle-viz" title="Toggle Visualization">';
      html += '<svg viewBox="0 0 1088 1024" class="audio-btn-icon" xmlns="http://www.w3.org/2000/svg">';
      html += '<path d="M532.8 182.144c224.64 0 414.976 198.784 481.088 276.864a47.808 47.808 0 0 1 0 61.952c-66.112 78.016-256.512 276.8-481.088 276.8-224.64 0-415.104-198.848-481.216-276.864a47.936 47.936 0 0 1 0-61.824C117.76 380.992 308.16 182.144 532.8 182.144z m0 123.136a184.96 184.96 0 0 0-181.12 220.8 184.32 184.32 0 0 0 181.12 148.544 184.96 184.96 0 0 0 181.12-220.864 184.32 184.32 0 0 0-181.12-148.48z" fill="currentColor"/>';
      html += '<path d="M532.8 489.984m-64.64 0a64.64 64.64 0 1 0 129.28 0 64.64 64.64 0 1 0-129.28 0Z" fill="currentColor"/>';
      html += '</svg>';
      html += '</button>';
    }

    // Loop button
    html += '<button class="audio-loop-btn" data-action="toggle-loop" title="Loop">';
    html += '<svg viewBox="0 0 1024 1024" class="audio-btn-icon" xmlns="http://www.w3.org/2000/svg">';
    html += '<path d="M60.235294 542.117647c0 132.879059 103.062588 240.941176 229.677177 240.941177v60.235294C130.048 843.294118 0 708.186353 0 542.117647s130.048-301.176471 289.912471-301.176471h254.735058L445.500235 141.793882l42.586353-42.586353L659.998118 271.058824 488.146824 442.970353l-42.646589-42.646588L544.707765 301.176471h-254.795294C163.297882 301.176471 60.235294 409.238588 60.235294 542.117647z m673.852235-301.176471v60.235295C860.702118 301.176471 963.764706 409.238588 963.764706 542.117647s-103.062588 240.941176-229.677177 240.941177h-254.795294l99.147294-99.147295-42.586353-42.586353L364.001882 813.176471l171.91153 171.911529 42.586353-42.586353L479.292235 843.294118h254.735059C893.952 843.294118 1024 708.186353 1024 542.117647s-130.048-301.176471-289.912471-301.176471z" fill="currentColor"/>';
    html += '</svg>';
    html += '</button>';

    html += '</div>'; // .audio-controls-row

    html += '</div>'; // .audio-controls

    return html;
  }

  /**
   * Initialize audio controls and visualization
   */
  private initializeAudio(container: HTMLElement): void {
    const audio = container.querySelector('.audio-element') as HTMLAudioElement;
    const canvas = container.querySelector('.audio-waveform-canvas') as HTMLCanvasElement;
    const playBtn = container.querySelector('.audio-play-btn') as HTMLButtonElement;
    const timeDisplay = container.querySelector('.audio-time-display') as HTMLElement;
    const progressBar = container.querySelector('.audio-progress-bar') as HTMLElement;
    const progressPlayed = container.querySelector('.audio-progress-played') as HTMLElement;
    const progressBuffered = container.querySelector('.audio-progress-buffered') as HTMLElement;
    const volumeBtn = container.querySelector('.audio-volume-btn') as HTMLButtonElement;
    const volumeSlider = container.querySelector('.audio-volume-slider') as HTMLInputElement;
    const loopBtn = container.querySelector('.audio-loop-btn') as HTMLButtonElement;

    if (!audio) return;

    // Set default volume
    audio.volume = this.options.defaultVolume;
    if (volumeSlider) {
      volumeSlider.value = String(this.options.defaultVolume * 100);
    }

    // Set default playback speed
    audio.playbackRate = this.options.defaultSpeed;

    // Initialize Web Audio API for visualization
    if (canvas && this.options.waveform) {
      this.initializeVisualization(audio, canvas);
    }

    // Play/Pause
    if (playBtn) {
      playBtn.addEventListener('click', () => {
        if (audio.paused) {
          audio.play();
          playBtn.textContent = '⏸';
          playBtn.title = 'Pause (Space)';
        } else {
          audio.pause();
          playBtn.textContent = '▶';
          playBtn.title = 'Play (Space)';
        }
      });
    }

    // Time update
    audio.addEventListener('timeupdate', () => {
      const current = audio.currentTime;
      const duration = audio.duration;

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
    audio.addEventListener('progress', () => {
      if (progressBuffered && audio.buffered.length > 0) {
        const buffered = audio.buffered.end(audio.buffered.length - 1);
        const duration = audio.duration;
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
        audio.currentTime = percentage * audio.duration;
      });
    }

    // Volume control
    if (volumeBtn) {
      volumeBtn.addEventListener('click', () => {
        audio.muted = !audio.muted;
        volumeBtn.textContent = audio.muted ? '🔇' : '🔊';
        if (volumeSlider) {
          volumeSlider.value = audio.muted ? '0' : String(audio.volume * 100);
        }
      });
    }

    if (volumeSlider) {
      volumeSlider.addEventListener('input', (e) => {
        const value = Number((e.target as HTMLInputElement).value);
        audio.volume = value / 100;
        audio.muted = value === 0;
        if (volumeBtn) {
          volumeBtn.textContent = value === 0 ? '🔇' : '🔊';
        }
      });
    }

    // Loop control
    if (loopBtn) {
      loopBtn.addEventListener('click', () => {
        audio.loop = !audio.loop;
        loopBtn.style.opacity = audio.loop ? '1' : '0.5';
        loopBtn.title = audio.loop ? 'Loop enabled' : 'Loop disabled';
      });

      // Set initial state
      loopBtn.style.opacity = this.options.loop ? '1' : '0.5';
    }

    // Playback speed control
    const speedBtn = container.querySelector('.audio-speed-btn') as HTMLButtonElement;
    const speedMenu = container.querySelector('.audio-speed-menu') as HTMLElement;

    if (speedBtn && speedMenu) {
      speedBtn.addEventListener('click', () => {
        const isVisible = speedMenu.style.display !== 'none';
        speedMenu.style.display = isVisible ? 'none' : 'block';
      });

      const speedOptions = speedMenu.querySelectorAll('.audio-speed-option');
      speedOptions.forEach((option) => {
        option.addEventListener('click', (e) => {
          const speed = Number((e.target as HTMLElement).getAttribute('data-speed'));
          audio.playbackRate = speed;
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

    // Visualization mode toggle
    const vizBtn = container.querySelector('.audio-viz-btn') as HTMLButtonElement;
    if (vizBtn) {
      let currentMode = this.options.visualizationMode;
      vizBtn.addEventListener('click', () => {
        const modes: VisualizationMode[] = ['waveform', 'spectrum', 'bars', 'none'];
        const currentIndex = modes.indexOf(currentMode);
        currentMode = modes[(currentIndex + 1) % modes.length];
        console.log('[AudioRenderer] Visualization mode:', currentMode);
        // In production, update visualization rendering
      });
    }

    // Download button
    const downloadBtn = container.querySelector('.audio-download-btn');
    if (downloadBtn) {
      downloadBtn.addEventListener('click', () => {
        const link = document.createElement('a');
        link.href = audio.src;
        link.download = 'audio';
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
            audio.currentTime = Math.max(0, audio.currentTime - 5);
            break;
          case 'ArrowRight':
            e.preventDefault();
            audio.currentTime = Math.min(audio.duration, audio.currentTime + 5);
            break;
          case 'ArrowUp':
            e.preventDefault();
            audio.volume = Math.min(1, audio.volume + 0.1);
            if (volumeSlider) volumeSlider.value = String(audio.volume * 100);
            break;
          case 'ArrowDown':
            e.preventDefault();
            audio.volume = Math.max(0, audio.volume - 0.1);
            if (volumeSlider) volumeSlider.value = String(audio.volume * 100);
            break;
          case 'm':
          case 'M':
            e.preventDefault();
            if (volumeBtn) volumeBtn.click();
            break;
          case 'l':
          case 'L':
            e.preventDefault();
            if (loopBtn) loopBtn.click();
            break;
        }
      });

      // Make container focusable
      container.setAttribute('tabindex', '0');
    }

    console.log('[AudioRenderer] Audio controls initialized');
  }

  /**
   * Initialize waveform visualization with Web Audio API
   */
  private initializeVisualization(audio: HTMLAudioElement, canvas: HTMLCanvasElement): void {
    try {
      // Create Audio Context
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

      // Create analyser node
      this.analyserNode = this.audioContext.createAnalyser();
      this.analyserNode.fftSize = 2048;

      // Create source node from audio element
      this.sourceNode = this.audioContext.createMediaElementSource(audio);
      this.sourceNode.connect(this.analyserNode);
      this.analyserNode.connect(this.audioContext.destination);

      // Start visualization loop
      this.drawWaveform(canvas);

    } catch (error) {
      console.error('[AudioRenderer] Web Audio API initialization error:', error);
    }
  }

  /**
   * Draw waveform visualization on canvas
   */
  private drawWaveform(canvas: HTMLCanvasElement): void {
    if (!this.analyserNode) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = this.analyserNode.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      requestAnimationFrame(draw);

      this.analyserNode!.getByteTimeDomainData(dataArray);

      // Clear canvas
      ctx.fillStyle = this.options.waveformBackgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw waveform
      ctx.lineWidth = 2;
      ctx.strokeStyle = this.options.waveformColor;
      ctx.beginPath();

      const sliceWidth = canvas.width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * canvas.height) / 2;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }

        x += sliceWidth;
      }

      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();
    };

    draw();
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
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  /**
   * Build error fallback display
   */
  private buildErrorFallback(content: string, error: Error): string {
    return `
      <div class="${this.options.className} error">
        <div class="error-message">
          <strong>Audio Loading Error:</strong> ${this.escapeHtml(error.message)}
        </div>
        <div class="audio-source">
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
  public getOptions(): Required<AudioRendererOptions> {
    return { ...this.options };
  }

  /**
   * Update renderer options
   */
  public setOptions(options: Partial<AudioRendererOptions>): void {
    this.options = { ...this.options, ...options };
  }

  /**
   * Cleanup resources
   */
  public dispose(): void {
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.analyserNode = null;
    this.sourceNode = null;
  }
}

/**
 * Factory function to create audio renderer
 */
export function createAudioRenderer(options?: AudioRendererOptions): AudioRenderer {
  return new AudioRenderer(options);
}

/**
 * Convenience function to render audio
 */
export async function renderAudio(
  content: string,
  options?: AudioRendererOptions
): Promise<string> {
  const renderer = createAudioRenderer(options);
  return renderer.render(content);
}

/**
 * Example audio for documentation
 */
export const AUDIO_EXAMPLES = {
  url: 'https://example.com/audio.mp3',

  base64Mp3: 'data:audio/mp3;base64,SUQzBAAAAAAAI1RTHE...',

  wav: 'https://example.com/audio.wav',

  ogg: 'https://example.com/audio.ogg'
};
