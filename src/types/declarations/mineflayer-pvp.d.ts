declare module 'mineflayer-pvp' {
  import { Bot } from 'mineflayer';

  export class PVP {
    constructor(bot: Bot);
    target: any;
    guard: any;
    attack(target: any): void;
    stop(): void;
  }
} 