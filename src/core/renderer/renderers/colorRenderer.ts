/**
 * Color Preview Renderer (CORE-037)
 *
 * Responsibilities:
 * - Render color swatches for detected color codes
 * - Support multiple color formats (HEX, RGB, RGBA, HSL, HSLA, named colors)
 * - Display color information and conversions
 * - Copy color codes to clipboard
 * - Show color palette when multiple colors detected
 * - Accessibility information (WCAG contrast ratios)
 * - Color harmony suggestions
 * - Export palette to various formats
 * - Streaming chunk rendering (progressive color loading)
 *
 * Features:
 * - Multi-Format Support: HEX, RGB, RGBA, HSL, HSLA, named colors (147 CSS colors)
 * - Color Swatches: Visual color preview with large clickable areas
 * - Format Conversion: Automatic conversion between all formats
 * - Contrast Checker: WCAG AA/AAA compliance checking
 * - Color Information: RGB, HSL values, luminance, brightness
 * - Copy Button: Copy color in any format
 * - Palette View: Grid display when 2+ colors detected
 * - Harmony Suggestions: Complementary, analogous, triadic colors
 * - Export: JSON, CSS variables, Tailwind, SCSS formats
 * - Dark/Light Theme: Auto-adapts to theme
 *
 * Usage:
 * ```typescript
 * import { createColorRenderer } from './renderers/colorRenderer';
 *
 * const renderer = createColorRenderer();
 * const html = await renderer.render(colorContent);
 * ```
 */

import type { IRenderer } from '../messageRenderer';

/**
 * Color format type
 */
export type ColorFormat = 'hex' | 'rgb' | 'rgba' | 'hsl' | 'hsla' | 'named';

/**
 * Parsed color information
 */
export interface ColorInfo {
  original: string;
  format: ColorFormat;
  hex: string;
  rgb: { r: number; g: number; b: number };
  rgba: { r: number; g: number; b: number; a: number };
  hsl: { h: number; s: number; l: number };
  hsla: { h: number; s: number; l: number; a: number };
  name?: string;
  luminance: number;
  brightness: number;
  isDark: boolean;
}

/**
 * Color contrast result
 */
export interface ContrastResult {
  ratio: number;
  AA: boolean;
  AAA: boolean;
  AALarge: boolean;
  AAALarge: boolean;
}

/**
 * Color harmony suggestion
 */
export interface ColorHarmony {
  type: 'complementary' | 'analogous' | 'triadic' | 'tetradic' | 'split-complementary';
  colors: string[];
}

/**
 * Color renderer options
 */
export interface ColorRendererOptions {
  /**
   * Show color information panel
   * Default: true
   */
  showInfo?: boolean;

  /**
   * Show format conversions
   * Default: true
   */
  showConversions?: boolean;

  /**
   * Show contrast checker
   * Default: true
   */
  showContrast?: boolean;

  /**
   * Show color harmony suggestions
   * Default: true
   */
  showHarmony?: boolean;

  /**
   * Enable copy button
   * Default: true
   */
  copyButton?: boolean;

  /**
   * Enable export button
   * Default: true
   */
  exportButton?: boolean;

  /**
   * Show palette view for multiple colors
   * Default: true
   */
  paletteView?: boolean;

  /**
   * Swatch size (px)
   * Default: 80
   */
  swatchSize?: number;

  /**
   * Max colors to display
   * Default: 20
   */
  maxColors?: number;

  /**
   * Contrast background color for light colors
   * Default: '#FFFFFF'
   */
  contrastBackground?: string;

  /**
   * Custom CSS class for color container
   * Default: 'color-renderer'
   */
  className?: string;
}

/**
 * Color Renderer
 * Implements IRenderer interface for color preview with swatches
 */
export class ColorRenderer implements IRenderer {
  public readonly type = 'color' as const;

  private options: Required<ColorRendererOptions>;
  private streamBuffer: string = '';
  private colorCounter: number = 1;

