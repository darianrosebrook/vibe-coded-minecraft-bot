import { Bot } from 'mineflayer'; 
import { performance } from 'perf_hooks';
import { Biome } from 'prismarine-biome';
import { EnhancedGameState } from '@/types/ml/state';
import { ResourceUsage } from '@/ml/reinforcement/types';
import { CommandExecutionResult } from '@/ml/reinforcement/types';
import { WorldState } from '@/types/world/world';
import { PlayerState } from '@/types/ml/player';

export class MLDataCollector {
    private bot: Bot;
    private commandHistory: CommandExecutionResult[];
    private stateHistory: WorldState[];
    private playerStateHistory: PlayerState[];
    private resourceHistory: ResourceUsage[];
    private readonly maxHistorySize: number;

    constructor(bot: Bot, maxHistorySize: number = 10000) {
        this.bot = bot;
        this.commandHistory = [];
        this.stateHistory = [];
        this.playerStateHistory = [];
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
            time: this.bot.time.timeOfDay,
            weather: this.bot.isRaining ? 'rain' : 'clear',
            difficulty: this.bot.game.difficulty,
            gameMode: this.bot.game.gameMode,
            dimension: this.bot.game.dimension as "overworld" | "nether" | "end", 
        };
        const playerState: PlayerState = {
            position: this.bot.entity.position,
            health: this.bot.health || 0,
            food: this.bot.food || 0,
            inventory: this.bot.inventory.items().map(item => ({
                name: item.name,
                count: item.count,
                slot: item.slot
            })),
            experience: this.bot.experience,
            level: this.bot.experience.level,
            currentLocation: this.bot.entity.position,
            currentBiome: biome.name,
            activeTask: this.bot._activeTask?.name || '', // Using optional chaining with a custom property
            activeTaskProgress: this.bot._activeTaskProgress || 0, // Using optional chaining with a custom property
        };
        this.stateHistory.push(worldState);
        this.playerStateHistory.push(playerState);
        
        // Trim histories if needed
        if (this.stateHistory.length > this.maxHistorySize) {
            this.stateHistory = this.stateHistory.slice(-this.maxHistorySize);
        }
        if (this.playerStateHistory.length > this.maxHistorySize) {
            this.playerStateHistory = this.playerStateHistory.slice(-this.maxHistorySize);
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

    public getPlayerStateHistory(): PlayerState[] {
        return [...this.playerStateHistory];
    }

    public getResourceHistory(): ResourceUsage[] {
        return [...this.resourceHistory];
    }

    public async exportData(format: 'json' | 'csv' = 'json'): Promise<string> {
        const data = {
            commands: this.commandHistory,
            worldStates: this.stateHistory,
            playerStates: this.playerStateHistory,
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
        this.playerStateHistory = [];
        this.resourceHistory = [];
    }
} 