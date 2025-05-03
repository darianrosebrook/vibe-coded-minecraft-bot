import { BotPlugin } from './bot';
import * as toolPlugin from 'mineflayer-tool';
import * as collectBlockPlugin from 'mineflayer-collectblock';

export const defaultPlugins: BotPlugin[] = [
  { 
    apply: (bot) => toolPlugin.plugin(bot)
  },
  {
    apply: (bot) => collectBlockPlugin.plugin(bot)
  }
]; 