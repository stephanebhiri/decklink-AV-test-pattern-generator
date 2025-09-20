// ACTUA Broadcast Generator - Web Server
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { spawn, spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const FFmpegBuilder = require('./ffmpeg-builder');
const ffmpegBuilder = new FFmpegBuilder();

const CLOCK_PIPELINE_LATENCY_MS = 200;
const NTP_SERVERS = [
    'time.cloudflare.com',
    'time.google.com',
    'time.nist.gov'
];

let currentNtpStatus = {
    source: ffmpegBuilder.ntpSource,
    offsetMs: ffmpegBuilder.ntpOffsetMs,
    dispersionMs: ffmpegBuilder.ntpDispersionMs,
    timestamp: ffmpegBuilder.ntpLastSync
};

function queryNtp(host) {
    try {
        const result = spawnSync('/usr/bin/sntp', [host], {
            encoding: 'utf8',
            timeout: 7000
        });

        if (result.error) {
            throw result.error;
        }

        if (typeof result.status === 'number' && result.status !== 0) {
            return null;
        }

        const output = `${result.stdout || ''}`.trim();
        const lines = output.split('\n').filter(Boolean);
        if (lines.length === 0) {
            return null;
        }

        const dataLine = lines[lines.length - 1];
        const offsetMatch = dataLine.match(/([+-]?\d+\.\d+)\s+\+\/\-/);
        if (!offsetMatch) {
            return null;
        }

        const dispersionMatch = dataLine.match(/\+\/\-\s+([0-9.]+)/);

        const offsetSeconds = parseFloat(offsetMatch[1]);
        const dispersionSeconds = dispersionMatch ? parseFloat(dispersionMatch[1]) : null;

        if (!Number.isFinite(offsetSeconds)) {
            return null;
        }

        return {
            source: host,
            offsetMs: offsetSeconds * 1000,
            dispersionMs: Number.isFinite(dispersionSeconds) ? dispersionSeconds * 1000 : null,
            timestamp: Date.now()
        };
    } catch (error) {
        console.warn(`Failed to query NTP server ${host}:`, error.message || error);
        return null;
    }
}

function refreshClockSync() {
    for (const host of NTP_SERVERS) {
        const measurement = queryNtp(host);
        if (measurement) {
            currentNtpStatus = measurement;
            ffmpegBuilder.setClockTimingInfo({
                ntpOffsetMs: measurement.offsetMs,
                ntpSource: measurement.source,
                ntpDispersionMs: measurement.dispersionMs,
                ntpTimestamp: measurement.timestamp
            }, { freezeEpoch: true });
            console.log(`Clock sync via ${measurement.source}: offset ${measurement.offsetMs.toFixed(2)}ms`);
            return;
        }
    }

    // Fallback to system clock if all NTP queries fail
    currentNtpStatus = {
        source: 'system clock',
        offsetMs: 0,
        dispersionMs: null,
        timestamp: Date.now()
    };

    ffmpegBuilder.setClockTimingInfo({
        ntpOffsetMs: 0,
        ntpSource: currentNtpStatus.source,
        ntpDispersionMs: null,
        ntpTimestamp: currentNtpStatus.timestamp
    }, { freezeEpoch: true });
}

refreshClockSync();
setInterval(refreshClockSync, 15 * 60 * 1000);

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const DEFAULT_CONFIG = {
    background: 'bars',
    customBackground: null,
    text: 'ACTUA PARIS',
    textPosition: 'top-right',
    fontSize: 96,
    fontFamily: 'arial_bold',
    textWeight: 'normal',
    textColor: 'white',
    textBackground: 'black_solid',
    showLogo: true,
    logoFile: null,
    logoPosition: 'top-left',
    animation: null,
    audioFreq: 1000,
    audioLevelDb: 0,
    audioChannels: 8,
    audioChannelMap: new Array(8).fill(true),
    audioChannelIdCycle: [false, false, true, false, false, false, true, false],
    audioChannelFlash: [false, true, false, false, false, true, false, false],
    audioChannelForce400: [false, false, false, true, false, false, false, true],
    videoFormat: '1080i50',
    showClock: false,
    clockPosition: 'bottom-right',
    showConfigOverlay: true,
    configOverlayFontSize: 36,
    configOverlayPosition: 'top-left',
    flashOverlayOffset: 25,
    decklinkDevice: null,
    clockLatencyMs: CLOCK_PIPELINE_LATENCY_MS
};

const DEFAULT_PRESETS = {
    Actua: {
        background: 'bars',
        customBackground: null,
        text: 'ACTUA PARIS',
        textPosition: 'top-right',
        fontSize: 96,
        fontFamily: 'arial_bold',
        textWeight: 'normal',
        textColor: 'white',
        textBackground: 'black_solid',
        showLogo: true,
        logoFile: null,
        logoPosition: 'top-left',
        animation: null,
        audioFreq: 1000,
        audioLevelDb: '0',
        audioChannels: 8,
        audioChannelMap: new Array(8).fill(true),
        audioChannelIdCycle: [false, false, true, false, false, false, true, false],
        audioChannelFlash: [false, true, false, false, false, true, false, false],
        audioChannelForce400: [false, false, false, true, false, false, false, true],
        videoFormat: '1080i50',
        showClock: false,
        clockPosition: 'bottom-right',
        showConfigOverlay: true,
        configOverlayFontSize: 36,
        configOverlayPosition: 'top-left'
    }
};

function normalizeBooleanArray(source, length = 8, fallbackTrue = false) {
    const normalized = Array.isArray(source)
        ? source.slice(0, length).map(Boolean)
        : new Array(length).fill(Boolean(fallbackTrue));

    while (normalized.length < length) {
        normalized.push(Boolean(fallbackTrue));
    }

    return normalized;
}

function sanitizeAudioChannelMap(map) {
    const normalized = normalizeBooleanArray(map, 8, false);
    if (!normalized.some(Boolean)) {
        normalized[0] = true;
        if (normalized.length > 1) {
            normalized[1] = true;
        }
    }
    return normalized;
}

function sanitizeConfig(config = {}) {
    const merged = { ...DEFAULT_CONFIG, ...config };

    if (merged.audioChannelFlash === undefined && Array.isArray(config.audioChannelIdPop)) {
        merged.audioChannelFlash = config.audioChannelIdPop.slice(0, 8).map(Boolean);
    }

    if (merged.flashOverlayOffset === undefined && config.popFlashOffset !== undefined) {
        merged.flashOverlayOffset = config.popFlashOffset;
    }

    merged.audioChannelMap = sanitizeAudioChannelMap(merged.audioChannelMap);
    merged.audioChannelIdCycle = normalizeBooleanArray(merged.audioChannelIdCycle, 8, false);
    merged.audioChannelFlash = normalizeBooleanArray(merged.audioChannelFlash, 8, false);
    merged.audioChannelForce400 = normalizeBooleanArray(merged.audioChannelForce400, 8, false);

    merged.audioChannels = Math.max(1, merged.audioChannelMap.filter(Boolean).length);

    const allowedFonts = new Set(['sf_mono', 'arial_bold', 'arial_black', 'impact']);
    if (!allowedFonts.has(merged.fontFamily)) {
        merged.fontFamily = DEFAULT_CONFIG.fontFamily;
    }

    const allowedWeights = new Set(['normal', 'semi', 'heavy']);
    if (!allowedWeights.has(merged.textWeight)) {
        merged.textWeight = DEFAULT_CONFIG.textWeight;
    }

    const allowedBackgrounds = new Set(['none', 'black_solid', 'black_soft', 'white_soft', 'yellow_soft', 'blue_soft']);
    if (!allowedBackgrounds.has(merged.textBackground)) {
        merged.textBackground = DEFAULT_CONFIG.textBackground;
    }

    if (typeof merged.fontSize !== 'number' || Number.isNaN(merged.fontSize)) {
        merged.fontSize = DEFAULT_CONFIG.fontSize;
    }

    if (!merged.text || typeof merged.text !== 'string') {
        merged.text = DEFAULT_CONFIG.text;
    }

    if (!merged.textColor || typeof merged.textColor !== 'string') {
        merged.textColor = DEFAULT_CONFIG.textColor;
    }

    if (!merged.clockPosition) {
        merged.clockPosition = DEFAULT_CONFIG.clockPosition;
    }

    merged.showClock = Boolean(merged.showClock);
    merged.showConfigOverlay = Boolean(merged.showConfigOverlay);
    merged.showLogo = merged.showLogo !== false;

    const overlaySize = Number(merged.configOverlayFontSize);
    if (Number.isFinite(overlaySize)) {
        const clamped = Math.min(160, Math.max(16, Math.round(overlaySize)));
        merged.configOverlayFontSize = clamped;
    } else {
        merged.configOverlayFontSize = null;
    }

    const flashOffset = Number(merged.flashOverlayOffset);
    if (Number.isFinite(flashOffset)) {
        merged.flashOverlayOffset = Math.max(-100, Math.min(100, Math.round(flashOffset)));
    } else {
        merged.flashOverlayOffset = DEFAULT_CONFIG.flashOverlayOffset;
    }

    const allowedOverlayPositions = new Set([
        'top-left',
        'top-center',
        'top-right',
        'center-left',
        'center',
        'center-right',
        'bottom-left',
        'bottom-center',
        'bottom-right'
    ]);
    if (!allowedOverlayPositions.has(merged.configOverlayPosition)) {
        merged.configOverlayPosition = DEFAULT_CONFIG.configOverlayPosition;
    }

    const latencyValue = Number(merged.clockLatencyMs);
    if (Number.isFinite(latencyValue)) {
        merged.clockLatencyMs = Math.max(0, Math.min(5000, Math.round(latencyValue)));
    } else {
        merged.clockLatencyMs = DEFAULT_CONFIG.clockLatencyMs;
    }

    const requestedDecklink = typeof merged.decklinkDevice === 'string'
        ? merged.decklinkDevice.trim()
        : '';

    if (requestedDecklink.length === 0) {
        merged.decklinkDevice = null;
    } else {
        try {
            merged.decklinkDevice = ffmpegBuilder.resolveDecklinkTarget(requestedDecklink);
        } catch (err) {
            merged.decklinkDevice = null;
        }
    }

    return merged;
}

// Settings storage
let savedSettings = sanitizeConfig(DEFAULT_CONFIG);

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
            cb(new Error('Only PNG files are accepted'), false);
        }
    },
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB max
    }
});

