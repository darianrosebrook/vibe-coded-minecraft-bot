const mineflayer = require('mineflayer');

const bot = mineflayer.createBot({
  host: 'localhost',
  port: 50000,
  username: 'test_bot',
  version: '1.21.4'
});

bot.on('spawn', () => {
  console.log('Successfully connected to server!');
  bot.quit();
});

bot.on('error', (err) => {
  console.error('Error:', err);
});

bot.on('kicked', (reason) => {
  console.log('Kicked:', reason);
}); 