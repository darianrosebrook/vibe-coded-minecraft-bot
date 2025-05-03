'use client';

import React from 'react';
import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

interface BotStatus {
  health: number;
  food: number;
  position: { x: number; y: number; z: number };
  inventory: any[];
  activeTask: { name: string; progress: number } | null;
}

export default function Page() {
  const [status, setStatus] = useState<BotStatus | null>(null);
  const [socket, setSocket] = useState<any>(null);

  useEffect(() => {
    const newSocket = io();
    setSocket(newSocket);

    newSocket.on('bot:status', (data: BotStatus) => {
      setStatus(data);
    });

    // Request initial status
    newSocket.emit('bot:requestStatus');

    // Set up interval to request status updates
    const interval = setInterval(() => {
      newSocket.emit('bot:requestStatus');
    }, 1000);

    return () => {
      clearInterval(interval);
      newSocket.close();
    };
  }, []);

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-4xl font-bold mb-4">Minecraft Bot Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="text-xl font-semibold mb-2">Bot Status</h2>
          <p>Status: Online</p>
          <p>Position: X: 0, Y: 0, Z: 0</p>
          <p>Health: 20/20</p>
          <p>Food: 20/20</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="text-xl font-semibold mb-2">Current Task</h2>
          <p>Type: None</p>
          <p>Progress: 0%</p>
          <p>Status: Idle</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="text-xl font-semibold mb-2">Inventory</h2>
          <p>Empty</p>
        </div>
      </div>
    </div>
  );
} 