  // CSS named colors (147 colors)
  private readonly NAMED_COLORS: Record<string, string> = {
    'aliceblue': '#F0F8FF',
    'antiquewhite': '#FAEBD7',
    'aqua': '#00FFFF',
    'aquamarine': '#7FFFD4',
    'azure': '#F0FFFF',
    'beige': '#F5F5DC',
    'bisque': '#FFE4C4',
    'black': '#000000',
    'blanchedalmond': '#FFEBCD',
    'blue': '#0000FF',
    'blueviolet': '#8A2BE2',
    'brown': '#A52A2A',
    'burlywood': '#DEB887',
    'cadetblue': '#5F9EA0',
    'chartreuse': '#7FFF00',
    'chocolate': '#D2691E',
    'coral': '#FF7F50',
    'cornflowerblue': '#6495ED',
    'cornsilk': '#FFF8DC',
    'crimson': '#DC143C',
    'cyan': '#00FFFF',
    'darkblue': '#00008B',
    'darkcyan': '#008B8B',
    'darkgoldenrod': '#B8860B',
    'darkgray': '#A9A9A9',
    'darkgrey': '#A9A9A9',
    'darkgreen': '#006400',
    'darkkhaki': '#BDB76B',
    'darkmagenta': '#8B008B',
    'darkolivegreen': '#556B2F',
    'darkorange': '#FF8C00',
    'darkorchid': '#9932CC',
    'darkred': '#8B0000',
    'darksalmon': '#E9967A',
    'darkseagreen': '#8FBC8F',
    'darkslateblue': '#483D8B',
    'darkslategray': '#2F4F4F',
    'darkslategrey': '#2F4F4F',
    'darkturquoise': '#00CED1',
    'darkviolet': '#9400D3',
    'deeppink': '#FF1493',
    'deepskyblue': '#00BFFF',
    'dimgray': '#696969',
    'dimgrey': '#696969',
    'dodgerblue': '#1E90FF',
    'firebrick': '#B22222',
    'floralwhite': '#FFFAF0',
    'forestgreen': '#228B22',
    'fuchsia': '#FF00FF',
    'gainsboro': '#DCDCDC',
    'ghostwhite': '#F8F8FF',
    'gold': '#FFD700',
    'goldenrod': '#DAA520',
    'gray': '#808080',
    'grey': '#808080',
    'green': '#008000',
    'greenyellow': '#ADFF2F',
    'honeydew': '#F0FFF0',
    'hotpink': '#FF69B4',
    'indianred': '#CD5C5C',
    'indigo': '#4B0082',
    'ivory': '#FFFFF0',
    'khaki': '#F0E68C',
    'lavender': '#E6E6FA',
    'lavenderblush': '#FFF0F5',
    'lawngreen': '#7CFC00',
    'lemonchiffon': '#FFFACD',
    'lightblue': '#ADD8E6',
    'lightcoral': '#F08080',
    'lightcyan': '#E0FFFF',
    'lightgoldenrodyellow': '#FAFAD2',
    'lightgray': '#D3D3D3',
    'lightgrey': '#D3D3D3',
    'lightgreen': '#90EE90',
    'lightpink': '#FFB6C1',
    'lightsalmon': '#FFA07A',
    'lightseagreen': '#20B2AA',
    'lightskyblue': '#87CEFA',
    'lightslategray': '#778899',
    'lightslategrey': '#778899',
    'lightsteelblue': '#B0C4DE',
    'lightyellow': '#FFFFE0',
    'lime': '#00FF00',
    'limegreen': '#32CD32',
    'linen': '#FAF0E6',
    'magenta': '#FF00FF',
    'maroon': '#800000',
    'mediumaquamarine': '#66CDAA',
    'mediumblue': '#0000CD',
    'mediumorchid': '#BA55D3',
    'mediumpurple': '#9370DB',
    'mediumseagreen': '#3CB371',
    'mediumslateblue': '#7B68EE',
    'mediumspringgreen': '#00FA9A',
    'mediumturquoise': '#48D1CC',
    'mediumvioletred': '#C71585',
    'midnightblue': '#191970',
    'mintcream': '#F5FFFA',
    'mistyrose': '#FFE4E1',
    'moccasin': '#FFE4B5',
    'navajowhite': '#FFDEAD',
    'navy': '#000080',
    'oldlace': '#FDF5E6',
    'olive': '#808000',
    'olivedrab': '#6B8E23',
    'orange': '#FFA500',
    'orangered': '#FF4500',
    'orchid': '#DA70D6',
    'palegoldenrod': '#EEE8AA',
    'palegreen': '#98FB98',
    'paleturquoise': '#AFEEEE',
    'palevioletred': '#DB7093',
    'papayawhip': '#FFEFD5',
    'peachpuff': '#FFDAB9',
    'peru': '#CD853F',
    'pink': '#FFC0CB',
    'plum': '#DDA0DD',
    'powderblue': '#B0E0E6',
    'purple': '#800080',
    'rebeccapurple': '#663399',
    'red': '#FF0000',
    'rosybrown': '#BC8F8F',
    'royalblue': '#4169E1',
    'saddlebrown': '#8B4513',
    'salmon': '#FA8072',
    'sandybrown': '#F4A460',
    'seagreen': '#2E8B57',
    'seashell': '#FFF5EE',
    'sienna': '#A0522D',
    'silver': '#C0C0C0',
    'skyblue': '#87CEEB',
    'slateblue': '#6A5ACD',
    'slategray': '#708090',
    'slategrey': '#708090',
    'snow': '#FFFAFA',
    'springgreen': '#00FF7F',
    'steelblue': '#4682B4',
    'tan': '#D2B48C',
    'teal': '#008080',
    'thistle': '#D8BFD8',
    'tomato': '#FF6347',
    'turquoise': '#40E0D0',
    'violet': '#EE82EE',
    'wheat': '#F5DEB3',
    'white': '#FFFFFF',
    'whitesmoke': '#F5F5F5',
    'yellow': '#FFFF00',
    'yellowgreen': '#9ACD32'
  };

