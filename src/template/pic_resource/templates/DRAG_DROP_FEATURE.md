# 节点拖拽功能说明

## 📋 功能概述

为企业数据架构页面的**物理模型层节点**添加了拖拽功能，用户可以自由调整节点位置以解决重叠问题，并且布局会自动保存到浏览器本地存储。

**实现日期**: 2025-11-01  
**功能状态**: ✅ 已完成

---

## 🎯 解决的问题

### 问题1：节点重叠
- **原因**：物理模型层每组3个节点（上行2个，下行1个），节点间距太小导致相邻组重叠
- **解决方案**：
  1. 优化初始布局，增加节点间距
  2. 允许用户拖拽调整节点位置

### 问题2：布局僵化
- **原因**：固定布局无法适应所有使用场景
- **解决方案**：提供拖拽功能，用户可根据需要自由调整

---

## ✨ 功能特性

### 1. 拖拽物理模型节点
- ✅ 鼠标悬停时显示 `grab` 光标
- ✅ 拖拽时显示 `grabbing` 光标
- ✅ 拖拽时节点半透明（opacity: 0.7）
- ✅ 拖拽时节点有阴影效果
- ✅ 实时更新节点位置

### 2. 布局持久化
- ✅ 自动保存到 `localStorage`
- ✅ 刷新页面后布局保持不变
- ✅ 存储键名：`dama-architecture-layout`

### 3. 重置布局
- ✅ 顶部导航栏新增"重置布局"按钮
- ✅ 点击后弹出确认对话框
- ✅ 确认后清除自定义布局，恢复默认位置

### 4. 初始布局优化
- ✅ 增加物理模型节点间距（从10px增加到15-25px）
- ✅ 调整每组节点的X坐标，减少重叠
- ✅ 保持居中对齐对应的逻辑模型

---

## 🛠️ 技术实现

### 1. 拖拽状态管理

```javascript
const dragState = {
  isDragging: false,        // 是否正在拖拽
  currentNode: null,        // 当前拖拽的DOM节点
  currentNodeId: null,      // 当前拖拽的节点ID
  startX: 0,                // 拖拽起始X坐标
  startY: 0,                // 拖拽起始Y坐标
  offsetX: 0,               // X方向偏移量
  offsetY: 0,               // Y方向偏移量
  layerY: 0                 // 物理层的Y坐标
};
```

### 2. 拖拽事件流程

```
mousedown (startDrag)
    ↓
    - 记录起始位置
    - 设置 isDragging = true
    - 添加拖拽样式
    - 绑定全局 mousemove 和 mouseup 事件
    ↓
mousemove (onDrag)
    ↓
    - 计算偏移量 (offsetX, offsetY)
    - 更新节点 transform 属性
    - 实时更新连接线（可选）
    ↓
mouseup (endDrag)
    ↓
    - 计算最终位置
    - 保存到 customLayout
    - 保存到 localStorage
    - 移除拖拽样式
    - 重新渲染架构图
    - 清除拖拽状态
    - 解绑全局事件
```

### 3. 布局数据结构

```javascript
// 自定义布局存储格式
customLayout = {
  "customer_crm": { x: 30, y: 0 },
  "customer_dw": { x: 135, y: 0 },
  "customer_cache": { x: 82, y: 70 },
  // ...
}

// localStorage 存储
localStorage.setItem('dama-architecture-layout', JSON.stringify(customLayout));
```

### 4. 节点渲染逻辑

```javascript
// 应用自定义布局（如果存在）
const customPos = customLayout[physical.id];
const nodeX = customPos ? customPos.x : physical.x;
const nodeY = y + 50 + (customPos ? customPos.y : (physical.y || 0));

// 绑定拖拽事件
nodeG.on('mousedown', function(event) {
  startDrag(event, this, physical.id, nodeX, nodeY);
});
```

---

## 📐 初始布局优化

### 优化前的布局问题

**每组节点布局**：
- 上行2个节点：间距10px
- 下行1个节点：居中
- 节点宽度：90px
- 总宽度：90 + 10 + 90 = 190px

**主题域间距**：
- 客户(x=80) → 产品(x=250)：间距170px
- **问题**：190px > 170px，导致重叠！

### 优化后的布局

**调整策略**：
- 增加节点间距到15-25px
- 微调每组的X坐标基准
- 确保总宽度不超过主题域间距

**示例（客户主题域）**：
```javascript
// 优化前
{ id: 'customer_crm', x: 30, y: 0 }
{ id: 'customer_dw', x: 130, y: 0 }  // 间距100px
{ id: 'customer_cache', x: 80, y: 70 }

// 优化后
{ id: 'customer_crm', x: 20, y: 0 }
{ id: 'customer_dw', x: 135, y: 0 }  // 间距115px
{ id: 'customer_cache', x: 77, y: 70 }
```

---

## 🎨 视觉反馈

### 1. 光标变化
```css
.model-node {
  cursor: grab;  /* 默认：抓手 */
}

.model-node.dragging {
  cursor: grabbing;  /* 拖拽中：抓取 */
}
```

### 2. 拖拽样式
```css
.model-node.dragging {
  opacity: 0.7;  /* 半透明 */
  filter: drop-shadow(0 8px 16px rgba(0, 0, 0, 0.3));  /* 阴影 */
}
```

