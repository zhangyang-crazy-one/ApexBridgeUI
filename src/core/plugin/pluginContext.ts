// PLUGIN-044: TypeScript FileSystemAPI wrapper
// PLUGIN-053: TypeScript NetworkAPI wrapper
// Provides type-safe interface to Tauri filesystem and network commands

import { invoke } from '@tauri-apps/api/core';

/// File metadata information
export interface FileInfo {
  path: string;
  name: string;
  is_file: boolean;
  is_dir: boolean;
  size: number;
  modified?: string;
  created?: string;
}

/// HTTP method types
export enum HttpMethod {
  Get = 'Get',
  Post = 'Post',
  Put = 'Put',
  Delete = 'Delete',
  Patch = 'Patch',
  Head = 'Head',
}

/// HTTP request structure
export interface HttpRequest {
  url: string;
  method: HttpMethod;
  headers: Record<string, string>;
  body?: string;
  timeout_secs?: number;
}

/// HTTP response structure
export interface HttpResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
}

/**
 * PLUGIN-044: FileSystemAPI wrapper for plugin use
 * All file operations are scoped to AppData directory and require permissions
 */
export class FileSystemAPI {
  private pluginId: string;

  constructor(pluginId: string) {
    this.pluginId = pluginId;
  }

  /**
   * Read file contents as UTF-8 string
   * Requires: filesystem.read permission for the file path
   */
  async readFile(path: string): Promise<string> {
    return await invoke('plugin_fs_read_file', {
      pluginId: this.pluginId,
      path,
    });
  }

  /**
   * Write file contents with atomic write (temp file + rename)
   * Requires: filesystem.write permission for the file path
   */
  async writeFile(path: string, contents: string): Promise<void> {
    await invoke('plugin_fs_write_file', {
      pluginId: this.pluginId,
      path,
      contents,
    });
  }

  /**
   * List files in directory with optional glob pattern
   * Requires: filesystem.read permission for the directory
   * @param pattern - Optional glob pattern like "*.txt"
   */
  async listFiles(path: string, pattern?: string): Promise<FileInfo[]> {
    return await invoke('plugin_fs_list_files', {
      pluginId: this.pluginId,
      path,
      pattern: pattern || null,
    });
  }

  /**
   * Watch directory for file system events
   * Requires: filesystem.read permission for the directory
   */
  async watchDirectory(path: string): Promise<void> {
    await invoke('plugin_fs_watch_directory', {
      pluginId: this.pluginId,
      path,
    });
  }

  /**
   * Stop watching directory
   */
  async unwatchDirectory(): Promise<void> {
    await invoke('plugin_fs_unwatch_directory', {
      pluginId: this.pluginId,
    });
  }

  /**
   * Delete file
   * Requires: filesystem.write permission for the file
   */
  async deleteFile(path: string): Promise<void> {
    await invoke('plugin_fs_delete_file', {
      pluginId: this.pluginId,
      path,
    });
  }

  /**
   * Create directory (including parent directories)
   * Requires: filesystem.write permission for the path
   */
  async createDirectory(path: string): Promise<void> {
    await invoke('plugin_fs_create_directory', {
      pluginId: this.pluginId,
      path,
    });
  }

  /**
   * Check if file or directory exists
   * Requires: filesystem.read permission for the path
   */
  async exists(path: string): Promise<boolean> {
    return await invoke('plugin_fs_exists', {
      pluginId: this.pluginId,
      path,
    });
  }
}

/**
 * PLUGIN-053: NetworkAPI wrapper for plugin use
 * All network requests require network.request permission for the domain
 * Includes automatic rate limiting (100 req/min) and response caching
 */
export class NetworkAPI {
  private pluginId: string;

  constructor(pluginId: string) {
    this.pluginId = pluginId;
  }

  /**
   * Execute HTTP request with all validations
   * Requires: network.request permission for the domain
   * @param request - HTTP request configuration
   * @returns HTTP response with status, headers, and body
   */
  async request(request: HttpRequest): Promise<HttpResponse> {
    return await invoke('plugin_http_request', {
      pluginId: this.pluginId,
      request,
    });
  }

  /**
   * GET request convenience method
   * Requires: network.request permission for the domain
   * @param url - Target URL
   * @param headers - Optional request headers
   * @returns HTTP response
   */
  async get(url: string, headers?: Record<string, string>): Promise<HttpResponse> {
    return await this.request({
      url,
      method: HttpMethod.Get,
      headers: headers || {},
    });
  }

