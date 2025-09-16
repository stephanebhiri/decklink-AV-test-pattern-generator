// ACTUA Broadcast Generator - Frontend JavaScript
class BroadcastController {
    constructor() {
        this.socket = io();
        this.isRunning = false;
        this.initializeElements();
        this.bindEvents();
        this.setupSocketListeners();
        this.updateRangeValues();
        this.loadOptions();
        this.loadSettings();
    }

    initializeElements() {
        // Form elements
        this.backgroundSelect = document.getElementById('background');
        this.textInput = document.getElementById('text');
        this.textPositionSelect = document.getElementById('textPosition');
        this.fontSizeSlider = document.getElementById('fontSize');
        this.fontSizeValue = document.getElementById('fontSizeValue');
        this.textColorSelect = document.getElementById('textColor');
        this.showLogoCheckbox = document.getElementById('showLogo');
        this.logoFileInput = document.getElementById('logoFile');
        this.uploadLogoBtn = document.getElementById('uploadLogoBtn');
        this.logoSelect = document.getElementById('logoSelect');
        this.logoPosition = document.getElementById('logoPosition');
        this.logoPreview = document.getElementById('logoPreview');
        this.animationSelect = document.getElementById('animation');
        this.audioFreqSlider = document.getElementById('audioFreq');
        this.audioFreqValue = document.getElementById('audioFreqValue');
        this.videoFormatSelect = document.getElementById('videoFormat');

        // Action buttons
        this.previewBtn = document.getElementById('previewBtn');
        this.startBtn = document.getElementById('startBtn');
        this.stopBtn = document.getElementById('stopBtn');

        // Status elements
        this.statusText = document.getElementById('statusText');
        this.commandPreview = document.getElementById('commandPreview');
        this.logOutput = document.getElementById('logOutput');
    }

    bindEvents() {
        // Range slider updates
        this.fontSizeSlider.addEventListener('input', () => {
            this.fontSizeValue.textContent = this.fontSizeSlider.value + 'px';
        });

        this.audioFreqSlider.addEventListener('input', () => {
            this.audioFreqValue.textContent = this.audioFreqSlider.value + ' Hz';
        });

        // Button events
        this.previewBtn.addEventListener('click', () => this.previewCommand());
        this.startBtn.addEventListener('click', () => this.startBroadcast());
        this.stopBtn.addEventListener('click', () => this.stopBroadcast());

        // Logo upload events
        this.uploadLogoBtn.addEventListener('click', () => this.logoFileInput.click());
        this.logoFileInput.addEventListener('change', (e) => this.handleLogoUpload(e));
        this.logoSelect.addEventListener('change', () => this.updateLogoPreview());

        // Auto-preview on change
        const autoPreviewElements = [
            this.backgroundSelect, this.textInput, this.textPositionSelect, this.fontSizeSlider,
            this.textColorSelect, this.showLogoCheckbox, this.logoSelect, this.logoPosition, this.animationSelect,
            this.audioFreqSlider, this.videoFormatSelect
        ];

        autoPreviewElements.forEach(element => {
            element.addEventListener('change', () => {
                this.previewCommand();
                this.saveSettings();
            });
            if (element.type === 'range') {
                element.addEventListener('input', () => {
                    this.previewCommand();
                    this.saveSettings();
                });
            }
        });
    }

    setupSocketListeners() {
        this.socket.on('broadcast-started', (data) => {
            this.updateStatus('Diffusion en cours...', 'running');
            this.setButtonStates(false, true);
            this.appendLog('✅ Diffusion démarrée avec succès\n');
        });

        this.socket.on('broadcast-stopped', (data) => {
            this.updateStatus('Diffusion arrêtée', 'ready');
            this.setButtonStates(true, false);
            this.isRunning = false;
            if (data.manual) {
                this.appendLog('⏹️ Diffusion arrêtée manuellement\n');
            } else {
                this.appendLog(`⏹️ Diffusion terminée (code: ${data.code})\n`);
            }
        });

        this.socket.on('broadcast-error', (error) => {
            this.updateStatus(`Erreur: ${error}`, 'error');
            this.setButtonStates(true, false);
            this.appendLog(`❌ Erreur: ${error}\n`);
        });

        this.socket.on('ffmpeg-output', (output) => {
            this.appendLog(output);
        });
    }

    updateRangeValues() {
        this.fontSizeValue.textContent = this.fontSizeSlider.value + 'px';
        this.audioFreqValue.textContent = this.audioFreqSlider.value + ' Hz';
    }

    getConfig() {
        return {
            background: this.backgroundSelect.value,
            text: this.textInput.value,
            textPosition: this.textPositionSelect.value,
            fontSize: parseInt(this.fontSizeSlider.value),
            textColor: this.textColorSelect.value,
            showLogo: this.showLogoCheckbox.checked,
            logoFile: this.logoSelect.value || null,
            logoPosition: this.logoPosition.value,
            animation: this.animationSelect.value || null,
            audioFreq: parseInt(this.audioFreqSlider.value),
            videoFormat: this.videoFormatSelect.value
        };
    }

