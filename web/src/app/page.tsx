'use client';

import React, { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { TaskResult } from '@/types/task';

interface BotStatus {
  isConnected: boolean;
  position: { x: number; y: number; z: number };
  health: number;
  food: number;
  inventory: Array<{ name: string; count: number }>;
}

export default function Home() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [status, setStatus] = useState<string>('disconnected');
  const [tasks, setTasks] = useState<TaskResult[]>([]);
  const [message, setMessage] = useState<string>('');
  const [botStatus, setBotStatus] = useState<BotStatus | null>(null);

  useEffect(() => {
    const newSocket = io('http://localhost:3000');
    setSocket(newSocket);

    newSocket.on('connect', () => {
      setStatus('connected');
      newSocket.emit('requestBotStatus');
    });

    newSocket.on('disconnect', () => {
      setStatus('disconnected');
      setBotStatus(null);
    });

    newSocket.on('botStatus', (status: BotStatus) => {
      setBotStatus(status);
    });

    newSocket.on('taskResult', (result: TaskResult) => {
      setTasks((prevTasks) => [...prevTasks, result]);
    });

    newSocket.on('error', (error: { message: string }) => {
      console.error('Socket error:', error);
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (socket && message.trim()) {
      socket.emit('botCommand', message);
      setMessage('');
    }
  };

  return (
    <main className="min-h-screen p-8">
      <h1 className="text-3xl font-bold mb-8">Minecraft Bot Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Status</h2>
          <p>Connection: {status}</p>
          {botStatus && (
            <div className="mt-4">
              <p>Position: X: {botStatus.position.x}, Y: {botStatus.position.y}, Z: {botStatus.position.z}</p>
              <p>Health: {botStatus.health}</p>
              <p>Food: {botStatus.food}</p>
            </div>
          )}
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Tasks</h2>
          <ul className="space-y-2">
            {tasks.map((task, index) => (
              <li key={index} className={`p-2 rounded ${task.success ? 'bg-green-100' : 'bg-red-100'}`}>
                <p>Type: {task.task.type}</p>
                <p>Status: {task.task.status}</p>
                {task.error && <p className="text-red-600">Error: {task.error}</p>}
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-white p-6 rounded-lg shadow col-span-2">
          <h2 className="text-xl font-semibold mb-4">Command Input</h2>
          <form onSubmit={handleSubmit} className="flex gap-4">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="flex-1 p-2 border rounded"
              placeholder="Enter a command..."
            />
            <button type="submit" className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
              Send
            </button>
          </form>
        </div>
      </div>
    </main>
  );
} 