  constructor(options: ColorRendererOptions = {}) {
    this.options = {
      showInfo: options.showInfo ?? true,
      showConversions: options.showConversions ?? true,
      showContrast: options.showContrast ?? true,
      showHarmony: options.showHarmony ?? true,
      copyButton: options.copyButton ?? true,
      exportButton: options.exportButton ?? true,
      paletteView: options.paletteView ?? true,
      swatchSize: options.swatchSize ?? 80,
      maxColors: options.maxColors ?? 20,
      contrastBackground: options.contrastBackground ?? '#FFFFFF',
      className: options.className ?? 'color-renderer'
    };
  }

  /**
   * Check if content contains color codes
   * Detection heuristics:
   * - HEX colors (#RGB, #RRGGBB, #RRGGBBAA)
   * - RGB/RGBA functions
   * - HSL/HSLA functions
   * - Named CSS colors
   */
  public canRender(content: string): boolean {
    const trimmed = content.trim();

    // Empty content
    if (!trimmed) return false;

    // Check for HEX colors
    if (/#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})\b/.test(trimmed)) {
      return true;
    }

    // Check for RGB/RGBA
    if (/rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+(\s*,\s*[\d.]+)?\s*\)/i.test(trimmed)) {
      return true;
    }

    // Check for HSL/HSLA
    if (/hsla?\(\s*\d+\s*,\s*\d+%\s*,\s*\d+%(\s*,\s*[\d.]+)?\s*\)/i.test(trimmed)) {
      return true;
    }

    // Check for named colors (only if standalone word)
    const words = trimmed.toLowerCase().split(/\s+/);
    const hasNamedColor = words.some(word =>
      this.NAMED_COLORS.hasOwnProperty(word.replace(/[^\w]/g, ''))
    );

