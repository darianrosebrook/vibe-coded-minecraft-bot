'use client';

import React from 'react';
import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [socket, setSocket] = useState<any>(null);

  useEffect(() => {
    const newSocket = io();
    setSocket(newSocket);

    newSocket.on('chat:response', (message: string) => {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: message,
        timestamp: Date.now()
      }]);
      setIsLoading(false);
    });

    return () => {
      newSocket.close();
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !socket) return;

    const userMessage: Message = {
      role: 'user',
      content: input,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    socket.emit('chat:message', input);
  };

  return (
    <div className="bg-white shadow rounded-lg p-6 h-[calc(100vh-12rem)]">
      <h2 className="text-lg font-semibold mb-4">Chat with Bot</h2>
      
      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto mb-4 h-[calc(100%-8rem)]">
        <div className="space-y-4">
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[70%] rounded-lg px-4 py-2 ${
                  msg.role === 'user'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-900'
                }`}
              >
                <p className="text-sm">{msg.content}</p>
                <p className="text-xs mt-1 opacity-70">
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-lg px-4 py-2">
                <div className="flex space-x-2">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100" />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200" />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="mt-4">
        <div className="flex space-x-4">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
} 