# 动态模型选择功能测试指南

## 功能概述

AgentEditor现在支持从后端API动态获取可用模型列表，而不是使用硬编码的模型列表。

## 实现细节

### 后端API
- **接口路径**: `GET /v1/models`
- **完整URL**: `http://localhost:6005/v1/models`
- **认证方式**: Bearer Token (API Key)
- **返回格式**: OpenAI兼容的JSON格式

### 前端实现
1. **apiClient.ts**: 添加了`listModels()`方法
2. **AgentEditor.ts**: 在`show()`时调用API获取模型列表
3. **Fallback机制**: API调用失败时使用默认模型列表

---

## 测试场景

### 测试1: 正常流程（后端在线）

**前置条件**:
- VCPToolBox后端正在运行（`http://localhost:6005`）
- 后端配置了有效的API Key和API URL

**测试步骤**:
1. 启动VCPChat前端（`npm run dev`）
2. 打开浏览器开发者工具的Console
3. 点击左侧边栏的"New Agent"按钮
4. 观察Console日志，应该看到：
   ```
   [AgentEditor] Loading models from backend...
   [ApiClient] Fetching models from: http://localhost:6005/v1/models
   [ApiClient] Received models: X
   [AgentEditor] Loaded models: X
   ```
5. 检查模型下拉框，应该显示从后端获取的模型列表
6. 选择一个模型（如`glm-4.6`）
7. 填写Agent名称和其他字段
8. 点击"Create Agent"按钮
9. 验证Agent是否成功创建

**预期结果**:
- ✅ Console显示成功加载模型的日志
- ✅ 模型下拉框显示后端返回的所有模型
- ✅ 模型名称格式化显示（如"Glm 4.6 (Zhipuai)"）
- ✅ Agent成功创建

---

### 测试2: 后端离线（Fallback机制）

**前置条件**:
- VCPToolBox后端**未运行**或无法访问

**测试步骤**:
1. 确保后端已停止
2. 启动VCPChat前端
3. 打开浏览器开发者工具的Console
4. 点击"New Agent"按钮
5. 观察Console日志，应该看到：
   ```
   [AgentEditor] Loading models from backend...
   [ApiClient] Attempt 1/5 failed: ...
   [AgentEditor] Failed to load models: ...
   [AgentEditor] Using fallback default models
   ```
6. 检查模型下拉框，应该显示默认的fallback模型列表

**预期结果**:
- ✅ Console显示API调用失败的日志
- ✅ Console显示使用fallback模型的警告
- ✅ 模型下拉框显示默认的8个模型（GPT-4, GPT-4 Turbo, GPT-3.5 Turbo, Claude 3系列, GLM-4.6, GLM-4）
- ✅ 可以正常创建Agent

---

### 测试3: 编辑现有Agent

**前置条件**:
- 已创建至少一个Agent
- 后端正在运行

**测试步骤**:
1. 右键点击一个Agent
2. 选择"Settings"
3. 检查模型下拉框中当前选中的模型是否正确高亮
4. 修改模型选择
5. 点击"Save Changes"
6. 验证Agent的模型是否成功更新

**预期结果**:
- ✅ 当前Agent的模型在下拉框中正确选中
- ✅ 可以切换到其他模型
- ✅ 保存后模型更新成功

---

### 测试4: 不同Provider的模型

**前置条件**:
- 后端配置了不同的API Provider（OpenAI、智谱、Anthropic等）

**测试步骤**:
1. 在VCPToolBox的`config.env`中配置OpenAI API
2. 重启后端
3. 打开前端，创建Agent
4. 检查模型列表是否显示OpenAI的模型
5. 修改`config.env`为智谱API
6. 重启后端
7. 刷新前端，创建Agent
8. 检查模型列表是否显示智谱的模型（包括视觉模型）

**预期结果**:
- ✅ OpenAI API: 显示GPT系列模型
- ✅ 智谱API: 显示GLM系列模型，包括视觉模型（glm-4.5v, glm-4v-plus, glm-4v）
- ✅ 模型名称包含Provider信息

---

## 调试技巧

### 查看API响应

在浏览器Console中运行以下代码查看API返回的原始数据：

```javascript
// 获取API Client
const { getAPIClient } = await import('/src/core/services/apiClient.js');
const apiClient = getAPIClient();

// 调用API
const models = await apiClient.listModels();
console.log('Models:', models);
```

### 查看模型下拉框内容

```javascript
// 获取模型下拉框
const modelSelect = document.getElementById('agent-model');
console.log('Model options:', Array.from(modelSelect.options).map(opt => ({
  value: opt.value,
  text: opt.text
})));
```

---

## 常见问题

### Q1: 模型列表为空
**原因**: 后端API返回的数据格式不正确
**解决**: 检查后端日志，确认`/v1/models`接口返回的JSON格式符合OpenAI标准

### Q2: 模型名称显示为ID
**原因**: 后端未返回`description`字段
**解决**: 这是正常的，前端会自动格式化模型ID为可读名称

### Q3: 总是使用fallback模型
**原因**: API调用失败
**解决**: 
1. 检查后端是否运行
2. 检查Settings中的backend_url配置
3. 检查API Key是否正确
4. 查看Console错误日志

---

## 成功标准

- ✅ 后端在线时，模型列表从API动态获取
- ✅ 后端离线时，使用fallback默认模型
- ✅ 模型名称格式化显示，包含Provider信息
- ✅ 创建和编辑Agent时模型选择正常工作
- ✅ 不同Provider的模型正确显示
- ✅ Console日志清晰，便于调试