    return hasNamedColor;
  }

  /**
   * Render colors to HTML
   */
  public async render(content: string, metadata?: Record<string, any>): Promise<string> {
    try {
      const trimmed = content.trim();

      // Extract all colors
      const colors = this.extractColors(trimmed);

      if (colors.length === 0) {
        return this.buildNoColorsMessage();
      }

      // Generate unique ID
      const colorId = `color-viewer-${Date.now()}-${this.colorCounter++}`;

      // Build color HTML
      const colorHtml = this.buildColorHTML(colors, colorId);

      return colorHtml;

    } catch (error) {
      console.error('[ColorRenderer] Render error:', error);
      throw error;
    }
  }

  /**
   * Handle streaming chunk
   * Buffer chunks until complete color data
   */
  public renderChunk(chunk: string, container: HTMLElement): void {
    // Append to buffer
    this.streamBuffer += chunk;

    // Show loading placeholder
    if (!container.querySelector('.color-loading')) {
      const loading = document.createElement('div');
      loading.className = 'color-loading';
      loading.textContent = '⏳ Loading colors...';
      container.appendChild(loading);
    }
  }

  /**
   * Finalize streaming render
   * Parse buffered content as complete color data
   */
  public async finalize(container: HTMLElement): Promise<void> {
    if (!this.streamBuffer) return;

    try {
      // Remove loading placeholder
      const loading = container.querySelector('.color-loading');
      if (loading) loading.remove();

      // Render complete buffered content
      const html = await this.render(this.streamBuffer);

      // Replace container content
      container.innerHTML = html;

      // Initialize color viewer interactions
      this.initializeColor(container);

      // Clear buffer
      this.streamBuffer = '';

    } catch (error) {
      console.error('[ColorRenderer] Finalize error:', error);
      container.innerHTML = this.buildErrorFallback(this.streamBuffer, error as Error);
      this.streamBuffer = '';
    }
  }

  /**
   * Extract all colors from content
   */
  private extractColors(content: string): ColorInfo[] {
    const colors: ColorInfo[] = [];
    const seen = new Set<string>();

    // Extract HEX colors
    const hexRegex = /#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})\b/g;
    let hexMatch;
    while ((hexMatch = hexRegex.exec(content)) !== null) {
      const hex = hexMatch[0];
      if (!seen.has(hex.toLowerCase()) && colors.length < this.options.maxColors) {
        seen.add(hex.toLowerCase());
        const colorInfo = this.parseColor(hex);
        if (colorInfo) colors.push(colorInfo);
      }
    }

    // Extract RGB/RGBA colors
    const rgbRegex = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(\s*,\s*([\d.]+))?\s*\)/gi;
    let rgbMatch;
    while ((rgbMatch = rgbRegex.exec(content)) !== null) {
      const rgb = rgbMatch[0];
      if (!seen.has(rgb.toLowerCase()) && colors.length < this.options.maxColors) {
        seen.add(rgb.toLowerCase());
        const colorInfo = this.parseColor(rgb);
        if (colorInfo) colors.push(colorInfo);
      }
    }

    // Extract HSL/HSLA colors
    const hslRegex = /hsla?\(\s*(\d+)\s*,\s*(\d+)%\s*,\s*(\d+)%(\s*,\s*([\d.]+))?\s*\)/gi;
    let hslMatch;
    while ((hslMatch = hslRegex.exec(content)) !== null) {
      const hsl = hslMatch[0];
      if (!seen.has(hsl.toLowerCase()) && colors.length < this.options.maxColors) {
        seen.add(hsl.toLowerCase());
        const colorInfo = this.parseColor(hsl);
        if (colorInfo) colors.push(colorInfo);
      }
    }

    // Extract named colors
    const words = content.split(/\s+/);
    for (const word of words) {
      const cleanWord = word.toLowerCase().replace(/[^\w]/g, '');
      if (this.NAMED_COLORS.hasOwnProperty(cleanWord) && !seen.has(cleanWord)) {
        if (colors.length < this.options.maxColors) {
          seen.add(cleanWord);
          const colorInfo = this.parseColor(cleanWord);
          if (colorInfo) colors.push(colorInfo);
        }
      }
    }

    return colors;
  }

  /**
   * Parse color string to ColorInfo
   */
  private parseColor(colorString: string): ColorInfo | null {
    const trimmed = colorString.trim();

    // Named color
    const lowerColor = trimmed.toLowerCase();
    if (this.NAMED_COLORS.hasOwnProperty(lowerColor)) {
      const hex = this.NAMED_COLORS[lowerColor];
      const rgb = this.hexToRgb(hex);
      const hsl = this.rgbToHsl(rgb.r, rgb.g, rgb.b);
      const luminance = this.calculateLuminance(rgb.r, rgb.g, rgb.b);
      const brightness = this.calculateBrightness(rgb.r, rgb.g, rgb.b);

      return {
        original: trimmed,
        format: 'named',
        hex: hex.toUpperCase(),
        rgb,
        rgba: { ...rgb, a: 1 },
        hsl,
        hsla: { ...hsl, a: 1 },
        name: lowerColor,
        luminance,
        brightness,
        isDark: brightness < 128
      };
    }

    // HEX color
    if (trimmed.startsWith('#')) {
      let hex = trimmed.toUpperCase();

      // Expand shorthand (#RGB -> #RRGGBB)
      if (hex.length === 4) {
        hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
      }

      // Handle alpha (#RRGGBBAA -> #RRGGBB)
      let alpha = 1;
      if (hex.length === 9) {
        alpha = parseInt(hex.slice(7, 9), 16) / 255;
        hex = hex.slice(0, 7);
      }

      const rgb = this.hexToRgb(hex);
      const hsl = this.rgbToHsl(rgb.r, rgb.g, rgb.b);
      const luminance = this.calculateLuminance(rgb.r, rgb.g, rgb.b);
      const brightness = this.calculateBrightness(rgb.r, rgb.g, rgb.b);

      return {
        original: trimmed,
        format: alpha < 1 ? 'rgba' : 'hex',
        hex,
        rgb,
        rgba: { ...rgb, a: alpha },
        hsl,
        hsla: { ...hsl, a: alpha },
        luminance,
        brightness,
        isDark: brightness < 128
      };
    }

    // RGB/RGBA color
    const rgbMatch = trimmed.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(\s*,\s*([\d.]+))?\s*\)/i);
    if (rgbMatch) {
      const r = parseInt(rgbMatch[1]);
      const g = parseInt(rgbMatch[2]);
      const b = parseInt(rgbMatch[3]);
      const a = rgbMatch[5] ? parseFloat(rgbMatch[5]) : 1;

      const hex = this.rgbToHex(r, g, b);
      const hsl = this.rgbToHsl(r, g, b);
      const luminance = this.calculateLuminance(r, g, b);
      const brightness = this.calculateBrightness(r, g, b);

      return {
        original: trimmed,
        format: a < 1 ? 'rgba' : 'rgb',
        hex,
        rgb: { r, g, b },
        rgba: { r, g, b, a },
        hsl,
        hsla: { ...hsl, a },
        luminance,
        brightness,
        isDark: brightness < 128
      };
    }

    // HSL/HSLA color
    const hslMatch = trimmed.match(/hsla?\(\s*(\d+)\s*,\s*(\d+)%\s*,\s*(\d+)%(\s*,\s*([\d.]+))?\s*\)/i);
    if (hslMatch) {
      const h = parseInt(hslMatch[1]);
      const s = parseInt(hslMatch[2]);
      const l = parseInt(hslMatch[3]);
      const a = hslMatch[5] ? parseFloat(hslMatch[5]) : 1;

      const rgb = this.hslToRgb(h, s, l);
      const hex = this.rgbToHex(rgb.r, rgb.g, rgb.b);
      const luminance = this.calculateLuminance(rgb.r, rgb.g, rgb.b);
      const brightness = this.calculateBrightness(rgb.r, rgb.g, rgb.b);

      return {
        original: trimmed,
        format: a < 1 ? 'hsla' : 'hsl',
        hex,
        rgb,
        rgba: { ...rgb, a },
        hsl: { h, s, l },
        hsla: { h, s, l, a },
        luminance,
        brightness,
        isDark: brightness < 128
      };
    }

    return null;
  }

  /**
   * Convert HEX to RGB
   */
  private hexToRgb(hex: string): { r: number; g: number; b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
  }

  /**
   * Convert RGB to HEX
   */
  private rgbToHex(r: number, g: number, b: number): string {
    return '#' + [r, g, b].map(x => {
      const hex = x.toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('').toUpperCase();
  }

  /**
   * Convert RGB to HSL
   */
  private rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }

    return {
      h: Math.round(h * 360),
      s: Math.round(s * 100),
      l: Math.round(l * 100)
    };
  }

  /**
   * Convert HSL to RGB
   */
  private hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
    h /= 360;
    s /= 100;
    l /= 100;

    let r, g, b;

    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };

      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;

      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }

    return {
      r: Math.round(r * 255),
      g: Math.round(g * 255),
      b: Math.round(b * 255)
    };
  }

  /**
   * Calculate relative luminance (WCAG formula)
   */
  private calculateLuminance(r: number, g: number, b: number): number {
    const [rs, gs, bs] = [r, g, b].map(c => {
      c = c / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  }

  /**
   * Calculate brightness (perceived brightness)
   */
  private calculateBrightness(r: number, g: number, b: number): number {
    return (r * 299 + g * 587 + b * 114) / 1000;
  }

  /**
   * Calculate contrast ratio between two colors
   */
  private calculateContrast(color1: ColorInfo, color2: ColorInfo): ContrastResult {
    const l1 = Math.max(color1.luminance, color2.luminance);
    const l2 = Math.min(color1.luminance, color2.luminance);
    const ratio = (l1 + 0.05) / (l2 + 0.05);

    return {
      ratio: Math.round(ratio * 100) / 100,
      AA: ratio >= 4.5,
      AAA: ratio >= 7,
      AALarge: ratio >= 3,
      AAALarge: ratio >= 4.5
    };
  }

  /**
   * Generate color harmony
   */
  private generateHarmony(color: ColorInfo, type: ColorHarmony['type']): string[] {
    const { h, s, l } = color.hsl;
    const colors: string[] = [];

    switch (type) {
      case 'complementary':
        colors.push(this.hslToHexString((h + 180) % 360, s, l));
        break;
      case 'analogous':
        colors.push(this.hslToHexString((h + 30) % 360, s, l));
        colors.push(this.hslToHexString((h - 30 + 360) % 360, s, l));
        break;
      case 'triadic':
        colors.push(this.hslToHexString((h + 120) % 360, s, l));
        colors.push(this.hslToHexString((h + 240) % 360, s, l));
        break;
      case 'tetradic':
        colors.push(this.hslToHexString((h + 90) % 360, s, l));
        colors.push(this.hslToHexString((h + 180) % 360, s, l));
        colors.push(this.hslToHexString((h + 270) % 360, s, l));
        break;
      case 'split-complementary':
        colors.push(this.hslToHexString((h + 150) % 360, s, l));
        colors.push(this.hslToHexString((h + 210) % 360, s, l));
        break;
    }

    return colors;
  }

  /**
   * Convert HSL to HEX string
   */
  private hslToHexString(h: number, s: number, l: number): string {
    const rgb = this.hslToRgb(h, s, l);
    return this.rgbToHex(rgb.r, rgb.g, rgb.b);
  }

  /**
   * Build color HTML
   */
  private buildColorHTML(colors: ColorInfo[], colorId: string): string {
    let html = `<div class="${this.options.className}" data-color-id="${colorId}">`;

    // Header
    html += '<div class="color-header">';
    html += `<span class="color-label">Color Preview (${colors.length} ${colors.length === 1 ? 'color' : 'colors'})</span>`;

    html += '<div class="color-actions">';

    if (this.options.copyButton) {
      html += '<button class="color-copy-btn" data-action="copy" title="Copy Colors">📋</button>';
    }

    if (this.options.exportButton) {
      html += '<button class="color-export-btn" data-action="export" title="Export Palette">💾</button>';
    }

    html += '</div>'; // .color-actions
    html += '</div>'; // .color-header

    // Color swatches
    if (this.options.paletteView && colors.length > 1) {
      html += this.buildPaletteView(colors);
    } else {
      html += this.buildSingleColorView(colors[0]);
    }

    html += '</div>'; // .color-renderer

    return html;
  }

  /**
   * Build palette view for multiple colors
   */
  private buildPaletteView(colors: ColorInfo[]): string {
    let html = '<div class="color-palette">';

    for (let i = 0; i < colors.length; i++) {
      const color = colors[i];
      const textColor = color.isDark ? '#FFFFFF' : '#000000';

      html += '<div class="color-swatch-item" data-color-index="' + i + '">';
      html += `<div class="color-swatch" style="background-color: ${color.hex}; width: ${this.options.swatchSize}px; height: ${this.options.swatchSize}px; color: ${textColor};" title="${color.original}">`;
      html += `<span class="color-swatch-hex">${color.hex}</span>`;
      html += '</div>';
      html += `<div class="color-swatch-info">${this.escapeHtml(color.original)}</div>`;
      html += '</div>';
    }

    html += '</div>'; // .color-palette

    return html;
  }

  /**
   * Build single color view with detailed information
   */
  private buildSingleColorView(color: ColorInfo): string {
    let html = '<div class="color-single-view">';

    // Large swatch
    const textColor = color.isDark ? '#FFFFFF' : '#000000';
    html += '<div class="color-single-swatch-container">';
    html += `<div class="color-single-swatch" style="background-color: ${color.hex}; color: ${textColor};">`;
    html += `<div class="color-single-swatch-hex">${color.hex}</div>`;
    if (color.name) {
      html += `<div class="color-single-swatch-name">${this.escapeHtml(color.name)}</div>`;
    }
    html += '</div>';
    html += '</div>';

    // Color information
    if (this.options.showInfo) {
      html += '<div class="color-info-panel">';
      html += '<div class="color-info-section">';
      html += '<div class="color-info-header">Original Format</div>';
      html += `<div class="color-info-value"><code>${this.escapeHtml(color.original)}</code></div>`;
      html += '</div>';

      if (this.options.showConversions) {
        html += '<div class="color-info-section">';
        html += '<div class="color-info-header">Conversions</div>';
        html += '<div class="color-conversions">';
        html += `<div class="color-conversion-item"><strong>HEX:</strong> <code>${color.hex}</code></div>`;
        html += `<div class="color-conversion-item"><strong>RGB:</strong> <code>rgb(${color.rgb.r}, ${color.rgb.g}, ${color.rgb.b})</code></div>`;
        html += `<div class="color-conversion-item"><strong>HSL:</strong> <code>hsl(${color.hsl.h}, ${color.hsl.s}%, ${color.hsl.l}%)</code></div>`;
        if (color.rgba.a < 1) {
          html += `<div class="color-conversion-item"><strong>RGBA:</strong> <code>rgba(${color.rgba.r}, ${color.rgba.g}, ${color.rgba.b}, ${color.rgba.a})</code></div>`;
        }
        html += '</div>';
        html += '</div>';
      }

      html += '<div class="color-info-section">';
      html += '<div class="color-info-header">Properties</div>';
      html += '<div class="color-properties">';
      html += `<div class="color-property-item"><strong>Luminance:</strong> ${color.luminance.toFixed(3)}</div>`;
      html += `<div class="color-property-item"><strong>Brightness:</strong> ${Math.round(color.brightness)} (${color.isDark ? 'Dark' : 'Light'})</div>`;
      html += '</div>';
      html += '</div>';

      // Contrast checker
      if (this.options.showContrast) {
        const bgColor = this.parseColor(this.options.contrastBackground);
        if (bgColor) {
          const contrast = this.calculateContrast(color, bgColor);
          html += '<div class="color-info-section">';
          html += '<div class="color-info-header">WCAG Contrast vs White Background</div>';
          html += '<div class="color-contrast-results">';
          html += `<div class="color-contrast-item"><strong>Ratio:</strong> ${contrast.ratio}:1</div>`;
          html += `<div class="color-contrast-item"><strong>AA (Normal):</strong> ${contrast.AA ? '✓ Pass' : '✗ Fail'}</div>`;
          html += `<div class="color-contrast-item"><strong>AA (Large):</strong> ${contrast.AALarge ? '✓ Pass' : '✗ Fail'}</div>`;
          html += `<div class="color-contrast-item"><strong>AAA (Normal):</strong> ${contrast.AAA ? '✓ Pass' : '✗ Fail'}</div>`;
          html += `<div class="color-contrast-item"><strong>AAA (Large):</strong> ${contrast.AAALarge ? '✓ Pass' : '✗ Fail'}</div>`;
          html += '</div>';
          html += '</div>';
        }
      }

      // Color harmony
      if (this.options.showHarmony) {
        html += '<div class="color-info-section">';
        html += '<div class="color-info-header">Color Harmony</div>';
        html += '<div class="color-harmony-grid">';

        const harmonyTypes: Array<{ type: ColorHarmony['type']; label: string }> = [
          { type: 'complementary', label: 'Complementary' },
          { type: 'analogous', label: 'Analogous' },
          { type: 'triadic', label: 'Triadic' }
        ];

        for (const { type, label } of harmonyTypes) {
          const harmonyColors = this.generateHarmony(color, type);
          html += '<div class="color-harmony-item">';
          html += `<div class="color-harmony-label">${label}</div>`;
          html += '<div class="color-harmony-swatches">';
          for (const hColor of harmonyColors) {
            html += `<div class="color-harmony-swatch" style="background-color: ${hColor};" title="${hColor}"></div>`;
          }
          html += '</div>';
          html += '</div>';
        }

        html += '</div>';
        html += '</div>';
      }

      html += '</div>'; // .color-info-panel
    }

    html += '</div>'; // .color-single-view

    return html;
  }

  /**
   * Build no colors message
   */
  private buildNoColorsMessage(): string {
    return `
      <div class="${this.options.className} no-colors">
        <div class="no-colors-message">
          No color codes detected. Supported formats:
          <ul>
            <li>HEX: #RGB, #RRGGBB, #RRGGBBAA</li>
            <li>RGB: rgb(r, g, b), rgba(r, g, b, a)</li>
            <li>HSL: hsl(h, s%, l%), hsla(h, s%, l%, a)</li>
            <li>Named colors: red, blue, rebeccapurple, etc.</li>
          </ul>
        </div>
      </div>
    `;
  }

  /**
   * Initialize color viewer interactions
   */
  private initializeColor(container: HTMLElement): void {
    const colorId = container.getAttribute('data-color-id');
    if (!colorId) return;

    // Copy button
    const copyBtn = container.querySelector('.color-copy-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        const colors = this.extractColorsFromContainer(container);
        const colorList = colors.map(c => c.original).join('\n');
        navigator.clipboard.writeText(colorList).then(() => {
          (copyBtn as HTMLElement).textContent = '✓';
          setTimeout(() => {
            (copyBtn as HTMLElement).textContent = '📋';
          }, 2000);
        });
      });
    }

    // Export button
    const exportBtn = container.querySelector('.color-export-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        this.exportPalette(container);
      });
    }

    console.log('[ColorRenderer] Color viewer initialized');
  }

  /**
   * Extract colors from container
   */
  private extractColorsFromContainer(container: HTMLElement): ColorInfo[] {
    // In production, maintain color state
    // For now, re-extract from DOM
    const swatches = container.querySelectorAll('.color-swatch, .color-single-swatch');
    const colors: ColorInfo[] = [];

    swatches.forEach(swatch => {
      const bgColor = (swatch as HTMLElement).style.backgroundColor;
      if (bgColor) {
        const colorInfo = this.parseColor(bgColor);
        if (colorInfo) colors.push(colorInfo);
      }
    });

    return colors;
  }

  /**
   * Export palette
   */
  private exportPalette(container: HTMLElement): void {
    const colors = this.extractColorsFromContainer(container);

    if (colors.length === 0) {
      alert('No colors to export');
      return;
    }

    // Generate export formats
    const json = JSON.stringify(colors.map(c => ({
      hex: c.hex,
      rgb: c.rgb,
      hsl: c.hsl,
      original: c.original
    })), null, 2);

    const css = colors.map((c, i) => `  --color-${i + 1}: ${c.hex};`).join('\n');

    const scss = colors.map((c, i) => `$color-${i + 1}: ${c.hex};`).join('\n');

    const tailwind = colors.map((c, i) => `        'custom-${i + 1}': '${c.hex}',`).join('\n');

    const exportContent = `/* Palette Export */

/* JSON */
${json}

/* CSS Variables */
:root {
${css}
}

/* SCSS Variables */
${scss}

/* Tailwind Config */
module.exports = {
  theme: {
    extend: {
      colors: {
${tailwind}
      }
    }
  }
}
`;

    // Download file
    const blob = new Blob([exportContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'color-palette.txt';
    link.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Build error fallback display
   */
  private buildErrorFallback(content: string, error: Error): string {
    return `
      <div class="${this.options.className} error">
        <div class="error-message">
          <strong>Color Rendering Error:</strong> ${this.escapeHtml(error.message)}
        </div>
        <div class="color-source">
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
  public getOptions(): Required<ColorRendererOptions> {
    return { ...this.options };
  }

  /**
   * Update renderer options
   */
  public setOptions(options: Partial<ColorRendererOptions>): void {
    this.options = { ...this.options, ...options };
  }
}

/**
 * Factory function to create color renderer
 */
export function createColorRenderer(options?: ColorRendererOptions): ColorRenderer {
  return new ColorRenderer(options);
}

/**
 * Convenience function to render colors
 */
export async function renderColor(
  content: string,
  options?: ColorRendererOptions
): Promise<string> {
  const renderer = createColorRenderer(options);
  return renderer.render(content);
}

/**
 * Example colors for documentation
 */
export const COLOR_EXAMPLES = {
  hex: '#FF6B6B',
  hexShort: '#F0F',
  hexAlpha: '#FF6B6BAA',
  rgb: 'rgb(255, 107, 107)',
  rgba: 'rgba(255, 107, 107, 0.8)',
  hsl: 'hsl(0, 100%, 71%)',
  hsla: 'hsla(0, 100%, 71%, 0.8)',
  named: 'rebeccapurple',
  palette: '#FF6B6B #4ECDC4 #45B7D1 #FFA07A #98D8C8'
};
