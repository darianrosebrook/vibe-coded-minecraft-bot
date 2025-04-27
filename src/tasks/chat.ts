import { BaseTask, TaskOptions } from './base';
import { MinecraftBot } from '../bot/bot';
import { CommandHandler } from '../commands';
import { Task, ChatTaskParameters } from '../types/task';
import logger from '../utils/observability/logger';
import { metrics } from '../utils/observability/metrics';
import { Bot as MineflayerBot } from 'mineflayer';
import { parseTask } from '../llm/parse';
import axios from 'axios';
import { NavigationTask } from './nav';
import { TaskType } from '../types/task';

interface BotState {
  position: { x: number; y: number; z: number };
  health: number;
  food: number;
  inventory: Array<{ name: string; count: number }>;
  biome?: string;
  isDay?: boolean;
  isRaining?: boolean;
  nearbyEntities?: Array<{
    type: string;
    name: string;
    distance: number;
    position: { x: number; y: number; z: number };
  }>;
}

const CHAT_SYSTEM_PROMPT = `You are a friendly Minecraft bot assistant. Your job is to respond to user messages in a helpful and engaging way, taking into account your current state and context.

When responding:
1. Always use first-person perspective (I, me, my) - you are the bot
2. Keep responses focused and directly answer the question
3. For navigation requests ("come here", "follow me"):
   - Acknowledge the request
   - State that you'll start moving to their location
   - Don't provide other context unless specifically asked
4. For location questions, state your exact coordinates and biome
5. For state questions (health, inventory, etc.), provide only the requested information
6. If asked about capabilities, list them briefly
7. For greetings, respond naturally but briefly
8. For inventory questions, list items in a natural way (e.g., "I have 32 logs, 16 stone, and 3 diamonds")
9. For health questions, use hearts (e.g., "I have 10½ hearts of health")
10. For weather questions, describe it naturally (e.g., "It's raining right now")
11. For time questions, use day/night and time of day
12. For biome questions, describe the biome naturally (e.g., "I'm in a beautiful plains biome")

Available context information:
- Position: My current coordinates (x, y, z)
- Health: My current health in hearts (each heart is 2 health points)
- Food: My current food level
- Inventory: Items I'm carrying
- Biome: The biome I'm currently in
- Time: Current time of day
- Weather: Current weather conditions
- Nearby Entities: Other players or mobs nearby

Example responses:
- "where are you?" -> "I'm at coordinates (100, 64, -200) in a beautiful plains biome. It's currently day and the weather is clear."
- "come here" -> "I'll start moving to your location now."
- "how much health do you have?" -> "I have 10½ hearts of health and my food level is 18/20."
- "what's in your inventory?" -> "I have 32 logs, 16 stone, 3 diamonds, and 5 apples in my inventory."
- "hi" -> "Hello! I'm doing well, currently exploring a forest biome."
- "what's the weather like?" -> "It's currently raining, but not thundering."
- "what time is it?" -> "It's night time right now, perfect for exploring!"
- "what biome are you in?" -> "I'm in a beautiful plains biome with lots of grass and flowers around."
- "do you have any diamonds?" -> "Yes, I have 3 diamonds in my inventory."
- "how many logs do you have?" -> "I have 32 logs in my inventory."
- "are you healthy?" -> "Yes, I'm in good shape with 10½ hearts of health and my food level is 18/20."

Remember: Be direct, use first-person, and focus on answering the specific question. Make your responses sound natural and conversational.`;

export class ChatTask extends BaseTask {
  private message: string;
  private context: ChatTaskParameters['context'];
  protected mineflayerBot: MineflayerBot;

  constructor(bot: MinecraftBot, commandHandler: CommandHandler, options: ChatTaskParameters) {
    super(bot, commandHandler, options);
    this.message = options.message;
    this.context = options.context;
    this.mineflayerBot = bot.getMineflayerBot();
  }

  private formatHealth(health: number): string {
    const hearts = Math.floor(health / 2);
    const halfHeart = health % 2 === 1;
    return `${hearts}${halfHeart ? '½' : ''} hearts`;
  }

