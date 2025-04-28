# MCP Memory Server

A server that uses the Model Context Protocol (MCP) to manage memory storage for AI agents.

## Overview

MCP Memory Server provides a way for AI agents to store, retrieve, and manage memories across sessions. It implements the Model Context Protocol (MCP) to provide a standardized interface for memory operations.

## Features

- Store memories with optional tags in categories
- Retrieve memories by category
- Remove entire memory categories
- Remove specific memories
- Support for both local and global memory storage

## Installation

```bash
npm install -g @mkusaka/mcp-memory-server
```

## Usage

### Command Line

```bash
mcp-memory
```

### Integration with MCP Clients

The server can be used with any MCP client that supports the Model Context Protocol. It exposes the following tools:

- `remember_memory`: Store a memory with optional tags in a specified category
- `retrieve_memories`: Retrieve all memories from a specified category
- `remove_memory_category`: Remove all memories within a specified category
- `remove_specific_memory`: Remove a specific memory within a specified category

## Memory Storage

Memories are stored in text files organized by category:

- Local memories: `./.goose/memory/`
- Global memories: `~/.config/goose/memory/`

Each category is stored in a separate file with the format `<category>.txt`.

## Example

```javascript
// Example of using the memory server with an MCP client
const result = await client.callTool("remember_memory", {
  category: "preferences",
  data: "I prefer dark mode",
  tags: ["ui", "theme"],
  is_global: true
});

const memories = await client.callTool("retrieve_memories", {
  category: "preferences",
  is_global: true
});
```

## Development

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run the server
npm start

# Test with MCP Inspector
npm run inspect
```

## License

MIT
