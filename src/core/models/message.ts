// Message data model
import { Attachment } from './attachment';

export type MessageSender = 'user' | 'agent';

/**
 * Message initialization state (CORE-012F)
 *
 * State transitions:
 * pending → ready → finalized
 *
 * - pending: Message created, waiting for initial content
 * - ready: Message has content, can be rendered
 * - finalized: Message complete, no more updates expected
 */
export type MessageState = 'pending' | 'ready' | 'finalized';

export interface ToolCall {
  tool_name: string;
  parameters: Record<string, any>;
  result?: string;
}

export interface MessageMetadata {
  tokens?: number;                   // 令牌计数
  model_used?: string;               // 生成响应的模型
  latency_ms?: number;               // 响应延迟
  tool_calls?: ToolCall[];           // VCP 工具调用
}

export interface Message {
  id: string;                        // 唯一标识符 (UUID)
  sender: MessageSender;             // 'user' 或 'agent'
  sender_id?: string;                // Agent ID (用于多 agent 群组)
  sender_name?: string;              // 显示名称
  content: string;                   // 消息文本内容
  attachments: Attachment[];         // 附加文件
  timestamp: string;                 // ISO 8601 时间戳
  is_streaming: boolean;             // 当前是否正在流式传输
  state: MessageState;               // CORE-012F: Message initialization state
  metadata?: MessageMetadata;        // 可选元数据
}

/**
 * Validate Message data
 */
export function validateMessage(message: Message): string | null {
  if (!message.id || message.id.length === 0) {
    return 'Message ID is required';
  }
  if (message.sender !== 'user' && message.sender !== 'agent') {
    return 'Message sender must be "user" or "agent"';
  }
  if (!message.content || message.content.length === 0) {
    return 'Message content is required';
  }
  if (!Array.isArray(message.attachments)) {
    return 'Message attachments must be an array';
  }
  if (message.attachments.length > 10) {
    return 'Message can have maximum 10 attachments';
  }
  // Validate timestamp
  if (!message.timestamp || isNaN(Date.parse(message.timestamp))) {
    return 'Message timestamp must be a valid ISO 8601 timestamp';
  }
  // CORE-012F: Validate state
  if (!message.state || !['pending', 'ready', 'finalized'].includes(message.state)) {
    return 'Message state must be "pending", "ready", or "finalized"';
  }
  return null;
}

/**
 * CORE-012F: Check if state transition is valid
 */
export function isValidStateTransition(from: MessageState, to: MessageState): boolean {
  const validTransitions: Record<MessageState, MessageState[]> = {
    pending: ['ready', 'finalized'],    // Can skip to finalized if immediate
    ready: ['finalized'],                // Can only go to finalized
    finalized: []                        // Terminal state, no transitions
  };

  return validTransitions[from].includes(to);
}

/**
 * CORE-012F: Transition message state with validation
 */
export function transitionMessageState(message: Message, newState: MessageState): boolean {
  if (!isValidStateTransition(message.state, newState)) {
    console.warn(`Invalid state transition: ${message.state} -> ${newState} for message ${message.id}`);
    return false;
  }

  message.state = newState;
  return true;
}

/**
 * CORE-012F: Check if message can be rendered
 */
export function canRenderMessage(message: Message): boolean {
  return message.state === 'ready' || message.state === 'finalized';
}

/**
 * CORE-012F: Check if message is complete
 */
export function isMessageComplete(message: Message): boolean {
  return message.state === 'finalized' && !message.is_streaming;
}

/**
 * CORE-012F: Mark message as ready for rendering
 */
export function markMessageReady(message: Message): boolean {
  if (message.state === 'pending' && message.content.length > 0) {
    return transitionMessageState(message, 'ready');
  }
  return false;
}

/**
 * CORE-012F: Finalize message (complete, no more updates)
 */
export function finalizeMessage(message: Message): boolean {
  if (message.state !== 'finalized') {
    message.is_streaming = false;
    return transitionMessageState(message, 'finalized');
  }
  return false;
}

/**
 * CORE-012F: Check if message can transition to target state
 * Wrapper for isValidStateTransition that takes a Message object
 */
export function canTransitionTo(message: Message, targetState: MessageState): boolean {
  return isValidStateTransition(message.state, targetState);
}