  private formatContext(): string {
    if (!this.context?.botState) return 'No context available';

    const botState = this.context.botState as BotState;
    const { position, health, food, inventory, biome, isDay, isRaining, nearbyEntities } = botState;

    const contextLines = [
      `I am currently at coordinates (${position.x.toFixed(1)}, ${position.y.toFixed(1)}, ${position.z.toFixed(1)})`,
      `I have ${this.formatHealth(health)} of health and my food level is ${food}/20`,
      `I am in a ${biome || 'unknown'} biome`,
      `It is currently ${isDay ? 'day' : 'night'} time`,
      `The weather is ${isRaining ? 'raining' : 'clear'}`,
      `I have ${inventory.length} different types of items in my inventory`,
      `There are ${nearbyEntities?.length || 0} entities nearby`
    ];

    return contextLines.join('. ');
  }

  private async generateResponse(): Promise<string> {
    const apiUrl = process.env.LLM_API_URL || 'http://localhost:11434/api/generate';
    const model = process.env.LLM_MODEL || 'llama3.2:1b';

    try {
      const formattedContext = this.formatContext();
      const response = await axios.post(
        apiUrl,
        {
          model,
          prompt: `${CHAT_SYSTEM_PROMPT}\n\nCurrent Context:\n${formattedContext}\n\nUser: ${this.message}\n\nBot:`,
          stream: false
        },
        {
          timeout: 30000,
          validateStatus: (status) => status === 200
        }
      );

      if (!response.data.response) {
        throw new Error('Empty response from LLM');
      }

      return response.data.response.trim();
    } catch (error) {
      logger.error('Failed to generate chat response', {
        error,
        message: this.message,
        context: this.context
      });
      return "I'm having trouble processing that right now. Could you try again?";
    }
  }

  public async performTask(): Promise<void> {
    try {
      // Check if this is a simple chat message (no command prefix)
      if (!this.message.startsWith('.bot')) {
        const response = await this.generateResponse();
        if (response) {
          this.mineflayerBot.chat(response);
        }
        await this.updateProgress(100);
        metrics.tasksCompleted.inc({ task_type: 'chat' });
        return;
      }

      // For commands, parse and execute as task
      const task = await parseTask(this.message);
      if (!task) {
        throw new Error('Failed to parse task from message');
      }
      
      // Stop all existing tasks
      this.commandHandler.stopAllTasks();
      
      if (task.type === TaskType.QUERY) {
        // Handle query task
      } else if (task.type === TaskType.NAVIGATION) {
        // Find player position from nearby entities
        const player = this.context?.botState?.nearbyEntities?.find(
          entity => entity.type === 'player' && entity.name === this.context?.playerName
        );
        
        if (!player) {
          this.mineflayerBot.chat("I can't find you nearby. Please make sure you're close enough.");
          return;
        }

        // Create and execute navigation task
        const navTask = new NavigationTask(
          this.bot,
          this.commandHandler,
          {
            location: player.position,
            mode: 'walk',
            usePathfinding: true,
            ...task.parameters
          }
        );
        await navTask.execute(task, this.taskId!);
        // Generate and send response
        const response = await this.generateResponse();
        if (response) {
          this.mineflayerBot.chat(response);
        }
      } else if (task.type === TaskType.INTERACTION) {
        const response = await this.generateResponse();
        if (response) {
          this.mineflayerBot.chat(response);
        }
      } else {
        // For other task types, let the command handler handle them
        await this.commandHandler.executeTask(this.taskId!, task, this.context?.playerName || 'unknown');
      }

      await this.updateProgress(100);
      metrics.tasksCompleted.inc({ task_type: 'chat' });
    } catch (error) {
      await this.handleError(error as Error, {
        category: 'LLM',
        severity: 'HIGH',
        taskId: this.taskId!,
        taskType: 'chat',
        metadata: { message: this.message }
      });
      throw error;
    }
  }
} 