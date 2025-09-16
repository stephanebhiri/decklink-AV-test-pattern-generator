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
        this.loadPresetsList();
        this.checkServerStatus();
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
        this.killBtn = document.getElementById('killBtn');

        // Status elements
        this.statusText = document.getElementById('statusText');
        this.commandPreview = document.getElementById('commandPreview');
        this.logOutput = document.getElementById('logOutput');

        // Preset elements
        this.presetNameInput = document.getElementById('presetName');
        this.presetSelect = document.getElementById('presetSelect');
        this.savePresetBtn = document.getElementById('savePresetBtn');
        this.loadPresetBtn = document.getElementById('loadPresetBtn');
        this.deletePresetBtn = document.getElementById('deletePresetBtn');
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
        this.killBtn.addEventListener('click', () => this.killFFmpeg());

        // Logo upload events
        this.uploadLogoBtn.addEventListener('click', () => this.logoFileInput.click());
        this.logoFileInput.addEventListener('change', (e) => this.handleLogoUpload(e));

        // Preset events
        this.savePresetBtn.addEventListener('click', () => this.savePreset());
        this.loadPresetBtn.addEventListener('click', () => this.loadPreset());
        this.deletePresetBtn.addEventListener('click', () => this.deletePreset());
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
            console.log('Received broadcast-started event:', data);
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

    async checkServerStatus() {
        try {
            const response = await fetch('/api/status');
            const status = await response.json();

            if (status.isRunning) {
                console.log('FFmpeg is already running, PID:', status.pid);
                this.updateStatus('Diffusion en cours...', 'running');
                this.setButtonStates(false, true);
                this.isRunning = true;  // Force isRunning to true
                this.appendLog(`🔄 FFmpeg détecté en cours d'exécution (PID: ${status.pid})\n`);
            }
        } catch (error) {
            console.error('Error checking server status:', error);
        }
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

    killFFmpeg() {
        if (confirm('Attention! Ceci va forcer l\'arrêt de tous les processus FFmpeg. Continuer?')) {
            this.socket.emit('kill-ffmpeg');
            this.appendLog('⚠️ Arrêt forcé demandé...\n');
        }
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

    // Preset management methods
    async savePreset() {
        const name = this.presetNameInput.value.trim();
        if (!name) {
            alert('Veuillez entrer un nom pour le preset');
            return;
        }

        const config = this.getConfig();
        try {
            const response = await fetch('/api/presets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, config })
            });

            if (response.ok) {
                this.presetNameInput.value = '';
                await this.loadPresetsList();
                this.appendLog(`💾 Preset "${name}" sauvegardé\n`);
            } else {
                alert('Erreur lors de la sauvegarde du preset');
            }
        } catch (error) {
            console.error('Error saving preset:', error);
            alert('Erreur lors de la sauvegarde du preset');
        }
    }

    async loadPreset() {
        const selectedPreset = this.presetSelect.value;
        if (!selectedPreset) {
            alert('Veuillez sélectionner un preset à charger');
            return;
        }

        try {
            const response = await fetch('/api/presets');
            const presets = await response.json();
            const preset = presets[selectedPreset];

            if (preset) {
                this.applyConfig(preset);
                this.appendLog(`📁 Preset "${selectedPreset}" chargé\n`);
            }
        } catch (error) {
            console.error('Error loading preset:', error);
            alert('Erreur lors du chargement du preset');
        }
    }

    async deletePreset() {
        const selectedPreset = this.presetSelect.value;
        if (!selectedPreset) {
            alert('Veuillez sélectionner un preset à supprimer');
            return;
        }

        if (!confirm(`Êtes-vous sûr de vouloir supprimer le preset "${selectedPreset}" ?`)) {
            return;
        }

        try {
            const response = await fetch(`/api/presets/${encodeURIComponent(selectedPreset)}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                await this.loadPresetsList();
                this.appendLog(`🗑️ Preset "${selectedPreset}" supprimé\n`);
            } else {
                alert('Erreur lors de la suppression du preset');
            }
        } catch (error) {
            console.error('Error deleting preset:', error);
            alert('Erreur lors de la suppression du preset');
        }
    }

    async loadPresetsList() {
        try {
            const response = await fetch('/api/presets');
            const presets = await response.json();

            // Clear current options except the first one
            this.presetSelect.innerHTML = '<option value="">Sélectionner un preset...</option>';

            // Add presets to select
            Object.keys(presets).forEach(name => {
                const option = document.createElement('option');
                option.value = name;
                option.textContent = name;
                this.presetSelect.appendChild(option);
            });
        } catch (error) {
            console.error('Error loading presets list:', error);
        }
    }

    applyConfig(config) {
        // Apply background
        if (config.background) this.backgroundSelect.value = config.background;

        // Apply text
        if (config.text !== undefined) this.textInput.value = config.text;
        if (config.textPosition) this.selectTextPosition(config.textPosition);
        if (config.fontSize) {
            this.fontSizeSlider.value = config.fontSize;
            this.fontSizeValue.textContent = config.fontSize + 'px';
        }
        if (config.textColor) this.textColorInput.value = config.textColor;

        // Apply logo
        if (config.showLogo !== undefined) this.showLogoCheckbox.checked = config.showLogo;
        if (config.logoPosition) this.selectLogoPosition(config.logoPosition);

        // Apply animation
        if (config.animation) this.animationSelect.value = config.animation;

        // Apply audio
        if (config.audioFreq) {
            this.audioFreqSlider.value = config.audioFreq;
            this.audioFreqValue.textContent = config.audioFreq + ' Hz';
        }

        // Apply video format
        if (config.videoFormat) this.videoFormatSelect.value = config.videoFormat;

        // Update UI
        this.updateLogoPreview();
        this.previewCommand();
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