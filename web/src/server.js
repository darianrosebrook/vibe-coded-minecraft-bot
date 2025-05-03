const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const express = require('express');
const { startServer } = require('./server');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(async () => {
  const expressApp = express();
  const httpServer = createServer(expressApp);

  // Start our custom server
  const { io } = await startServer(3001);

  expressApp.all('*', (req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
}); 