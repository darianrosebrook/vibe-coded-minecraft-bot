'use client';

import React from 'react';
import { useState } from 'react';
import { io } from 'socket.io-client';

interface CommandExample {
  name: string;
  description: string;
  example: string;
  category: string;
}

const commandExamples: CommandExample[] = [
  {
    name: 'Mining Task',
    description: 'Make the bot mine specific blocks',
    example: 'mine diamond_ore 64',
    category: 'Resource Gathering'
  },
  {
    name: 'Farming Task',
    description: 'Make the bot farm crops',
    example: 'farm wheat harvest',
    category: 'Resource Gathering'
  },
  {
    name: 'Navigation',
    description: 'Make the bot move to specific coordinates',
    example: 'goto 100 64 -200',
    category: 'Movement'
  },
  {
    name: 'Inventory Management',
    description: 'Sort or manage bot inventory',
    example: 'inventory sort',
    category: 'Utility'
  },
  {
    name: 'Query World',
    description: 'Get information about blocks or entities',
    example: 'query block diamond_ore',
    category: 'Information'
  },
  {
    name: 'Redstone Task',
    description: 'Work with redstone circuits',
    example: 'redstone build basic',
    category: 'Building'
  }
];

export default function Commands() {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const categories = ['all', ...new Set(commandExamples.map(cmd => cmd.category))];

  const filteredCommands = selectedCategory === 'all' 
    ? commandExamples 
    : commandExamples.filter(cmd => cmd.category === selectedCategory);

  const executeCommand = async (command: string) => {
    const socket = io();
    socket.emit('bot:command', command);
    socket.close();
  };

  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Available Commands</h2>
        
        {/* Category Filter */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Filter by Category
          </label>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
          >
            {categories.map((category) => (
              <option key={category} value={category}>
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </option>
            ))}
          </select>
        </div>

        {/* Command List */}
        <div className="grid gap-6">
          {filteredCommands.map((cmd, index) => (
            <div key={index} className="border rounded-lg p-4 hover:bg-gray-50">
              <h3 className="text-lg font-medium text-gray-900">{cmd.name}</h3>
              <p className="mt-1 text-sm text-gray-500">{cmd.description}</p>
              <div className="mt-4 flex items-center justify-between">
                <code className="text-sm bg-gray-100 rounded px-2 py-1">
                  {cmd.example}
                </code>
                <button
                  onClick={() => executeCommand(cmd.example)}
                  className="ml-4 inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Execute
                </button>
              </div>
              <div className="mt-2">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                  {cmd.category}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
} 