    async previewCommand() {
        try {
            const config = this.getConfig();
            const response = await fetch('/api/preview', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(config)
            });

            const data = await response.json();

            if (data.success) {
                this.commandPreview.textContent = data.command;
                this.updateStatus('Commande générée - Prêt à diffuser', 'ready');
            }
        } catch (error) {
            console.error('Erreur preview:', error);
            this.updateStatus('Erreur génération commande', 'error');
        }
    }

    startBroadcast() {
        if (this.isRunning) return;

        const config = this.getConfig();
        this.socket.emit('start-broadcast', config);
        this.updateStatus('Démarrage en cours...', 'running');
        this.clearLog();
        this.appendLog('🚀 Démarrage de la diffusion...\n');
    }

    stopBroadcast() {
        if (!this.isRunning) return;

        this.socket.emit('stop-broadcast');
        this.updateStatus('Arrêt en cours...', 'running');
    }

    updateStatus(text, type = 'ready') {
        this.statusText.textContent = text;
        this.statusText.className = `status-${type}`;
        this.isRunning = (type === 'running');
    }

    setButtonStates(startEnabled, stopEnabled) {
        this.startBtn.disabled = !startEnabled;
        this.stopBtn.disabled = !stopEnabled;
    }

    appendLog(text) {
        this.logOutput.textContent += text;
        this.logOutput.scrollTop = this.logOutput.scrollHeight;
    }

    clearLog() {
        this.logOutput.textContent = '';
    }

    async loadOptions() {
        try {
            // Load text positions
            const textPositions = await fetch('/api/text-positions').then(r => r.json());
            this.populateSelect(this.textPositionSelect, textPositions);

            // Load logo positions
            const logoPositions = await fetch('/api/logo-positions').then(r => r.json());
            this.populateSelect(this.logoPosition, logoPositions);

            // Load video formats
            const videoFormats = await fetch('/api/video-formats').then(r => r.json());
            this.populateSelect(this.videoFormatSelect, videoFormats);

            // Load uploaded logos
            await this.loadUploadedLogos();

        } catch (error) {
            console.error('Error loading options:', error);
        }
    }

    populateSelect(select, options) {
        select.innerHTML = '';
        options.forEach(option => {
            const optionElement = document.createElement('option');
            optionElement.value = option.id;
            optionElement.textContent = option.name;
            select.appendChild(optionElement);
        });
    }

    async loadUploadedLogos() {
        try {
            const logos = await fetch('/api/uploaded-logos').then(r => r.json());

            // Clear existing options except default
            this.logoSelect.innerHTML = '<option value="">Logo ACTUA par défaut</option>';

            logos.forEach(logo => {
                const option = document.createElement('option');
                option.value = logo.filename;
                option.textContent = logo.filename;
                this.logoSelect.appendChild(option);
            });
        } catch (error) {
            console.error('Error loading uploaded logos:', error);
        }
    }

    async loadSettings() {
        try {
            const response = await fetch('/api/settings');
            const settings = await response.json();

            // Apply settings to form elements
            this.backgroundSelect.value = settings.background || 'blue';
            this.textInput.value = settings.text || 'ACTUA PARIS';
            this.textPositionSelect.value = settings.textPosition || 'center';
            this.fontSizeSlider.value = settings.fontSize || 80;
            this.textColorSelect.value = settings.textColor || 'white';
            this.showLogoCheckbox.checked = settings.showLogo !== false;
            this.logoSelect.value = settings.logoFile || '';
            this.logoPosition.value = settings.logoPosition || 'top-right';
            this.animationSelect.value = settings.animation || '';
            this.audioFreqSlider.value = settings.audioFreq || 1000;
            this.videoFormatSelect.value = settings.videoFormat || '1080i50';

            // Update range value displays
            this.updateRangeValues();
            this.updateLogoPreview();
            this.previewCommand();
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    }

    async saveSettings() {
        try {
            const config = this.getConfig();
            await fetch('/api/settings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(config)
            });
        } catch (error) {
            console.error('Error saving settings:', error);
        }
    }

    async handleLogoUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('logo', file);

        try {
            this.uploadLogoBtn.textContent = '📤 Upload...';
            this.uploadLogoBtn.disabled = true;

            const response = await fetch('/api/upload-logo', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (result.success) {
                // Reload logo options
                await this.loadUploadedLogos();

                // Select the uploaded logo
                this.logoSelect.value = result.filename;
                this.updateLogoPreview();

                this.showUploadStatus('Logo uploadé avec succès!', 'success');
            } else {
                this.showUploadStatus('Erreur upload: ' + result.error, 'error');
            }

        } catch (error) {
            this.showUploadStatus('Erreur upload: ' + error.message, 'error');
        } finally {
            this.uploadLogoBtn.textContent = '📁 Uploader PNG';
            this.uploadLogoBtn.disabled = false;
            this.logoFileInput.value = '';
        }
    }

    updateLogoPreview() {
        const selectedLogo = this.logoSelect.value;

        if (selectedLogo) {
            this.logoPreview.innerHTML = `
                <img src="/uploads/${selectedLogo}" alt="Logo preview">
                <div class="logo-info">Logo: ${selectedLogo}</div>
            `;
            this.logoPreview.style.display = 'block';
        } else {
            this.logoPreview.style.display = 'none';
        }
    }

    showUploadStatus(message, type) {
        // Remove existing status
        const existingStatus = document.querySelector('.upload-status');
        if (existingStatus) {
            existingStatus.remove();
        }

        // Create new status
        const status = document.createElement('div');
        status.className = `upload-status ${type}`;
        status.textContent = message;
        status.style.display = 'block';

        // Add after logo preview
        this.logoPreview.parentNode.insertBefore(status, this.logoPreview.nextSibling);

        // Auto-hide after 3 seconds
        setTimeout(() => {
            if (status.parentNode) {
                status.remove();
            }
        }, 3000);
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new BroadcastController();
});