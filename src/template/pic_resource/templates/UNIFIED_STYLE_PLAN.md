# 统一样式和布局改造计划

**实施日期**: 2025-11-01  
**状态**: 进行中

---

## 📋 资源扫描结果

### 可用SVG图标（frontend/icon/Emoji_instead/）
- ✅ `candy-16.svg`
- ✅ `check-mark-6.svg`
- ✅ `clip.svg`
- ✅ `clipboard.svg`
- ✅ `code-12.svg`
- ✅ `code-fork-3.svg` - 数据血缘
- ✅ `cpu-6.svg`
- ✅ `dashboard-4.svg`
- ✅ `data.svg` - 数据建模
- ✅ `database-3.svg` - 元数据管理
- ✅ `file.svg`
- ✅ `ic_enterprice.svg` - 企业架构
- ✅ `key.svg`
- ✅ `pen-14.svg`
- ✅ `pen-7.svg`
- ✅ `refresh.svg` - 数据流矩阵
- ✅ `robot.svg` - AI助手

### 可用图片资源（frontend/pic_resource/）
- ✅ `AI.png` - AI助手
- ✅ `DATA.png` - 数据建模
- ✅ `Data_flow.png` - 数据流矩阵
- ✅ `Enter price.png` - 元数据管理
- ✅ `architecture.png` - 企业架构
- ✅ `linear.png` - 数据血缘

### Emoji使用情况

**index.html**:
- 🔗 (第659行) - 数据血缘 → `code-fork-3.svg`
- 📊 (第670行) - 数据流矩阵 → `refresh.svg`
- 🏢 (第681行) - 企业架构 → `ic_enterprice.svg`

**其他页面**: 待扫描

---

## 🎯 标准导航栏模板

### HTML结构
```html
<header class="header">
  <div class="header-container">
    <a href="index.html" class="logo-container">
      <img src="../../icon/hdlogo.com-measurable-data-token-mdt.svg" alt="DAMA Logo" class="logo-icon">
      <span class="logo-text">DAMA Platform</span>
    </a>

    <nav class="header-nav">
      <a href="index.html" class="nav-link [ACTIVE_IF_INDEX]">
        <img src="../../icon/Emoji_instead/dashboard-4.svg" alt="首页" class="nav-icon">
        <span>首页</span>
      </a>
      <a href="modeling.html" class="nav-link [ACTIVE_IF_MODELING]">
        <img src="../../icon/Emoji_instead/data.svg" alt="数据建模" class="nav-icon">
        <span>数据建模</span>
      </a>
      <a href="metadata.html" class="nav-link [ACTIVE_IF_METADATA]">
        <img src="../../icon/Emoji_instead/database-3.svg" alt="元数据管理" class="nav-icon">
        <span>元数据管理</span>
      </a>
      <a href="lineage.html" class="nav-link [ACTIVE_IF_LINEAGE]">
        <img src="../../icon/Emoji_instead/code-fork-3.svg" alt="数据血缘" class="nav-icon">
        <span>数据血缘</span>
      </a>
      <a href="data-flow-matrix.html" class="nav-link [ACTIVE_IF_DATAFLOW]">
        <img src="../../icon/Emoji_instead/refresh.svg" alt="数据流矩阵" class="nav-icon">
        <span>数据流矩阵</span>
      </a>
      <a href="enterprise-data-architecture.html" class="nav-link [ACTIVE_IF_ARCHITECTURE]">
        <img src="../../icon/Emoji_instead/ic_enterprice.svg" alt="企业架构" class="nav-icon">
        <span>企业架构</span>
      </a>
      <a href="ai-assistant.html" class="nav-link [ACTIVE_IF_AI]">
        <img src="../../icon/Emoji_instead/robot.svg" alt="AI助手" class="nav-icon">
        <span>AI助手</span>
      </a>
    </nav>

    <div class="header-actions">
      <!-- 页面特定按钮 -->
    </div>
  </div>
</header>
```

