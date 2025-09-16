// ACTUA Broadcast Generator - Web Server
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const FFmpegBuilder = require('./ffmpeg-builder');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Settings storage
let savedSettings = {
    background: 'blue',
    text: 'ACTUA PARIS',
    textPosition: 'center',
    fontSize: 80,
    textColor: 'white',
    showLogo: true,
    logoFile: null,
    logoPosition: 'top-right',
    animation: null,
    audioFreq: 1000,
    videoFormat: '1080i50'
};

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, 'uploads'));
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'logo-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    fileFilter: function (req, file, cb) {
        if (file.mimetype === 'image/png') {
            cb(null, true);
        } else {
            cb(new Error('Seuls les fichiers PNG sont acceptés'), false);
        }
    },
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB max
    }
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.json());

// FFmpeg process management
let currentFFmpegProcess = null;
const ffmpegBuilder = new FFmpegBuilder();

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/api/backgrounds', (req, res) => {
    res.json(ffmpegBuilder.getAvailableBackgrounds());
});

app.get('/api/animations', (req, res) => {
    res.json(ffmpegBuilder.getAvailableAnimations());
});

app.get('/api/text-positions', (req, res) => {
    res.json(ffmpegBuilder.getTextPositions());
});

app.get('/api/video-formats', (req, res) => {
    res.json(ffmpegBuilder.getVideoFormats());
});

app.get('/api/logo-positions', (req, res) => {
    res.json(ffmpegBuilder.getLogoPositions());
});

app.get('/api/settings', (req, res) => {
    res.json(savedSettings);
});

app.post('/api/settings', (req, res) => {
    savedSettings = { ...savedSettings, ...req.body };
    res.json({ success: true, settings: savedSettings });
});

app.post('/api/upload-logo', upload.single('logo'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Aucun fichier uploadé' });
        }

        res.json({
            success: true,
            filename: req.file.filename,
            originalname: req.file.originalname,
            size: req.file.size
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/uploaded-logos', (req, res) => {
    try {
        const uploadsDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadsDir)) {
            return res.json([]);
        }

        const files = fs.readdirSync(uploadsDir)
            .filter(file => file.endsWith('.png'))
            .map(file => ({
                filename: file,
                path: `/uploads/${file}`
            }));

        res.json(files);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/preview', (req, res) => {
    const config = req.body;
    const command = ffmpegBuilder.buildCommand(config);
    res.json({
        success: true,
        command: command.join(' '),
        config: config
    });
});

// Socket.IO for real-time control
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('start-broadcast', (config) => {
        console.log('Starting broadcast with config:', config);

        // Stop current process if running
        if (currentFFmpegProcess) {
            currentFFmpegProcess.kill('SIGTERM');
            currentFFmpegProcess = null;
        }

        try {
            const command = ffmpegBuilder.buildCommand(config);
            console.log('FFmpeg command:', command.join(' '));

            currentFFmpegProcess = spawn(command[0], command.slice(1), {
                stdio: ['pipe', 'pipe', 'pipe'],
                env: { ...process.env, DYLD_LIBRARY_PATH: process.env.DYLD_LIBRARY_PATH || '' }
            });

            currentFFmpegProcess.stdout.on('data', (data) => {
                socket.emit('ffmpeg-output', data.toString());
            });

            currentFFmpegProcess.stderr.on('data', (data) => {
                socket.emit('ffmpeg-output', data.toString());
            });

            currentFFmpegProcess.on('close', (code) => {
                console.log(`FFmpeg process exited with code ${code}`);
                socket.emit('broadcast-stopped', { code, manual: false });
                currentFFmpegProcess = null;
            });

            currentFFmpegProcess.on('error', (error) => {
                console.error('FFmpeg error:', error);
                socket.emit('broadcast-error', error.message);
                currentFFmpegProcess = null;
            });

            socket.emit('broadcast-started', { success: true });

        } catch (error) {
            console.error('Error starting broadcast:', error);
            socket.emit('broadcast-error', error.message);
        }
    });

    socket.on('stop-broadcast', () => {
        console.log('Stopping broadcast');
        if (currentFFmpegProcess) {
            currentFFmpegProcess.kill('SIGTERM');
            currentFFmpegProcess = null;
            socket.emit('broadcast-stopped', { manual: true });
        } else {
            // Process already stopped, just update UI
            socket.emit('broadcast-stopped', { manual: true, alreadyStopped: true });
        }
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('Shutting down server...');
    if (currentFFmpegProcess) {
        currentFFmpegProcess.kill('SIGTERM');
    }
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`ACTUA Broadcast Generator running on http://localhost:${PORT}`);
});