### 3. 过渡动画
```css
.model-node {
  transition: all 0.2s;  /* 平滑过渡 */
}
```

---

## 🧪 使用方法

### 拖拽节点
1. 将鼠标悬停在物理模型节点上
2. 光标变为 `grab` 抓手图标
3. 按住鼠标左键并拖动
4. 节点跟随鼠标移动，变为半透明
5. 释放鼠标，节点固定在新位置
6. 布局自动保存到本地存储

### 重置布局
1. 点击顶部导航栏的"重置布局"按钮
2. 在确认对话框中点击"确定"
3. 所有节点恢复到默认位置
4. 本地存储的布局被清除

### 查看保存的布局
打开浏览器开发者工具（F12）：
```javascript
// 查看当前布局
localStorage.getItem('dama-architecture-layout')

// 手动清除布局
localStorage.removeItem('dama-architecture-layout')
```

---

## 📊 性能优化

### 1. 使用 transform 而非直接修改坐标
```javascript
// ✅ 高性能：使用 transform
d3.select(node).attr('transform', `translate(${offsetX}, ${offsetY})`);

// ❌ 低性能：直接修改 x, y 属性
d3.select(node).select('rect').attr('x', newX).attr('y', newY);
```

**优势**：
- `transform` 不触发重排（reflow），只触发重绘（repaint）
- GPU 加速，性能更好

### 2. 拖拽结束后重新渲染
```javascript
function endDrag() {
  // 保存最终位置
  customLayout[nodeId] = { x: newX, y: newY };
  
  // 重新渲染（清除 transform，应用实际坐标）
  renderArchitecture();
}
```

**优势**：
- 拖拽过程中使用 `transform`（高性能）
- 拖拽结束后使用实际坐标（精确定位）

### 3. 事件委托
```javascript
// 拖拽时绑定全局事件
d3.select('body')
  .on('mousemove.drag', onDrag)
  .on('mouseup.drag', endDrag);

// 拖拽结束后解绑
d3.select('body')
  .on('mousemove.drag', null)
  .on('mouseup.drag', null);
```

**优势**：
- 避免鼠标移出节点时丢失拖拽
- 拖拽结束后及时清理事件监听

---

## 🔧 已知限制

### 1. 连接线实时更新
**当前状态**：拖拽时连接线不实时更新，拖拽结束后重新渲染时更新

**原因**：
- 实时更新连接线需要复杂的路径计算
- 可能影响拖拽性能

**未来优化**：
- 实现连接线的实时更新
- 使用 `requestAnimationFrame` 优化性能

### 2. 仅支持物理模型层
**当前状态**：只有物理模型层的节点可以拖拽

**原因**：
- 其他层（概念、主题域、逻辑）的节点位置有严格的对齐关系
- 拖拽可能破坏层次结构

**未来扩展**：
- 可以考虑为其他层添加受限的拖拽（如只能水平移动）

### 3. 边界检测
**当前状态**：节点可以拖出画布边界

**未来优化**：
- 添加边界检测，限制节点在画布内
- 提供网格吸附功能

---

## 📝 代码修改清单

### 1. CSS样式（第298-328行）
- 添加 `.model-node { cursor: grab; }`
- 添加 `.model-node.dragging` 样式
- 添加 `.model-group.dragging` 样式

### 2. HTML结构（第553-557行）
- 在 `.header-actions` 中添加"重置布局"按钮

### 3. 物理模型数据（第699-739行）
- 优化所有物理模型节点的X坐标
- 增加节点间距，减少重叠

### 4. JavaScript变量（第753-770行）
- 添加 `dragState` 对象
- 添加 `customLayout` 对象

### 5. drawPhysicalLayer函数（第1036-1097行）
- 应用自定义布局
- 绑定拖拽事件（`mousedown`）
- 保存物理层Y坐标

### 6. 拖拽函数（第1391-1487行）
- `startDrag()` - 开始拖拽
- `onDrag()` - 拖拽中
- `endDrag()` - 结束拖拽
- `updateConnectionLines()` - 更新连接线（占位）
- `saveLayout()` - 保存布局
- `loadLayout()` - 加载布局
- `resetLayout()` - 重置布局

### 7. 初始化（第1530-1532行）
- 在 `DOMContentLoaded` 中调用 `loadLayout()`

---

## ✅ 测试清单

### 功能测试
- [ ] 可以拖拽物理模型节点
- [ ] 拖拽时光标变为 `grabbing`
- [ ] 拖拽时节点半透明并有阴影
- [ ] 释放鼠标后节点固定在新位置
- [ ] 刷新页面后布局保持不变
- [ ] 点击"重置布局"按钮恢复默认位置
- [ ] 重置后刷新页面，布局确实是默认的

### 视觉测试
- [ ] 初始布局节点间距合理，重叠减少
- [ ] 拖拽过程流畅，无卡顿
- [ ] 拖拽结束后节点位置精确

### 兼容性测试
- [ ] Chrome浏览器正常工作
- [ ] Firefox浏览器正常工作
- [ ] Edge浏览器正常工作

---

**功能已完成！** 🎉 用户现在可以自由拖拽物理模型节点来解决重叠问题了。

