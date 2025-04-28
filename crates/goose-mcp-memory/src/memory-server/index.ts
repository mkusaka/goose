#!/usr/bin/env node

import {
  McpServer,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { logger } from "./lib/logger.js";
import fs from "fs-extra";
import path from "path";
import os from "os";

logger.info("MCP Memory Server started");
logger.info(`Platform: ${os.platform()}`);
logger.info(`Hostname: ${os.hostname()}`);
logger.info(`Username: ${os.userInfo().username}`);

const server = new McpServer({
  name: "@mkusaka/mcp-memory-server",
  version: "0.1.0",
});

const appDirs = {
  local: path.join(process.cwd(), '.goose', 'memory'),
  global: path.join(os.homedir(), '.config', 'goose', 'memory')
};

fs.ensureDirSync(appDirs.local);
fs.ensureDirSync(appDirs.global);

server.tool(
  "remember_memory",
  "Stores a memory with optional tags in a specified category",
  {
    category: z.string().min(1, { message: 'Category must not be empty' }),
    data: z.string().min(1, { message: 'Data must not be empty' }),
    tags: z.array(z.string()).optional().default([]),
    is_global: z.boolean().default(false)
  },
  async ({ category, data, tags, is_global }) => {
    try {
      const baseDir = is_global ? appDirs.global : appDirs.local;
      const memoryFilePath = path.join(baseDir, `${category}.txt`);
      
      let content = '';
      if (tags.length > 0) {
        content += `# ${tags.join(' ')}\n`;
      }
      content += `${data}\n\n`;

      await fs.appendFile(memoryFilePath, content);
      
      logger.info(`Memory stored in category: ${category}, global: ${is_global}`);
      
      return {
        content: [
          {
            type: "text",
            text: `Successfully stored memory in category: ${category}`
          }
        ]
      };
    } catch (error) {
      logger.error(`Failed to store memory: ${error}`);
      return {
        content: [
          {
            type: "text",
            text: `Error: ${error instanceof Error ? error.message : String(error)}`
          }
        ],
        isError: true
      };
    }
  }
);

server.tool(
  "retrieve_memories",
  "Retrieves all memories from a specified category",
  {
    category: z.string().min(1, { message: 'Category must not be empty' }),
    is_global: z.boolean().default(false)
  },
  async ({ category, is_global }) => {
    try {
      const baseDir = is_global ? appDirs.global : appDirs.local;
      
      if (category === '*') {
        const memories: Record<string, string[]> = {};
        
        if (await fs.pathExists(baseDir)) {
          const files = await fs.readdir(baseDir);
          for (const file of files) {
            if (file.endsWith('.txt')) {
              const categoryName = file.replace('.txt', '');
              const categoryMemories = await retrieveCategory(categoryName, is_global);
              if (Object.values(categoryMemories).length > 0) {
                memories[categoryName] = Object.values(categoryMemories).flat();
              }
            }
          }
        }
        
        logger.info(`Retrieved all memories, global: ${is_global}`);
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(memories, null, 2)
            }
          ]
        };
      } else {
        const memories = await retrieveCategory(category, is_global);
        
        logger.info(`Retrieved memories for category: ${category}, global: ${is_global}`);
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(memories, null, 2)
            }
          ]
        };
      }
    } catch (error) {
      logger.error(`Failed to retrieve memories: ${error}`);
      return {
        content: [
          {
            type: "text",
            text: `Error: ${error instanceof Error ? error.message : String(error)}`
          }
        ],
        isError: true
      };
    }
  }
);

server.tool(
  "remove_memory_category",
  "Removes all memories within a specified category",
  {
    category: z.string().min(1, { message: 'Category must not be empty' }),
    is_global: z.boolean().default(false)
  },
  async ({ category, is_global }) => {
    try {
      const baseDir = is_global ? appDirs.global : appDirs.local;
      
      if (category === '*') {
        if (await fs.pathExists(baseDir)) {
          await fs.emptyDir(baseDir);
        }
        
        logger.info(`Cleared all memory categories, global: ${is_global}`);
        
        return {
          content: [
            {
              type: "text",
              text: `Cleared all ${is_global ? 'global' : 'local'} memory categories`
            }
          ]
        };
      } else {
        const memoryFilePath = path.join(baseDir, `${category}.txt`);
        if (await fs.pathExists(memoryFilePath)) {
          await fs.remove(memoryFilePath);
        }
        
        logger.info(`Cleared memories in category: ${category}, global: ${is_global}`);
        
        return {
          content: [
            {
              type: "text",
              text: `Cleared memories in category: ${category}`
            }
          ]
        };
      }
    } catch (error) {
      logger.error(`Failed to remove memory category: ${error}`);
      return {
        content: [
          {
            type: "text",
            text: `Error: ${error instanceof Error ? error.message : String(error)}`
          }
        ],
        isError: true
      };
    }
  }
);

server.tool(
  "remove_specific_memory",
  "Removes a specific memory within a specified category",
  {
    category: z.string().min(1, { message: 'Category must not be empty' }),
    memory_content: z.string().min(1, { message: 'Memory content must not be empty' }),
    is_global: z.boolean().default(false)
  },
  async ({ category, memory_content, is_global }) => {
    try {
      const baseDir = is_global ? appDirs.global : appDirs.local;
      const memoryFilePath = path.join(baseDir, `${category}.txt`);
      
      if (await fs.pathExists(memoryFilePath)) {
        const content = await fs.readFile(memoryFilePath, 'utf-8');
        const memories = content.split('\n\n');
        const newContent = memories
          .filter(memory => !memory.includes(memory_content))
          .join('\n\n');
        
        await fs.writeFile(memoryFilePath, newContent);
      }
      
      logger.info(`Removed specific memory from category: ${category}, global: ${is_global}`);
      
      return {
        content: [
          {
            type: "text",
            text: `Removed specific memory from category: ${category}`
          }
        ]
      };
    } catch (error) {
      logger.error(`Failed to remove specific memory: ${error}`);
      return {
        content: [
          {
            type: "text",
            text: `Error: ${error instanceof Error ? error.message : String(error)}`
          }
        ],
        isError: true
      };
    }
  }
);

async function retrieveCategory(category: string, isGlobal: boolean): Promise<Record<string, string[]>> {
  const baseDir = isGlobal ? appDirs.global : appDirs.local;
  const memoryFilePath = path.join(baseDir, `${category}.txt`);
  
  if (!await fs.pathExists(memoryFilePath)) {
    return {};
  }
  
  const content = await fs.readFile(memoryFilePath, 'utf-8');
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
}

const transport = new StdioServerTransport();
await server.connect(transport);
logger.info("MCP Memory Server ready");
