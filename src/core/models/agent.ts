// Agent data model
export interface Agent {
  id: string;                        // 唯一标识符 (UUID)
  name: string;                      // 显示名称 (1-50 字符)
  avatar: string;                    // 头像图片路径或 URL
  system_prompt: string;             // AI 行为的系统提示词
  model: string;                     // 模型标识符 (如 "gpt-4")
  temperature: number;               // 采样温度 (0.0-2.0)
  context_token_limit: number;       // 最大上下文令牌数
  max_output_tokens: number;         // 最大输出令牌数
  streaming?: boolean;               // 是否启用流式回答 (默认 true)
  created_at: string;                // ISO 8601 时间戳
}

/**
 * Validate Agent data
 */
export function validateAgent(agent: Agent): string | null {
  if (!agent.id || agent.id.length === 0) {
    return 'Agent ID is required';
  }
  if (!agent.name || agent.name.length < 1 || agent.name.length > 50) {
    return 'Agent name must be 1-50 characters';
  }
  if (!agent.avatar || agent.avatar.length === 0) {
    return 'Agent avatar is required';
  }
  if (!agent.model || agent.model.length === 0) {
    return 'Agent model is required';
  }
  if (agent.temperature < 0.0 || agent.temperature > 2.0) {
    return 'Agent temperature must be between 0.0 and 2.0';
  }
  if (agent.context_token_limit < 1) {
    return 'Agent context_token_limit must be positive';
  }
  if (agent.max_output_tokens < 1) {
    return 'Agent max_output_tokens must be positive';
  }
  // Validate ISO 8601 timestamp
  if (!agent.created_at || isNaN(Date.parse(agent.created_at))) {
    return 'Agent created_at must be a valid ISO 8601 timestamp';
  }
  return null;
}
