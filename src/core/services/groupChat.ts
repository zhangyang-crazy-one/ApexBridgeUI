/**
 * Group Chat Service - Handles multi-agent collaboration
 * Implements sequential (turn-based) and free (relevance-based) modes
 */

import type { Group, Agent, Message } from '../models';
import { AgentManager } from '../managers/agentManager';
import { VCPClient } from './apiClient';

/**
 * Base interface for group chat implementations
 */
interface IGroupChat {
  sendMessage(userMessage: string, conversationHistory: Message[]): AsyncGenerator<GroupChatResponse, void, unknown>;
}

/**
 * Response from a group chat containing agent identification
 */
export interface GroupChatResponse {
  sender_id: string;           // Agent ID that sent this chunk
  sender_name: string;          // Agent name for display
  content: string;              // Response content chunk
  is_complete: boolean;         // Whether this agent's response is complete
  turn_number?: number;         // Current turn number (sequential mode only)
  total_turns?: number;         // Total turns planned (sequential mode only)
}

/**
 * Sequential Group Chat - Turn-based collaboration
 * Each agent responds in order for N rounds
 */
export class SequentialGroupChat implements IGroupChat {
  private group: Group;
  private agents: Agent[];
  private agentManager: AgentManager;
  private vcpClient: VCPClient;

  constructor(
    group: Group,
    agents: Agent[],
    agentManager: AgentManager,
    vcpClient: VCPClient
  ) {
    this.group = group;
    this.agents = agents;
    this.agentManager = agentManager;
    this.vcpClient = vcpClient;

    // Validate agents match group
    if (agents.length !== group.agent_ids.length) {
      throw new Error('Agent count mismatch with group configuration');
    }
  }

  /**
   * Send message and get sequential responses from all agents
   */
  async *sendMessage(
    userMessage: string,
    conversationHistory: Message[]
  ): AsyncGenerator<GroupChatResponse, void, unknown> {
    console.log('[SequentialGroupChat] Starting sequential collaboration');
    console.log('[SequentialGroupChat] Turn count:', this.group.turn_count);
    console.log('[SequentialGroupChat] Agents:', this.agents.map(a => a.name).join(', '));

    // Build accumulated context for each turn
    let accumulatedContext = [...conversationHistory];

    // Add user message to context
    const userMsg: Message = {
      id: this.generateUUID(),
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString(),
      sender_id: 'user',
      sender_name: 'User',
    };
    accumulatedContext.push(userMsg);

    // Execute turns
    for (let turn = 1; turn <= this.group.turn_count; turn++) {
      console.log(`[SequentialGroupChat] Turn ${turn}/${this.group.turn_count}`);

      // Each agent responds in order
      for (let i = 0; i < this.agents.length; i++) {
        const agent = this.agents[i];
        console.log(`[SequentialGroupChat] Agent ${i + 1}/${this.agents.length}: ${agent.name}`);

        // Build context message with speaking rules if provided
        let contextPrompt = accumulatedContext.map(msg =>
          `${msg.sender_name}: ${msg.content}`
        ).join('\n\n');

        if (this.group.speaking_rules) {
          contextPrompt = `${this.group.speaking_rules}\n\n${contextPrompt}`;
        }

        // Stream response from this agent
        let agentResponse = '';
        try {
          const stream = this.vcpClient.sendMessage({
            messages: [
              { role: 'system', content: agent.system_prompt },
              { role: 'user', content: contextPrompt }
            ],
            model: agent.model,
            temperature: agent.temperature,
            max_tokens: agent.max_output_tokens,
            stream: true,
          });

          for await (const chunk of stream) {
            if (chunk.type === 'content') {
              agentResponse += chunk.content;

              yield {
                sender_id: agent.id,
                sender_name: agent.name,
                content: chunk.content,
                is_complete: false,
                turn_number: turn,
                total_turns: this.group.turn_count,
              };
            }
          }

          // Mark agent response as complete
          yield {
            sender_id: agent.id,
            sender_name: agent.name,
            content: '',
            is_complete: true,
            turn_number: turn,
            total_turns: this.group.turn_count,
          };

          // Add agent response to accumulated context
          const agentMsg: Message = {
            id: this.generateUUID(),
            role: 'assistant',
            content: agentResponse,
            timestamp: new Date().toISOString(),
            sender_id: agent.id,
            sender_name: agent.name,
          };
          accumulatedContext.push(agentMsg);

          console.log(`[SequentialGroupChat] ${agent.name} response length: ${agentResponse.length} chars`);

        } catch (error) {
          console.error(`[SequentialGroupChat] Error from agent ${agent.name}:`, error);

          // Yield error message
          yield {
            sender_id: agent.id,
            sender_name: agent.name,
            content: `[Error: ${error instanceof Error ? error.message : 'Unknown error'}]`,
            is_complete: true,
            turn_number: turn,
            total_turns: this.group.turn_count,
          };
        }
      }
    }

    console.log('[SequentialGroupChat] Collaboration complete');
  }

  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}

/**
 * Free Group Chat - Relevance-based collaboration
 * System intelligently selects which agents should respond
 */
export class FreeGroupChat implements IGroupChat {
  private group: Group;
  private agents: Agent[];
  private agentManager: AgentManager;
  private vcpClient: VCPClient;

  constructor(
    group: Group,
    agents: Agent[],
    agentManager: AgentManager,
    vcpClient: VCPClient
  ) {
    this.group = group;
    this.agents = agents;
    this.agentManager = agentManager;
    this.vcpClient = vcpClient;

    // Validate agents match group
    if (agents.length !== group.agent_ids.length) {
      throw new Error('Agent count mismatch with group configuration');
    }
  }

