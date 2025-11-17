// Topic data model
import { Message } from './message';

export type OwnerType = 'agent' | 'group';

export interface Topic {
  id: string;                        // 唯一标识符 (UUID)
  owner_id: string;                  // Agent 或 Group ID
  owner_type: OwnerType;             // 'agent' 或 'group'
  title: string;                     // 话题标题
  messages: Message[];               // 消息数组
  created_at: string;                // ISO 8601 时间戳
  updated_at: string;                // ISO 8601 时间戳
}

/**
 * Validate Topic data
 */
export function validateTopic(topic: Topic): string | null {
  if (!topic.id || topic.id.length === 0) {
    return 'Topic ID is required';
  }
  if (!topic.owner_id || topic.owner_id.length === 0) {
    return 'Topic owner_id is required';
  }
  if (topic.owner_type !== 'agent' && topic.owner_type !== 'group') {
    return 'Topic owner_type must be "agent" or "group"';
  }
  if (!topic.title || topic.title.length < 1 || topic.title.length > 100) {
    return 'Topic title must be 1-100 characters';
  }
  if (!Array.isArray(topic.messages)) {
    return 'Topic messages must be an array';
  }
  // Validate timestamps
  if (!topic.created_at || isNaN(Date.parse(topic.created_at))) {
    return 'Topic created_at must be a valid ISO 8601 timestamp';
  }
  if (!topic.updated_at || isNaN(Date.parse(topic.updated_at))) {
    return 'Topic updated_at must be a valid ISO 8601 timestamp';
  }
  if (new Date(topic.updated_at) < new Date(topic.created_at)) {
    return 'Topic updated_at must be >= created_at';
  }
  return null;
}