// Background upload configuration
const backgroundStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = path.join(__dirname, 'uploads', 'backgrounds');
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'bg-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const backgroundUpload = multer({
    storage: backgroundStorage,
    fileFilter: function (req, file, cb) {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are accepted'), false);
        }
    },
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB max
    }
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.json());

// Presets management
const presetsFile = path.join(__dirname, 'presets.json');
let savedPresets = {};

// Load presets from file
function loadPresets() {
    try {
        if (fs.existsSync(presetsFile)) {
            const data = fs.readFileSync(presetsFile, 'utf8');
            const parsed = JSON.parse(data);
            savedPresets = Object.keys(parsed).reduce((acc, key) => {
                const preset = parsed[key] || {};
                const { createdAt, ...rest } = preset;
                acc[key] = {
                    ...sanitizeConfig(rest),
                    createdAt: createdAt || new Date().toISOString()
                };
                return acc;
            }, {});
        }
    } catch (error) {
        console.error('Error loading presets:', error);
        savedPresets = {};
    }
}

// Save presets to file
function savePresets() {
    try {
        fs.writeFileSync(presetsFile, JSON.stringify(savedPresets, null, 2));
    } catch (error) {
        console.error('Error saving presets:', error);
    }
}

// Load presets on startup
loadPresets();
if (Object.keys(savedPresets).length === 0) {
    savedPresets = Object.entries(DEFAULT_PRESETS).reduce((acc, [name, preset]) => {
        acc[name] = {
            ...sanitizeConfig(preset),
            createdAt: new Date().toISOString()
        };
        return acc;
    }, {});
    savePresets();
}

