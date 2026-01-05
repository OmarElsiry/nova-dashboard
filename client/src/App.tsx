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

  useEffect(() => {
    const newSocket = io(SOCKET_URL);
    setSocket(newSocket);

    newSocket.on('output', (data) => {
      setTerminalOutput((prev) => prev + data);
    });

    newSocket.on('ssh-ready', () => {
      setStatus('connected');
      startAutomation(newSocket);
    });

    newSocket.on('error', (err) => {
      console.error('Socket error:', err);
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
            <span className={`status-badge status-${status}`}>
              <Activity size={14} /> {status.toUpperCase()}
            </span>
            {status === 'disconnected' && (
              <button onClick={connect}>Initiate Connection</button>
            )}
          </div>
        </header>

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
