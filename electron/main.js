import { app, BrowserWindow, shell, ipcMain, dialog } from 'electron';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { spawn } from 'child_process';
import isDev from 'electron-is-dev';

// Import server modules
import express from 'express';
import { WebSocketServer } from 'ws';
import http from 'http';
import cors from 'cors';
import { promises as fsPromises } from 'fs';
import { spawn as spawnProcess } from 'child_process';
import os from 'os';
import pty from 'node-pty';
import fetch from 'node-fetch';
import mime from 'mime-types';

// Import server routes and utilities
import { getProjects, getSessions, getSessionMessages, renameProject, deleteSession, deleteProject, addProjectManually, extractProjectDirectory, clearProjectDirectoryCache } from '../server/projects.js';
import { spawnClaude, abortClaudeSession } from '../server/claude-cli.js';
import { spawnCursor, abortCursorSession } from '../server/cursor-cli.js';
import gitRoutes from '../server/routes/git.js';
import authRoutes from '../server/routes/auth.js';
import mcpRoutes from '../server/routes/mcp.js';
import cursorRoutes from '../server/routes/cursor.js';
import { initializeDatabase } from '../server/database/db.js';
import { validateApiKey, authenticateToken, authenticateWebSocket } from '../server/middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let mainWindow = null;
let serverApp = null;
let server = null;
let serverPort = 3001;