  /**
   * Send message and get responses from relevant agents
   */
  async *sendMessage(
    userMessage: string,
    conversationHistory: Message[]
  ): AsyncGenerator<GroupChatResponse, void, unknown> {
    console.log('[FreeGroupChat] Starting free collaboration');
    console.log('[FreeGroupChat] Agents:', this.agents.map(a => a.name).join(', '));

    // Evaluate which agents should respond
    const relevantAgents = await this.evaluateRelevance(userMessage, conversationHistory);
    console.log('[FreeGroupChat] Relevant agents:', relevantAgents.map(a => a.name).join(', '));

    // If no agents deemed relevant, use first agent as fallback
    const respondingAgents = relevantAgents.length > 0 ? relevantAgents : [this.agents[0]];

    // Build context
    let context = [...conversationHistory];
    const userMsg: Message = {
      id: this.generateUUID(),
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString(),
      sender_id: 'user',
      sender_name: 'User',
    };
    context.push(userMsg);

    // Get responses from relevant agents in parallel
    const agentPromises = respondingAgents.map(async (agent) => {
      console.log(`[FreeGroupChat] Requesting response from ${agent.name}`);

      let contextPrompt = context.map(msg =>
        `${msg.sender_name}: ${msg.content}`
      ).join('\n\n');

      if (this.group.speaking_rules) {
        contextPrompt = `${this.group.speaking_rules}\n\n${contextPrompt}`;
      }

      let agentResponse = '';
      const chunks: GroupChatResponse[] = [];

      try {
        const stream = this.vcpClient.sendMessage({
          messages: [
            { role: 'system', content: agent.system_prompt },
            { role: 'user', content: contextPrompt }
          ],
          model: agent.model,
          temperature: agent.temperature,
          max_tokens: agent.max_output_tokens,
          stream: true,
        });

        for await (const chunk of stream) {
          if (chunk.type === 'content') {
            agentResponse += chunk.content;
            chunks.push({
              sender_id: agent.id,
              sender_name: agent.name,
              content: chunk.content,
              is_complete: false,
            });
          }
        }

        // Mark complete
        chunks.push({
          sender_id: agent.id,
          sender_name: agent.name,
          content: '',
          is_complete: true,
        });

        console.log(`[FreeGroupChat] ${agent.name} response length: ${agentResponse.length} chars`);

      } catch (error) {
        console.error(`[FreeGroupChat] Error from agent ${agent.name}:`, error);
        chunks.push({
          sender_id: agent.id,
          sender_name: agent.name,
          content: `[Error: ${error instanceof Error ? error.message : 'Unknown error'}]`,
          is_complete: true,
        });
      }

      return chunks;
    });

    // Stream all agent responses (interleaved)
    // For simplicity, we'll process sequentially but could be parallelized
    for (const agentChunks of await Promise.all(agentPromises)) {
      for (const chunk of agentChunks) {
        yield chunk;
      }
    }

    console.log('[FreeGroupChat] Collaboration complete');
  }

  /**
   * Evaluate which agents are relevant for the given message
   * Uses a simple heuristic based on agent system prompts and speaking rules
   */
  private async evaluateRelevance(
    userMessage: string,
    conversationHistory: Message[]
  ): Promise<Agent[]> {
    // Simple heuristic: check if agent's system prompt or name matches keywords
    // In production, this could use embeddings or LLM evaluation

    const messageLower = userMessage.toLowerCase();
    const relevant: Agent[] = [];

    for (const agent of this.agents) {
      // Check if agent name or system prompt contains relevant keywords
      const agentContext = `${agent.name} ${agent.system_prompt}`.toLowerCase();

      // Basic relevance scoring
      let score = 0;

      // Check for name mentions
      if (messageLower.includes(agent.name.toLowerCase())) {
        score += 10;
      }

      // Check for role/capability matches
      const keywords = this.extractKeywords(agent.system_prompt);
      for (const keyword of keywords) {
        if (messageLower.includes(keyword.toLowerCase())) {
          score += 1;
        }
      }

      // Check recent participation in conversation
      const recentMessages = conversationHistory.slice(-5);
      const hasParticipated = recentMessages.some(msg => msg.sender_id === agent.id);
      if (!hasParticipated) {
        score += 2; // Slight boost for agents who haven't spoken recently
      }

      if (score > 0) {
        relevant.push(agent);
      }
    }

    // If no agents match, return all agents (democratic approach)
    if (relevant.length === 0) {
      return this.agents;
    }

    // Limit to top 3 most relevant agents to avoid too many responses
    return relevant.slice(0, 3);
  }

  /**
   * Extract keywords from system prompt for relevance matching
   */
  private extractKeywords(systemPrompt: string): string[] {
    // Simple keyword extraction: split on spaces, remove common words
    const commonWords = new Set(['you', 'are', 'a', 'an', 'the', 'is', 'in', 'at', 'of', 'for', 'to', 'and', 'or']);
    return systemPrompt
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 3 && !commonWords.has(word))
      .slice(0, 10); // Limit to top 10 keywords
  }

  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}

/**
 * Factory function to create appropriate group chat instance
 */
export function createGroupChat(
  group: Group,
  agents: Agent[],
  agentManager: AgentManager,
  vcpClient: VCPClient
): IGroupChat {
  if (group.collaboration_mode === 'sequential') {
    return new SequentialGroupChat(group, agents, agentManager, vcpClient);
  } else {
    return new FreeGroupChat(group, agents, agentManager, vcpClient);
  }
}
