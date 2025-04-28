import { Bot } from 'mineflayer';
import { CommandExecutionResult, ResourceUsage, WorldState } from '@/types';
import { performance } from 'perf_hooks';
import { Biome } from 'prismarine-biome';
import { EnhancedGameState } from '@/types';

export class MLDataCollector {
    private bot: Bot;
    private commandHistory: CommandExecutionResult[];
    private stateHistory: WorldState[];
    private resourceHistory: ResourceUsage[];
    private readonly maxHistorySize: number;

    constructor(bot: Bot, maxHistorySize: number = 10000) {
        this.bot = bot;
        this.commandHistory = [];
        this.stateHistory = [];
        this.resourceHistory = [];
        this.maxHistorySize = maxHistorySize;
    }

    public async startCollecting(): Promise<void> {
        // Start collecting data at regular intervals
        setInterval(() => this.collectStateData(), 1000);
        setInterval(() => this.collectResourceData(), 5000);
    }

    public async logCommandExecution(result: CommandExecutionResult): Promise<void> {
        // Add command execution result to history
        this.commandHistory.push(result);
        
        // Trim history if needed
        if (this.commandHistory.length > this.maxHistorySize) {
            this.commandHistory = this.commandHistory.slice(-this.maxHistorySize);
        }
    }

    private async collectStateData(): Promise<void> {
        const biomeId = this.bot.world.getBiome(this.bot.entity.position);
        const biome = new Biome(biomeId);
        const worldState: WorldState = {
            biome: biome.name,
            timeOfDay: this.bot.time.timeOfDay,
            weather: this.bot.isRaining ? 'rain' : 'clear',
            nearbyEntities: Object.values(this.bot.entities)
                .filter(entity => entity.position.distanceTo(this.bot.entity.position) < 16)
                .map(entity => ({
                    type: entity.name || 'unknown',
                    position: entity.position,
                    health: entity.health
                })),
            nearbyBlocks: this.bot.findBlocks({
                matching: block => true,
                maxDistance: 16,
                count: 100
            }).map(block => ({
                type: this.bot.blockAt(block)?.name || 'unknown',
                position: block
            }))
        };

        this.stateHistory.push(worldState);
        
        // Trim history if needed
        if (this.stateHistory.length > this.maxHistorySize) {
            this.stateHistory = this.stateHistory.slice(-this.maxHistorySize);
        }
    }

    private async collectResourceData(): Promise<void> {
        const startTime = performance.now();
        
        // Collect CPU usage
        const cpuUsage = process.cpuUsage();
        const memoryUsage = process.memoryUsage();
        
        const resourceUsage: ResourceUsage = {
            cpu: {
                average: cpuUsage.user / 1000000, // Convert to percentage
                peak: cpuUsage.system / 1000000,
                duration: performance.now() - startTime
            },
            memory: {
                average: memoryUsage.heapUsed / 1024 / 1024, // Convert to MB
                peak: memoryUsage.heapTotal / 1024 / 1024,
                leaks: memoryUsage.external / 1024 / 1024
            },
            network: {
                bytesSent: 0, // These would need to be tracked separately
                bytesReceived: 0,
                latency: 0
            }
        };

        this.resourceHistory.push(resourceUsage);
        
        // Trim history if needed
        if (this.resourceHistory.length > this.maxHistorySize) {
            this.resourceHistory = this.resourceHistory.slice(-this.maxHistorySize);
        }
    }

    public getCommandHistory(): CommandExecutionResult[] {
        return [...this.commandHistory];
    }

    public getStateHistory(): WorldState[] {
        return [...this.stateHistory];
    }

    public getResourceHistory(): ResourceUsage[] {
        return [...this.resourceHistory];
    }

    public async exportData(format: 'json' | 'csv' = 'json'): Promise<string> {
        const data = {
            commands: this.commandHistory,
            states: this.stateHistory,
            resources: this.resourceHistory
        };

        if (format === 'json') {
            return JSON.stringify(data, null, 2);
        } else {
            // Convert to CSV format
            let csv = 'timestamp,command,success,execution_time,cpu_usage,memory_usage\n';
            
            for (const cmd of this.commandHistory) {
                const resource = this.resourceHistory.find(r => 
                    Math.abs(r.cpu.duration - (cmd.endTime - cmd.startTime)) < 1000
                );
                
                csv += `${cmd.startTime},${cmd.command},${cmd.success},${cmd.endTime - cmd.startTime},` +
                       `${resource?.cpu.average || 0},${resource?.memory.average || 0}\n`;
            }
            
            return csv;
        }
    }

    public clearHistory(): void {
        this.commandHistory = [];
        this.stateHistory = [];
        this.resourceHistory = [];
    }
} 