// Web Monitor Client for ACTUA Broadcast Generator
// Handles HLS streaming and video player functionality

class WebMonitorClient {
    constructor() {
        this.socket = null;
        this.hls = null;
        this.video = null;
        this.isConnected = false;
        this.isStreaming = false;
        const host = (typeof window !== 'undefined' && window.location && window.location.hostname) ? window.location.hostname : 'localhost';
        const protocol = (typeof window !== 'undefined' && window.location && window.location.protocol) ? window.location.protocol : 'http:';
        this.monitorUrl = `${protocol}//${host}:3001`;
        this.hlsUrl = `${this.monitorUrl}/hls/stream.m3u8`;

        this.init();
    }

    init() {
        this.setupElements();
        this.bindEvents();
        this.connectToServer();
    }

    setupElements() {
        this.webMonitorBtn = document.getElementById('webMonitorBtn');
        this.webMonitorPanel = document.getElementById('webMonitorPanel');
        this.closeMonitorBtn = document.getElementById('closeMonitorBtn');
        this.startMonitorBtn = document.getElementById('startMonitorBtn');
        this.stopMonitorBtn = document.getElementById('stopMonitorBtn');
        this.retryMonitorBtn = document.getElementById('retryMonitorBtn');
        this.monitorVideo = document.getElementById('monitorVideo');
        this.monitorStatus = document.getElementById('monitorStatus');
        this.monitorError = document.getElementById('monitorError');
        this.errorText = document.getElementById('errorText');
        this.monitorResolution = document.getElementById('monitorResolution');
        this.monitorBitrate = document.getElementById('monitorBitrate');
        this.monitorLatency = document.getElementById('monitorLatency');
    }

    bindEvents() {
        // Monitor panel controls
        if (this.webMonitorBtn) {
            this.webMonitorBtn.addEventListener('click', () => this.toggleMonitor());
        }

        if (this.closeMonitorBtn) {
            this.closeMonitorBtn.addEventListener('click', () => this.hideMonitor());
        }

        if (this.startMonitorBtn) {
            this.startMonitorBtn.addEventListener('click', () => this.startMonitoring());
        }

        if (this.stopMonitorBtn) {
            this.stopMonitorBtn.addEventListener('click', () => this.stopMonitoring());
        }

        if (this.retryMonitorBtn) {
            this.retryMonitorBtn.addEventListener('click', () => this.retryConnection());
        }

        // Video events
        if (this.monitorVideo) {
            this.monitorVideo.addEventListener('loadstart', () => this.updateStatus('connecting'));
            this.monitorVideo.addEventListener('canplay', () => this.updateStatus('online'));
            this.monitorVideo.addEventListener('error', (e) => this.handleVideoError(e));
            this.monitorVideo.addEventListener('waiting', () => this.updateStatus('connecting'));
            this.monitorVideo.addEventListener('playing', () => this.updateStatus('online'));
        }
    }

    connectToServer() {
        try {
            this.socket = io(this.monitorUrl);

            this.socket.on('connect', () => {
                console.log('Connected to web monitor server');
                this.isConnected = true;
                this.updateConnectionStatus();
            });

            this.socket.on('disconnect', () => {
                console.log('Disconnected from web monitor server');
                this.isConnected = false;
                this.updateConnectionStatus();
            });

            this.socket.on('stream-status', (data) => {
                this.isStreaming = data.isStreaming;
                if (data.isStreaming) {
                    this.loadStream(data.hlsUrl);
                } else {
                    this.stopStream();
                }
            });

        } catch (error) {
            console.error('Failed to connect to web monitor server:', error);
            this.showError('Unable to connect to monitor server. Make sure the web monitor server is running.');
        }
    }

    toggleMonitor() {
        if (!this.webMonitorPanel) return;

        if (this.webMonitorPanel.style.display === 'none' || this.webMonitorPanel.style.display === '') {
            this.showMonitor();
        } else {
            this.hideMonitor();
        }
    }

