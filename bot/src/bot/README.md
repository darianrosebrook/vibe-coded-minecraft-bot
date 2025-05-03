# Bot Core

This directory contains the core bot functionality and initialization code for the Minecraft bot.

## Key Components

### `bot.ts`
- Main bot class implementation
- Bot initialization and connection handling
- Event listener setup
- Core bot state management

### `toolManager.ts`
- Tool selection and management
- Tool durability tracking
- Automatic tool switching
- Tool repair handling

### `worldAwareness.ts`
- World mapping and resource tracking
- Block position tracking
- Resource discovery
- Biome analysis
- Chunk caching

## Features

- Automatic reconnection handling
- State persistence
- Event-driven architecture
- Real-time world state tracking
- Resource management
- Tool optimization

## Usage

The bot core is initialized with configuration from the `config` directory and integrates with various modules:

```typescript
import { Bot } from './bot';

const bot = new Bot({
  host: 'localhost',
  port: 25565,
  username: 'bot',
  // ... other configuration
});

bot.on('spawn', () => {
  console.log('Bot spawned successfully');
});
```

## Dependencies

- `mineflayer` - Core bot framework
- `mineflayer-pathfinder` - Navigation
- `prismarine-world` - World handling
- `prismarine-entity` - Entity management 