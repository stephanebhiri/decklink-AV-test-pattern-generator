// Canvas-based Visual Preview Renderer for ACTUA Broadcast Generator
// This renders broadcast signals without using FFmpeg, avoiding encoding overhead

class PreviewRenderer {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.isInitialized = false;
        this.animationFrame = null;
        this.lastRenderTime = 0;
        this.renderThrottle = 100; // Throttle renders to 10 FPS for performance

        // Video format specifications
        this.formats = {
            '1080i50': { width: 1920, height: 1080, fps: 25 },
            '1080i60': { width: 1920, height: 1080, fps: 30 },
            '1080p25': { width: 1920, height: 1080, fps: 25 },
            '1080p30': { width: 1920, height: 1080, fps: 30 },
            '720p50': { width: 1280, height: 720, fps: 50 },
            '720p60': { width: 1280, height: 720, fps: 60 }
        };

        this.currentFormat = '1080i50';
        this.previewScale = 0.3; // Scale down for preview
        this.displayWidth = 576; // 1920 * 0.3
        this.displayHeight = 324; // 1080 * 0.3

        this.init();
    }

    init() {
        this.canvas = document.getElementById('broadcastCanvas');
        if (!this.canvas) {
            console.error('Broadcast canvas not found');
            return;
        }

        this.ctx = this.canvas.getContext('2d');
        this.setupCanvas();
        this.bindEvents();
        this.isInitialized = true;
    }

    setupCanvas() {
        const format = this.formats[this.currentFormat];
        this.canvas.width = this.displayWidth;
        this.canvas.height = this.displayHeight;

        // Set canvas CSS size
        this.canvas.style.width = this.displayWidth + 'px';
        this.canvas.style.height = this.displayHeight + 'px';

        // Enable image smoothing for better text rendering
        this.ctx.imageSmoothingEnabled = true;
        this.ctx.imageSmoothingQuality = 'high';
    }

    bindEvents() {
        // Preview panel controls
        const visualPreviewBtn = document.getElementById('visualPreviewBtn');
        const closePreviewBtn = document.getElementById('closePreviewBtn');
        const refreshPreviewBtn = document.getElementById('refreshPreviewBtn');
        const autoUpdatePreview = document.getElementById('autoUpdatePreview');

        if (visualPreviewBtn) {
            visualPreviewBtn.addEventListener('click', () => this.togglePreview());
        }

        if (closePreviewBtn) {
            closePreviewBtn.addEventListener('click', () => this.hidePreview());
        }

        if (refreshPreviewBtn) {
            refreshPreviewBtn.addEventListener('click', () => this.render());
        }

        if (autoUpdatePreview) {
            autoUpdatePreview.addEventListener('change', (e) => {
                if (e.target.checked) {
                    this.bindControlListeners();
                } else {
                    this.unbindControlListeners();
                }
            });
        }

        // Initial bind if auto-update is enabled
        if (autoUpdatePreview && autoUpdatePreview.checked) {
            this.bindControlListeners();
        }
    }

    bindControlListeners() {
        // Listen to all control changes for auto-update
        const controls = [
            'background', 'text', 'fontSize', 'fontFamily', 'textWeight', 'textColor',
            'textBackground', 'textPosition', 'showLogo', 'logoPosition', 'videoFormat',
            'showClock', 'clockPosition', 'showConfigOverlay', 'animation'
        ];

        controls.forEach(controlId => {
            const element = document.getElementById(controlId);
            if (element) {
                element.addEventListener('change', () => this.debouncedRender());
                element.addEventListener('input', () => this.debouncedRender());
            }
        });

        // Special handling for checkboxes
        ['showLogo', 'showClock', 'showConfigOverlay'].forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('change', () => this.debouncedRender());
            }
        });
    }

    unbindControlListeners() {
        // Note: In a real implementation, you'd want to store the listeners and remove them
        // For now, we'll just rely on the debounced render not being called
    }

    debouncedRender() {
        clearTimeout(this.renderTimeout);
        this.renderTimeout = setTimeout(() => this.render(), 300);
    }

    togglePreview() {
        const panel = document.getElementById('visualPreviewPanel');
        if (!panel) return;

        if (panel.style.display === 'none' || panel.style.display === '') {
            this.showPreview();
        } else {
            this.hidePreview();
        }
    }

    showPreview() {
        const panel = document.getElementById('visualPreviewPanel');
        if (!panel) return;

        panel.style.display = 'block';
        this.render();

        // Smooth scroll to preview
        panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    hidePreview() {
        const panel = document.getElementById('visualPreviewPanel');
        if (!panel) return;

        panel.style.display = 'none';
        this.stopAnimation();
    }

    updateFormat(format) {
        if (!this.formats[format]) return;

        this.currentFormat = format;
        const spec = this.formats[format];

        // Calculate preview scale to fit within reasonable bounds
        const maxPreviewWidth = 600;
        const maxPreviewHeight = 400;
        const scaleX = maxPreviewWidth / spec.width;
        const scaleY = maxPreviewHeight / spec.height;
        this.previewScale = Math.min(scaleX, scaleY, 1);

        this.displayWidth = Math.floor(spec.width * this.previewScale);
        this.displayHeight = Math.floor(spec.height * this.previewScale);

        this.setupCanvas();

        // Update info display
        document.getElementById('previewResolution').textContent = `${spec.width}x${spec.height}`;
        document.getElementById('previewFormat').textContent = format;
    }

    render() {
        if (!this.isInitialized || !this.ctx) return;

        // Clear canvas
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Get current settings
        const settings = this.getCurrentSettings();

        // Update format if changed
        if (settings.videoFormat !== this.currentFormat) {
            this.updateFormat(settings.videoFormat);
        }

        // Render background
        this.renderBackground(settings);

        // Render text
        this.renderText(settings);

        // Render logo
        this.renderLogo(settings);

        // Render clock
        this.renderClock(settings);

        // Render config overlay
        this.renderConfigOverlay(settings);

        // Render animation if active
        this.renderAnimation(settings);
    }

    getCurrentSettings() {
        return {
            background: document.getElementById('background')?.value || 'blue',
            text: document.getElementById('text')?.value || 'ACTUA PARIS',
            fontSize: parseInt(document.getElementById('fontSize')?.value) || 80,
            fontFamily: document.getElementById('fontFamily')?.value || 'sf_mono',
            textWeight: document.getElementById('textWeight')?.value || 'normal',
            textColor: document.getElementById('textColor')?.value || 'white',
            textBackground: document.getElementById('textBackground')?.value || 'none',
            textPosition: document.getElementById('textPosition')?.value || 'center',
            showLogo: document.getElementById('showLogo')?.checked || true,
            logoPosition: document.getElementById('logoPosition')?.value || 'top-right',
            videoFormat: document.getElementById('videoFormat')?.value || '1080i50',
            showClock: document.getElementById('showClock')?.checked || false,
            clockPosition: document.getElementById('clockPosition')?.value || 'bottom-right',
            showConfigOverlay: document.getElementById('showConfigOverlay')?.checked || false,
            animation: document.getElementById('animation')?.value || null
        };
    }

    renderBackground(settings) {
        const { background } = settings;
        const { width, height } = this.formats[this.currentFormat];

        switch (background) {
            case 'blue':
                this.renderSolidColor('#001133');
                break;
            case 'black':
                this.renderSolidColor('#000000');
                break;
            case 'white':
                this.renderSolidColor('#FFFFFF');
                break;
            case 'red':
                this.renderSolidColor('#FF0000');
                break;
            case 'green':
                this.renderSolidColor('#00FF00');
                break;
            case 'bars':
                this.renderColorBars(width, height);
                break;
            case 'smpte':
                this.renderSMPTEBars(width, height);
                break;
            case 'custom':
                this.renderCustomBackground();
                break;
            default:
                this.renderSolidColor('#001133');
        }
    }

    renderSolidColor(color) {
        this.ctx.fillStyle = color;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    renderColorBars(width, height) {
        const barWidth = this.canvas.width / 7;
        const colors = ['#FFFFFF', '#FFFF00', '#00FFFF', '#00FF00', '#FF00FF', '#FF0000', '#0000FF'];

        colors.forEach((color, index) => {
            this.ctx.fillStyle = color;
            this.ctx.fillRect(index * barWidth, 0, barWidth, this.canvas.height);
        });
    }

    renderSMPTEBars(width, height) {
        // Simplified SMPTE color bars for preview
        const segments = [
            { color: '#FFFFFF', width: 0.1 },
            { color: '#FFFF00', width: 0.1 },
            { color: '#00FFFF', width: 0.1 },
            { color: '#00FF00', width: 0.1 },
            { color: '#FF00FF', width: 0.1 },
            { color: '#FF0000', width: 0.1 },
            { color: '#0000FF', width: 0.4 }
        ];

        let x = 0;
        segments.forEach(segment => {
            const segmentWidth = segment.width * this.canvas.width;
            this.ctx.fillStyle = segment.color;
            this.ctx.fillRect(x, 0, segmentWidth, this.canvas.height);
            x += segmentWidth;
        });
    }

    renderCustomBackground() {
        // For now, show a placeholder - in real implementation would load uploaded image
        this.ctx.fillStyle = '#333333';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = '16px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('Custom Background', this.canvas.width / 2, this.canvas.height / 2);
    }

    renderText(settings) {
        const { text, fontSize, fontFamily, textWeight, textColor, textBackground, textPosition } = settings;
        const { width, height } = this.formats[this.currentFormat];

        // Scale font size for preview
        const scaledFontSize = Math.max(12, fontSize * this.previewScale);

        // Set font
        let fontWeight = textWeight === 'normal' ? 'normal' : (textWeight === 'semi' ? '600' : 'bold');
        this.ctx.font = `${fontWeight} ${scaledFontSize}px Arial`; // Simplified font for preview
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';

        // Calculate position
        const pos = this.getTextPosition(textPosition, text, scaledFontSize);

        // Render text background if needed
        if (textBackground !== 'none') {
            this.renderTextBackground(text, pos.x, pos.y, scaledFontSize, textBackground);
        }

        // Render text
        this.ctx.fillStyle = this.getColor(textColor);
        this.ctx.fillText(text, pos.x, pos.y);
    }

    getTextPosition(position, text, fontSize) {
        const textWidth = this.ctx.measureText(text).width;
        const textHeight = fontSize;

        const positions = {
            'top-left': { x: 20, y: 20 + textHeight/2 },
            'top-center': { x: this.canvas.width/2, y: 20 + textHeight/2 },
            'top-right': { x: this.canvas.width - 20, y: 20 + textHeight/2 },
            'center-left': { x: 20, y: this.canvas.height/2 },
            'center': { x: this.canvas.width/2, y: this.canvas.height/2 },
            'center-right': { x: this.canvas.width - 20, y: this.canvas.height/2 },
            'bottom-left': { x: 20, y: this.canvas.height - 20 - textHeight/2 },
            'bottom-center': { x: this.canvas.width/2, y: this.canvas.height - 20 - textHeight/2 },
            'bottom-right': { x: this.canvas.width - 20, y: this.canvas.height - 20 - textHeight/2 }
        };

        return positions[position] || positions.center;
    }

    renderTextBackground(text, x, y, fontSize, backgroundType) {
        const textWidth = this.ctx.measureText(text).width;
        const textHeight = fontSize;
        const padding = 8;

        let bgColor;
        switch (backgroundType) {
            case 'black_solid':
                bgColor = 'rgba(0, 0, 0, 1)';
                break;
            case 'black_soft':
                bgColor = 'rgba(0, 0, 0, 0.6)';
                break;
            case 'white_soft':
                bgColor = 'rgba(255, 255, 255, 0.6)';
                break;
            case 'yellow_soft':
                bgColor = 'rgba(255, 255, 0, 0.6)';
                break;
            case 'blue_soft':
                bgColor = 'rgba(0, 0, 255, 0.6)';
                break;
            default:
                return;
        }

        this.ctx.fillStyle = bgColor;
        this.ctx.fillRect(
            x - textWidth/2 - padding,
            y - textHeight/2 - padding,
            textWidth + padding * 2,
            textHeight + padding * 2
        );
    }

    renderLogo(settings) {
        const { showLogo, logoPosition } = settings;

        if (!showLogo) return;

        // For preview, render a simple logo placeholder
        const logoSize = 40;
        const pos = this.getLogoPosition(logoPosition, logoSize);

        // Draw logo background
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        this.ctx.fillRect(pos.x - logoSize/2, pos.y - logoSize/2, logoSize, logoSize);

        // Draw ACTUA text
        this.ctx.fillStyle = '#001133';
        this.ctx.font = 'bold 10px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('ACTUA', pos.x, pos.y);
    }

    getLogoPosition(position, logoSize) {
        const positions = {
            'top-left': { x: logoSize/2 + 10, y: logoSize/2 + 10 },
            'top-center': { x: this.canvas.width/2, y: logoSize/2 + 10 },
            'top-right': { x: this.canvas.width - logoSize/2 - 10, y: logoSize/2 + 10 },
            'center-left': { x: logoSize/2 + 10, y: this.canvas.height/2 },
            'center': { x: this.canvas.width/2, y: this.canvas.height/2 },
            'center-right': { x: this.canvas.width - logoSize/2 - 10, y: this.canvas.height/2 },
            'bottom-left': { x: logoSize/2 + 10, y: this.canvas.height - logoSize/2 - 10 },
            'bottom-center': { x: this.canvas.width/2, y: this.canvas.height - logoSize/2 - 10 },
            'bottom-right': { x: this.canvas.width - logoSize/2 - 10, y: this.canvas.height - logoSize/2 - 10 }
        };

        return positions[position] || positions['top-right'];
    }

    renderClock(settings) {
        const { showClock, clockPosition } = settings;

        if (!showClock) return;

        // Render current time
        const now = new Date();
        const timeString = now.toISOString().split('T')[1].split('.')[0] + ' UTC';

        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        this.ctx.font = '12px monospace';
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'top';

        const pos = this.getClockPosition(clockPosition);
        this.ctx.fillText(timeString, pos.x, pos.y);
    }

    getClockPosition(position) {
        const positions = {
            'top-left': { x: 10, y: 10 },
            'top-right': { x: this.canvas.width - 150, y: 10 },
            'bottom-left': { x: 10, y: this.canvas.height - 30 },
            'bottom-right': { x: this.canvas.width - 150, y: this.canvas.height - 30 }
        };

        return positions[position] || positions['bottom-right'];
    }

    renderConfigOverlay(settings) {
        const { showConfigOverlay } = settings;

        if (!showConfigOverlay) return;

        const config = this.getCurrentSettings();
        const configText = `Format: ${config.videoFormat} | Background: ${config.background} | Text: ${config.textColor}`;

        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.font = '10px monospace';
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'bottom';

        this.ctx.fillText(configText, 10, this.canvas.height - 10);
    }

    renderAnimation(settings) {
        const { animation } = settings;

        if (!animation) return;

        // Simple animation preview - just a moving element
        const time = Date.now() * 0.001;
        const x = this.canvas.width/2 + Math.sin(time) * 50;
        const y = this.canvas.height/2 + Math.cos(time) * 30;

        this.ctx.fillStyle = 'rgba(255, 255, 0, 0.8)';
        this.ctx.beginPath();
        this.ctx.arc(x, y, 10, 0, Math.PI * 2);
        this.ctx.fill();
    }

    getColor(colorName) {
        const colors = {
            'white': '#FFFFFF',
            'black': '#000000',
            'red': '#FF0000',
            'yellow': '#FFFF00',
            'blue': '#0000FF',
            'green': '#00FF00'
        };
        return colors[colorName] || '#FFFFFF';
    }

    stopAnimation() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
    }

    destroy() {
        this.stopAnimation();
        this.unbindControlListeners();
    }
}

// Initialize preview renderer when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.previewRenderer = new PreviewRenderer();
});

// Export for potential use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PreviewRenderer;
}
