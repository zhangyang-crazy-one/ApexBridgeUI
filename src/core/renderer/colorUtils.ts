/**
 * Color Utilities (CORE-018A)
 *
 * Responsibilities:
 * - Extract dominant colors from avatar images
 * - Calculate vibrant/saturated colors for message theming
 * - Convert between RGB, HSL color spaces
 * - Cache color results for performance
 *
 * Algorithm:
 * 1. Load avatar image into Canvas API
 * 2. Sample pixels and build color histogram
 * 3. Find dominant color cluster using quantization
 * 4. Adjust saturation to create vibrant theme color
 * 5. Cache results to avoid re-computation
 *
 * Color Space:
 * - RGB: Standard web colors (0-255)
 * - HSL: Hue (0-360), Saturation (0-100), Lightness (0-100)
 */

export interface RGB {
  r: number;  // 0-255
  g: number;  // 0-255
  b: number;  // 0-255
}

export interface HSL {
  h: number;  // 0-360 (hue)
  s: number;  // 0-100 (saturation %)
  l: number;  // 0-100 (lightness %)
}

export interface ColorExtractionOptions {
  /**
   * Sample size for color analysis
   * Higher = more accurate but slower
   * Default: 64x64 pixels
   */
  sampleSize?: number;

  /**
   * Minimum saturation for vibrant colors (0-100)
   * Higher = more colorful results
   * Default: 30
   */
  minSaturation?: number;

  /**
   * Target saturation for theme colors (0-100)
   * Default: 60
   */
  targetSaturation?: number;

  /**
   * Avoid near-grayscale colors
   * Default: true
   */
  skipGrayscale?: boolean;
}

/**
 * Color Utilities Manager
 * Singleton class for color extraction and manipulation
 */
export class ColorUtils {
  private static instance: ColorUtils;

  // Cache for color extraction results
  // Key: image URL or data URL
  // Value: extracted dominant color
  private colorCache: Map<string, string> = new Map();

  // Default options
  private readonly DEFAULT_SAMPLE_SIZE = 64;
  private readonly DEFAULT_MIN_SATURATION = 30;
  private readonly DEFAULT_TARGET_SATURATION = 60;

  private constructor() {}

  public static getInstance(): ColorUtils {
    if (!ColorUtils.instance) {
      ColorUtils.instance = new ColorUtils();
    }
    return ColorUtils.instance;
  }

  /**
   * Extract dominant color from avatar image
   * Returns CSS color string (e.g., "rgb(255, 100, 50)")
   *
   * @param imageSource - Image URL, data URL, or HTMLImageElement
   * @param options - Color extraction options
   * @returns Promise<string> - CSS color string
   */
  public async getDominantColor(
    imageSource: string | HTMLImageElement,
    options: ColorExtractionOptions = {}
  ): Promise<string> {
    const {
      sampleSize = this.DEFAULT_SAMPLE_SIZE,
      minSaturation = this.DEFAULT_MIN_SATURATION,
      skipGrayscale = true
    } = options;

    // Check cache first
    const cacheKey = typeof imageSource === 'string' ? imageSource : imageSource.src;
    if (this.colorCache.has(cacheKey)) {
      return this.colorCache.get(cacheKey)!;
    }

    try {
      // Load image
      const img = typeof imageSource === 'string'
        ? await this.loadImage(imageSource)
        : imageSource;

      // Extract color using Canvas API
      const rgb = await this.extractDominantRGB(img, sampleSize, minSaturation, skipGrayscale);

      // Convert to CSS string
      const colorString = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;

      // Cache result
      this.colorCache.set(cacheKey, colorString);

      return colorString;
    } catch (error) {
      console.error('[ColorUtils] Failed to extract dominant color:', error);
      // Fallback to neutral gray
      return 'rgb(128, 128, 128)';
    }
  }

