// TypeScript wrappers for Tauri IPC commands
import { invoke } from '@tauri-apps/api/core';
import type { Agent, Group, Topic, GlobalSettings, Attachment } from '@core/models';

/**
 * Conversation (Topic) Commands
 */

export async function readConversation(topicId: string): Promise<Topic> {
  return await invoke<Topic>('read_conversation', { topicId });
}

export async function writeConversation(topic: Topic): Promise<void> {
  await invoke('write_conversation', { topic });
}

export async function deleteConversation(topicId: string, ownerType: 'agent' | 'group'): Promise<void> {
  await invoke('delete_conversation', { topicId, ownerType });
}

export async function listTopics(ownerId: string, ownerType: 'agent' | 'group'): Promise<Topic[]> {
  return await invoke<Topic[]>('list_topics', { ownerId, ownerType });
}

/**
 * Agent Commands
 */

export async function readAgent(agentId: string): Promise<Agent> {
  return await invoke<Agent>('read_agent', { agentId });
}

export async function writeAgent(agent: Agent): Promise<void> {
  await invoke('write_agent', { agent });
}

export async function deleteAgent(agentId: string): Promise<void> {
  await invoke('delete_agent', { agentId });
}

export async function listAgents(): Promise<Agent[]> {
  return await invoke<Agent[]>('list_agents');
}

/**
 * Group Commands
 */

export async function readGroup(groupId: string): Promise<Group> {
  return await invoke<Group>('read_group', { groupId });
}

export async function writeGroup(group: Group): Promise<void> {
  await invoke('write_group', { group });
}

export async function deleteGroup(groupId: string): Promise<void> {
  await invoke('delete_group', { groupId });
}

export async function listGroups(): Promise<Group[]> {
  return await invoke<Group[]>('list_groups');
}

/**
 * Settings Commands
 */

export async function readSettings(): Promise<GlobalSettings> {
  return await invoke<GlobalSettings>('read_settings');
}

export async function writeSettings(settings: GlobalSettings): Promise<void> {
  await invoke('write_settings', { settings });
}

/**
 * Window Control Commands
 */

export async function setWindowAlwaysOnTop(alwaysOnTop: boolean): Promise<void> {
  await invoke('set_window_always_on_top', { alwaysOnTop });
}

export async function setWindowTransparency(transparency: number): Promise<void> {
  await invoke('set_window_transparency', { transparency });
}

export async function minimizeWindow(): Promise<void> {
  await invoke('minimize_window');
}

export async function maximizeWindow(): Promise<void> {
  await invoke('maximize_window');
}

export async function closeWindow(): Promise<void> {
  await invoke('close_window');
}

/**
 * Attachment Commands
 */

export async function saveAttachment(attachment: Attachment, fileData: Uint8Array): Promise<string> {
  return await invoke<string>('save_attachment', {
    attachment,
    fileData: Array.from(fileData)
  });
}

export async function readAttachment(filePath: string): Promise<Uint8Array> {
  const data = await invoke<number[]>('read_attachment', { filePath });
  return new Uint8Array(data);
}

export async function deleteAttachment(filePath: string): Promise<void> {
  await invoke('delete_attachment', { filePath });
}

/**
 * Error handling wrapper for IPC commands
 */
export async function safeInvoke<T>(
  command: string,
  args?: Record<string, unknown>
): Promise<{ success: boolean; data?: T; error?: string }> {
  try {
    const data = await invoke<T>(command, args);
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Check if Tauri API is available (for web debug mirror detection)
 */
export function isTauriAvailable(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window;
}

/**
 * Canvas Commands (CORE-044)
 */

export interface CanvasData {
  id: string;
  title: string;
  language: string;
  content: string;
  modifiedAt: string;
  options: Record<string, any>;
}

export async function readCanvas(canvasId: string): Promise<CanvasData> {
  return await invoke<CanvasData>('read_canvas', { canvasId });
}

export async function writeCanvas(canvas: CanvasData): Promise<void> {
  await invoke('write_canvas', { canvas });
}

export async function deleteCanvas(canvasId: string): Promise<void> {
  await invoke('delete_canvas', { canvasId });
}

export async function listCanvases(): Promise<CanvasData[]> {
  return await invoke<CanvasData[]>('list_canvases');
}

/**
 * Note Commands (CORE-047)
 */

export interface NoteData {
  id: string;
  title: string;
  content: string;
  tags: string[];
  modifiedAt: string;
  createdAt: string;
  options: Record<string, any>;
  isPinned: boolean;
  isArchived: boolean;
}

export interface NoteMetadata {
  id: string;
  title: string;
  tags: string[];
  createdAt: string;
  modifiedAt: string;
  wordCount: number;
  isPinned: boolean;
  isArchived: boolean;
}

export async function readNote(noteId: string): Promise<NoteData> {
  return await invoke<NoteData>('read_note', { noteId });
}

export async function writeNote(note: NoteData): Promise<void> {
  await invoke('write_note', { note });
}

export async function deleteNote(noteId: string): Promise<void> {
  await invoke('delete_note', { noteId });
}

export async function listNotes(): Promise<NoteMetadata[]> {
  return await invoke<NoteMetadata[]>('list_notes');
}
