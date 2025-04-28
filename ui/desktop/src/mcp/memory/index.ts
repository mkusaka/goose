import { z } from 'zod';

/**
 * Interface for MCP Server
 */
interface McpServer {
  tool: (
    name: string,
    description: string,
    parameters: any,
    annotations: ToolAnnotations,
    handler: (args: any) => Promise<CallToolResult>
  ) => void;
}

/**
 * Tool annotations interface
 */
interface ToolAnnotations {
  title: string;
  readOnlyHint: boolean;
  destructiveHint: boolean;
  idempotentHint: boolean;
  openWorldHint: boolean;
}

/**
 * Call tool result interface
 */
interface CallToolResult {
  content: Array<{
    type: string;
    text: string;
  }>;
}

/**
 * Memory entry interface
 */
interface MemoryEntry {
  data: string;
  tags: string[];
}

/**
 * Memory storage interface
 */
interface MemoryStorage {
  [category: string]: MemoryEntry[];
}

/**
 * Memory manager options
 */
interface MemoryManagerOptions {
  appName?: string;
}

/**
 * Custom error class for memory operations
 */
class MemoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MemoryError';
  }
}

/**
 * Memory Manager class
 * Browser-compatible implementation of the Rust MemoryRouter
 */
export class MemoryManager {
  private instructions: string;
  private appName: string;
  private localStoragePrefix: string;
  private globalStoragePrefix: string;

  constructor(options: MemoryManagerOptions = {}) {
    this.appName = options.appName || 'goose';
    this.localStoragePrefix = `${this.appName}_local_memory_`;
    this.globalStoragePrefix = `${this.appName}_global_memory_`;
    this.instructions = this.getInstructions();
    this.loadExistingMemories();
  }

  /**
   * Get base instructions for the memory module
   */
  private getInstructions(): string {
    return `
    This extension allows storage and retrieval of categorized information with tagging support. It's designed to help
    manage important information across sessions in a systematic and organized manner.
    Capabilities:
    1. Store information in categories with optional tags for context-based retrieval.
    2. Search memories by content or specific tags to find relevant information.
    3. List all available memory categories for easy navigation.
    4. Remove entire categories of memories when they are no longer needed.
    
    When to call memory tools:
    - These are examples where the assistant should proactively call the memory tool because the user is providing recurring preferences, project details, or workflow habits that they may expect to be remembered.
    - Preferred Development Tools & Conventions
    - User-specific data (e.g., name, preferences)
    - Project-related configurations
    - Workflow descriptions
    - Other critical settings
    
    Interaction Protocol:
    When important information is identified, such as:
    - User-specific data (e.g., name, preferences)
    - Project-related configurations
    - Workflow descriptions
    - Other critical settings
    The protocol is:
    1. Identify the critical piece of information.
    2. Ask the user if they'd like to store it for later reference.
    3. Upon agreement:
       - Suggest a relevant category like "personal" for user data or "development" for project preferences.
       - Inquire about any specific tags they want to apply for easier lookup.
       - Confirm the desired storage location:
         - Local storage (.goose/memory) for project-specific details.
         - Global storage (~/.config/goose/memory) for user-wide data.
       - Use the remember_memory tool to store the information.
         - \`remember_memory(category, data, tags, is_global)\`
    `;
  }

  /**
   * Load existing memories and update instructions
   */
  private loadExistingMemories(): void {
    try {
      const globalMemories = this.retrieveAll(true);
      const localMemories = this.retrieveAll(false);
      
      let memoryInstructions = "\n\n**Here are the user's currently saved memories:**\n";
      memoryInstructions += "Please keep this information in mind when answering future questions.\n";
      memoryInstructions += "Do not bring up memories unless relevant.\n";
      memoryInstructions += "Note: if the user has not saved any memories, this section will be empty.\n";
      memoryInstructions += "Note: if the user removes a memory that was previously loaded into the system, please remove it from the system instructions.\n";

      if (Object.keys(globalMemories).length > 0) {
        memoryInstructions += "\n\nGlobal Memories:\n";
        for (const [category, memories] of Object.entries(globalMemories)) {
          memoryInstructions += `\nCategory: ${category}\n`;
          for (const memory of memories) {
            memoryInstructions += `- ${memory}\n`;
          }
        }
      }

      if (Object.keys(localMemories).length > 0) {
        memoryInstructions += "\n\nLocal Memories:\n";
        for (const [category, memories] of Object.entries(localMemories)) {
          memoryInstructions += `\nCategory: ${category}\n`;
          for (const memory of memories) {
            memoryInstructions += `- ${memory}\n`;
          }
        }
      }

      this.instructions += memoryInstructions;
    } catch (error) {
      console.error('Failed to load existing memories:', error);
    }
  }