  /**
   * Extract vibrant (saturated) color from avatar image
   * Boosts saturation for more vivid theme colors
   *
   * @param imageSource - Image URL, data URL, or HTMLImageElement
   * @param options - Color extraction options
   * @returns Promise<string> - CSS color string with boosted saturation
   */
  public async getVibrantColor(
    imageSource: string | HTMLImageElement,
    options: ColorExtractionOptions = {}
  ): Promise<string> {
    const {
      sampleSize = this.DEFAULT_SAMPLE_SIZE,
      minSaturation = this.DEFAULT_MIN_SATURATION,
      targetSaturation = this.DEFAULT_TARGET_SATURATION,
      skipGrayscale = true
    } = options;

    try {
      // Load image
      const img = typeof imageSource === 'string'
        ? await this.loadImage(imageSource)
        : imageSource;

      // Extract dominant color
      const rgb = await this.extractDominantRGB(img, sampleSize, minSaturation, skipGrayscale);

      // Convert to HSL
      const hsl = this.rgbToHsl(rgb);

      // Boost saturation to target value
      hsl.s = Math.max(hsl.s, targetSaturation);

      // Convert back to RGB
      const vibrantRgb = this.hslToRgb(hsl);

      return `rgb(${vibrantRgb.r}, ${vibrantRgb.g}, ${vibrantRgb.b})`;
    } catch (error) {
      console.error('[ColorUtils] Failed to extract vibrant color:', error);
      // Fallback to blue-gray
      return 'rgb(100, 120, 150)';
    }
  }

