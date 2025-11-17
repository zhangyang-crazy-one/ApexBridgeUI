# VCPChat UI/UX 设计原则与规范

**文档版本**: 1.0.0
**最后更新**: 2025-11-02
**适用范围**: VCPChat Tauri 2.0+ 桌面应用

---

## 一、设计系统核心理念

### 1.1 统一性原则
- **所有UI组件必须遵循统一的设计规范**
- 基于 `template/pic_resource/templates/styles/common.css` 的设计系统
- 所有emoji图标必须替换为SVG矢量图标
- 支持Light/Dark双主题无缝切换

### 1.2 图标系统规范

#### SVG图标资源位置
```
src/template/pic_resource/icon/
├── Emoji_instead/          # Light模式SVG图标
│   ├── robot.svg          # 机器人/AI助手
│   ├── clip.svg           # 附件
│   ├── clipboard.svg      # 剪贴板
│   ├── code-12.svg        # 代码
│   ├── dashboard-4.svg    # 仪表板
│   ├── database-3.svg     # 数据库
│   ├── file.svg           # 文件
│   └── ...
├── Emoji_instead_darkmod/  # Dark模式SVG图标
│   ├── robot (1).svg
│   ├── code.svg
│   ├── CPU.svg
│   └── ...
└── hdlogo.com-*.svg       # Logo资源
```

#### 图标使用规则
1. **禁止使用emoji** - 所有表情符号必须替换为SVG
2. **双模式适配** - 每个图标提供Light和Dark两个版本
3. **尺寸规范**:
   - 侧边栏图标: 18-20px
   - 标题栏图标: 24px
   - 功能卡片图标: 24-32px
4. **颜色过渡** - 使用 `filter` 和 `transition` 实现平滑主题切换

---

## 二、配色方案

### 2.1 Light模式（默认主题）

```css
:root {
  /* 主色调 - 蓝色系 */
  --primary-color: #2563eb;        /* 主蓝色 */
  --primary-hover: #1d4ed8;        /* 悬停蓝色 */
  --primary-light: #dbeafe;        /* 浅蓝色背景 */

  /* 辅助色 */
  --secondary-color: #64748b;      /* 中性灰蓝 */
  --secondary-light: #e2e8f0;      /* 浅灰蓝 */

  /* 功能色 */
  --success-color: #10b981;        /* 成功绿 */
  --warning-color: #f59e0b;        /* 警告橙 */
  --danger-color: #ef4444;         /* 危险红 */
  --info-color: #3b82f6;           /* 信息蓝 */

  /* 中性色 - 白底主题 */
  --bg-primary: #ffffff;           /* 主背景白 */
  --bg-secondary: #f8fafc;         /* 次背景浅灰 */
  --bg-tertiary: #f1f5f9;          /* 三级背景 */

  /* 文字色 */
  --text-primary: #0f172a;         /* 主文字深黑 */
  --text-secondary: #475569;       /* 次文字中灰 */
  --text-tertiary: #94a3b8;        /* 三级文字浅灰 */

  /* 边框色 */
  --border-color: #e2e8f0;         /* 主边框浅灰 */
  --border-hover: #cbd5e1;         /* 悬停边框 */

  /* SVG图标色 */
  --icon-color: #2c2c2c;           /* Light模式图标深色 */
}
```

### 2.2 Dark模式

```css
[data-theme="dark"] {
  /* 主色调 - 亮蓝色 */
  --primary-color: #3b82f6;        /* 亮蓝色 */
  --primary-hover: #2563eb;        /* 悬停蓝 */
  --primary-light: #1e3a8a;        /* 深蓝背景 */

  /* 辅助色 */
  --secondary-color: #94a3b8;      /* 浅灰蓝 */
  --secondary-light: #334155;      /* 深灰蓝背景 */

  /* 中性色 - 黑底主题 */
  --bg-primary: #0f172a;           /* 主背景深黑 */
  --bg-secondary: #1e293b;         /* 次背景中黑 */
  --bg-tertiary: #334155;          /* 三级背景浅黑 */

  /* 文字色 - 反转 */
  --text-primary: #f1f5f9;         /* 主文字浅白 */
  --text-secondary: #cbd5e1;       /* 次文字中灰 */
  --text-tertiary: #94a3b8;        /* 三级文字深灰 */

  /* 边框色 */
  --border-color: #334155;         /* 主边框深灰 */
  --border-hover: #475569;         /* 悬停边框 */

  /* SVG图标色 */
  --icon-color: #f1f5f9;           /* Dark模式图标亮色 */
}
```

### 2.3 主题切换实现

```javascript
// 主题管理
let currentTheme = 'light';

function toggleTheme() {
  currentTheme = currentTheme === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', currentTheme);
  localStorage.setItem('theme', currentTheme);
}

// 加载保存的主题偏好
const savedTheme = localStorage.getItem('theme') || 'light';
document.documentElement.setAttribute('data-theme', savedTheme);
```

---

## 三、字体系统

### 3.1 字体族

