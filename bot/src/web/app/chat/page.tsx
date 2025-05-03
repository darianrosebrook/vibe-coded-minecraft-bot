'use client';

import React from 'react';
import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { ChatCommand } from '../../../types/ml/command';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";

interface Message {
  role: 'user' | 'assistant' | 'system' | 'bot';
  content: string;
  timestamp: number;
  isCommand?: boolean;
}

interface BotStatus {
  isConnected: boolean;
  position: { x: number; y: number; z: number };
  health: number;
  food: number;
  inventory: Array<{ name: string; count: number }>;
}

interface TaskResult {
  task: {
    type: string;
    status: string;
  };
  success: boolean;
  error?: string;
}

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [botStatus, setBotStatus] = useState<BotStatus | null>(null);
  const [tasks, setTasks] = useState<TaskResult[]>([]);
  const [activeTab, setActiveTab] = useState('chat');

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

    newSocket.on('chat:command', (command: ChatCommand) => {
      setMessages(prev => [...prev, {
        role: 'system',
        content: `Executing command: ${command.message}`,
        timestamp: Date.now(),
        isCommand: true
      }]);
    });

    newSocket.on('chat:bot', (response: { content: string; timestamp: number }) => {
      setMessages(prev => [...prev, {
        role: 'bot',
        content: response.content,
        timestamp: response.timestamp
      }]);
    });

    newSocket.on('chat:error', (error: { message: string }) => {
      setMessages(prev => [...prev, {
        role: 'system',
        content: `Error: ${error.message}`,
        timestamp: Date.now()
      }]);
      setIsLoading(false);
    });

    newSocket.on('bot:status', (status: BotStatus) => {
      setBotStatus(status);
    });

    newSocket.on('task:result', (result: TaskResult) => {
      setTasks(prev => [...prev, result]);
      setMessages(prev => [...prev, {
        role: 'system',
        content: `Task ${result.task.type} ${result.success ? 'completed' : 'failed'}: ${result.task.status}`,
        timestamp: Date.now()
      }]);
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
      timestamp: Date.now(),
      isCommand: input.startsWith('!')
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    if (input.startsWith('!')) {
      socket.emit('bot:command', input.slice(1).trim());
    } else {
      socket.emit('chat:message', input);
    }
  };

  const getAvatarFallback = (role: Message['role']) => {
    switch (role) {
      case 'user':
        return 'U';
      case 'assistant':
        return 'A';
      case 'bot':
        return 'B';
      case 'system':
        return 'S';
      default:
        return '?';
    }
  };

  const getRoleColor = (role: Message['role']) => {
    switch (role) {
      case 'user':
        return 'bg-primary text-primary-foreground';
      case 'assistant':
        return 'bg-secondary text-secondary-foreground';
      case 'bot':
        return 'bg-green-500 text-white';
      case 'system':
        return 'bg-yellow-500 text-white';
      default:
        return 'bg-gray-500 text-white';
    }
  };

  return (
    <div className="h-[calc(100vh-12rem)]">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="chat">Chat</TabsTrigger>
          <TabsTrigger value="status">Status</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
        </TabsList>

        <TabsContent value="chat" className="h-[calc(100%-3rem)]">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Chat with Bot</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col h-full">
              <ScrollArea className="flex-1 mb-4">
                <div className="space-y-4">
                  {messages.map((msg, index) => (
                    <div
                      key={index}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} items-start gap-2`}
                    >
                      {msg.role !== 'user' && (
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>{getAvatarFallback(msg.role)}</AvatarFallback>
                        </Avatar>
                      )}
                      <div className={`max-w-[70%] rounded-lg px-4 py-2 ${getRoleColor(msg.role)}`}>
                        <p className="text-sm">{msg.content}</p>
                        <p className="text-xs mt-1 opacity-70">
                          {new Date(msg.timestamp).toLocaleTimeString()}
                        </p>
                        {msg.isCommand && (
                          <Badge variant="secondary" className="mt-1">
                            Command
                          </Badge>
                        )}
                      </div>
                      {msg.role === 'user' && (
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>U</AvatarFallback>
                        </Avatar>
                      )}
                    </div>
                  ))}
                  {isLoading && (
                    <div className="flex justify-start items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>A</AvatarFallback>
                      </Avatar>
                      <div className="bg-secondary text-secondary-foreground rounded-lg px-4 py-2">
                        <div className="flex space-x-2">
                          <div className="w-2 h-2 bg-current rounded-full animate-bounce" />
                          <div className="w-2 h-2 bg-current rounded-full animate-bounce delay-100" />
                          <div className="w-2 h-2 bg-current rounded-full animate-bounce delay-200" />
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              <form onSubmit={handleSubmit} className="flex gap-2">
                <Input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Type your message or command (start with ! for commands)..."
                  disabled={isLoading}
                />
                <Button type="submit" disabled={isLoading}>
                  Send
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="status" className="h-[calc(100%-3rem)]">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Bot Status</CardTitle>
            </CardHeader>
            <CardContent>
              {botStatus ? (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Position</h3>
                    <p>X: {botStatus.position.x.toFixed(2)}</p>
                    <p>Y: {botStatus.position.y.toFixed(2)}</p>
                    <p>Z: {botStatus.position.z.toFixed(2)}</p>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Health</h3>
                    <Progress value={botStatus.health * 5} className="w-full" />
                    <p className="text-sm mt-1">{botStatus.health}/20</p>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Food</h3>
                    <Progress value={botStatus.food * 5} className="w-full" />
                    <p className="text-sm mt-1">{botStatus.food}/20</p>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Inventory</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {botStatus.inventory.map((item, index) => (
                        <div key={index} className="bg-secondary p-2 rounded">
                          <p className="text-sm">{item.name}</p>
                          <p className="text-xs opacity-70">Count: {item.count}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <p>Waiting for bot status...</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tasks" className="h-[calc(100%-3rem)]">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Task History</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[calc(100%-4rem)]">
                <div className="space-y-2">
                  {tasks.map((task, index) => (
                    <div
                      key={index}
                      className={`p-4 rounded-lg ${
                        task.success ? 'bg-green-100' : 'bg-red-100'
                      }`}
                    >
                      <h3 className="font-semibold">{task.task.type}</h3>
                      <p className="text-sm">Status: {task.task.status}</p>
                      {task.error && (
                        <p className="text-sm text-red-600 mt-1">Error: {task.error}</p>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
} 