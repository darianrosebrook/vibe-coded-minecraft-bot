'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { socket, initSocket } from '@/lib/socket';
import {
  TrainingMetrics,
  ResourceUsage,
  CommandMetrics,
  ModelConfig,
  TrainingDataStats,
  MLMetrics
} from '@/types/ml';
import dynamic from 'next/dynamic';

// Dynamically import recharts components to fix SSR issues
const LineChart = dynamic(() => import('recharts').then(mod => mod.LineChart), { ssr: false });
const Line = dynamic(() => import('recharts').then(mod => mod.Line), { ssr: false });
const XAxis = dynamic(() => import('recharts').then(mod => mod.XAxis), { ssr: false });
const YAxis = dynamic(() => import('recharts').then(mod => mod.YAxis), { ssr: false });
const CartesianGrid = dynamic(() => import('recharts').then(mod => mod.CartesianGrid), { ssr: false });
const Tooltip = dynamic(() => import('recharts').then(mod => mod.Tooltip), { ssr: false });
const Legend = dynamic(() => import('recharts').then(mod => mod.Legend), { ssr: false });
const ResponsiveContainer = dynamic(() => import('recharts').then(mod => mod.ResponsiveContainer), { ssr: false });
const PieChart = dynamic(() => import('recharts').then(mod => mod.PieChart), { ssr: false });
const Pie = dynamic(() => import('recharts').then(mod => mod.Pie), { ssr: false });
const Cell = dynamic(() => import('recharts').then(mod => mod.Cell), { ssr: false });

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export default function MLDashboard() {
  const [activeTab, setActiveTab] = useState('training');
  const [trainingMetrics, setTrainingMetrics] = useState<TrainingMetrics[]>([]);
  const [resourceUsage, setResourceUsage] = useState<ResourceUsage[]>([]);
  const [commandMetrics, setCommandMetrics] = useState<CommandMetrics[]>([]);
  const [modelConfig, setModelConfig] = useState<ModelConfig | null>(null);
  const [trainingStats, setTrainingStats] = useState<TrainingDataStats | null>(null);
  const [currentEpoch, setCurrentEpoch] = useState(0);
  const [totalEpochs, setTotalEpochs] = useState(0);
  const [modelAccuracy, setModelAccuracy] = useState(0);
  const [isTraining, setIsTraining] = useState(false);
  const [epochs, setEpochs] = useState(100);
  const [batchSize, setBatchSize] = useState(32);

  useEffect(() => {
    // Initialize socket connection
    initSocket();

    // Connect to ML metrics socket
    socket.on('ml:metrics', (data: MLMetrics) => {
      switch (data.type) {
        case 'training':
          const trainingData = data.data as TrainingMetrics;
          setCurrentEpoch(trainingData.epoch);
          setModelAccuracy(trainingData.accuracy);
          setTrainingMetrics(prev => [...prev, trainingData].slice(-100));
          break;
        case 'resources':
          const resourceData = data.data as ResourceUsage;
          setResourceUsage(prev => [...prev, resourceData].slice(-100));
          break;
        case 'commands':
          const commandData = data.data as CommandMetrics[];
          setCommandMetrics(commandData);
          break;
        case 'config':
          const configData = data.data as ModelConfig;
          setModelConfig(configData);
          break;
        case 'stats':
          const statsData = data.data as TrainingDataStats;
          setTrainingStats(statsData);
          break;
      }
    });

    socket.on('ml:train:complete', () => {
      setIsTraining(false);
    });

    socket.on('ml:train:error', (error: Error) => {
      setIsTraining(false);
      console.error('Training error:', error);
    });

    return () => {
      socket.off('ml:metrics');
      socket.off('ml:train:complete');
      socket.off('ml:train:error');
    };
  }, []);

  const handleTrain = () => {
    setIsTraining(true);
    socket.emit('ml:train', { epochs, batchSize });
  };

  const handlePause = () => {
    socket.emit('ml:pause');
  };

  const handleResume = () => {
    socket.emit('ml:resume');
  };

  const handleReset = () => {
    socket.emit('ml:reset');
  };

  return (
    <div className="h-[calc(100vh-12rem)]">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="training">Training</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="commands">Commands</TabsTrigger>
          <TabsTrigger value="config">Configuration</TabsTrigger>
          <TabsTrigger value="stats">Statistics</TabsTrigger>
        </TabsList>

        <TabsContent value="training" className="h-[calc(100%-3rem)]">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Model Training</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="epochs">Epochs</Label>
                  <Input
                    id="epochs"
                    type="number"
                    value={epochs}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEpochs(Number(e.target.value))}
                    disabled={isTraining}
                  />
                </div>
                <div>
                  <Label htmlFor="batchSize">Batch Size</Label>
                  <Input
                    id="batchSize"
                    type="number"
                    value={batchSize}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBatchSize(Number(e.target.value))}
                    disabled={isTraining}
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleTrain} disabled={isTraining}>
                  Start Training
                </Button>
                <Button onClick={handlePause} disabled={!isTraining}>
                  Pause
                </Button>
                <Button onClick={handleResume} disabled={!isTraining}>
                  Resume
                </Button>
                <Button onClick={handleReset} variant="destructive">
                  Reset Model
                </Button>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">Training Progress</h3>
                <div className="space-y-2">
                  <p className="text-sm">Epoch {currentEpoch} of {totalEpochs}</p>
                  <Progress value={(currentEpoch / totalEpochs) * 100} />
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">Model Accuracy</h3>
                <div className="space-y-2">
                  <p className="text-sm">{modelAccuracy.toFixed(2)}%</p>
                  <Progress value={modelAccuracy} />
                </div>
              </div>

              <div className="h-[400px]">
                <h3 className="text-lg font-semibold mb-2">Training Metrics</h3>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trainingMetrics}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="epoch" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="loss" stroke="#8884d8" />
                    <Line type="monotone" dataKey="accuracy" stroke="#82ca9d" />
                    <Line type="monotone" dataKey="validationLoss" stroke="#ffc658" />
                    <Line type="monotone" dataKey="validationAccuracy" stroke="#ff7300" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="h-[calc(100%-3rem)]">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Resource Usage</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={resourceUsage}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="timestamp" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="cpu" stroke="#8884d8" />
                    <Line type="monotone" dataKey="memory" stroke="#82ca9d" />
                    <Line type="monotone" dataKey="network" stroke="#ffc658" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="commands" className="h-[calc(100%-3rem)]">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Command Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[calc(100%-2rem)]">
                <div className="space-y-4">
                  {commandMetrics.map((metric, index) => (
                    <div key={index} className="p-4 bg-secondary rounded-lg">
                      <h3 className="font-semibold">{metric.command}</h3>
                      <div className="grid grid-cols-3 gap-4 mt-2">
                        <div>
                          <p className="text-sm text-muted-foreground">Success Rate</p>
                          <p className="text-lg font-semibold">{(metric.successRate * 100).toFixed(1)}%</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Avg. Time</p>
                          <p className="text-lg font-semibold">{metric.averageExecutionTime.toFixed(2)}ms</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Total Executions</p>
                          <p className="text-lg font-semibold">{metric.totalExecutions}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="config" className="h-[calc(100%-3rem)]">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Model Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {modelConfig && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Learning Rate</h3>
                    <p className="text-sm">{modelConfig.learningRate}</p>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Batch Size</h3>
                    <p className="text-sm">{modelConfig.batchSize}</p>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Network Layers</h3>
                    <p className="text-sm">{modelConfig.layers.join(' → ')}</p>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Optimizer</h3>
                    <p className="text-sm">{modelConfig.optimizer}</p>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Loss Function</h3>
                    <p className="text-sm">{modelConfig.lossFunction}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stats" className="h-[calc(100%-3rem)]">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Training Statistics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {trainingStats && (
                <>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <h3 className="text-lg font-semibold mb-2">Total Samples</h3>
                      <p className="text-sm">{trainingStats.totalSamples}</p>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold mb-2">Average Reward</h3>
                      <p className="text-sm">{trainingStats.averageReward.toFixed(2)}</p>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold mb-2">Success Rate</h3>
                      <p className="text-sm">{(trainingStats.successRate * 100).toFixed(1)}%</p>
                    </div>
                  </div>

                  <div className="h-[400px]">
                    <h3 className="text-lg font-semibold mb-2">Action Distribution</h3>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={trainingStats.actionDistribution}
                          dataKey="count"
                          nameKey="action"
                          cx="50%"
                          cy="50%"
                          outerRadius={150}
                          label
                        >
                          {trainingStats.actionDistribution.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
} 