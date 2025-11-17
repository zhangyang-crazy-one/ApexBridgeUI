# VCPChat Rebuild 测试指南

## 快速验证清单

### ✅ 步骤1: 浏览器快速测试(5分钟)

在浏览器中打开以下文件,验证基础功能:

**文件**: `VCP-CHAT-Rebuild/test-complete-ui.html`

**验证项目**:
- [ ] 页面正确加载,显示Anthropic温暖米色背景
- [ ] 左上角Blocknet logo正确显示
- [ ] 三个tab按钮(助手/话题/设置)可点击
- [ ] 点击tab时,下方内容区域切换
- [ ] 三个agent头像显示(紫色N / 粉色C / 绿色S)
- [ ] 右上角"🌓 Theme"按钮可切换明暗主题
- [ ] 深色模式下,背景变为 `#1a1a1a`,文字变浅色

**预期效果截图**:
- 浅色模式: 温暖米色背景 + 黑色文字
- 深色模式: 深灰背景 + 浅色文字
- Tab激活: 黑色底部边框 + 白色背景

---

### ✅ 步骤2: Tauri应用测试(10分钟)

#### 2.1 清除旧数据
```bash
# 在浏览器开发者工具Console执行
localStorage.clear();
```

#### 2.2 启动应用
```bash
cd VCP-CHAT-Rebuild
npm run dev
```

#### 2.3 检查Console日志

**成功的日志应该包含**:

```
[Demo Data] Initializing demonstration data...
[Demo Data] Creating demo agents...
[Demo Data] Created 3 demo agents
[Demo Data] ✅ Demo data initialization complete

[Bootstrap] Starting VCPChat initialization...
[Bootstrap] Phase 1: Loading settings...
[Bootstrap] ✓ Settings loaded
[Bootstrap] Phase 2: Initializing data managers...
[Bootstrap] ✓ Agent manager initialized
[Bootstrap] ✓ Group manager initialized
[Bootstrap] Phase 3: Initializing API client...
[Bootstrap] ✓ API client initialized
[Bootstrap] ✅ Initialization complete

[UI] Initializing user interface...
[UI] ✅ UI initialized successfully

[SidebarTabManager] Starting initialization...
[SidebarTabManager] Found elements: { buttons: 3, contents: 3 }
[SidebarTabManager] Button 0: { text: "助手", dataTab: "agents", classes: "..." }
[SidebarTabManager] Button 1: { text: "话题", dataTab: "topics", classes: "..." }
[SidebarTabManager] Button 2: { text: "设置", dataTab: "settings", classes: "..." }
[SidebarTabManager] Binding events to 3 buttons...
[SidebarTabManager] ✓ Event listener bound to button 0
[SidebarTabManager] ✓ Event listener bound to button 1
[SidebarTabManager] ✓ Event listener bound to button 2
[SidebarTabManager] ✅ All event listeners bound
[SidebarTabManager] ✅ Initialized with 3 tabs
```

**如果看到错误日志**:
```
[SidebarTabManager] Tab buttons not found  ❌ 问题: DOM未正确加载
[SidebarTabManager] Found elements: { buttons: 0, contents: 0 }  ❌ 问题: 选择器错误
```

#### 2.4 测试Tab切换

**操作**: 点击"话题"tab

**预期日志**:
```
[SidebarTabManager] Button 1 clicked, tab="topics"
[SidebarTabManager] Switching to tab: topics
```

**预期效果**:
- "助手"tab失去激活状态(黑色边框消失)
- "话题"tab获得激活状态(黑色底部边框)
- 下方内容区域从agent列表切换到话题列表

---

### ✅ 步骤3: 后端通信测试(15分钟)

#### 3.1 启动VCPToolBox后端

```bash
cd VCPToolBox
node server.js
```

**验证后端配置** (`VCPToolBox/config.env`):
```env
Port=6005
Key=VCP_ZhipuAI_Access_Key_2025
API_Key=sk-your-zhipu-api-key
API_URL=https://open.bigmodel.cn/api/paas/v4/chat/completions
```

**预期后端日志**:
```
[INFO] VCPToolBox Server Starting...
[INFO] Server listening on http://localhost:6005
[INFO] Admin Panel: http://localhost:6005
```

#### 3.2 测试连接

**在VCPChat中**:
1. 点击"助手"tab
2. 点击"Nova"agent
3. 在输入框输入: "Hello, can you hear me?"
4. 点击"Send"按钮