// FFmpeg process management
let currentFFmpegProcess = null;
let pendingRestart = null;
let pendingCloseReason = null;
let currentFFmpegConfig = null;
let currentFFmpegStartedAt = null;
let ffmpegLogBuffer = [];
let ffmpegLogSize = 0;
const MAX_LOG_BUFFER_CHARS = 50000;

function appendToLog(message) {
    if (!message) {
        return;
    }

    const text = String(message);
    ffmpegLogBuffer.push(text);
    ffmpegLogSize += text.length;

    while (ffmpegLogSize > MAX_LOG_BUFFER_CHARS && ffmpegLogBuffer.length > 1) {
        const removed = ffmpegLogBuffer.shift();
        ffmpegLogSize -= removed.length;
    }

    io.emit('ffmpeg-output', text);
}

function startFFmpegProcess(config, socket, options = {}) {
    try {
        const cleanConfig = sanitizeConfig(config);
        savedSettings = cleanConfig;
        ffmpegBuilder.setClockTimingInfo({
            latencyMs: cleanConfig.clockLatencyMs,
            ntpOffsetMs: currentNtpStatus.offsetMs,
            ntpSource: currentNtpStatus.source,
            ntpDispersionMs: currentNtpStatus.dispersionMs,
            ntpTimestamp: currentNtpStatus.timestamp
        });
        const command = ffmpegBuilder.buildCommand(cleanConfig);
        console.log('FFmpeg command:', command.join(' '));

        pendingCloseReason = null;
        currentFFmpegProcess = spawn(command[0], command.slice(1), {
            stdio: ['pipe', 'pipe', 'pipe'],
            env: { ...process.env, DYLD_LIBRARY_PATH: process.env.DYLD_LIBRARY_PATH || '' }
        });
        currentFFmpegConfig = cleanConfig;
        currentFFmpegStartedAt = Date.now();
        ffmpegLogBuffer = [];
        ffmpegLogSize = 0;
        appendToLog(`🚀 FFmpeg started at ${new Date(currentFFmpegStartedAt).toISOString()}\n`);
        appendToLog(`🔧 Command: ${command.join(' ')}\n`);

        currentFFmpegProcess.stdout.on('data', (data) => {
            appendToLog(data.toString());
        });

        currentFFmpegProcess.stderr.on('data', (data) => {
            appendToLog(data.toString());
        });

        currentFFmpegProcess.on('close', (code) => {
            console.log(`FFmpeg process exited with code ${code}`);
            const reason = pendingCloseReason;
            pendingCloseReason = null;

            const restartRequest = pendingRestart;
            pendingRestart = null;
            currentFFmpegProcess = null;
            currentFFmpegStartedAt = null;

            if (reason === 'restart' && restartRequest) {
                console.log('Restarting FFmpeg with updated configuration');
                startFFmpegProcess(restartRequest.config, restartRequest.socket, { restarted: true });
                return;
            }

            appendToLog(`⏹️ FFmpeg stopped (code: ${code})\n`);
            io.emit('broadcast-stopped', { code, manual: reason === 'manual' });
            currentFFmpegConfig = null;
        });

        currentFFmpegProcess.on('error', (error) => {
            console.error('FFmpeg error:', error);
            socket.emit('broadcast-error', error.message);
            currentFFmpegProcess = null;
            pendingCloseReason = null;
            pendingRestart = null;
            currentFFmpegStartedAt = null;
            appendToLog(`❌ FFmpeg error: ${error.message}\n`);
        });

        setTimeout(() => {
            if (currentFFmpegProcess && !currentFFmpegProcess.killed) {
                io.emit('broadcast-started', {
                    success: true,
                    restarted: options.restarted === true,
                    config: currentFFmpegConfig,
                    startedAt: currentFFmpegStartedAt
                });
                socket.emit('ack-started', { success: true, restarted: options.restarted === true });
            }
        }, 1000);

    } catch (error) {
        console.error('Error starting broadcast:', error);
        socket.emit('broadcast-error', error.message);
        currentFFmpegProcess = null;
        pendingCloseReason = null;
        pendingRestart = null;
    }
}

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

