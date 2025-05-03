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

export default function Home() {
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
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Bot Status */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Bot Status</h2>
        {status ? (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-gray-500">Health</h3>
              <div className="mt-1 relative pt-1">
                <div className="overflow-hidden h-2 text-xs flex rounded bg-red-200">
                  <div
                    style={{ width: `${(status.health / 20) * 100}%` }}
                    className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-red-500"
                  />
                </div>
                <span className="text-sm text-gray-600 mt-1">{status.health}/20</span>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500">Food</h3>
              <div className="mt-1 relative pt-1">
                <div className="overflow-hidden h-2 text-xs flex rounded bg-yellow-200">
                  <div
                    style={{ width: `${(status.food / 20) * 100}%` }}
                    className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-yellow-500"
                  />
                </div>
                <span className="text-sm text-gray-600 mt-1">{status.food}/20</span>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500">Position</h3>
              <p className="text-sm text-gray-600">
                X: {status.position.x.toFixed(2)}, Y: {status.position.y.toFixed(2)}, Z: {status.position.z.toFixed(2)}
              </p>
            </div>
            {status.activeTask && (
              <div>
                <h3 className="text-sm font-medium text-gray-500">Active Task</h3>
                <div className="mt-1">
                  <p className="text-sm text-gray-600">{status.activeTask.name}</p>
                  <div className="mt-1 relative pt-1">
                    <div className="overflow-hidden h-2 text-xs flex rounded bg-blue-200">
                      <div
                        style={{ width: `${status.activeTask.progress}%` }}
                        className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-blue-500"
                      />
                    </div>
                    <span className="text-sm text-gray-600 mt-1">{status.activeTask.progress}%</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-gray-500">Loading status...</p>
        )}
      </div>

      {/* 3D Viewer */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">World View</h2>
        <div id="viewer" className="w-full h-96 bg-gray-100 rounded">
          {/* prismarine-viewer will be mounted here */}
        </div>
      </div>

      {/* Inventory */}
      <div className="bg-white shadow rounded-lg p-6 md:col-span-2">
        <h2 className="text-lg font-semibold mb-4">Inventory</h2>
        {status?.inventory ? (
          <div className="grid grid-cols-9 gap-2">
            {status.inventory.map((item, index) => (
              <div key={index} className="bg-gray-100 p-2 rounded text-center">
                {item ? (
                  <>
                    <p className="text-sm font-medium">{item.name}</p>
                    <p className="text-xs text-gray-500">x{item.count}</p>
                  </>
                ) : (
                  <p className="text-xs text-gray-400">Empty</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500">Loading inventory...</p>
        )}
      </div>
    </div>
  );
} 