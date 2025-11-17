# ApexBridge UI - AI Collaboration Platform

<div align="center">

![ApexBridge Logo](public/favicon.svg)

**连接智能巅峰的尖端融合平台 | Apex Integration Design System**

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Tauri](https://img.shields.io/badge/Tauri-2.0-24C8DB?logo=tauri)](https://tauri.app/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5.0-646CFF?logo=vite)](https://vitejs.dev/)

[English](#english) | [中文](#chinese)

</div>

---

## <a name="chinese"></a>🌟 项目简介

ApexBridge UI 是一个基于 Tauri 2.0 构建的现代化 AI 协作平台前端界面,采用 **Anthropic 温暖米色设计系统**,通过极端字重对比、丰富微交互和编排动画序列,打造独特而优雅的用户体验。

### ✨ 核心特色

- **🎨 Anthropic 设计语言** - 温暖米色主题 (#FAF9F5, #F0EEE6, #E8E6DD, #141413)
- **🔤 极端字体对比** - Font-weight 100 vs 900,字号 3x-6x 激进跳跃
- **🎭 编排动画序列** - 9阶段模态窗口涌现,错峰 50-80ms 流畅过渡
- **💫 丰富微交互** - 8种按钮类型,每种包含缩放、阴影、波纹、旋转等 3-7 个交互维度
- **🌐 多语言支持** - 中英双语界面,优化中文字体显示 (Noto Sans SC/Serif SC)
- **♿ 无障碍设计** - WCAG AA 标准,对比度 ≥3.5:1,完善焦点指示器
- **⚡ 60fps 性能** - GPU 加速动画,will-change 优化,无重排重绘

---

## 🎯 设计系统

### 色彩体系 (Color System)

| 类型 | 色值 | 用途 |
|------|------|------|
| **主背景** | `#FAF9F5` | 页面主要背景色 |
| **次背景** | `#F0EEE6` | 卡片、模态窗口背景 |
| **三级背景** | `#E8E6DD` | 悬停状态、分隔区域 |
| **边框色** | `#C8C8C8` | 输入框、按钮边框 (WCAG AA) |
| **主文本** | `#141413` | 标题、正文文本 |
| **次文本** | `#666666` | 辅助说明文字 |
| **强调色** | `#141413` | 主按钮、激活状态 |

### 字体系统 (Typography)

```css
/* 标题字体 - 极端字重对比 */
--font-heading: 'Bricolage Grotesque', 'Noto Sans SC', sans-serif;
--font-heading-thin: 100;   /* 超细 - 次要标题 */
--font-heading-black: 900;  /* 超粗 - 主标题 */

/* 正文字体 - 优雅衬线 */
--font-body: 'Crimson Pro', 'Noto Serif SC', Georgia, serif;
--font-body-light: 300;     /* 细体 - 长文本 */
--font-body-bold: 700;      /* 粗体 - 强调 */

/* 代码字体 */
--font-code: 'JetBrains Mono', 'Fira Code', monospace;
```

### 字号级差 (Font Sizes)

激进的 3x-6x 跳跃,避免平庸层级:

| 变量 | 大小 | 跳跃倍数 | 用途 |
|------|------|----------|------|
| `--font-size-xs` | 12px | 基准 | 辅助文本 |
| `--font-size-sm` | 14px | 1.17x | 小标签 |
| `--font-size-base` | 18px | 1.5x | 正文 |
| `--font-size-lg` | 36px | **3x** ⚡ | 二级标题 |
| `--font-size-xl` | 54px | 1.5x | 一级标题 |
| `--font-size-2xl` | 84px | 1.5x | 超大标题 |
| `--font-size-hero` | 108px | **6x** 🚀 | 英雄标题 |

### 间距系统 (Spacing)

严格的 8px 网格系统:

```css
--spacing-xs: 4px;    /* 0.5x */
--spacing-sm: 8px;    /* 1x */
--spacing-md: 16px;   /* 2x */
--spacing-lg: 24px;   /* 3x */
--spacing-xl: 32px;   /* 4x */
--spacing-2xl: 48px;  /* 6x */
--spacing-3xl: 64px;  /* 8x */
```

---

## 🎨 核心美化特性

### 1. 按钮微交互系统

#### 主按钮 (Primary Button)
```css
/* 三层阴影 + 缩放 + 水波纹 */
.btn-primary {
  box-shadow:
    0 1px 2px rgba(10, 10, 9, 0.1),
    0 4px 8px rgba(10, 10, 9, 0.15),
    0 8px 16px rgba(10, 10, 9, 0.2);
}

.btn-primary:hover {
  transform: translateY(-2px) scale(1.02);
}

.btn-primary:active::before {
  /* 水波纹扩散到 300px × 300px */
  width: 300px;
  height: 300px;
}
```

#### 次要按钮 (Secondary Button)
```css
/* 边框扫描动画 + 平移 */
.btn-secondary:hover::before {
  /* 黑色光束从左扫描到右 */
  left: 100%;
}

.btn-secondary:hover {
  transform: translateX(4px);
}
```

#### 图标按钮 (Icon Button)
```css
/* 旋转 + 脉冲 */
.btn-icon:hover {
  transform: rotate(90deg) scale(1.1);
}

.btn-icon:active::after {
  /* 圆形波纹扩散 */
  animation: pulse 0.5s ease-out;
}
```

### 2. 编排动画序列

#### Settings Modal - 9阶段涌现动画

```
Stage 0:  Modal整体淡入 (0ms)
Stage 1:  Header从上滑入 (100ms 延迟)
Stages 2-5: Tabs错峰从下滑入 (200-350ms, 每个间隔 50ms)
Stages 6-8: Content从左滑入 (400-640ms, 每个间隔 80ms)
Stage 9:  Footer从下滑入 (640ms 延迟)

总时长: ~1.2 秒
```

#### Confirmation Dialog - 弹簧式入场

```css
@keyframes springIn {
  0% {
    transform: scale(0.6) rotate(-3deg);
  }
  50% {
    transform: scale(1.05) rotate(1deg);  /* 超调 */
  }
  100% {
    transform: scale(1) rotate(0);
  }
}
```

### 3. 背景纹理系统

#### 主背景 - 噪点纹理 + 双径向渐变
```css
.main-content {
  background:
    /* SVG fractalNoise 噪点纹理 */
    url('data:image/svg+xml,...'),
    /* 左上径向渐变 - 温暖高光 */
    radial-gradient(ellipse at top left, rgba(240, 238, 230, 0.5) 0%, transparent 60%),
    /* 右下径向渐变 - 柔和阴影 */
    radial-gradient(ellipse at bottom right, rgba(232, 230, 221, 0.4) 0%, transparent 60%),
    var(--bg-primary);
}
```

#### 模态窗口 - 几何网格背景
```css
.settings-modal::before {
  background:
    /* 对角线网格 - 45度交叉 */
    linear-gradient(45deg, transparent 48%, rgba(20, 20, 19, 0.02) 49%, ...),
    linear-gradient(-45deg, transparent 48%, rgba(20, 20, 19, 0.02) 49%, ...);
  background-size: 24px 24px;
  opacity: 0.6;
}
```

---

## 🚀 快速开始

### 环境要求

- **Node.js**: 18.0+
- **Rust**: 1.70+ (Tauri 依赖)
- **操作系统**: Windows 10+, macOS 10.15+, Linux

### 安装依赖

```bash
# 1. 克隆仓库
git clone https://github.com/zhangyang-crazy-one/ApexBridgeUI.git
cd ApexBridgeUI

# 2. 安装 npm 依赖
npm install

# 3. 安装 Tauri CLI (如果未安装)
npm install -g @tauri-apps/cli
```

### 开发模式

```bash
# 启动开发服务器 (热重载)
npm run tauri dev
```

应用将在开发模式下启动,任何代码修改都会自动重新加载。

### 构建生产版本

```bash
# 构建 Windows 可执行文件
npm run tauri build

# 构建产物位置
# Windows: src-tauri/target/release/bundle/
# macOS: src-tauri/target/release/bundle/dmg/
# Linux: src-tauri/target/release/bundle/appimage/
```

---

## 📁 项目结构

```
VCP-CHAT-Rebuild/
├── src/
│   ├── components/              # 可复用组件
│   │   ├── AgentEditor.ts       # AI Agent 编辑器
│   │   ├── GroupEditor.ts       # 群组编辑器
│   │   ├── SettingsModal.ts     # 设置模态窗口
│   │   ├── MigrationWizard.ts   # 数据迁移向导
│   │   └── NotificationsPanel.ts # 通知面板
│   │
│   ├── core/                    # 核心功能模块
│   │   ├── managers/            # 管理器
│   │   │   ├── chatManager.ts   # 聊天管理
│   │   │   ├── settingsManager.ts # 设置管理
│   │   │   └── topicManager.ts  # 话题管理
│   │   ├── models/              # 数据模型
│   │   │   ├── agent.ts         # Agent 模型
│   │   │   └── group.ts         # Group 模型
│   │   ├── renderer/            # 渲染系统
│   │   │   ├── messageRenderer.ts # 消息渲染器
│   │   │   ├── contentProcessor.ts # 内容处理器
│   │   │   └── renderers/       # 21种专用渲染器
│   │   │       ├── codeRenderer.ts
│   │   │       ├── markdownRenderer.ts
│   │   │       ├── mermaidRenderer.ts
│   │   │       └── htmlRenderer.ts
│   │   ├── services/            # 服务层
│   │   │   └── apiClient.ts     # API 客户端
│   │   ├── i18n/                # 国际化
│   │   │   └── locales/         # 语言文件
│   │   │       ├── en-US.json
│   │   │       └── zh-CN.json
│   │   └── utils/               # 工具函数
│   │       ├── logger.ts        # 日志系统
│   │       └── pathUtils.ts     # 路径工具
│   │
│   ├── styles/                  # 样式文件
│   │   ├── main.css             # 设计系统变量
│   │   ├── themes.css           # 主题切换
│   │   ├── button-enhancements.css      # 按钮微交互 ✨
│   │   ├── choreographed-animations.css # 编排动画序列 ✨
│   │   ├── dialog-enhancements.css      # 对话框美化 ✨
│   │   ├── settings.css         # 设置界面
│   │   ├── chat.css             # 聊天界面
│   │   ├── code-renderer.css    # 代码渲染器
│   │   ├── mermaid-renderer.css # Mermaid 图表
│   │   └── ...                  # 其他样式文件
│   │
│   ├── utils/                   # 前端工具
│   │   ├── notification-center.ts # 通知中心
│   │   ├── custom-modal.ts      # 自定义模态框
│   │   └── window-controls.ts   # 窗口控制
│   │
│   ├── main.ts                  # 应用入口
│   └── tauri-browser-mock.ts    # Tauri 浏览器模拟
│
├── src-tauri/                   # Tauri 后端
│   ├── src/
│   │   └── lib.rs               # Rust 主逻辑
│   ├── Cargo.toml               # Rust 依赖
│   └── tauri.conf.json          # Tauri 配置
│
├── public/                      # 静态资源
│   ├── icons/                   # 应用图标
│   └── assets/                  # 其他资源
│
├── docs/                        # 文档
│   ├── beautification-summary.md # 美化方案总结
│   ├── renderer-bug-fix-guide.md
│   └── dynamic-model-selection-test-guide.md
│
├── index.html                   # HTML 入口
├── vite.config.ts               # Vite 配置
├── package.json                 # npm 依赖
└── tsconfig.json                # TypeScript 配置
```

---

## 🎯 核心功能

### 1. AI Agent 管理
- 创建和编辑自定义 AI Agent
- 配置 Agent 性格、能力和提示词
- 多 Agent 切换和管理
- Agent 群组协作

### 2. 实时聊天系统
- WebSocket 实时通信
- 流式响应支持
- 多话题管理
- 消息历史持久化

### 3. 21种内容渲染器
- **代码渲染**: 语法高亮、diff 对比
- **Markdown**: 完整的 GFM 支持
- **Mermaid**: 流程图、时序图、类图
- **HTML**: 安全的 HTML 渲染
- **LaTeX**: 数学公式渲染
- **Three.js**: 3D 可视化
- **图表**: CSV、JSON 数据可视化
- **多媒体**: 图片、视频、音频

### 4. 设置系统
- **常规设置**: 语言、主题、用户信息
- **后端设置**: API 配置、模型选择
- **快捷键设置**: 自定义键盘快捷键
- **窗口设置**: 窗口行为、启动选项

### 5. 数据迁移
- 从旧版本迁移数据
- 智能数据兼容性检查
- 备份和恢复功能

---

## 🛠️ 技术栈

### 前端框架
- **TypeScript** - 类型安全的 JavaScript
- **Vite** - 极速前端构建工具
- **原生 Web Components** - 无框架依赖

### 桌面框架
- **Tauri 2.0** - Rust 驱动的跨平台桌面框架
- 更小的打包体积 (vs Electron)
- 更低的内存占用
- 原生系统集成

### 渲染引擎
- **Marked.js** - Markdown 解析
- **Highlight.js** - 代码语法高亮
- **Mermaid** - 图表渲染
- **KaTeX** - LaTeX 数学公式
- **Three.js** - 3D 渲染

### 设计系统
- **CSS Variables** - 动态主题切换
- **Google Fonts** - Bricolage Grotesque, Crimson Pro, Noto Sans SC/Serif SC
- **8px Grid System** - 严格的间距体系

---

## 📊 性能优化

### GPU 加速
```css
/* 所有动画使用 transform 和 opacity */
.animated-element {
  will-change: transform, opacity;
}

/* 动画完成后清理 */
.animated-element.animation-complete {
  will-change: auto;
}
```

### 无障碍支持
- WCAG AA 标准对比度 (≥3.5:1)
- 完整的键盘导航支持
- Screen Reader 友好
- 动画偏好设置 (`prefers-reduced-motion`)

### 构建优化
- Code Splitting
- Tree Shaking
- 资源压缩和优化
- 懒加载模块

---

## 🎨 设计原则

### 避免 "AI 通病美学"

❌ **拒绝平庸设计**:
- ~~Inter/Roboto 字体~~
- ~~紫色渐变~~
- ~~保守的 1.5x 字号跳跃~~
- ~~单调的平面背景~~
- ~~单一的按钮反馈~~

✅ **拥抱独特美学**:
- ✨ Bricolage Grotesque + Crimson Pro 字体组合
- 🎨 Anthropic 温暖米色主题
- 📏 极端字重对比 (100 vs 900)
- 🚀 激进字号跳跃 (3x-6x)
- 🌊 几何纹理背景
- 💫 丰富的 7 维按钮微交互
- 🎭 编排动画序列

---

## 📝 开发指南

### 添加新的渲染器

1. 在 `src/core/renderer/renderers/` 创建新文件:
```typescript
// myRenderer.ts
export class MyRenderer {
  public static canHandle(content: string): boolean {
    // 检测逻辑
    return content.startsWith('###MY_FORMAT###');
  }

  public static async render(content: string): Promise<string> {
    // 渲染逻辑
    return `<div class="my-renderer">${processedContent}</div>`;
  }
}
```

2. 在 `contentProcessor.ts` 注册渲染器:
```typescript
import { MyRenderer } from './renderers/myRenderer';

const renderers = [
  MyRenderer,
  // ... 其他渲染器
];
```

3. 添加样式文件 `src/styles/my-renderer.css`

4. 在 `index.html` 引入样式

### 添加新的设置选项

1. 在 `src/core/managers/settingsManager.ts` 定义接口:
```typescript
export interface AppSettings {
  // ... 现有设置
  myNewSetting: boolean;
}
```

2. 在 `src/components/settings/` 创建对应的设置面板组件

3. 更新 i18n 语言文件

---

## 🤝 贡献指南

欢迎贡献代码、报告问题或提出建议!

### 贡献步骤

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

### 代码规范

- 使用 TypeScript 严格模式
- 遵循 ESLint 配置
- 使用语义化的 commit 信息
- 添加必要的注释和文档

---

## 📄 开源协议

本项目采用 [MIT License](LICENSE) 开源协议。

---

## 🙏 致谢

- [Tauri](https://tauri.app/) - 强大的桌面应用框架
- [Anthropic](https://www.anthropic.com/) - 设计灵感来源
- [Google Fonts](https://fonts.google.com/) - 优质字体资源
- 所有贡献者和使用者

---

## 📮 联系方式

- **GitHub**: [@zhangyang-crazy-one](https://github.com/zhangyang-crazy-one)
- **Issues**: [GitHub Issues](https://github.com/zhangyang-crazy-one/ApexBridgeUI/issues)

---

<div align="center">

**Made with ❤️ by ApexBridge Team**

⭐ 如果这个项目对你有帮助,请给一个 Star!

</div>

---

## <a name="english"></a>🌟 Overview (English)

ApexBridge UI is a modern AI collaboration platform built with **Tauri 2.0**, featuring the **Anthropic warm beige design system**. It achieves a unique and elegant user experience through extreme font-weight contrast, rich micro-interactions, and choreographed animation sequences.

### ✨ Key Features

- **🎨 Anthropic Design Language** - Warm beige theme (#FAF9F5, #F0EEE6, #E8E6DD, #141413)
- **🔤 Extreme Typography Contrast** - Font-weight 100 vs 900, aggressive 3x-6x size jumps
- **🎭 Choreographed Animations** - 9-stage modal emergence, staggered 50-80ms transitions
- **💫 Rich Micro-interactions** - 8 button types, each with 3-7 interaction dimensions
- **🌐 Multi-language Support** - English/Chinese UI, optimized Chinese fonts
- **♿ Accessibility** - WCAG AA compliant, contrast ≥3.5:1, focus indicators
- **⚡ 60fps Performance** - GPU-accelerated animations, will-change optimization

### 🚀 Quick Start

```bash
# Clone repository
git clone https://github.com/zhangyang-crazy-one/ApexBridgeUI.git
cd ApexBridgeUI

# Install dependencies
npm install

# Development mode
npm run tauri dev

# Build production
npm run tauri build
```

### 📚 Documentation

For detailed documentation, please refer to:
- [Beautification Summary](docs/beautification-summary.md)
- [Renderer System](docs/renderer-bug-fix-guide.md)
- [Project Structure](#-项目结构)

### 🛠️ Tech Stack

- **Frontend**: TypeScript, Vite, Native Web Components
- **Desktop**: Tauri 2.0 (Rust-powered)
- **Rendering**: Marked.js, Highlight.js, Mermaid, KaTeX, Three.js
- **Design**: CSS Variables, Google Fonts, 8px Grid System

### 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

<div align="center">

**Built with ❤️ using Tauri 2.0**

</div>
