const { createServer } = require('https');
const { parse } = require('url');
const next = require('next');
const fs = require('fs');

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = 3000;

// Configure Next.js app
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// HTTPS options
const httpsOptions = {
  key: fs.readFileSync('./localhost-key.pem'),
  cert: fs.readFileSync('./localhost.pem')
};

app.prepare().then(() => {
  const server = createServer(httpsOptions, async (req, res) => {
    try {
      // Add CORS headers for local network access
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  server.listen(port, hostname, (err) => {
    if (err) throw err;
    console.log(`> Ready on https://${hostname}:${port}`);
    console.log(`> Network access: https://10.0.0.140:${port}`);
    console.log(`> Local access: https://localhost:${port}`);
    console.log('\n> Note: You may need to accept the certificate warning in your browser');
    console.log('> Also check that Node.js is allowed in macOS Firewall settings');
  });
});