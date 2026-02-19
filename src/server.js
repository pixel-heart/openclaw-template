const express = require('express');
const http = require('http');
const httpProxy = require('http-proxy');
const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const PORT = parseInt(process.env.PORT || '3000', 10);
const GATEWAY_PORT = 18789;
const GATEWAY_HOST = '127.0.0.1';
const GATEWAY_URL = `http://${GATEWAY_HOST}:${GATEWAY_PORT}`;
const OPENCLAW_DIR = '/data/.openclaw';
const GATEWAY_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN || '';

// ============================================================
// 1. Start gateway as child process
// ============================================================

let gatewayProcess = null;
let gatewayReady = false;
let gatewayExitCode = null;

function startGateway() {
  console.log('[wrapper] Starting openclaw gateway...');
  gatewayProcess = spawn('npx', ['openclaw', 'gateway', 'run'], {
    env: {
      ...process.env,
      OPENCLAW_HOME: '/data',
      OPENCLAW_CONFIG_PATH: `${OPENCLAW_DIR}/openclaw.json`,
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  gatewayProcess.stdout.on('data', (d) => {
    const line = d.toString();
    process.stdout.write(`[gateway] ${line}`);
    if (line.includes('Gateway listening') || line.includes('ready')) {
      gatewayReady = true;
    }
  });

  gatewayProcess.stderr.on('data', (d) => {
    process.stderr.write(`[gateway] ${d}`);
  });

  gatewayProcess.on('exit', (code) => {
    console.log(`[wrapper] Gateway exited with code ${code}`);
    gatewayReady = false;
    gatewayExitCode = code;
    // Restart after a delay unless we're shutting down
    if (!shuttingDown) {
      setTimeout(() => startGateway(), 3000);
    }
  });
}

let shuttingDown = false;
process.on('SIGTERM', () => {
  shuttingDown = true;
  if (gatewayProcess) gatewayProcess.kill('SIGTERM');
  process.exit(0);
});
process.on('SIGINT', () => {
  shuttingDown = true;
  if (gatewayProcess) gatewayProcess.kill('SIGINT');
  process.exit(0);
});

// ============================================================
// 2. Reverse proxy to gateway
// ============================================================

const proxy = httpProxy.createProxyServer({
  target: GATEWAY_URL,
  ws: true,
  changeOrigin: true,
});

proxy.on('error', (err, req, res) => {
  if (res && res.writeHead) {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Gateway unavailable', starting: !gatewayReady }));
  }
});

// ============================================================
// 3. Express app — setup UI + proxy
// ============================================================

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Health check for Railway
app.get('/health', (req, res) => {
  res.json({
    status: gatewayReady ? 'healthy' : 'starting',
    gateway: gatewayReady ? 'running' : (gatewayExitCode !== null ? `exited(${gatewayExitCode})` : 'starting'),
  });
});

// Setup page
app.get('/setup', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'setup.html'));
});

// API: gateway status
app.get('/api/status', (req, res) => {
  const configExists = fs.existsSync(`${OPENCLAW_DIR}/openclaw.json`);
  res.json({
    gateway: gatewayReady ? 'running' : 'starting',
    configExists,
    channels: getChannelStatus(),
  });
});

// Helper: run openclaw CLI command
function clawCmd(cmd) {
  return new Promise((resolve) => {
    console.log(`[wrapper] Running: openclaw ${cmd}`);
    exec(`openclaw ${cmd}`, {
      env: {
        ...process.env,
        OPENCLAW_HOME: '/data',
        OPENCLAW_CONFIG_PATH: `${OPENCLAW_DIR}/openclaw.json`,
      },
      timeout: 15000,
    }, (err, stdout, stderr) => {
      const result = { ok: !err, stdout: stdout.trim(), stderr: stderr.trim(), code: err?.code };
      console.log(`[wrapper] Result: ok=${result.ok} stdout=${result.stdout.slice(0, 200)} stderr=${result.stderr.slice(0, 200)}`);
      resolve(result);
    });
  });
}

// API: gateway status via CLI
app.get('/api/gateway-status', async (req, res) => {
  const result = await clawCmd('status');
  res.json(result);
});

// Cache for pairing results (avoid spawning CLI every poll)
let pairingCache = { pending: [], ts: 0 };
const PAIRING_CACHE_TTL = 10000; // 10s

// API: list pending pairings via CLI
app.get('/api/pairings', async (req, res) => {
  if (Date.now() - pairingCache.ts < PAIRING_CACHE_TTL) {
    return res.json({ pending: pairingCache.pending });
  }

  const pending = [];
  const channels = ['telegram', 'discord'];

  for (const ch of channels) {
    // Check if channel is configured
    try {
      const config = JSON.parse(fs.readFileSync(`${OPENCLAW_DIR}/openclaw.json`, 'utf8'));
      if (!config.channels?.[ch]?.enabled) continue;
    } catch { continue; }

    const result = await clawCmd(`pairing list ${ch}`);
    if (result.ok && result.stdout) {
      const lines = result.stdout.split('\n').filter(l => l.trim());
      for (const line of lines) {
        const codeMatch = line.match(/([A-Z0-9]{8})/);
        if (codeMatch) {
          pending.push({
            id: codeMatch[1],
            code: codeMatch[1],
            channel: ch,
          });
        }
      }
    }
  }

  if (pending.length > 0) {
    console.log(`[wrapper] Found ${pending.length} pending pairing(s)`);
  }
  pairingCache = { pending, ts: Date.now() };
  res.json({ pending });
});

// API: approve pairing
app.post('/api/pairings/:id/approve', async (req, res) => {
  const channel = req.body.channel || 'telegram';
  const result = await clawCmd(`pairing approve ${channel} ${req.params.id}`);
  res.json(result);
});

// API: reject pairing
app.post('/api/pairings/:id/reject', async (req, res) => {
  const channel = req.body.channel || 'telegram';
  const result = await clawCmd(`pairing reject ${channel} ${req.params.id}`);
  res.json(result);
});

function getChannelStatus() {
  try {
    const config = JSON.parse(fs.readFileSync(`${OPENCLAW_DIR}/openclaw.json`, 'utf8'));
    const channels = {};
    if (config.channels?.telegram?.enabled) channels.telegram = 'configured';
    if (config.channels?.discord?.enabled) channels.discord = 'configured';
    return channels;
  } catch {
    return {};
  }
}

// Everything else → proxy to gateway
app.all('/webhook/*', (req, res) => proxy.web(req, res));
app.all('/api/*', (req, res) => {
  // Don't proxy our own /api routes
  if (req.path.startsWith('/api/status') || req.path.startsWith('/api/pairings')) return;
  proxy.web(req, res);
});

// ============================================================
// 4. Start server
// ============================================================

const server = http.createServer(app);

// WebSocket upgrade → proxy to gateway
server.on('upgrade', (req, socket, head) => {
  proxy.ws(req, socket, head);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[wrapper] Express listening on :${PORT}`);
  startGateway();
});