```css
--font-family: -apple-system, BlinkMacSystemFont,
               'Segoe UI', 'Microsoft YaHei',
               Roboto, 'Helvetica Neue', Arial, sans-serif;
```

**中文字体优先级**:
1. 系统默认 (macOS/Windows)
2. Microsoft YaHei (微软雅黑) - Windows
3. PingFang SC - macOS
4. Sans-serif 回退

### 3.2 字号规范

```css
--font-size-xs: 0.75rem;    /* 12px - 提示文本 */
--font-size-sm: 0.875rem;   /* 14px - 次要文本 */
--font-size-base: 1rem;     /* 16px - 正文 */
--font-size-lg: 1.125rem;   /* 18px - 小标题 */
--font-size-xl: 1.25rem;    /* 20px - 大标题 */
--font-size-2xl: 1.5rem;    /* 24px - 主标题 */
--font-size-3xl: 2rem;      /* 32px - 特大标题 */
```

### 3.3 行高与字重

```css
line-height: 1.5;           /* 正文行高 */
line-height: 1.2;           /* 标题行高 */

font-weight: 400;           /* 常规 */
font-weight: 500;           /* 中等 */
font-weight: 600;           /* 半粗 */
font-weight: 700;           /* 粗体 */
```

---

## 四、间距系统

### 4.1 间距变量

```css
--spacing-xs: 0.25rem;      /* 4px - 极小间距 */
--spacing-sm: 0.5rem;       /* 8px - 小间距 */
--spacing-md: 1rem;         /* 16px - 中等间距 */
--spacing-lg: 1.5rem;       /* 24px - 大间距 */
--spacing-xl: 2rem;         /* 32px - 特大间距 */
--spacing-2xl: 3rem;        /* 48px - 超大间距 */
```

### 4.2 间距使用规则

- **组件内部**: `padding: var(--spacing-md);`
- **组件之间**: `gap: var(--spacing-sm);`
- **页面边距**: `padding: var(--spacing-xl);`
- **列表项间距**: `margin-bottom: var(--spacing-xs);`

---

## 五、圆角与阴影

### 5.1 圆角规范

```css
--radius-sm: 0.25rem;       /* 4px - 小圆角(badge) */
--radius-md: 0.375rem;      /* 6px - 中圆角(button) */
--radius-lg: 0.5rem;        /* 8px - 大圆角(card) */
--radius-xl: 0.75rem;       /* 12px - 特大圆角(modal) */
```

### 5.2 阴影层级

```css
--shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);     /* 轻微悬浮 */
--shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);   /* 明显悬浮 */
--shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1); /* 强烈悬浮 */
```

**Dark模式阴影**: 不透明度提升至 0.3-0.5

---

## 六、过渡动画

### 6.1 过渡时长

```css
--transition-fast: 150ms ease-in-out;   /* 快速反馈 */
--transition-base: 200ms ease-in-out;   /* 标准过渡 */
--transition-slow: 300ms ease-in-out;   /* 缓慢过渡 */
```

### 6.2 应用场景

```css
/* 颜色过渡 - 主题切换 */
transition: background-color var(--transition-base),
            color var(--transition-base);

/* 尺寸过渡 - 侧边栏展开 */
transition: width var(--transition-base);

/* 悬停效果 - 按钮交互 */
transition: all var(--transition-fast);
```

---

## 七、组件设计规范

### 7.1 标题栏 (Titlebar)

```css
.titlebar {
  height: 40px;
  background: var(--bg-primary);
  border-bottom: 1px solid var(--border-color);
  display: flex;
  padding: 0 16px;
}

.titlebar-icon {
  width: 24px;
  height: 24px;
  /* SVG图标，支持主题切换 */
  filter: brightness(0) saturate(100%);  /* Light模式黑色 */
}

[data-theme="dark"] .titlebar-icon {
  filter: brightness(0) saturate(100%) invert(1);  /* Dark模式白色 */
}
```

### 7.2 侧边栏 (Sidebar)

```css
.sidebar {
  width: 280px;
  background: var(--bg-primary);
  border-right: 1px solid var(--border-color);
}

.sidebar-item {
  padding: 8px 16px;
  border-radius: var(--radius-md);
  transition: background-color var(--transition-fast);
}

.sidebar-item:hover {
  background: var(--bg-tertiary);
}

.sidebar-item.active {
  background: var(--primary-light);
  color: var(--primary-color);
}
```

### 7.3 按钮 (Button)

```css
.btn {
  padding: 8px 24px;
  border-radius: var(--radius-md);
  font-weight: 500;
  transition: all var(--transition-fast);
}

.btn-primary {
  background: var(--primary-color);
  color: white;
}

.btn-primary:hover {
  background: var(--primary-hover);
}
```

### 7.4 卡片 (Card)

```css
.card {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  padding: var(--spacing-lg);
}

.card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}
```

---

## 八、SVG图标集成指南

### 8.1 图标命名规范

**Light模式图标** (`Emoji_instead/`):
- 小写+连字符: `robot.svg`, `code-12.svg`
- 描述性命名: `clipboard.svg`, `dashboard-4.svg`