  /**
   * Get storage key for a memory category
   */
  private getStorageKey(category: string, isGlobal: boolean): string {
    const prefix = isGlobal ? this.globalStoragePrefix : this.localStoragePrefix;
    return `${prefix}${category}`;
  }

  /**
   * Retrieve all memories
   */
  public retrieveAll(isGlobal: boolean): Record<string, string[]> {
    const prefix = isGlobal ? this.globalStoragePrefix : this.localStoragePrefix;
    const memories: Record<string, string[]> = {};

    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(prefix)) {
          const category = key.substring(prefix.length);
          const categoryMemories = this.retrieve(category, isGlobal);
          if (Object.values(categoryMemories).length > 0) {
            memories[category] = Object.values(categoryMemories).flat();
          }
        }
      }
      return memories;
    } catch (error) {
      console.error(`Error retrieving all memories: ${error}`);
      return {};
    }
  }

  /**
   * Store a memory
   */
  public remember(category: string, data: string, tags: string[] = [], isGlobal: boolean): void {
    try {
      const storageKey = this.getStorageKey(category, isGlobal);
      let existingData = localStorage.getItem(storageKey) || '';
      let content = '';
      
      if (tags.length > 0) {
        content += `# ${tags.join(' ')}\n`;
      }
      content += `${data}\n\n`;

      localStorage.setItem(storageKey, existingData + content);
    } catch (error) {
      throw new MemoryError(`Failed to remember memory: ${error}`);
    }
  }

  /**
   * Retrieve memories from a category
   */
  public retrieve(category: string, isGlobal: boolean): Record<string, string[]> {
    try {
      const storageKey = this.getStorageKey(category, isGlobal);
      const content = localStorage.getItem(storageKey);
      
      if (!content) {
        return {};
      }

      const memories: Record<string, string[]> = {};
      
      const entries = content.split('\n\n');
      for (const entry of entries) {
        if (!entry.trim()) continue;
        
        const lines = entry.split('\n');
        if (lines.length === 0) continue;
        
        const firstLine = lines[0];
        if (firstLine.startsWith('# ')) {
          const tags = firstLine.substring(2).trim().split(' ');
          const tagKey = tags.join(' ');
          memories[tagKey] = lines.slice(1).filter(line => line.trim());
        } else {
          const untaggedKey = 'untagged';
          if (!memories[untaggedKey]) {
            memories[untaggedKey] = [];
          }
          memories[untaggedKey].push(...lines.filter(line => line.trim()));
        }
      }
      
      return memories;
    } catch (error) {
      console.error(`Error retrieving memories: ${error}`);
      return {};
    }
  }

  /**
   * Remove a specific memory
   */
  public removeSpecificMemory(category: string, memoryContent: string, isGlobal: boolean): void {
    try {
      const storageKey = this.getStorageKey(category, isGlobal);
      const content = localStorage.getItem(storageKey);
      
      if (!content) {
        return;
      }

      const memories = content.split('\n\n');
      const newContent = memories
        .filter(memory => !memory.includes(memoryContent))
        .join('\n\n');

      localStorage.setItem(storageKey, newContent);
    } catch (error) {
      throw new MemoryError(`Failed to remove specific memory: ${error}`);
    }
  }

  /**
   * Clear a memory category
   */
  public clearMemory(category: string, isGlobal: boolean): void {
    try {
      const storageKey = this.getStorageKey(category, isGlobal);
      localStorage.removeItem(storageKey);
    } catch (error) {
      throw new MemoryError(`Failed to clear memory: ${error}`);
    }
  }

  /**
   * Clear all memories
   */
  public clearAllMemories(isGlobal: boolean): void {
    try {
      const prefix = isGlobal ? this.globalStoragePrefix : this.localStoragePrefix;
      
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(prefix)) {
          keysToRemove.push(key);
        }
      }
      
      keysToRemove.forEach(key => localStorage.removeItem(key));
    } catch (error) {
      throw new MemoryError(`Failed to clear all memories: ${error}`);
    }
  }

  /**
   * Get instructions
   */
  public getInstructionsText(): string {
    return this.instructions;
  }

  /**
   * Set instructions
   */
  public setInstructions(newInstructions: string): void {
    this.instructions = newInstructions;
  }

  /**
   * Register memory tools with an MCP server
   */
  public registerWithServer(server: McpServer): void {
    server.tool(
      'remember_memory',
      'Stores a memory with optional tags in a specified category',
      {
        category: z.string().min(1, { message: 'Category must not be empty' }),
        data: z.string().min(1, { message: 'Data must not be empty' }),
        tags: z.array(z.string()).optional().default([]),
        is_global: z.boolean().default(false)
      },
      {
        title: 'Remember Memory',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true, 
        openWorldHint: false
      },
      async ({ category, data, tags, is_global }: { 
        category: string; 
        data: string; 
        tags: string[]; 
        is_global: boolean 
      }): Promise<CallToolResult> => {
        try {
          this.remember(category, data, tags, is_global);
          return {
            content: [
              {
                type: 'text',
                text: `Successfully stored memory in category: ${category}`
              }
            ]
          };
        } catch (error) {
          throw new Error(`Failed to store memory: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    );

    server.tool(
      'retrieve_memories',
      'Retrieves all memories from a specified category',
      {
        category: z.string().min(1, { message: 'Category must not be empty' }),
        is_global: z.boolean().default(false)
      },
      {
        title: 'Retrieve Memory',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false
      },
      async ({ category, is_global }: { 
        category: string; 
        is_global: boolean 
      }): Promise<CallToolResult> => {
        try {
          const memories = category === '*' 
            ? this.retrieveAll(is_global)
            : this.retrieve(category, is_global);
          
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(memories, null, 2)
              }
            ]
          };
        } catch (error) {
          throw new Error(`Failed to retrieve memories: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    );

    server.tool(
      'remove_memory_category',
      'Removes all memories within a specified category',
      {
        category: z.string().min(1, { message: 'Category must not be empty' }),
        is_global: z.boolean().default(false)
      },
      {
        title: 'Remove Memory Category',
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false
      },
      async ({ category, is_global }: { 
        category: string; 
        is_global: boolean 
      }): Promise<CallToolResult> => {
        try {
          if (category === '*') {
            this.clearAllMemories(is_global);
            return {
              content: [
                {
                  type: 'text',
                  text: `Cleared all ${is_global ? 'global' : 'local'} memory categories`
                }
              ]
            };
          } else {
            this.clearMemory(category, is_global);
            return {
              content: [
                {
                  type: 'text',
                  text: `Cleared memories in category: ${category}`
                }
              ]
            };
          }
        } catch (error) {
          throw new Error(`Failed to remove memory category: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    );

    server.tool(
      'remove_specific_memory',
      'Removes a specific memory within a specified category',
      {
        category: z.string().min(1, { message: 'Category must not be empty' }),
        memory_content: z.string().min(1, { message: 'Memory content must not be empty' }),
        is_global: z.boolean().default(false)
      },
      {
        title: 'Remove Specific Memory',
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false
      },
      async ({ category, memory_content, is_global }: { 
        category: string; 
        memory_content: string; 
        is_global: boolean 
      }): Promise<CallToolResult> => {
        try {
          this.removeSpecificMemory(category, memory_content, is_global);
          return {
            content: [
              {
                type: 'text',
                text: `Removed specific memory from category: ${category}`
              }
            ]
          };
        } catch (error) {
          throw new Error(`Failed to remove specific memory: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    );
  }
}