**预期浏览器Network tab**:
```
POST http://localhost:6005/v1/chat/completions
Headers:
  Content-Type: application/json
  Authorization: Bearer VCP_ZhipuAI_Access_Key_2025
Body:
  {
    "messages": [
      { "role": "system", "content": "You are Nova..." },
      { "role": "user", "content": "Hello, can you hear me?" }
    ],
    "model": "glm-4.6",
    "temperature": 0.7,
    "stream": true
  }
```

**预期VCPToolBox日志**:
```
[INFO] POST /v1/chat/completions
[INFO] Agent: Nova, Model: glm-4.6
[INFO] Streaming response started
```

**预期VCPChat Console日志**:
```
[ApiClient] Connection status: connecting
[ApiClient] Connection status: connected
[ChatManager] Sending message: "Hello, can you hear me?"
[ChatManager] Streaming chunk: "Hello!..."
[ChatManager] Streaming complete
```

#### 3.3 错误诊断

**问题1**: `Failed to fetch` 或 `Network Error`

**可能原因**:
- VCPToolBox未启动
- 端口号错误(应为6005)
- CORS问题(浏览器模式)

**解决方案**:
```bash
# 检查VCPToolBox是否运行
netstat -ano | findstr :6005

# 检查localStorage配置
localStorage.getItem('vcpchat-settings')
# 应该看到: backend_url: "http://localhost:6005/v1/chat/completions"
```

**问题2**: `401 Unauthorized`

**原因**: API Key不匹配

**解决方案**:
```javascript
// 在Console执行
const settings = JSON.parse(localStorage.getItem('vcpchat-settings'));
console.log('Frontend API Key:', settings.api_key);

// 对比 VCPToolBox/config.env 中的 Key 值
```

**问题3**: `Request timeout` 或 重试循环

**原因**: 后端响应慢 或 DeepSeek API限流

**查看日志**:
```
[ApiClient] Attempt 1/5 failed: Request timeout
[ApiClient] Retrying in 1000ms...
[ApiClient] Attempt 2/5 failed: Request timeout
[ApiClient] Retrying in 2000ms...
```

**解决方案**:
- 检查 `VCPToolBox/config.env` 中的 `API_Key` 是否有效
- 访问 [ZhipuAI控制台](https://open.bigmodel.cn/) 检查账户余额

---

## 高级测试

### Agent选择测试
1. 点击Nova agent → 应该加载Nova的对话历史
2. 点击Coco agent → 应该切换到Coco的对话历史
3. Console应显示: `[AgentManager] Active agent changed: Coco`

### 主题持久化测试
1. 切换到深色主题
2. 刷新页面
3. 应该保持深色主题(从localStorage读取)

### 响应式测试
1. 调整窗口宽度至 <768px
2. 侧边栏应变为overlay绝对定位
3. Resize handles应隐藏

---

## 性能基准

### 启动性能
- 初始化时间: < 1秒
- localStorage读取: < 50ms
- UI首次渲染: < 200ms

### 运行时性能
- Tab切换: < 100ms
- Agent切换: < 200ms
- 消息发送: < 500ms(不含API响应)

---

## 已知限制

1. **Asset协议**: 当前使用Base64内联SVG,生产环境建议使用真实文件
2. **WebSocket通知**: 尚未完全实现,需要后续开发
3. **群组功能**: Demo data中无群组,需手动创建测试
4. **插件系统**: 核心框架已完成,具体插件待开发

---

## 故障排查速查表

| 症状 | 可能原因 | 解决方案 |
|------|---------|---------|
| Tab按钮无响应 | DOM未加载 / 事件未绑定 | 检查Console日志,查看SidebarTabManager初始化 |
| 头像不显示 | Base64解码失败 / img标签错误 | 在浏览器直接访问Base64 URL测试 |
| 后端连接失败 | VCPToolBox未启动 / Key错误 | 检查Network tab,验证请求Headers |
| 主题不切换 | localStorage未写入 / CSS变量错误 | 检查HTML data-theme属性 |
| 消息发送无反应 | ChatManager未初始化 / APIClient错误 | 查看Console中的[ChatManager]日志 |

---

## 报告问题模板

如果遇到问题,请提供以下信息:

```markdown
### 问题描述
[简要描述问题]

### 复现步骤
1.
2.
3.

### 预期行为
[应该发生什么]

### 实际行为
[实际发生了什么]

### Console日志
```
[粘贴完整的Console日志]
```

### Network请求(如有)
```
[粘贴Network tab的请求/响应]
```

### 环境信息
- 操作系统: Windows 11 / macOS / Linux
- 浏览器: Chrome / Firefox / Tauri
- VCPChat版本: Rebuild 2025-11-09
- VCPToolBox状态: 运行中 / 未启动
```

---

**测试指南版本**: 1.0
**生成日期**: 2025-11-09
**有效期**: 持续有效,直到下一次重大更新
