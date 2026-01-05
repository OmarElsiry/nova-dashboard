import { useState, useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { Terminal } from './components/Terminal';
import { EditorView } from './components/EditorView';
import { Layout, Terminal as TermIcon, FileCode, Shield, Activity, Power } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const SOCKET_URL = (import.meta.env.VITE_BACKEND_URL as string) || 'http://localhost:3001';

type ViewMode = 'terminal' | 'gui';
type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [terminalOutput, setTerminalOutput] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('terminal');
  const [fileContent, setFileContent] = useState('');
  const [isAutomating, setIsAutomating] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [debugLogs, setDebugLogs] = useState<{ time: string, msg: string, type: 'info' | 'error' | 'success' }[]>([]);

  const addLog = useCallback((msg: string, type: 'info' | 'error' | 'success' = 'info') => {
    setDebugLogs(prev => [{ time: new Date().toLocaleTimeString(), msg, type }, ...prev].slice(0, 50));
  }, []);

  useEffect(() => {
    addLog(`Initializing connection to: ${SOCKET_URL}`, 'info');
    const newSocket = io(SOCKET_URL, {
      reconnectionAttempts: 5,
      timeout: 10000,
    });
    setSocket(newSocket);

    newSocket.on('connect', () => {
      addLog('Socket connected successfully!', 'success');
    });

    newSocket.on('connect_error', (err) => {
      addLog(`Socket connection failed: ${err.message}`, 'error');
      console.error('Socket connection error:', err);
    });

    newSocket.on('output', (data) => {
      setTerminalOutput((prev) => prev + data);
    });

    newSocket.on('ssh-ready', () => {
      addLog('SSH Bridge established!', 'success');
      setStatus('connected');
      startAutomation(newSocket);
    });

    newSocket.on('error', (err) => {
      addLog(`Backend Error: ${err}`, 'error');
      console.error('Socket error:', err);
      setStatus('disconnected');
    });

    newSocket.on('disconnect', (reason) => {
      addLog(`Socket disconnected: ${reason}`, 'info');
      setStatus('disconnected');
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  const connect = () => {
    if (!socket) return;
    setStatus('connecting');
    setTerminalOutput('');
    socket.emit('start-ssh');
  };

  const startAutomation = useCallback(async (s: Socket) => {
    setIsAutomating(true);
    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

    const commands = [
      'cd nova-back',
      'cd src/config',
      'ls -la',
      'clear',
      '# Opening app-settings.ts in premium GUI mode...'
    ];

    for (const cmd of commands) {
      await sleep(1000);
      s.emit('data', cmd + '\n');
    }

    await sleep(2000);

    // Fetch real file content from API
    try {
      const resp = await fetch(`${SOCKET_URL}/api/file-content`);
      const data = await resp.json();
      if (data.content) {
        setFileContent(data.content);
        setViewMode('gui');
      }
    } catch (err) {
      console.error('Failed to fetch file content', err);
    }
    setIsAutomating(false);
  }, []);

  const saveFile = async () => {
    setIsAutomating(true);
    try {
      const resp = await fetch(`${SOCKET_URL}/api/save-file`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: fileContent })
      });
      const data = await resp.json();
      if (data.success) {
        alert('File saved successfully!');
      } else {
        alert('Failed to save: ' + data.error);
      }
    } catch (err) {
      console.error('Error saving file:', err);
      alert('Error saving file');
    }
    setIsAutomating(false);
  };

  return (
    <div className="dashboard-container">
      <aside className="sidebar">
        <div className="logo">_NOVA DASHBOARD</div>

        <nav style={{ flex: 1 }}>
          <div className={`nav-item ${viewMode === 'terminal' ? 'active' : ''}`} onClick={() => setViewMode('terminal')}>
            <TermIcon size={20} /> Remote Terminal
          </div>
          <div className={`nav-item ${viewMode === 'gui' ? 'active' : ''}`} onClick={() => setViewMode('gui')}>
            <FileCode size={20} /> App Settings GUI
          </div>
          <div className="nav-item">
            <Layout size={20} /> Services
          </div>
          <div className="nav-item">
            <Shield size={20} /> Security
          </div>
        </nav>

        <div className="nav-item" style={{ marginTop: 'auto', color: '#ff4444' }}>
          <Power size={20} /> Disconnect
        </div>
      </aside>

      <main className="main-content">
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div>
            <h1 style={{ fontSize: '1.875rem', fontWeight: 700 }}>Environment Overview</h1>
            <p style={{ color: 'var(--text-secondary)' }}>Managing VPS: 151.245.216.148</p>
          </div>

          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <button
              onClick={() => setShowDebug(!showDebug)}
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', padding: '0.5rem' }}
              title="Toggle Diagnostics"
            >
              <Activity size={18} color={showDebug ? 'var(--accent-color)' : 'white'} />
            </button>
            <span className={`status-badge status-${status}`}>
              <Activity size={14} /> {status.toUpperCase()}
            </span>
            {status === 'disconnected' && (
              <button onClick={connect}>Initiate Connection</button>
            )}
          </div>
        </header>

        <AnimatePresence>
          {showDebug && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="card"
              style={{ marginBottom: '2rem', border: '1px solid var(--accent-color)', background: 'rgba(0,102,255,0.05)' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Diagnostic Console</h3>
                <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>Configured URL: {SOCKET_URL}</span>
              </div>
              <div style={{ maxHeight: '200px', overflowY: 'auto', fontSize: '0.875rem', fontFamily: 'monospace' }}>
                {debugLogs.length === 0 && <p style={{ opacity: 0.5 }}>Waiting for logs...</p>}
                {debugLogs.map((log, i) => (
                  <div key={i} style={{ marginBottom: '0.25rem', color: log.type === 'error' ? '#ff4444' : log.type === 'success' ? '#22c55e' : 'inherit' }}>
                    <span style={{ opacity: 0.5, marginRight: '0.5rem' }}>[{log.time}]</span>
                    {log.msg}
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {viewMode === 'terminal' ? (
            <motion.div
              key="terminal"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="card"
              style={{ height: '500px' }}
            >
              <div className="terminal-wrapper">
                <div style={{ position: 'absolute', top: '1rem', right: '1rem', zIndex: 10, display: 'flex', gap: '0.5rem' }}>
                  {status === 'connected' && (
                    <span style={{ fontSize: '0.75rem', background: 'rgba(34, 197, 94, 0.2)', color: '#22c55e', padding: '2px 8px', borderRadius: '4px', border: '1px solid #22c55e' }}>
                      ● REAL-TIME TTY
                    </span>
                  )}
                </div>
                <Terminal
                  output={terminalOutput}
                  onData={(data) => socket?.emit('data', data)}
                />
              </div>
              {isAutomating && (
                <p style={{ marginTop: '1rem', color: 'var(--accent-color)', fontSize: '0.875rem' }}>
                  Running automation sequence... Please wait.
                </p>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="editor"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="card"
              style={{ padding: 0, overflow: 'hidden' }}
            >
              <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600 }}>app-settings.ts</span>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Editing Mode</span>
                </div>
                <button
                  onClick={saveFile}
                  disabled={isAutomating}
                  style={{ background: '#22c55e', padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                >
                  {isAutomating ? 'Saving...' : 'Deploy Changes'}
                </button>
              </div>
              <EditorView content={fileContent} onChange={(val) => setFileContent(val || '')} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

export default App;
