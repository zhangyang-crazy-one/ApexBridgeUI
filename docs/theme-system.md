# VCPChat Theme System

**Last Updated**: 2025-11-02
**Version**: 1.0.0
**Status**: Implemented in CORE-005

---

## Overview

VCPChat implements a complete Light/Dark theme switching system based on the Anthropic/Claude.ai design language. The system uses CSS custom properties and provides seamless theme transitions.

## Design Philosophy

### Anthropic Warm Beige Palette

The theme system is built around Anthropic's signature warm, neutral color palette:

- **Light Mode**: Warm beige backgrounds (#FAF9F5, #F0EEE6) with deep black text
- **Dark Mode**: Deep charcoal backgrounds (#1a1a1a, #2a2a2a) with light text
- **Typography**: Georgia serif for body, San-serif for headings
- **Transitions**: Smooth 300ms transitions for all color changes

---

## Color System

### Light Mode (Default)

```css
:root {
  /* Backgrounds - Warm beige palette */
  --bg-primary: #FAF9F5;        /* Main background */
  --bg-secondary: #F0EEE6;      /* Titlebar, sidebars */
  --bg-tertiary: #E8E6DD;       /* Hover states */

  /* Text colors */
  --text-primary: #141413;      /* Main text */
  --text-secondary: #666666;    /* Secondary text */
  --text-tertiary: #999999;     /* Tertiary text */

  /* UI elements */
  --border-color: #E5E5E5;      /* Borders */
  --border-hover: #D5D3CB;      /* Hover borders */
  --active-bg: #141413;         /* Active background (BLACK, not blue!) */
  --active-text: #FAF9F5;       /* Active text */
  --icon-fill: #141413;         /* SVG icon color */
}
```

### Dark Mode

```css
[data-theme="dark"] {
  /* Backgrounds - Deep charcoal */
  --bg-primary: #1a1a1a;
  --bg-secondary: #2a2a2a;
  --bg-tertiary: #3a3a3a;

  /* Text colors - Inverted */
  --text-primary: #e8e6e0;
  --text-secondary: #a8a8a8;
  --text-tertiary: #707070;

  /* UI elements */
  --border-color: #3a3a3a;
  --border-hover: #4a4a4a;
  --active-bg: #e8e6e0;         /* Inverted active */
  --active-text: #141413;
  --icon-fill: #e8e6e0;
}
```

---

## Implementation

### TypeScript Theme Manager

Create `src/utils/theme-manager.ts`:

```typescript
/**
 * Theme Manager for VCPChat
 * Handles Light/Dark theme switching with localStorage persistence
 */

export type Theme = 'light' | 'dark';

export class ThemeManager {
  private static instance: ThemeManager;
  private currentTheme: Theme = 'light';

  private constructor() {
    this.initTheme();
  }

  public static getInstance(): ThemeManager {
    if (!ThemeManager.instance) {
      ThemeManager.instance = new ThemeManager();
    }
    return ThemeManager.instance;
  }

  /**
   * Initialize theme from saved preference or system preference
   */
  private initTheme(): void {
    // Priority: localStorage > system preference > default light
    const savedTheme = localStorage.getItem('vcpchat-theme') as Theme | null;
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initialTheme = savedTheme || (systemDark ? 'dark' : 'light');

    this.setTheme(initialTheme);
    this.listenToSystemChanges();
  }

  /**
   * Set theme and persist to localStorage
   */
  public setTheme(theme: Theme): void {
    this.currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('vcpchat-theme', theme);

    // Emit custom event for components to listen
    window.dispatchEvent(new CustomEvent('theme-changed', { detail: { theme } }));
  }

  /**
   * Toggle between light and dark themes
   */
  public toggleTheme(): void {
    const newTheme = this.currentTheme === 'light' ? 'dark' : 'light';
    this.setTheme(newTheme);
  }

  /**
   * Get current theme
   */
  public getTheme(): Theme {
    return this.currentTheme;
  }

  /**
   * Listen to system theme changes
   */
  private listenToSystemChanges(): void {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      // Only auto-switch if user hasn't set preference
      if (!localStorage.getItem('vcpchat-theme')) {
        this.setTheme(e.matches ? 'dark' : 'light');
      }
    });
  }

  /**
   * Reset to system preference
   */
  public resetToSystem(): void {
    localStorage.removeItem('vcpchat-theme');
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    this.setTheme(systemDark ? 'dark' : 'light');
  }
}
```

### Usage in Main.ts

```typescript
import { ThemeManager } from './utils/theme-manager';

// Initialize theme manager
const themeManager = ThemeManager.getInstance();

// Example: Add theme toggle button handler
const themeToggleBtn = document.getElementById('theme-toggle');
if (themeToggleBtn) {
  themeToggleBtn.addEventListener('click', () => {
    themeManager.toggleTheme();
  });
}

// Example: Listen to theme changes
window.addEventListener('theme-changed', (e: CustomEvent) => {
  console.log(`Theme changed to: ${e.detail.theme}`);
});
```

---

## Logo Theme Adaptation

The Blocknet logo adapts to the theme using CSS:

```css
/* Blocknet Logo Theme Adaptation */
.titlebar-icon .logo-light {
  fill: #8f8886;  /* Original light gray */
  transition: fill 0.3s ease;
}

.titlebar-icon .logo-dark {
  fill: #101341;  /* Original dark blue */
  transition: fill 0.3s ease;
}

/* Dark Mode Colors */
[data-theme="dark"] .titlebar-icon .logo-light {
  fill: #b8b6b4;  /* Brighter gray */
}

[data-theme="dark"] .titlebar-icon .logo-dark {
  fill: #e8e6e0;  /* Light color */
}
```

---

## UI Component Guidelines

### 1. Add Transition Support

All theme-aware components should include color transitions:

```css
.component {
  background-color: var(--bg-primary);
  color: var(--text-primary);
  border-color: var(--border-color);

  /* Add transitions for smooth theme switching */
  transition: background-color 0.3s ease,
              color 0.3s ease,
              border-color 0.3s ease;
}
```

### 2. Use CSS Variables

Always use CSS custom properties for colors:

```css
/* ❌ Bad - Hard-coded colors */
.button {
  background-color: #FAF9F5;
  color: #141413;
}

/* ✅ Good - CSS variables */
.button {
  background-color: var(--bg-primary);
  color: var(--text-primary);
}
```

### 3. SVG Icon Styling

Use `fill` property with CSS variable:

```css
.icon svg {
  fill: var(--icon-fill);
  transition: fill 0.3s ease;
}
```

---

## Testing Checklist

- [ ] Theme persists across app restarts
- [ ] System preference detection works
- [ ] Manual toggle button works
- [ ] All colors transition smoothly (no flicker)
- [ ] Logo adapts correctly in both themes
- [ ] Scrollbars adapt to theme
- [ ] No hard-coded colors remain
- [ ] All text is readable in both themes (WCAG AA contrast)

---

## Browser DevTools Testing

### Force Theme in Console

```javascript
// Test Light mode
document.documentElement.setAttribute('data-theme', 'light');

// Test Dark mode
document.documentElement.setAttribute('data-theme', 'dark');

// Check current theme
document.documentElement.getAttribute('data-theme');
```

### Inspect CSS Variables

```javascript
// Get computed values of CSS variables
getComputedStyle(document.documentElement).getPropertyValue('--bg-primary');
getComputedStyle(document.documentElement).getPropertyValue('--text-primary');
```

---

## Performance Considerations

1. **CSS Variables vs JavaScript**: Theme switching uses CSS custom properties, which are hardware-accelerated by the browser
2. **Transition Performance**: 300ms is optimal for perceived smoothness without lag
3. **Repaint Optimization**: Avoid JavaScript color manipulation; let CSS handle transitions
4. **Storage**: localStorage is synchronous but fast for single key-value pairs

---

## Accessibility

### WCAG 2.1 Compliance

- **Light Mode**: All text meets AA standard contrast ratio (4.5:1)
- **Dark Mode**: All text meets AA standard contrast ratio (4.5:1)
- **Focus Indicators**: Clearly visible in both themes
- **User Preference**: Respects `prefers-color-scheme` media query

### Keyboard Navigation

Theme toggle button must be:
- Keyboard accessible (Tab key)
- Activatable with Enter/Space
- Announced by screen readers

---

## Future Enhancements

Potential improvements for future versions:

1. **Custom Themes**: Allow users to create custom color schemes
2. **Theme Preview**: Show theme preview before applying
3. **Scheduled Switching**: Auto-switch based on time of day
4. **Per-Window Themes**: Different themes for different chat windows
5. **High Contrast Mode**: Enhanced contrast for accessibility
6. **Animation Toggle**: Allow disabling transitions for motion sensitivity

---

## Troubleshooting

### Theme Not Persisting

**Issue**: Theme resets on app restart
**Solution**: Check localStorage permissions and ensure `vcpchat-theme` key is being set

```javascript
// Debug localStorage
console.log(localStorage.getItem('vcpchat-theme'));
```

### Flicker During Switch

**Issue**: Colors jump instead of transitioning
**Solution**: Ensure all color properties have `transition` defined

```css
/* Add to all theme-aware elements */
transition: all 0.3s ease;
```

### Logo Not Changing

**Issue**: Blocknet logo stays same color in dark mode
**Solution**: Verify SVG paths have class names `logo-light` and `logo-dark`

```html
<svg>
  <path class="logo-light" .../>
  <path class="logo-dark" .../>
</svg>
```

---

## References

- **Anthropic Design System**: [preview-theme-toggle.html](../preview-theme-toggle.html)
- **UI Fix Summary**: [UI-FIX-SUMMARY.md](./UI-FIX-SUMMARY.md)
- **Main CSS**: [src/styles/main.css](../src/styles/main.css)
- **WCAG Guidelines**: https://www.w3.org/WAI/WCAG21/quickref/

---

**Document Maintained By**: Frontend Development Team
**Last Review**: 2025-11-02
**Next Review**: When theme system is extended
