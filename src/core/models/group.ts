// Group data model
export type CollaborationMode = 'sequential' | 'free';

export interface Group {
  id: string;                        // 唯一标识符 (UUID)
  name: string;                      // 显示名称 (1-50 字符)
  avatar: string;                    // 群组头像路径或 URL
  agent_ids: string[];               // Agent ID 数组 (至少 2 个)
  collaboration_mode: CollaborationMode; // 'sequential' 或 'free'
  turn_count: number;                // 每轮最大发言次数
  speaking_rules: string;            // Agent 响应规则
  streaming?: boolean;               // 是否启用流式回答 (默认 true)
  created_at: string;                // ISO 8601 时间戳
}

/**
 * Validate Group data
 */
export function validateGroup(group: Group): string | null {
  if (!group.id || group.id.length === 0) {
    return 'Group ID is required';
  }
  if (!group.name || group.name.length < 1 || group.name.length > 50) {
    return 'Group name must be 1-50 characters';
  }
  if (!group.avatar || group.avatar.length === 0) {
    return 'Group avatar is required';
  }
  if (!group.agent_ids || group.agent_ids.length < 2) {
    return 'Group must have at least 2 agents';
  }
  if (group.collaboration_mode !== 'sequential' && group.collaboration_mode !== 'free') {
    return 'Group collaboration_mode must be "sequential" or "free"';
  }
  if (group.turn_count < 1 || group.turn_count > 10) {
    return 'Group turn_count must be between 1 and 10';
  }
  if (group.speaking_rules && group.speaking_rules.length > 500) {
    return 'Group speaking_rules must not exceed 500 characters';
  }
  // Validate ISO 8601 timestamp
  if (!group.created_at || isNaN(Date.parse(group.created_at))) {
    return 'Group created_at must be a valid ISO 8601 timestamp';
  }
  return null;
}
