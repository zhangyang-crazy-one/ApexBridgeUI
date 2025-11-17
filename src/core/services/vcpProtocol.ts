/**
 * VCP Protocol Service (US5-020, US5-021, US5-022)
 *
 * Handles VCP tool call protocol:
 * - Parses <<<[TOOL_REQUEST]>>> format
 * - Executes tool calls via VCPToolBox API
 * - Injects results back into chat
 */

import { sendChatCompletion } from './apiClient';

export interface VCPToolCall {
  maid: string;          // Agent name
  tool_name: string;     // Plugin/tool name
  parameters: Record<string, string>;  // Tool parameters
}

export interface VCPToolResult {
  tool_name: string;
  status: 'success' | 'error';
  result: any;
  error?: string;
}

export class VCPProtocolService {
  private static instance: VCPProtocolService;

  // VCP tool call regex pattern
  private static readonly TOOL_REQUEST_PATTERN = /<<<\[TOOL_REQUEST\]>>>([\s\S]*?)<<<\[END_TOOL_REQUEST\]>>>/g;
  private static readonly PARAM_PATTERN = /(\w+):「始」([\s\S]*?)「末」/g;

  private constructor() {}

  public static getInstance(): VCPProtocolService {
    if (!VCPProtocolService.instance) {
      VCPProtocolService.instance = new VCPProtocolService();
    }
    return VCPProtocolService.instance;
  }

  /**
   * Parse VCP tool calls from message content (US5-020)
   */
  public parseToolCalls(content: string): VCPToolCall[] {
    const toolCalls: VCPToolCall[] = [];

    // Find all tool request blocks
    let match;
    while ((match = VCPProtocolService.TOOL_REQUEST_PATTERN.exec(content)) !== null) {
      const blockContent = match[1];
      const toolCall = this.parseToolCallBlock(blockContent);

      if (toolCall) {
        toolCalls.push(toolCall);
      }
    }

    return toolCalls;
  }

  /**
   * Parse individual tool call block
   */
  private parseToolCallBlock(blockContent: string): VCPToolCall | null {
    const parameters: Record<string, string> = {};
    let maid = '';
    let tool_name = '';

    // Extract parameters
    let paramMatch;
    while ((paramMatch = VCPProtocolService.PARAM_PATTERN.exec(blockContent)) !== null) {
      const key = paramMatch[1];
      const value = paramMatch[2].trim();

      if (key === 'maid') {
        maid = value;
      } else if (key === 'tool_name') {
        tool_name = value;
      } else {
        parameters[key] = value;
      }
    }

    // Validate required fields
    if (!maid || !tool_name) {
      console.error('Invalid tool call: missing maid or tool_name');
      return null;
    }

    return {
      maid,
      tool_name,
      parameters
    };
  }

  /**
   * Execute tool call via VCPToolBox API (US5-021)
   */
  public async executeToolCall(toolCall: VCPToolCall): Promise<VCPToolResult> {
    try {
      // Build tool execution request
      const requestBody = {
        model: 'tool-executor',  // Special model for tool execution
        messages: [
          {
            role: 'system',
            content: `Execute tool: ${toolCall.tool_name}`
          },
          {
            role: 'user',
            content: JSON.stringify({
              maid: toolCall.maid,
              tool_name: toolCall.tool_name,
              parameters: toolCall.parameters
            })
          }
        ],
        stream: false
      };

      // Send to VCPToolBox
      const response = await sendChatCompletion(requestBody);

      // Parse response
      const reader = response.getReader();
      const decoder = new TextDecoder();
      let result = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        result += decoder.decode(value, { stream: true });
      }

      // Parse result
      try {
        const parsedResult = JSON.parse(result);

        return {
          tool_name: toolCall.tool_name,
          status: parsedResult.status || 'success',
          result: parsedResult.result || parsedResult
        };
      } catch (parseError) {
        // If not JSON, treat as plain text result
        return {
          tool_name: toolCall.tool_name,
          status: 'success',
          result: result
        };
      }

    } catch (error) {
      console.error('Tool execution failed:', error);

      return {
        tool_name: toolCall.tool_name,
        status: 'error',
        error: (error as Error).message,
        result: null
      };
    }
  }

  /**
   * Inject tool result into chat message (US5-022)
   */
  public formatToolResult(toolResult: VCPToolResult): string {
    if (toolResult.status === 'success') {
      return `\n\n**[Tool Result: ${toolResult.tool_name}]**\n\`\`\`json\n${JSON.stringify(toolResult.result, null, 2)}\n\`\`\`\n`;
    } else {
      return `\n\n**[Tool Error: ${toolResult.tool_name}]**\n\`\`\`\n${toolResult.error || 'Unknown error'}\n\`\`\`\n`;
    }
  }

  /**
   * Process message with tool calls (full workflow)
   */
  public async processMessageWithTools(content: string): Promise<{ content: string; toolResults: VCPToolResult[] }> {
    // Parse tool calls
    const toolCalls = this.parseToolCalls(content);

    if (toolCalls.length === 0) {
      return { content, toolResults: [] };
    }

    // Execute all tool calls
    const toolResults: VCPToolResult[] = [];

    for (const toolCall of toolCalls) {
      const result = await this.executeToolCall(toolCall);
      toolResults.push(result);
    }

    // Inject results into content
    let processedContent = content;

    toolResults.forEach(result => {
      processedContent += this.formatToolResult(result);
    });

    return {
      content: processedContent,
      toolResults
    };
  }

  /**
   * Check if message contains tool calls
   */
  public hasToolCalls(content: string): boolean {
    return VCPProtocolService.TOOL_REQUEST_PATTERN.test(content);
  }

  /**
   * Extract tool call count from content
   */
  public getToolCallCount(content: string): number {
    const matches = content.match(VCPProtocolService.TOOL_REQUEST_PATTERN);
    return matches ? matches.length : 0;
  }

  /**
   * Format tool call for display (for debugging/logging)
   */
  public formatToolCallSummary(toolCall: VCPToolCall): string {
    const paramCount = Object.keys(toolCall.parameters).length;
    return `[${toolCall.maid}] → ${toolCall.tool_name} (${paramCount} params)`;
  }
}
