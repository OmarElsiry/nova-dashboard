import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { Client } from 'ssh2';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: process.env.CLIENT_URL || "http://localhost:5173", // Dynamic client origin
        methods: ["GET", "POST"]
    }
});

const connConfig = {
    host: process.env.VPS_HOST as string,
    port: parseInt(process.env.VPS_PORT || '22'),
    username: process.env.VPS_USER as string,
    password: process.env.VPS_PASS as string,
};

io.on('connection', (socket) => {
    console.log('Client connected to socket');

    const conn = new Client();

    socket.on('start-ssh', () => {
        conn.on('ready', () => {
            socket.emit('ssh-ready');
            conn.shell((err, stream) => {
                if (err) return socket.emit('error', err.message);

                socket.on('data', (data: string) => {
                    stream.write(data);
                });

                stream.on('data', (data: Buffer) => {
                    socket.emit('output', data.toString());
                });

                stream.on('close', () => {
                    conn.end();
                    socket.disconnect();
                });
            });
        }).on('error', (err) => {
            socket.emit('error', err.message);
        }).connect(connConfig);
    });

    socket.on('disconnect', () => {
        conn.end();
    });
});

// Endpoint to fetch file content directly for the GUI
app.get('/api/file-content', (req, res) => {
    const conn = new Client();
    conn.on('ready', () => {
        conn.exec('cat /root/nova-back/src/config/app-settings.ts', (err, stream) => {
            if (err) return res.status(500).json({ error: err.message });

            let data = '';
            stream.on('data', (chunk: Buffer) => {
                data += chunk.toString();
            });
            stream.on('close', () => {
                conn.end();
                res.json({ content: data });
            }).stderr.on('data', (errData) => {
                console.error('STDERR:', errData.toString());
            });
        });
    }).on('error', (err) => {
        res.status(500).json({ error: err.message });
    }).connect(connConfig);
});

// Endpoint to save file content
app.post('/api/save-file', (req, res) => {
    const { content } = req.body;
    if (!content) return res.status(400).json({ error: 'No content provided' });

    const conn = new Client();
    conn.on('ready', () => {
        // We escape single quotes for the heredoc
        const escapedContent = content.replace(/'/g, "'\\''");
        conn.exec(`cat << 'EOF' > /root/nova-back/src/config/app-settings.ts\n${escapedContent}\nEOF`, (err, stream) => {
            if (err) return res.status(500).json({ error: err.message });

            stream.on('close', (code: number) => {
                conn.end();
                if (code === 0) {
                    res.json({ success: true });
                } else {
                    res.status(500).json({ error: `Process exited with code ${code}` });
                }
            });
        });
    }).on('error', (err) => {
        res.status(500).json({ error: err.message });
    }).connect(connConfig);
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
