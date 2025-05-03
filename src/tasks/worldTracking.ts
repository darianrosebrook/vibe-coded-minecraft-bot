import { BaseTask } from './base';
import { IDataCollector } from '@/types/ml/interfaces';
import { WorldMetrics } from '@/types/metrics';
import { PerformanceTracker } from '@/utils/observability/performance';
import { MinecraftBot } from '@/bot/bot';
import { CommandHandler } from '@/commands';
import { TaskResult, Task, TaskParameters, RedstoneTaskParameters } from '@/types/task';
import { BaseTaskOptions } from './base';

export class WorldTracking extends BaseTask {
    private worldMetrics: WorldMetrics;
    protected override performanceTracker: PerformanceTracker;
    protected override dataCollector: IDataCollector;

    constructor(
        bot: MinecraftBot,
        commandHandler: CommandHandler,
        dataCollector: IDataCollector
    ) {
        const options: RedstoneTaskParameters = {
            circuitType: 'monitoring',
            radius: 16,
            useML: true,
            usePathfinding: true
        };
        super(bot, commandHandler, options);
        this.worldMetrics = new WorldMetrics();
        this.performanceTracker = new PerformanceTracker();
        this.dataCollector = dataCollector;
    }

    protected getTaskSpecificState(): any {
        return {
            worldMetrics: this.worldMetrics.getState(),
            performanceMetrics: this.performanceTracker.getMetrics()
        };
    }

    public override async execute(task: Task | null, taskId: string): Promise<TaskResult> {
        try {
            await this.collectMetrics();
            const state = this.getTaskSpecificState();
            return {
                success: true,
                data: state,
                duration: 0
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                duration: 0
            };
        }
    }

    private async collectMetrics(): Promise<void> {
        if (!this.bot) {
            throw new Error('Bot not initialized');
        }

        const mineflayerBot = this.bot.getMineflayerBot();
        if (!mineflayerBot || !mineflayerBot.entity) {
            throw new Error('Mineflayer bot or entity not initialized');
        }

        // Update metrics
        this.worldMetrics.update({
            position: mineflayerBot.entity.position,
            velocity: mineflayerBot.entity.velocity,
            yaw: mineflayerBot.entity.yaw,
            pitch: mineflayerBot.entity.pitch,
            onGround: mineflayerBot.entity.onGround,
            isInWater: false, // Not directly accessible from mineflayer
            isInLava: false, // Not directly accessible from mineflayer
            isInWeb: false, // Not directly accessible from mineflayer
            isCollidedHorizontally: false, // Not directly accessible from mineflayer
            isCollidedVertically: false // Not directly accessible from mineflayer
        });

        // Report metrics
        await this.dataCollector.recordPrediction(
            'world_metrics',
            this.worldMetrics.getState(),
            null,
            true,
            1.0,
            0
        );

        await this.dataCollector.recordPrediction(
            'performance_metrics',
            this.performanceTracker.getMetrics(),
            null,
            true,
            1.0,
            0
        );
    }
} 