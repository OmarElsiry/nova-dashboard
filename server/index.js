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
        origin: "http://localhost:5173", // Vite default
        methods: ["GET", "POST"]
    }
});
const connConfig = {
    host: process.env.VPS_HOST,
    port: parseInt(process.env.VPS_PORT || '22'),
    username: process.env.VPS_USER,
    password: process.env.VPS_PASS,
};
io.on('connection', (socket) => {
    console.log('Client connected to socket');
    const conn = new Client();
    socket.on('start-ssh', () => {
        conn.on('ready', () => {
            socket.emit('ssh-ready');
            conn.shell((err, stream) => {
                if (err)
                    return socket.emit('error', err.message);
                socket.on('data', (data) => {
                    stream.write(data);
                });
                stream.on('data', (data) => {
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
            if (err)
                return res.status(500).json({ error: err.message });
            let data = '';
            stream.on('data', (chunk) => {
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
const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
//# sourceMappingURL=index.js.map