app.get('/api/decklink-sinks', (req, res) => {
    res.json(ffmpegBuilder.getDecklinkDevices());
});

app.get('/api/logo-positions', (req, res) => {
    res.json(ffmpegBuilder.getLogoPositions());
});

app.get('/api/overlay-positions', (req, res) => {
    res.json(ffmpegBuilder.getOverlayPositions());
});

app.get('/api/audio-channels', (req, res) => {
    res.json(ffmpegBuilder.getAudioChannelMetadata());
});

app.get('/api/status', (req, res) => {
    const { spawn } = require('child_process');

    // Check for actual running FFmpeg processes
    const psProcess = spawn('pgrep', ['-f', 'ffmpeg.*UltraStudio']);
    let pids = '';

    psProcess.stdout.on('data', (data) => {
        pids += data.toString();
    });

    psProcess.on('close', (code) => {
        const pidList = pids.trim().split('\n').filter(pid => pid);
        const isRunning = pidList.length > 0;

    res.json({
        isRunning: isRunning,
        pid: pidList.length > 0 ? pidList[0] : null,
        processCount: pidList.length,
        startedAt: currentFFmpegStartedAt,
        config: currentFFmpegConfig,
        clockSync: currentNtpStatus
    });
});
});

app.get('/api/settings', (req, res) => {
    res.json(savedSettings);
});

app.post('/api/settings', (req, res) => {
    savedSettings = sanitizeConfig({ ...savedSettings, ...req.body });
    res.json({ success: true, settings: savedSettings });
});

// Presets routes
app.get('/api/presets', (req, res) => {
    res.json(savedPresets);
});

app.post('/api/presets', (req, res) => {
    const { name, config } = req.body;
    if (!name || !config) {
        return res.status(400).json({ error: 'Name and config are required' });
    }

    const cleanConfig = sanitizeConfig(config);

    savedPresets[name] = {
        ...cleanConfig,
        createdAt: new Date().toISOString()
    };
    savePresets();
    res.json({ success: true, presets: savedPresets });
});

