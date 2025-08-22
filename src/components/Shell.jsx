import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { ClipboardAddon } from '@xterm/addon-clipboard';
import { WebglAddon } from '@xterm/addon-webgl';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { 
  Play, 
  Square, 
  RotateCcw, 
  Wifi, 
  WifiOff,
  Terminal as TerminalIcon
} from 'lucide-react';
import 'xterm/css/xterm.css';
import { cn } from '../lib/utils';

// Global store for shell sessions
const shellSessions = new Map();

function Shell({ selectedProject, selectedSession, isActive }) {
  const terminalRef = useRef(null);
  const terminal = useRef(null);
  const fitAddon = useRef(null);
  const ws = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [lastSessionId, setLastSessionId] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const connectToShell = () => {
    if (!isInitialized || isConnected || isConnecting) return;
    
    setIsConnecting(true);
    connectWebSocket();
  };

  const disconnectFromShell = () => {
    if (ws.current) {
      ws.current.close();
      ws.current = null;
    }
    
    if (terminal.current) {
      terminal.current.clear();
      terminal.current.write('\x1b[2J\x1b[H');
    }
    
    setIsConnected(false);
    setIsConnecting(false);
  };

  const restartShell = () => {
    setIsRestarting(true);
    
    const sessionKeys = Array.from(shellSessions.keys()).filter(key => 
      key.includes(selectedProject.name)
    );
    sessionKeys.forEach(key => shellSessions.delete(key));
    
    if (ws.current) {
      ws.current.close();
      ws.current = null;
    }
    
    if (terminal.current) {
      terminal.current.dispose();
      terminal.current = null;
      fitAddon.current = null;
    }
    
    setIsConnected(false);
    setIsInitialized(false);
    
    setTimeout(() => {
      setIsRestarting(false);
    }, 200);
  };

  useEffect(() => {
    const currentSessionId = selectedSession?.id || null;
    
    if (lastSessionId !== null && lastSessionId !== currentSessionId && isInitialized) {
      disconnectFromShell();
      
      const allKeys = Array.from(shellSessions.keys());
      allKeys.forEach(key => {
        if (key.includes(selectedProject.name)) {
          shellSessions.delete(key);
        }
      });
    }
    
    setLastSessionId(currentSessionId);
  }, [selectedSession?.id, isInitialized]);

  // Terminal initialization
  useEffect(() => {
    if (!terminalRef.current || !selectedProject || isRestarting) {
      return;
    }

    const sessionKey = selectedSession?.id || `project-${selectedProject.name}`;
    
    const existingSession = shellSessions.get(sessionKey);
    if (existingSession && !terminal.current) {
      try {
        terminal.current = existingSession.terminal;
        fitAddon.current = existingSession.fitAddon;
        ws.current = existingSession.ws;
        setIsConnected(existingSession.isConnected);
        
        if (terminal.current.element && terminal.current.element.parentNode) {
          terminal.current.element.parentNode.removeChild(terminal.current.element);
        }
        
        terminal.current.open(terminalRef.current);
        
        setTimeout(() => {
          if (fitAddon.current) {
            fitAddon.current.fit();
            if (ws.current && ws.current.readyState === WebSocket.OPEN) {
              ws.current.send(JSON.stringify({
                type: 'resize',
                cols: terminal.current.cols,
                rows: terminal.current.rows
              }));
            }
          }
        }, 100);
        
        setIsInitialized(true);
        return;
      } catch (error) {
        shellSessions.delete(sessionKey);
        terminal.current = null;
        fitAddon.current = null;
        ws.current = null;
      }
    }

    if (terminal.current) {
      return;
    }

    // Initialize new terminal
    terminal.current = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: '"SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas, "Courier New", monospace',
      allowProposedApi: true,
      allowTransparency: true,
      convertEol: true,
      scrollback: 10000,
      tabStopWidth: 4,
      theme: {
        background: 'hsl(218, 11%, 12%)',
        foreground: 'hsl(0, 0%, 98%)',
        cursor: 'hsl(234, 89%, 74%)',
        cursorAccent: 'hsl(218, 11%, 12%)',
        selection: 'hsl(234, 89%, 74%, 0.3)',
        selectionForeground: 'hsl(0, 0%, 98%)',
        
        black: '#1a1b26',
        red: '#f7768e',
        green: '#9ece6a',
        yellow: '#e0af68',
        blue: '#7aa2f7',
        magenta: '#bb9af7',
        cyan: '#7dcfff',
        white: '#a9b1d6',
        
        brightBlack: '#414868',
        brightRed: '#f7768e',
        brightGreen: '#9ece6a',
        brightYellow: '#e0af68',
        brightBlue: '#7aa2f7',
        brightMagenta: '#bb9af7',
        brightCyan: '#7dcfff',
        brightWhite: '#c0caf5',
      }
    });

    fitAddon.current = new FitAddon();
    const clipboardAddon = new ClipboardAddon();
    const webglAddon = new WebglAddon();
    
    terminal.current.loadAddon(fitAddon.current);
    terminal.current.loadAddon(clipboardAddon);
    
    try {
      terminal.current.loadAddon(webglAddon);
    } catch (error) {
      console.warn('WebGL addon failed to load');
    }
    
    terminal.current.open(terminalRef.current);

    setTimeout(() => {
      if (fitAddon.current) {
        fitAddon.current.fit();
      }
    }, 50);

    terminal.current.attachCustomKeyEventHandler((event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'c' && terminal.current.hasSelection()) {
        document.execCommand('copy');
        return false;
      }
      
      if ((event.ctrlKey || event.metaKey) && event.key === 'v') {
        navigator.clipboard.readText().then(text => {
          if (ws.current && ws.current.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({
              type: 'input',
              data: text
            }));
          }
        }).catch(() => {});
        return false;
      }
      
      return true;
    });
    
    setTimeout(() => {
      if (fitAddon.current) {
        fitAddon.current.fit();
        if (terminal.current && ws.current && ws.current.readyState === WebSocket.OPEN) {
          ws.current.send(JSON.stringify({
            type: 'resize',
            cols: terminal.current.cols,
            rows: terminal.current.rows
          }));
        }
      }
    }, 100);
    
    setIsInitialized(true);

    terminal.current.onData((data) => {
      if (ws.current && ws.current.readyState === WebSocket.OPEN) {
        ws.current.send(JSON.stringify({
          type: 'input',
          data: data
        }));
      }
    });

    const resizeObserver = new ResizeObserver(() => {
      if (fitAddon.current && terminal.current) {
        setTimeout(() => {
          fitAddon.current.fit();
          if (ws.current && ws.current.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({
              type: 'resize',
              cols: terminal.current.cols,
              rows: terminal.current.rows
            }));
          }
        }, 50);
      }
    });

    if (terminalRef.current) {
      resizeObserver.observe(terminalRef.current);
    }

    return () => {
      resizeObserver.disconnect();
      
      if (terminal.current && selectedProject) {
        const sessionKey = selectedSession?.id || `project-${selectedProject.name}`;
        
        try {
          shellSessions.set(sessionKey, {
            terminal: terminal.current,
            fitAddon: fitAddon.current,
            ws: ws.current,
            isConnected: isConnected
          });
        } catch (error) {
          console.warn('Error storing shell session');
        }
      }
    };
  }, [terminalRef.current, selectedProject, selectedSession, isRestarting]);

  useEffect(() => {
    if (!isActive || !isInitialized) return;

    setTimeout(() => {
      if (fitAddon.current) {
        fitAddon.current.fit();
        if (terminal.current && ws.current && ws.current.readyState === WebSocket.OPEN) {
          ws.current.send(JSON.stringify({
            type: 'resize',
            cols: terminal.current.cols,
            rows: terminal.current.rows
          }));
        }
      }
    }, 100);
  }, [isActive, isInitialized]);

  const connectWebSocket = async () => {
    if (isConnecting || isConnected) return;
    
    try {
      const token = localStorage.getItem('auth-token');
      if (!token) {
        console.error('No authentication token found');
        return;
      }
      
      let wsBaseUrl;
      
      // Handle Electron environment
      if (window.electronAPI?.isElectron) {
        wsBaseUrl = 'ws://127.0.0.1:3001';
      } else {
      try {
        const configResponse = await fetch('/api/config', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const config = await configResponse.json();
        wsBaseUrl = config.wsUrl;
        
        if (wsBaseUrl.includes('localhost') && !window.location.hostname.includes('localhost')) {
          const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
          const apiPort = window.location.port === '3001' ? '3002' : window.location.port;
          wsBaseUrl = `${protocol}//${window.location.hostname}:${apiPort}`;
        }
      } catch (error) {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const apiPort = window.location.port === '3001' ? '3002' : window.location.port;
        wsBaseUrl = `${protocol}//${window.location.hostname}:${apiPort}`;
      }
      }
      
      const wsUrl = `${wsBaseUrl}/shell?token=${encodeURIComponent(token)}`;
      ws.current = new WebSocket(wsUrl);

      ws.current.onopen = () => {
        setIsConnected(true);
        setIsConnecting(false);
        
        setTimeout(() => {
          if (fitAddon.current && terminal.current) {
            fitAddon.current.fit();
            
            setTimeout(() => {
              const initPayload = {
                type: 'init',
                projectPath: selectedProject.fullPath || selectedProject.path,
                sessionId: selectedSession?.id,
                hasSession: !!selectedSession,
                provider: selectedSession?.__provider || 'claude',
                cols: terminal.current.cols,
                rows: terminal.current.rows
              };
              
              ws.current.send(JSON.stringify(initPayload));
              
              setTimeout(() => {
                if (terminal.current && ws.current && ws.current.readyState === WebSocket.OPEN) {
                  ws.current.send(JSON.stringify({
                    type: 'resize',
                    cols: terminal.current.cols,
                    rows: terminal.current.rows
                  }));
                }
              }, 100);
            }, 50);
          }
        }, 200);
      };

      ws.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'output') {
            terminal.current.write(data.data);
          } else if (data.type === 'url_open') {
            window.open(data.url, '_blank');
          }
        } catch (error) {
          console.warn('Error parsing WebSocket message');
        }
      };

      ws.current.onclose = () => {
        setIsConnected(false);
        setIsConnecting(false);
        
        if (terminal.current) {
          terminal.current.clear();
          terminal.current.write('\x1b[2J\x1b[H');
        }
      };

      ws.current.onerror = () => {
        setIsConnected(false);
        setIsConnecting(false);
      };
    } catch (error) {
      setIsConnected(false);
      setIsConnecting(false);
    }
  };

  if (!selectedProject) {
    return (
      <div className="h-full flex items-center justify-center linear-bg">
        <Card className="p-8 max-w-md mx-4 text-center linear-surface border-border/50">
          <div className="w-16 h-16 mx-auto mb-4 linear-surface rounded-xl flex items-center justify-center">
            <TerminalIcon className="w-8 h-8 linear-text-secondary" />
          </div>
          <h3 className="text-lg font-semibold mb-2 linear-text">Select a Project</h3>
          <p className="linear-text-secondary">
            Choose a project to open an interactive shell in that directory
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col linear-bg">
      {/* Header */}
      <div className="flex-shrink-0 linear-surface/50 border-b linear-border px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex items-center gap-2">
              {isConnected ? (
                <Wifi className="w-4 h-4 text-green-500" />
              ) : (
                <WifiOff className="w-4 h-4 text-red-500" />
              )}
              
              <Badge variant={isConnected ? "default" : "secondary"} className="text-xs">
                {isConnected ? "Connected" : "Disconnected"}
              </Badge>
            </div>
            
            {selectedSession && (
              <div className="text-xs linear-text-secondary">
                {selectedSession.__provider === 'cursor'
                  ? `Session: ${selectedSession.name || 'Untitled'}`
                  : `Session: ${selectedSession.summary || 'New Session'}`}
              </div>
            )}
            
            {isRestarting && (
              <Badge variant="outline" className="text-xs">
                Restarting...
              </Badge>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {isConnected ? (
              <Button
                variant="destructive"
                size="sm"
                onClick={disconnectFromShell}
                className="h-8"
              >
                <Square className="w-3 h-3 mr-1.5" />
                Disconnect
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={restartShell}
                disabled={isRestarting || isConnected}
                className="h-8"
              >
                <RotateCcw className="w-3 h-3 mr-1.5" />
                Restart
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Terminal */}
      <div className="flex-1 p-4 overflow-hidden relative">
        <Card className="h-full linear-surface border-border/50 overflow-hidden">
          <div 
            ref={terminalRef} 
            className="h-full w-full p-3 focus:outline-none" 
            style={{ outline: 'none' }} 
          />
          
          {/* Loading state */}
          {!isInitialized && (
            <div className="absolute inset-0 flex items-center justify-center linear-bg/90">
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <span className="linear-text">Initializing terminal...</span>
              </div>
            </div>
          )}
          
          {/* Connect button */}
          {isInitialized && !isConnected && !isConnecting && (
            <div className="absolute inset-0 flex items-center justify-center linear-bg/90 p-4">
              <div className="text-center max-w-sm w-full">
                <Button
                  onClick={connectToShell}
                  size="lg"
                  className="w-full sm:w-auto mb-4"
                >
                  <Play className="w-5 h-5 mr-2" />
                  Continue in Shell
                </Button>
                <p className="linear-text-secondary text-sm">
                  {selectedSession 
                    ? (() => {
                        const displayName = selectedSession.__provider === 'cursor'
                          ? selectedSession.name || 'Untitled Session'
                          : selectedSession.summary || 'New Session';
                        return `Resume session: ${displayName}`;
                      })()
                    : 'Start a new Claude session'}
                </p>
              </div>
            </div>
          )}
          
          {/* Connecting state */}
          {isConnecting && (
            <div className="absolute inset-0 flex items-center justify-center linear-bg/90 p-4">
              <div className="text-center max-w-sm w-full">
                <div className="flex items-center justify-center gap-3 mb-3">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <span className="font-medium linear-text">Connecting to shell...</span>
                </div>
                <p className="linear-text-secondary text-sm">
                  Starting Claude CLI in {selectedProject.displayName}
                </p>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

export default Shell;