    showMonitor() {
        if (!this.webMonitorPanel) return;

        this.webMonitorPanel.style.display = 'block';
        this.updateConnectionStatus();

        // Smooth scroll to monitor
        this.webMonitorPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    hideMonitor() {
        if (!this.webMonitorPanel) return;

        this.webMonitorPanel.style.display = 'none';
        this.stopStream();
    }

    updateConnectionStatus() {
        if (!this.monitorStatus) return;

        if (!this.isConnected) {
            this.monitorStatus.textContent = '● Offline';
            this.monitorStatus.className = 'status-indicator status-offline';
            this.showError('Monitor server is not running. Please start the web monitor server.');
        } else if (this.isStreaming) {
            this.monitorStatus.textContent = '● Online';
            this.monitorStatus.className = 'status-indicator status-online';
            this.hideError();
        } else {
            this.monitorStatus.textContent = '● Ready';
            this.monitorStatus.className = 'status-indicator status-offline';
        }
    }

    updateStatus(status) {
        if (!this.monitorStatus) return;

        switch (status) {
            case 'connecting':
                this.monitorStatus.textContent = '● Connecting';
                this.monitorStatus.className = 'status-indicator status-connecting';
                break;
            case 'online':
                this.monitorStatus.textContent = '● Online';
                this.monitorStatus.className = 'status-indicator status-online';
                this.hideError();
                break;
            case 'offline':
                this.monitorStatus.textContent = '● Offline';
                this.monitorStatus.className = 'status-indicator status-offline';
                break;
            case 'error':
                this.monitorStatus.textContent = '● Error';
                this.monitorStatus.className = 'status-indicator status-error';
                break;
        }
    }

    startMonitoring() {
        if (!this.socket || !this.isConnected) {
            this.showError('Monitor server is not connected. Please check the server status.');
            return;
        }

        this.socket.emit('start-monitoring');
        this.startMonitorBtn.disabled = true;
        this.stopMonitorBtn.disabled = false;
    }

    stopMonitoring() {
        if (!this.socket || !this.isConnected) {
            return;
        }

        this.socket.emit('stop-monitoring');
        this.startMonitorBtn.disabled = false;
        this.stopMonitorBtn.disabled = true;
        this.stopStream();
    }

    loadStream(hlsUrl = this.hlsUrl) {
        if (!this.monitorVideo) return;

        // Destroy existing HLS instance
        if (this.hls) {
            this.hls.destroy();
        }

        // Check if HLS.js is supported
        if (Hls.isSupported()) {
            this.hls = new Hls({
                debug: false,
                enableWorker: true,
                lowLatencyMode: true,
                backBufferLength: 90
            });

            this.hls.loadSource(hlsUrl);
            this.hls.attachMedia(this.monitorVideo);

            this.hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
                console.log('HLS manifest parsed, found ' + data.levels.length + ' quality levels');
                this.monitorVideo.play().catch(e => {
                    console.log('Autoplay prevented:', e);
                });
            });

            this.hls.on(Hls.Events.ERROR, (event, data) => {
                console.error('HLS error:', data);
                if (data.fatal) {
                    this.handleHLSError(data);
                }
            });

            this.hls.on(Hls.Events.FRAG_LOADED, (event, data) => {
                this.updateStreamInfo(data.stats);
            });

        } else if (this.monitorVideo.canPlayType('application/vnd.apple.mpegurl')) {
            // Native HLS support (Safari)
            this.monitorVideo.src = hlsUrl;
            this.monitorVideo.addEventListener('loadedmetadata', () => {
                this.monitorVideo.play().catch(e => {
                    console.log('Autoplay prevented:', e);
                });
            });
        } else {
            this.showError('HLS streaming is not supported in this browser.');
        }
    }

    stopStream() {
        if (this.hls) {
            this.hls.destroy();
            this.hls = null;
        }

        if (this.monitorVideo) {
            this.monitorVideo.src = '';
            this.monitorVideo.load();
        }

        this.updateStatus('offline');
    }

    handleHLSError(data) {
        let errorMessage = 'Streaming error occurred';

        switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
                errorMessage = 'Network error - unable to load stream';
                break;
            case Hls.ErrorTypes.MEDIA_ERROR:
                errorMessage = 'Media error - stream format issue';
                break;
            case Hls.ErrorTypes.MUX_ERROR:
                errorMessage = 'Muxing error - stream encoding issue';
                break;
            case Hls.ErrorTypes.OTHER_ERROR:
                errorMessage = 'Unknown streaming error';
                break;
        }

        this.showError(errorMessage);
        this.updateStatus('error');
    }

    handleVideoError(event) {
        const video = event.target;
        let errorMessage = 'Video playback error';

        if (video.error) {
            switch (video.error.code) {
                case video.error.MEDIA_ERR_NETWORK:
                    errorMessage = 'Network error while loading video';
                    break;
                case video.error.MEDIA_ERR_SRC_NOT_SUPPORTED:
                    errorMessage = 'Video format not supported';
                    break;
                case video.error.MEDIA_ERR_DECODE:
                    errorMessage = 'Video decoding error';
                    break;
                default:
                    errorMessage = 'Unknown video error';
                    break;
            }
        }

        this.showError(errorMessage);
        this.updateStatus('error');
    }

    updateStreamInfo(stats) {
        if (!stats) return;

        // Update bitrate
        if (stats.total) {
            const bitrate = Math.round((stats.loaded * 8) / stats.total);
            this.monitorBitrate.textContent = `${bitrate} kbps`;
        }

        // Update latency (estimated)
        if (stats.loading && stats.parsing) {
            const latency = Math.round(stats.loading.end - stats.loading.start);
            this.monitorLatency.textContent = `${latency} ms`;
        }
    }

    showError(message) {
        if (this.errorText) {
            this.errorText.textContent = message;
        }
        if (this.monitorError) {
            this.monitorError.style.display = 'block';
        }
    }

    hideError() {
        if (this.monitorError) {
            this.monitorError.style.display = 'none';
        }
    }

    retryConnection() {
        this.hideError();
        this.updateStatus('connecting');

        if (this.socket && this.isConnected) {
            this.startMonitoring();
        } else {
            this.connectToServer();
        }
    }

    destroy() {
        this.stopStream();

        if (this.socket) {
            this.socket.disconnect();
        }
    }
}

// Initialize web monitor client when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.webMonitorClient = new WebMonitorClient();
});

// Export for potential use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WebMonitorClient;
}