app.delete('/api/presets/:name', (req, res) => {
    const { name } = req.params;
    if (savedPresets[name]) {
        delete savedPresets[name];
        savePresets();
        res.json({ success: true, presets: savedPresets });
    } else {
        res.status(404).json({ error: 'Preset not found' });
    }
});

app.post('/api/upload-logo', upload.single('logo'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
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

app.post('/api/upload-background', backgroundUpload.single('background'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
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

app.get('/api/uploaded-backgrounds', (req, res) => {
    try {
        const dir = path.join(__dirname, 'uploads', 'backgrounds');
        if (!fs.existsSync(dir)) {
            return res.json([]);
        }

        const allowedExtensions = new Set(['.png', '.jpg', '.jpeg', '.svg']);
        const files = fs.readdirSync(dir)
            .filter(file => allowedExtensions.has(path.extname(file).toLowerCase()))
            .map(file => ({
                filename: file,
                path: `/uploads/backgrounds/${file}`
            }));

        res.json(files);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/preview', (req, res) => {
    const config = sanitizeConfig(req.body);
    ffmpegBuilder.setClockTimingInfo({
        latencyMs: config.clockLatencyMs,
        ntpOffsetMs: currentNtpStatus.offsetMs,
        ntpSource: currentNtpStatus.source,
        ntpDispersionMs: currentNtpStatus.dispersionMs,
        ntpTimestamp: currentNtpStatus.timestamp
    }, { freezeEpoch: true });
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

    socket.emit('ffmpeg-log-history', ffmpegLogBuffer.join(''));
    socket.emit('broadcast-state', {
        isRunning: Boolean(currentFFmpegProcess),
        startedAt: currentFFmpegStartedAt,
        config: currentFFmpegConfig
    });

    socket.on('start-broadcast', (config) => {
        const cleanConfig = sanitizeConfig(config);
        console.log('Starting broadcast with config:', cleanConfig);

        if (currentFFmpegProcess && !currentFFmpegProcess.killed) {
            console.log('FFmpeg is already running, rejecting new request');
            socket.emit('broadcast-error', 'A broadcast is already running. Stop it before starting another.');
            return;
        }

        pendingRestart = null;
        startFFmpegProcess(cleanConfig, socket);
    });

    socket.on('stop-broadcast', () => {
        console.log('Stopping broadcast');
        pendingRestart = null;

        if (currentFFmpegProcess) {
            pendingCloseReason = 'manual';
            currentFFmpegProcess.kill('SIGTERM');
        } else {
            // No process reference, try to kill via pkill (for post-refresh scenarios)
            console.log('No process reference, attempting pkill');
            const { spawn } = require('child_process');
            const killProcess = spawn('pkill', ['-f', 'ffmpeg.*UltraStudio']);

            killProcess.on('close', (code) => {
                console.log('pkill ffmpeg (stop) exit code:', code);
                if (code === 0) {
                    appendToLog('⏹️ FFmpeg stopped via pkill\n');
                    currentFFmpegConfig = null;
                    io.emit('broadcast-stopped', { manual: true, killed: true });
                } else {
                    socket.emit('broadcast-stopped', { manual: true, alreadyStopped: true });
                }
            });
        }
    });

    socket.on('kill-ffmpeg', () => {
        console.log('Emergency kill FFmpeg requested');
        const { spawn } = require('child_process');

        // Kill all FFmpeg processes
        const killProcess = spawn('pkill', ['-f', 'ffmpeg']);

        killProcess.on('close', (code) => {
            console.log('pkill ffmpeg exit code:', code);
            currentFFmpegProcess = null;
            pendingRestart = null;
            pendingCloseReason = null;
            currentFFmpegStartedAt = null;
            currentFFmpegConfig = null;
            appendToLog('⏹️ FFmpeg emergency kill\n');
            io.emit('broadcast-stopped', { manual: true, killed: true });
        });
    });

    socket.on('apply-broadcast-settings', (config) => {
        const cleanConfig = sanitizeConfig(config);
        console.log('Applying new broadcast settings');

        if (currentFFmpegProcess && !currentFFmpegProcess.killed) {
            pendingRestart = { config: cleanConfig, socket };
            pendingCloseReason = 'restart';
            currentFFmpegProcess.kill('SIGTERM');
        } else {
            pendingRestart = null;
            startFFmpegProcess(cleanConfig, socket);
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