### CSS样式（从enterprise-data-architecture.html提取）
```css
/* Header / Navigation */
.header {
  background-color: var(--bg-secondary);
  padding: var(--spacing-sm) var(--spacing-lg);
  position: sticky;
  top: 0;
  z-index: 100;
  border-bottom: 1px solid var(--border-color);
}

.header-container {
  max-width: 1800px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--spacing-lg);
}

.logo-container {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  text-decoration: none;
  color: var(--text-primary);
  flex-shrink: 0;
}

.logo-icon {
  width: 32px;
  height: 32px;
  filter: grayscale(100%) brightness(0);
}

.logo-text {
  font-family: var(--font-heading);
  font-size: var(--font-size-xl);
  font-weight: 500;
  letter-spacing: -0.5px;
}

.header-nav {
  display: flex;
  gap: var(--spacing-xs);
  flex: 1;
  justify-content: center;
}

.nav-link {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-xs) var(--spacing-sm);
  font-family: var(--font-heading);
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  text-decoration: none;
  border-radius: var(--radius-sm);
  transition: all 0.2s;
  white-space: nowrap;
}

.nav-link:hover {
  background-color: var(--bg-tertiary);
  color: var(--text-primary);
}

.nav-link.active {
  background-color: var(--button-bg);
  color: var(--button-text);
  font-weight: 500;
}

.nav-icon {
  width: 18px;
  height: 18px;
  opacity: 0.7;
}

.nav-link.active .nav-icon {
  opacity: 1;
  filter: brightness(0) invert(1);
}

.header-actions {
  display: flex;
  gap: var(--spacing-sm);
  align-items: center;
  flex-shrink: 0;
}

.btn-header {
  padding: var(--spacing-xs) var(--spacing-md);
  font-family: var(--font-heading);
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--text-primary);
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.btn-header:hover {
  background-color: var(--bg-tertiary);
}

.btn-header.btn-primary {
  background-color: var(--button-bg);
  color: var(--button-text);
  border-color: var(--button-bg);
}

.btn-header.btn-primary:hover {
  opacity: 0.85;
}
```

---

## 📝 实施清单

### 阶段1：统一导航栏（6个页面）

| 页面 | 当前导航 | 需要修改 | 高亮导航项 | 状态 |
|------|---------|---------|-----------|------|
| index.html | 简单header | ✅ 是 | 首页 | ⏳ 待处理 |
| lineage.html | 未知 | ✅ 是 | 数据血缘 | ⏳ 待处理 |
| metadata.html | 未知 | ✅ 是 | 元数据管理 | ⏳ 待处理 |
| modeling.html | 未知 | ✅ 是 | 数据建模 | ⏳ 待处理 |
| ai-assistant.html | 未知 | ✅ 是 | AI助手 | ⏳ 待处理 |
| data-flow-matrix.html | 未知 | ✅ 是 | 数据流矩阵 | ⏳ 待处理 |

### 阶段2：替换Emoji为SVG（7个页面）

| 页面 | Emoji数量 | 映射关系 | 状态 |
|------|----------|---------|------|
| index.html | 3 | 🔗→code-fork-3.svg, 📊→refresh.svg, 🏢→ic_enterprice.svg | ⏳ 待处理 |
| lineage.html | 待扫描 | - | ⏳ 待处理 |
| metadata.html | 待扫描 | - | ⏳ 待处理 |
| modeling.html | 待扫描 | - | ⏳ 待处理 |
| ai-assistant.html | 待扫描 | - | ⏳ 待处理 |
| data-flow-matrix.html | 待扫描 | - | ⏳ 待处理 |
| enterprise-data-architecture.html | 0 | 已使用SVG | ✅ 完成 |

### 阶段3：重新设计首页

**功能模块卡片**：
1. 数据建模 - `DATA.png`
2. 元数据管理 - `Enter price.png`
3. 数据血缘 - `linear.png`
4. 数据流矩阵 - `Data_flow.png`
5. 企业架构 - `architecture.png`
6. AI助手 - `AI.png`

**布局设计**：
- 2×3网格布局（桌面）
- 1列布局（移动端）
- 每个卡片包含：图片、标题、描述、跳转链接

---

## 🎨 设计规范

### 颜色系统
- `--bg-primary: #FAF9F5` - 主背景
- `--bg-secondary: #F0EEE6` - 次背景（header）
- `--bg-tertiary: #E8E6DD` - 三级背景（hover）
- `--text-primary: #141413` - 主文字
- `--text-secondary: #666666` - 次文字
- `--border-color: #E5E5E5` - 边框
- `--button-bg: #141413` - 按钮背景
- `--button-text: #FAF9F5` - 按钮文字

### 字体系统
- `--font-heading`: Sans-serif（标题、UI）
- `--font-body`: Serif（正文）

### 间距系统
- `--spacing-xs: 8px`
- `--spacing-sm: 12px`
- `--spacing-md: 20px`
- `--spacing-lg: 32px`
- `--spacing-xl: 48px`

---

**下一步**: 开始实施阶段1 - 统一导航栏

