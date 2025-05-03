# Web Dashboard

This directory contains the web interface for monitoring and controlling the Minecraft bot.

## Components

### `server.ts`
- Express server setup
- API route configuration
- Middleware management
- Error handling

### `routes/`
- REST API endpoints
- WebSocket handlers
- Authentication routes
- Task management endpoints

### `sockets/`
- Real-time communication
- Event broadcasting
- Client connection management
- Message handling

### `public/`
- Static assets
- Frontend application
- CSS styles
- JavaScript bundles

## Features

- Real-time bot status monitoring
- Task management interface
- Inventory visualization
- World map display
- Chat interface
- Configuration management
- Authentication system

## API Endpoints

### Bot Control
- `GET /api/bot/status` - Get bot status
- `POST /api/bot/command` - Send command to bot
- `GET /api/bot/inventory` - Get bot inventory

### Task Management
- `GET /api/tasks` - List active tasks
- `POST /api/tasks` - Create new task
- `DELETE /api/tasks/:id` - Cancel task
- `GET /api/tasks/:id` - Get task status

### Configuration
- `GET /api/config` - Get current configuration
- `PUT /api/config` - Update configuration
- `GET /api/config/schema` - Get configuration schema

## WebSocket Events

### Bot Events
- `bot:status` - Bot status updates
- `bot:position` - Position updates
- `bot:inventory` - Inventory changes
- `bot:chat` - Chat messages

### Task Events
- `task:created` - New task created
- `task:updated` - Task status update
- `task:completed` - Task completion
- `task:failed` - Task failure

## Usage

```typescript
import express from 'express';
import { createServer } from './server';
import { setupWebSocket } from './sockets';

const app = express();
const server = createServer(app);
setupWebSocket(server);

server.listen(3000, () => {
  console.log('Web dashboard running on port 3000');
});
```

## Dependencies

- `express` - Web server
- `socket.io` - Real-time communication
- `winston` - Logging
- `zod` - Configuration validation 