// Initialize Express server
async function initializeServer() {
  console.log('🚀 Initializing embedded server...');
  
  // Load environment variables
  process.env.PORT = process.env.PORT || serverPort;
  
  serverApp = express();
  server = http.createServer(serverApp);
  
  // File system watcher and WebSocket setup
  let projectsWatcher = null;
  const connectedClients = new Set();
  
  // Setup file system watcher for Claude projects folder using chokidar
  async function setupProjectsWatcher() {
    const chokidar = (await import('chokidar')).default;
    const claudeProjectsPath = join(process.env.HOME || os.homedir(), '.claude', 'projects');

    if (projectsWatcher) {
      projectsWatcher.close();
    }

    try {
      projectsWatcher = chokidar.watch(claudeProjectsPath, {
        ignored: [
          '**/node_modules/**',
          '**/.git/**',
          '**/dist/**',
          '**/build/**',
          '**/*.tmp',
          '**/*.swp',
          '**/.DS_Store'
        ],
        persistent: true,
        ignoreInitial: true,
        followSymlinks: false,
        depth: 10,
        awaitWriteFinish: {
          stabilityThreshold: 100,
          pollInterval: 50
        }
      });

      let debounceTimer;
      const debouncedUpdate = async (eventType, filePath) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(async () => {
          try {
            clearProjectDirectoryCache();
            const updatedProjects = await getProjects();
            
            const updateMessage = JSON.stringify({
              type: 'projects_updated',
              projects: updatedProjects,
              timestamp: new Date().toISOString(),
              changeType: eventType,
              changedFile: filePath ? join(claudeProjectsPath, filePath) : null
            });

            connectedClients.forEach(client => {
              if (client.readyState === client.OPEN) {
                client.send(updateMessage);
              }
            });
          } catch (error) {
            console.error('❌ Error handling project changes:', error);
          }
        }, 300);
      };

      projectsWatcher
        .on('add', (filePath) => debouncedUpdate('add', filePath))
        .on('change', (filePath) => debouncedUpdate('change', filePath))
        .on('unlink', (filePath) => debouncedUpdate('unlink', filePath))
        .on('addDir', (dirPath) => debouncedUpdate('addDir', dirPath))
        .on('unlinkDir', (dirPath) => debouncedUpdate('unlinkDir', dirPath))
        .on('error', (error) => console.error('❌ Chokidar watcher error:', error))
        .on('ready', () => console.log('📁 Project watcher ready'));
    } catch (error) {
      console.error('❌ Failed to setup projects watcher:', error);
    }
  }

  // WebSocket server
  const wss = new WebSocketServer({
    server,
    verifyClient: (info) => {
      const url = new URL(info.req.url, 'http://localhost');
      const token = url.searchParams.get('token') || info.req.headers.authorization?.split(' ')[1];
      const user = authenticateWebSocket(token);
      if (!user) {
        console.log('❌ WebSocket authentication failed');
        return false;
      }
      info.req.user = user;
      return true;
    }
  });

  serverApp.use(cors());
  serverApp.use(express.json());
  
  // API key validation
  serverApp.use('/api', validateApiKey);
  
  // Routes
  serverApp.use('/api/auth', authRoutes);
  serverApp.use('/api/git', authenticateToken, gitRoutes);
  serverApp.use('/api/mcp', authenticateToken, mcpRoutes);
  serverApp.use('/api/cursor', authenticateToken, cursorRoutes);

  // API endpoints
  serverApp.get('/api/config', authenticateToken, (req, res) => {
    res.json({
      serverPort: serverPort,
      wsUrl: `ws://localhost:${serverPort}`
    });
  });

  serverApp.get('/api/projects', authenticateToken, async (req, res) => {
    try {
      const projects = await getProjects();
      res.json(projects);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Add all other API endpoints from the original server
  // ... (copying all endpoints from server/index.js)

  // Serve static files in production
  if (!isDev) {
    serverApp.use(express.static(join(__dirname, '../dist')));
    serverApp.get('*', (req, res) => {
      res.sendFile(join(__dirname, '../dist/index.html'));
    });
  }

  // WebSocket handlers
  wss.on('connection', (ws, request) => {
    const url = request.url;
    const urlObj = new URL(url, 'http://localhost');
    const pathname = urlObj.pathname;

    if (pathname === '/shell') {
      handleShellConnection(ws);
    } else if (pathname === '/ws') {
      handleChatConnection(ws);
    } else {
      ws.close();
    }
  });

  function handleChatConnection(ws) {
    connectedClients.add(ws);
    
    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message);
        
        if (data.type === 'claude-command') {
          await spawnClaude(data.command, data.options, ws);
        } else if (data.type === 'cursor-command') {
          await spawnCursor(data.command, data.options, ws);
        } else if (data.type === 'cursor-resume') {
          await spawnCursor('', { sessionId: data.sessionId, resume: true, cwd: data.options?.cwd }, ws);
        } else if (data.type === 'abort-session') {
          const provider = data.provider || 'claude';
          const success = provider === 'cursor' ? abortCursorSession(data.sessionId) : abortClaudeSession(data.sessionId);
          ws.send(JSON.stringify({ type: 'session-aborted', sessionId: data.sessionId, provider, success }));
        }
      } catch (error) {
        ws.send(JSON.stringify({ type: 'error', error: error.message }));
      }
    });

    ws.on('close', () => connectedClients.delete(ws));
  }

  function handleShellConnection(ws) {
    let shellProcess = null;
    
    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message);
        
        if (data.type === 'init') {
          const projectPath = data.projectPath || process.cwd();
          const sessionId = data.sessionId;
          const hasSession = data.hasSession;
          const provider = data.provider || 'claude';
          
          const providerName = provider === 'cursor' ? 'Cursor' : 'Claude';
          const welcomeMsg = hasSession ?
            `\x1b[36mResuming ${providerName} session ${sessionId} in: ${projectPath}\x1b[0m\r\n` :
            `\x1b[36mStarting new ${providerName} session in: ${projectPath}\x1b[0m\r\n`;

          ws.send(JSON.stringify({ type: 'output', data: welcomeMsg }));

          let shellCommand;
          if (provider === 'cursor') {
            shellCommand = os.platform() === 'win32' ?
              (hasSession ? `Set-Location -Path "${projectPath}"; cursor-agent --resume="${sessionId}"` : `Set-Location -Path "${projectPath}"; cursor-agent`) :
              (hasSession ? `cd "${projectPath}" && cursor-agent --resume="${sessionId}"` : `cd "${projectPath}" && cursor-agent`);
          } else {
            shellCommand = os.platform() === 'win32' ?
              (hasSession ? `Set-Location -Path "${projectPath}"; claude --resume ${sessionId}; if ($LASTEXITCODE -ne 0) { claude }` : `Set-Location -Path "${projectPath}"; claude`) :
              (hasSession ? `cd "${projectPath}" && claude --resume ${sessionId} || claude` : `cd "${projectPath}" && claude`);
          }

          const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';
          const shellArgs = os.platform() === 'win32' ? ['-Command', shellCommand] : ['-c', shellCommand];

          shellProcess = pty.spawn(shell, shellArgs, {
            name: 'xterm-256color',
            cols: 80,
            rows: 24,
            cwd: process.env.HOME || (os.platform() === 'win32' ? process.env.USERPROFILE : '/'),
            env: { ...process.env, TERM: 'xterm-256color', COLORTERM: 'truecolor', FORCE_COLOR: '3' }
          });

          shellProcess.onData((data) => {
            if (ws.readyState === ws.OPEN) {
              ws.send(JSON.stringify({ type: 'output', data: data }));
            }
          });

          shellProcess.onExit((exitCode) => {
            if (ws.readyState === ws.OPEN) {
              ws.send(JSON.stringify({ type: 'output', data: `\r\n\x1b[33mProcess exited with code ${exitCode.exitCode}\x1b[0m\r\n` }));
            }
            shellProcess = null;
          });
        } else if (data.type === 'input' && shellProcess) {
          shellProcess.write(data.data);
        } else if (data.type === 'resize' && shellProcess) {
          shellProcess.resize(data.cols, data.rows);
        }
      } catch (error) {
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({ type: 'output', data: `\r\n\x1b[31mError: ${error.message}\x1b[0m\r\n` }));
        }
      }
    });

    ws.on('close', () => {
      if (shellProcess && shellProcess.kill) {
        shellProcess.kill();
      }
    });
  }

  try {
    await initializeDatabase();
    
    await new Promise((resolve) => {
      server.listen(serverPort, '127.0.0.1', () => {
        console.log(`🚀 Embedded server running on http://127.0.0.1:${serverPort}`);
        resolve();
      });
    });
    
    await setupProjectsWatcher();
  } catch (error) {
    console.error('❌ Failed to start embedded server:', error);
    throw error;
  }
}

// Create main window
async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: join(__dirname, 'preload.js')
    },
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    show: false,
    icon: join(__dirname, '../dist/icons/icon-512x512.png')
  });

  // Start embedded server
  await initializeServer();

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadURL(`http://127.0.0.1:${serverPort}`);
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (server) {
      server.close();
    }
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

// App event handlers
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    await createWindow();
  }
});

// Security: prevent navigation to external websites
app.on('web-contents-created', (event, contents) => {
  contents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    if (parsedUrl.origin !== `http://127.0.0.1:${serverPort}` && parsedUrl.origin !== 'http://localhost:5173') {
      event.preventDefault();
    }
  });
});

// IPC handlers for additional functionality
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('show-message-box', async (event, options) => {
  const result = await dialog.showMessageBox(mainWindow, options);
  return result;
});

ipcMain.handle('show-open-dialog', async (event, options) => {
  const result = await dialog.showOpenDialog(mainWindow, options);
  return result;
});

ipcMain.handle('show-save-dialog', async (event, options) => {
  const result = await dialog.showSaveDialog(mainWindow, options);
  return result;
});