  /**
   * POST request convenience method
   * Requires: network.request permission for the domain
   * @param url - Target URL
   * @param body - Request body (JSON or plain text)
   * @param headers - Optional request headers
   * @returns HTTP response
   */
  async post(
    url: string,
    body: string,
    headers?: Record<string, string>
  ): Promise<HttpResponse> {
    return await this.request({
      url,
      method: HttpMethod.Post,
      headers: headers || {},
      body,
    });
  }

  /**
   * PUT request convenience method
   * Requires: network.request permission for the domain
   * @param url - Target URL
   * @param body - Request body (JSON or plain text)
   * @param headers - Optional request headers
   * @returns HTTP response
   */
  async put(
    url: string,
    body: string,
    headers?: Record<string, string>
  ): Promise<HttpResponse> {
    return await this.request({
      url,
      method: HttpMethod.Put,
      headers: headers || {},
      body,
    });
  }

  /**
   * DELETE request convenience method
   * Requires: network.request permission for the domain
   * @param url - Target URL
   * @param headers - Optional request headers
   * @returns HTTP response
   */
  async delete(url: string, headers?: Record<string, string>): Promise<HttpResponse> {
    return await this.request({
      url,
      method: HttpMethod.Delete,
      headers: headers || {},
    });
  }

  /**
   * PATCH request convenience method
   * Requires: network.request permission for the domain
   * @param url - Target URL
   * @param body - Request body (JSON or plain text)
   * @param headers - Optional request headers
   * @returns HTTP response
   */
  async patch(
    url: string,
    body: string,
    headers?: Record<string, string>
  ): Promise<HttpResponse> {
    return await this.request({
      url,
      method: HttpMethod.Patch,
      headers: headers || {},
      body,
    });
  }
}

/**
 * PLUGIN-060: StorageAPI wrapper for plugin use
 * Plugin-isolated key-value storage with JSON persistence
 * All data is stored in AppData/plugin-data/{plugin_id}/storage.json
 */
export class StorageAPI {
  private pluginId: string;

  constructor(pluginId: string) {
    this.pluginId = pluginId;
  }

  /**
   * Set a value for a key in storage
   * Value can be string, number, boolean, or JSON object
   * @param key - Storage key (cannot be empty)
   * @param value - Value to store (will be JSON serialized)
   * @returns Promise that resolves when value is persisted
   */
  async set(key: string, value: string | number | boolean | object): Promise<void> {
    const valueStr = typeof value === 'string' ? value : JSON.stringify(value);

    await invoke('plugin_storage_set', {
      pluginId: this.pluginId,
      key,
      value: valueStr,
    });
  }

  /**
   * Get a value from storage
   * @param key - Storage key
   * @returns Promise that resolves with the value (as JSON string) or null if not found
   */
  async get(key: string): Promise<string | null> {
    return await invoke('plugin_storage_get', {
      pluginId: this.pluginId,
      key,
    });
  }

  /**
   * Get and parse a JSON value from storage
   * @param key - Storage key
   * @returns Promise that resolves with the parsed value or null if not found
   */
  async getJSON<T = any>(key: string): Promise<T | null> {
    const value = await this.get(key);
    if (value === null) {
      return null;
    }
    try {
      return JSON.parse(value) as T;
    } catch (e) {
      console.error(`Failed to parse storage value for key "${key}":`, e);
      return null;
    }
  }

  /**
   * Delete a key from storage
   * @param key - Storage key to delete
   * @returns Promise that resolves with true if key existed, false otherwise
   */
  async delete(key: string): Promise<boolean> {
    return await invoke('plugin_storage_delete', {
      pluginId: this.pluginId,
      key,
    });
  }

  /**
   * Clear all data from storage
   * @returns Promise that resolves when storage is cleared
   */
  async clear(): Promise<void> {
    await invoke('plugin_storage_clear', {
      pluginId: this.pluginId,
    });
  }

  /**
   * Get all keys in storage
   * @returns Promise that resolves with array of all keys
   */
  async keys(): Promise<string[]> {
    return await invoke('plugin_storage_keys', {
      pluginId: this.pluginId,
    });
  }

  /**
   * Check if a key exists in storage
   * @param key - Storage key to check
   * @returns Promise that resolves with true if key exists
   */
  async has(key: string): Promise<boolean> {
    return await invoke('plugin_storage_has', {
      pluginId: this.pluginId,
      key,
    });
  }

  /**
   * Get the number of items in storage
   * @returns Promise that resolves with the number of stored items
   */
  async size(): Promise<number> {
    return await invoke('plugin_storage_size', {
      pluginId: this.pluginId,
    });
  }
}
