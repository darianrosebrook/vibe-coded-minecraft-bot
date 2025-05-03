import { Server } from 'socket.io';
import { setupSocketHandlers } from './handlers';
import { setupMLSocketHandlers } from './mlHandlers';

export function setupSocketServer(io: Server) {
  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // Setup regular socket handlers
    setupSocketHandlers(io, socket);

    // Setup ML socket handlers
    setupMLSocketHandlers(io, socket);

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });
} 