  /**
   * Load image from URL or data URL
   * Returns promise that resolves to HTMLImageElement
   */
  private loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();

      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load image: ${src}`));

      // Enable CORS for external images
      img.crossOrigin = 'anonymous';
      img.src = src;
    });
  }

  /**
   * Extract dominant RGB color from image using Canvas API
   * Algorithm:
   * 1. Draw image to canvas at sample size
   * 2. Get pixel data from canvas
   * 3. Build color histogram (quantized to reduce noise)
   * 4. Find most frequent color cluster
   * 5. Filter out grayscale/low saturation colors
   */
  private async extractDominantRGB(
    img: HTMLImageElement,
    sampleSize: number,
    minSaturation: number,
    skipGrayscale: boolean
  ): Promise<RGB> {
    // Create canvas at sample size
    const canvas = document.createElement('canvas');
    canvas.width = sampleSize;
    canvas.height = sampleSize;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }

    // Draw image scaled to sample size
    ctx.drawImage(img, 0, 0, sampleSize, sampleSize);

    // Get pixel data
    const imageData = ctx.getImageData(0, 0, sampleSize, sampleSize);
    const pixels = imageData.data;  // RGBA array

    // Build color histogram with quantization
    // Quantize to 32 levels per channel (reduces 256^3 to 32^3 colors)
    const colorMap = new Map<string, number>();

    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];
      const a = pixels[i + 3];

      // Skip fully transparent pixels
      if (a < 128) continue;

      // Quantize color (reduce precision)
      const qr = Math.floor(r / 8) * 8;  // 32 levels (256 / 8)
      const qg = Math.floor(g / 8) * 8;
      const qb = Math.floor(b / 8) * 8;

      // Skip grayscale colors if requested
      if (skipGrayscale) {
        const hsl = this.rgbToHsl({ r: qr, g: qg, b: qb });
        if (hsl.s < minSaturation) continue;
      }

      // Build histogram key
      const key = `${qr},${qg},${qb}`;
      colorMap.set(key, (colorMap.get(key) || 0) + 1);
    }

    // Find most frequent color
    let maxCount = 0;
    let dominantColor: RGB = { r: 128, g: 128, b: 128 };

    for (const [key, count] of colorMap.entries()) {
      if (count > maxCount) {
        maxCount = count;
        const [r, g, b] = key.split(',').map(Number);
        dominantColor = { r, g, b };
      }
    }

    return dominantColor;
  }

  /**
   * Convert RGB to HSL color space
   * Algorithm: https://en.wikipedia.org/wiki/HSL_and_HSV
   */
  public rgbToHsl(rgb: RGB): HSL {
    const r = rgb.r / 255;
    const g = rgb.g / 255;
    const b = rgb.b / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;

    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (delta !== 0) {
      // Calculate saturation
      s = l > 0.5
        ? delta / (2 - max - min)
        : delta / (max + min);

      // Calculate hue
      if (max === r) {
        h = ((g - b) / delta + (g < b ? 6 : 0)) / 6;
      } else if (max === g) {
        h = ((b - r) / delta + 2) / 6;
      } else {
        h = ((r - g) / delta + 4) / 6;
      }
    }

    return {
      h: Math.round(h * 360),
      s: Math.round(s * 100),
      l: Math.round(l * 100)
    };
  }

  /**
   * Convert HSL to RGB color space
   * Algorithm: https://en.wikipedia.org/wiki/HSL_and_HSV
   */
  public hslToRgb(hsl: HSL): RGB {
    const h = hsl.h / 360;
    const s = hsl.s / 100;
    const l = hsl.l / 100;

    let r, g, b;

    if (s === 0) {
      // Achromatic (grayscale)
      r = g = b = l;
    } else {
      const hue2rgb = (p: number, q: number, t: number): number => {
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
   * Adjust saturation of RGB color
   * @param rgb - Input RGB color
   * @param saturationDelta - Amount to adjust saturation (-100 to +100)
   * @returns RGB color with adjusted saturation
   */
  public adjustSaturation(rgb: RGB, saturationDelta: number): RGB {
    const hsl = this.rgbToHsl(rgb);
    hsl.s = Math.max(0, Math.min(100, hsl.s + saturationDelta));
    return this.hslToRgb(hsl);
  }

  /**
   * Adjust lightness of RGB color
   * @param rgb - Input RGB color
   * @param lightnessDelta - Amount to adjust lightness (-100 to +100)
   * @returns RGB color with adjusted lightness
   */
  public adjustLightness(rgb: RGB, lightnessDelta: number): RGB {
    const hsl = this.rgbToHsl(rgb);
    hsl.l = Math.max(0, Math.min(100, hsl.l + lightnessDelta));
    return this.hslToRgb(hsl);
  }

  /**
   * Check if two colors are similar (within threshold)
   * Uses per-component comparison for better UI color matching
   * @param color1 - First RGB color
   * @param color2 - Second RGB color
   * @param threshold - Similarity threshold (0-255, default: 30)
   * @returns True if all RGB components are within threshold
   */
  public areColorsSimilar(color1: RGB, color2: RGB, threshold: number = 30): boolean {
    const dr = Math.abs(color1.r - color2.r);
    const dg = Math.abs(color1.g - color2.g);
    const db = Math.abs(color1.b - color2.b);

    // Per-component comparison (all components must be within threshold)
    return dr <= threshold && dg <= threshold && db <= threshold;
  }

  /**
   * Generate complementary color (opposite on color wheel)
   * @param rgb - Input RGB color
   * @returns RGB complementary color
   */
  public getComplementaryColor(rgb: RGB): RGB {
    const hsl = this.rgbToHsl(rgb);
    hsl.h = (hsl.h + 180) % 360;  // Rotate hue by 180 degrees
    return this.hslToRgb(hsl);
  }

  /**
   * Clear color cache
   */
  public clearCache(): void {
    this.colorCache.clear();
  }

  /**
   * Get cache size (number of cached colors)
   */
  public getCacheSize(): number {
    return this.colorCache.size;
  }
}

/**
 * Factory function to get singleton instance
 */
export function getColorUtils(): ColorUtils {
  return ColorUtils.getInstance();
}

/**
 * Convenience function to extract dominant color
 */
export async function getDominantColorFromAvatar(
  avatarSource: string | HTMLImageElement,
  options?: ColorExtractionOptions
): Promise<string> {
  const colorUtils = getColorUtils();
  return colorUtils.getDominantColor(avatarSource, options);
}

/**
 * Convenience function to extract vibrant color
 */
export async function getVibrantColorFromAvatar(
  avatarSource: string | HTMLImageElement,
  options?: ColorExtractionOptions
): Promise<string> {
  const colorUtils = getColorUtils();
  return colorUtils.getVibrantColor(avatarSource, options);
}
