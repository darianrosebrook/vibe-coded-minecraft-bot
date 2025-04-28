declare module 'mineflayer-auto-eat' {
  import { Bot } from 'mineflayer';

  export class AutoEat {
    constructor(bot: Bot);
    isEating: boolean;
    start(): void;
    stop(): void;
  }
} 