**Dark模式图标** (`Emoji_instead_darkmod/`):
- 对应Light图标: `robot (1).svg` → `robot.svg`
- 保持一致性: 功能相同，仅颜色不同

### 8.2 SVG嵌入方式

#### 方式1: 内联SVG（推荐）
```html
<div class="sidebar-item-icon">
  <svg viewBox="0 0 1280 1024" xmlns="http://www.w3.org/2000/svg">
    <path d="M640 0c35.4 0 64 28.6..." fill="var(--icon-color)"/>
  </svg>
</div>
```

**优点**:
- 支持CSS变量控制颜色
- 平滑主题切换
- 无额外HTTP请求

#### 方式2: 图片引用
```html
<img src="/icon/Emoji_instead/robot.svg"
     class="icon-svg"
     alt="机器人">
```

```css
.icon-svg {
  filter: brightness(0) saturate(100%);  /* Light模式 */
}

[data-theme="dark"] .icon-svg {
  filter: brightness(0) saturate(100%) invert(1);  /* Dark模式 */
}
```

### 8.3 图标颜色控制

```css
/* SVG内部颜色变量 */
svg path {
  fill: var(--icon-color);
  transition: fill var(--transition-base);
}

/* 或使用filter过滤器 */
.icon {
  filter: brightness(0) saturate(100%);  /* 黑色 */
}

[data-theme="dark"] .icon {
  filter: invert(1);  /* 白色 */
}
```

---

## 九、响应式设计

### 9.1 断点规范

```css
/* 移动设备 */
@media (max-width: 768px) {
  .sidebar {
    position: absolute;
    z-index: 100;
    box-shadow: var(--shadow-lg);
  }

  .resize-handle {
    display: none;
  }
}

/* 平板设备 */
@media (min-width: 769px) and (max-width: 1024px) {
  --sidebar-width: 240px;
}

/* 桌面设备 */
@media (min-width: 1025px) {
  --sidebar-width: 280px;
}
```

---

## 十、实施检查清单

### 10.1 设计一致性检查

- [ ] 所有emoji已替换为SVG图标
- [ ] Light/Dark主题切换无视觉跳变
- [ ] 所有组件使用统一CSS变量
- [ ] 所有颜色来自设计系统变量
- [ ] 所有间距使用spacing变量
- [ ] 所有圆角使用radius变量
- [ ] 所有过渡使用transition变量

### 10.2 性能检查

- [ ] SVG内联避免外部请求
- [ ] 主题切换使用CSS变量（避免JS重绘）
- [ ] 过渡动画启用GPU加速
- [ ] 图标尺寸优化（避免过大SVG）

### 10.3 可访问性检查

- [ ] SVG提供`aria-label`描述
- [ ] 颜色对比度符合WCAG 2.1 AA标准
- [ ] 主题切换按钮可键盘访问
- [ ] 焦点状态清晰可见

---

## 十一、主题切换最佳实践

### 11.1 初始化主题

```javascript
// 优先级: localStorage > 系统偏好 > 默认Light
function initTheme() {
  const savedTheme = localStorage.getItem('theme');
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const initialTheme = savedTheme || (systemDark ? 'dark' : 'light');

  document.documentElement.setAttribute('data-theme', initialTheme);
  return initialTheme;
}
```

### 11.2 主题切换按钮

```html
<button class="theme-toggle" onclick="toggleTheme()" aria-label="切换主题">
  <span id="theme-icon">☀️</span>
</button>
```

```javascript
function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';

  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);

  // 更新图标
  document.getElementById('theme-icon').textContent =
    newTheme === 'light' ? '☀️' : '🌙';
}
```

---

## 十二、禁止事项

### ❌ 严格禁止

1. **禁止使用emoji替代图标**
   - ❌ `<span>🤖</span>`
   - ✅ `<svg><path.../></svg>`

2. **禁止硬编码颜色值**
   - ❌ `color: #2563eb;`
   - ✅ `color: var(--primary-color);`

3. **禁止硬编码间距值**
   - ❌ `padding: 16px;`
   - ✅ `padding: var(--spacing-md);`

4. **禁止绕过主题系统**
   - ❌ 使用内联style覆盖主题色
   - ✅ 使用CSS类和主题变量

5. **禁止混用图标格式**
   - ❌ 部分用emoji，部分用SVG
   - ✅ 统一使用SVG矢量图标

---

## 十三、文档维护

**文档位置**: `VCP-CHAT-Rebuild/docs/ui-design-principles.md`

**更新频率**: 每次重大UI变更时更新

**审核责任人**: 前端开发负责人

**最后审核日期**: 2025-11-02

---

**附录A: 参考资源**

- Template CSS: `src/template/pic_resource/templates/styles/common.css`
- SVG图标库: `src/template/pic_resource/icon/`
- UI预览: `preview-unified.html`
- 设计系统示例: `src/template/pic_resource/templates/index.html`

**附录B: 相关规范文档**

- WCAG 2.1 可访问性标准
- Material Design Color System
- Tauri 2.0 Window API Guidelines
