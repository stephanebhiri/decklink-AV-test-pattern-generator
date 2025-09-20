// ACTUA Broadcast Generator - Frontend JavaScript
class BroadcastController {
    constructor() {
        this.socket = io();
        this.isRunning = false;
        this.isStarting = false;
        this.isApplying = false;
        this.isStopping = false;
        this.hasPendingChanges = false;
        this.initializeElements();
        this.defaultStartLabel = this.startBtn.textContent || 'Start Broadcast';
        this.applyLabel = 'Apply Changes';
        this.bindEvents();
        this.setupSocketListeners();
        this.updateRangeValues();
        this.loadOptions()
            .then(() => this.loadSettings())
            .catch(error => console.error('Error initialising options/settings:', error));
        this.loadPresetsList();
        this.createClockPositions();
        this.checkServerStatus();
        this.updateControls();
        this.updateOverlayControlsState();
        this.updateClockControlsState();
    }

    initializeElements() {
        // Form elements
        this.backgroundSelect = document.getElementById('background');
        this.textInput = document.getElementById('text');
        this.textPositionSelect = document.getElementById('textPosition');
        this.fontSizeSlider = document.getElementById('fontSize');
        this.fontSizeValue = document.getElementById('fontSizeValue');
        this.fontFamilySelect = document.getElementById('fontFamily');
        this.textWeightSelect = document.getElementById('textWeight');
        this.textColorSelect = document.getElementById('textColor');
        this.textBackgroundSelect = document.getElementById('textBackground');
        this.showLogoCheckbox = document.getElementById('showLogo');
        this.logoFileInput = document.getElementById('logoFile');
        this.uploadLogoBtn = document.getElementById('uploadLogoBtn');
        this.logoSelect = document.getElementById('logoSelect');
        this.logoPosition = document.getElementById('logoPosition');
        this.logoPreview = document.getElementById('logoPreview');
        this.customBackgroundControls = document.getElementById('customBackgroundControls');
        this.customBackgroundSelect = document.getElementById('customBackgroundSelect');
        this.backgroundPreview = document.getElementById('backgroundPreview');
        this.uploadBgBtn = document.getElementById('uploadBgBtn');
        this.backgroundFileInput = document.getElementById('backgroundFile');
        this.animationSelect = document.getElementById('animation');
        this.audioFreqSlider = document.getElementById('audioFreq');
        this.audioFreqValue = document.getElementById('audioFreqValue');
        this.audioLevelSelect = document.getElementById('audioLevel');
        this.videoFormatSelect = document.getElementById('videoFormat');
        this.decklinkDeviceSelect = document.getElementById('decklinkDevice');
        this.tonePresetButtons = Array.from(document.querySelectorAll('.tone-preset-btn'));
        this.audioPresetValues = this.tonePresetButtons.map(btn => parseInt(btn.dataset.audioPreset, 10));
        this.audioChannelContainer = document.getElementById('audioChannelToggles');
        this.audioChannelToggles = [];
        this.audioChannelIdCycleToggles = [];
        this.audioChannelForce400Toggles = [];
        this.audioChannelFlashToggles = [];
        this.pendingAudioChannelOptions = null;
        this.flashOverlayOffsetSlider = document.getElementById('flashOverlayOffset');
        this.flashOverlayOffsetValue = document.getElementById('flashOverlayOffsetValue');

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

        // Clock elements
        this.showClockCheckbox = document.getElementById('showClock');
        this.clockLatencyInput = document.getElementById('clockLatencyMs');
        this.clockPositionsGrid = document.getElementById('clockPositions');
        this.showConfigOverlayCheckbox = document.getElementById('showConfigOverlay');
        this.overlayFontSizeSlider = document.getElementById('overlayFontSize');
        this.overlayFontSizeValue = document.getElementById('overlayFontSizeValue');
        this.overlayPositionSelect = document.getElementById('overlayPosition');
        this.selectedClockPosition = 'bottom-right';
        this.selectedTonePreset = null;
        this.pendingAudioChannelMap = null;
    }

    bindEvents() {
        // Range slider updates
        this.fontSizeSlider.addEventListener('input', () => {
            this.fontSizeValue.textContent = this.fontSizeSlider.value + 'px';
        });

        this.audioFreqSlider.addEventListener('input', () => {
            this.audioFreqValue.textContent = this.audioFreqSlider.value + ' Hz';
            this.syncTonePresetHighlight();
        });

        if (this.overlayFontSizeSlider) {
            this.overlayFontSizeSlider.addEventListener('input', () => {
                this.overlayFontSizeValue.textContent = this.overlayFontSizeSlider.value + 'px';
            });
        }

        if (this.flashOverlayOffsetSlider) {
            this.flashOverlayOffsetSlider.addEventListener('input', () => {
                this.flashOverlayOffsetValue.textContent = this.flashOverlayOffsetSlider.value + '%';
            });
        }

        this.backgroundSelect.addEventListener('change', () => {
            this.updateBackgroundControls();
        });
        if (this.customBackgroundSelect) {
            this.customBackgroundSelect.addEventListener('change', () => {
                this.updateBackgroundPreview();
            });
        }

        // Button events
        this.previewBtn.addEventListener('click', () => this.previewCommand());
        this.startBtn.addEventListener('click', () => this.startBroadcast());
        this.stopBtn.addEventListener('click', () => this.stopBroadcast());
        this.killBtn.addEventListener('click', () => this.killFFmpeg());

        // Logo upload events
        this.uploadLogoBtn.addEventListener('click', () => this.logoFileInput.click());
        this.logoFileInput.addEventListener('change', (e) => this.handleLogoUpload(e));
        if (this.uploadBgBtn) {
            this.uploadBgBtn.addEventListener('click', () => this.backgroundFileInput.click());
        }
        if (this.backgroundFileInput) {
            this.backgroundFileInput.addEventListener('change', (e) => this.handleBackgroundUpload(e));
        }

        this.tonePresetButtons.forEach(button => {
            button.addEventListener('click', () => this.applyTonePreset(parseInt(button.dataset.audioPreset, 10)));
        });

        // Preset events
        this.savePresetBtn.addEventListener('click', () => this.savePreset());
        this.loadPresetBtn.addEventListener('click', () => this.loadPreset());
        this.deletePresetBtn.addEventListener('click', () => this.deletePreset());
        this.logoSelect.addEventListener('change', () => this.updateLogoPreview());

        // Clock events
        this.showClockCheckbox.addEventListener('change', () => {
            this.previewCommand();
            this.saveSettings();
            this.handleConfigChange();
            this.updateClockControlsState();
        });

        this.showConfigOverlayCheckbox.addEventListener('change', () => {
            this.updateOverlayControlsState();
        });

        // Auto-preview on change
        const autoPreviewElements = [
            this.backgroundSelect, this.textInput, this.textPositionSelect, this.fontSizeSlider,
            this.fontFamilySelect, this.textWeightSelect, this.textColorSelect, this.textBackgroundSelect,
            this.showLogoCheckbox, this.logoSelect, this.logoPosition, this.animationSelect,
            this.audioFreqSlider, this.audioLevelSelect, this.videoFormatSelect, this.decklinkDeviceSelect,
            this.overlayPositionSelect, this.overlayFontSizeSlider
        ];
        if (this.clockLatencyInput) {
            autoPreviewElements.push(this.clockLatencyInput);
        }
        if (this.flashOverlayOffsetSlider) {
            autoPreviewElements.push(this.flashOverlayOffsetSlider);
        }
        if (this.showConfigOverlayCheckbox) {
            autoPreviewElements.push(this.showConfigOverlayCheckbox);
        }
        if (this.customBackgroundSelect) {
            autoPreviewElements.push(this.customBackgroundSelect);
        }

        autoPreviewElements.forEach(element => {
            element.addEventListener('change', () => {
                this.previewCommand();
                this.saveSettings();
                this.handleConfigChange();
            });
            if (element.type === 'range') {
                element.addEventListener('input', () => {
                    this.previewCommand();
                    this.saveSettings();
                    this.handleConfigChange();
                });
            } else if (element === this.textInput) {
                element.addEventListener('input', () => {
                    this.previewCommand();
                    this.saveSettings();
                    this.handleConfigChange();
                });
            }
        });
    }

    setupSocketListeners() {
        this.socket.on('broadcast-started', (data) => {
            console.log('Received broadcast-started event:', data);
            this.isStarting = false;
            this.isApplying = false;
            this.isStopping = false;
            this.isRunning = true;
            this.hasPendingChanges = false;
            this.updateStatus('Broadcast running...', 'running');
            this.updateControls();
            if (data && data.restarted) {
                this.appendLog('✅ Changes applied\n');
            } else {
                this.appendLog('✅ Broadcast started successfully\n');
            }
        });

        this.socket.on('broadcast-stopped', (data) => {
            this.isStarting = false;
            this.isApplying = false;
            this.isStopping = false;
            this.isRunning = false;
            this.hasPendingChanges = false;
            this.updateStatus('Broadcast stopped', 'ready');
            this.updateControls();
            if (data.manual) {
                this.appendLog('⏹️ Broadcast stopped manually\n');
            } else {
                this.appendLog(`⏹️ Broadcast finished (code: ${data.code})\n`);
            }
        });

        this.socket.on('broadcast-error', (error) => {
            this.updateStatus(`Error: ${error}`, 'error');
            this.isStarting = false;
            this.isApplying = false;
            this.isStopping = false;
            this.isRunning = false;
            this.updateControls();
            this.appendLog(`❌ Error: ${error}\n`);
        });

        this.socket.on('ffmpeg-output', (output) => {
            this.appendLog(output);
        });

        this.socket.on('ffmpeg-log-history', (history) => {
            if (typeof history === 'string') {
                this.logOutput.textContent = history;
                this.logOutput.scrollTop = this.logOutput.scrollHeight;
            }
        });

        this.socket.on('broadcast-state', (state) => {
            const running = Boolean(state && state.isRunning);
            this.isRunning = running;
            this.isStarting = false;
            this.isApplying = false;
            this.isStopping = false;
            this.hasPendingChanges = false;

            if (running) {
                this.updateStatus('Broadcast running...', 'running');
                if (state && state.config) {
                    this.applyConfig(state.config, { skipSave: true, skipPreview: true, markClean: true });
                }
            } else {
                this.updateStatus('Ready to broadcast', 'ready');
            }
            this.updateControls();
        });

        this.socket.on('ack-started', () => {
            this.isStarting = false;
            this.updateControls();
        });
    }

    updateRangeValues() {
        this.fontSizeValue.textContent = this.fontSizeSlider.value + 'px';
        this.audioFreqValue.textContent = this.audioFreqSlider.value + ' Hz';
        if (this.overlayFontSizeSlider && this.overlayFontSizeValue) {
            this.overlayFontSizeValue.textContent = this.overlayFontSizeSlider.value + 'px';
        }
        if (this.flashOverlayOffsetSlider && this.flashOverlayOffsetValue) {
            this.flashOverlayOffsetValue.textContent = this.flashOverlayOffsetSlider.value + '%';
        }
        this.syncTonePresetHighlight();
    }

    updateOverlayControlsState() {
        const enabled = this.showConfigOverlayCheckbox && this.showConfigOverlayCheckbox.checked;

        if (this.overlayFontSizeSlider) {
            this.overlayFontSizeSlider.disabled = !enabled;
        }

        if (this.overlayPositionSelect) {
            this.overlayPositionSelect.disabled = !enabled;
        }

        if (this.overlayFontSizeValue) {
            this.overlayFontSizeValue.style.opacity = enabled ? '1' : '0.5';
        }
    }

    updateClockControlsState() {
        if (this.clockLatencyInput) {
            this.clockLatencyInput.disabled = !this.showClockCheckbox.checked;
        }
    }

    getConfig() {
        const channelMap = this.audioChannelToggles.length > 0
            ? this.audioChannelToggles.map(cb => cb.checked)
            : [true, true];
        const activeChannels = channelMap.filter(Boolean).length || 2;
        const backgroundValue = this.backgroundSelect.value;
        const customBackground = (backgroundValue === 'custom' && this.customBackgroundSelect)
            ? (this.customBackgroundSelect.value || null)
            : null;
        const selectedAudioLevelOption = (this.audioLevelSelect && this.audioLevelSelect.selectedOptions.length > 0)
            ? this.audioLevelSelect.selectedOptions[0]
            : null;
        const audioLevelRaw = (selectedAudioLevelOption && selectedAudioLevelOption.dataset && selectedAudioLevelOption.dataset.dbfs !== undefined)
            ? selectedAudioLevelOption.dataset.dbfs
            : (this.audioLevelSelect ? this.audioLevelSelect.value : '');
        let audioLevelDb = audioLevelRaw ? String(audioLevelRaw) : '0';
        if (audioLevelDb === '-0') {
            audioLevelDb = '0';
        }
        const audioChannelIdCycle = this.audioChannelIdCycleToggles.length > 0
            ? this.audioChannelIdCycleToggles.map(cb => cb.checked)
            : [];
        const audioChannelFlash = this.audioChannelFlashToggles.length > 0
            ? this.audioChannelFlashToggles.map(cb => cb.checked)
            : [];
        const audioChannelForce400 = this.audioChannelForce400Toggles.length > 0
            ? this.audioChannelForce400Toggles.map(cb => cb.checked)
            : [];

        return {
            background: backgroundValue,
            customBackground,
            text: this.textInput.value,
            textPosition: this.textPositionSelect.value,
            fontSize: parseInt(this.fontSizeSlider.value),
            fontFamily: this.fontFamilySelect ? this.fontFamilySelect.value : 'sf_mono',
            textWeight: this.textWeightSelect ? this.textWeightSelect.value : 'normal',
            textColor: this.textColorSelect.value,
            textBackground: this.textBackgroundSelect ? this.textBackgroundSelect.value : 'none',
            showLogo: this.showLogoCheckbox.checked,
            logoFile: this.logoSelect.value || null,
            logoPosition: this.logoPosition.value,
            animation: this.animationSelect.value || null,
            audioChannels: activeChannels,
            audioChannelMap: channelMap,
            audioFreq: parseInt(this.audioFreqSlider.value),
            audioLevelDb,
            audioChannelIdCycle,
            audioChannelFlash,
            audioChannelForce400,
            videoFormat: this.videoFormatSelect.value,
            decklinkDevice: this.decklinkDeviceSelect ? (this.decklinkDeviceSelect.value || null) : null,
            showClock: this.showClockCheckbox.checked,
            clockLatencyMs: this.clockLatencyInput ? parseInt(this.clockLatencyInput.value, 10) : null,
            clockPosition: this.selectedClockPosition,
            showConfigOverlay: this.showConfigOverlayCheckbox ? this.showConfigOverlayCheckbox.checked : false,
            configOverlayFontSize: this.overlayFontSizeSlider ? parseInt(this.overlayFontSizeSlider.value, 10) : null,
            configOverlayPosition: this.overlayPositionSelect ? this.overlayPositionSelect.value : 'top-left',
            flashOverlayOffset: this.flashOverlayOffsetSlider ? parseInt(this.flashOverlayOffsetSlider.value, 10) : 0
        };
    }

    async checkServerStatus() {
        try {
            const response = await fetch('/api/status');
            const status = await response.json();

            if (status.isRunning) {
                console.log('FFmpeg is already running, PID:', status.pid);
                this.updateStatus('Broadcast running...', 'running');
                this.isRunning = true;
                this.isStarting = false;
                this.isApplying = false;
                this.isStopping = false;
                this.hasPendingChanges = false;
                this.updateControls();
                this.appendLog(`🔄 Detected running FFmpeg (PID: ${status.pid})\n`);
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
                if (this.isRunning) {
                    this.updateStatus('Changes ready - apply to update', 'running');
                } else if (!this.isStarting) {
                    this.updateStatus('Command generated - ready to broadcast', 'ready');
                }
            }
        } catch (error) {
            console.error('Preview error:', error);
            this.updateStatus('Command generation error', 'error');
        }
    }

    startBroadcast() {
        const config = this.getConfig();
        if (this.isRunning) {
            if (!this.hasPendingChanges || this.isApplying) return;

            this.isApplying = true;
            this.hasPendingChanges = false;
            this.isStarting = true;
            this.socket.emit('apply-broadcast-settings', config);
            this.updateStatus('Applying changes...', 'running');
            this.appendLog('🔄 Applying changes...\n');
            this.updateControls();
            return;
        }

        if (this.isStarting) return;

        this.isStarting = true;
        this.socket.emit('start-broadcast', config);
        this.updateStatus('Starting broadcast...', 'running');
        this.clearLog();
        this.appendLog('🚀 Starting broadcast...\n');
        this.updateControls();
    }

    stopBroadcast() {
        if (!this.isRunning || this.isStopping) return;

        this.isStopping = true;
        this.hasPendingChanges = false;
        this.socket.emit('stop-broadcast');
        this.updateStatus('Stopping broadcast...', 'running');
        this.updateControls();
    }

    killFFmpeg() {
        if (confirm('Warning! This will force stop every FFmpeg process. Continue?')) {
            this.socket.emit('kill-ffmpeg');
            this.appendLog('⚠️ Forced stop requested...\n');
        }
    }

    updateStatus(text, type = 'ready') {
        this.statusText.textContent = text;
        this.statusText.className = `status-${type}`;
    }

    updateControls() {
        if (this.isRunning) {
            this.stopBtn.disabled = this.isStopping || this.isApplying;

            if (this.hasPendingChanges && !this.isApplying) {
                this.startBtn.textContent = this.applyLabel;
                this.startBtn.disabled = false;
            } else {
                this.startBtn.textContent = this.defaultStartLabel;
                this.startBtn.disabled = true;
            }
        } else {
            this.stopBtn.disabled = true;
            this.startBtn.textContent = this.defaultStartLabel;
            this.startBtn.disabled = this.isStarting;
        }
    }

    handleConfigChange() {
        if (this.isRunning && !this.isApplying) {
            this.hasPendingChanges = true;
            this.updateControls();
        }
    }

    appendLog(text) {
        this.logOutput.textContent += text;
        this.logOutput.scrollTop = this.logOutput.scrollHeight;
    }

    clearLog() {
        this.logOutput.textContent = '';
    }

    applyTonePreset(frequency) {
        const freqValue = parseInt(frequency, 10);
        if (!Number.isFinite(freqValue)) {
            return;
        }

        this.audioFreqSlider.value = freqValue;
        this.audioFreqValue.textContent = freqValue + ' Hz';
        this.selectedTonePreset = freqValue;
        this.updateTonePresetButtons();
        this.previewCommand();
        this.saveSettings();
        this.handleConfigChange();
    }

    syncTonePresetHighlight() {
        const currentFreq = parseInt(this.audioFreqSlider.value, 10);

        if (this.audioPresetValues.includes(currentFreq)) {
            this.selectedTonePreset = currentFreq;
        } else {
            this.selectedTonePreset = null;
        }

        this.updateTonePresetButtons();
    }

    updateTonePresetButtons() {
        this.tonePresetButtons.forEach(button => {
            const presetValue = parseInt(button.dataset.audioPreset, 10);
            button.classList.toggle('active', this.selectedTonePreset === presetValue);
        });
    }

    updateBackgroundControls() {
        if (!this.backgroundSelect || !this.customBackgroundControls) {
            return;
        }

        const isCustom = this.backgroundSelect.value === 'custom';
        this.customBackgroundControls.style.display = isCustom ? 'block' : 'none';

        if (isCustom) {
            let autoSelected = false;
            if (this.customBackgroundSelect && !this.customBackgroundSelect.value && this.customBackgroundSelect.options.length > 1) {
                this.customBackgroundSelect.selectedIndex = 1;
                autoSelected = true;
            }
            this.updateBackgroundPreview();
            if (autoSelected) {
                this.previewCommand();
                this.saveSettings();
                this.handleConfigChange();
            }
        } else {
            if (this.customBackgroundSelect) {
                this.customBackgroundSelect.value = '';
            }
            if (this.backgroundPreview) {
                this.backgroundPreview.style.display = 'none';
                this.backgroundPreview.innerHTML = '';
            }
        }
    }

    updateBackgroundPreview() {
        if (!this.backgroundPreview || !this.customBackgroundSelect) {
            return;
        }

        const file = this.customBackgroundSelect.value;
        if (this.backgroundSelect.value === 'custom' && file) {
            this.backgroundPreview.style.display = 'flex';
            this.backgroundPreview.innerHTML = `
                <img src="/uploads/backgrounds/${file}" alt="Background preview">
                <div class="bg-info">File: ${file}</div>
            `;
        } else {
            this.backgroundPreview.style.display = 'none';
            this.backgroundPreview.innerHTML = '';
        }
    }

    renderAudioChannelToggles(metadata) {
        this.audioChannelContainer.innerHTML = '';
        this.audioChannelToggles = [];
        this.audioChannelIdCycleToggles = [];
        this.audioChannelFlashToggles = [];
        this.audioChannelForce400Toggles = [];

        metadata.forEach((meta, index) => {
            const wrapper = document.createElement('div');
            wrapper.className = 'channel-toggle';

            const mainLabel = document.createElement('label');
            mainLabel.className = 'channel-toggle-main';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.dataset.channelIndex = index;
            checkbox.checked = index < 2;
            checkbox.addEventListener('change', () => {
                this.handleAudioChannelToggle(checkbox);
                this.updateAudioChannelOptionStateFor(index);
            });

            const span = document.createElement('span');
            span.textContent = meta.label;

            mainLabel.appendChild(checkbox);
            mainLabel.appendChild(span);
            wrapper.appendChild(mainLabel);

            const optionsRow = document.createElement('div');
            optionsRow.className = 'channel-option-row';

            const idCycleLabel = document.createElement('label');
            idCycleLabel.className = 'channel-option';
            const idCycleCheckbox = document.createElement('input');
            idCycleCheckbox.type = 'checkbox';
            idCycleCheckbox.dataset.channelIndex = index;
            idCycleCheckbox.addEventListener('change', () => this.handleAudioChannelOptionChange(index));
            idCycleLabel.appendChild(idCycleCheckbox);
            idCycleLabel.appendChild(document.createTextNode('ID cycle −20 dB'));

            const flashLabel = document.createElement('label');
            flashLabel.className = 'channel-option';
            const flashCheckbox = document.createElement('input');
            flashCheckbox.type = 'checkbox';
            flashCheckbox.dataset.channelIndex = index;
            flashCheckbox.addEventListener('change', () => this.handleAudioChannelOptionChange(index));
            flashLabel.appendChild(flashCheckbox);
            flashLabel.appendChild(document.createTextNode('1-frame Flash +12 dB'));

            const forceLabel = document.createElement('label');
            forceLabel.className = 'channel-option';
            const forceCheckbox = document.createElement('input');
            forceCheckbox.type = 'checkbox';
            forceCheckbox.dataset.channelIndex = index;
            forceCheckbox.addEventListener('change', () => this.handleAudioChannelOptionChange(index));
            forceLabel.appendChild(forceCheckbox);
            forceLabel.appendChild(document.createTextNode('Force 400 Hz'));

            optionsRow.appendChild(idCycleLabel);
            optionsRow.appendChild(flashLabel);
            optionsRow.appendChild(forceLabel);
            wrapper.appendChild(optionsRow);
            this.audioChannelContainer.appendChild(wrapper);

            this.audioChannelToggles.push(checkbox);
            this.audioChannelIdCycleToggles.push(idCycleCheckbox);
            this.audioChannelFlashToggles.push(flashCheckbox);
            this.audioChannelForce400Toggles.push(forceCheckbox);
        });

        this.applyPendingAudioChannelMap();

        if (this.pendingAudioChannelOptions) {
            this.applyAudioChannelOptions(this.pendingAudioChannelOptions);
        } else {
            this.updateAudioChannelOptionStates();
        }
    }

    applyAudioChannelMap(channelMap) {
        if (!Array.isArray(channelMap) || this.audioChannelToggles.length === 0) {
            this.pendingAudioChannelMap = channelMap;
            return;
        }

        this.audioChannelToggles.forEach((checkbox, index) => {
            checkbox.checked = Boolean(channelMap[index]);
            this.updateAudioChannelOptionStateFor(index);
        });

        this.ensureMinimumAudioChannels();
    }

    applyPendingAudioChannelMap() {
        if (this.pendingAudioChannelMap) {
            this.applyAudioChannelMap(this.pendingAudioChannelMap);
            this.pendingAudioChannelMap = null;
        } else {
            this.ensureMinimumAudioChannels();
        }
        this.updateAudioChannelOptionStates();
    }

    ensureMinimumAudioChannels() {
        const activeCount = this.audioChannelToggles.filter(cb => cb.checked).length;
        if (activeCount === 0 && this.audioChannelToggles.length > 0) {
            this.audioChannelToggles.slice(0, 2).forEach(cb => {
                cb.checked = true;
            });
        }
        this.updateAudioChannelOptionStates();
    }

    applyAudioChannelOptions(options = {}) {
        const idCycle = Array.isArray(options.idCycle) ? options.idCycle : [];
        const flashFlags = Array.isArray(options.flashFlags) ? options.flashFlags : [];
        const force400 = Array.isArray(options.force400) ? options.force400 : [];

        if (
            this.audioChannelIdCycleToggles.length === 0 ||
            this.audioChannelFlashToggles.length === 0 ||
            this.audioChannelForce400Toggles.length === 0
        ) {
            this.pendingAudioChannelOptions = {
                idCycle: idCycle.slice(),
                flashFlags: flashFlags.slice(),
                force400: force400.slice()
            };
            return;
        }

        this.audioChannelIdCycleToggles.forEach((checkbox, index) => {
            checkbox.checked = Boolean(idCycle[index]);
        });
        this.audioChannelFlashToggles.forEach((checkbox, index) => {
            checkbox.checked = Boolean(flashFlags[index]);
        });
        this.audioChannelForce400Toggles.forEach((checkbox, index) => {
            checkbox.checked = Boolean(force400[index]);
        });

        this.pendingAudioChannelOptions = null;
        this.updateAudioChannelOptionStates();
    }

    updateAudioChannelOptionStateFor(index) {
        const mainToggle = this.audioChannelToggles[index];
        const enabled = mainToggle ? mainToggle.checked : false;
        const idCycleToggle = this.audioChannelIdCycleToggles[index];
        const flashToggle = this.audioChannelFlashToggles[index];
        const forceToggle = this.audioChannelForce400Toggles[index];

        if (idCycleToggle) {
            idCycleToggle.disabled = !enabled;
        }
        if (flashToggle) {
            flashToggle.disabled = !enabled;
        }
        if (forceToggle) {
            forceToggle.disabled = !enabled;
        }
    }

    updateAudioChannelOptionStates() {
        this.audioChannelToggles.forEach((_, index) => this.updateAudioChannelOptionStateFor(index));
    }

    handleAudioChannelOptionChange(index) {
        if (typeof index === 'number') {
            this.updateAudioChannelOptionStateFor(index);
        }
        this.previewCommand();
        this.saveSettings();
        this.handleConfigChange();
    }

    setAudioLevelValue(levelDb) {
        if (!this.audioLevelSelect) {
            return;
        }

        const fallback = '0';
        let targetValue = fallback;

        if (levelDb !== undefined && levelDb !== null && levelDb !== '') {
            targetValue = String(levelDb).trim();
        }

        if (targetValue === '-0' || targetValue === '-0.0') {
            targetValue = '0';
        }

        const options = Array.from(this.audioLevelSelect.options);
        const datasetMatch = options.find(opt => opt.dataset && opt.dataset.dbfs === targetValue);
        if (datasetMatch) {
            this.audioLevelSelect.value = datasetMatch.value;
            return;
        }

        const directMatch = options.find(opt => opt.value === targetValue);
        if (directMatch) {
            this.audioLevelSelect.value = directMatch.value;
            return;
        }

        const numericLevel = Number(targetValue);
        const formatted = Number.isFinite(numericLevel)
            ? (numericLevel > 0 ? `+${numericLevel}` : numericLevel.toString())
            : targetValue;
        const option = document.createElement('option');
        option.value = `custom_${targetValue}`;
        option.dataset.dbfs = targetValue;
        option.textContent = `${formatted} dB`;
        this.audioLevelSelect.appendChild(option);
        this.audioLevelSelect.value = option.value;
    }

    handleAudioChannelToggle(checkbox) {
        const index = Number.parseInt(checkbox.dataset.channelIndex, 10);
        if (!checkbox.checked) {
            const stillActive = this.audioChannelToggles.some(cb => cb.checked);
            if (!stillActive) {
                checkbox.checked = true;
                this.updateAudioChannelOptionStateFor(index);
                return;
            }
        }

        this.updateAudioChannelOptionStateFor(index);
        this.previewCommand();
        this.saveSettings();
        this.handleConfigChange();
    }

    // Preset management methods
    async savePreset() {
        const name = this.presetNameInput.value.trim();
        if (!name) {
            alert('Please enter a name for the preset.');
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
                this.appendLog(`💾 Preset "${name}" saved\n`);
            } else {
                alert('Error while saving the preset.');
            }
        } catch (error) {
            console.error('Error saving preset:', error);
            alert('Error while saving the preset.');
        }
    }

    async loadPreset() {
        const selectedPreset = this.presetSelect.value;
        if (!selectedPreset) {
            alert('Please select a preset to load.');
            return;
        }

        try {
            const response = await fetch('/api/presets');
            const presets = await response.json();
            const preset = presets[selectedPreset];

            if (preset) {
                this.applyConfig(preset);
                this.appendLog(`📁 Preset "${selectedPreset}" loaded\n`);
            }
        } catch (error) {
            console.error('Error loading preset:', error);
            alert('Error while loading the preset.');
        }
    }

    async deletePreset() {
        const selectedPreset = this.presetSelect.value;
        if (!selectedPreset) {
            alert('Please select a preset to delete.');
            return;
        }

        if (!confirm(`Are you sure you want to delete the preset "${selectedPreset}"?`)) {
            return;
        }

        try {
            const response = await fetch(`/api/presets/${encodeURIComponent(selectedPreset)}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                await this.loadPresetsList();
                this.appendLog(`🗑️ Preset "${selectedPreset}" deleted\n`);
            } else {
                alert('Error while deleting the preset.');
            }
        } catch (error) {
            console.error('Error deleting preset:', error);
            alert('Error while deleting the preset.');
        }
    }

    async loadPresetsList() {
        try {
            const response = await fetch('/api/presets');
            const presets = await response.json();

            // Clear current options except the first one
            this.presetSelect.innerHTML = '<option value="">Select a preset...</option>';

            // Add presets to select
            Object.keys(presets).forEach(name => {
                const option = document.createElement('option');
                option.value = name;
                option.textContent = name;
                this.presetSelect.appendChild(option);
            });

            if (presets.Actua) {
                this.presetSelect.value = 'Actua';
            }
        } catch (error) {
            console.error('Error loading presets list:', error);
        }
    }

    applyConfig(config, options = {}) {
        const { skipSave = false, skipPreview = false, markClean = false } = options;

        // Apply background
        if (config.background) {
            this.backgroundSelect.value = config.background;
        }
        if (this.customBackgroundSelect && config.customBackground !== undefined) {
            this.customBackgroundSelect.value = config.customBackground || '';
        }
        this.updateBackgroundControls();
        this.updateBackgroundPreview();

        // Apply text
        if (config.text !== undefined) this.textInput.value = config.text;
        if (config.textPosition) this.selectTextPosition(config.textPosition);
        if (config.fontSize) {
            this.fontSizeSlider.value = config.fontSize;
            this.fontSizeValue.textContent = config.fontSize + 'px';
        }
        if (config.fontFamily && this.fontFamilySelect) this.fontFamilySelect.value = config.fontFamily;
        if (config.textWeight && this.textWeightSelect) this.textWeightSelect.value = config.textWeight;
        if (config.textColor) this.textColorSelect.value = config.textColor;
        if (config.textBackground && this.textBackgroundSelect) this.textBackgroundSelect.value = config.textBackground;

        // Apply logo
        if (config.showLogo !== undefined) this.showLogoCheckbox.checked = config.showLogo;
        if (config.logoPosition) this.selectLogoPosition(config.logoPosition);

        // Apply animation
        if (config.animation) this.animationSelect.value = config.animation;

        // Apply audio
        if (Array.isArray(config.audioChannelMap)) {
            this.applyAudioChannelMap(config.audioChannelMap);
        }

        this.applyAudioChannelOptions({
            idCycle: config.audioChannelIdCycle,
            flashFlags: Array.isArray(config.audioChannelFlash)
                ? config.audioChannelFlash
                : Array.isArray(config.audioChannelIdPop)
                    ? config.audioChannelIdPop
                    : [],
            force400: config.audioChannelForce400
        });

        this.setAudioLevelValue(config.audioLevelDb);

        if (config.audioFreq !== undefined) {
            this.audioFreqSlider.value = config.audioFreq;
            this.audioFreqValue.textContent = config.audioFreq + ' Hz';
            this.syncTonePresetHighlight();
        }

        // Apply video format
        if (config.videoFormat) this.videoFormatSelect.value = config.videoFormat;
        if (this.decklinkDeviceSelect) {
            const deviceValue = config.decklinkDevice ? String(config.decklinkDevice) : '';
            if (deviceValue) {
                this.ensureDecklinkDeviceOption(deviceValue);
            }
            this.decklinkDeviceSelect.value = deviceValue;
        }

        // Apply clock
        if (config.showClock !== undefined) {
            this.showClockCheckbox.checked = Boolean(config.showClock);
        }
        if (this.clockLatencyInput && config.clockLatencyMs !== undefined) {
            const latencyValue = Number(config.clockLatencyMs);
            if (Number.isFinite(latencyValue)) {
                this.clockLatencyInput.value = latencyValue;
            }
        }
        if (config.clockPosition) {
            const silentClockUpdate = skipPreview && skipSave;
            this.selectClockPosition(config.clockPosition, { silent: silentClockUpdate });
        }
        if (this.showConfigOverlayCheckbox && config.showConfigOverlay !== undefined) {
            this.showConfigOverlayCheckbox.checked = Boolean(config.showConfigOverlay);
        }
        if (this.overlayFontSizeSlider && config.configOverlayFontSize !== undefined) {
            const overlaySize = Number(config.configOverlayFontSize);
            if (Number.isFinite(overlaySize)) {
                this.overlayFontSizeSlider.value = overlaySize;
            }
        }
        if (this.overlayPositionSelect && config.configOverlayPosition) {
            this.overlayPositionSelect.value = config.configOverlayPosition;
        }
        const incomingFlashOffset = config.flashOverlayOffset ?? config.popFlashOffset;
        if (this.flashOverlayOffsetSlider && incomingFlashOffset !== undefined) {
            const flashOffset = Number(incomingFlashOffset);
            if (Number.isFinite(flashOffset)) {
                this.flashOverlayOffsetSlider.value = flashOffset;
            }
        }
        this.updateOverlayControlsState();
        this.updateClockControlsState();
        this.updateRangeValues();

        // Update UI
        this.updateLogoPreview();

        if (!skipPreview) {
            this.previewCommand();
        }

        if (!skipSave) {
            this.saveSettings();
        }

        if (markClean) {
            this.hasPendingChanges = false;
            this.updateControls();
        } else {
            this.handleConfigChange();
        }
    }

    createClockPositions() {
        const positions = [
            { id: 'top-left', label: '↖️' },
            { id: 'top-center', label: '⬆️' },
            { id: 'top-right', label: '↗️' },
            { id: 'center-left', label: '⬅️' },
            { id: 'center', label: '⚫' },
            { id: 'center-right', label: '➡️' },
            { id: 'bottom-left', label: '↙️' },
            { id: 'bottom-center', label: '⬇️' },
            { id: 'bottom-right', label: '↘️' }
        ];

        positions.forEach(pos => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'position-btn';
            button.textContent = pos.label;
            button.title = pos.id;
            button.dataset.position = pos.id;

            if (pos.id === this.selectedClockPosition) {
                button.classList.add('active');
            }

            button.addEventListener('click', () => this.selectClockPosition(pos.id));
            this.clockPositionsGrid.appendChild(button);
        });
    }

    selectClockPosition(position, options = {}) {
        const { silent = false } = options;
        this.selectedClockPosition = position;

        // Update button states
        this.clockPositionsGrid.querySelectorAll('.position-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.position === position);
        });

        if (!silent) {
            this.previewCommand();
            this.saveSettings();
            this.handleConfigChange();
        }
    }

    selectTextPosition(position) {
        if (!this.textPositionSelect) {
            return;
        }

        const desired = String(position);
        const hasOption = Array.from(this.textPositionSelect.options).some(opt => opt.value === desired);
        if (!hasOption) {
            const option = document.createElement('option');
            option.value = desired;
            option.textContent = desired;
            this.textPositionSelect.appendChild(option);
        }

        this.textPositionSelect.value = desired;
    }

    selectLogoPosition(position) {
        if (!this.logoPosition) {
            return;
        }

        const desired = String(position);
        const hasOption = Array.from(this.logoPosition.options).some(opt => opt.value === desired);
        if (!hasOption) {
            const option = document.createElement('option');
            option.value = desired;
            option.textContent = desired;
            this.logoPosition.appendChild(option);
        }

        this.logoPosition.value = desired;
    }

    async loadOptions() {
        try {
            // Load backgrounds
            const backgrounds = await fetch('/api/backgrounds').then(r => r.json());
            this.populateSelect(this.backgroundSelect, backgrounds, this.backgroundSelect.value || 'blue');
            await this.loadUploadedBackgrounds();

            // Load text positions
            const textPositions = await fetch('/api/text-positions').then(r => r.json());
            this.populateSelect(this.textPositionSelect, textPositions);

            // Load logo positions
            const logoPositions = await fetch('/api/logo-positions').then(r => r.json());
            this.populateSelect(this.logoPosition, logoPositions);

            // Load overlay positions
            if (this.overlayPositionSelect) {
                const overlayPositions = await fetch('/api/overlay-positions').then(r => r.json());
                this.populateSelect(this.overlayPositionSelect, overlayPositions);
            }

            // Load animations
            const animations = await fetch('/api/animations').then(r => r.json());
            this.populateSelect(this.animationSelect, animations);

            // Load video formats
            const videoFormats = await fetch('/api/video-formats').then(r => r.json());
            this.populateSelect(this.videoFormatSelect, videoFormats);

            const decklinkDevices = await fetch('/api/decklink-sinks').then(r => r.json());
            this.populateDecklinkSelect(decklinkDevices);

            // Load audio channel metadata
            const audioChannels = await fetch('/api/audio-channels').then(r => r.json());
            this.renderAudioChannelToggles(audioChannels);

            // Load uploaded logos
            await this.loadUploadedLogos();

            this.updateBackgroundControls();
        } catch (error) {
            console.error('Error loading options:', error);
        }
    }

    populateSelect(select, options, selectedValue = null) {
        const preference = selectedValue !== null ? selectedValue : select.value;
        select.innerHTML = '';
        options.forEach(option => {
            const optionElement = document.createElement('option');
            optionElement.value = option.id;
            optionElement.textContent = option.name;
            select.appendChild(optionElement);
        });

        if (preference) {
            const hasMatch = Array.from(select.options).some(opt => opt.value === String(preference));
            if (hasMatch) {
                select.value = String(preference);
                return;
            }
        }

        if (select.options.length > 0) {
            select.selectedIndex = 0;
        }
    }

    populateDecklinkSelect(devices) {
        if (!this.decklinkDeviceSelect) {
            return;
        }

        const priorValue = this.decklinkDeviceSelect.value;
        this.decklinkDeviceSelect.innerHTML = '<option value="">Auto-select (first detected)</option>';

        devices.forEach(device => {
            const option = document.createElement('option');
            option.value = device.id;
            option.textContent = device.name;
            this.decklinkDeviceSelect.appendChild(option);
        });

        if (priorValue) {
            const hasMatch = Array.from(this.decklinkDeviceSelect.options)
                .some(opt => opt.value === priorValue);
            if (hasMatch) {
                this.decklinkDeviceSelect.value = priorValue;
                return;
            }
        }

        this.decklinkDeviceSelect.selectedIndex = 0;
    }

    ensureDecklinkDeviceOption(deviceName) {
        if (!this.decklinkDeviceSelect || !deviceName) {
            return;
        }

        const exists = Array.from(this.decklinkDeviceSelect.options)
            .some(opt => opt.value === deviceName);

        if (!exists) {
            const option = document.createElement('option');
            option.value = deviceName;
            option.textContent = deviceName;
            this.decklinkDeviceSelect.appendChild(option);
        }
    }

    async loadUploadedLogos() {
        try {
            const logos = await fetch('/api/uploaded-logos').then(r => r.json());

            // Clear existing options except default
            this.logoSelect.innerHTML = '<option value="">Default ACTUA logo</option>';

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

    async loadUploadedBackgrounds() {
        if (!this.customBackgroundSelect) {
            return;
        }

        try {
            const backgrounds = await fetch('/api/uploaded-backgrounds').then(r => r.json());
            this.customBackgroundSelect.innerHTML = '<option value="">Select an uploaded background...</option>';

            backgrounds.forEach(bg => {
                const option = document.createElement('option');
                option.value = bg.filename;
                option.textContent = bg.filename;
                this.customBackgroundSelect.appendChild(option);
            });
            this.updateBackgroundPreview();
        } catch (error) {
            console.error('Error loading uploaded backgrounds:', error);
        }
    }

    async loadSettings() {
        try {
            const response = await fetch('/api/settings');
            const settings = await response.json();
            this.applyConfig(settings, { skipSave: true, skipPreview: true, markClean: true });
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
            this.uploadLogoBtn.textContent = '📤 Uploading...';
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

                this.showUploadStatus(this.logoPreview, 'Logo uploaded successfully!', 'success');
            } else {
                this.showUploadStatus(this.logoPreview, 'Upload error: ' + result.error, 'error');
            }

        } catch (error) {
            this.showUploadStatus(this.logoPreview, 'Upload error: ' + error.message, 'error');
        } finally {
            this.uploadLogoBtn.textContent = '📁 Upload PNG';
            this.uploadLogoBtn.disabled = false;
            this.logoFileInput.value = '';
        }
    }

    async handleBackgroundUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('background', file);

        try {
            if (this.uploadBgBtn) {
                this.uploadBgBtn.textContent = '📤 Uploading...';
                this.uploadBgBtn.disabled = true;
            }

            const response = await fetch('/api/upload-background', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (result.success) {
                await this.loadUploadedBackgrounds();
                this.backgroundSelect.value = 'custom';
                if (this.customBackgroundSelect) {
                    this.customBackgroundSelect.value = result.filename;
                }
                this.updateBackgroundControls();
                this.previewCommand();
                this.saveSettings();
                this.handleConfigChange();
                this.showUploadStatus(this.customBackgroundControls, 'Background uploaded successfully!', 'success');
            } else {
                this.showUploadStatus(this.customBackgroundControls, 'Upload error: ' + result.error, 'error');
            }
        } catch (error) {
            console.error('Background upload error:', error);
            this.showUploadStatus(this.customBackgroundControls, 'Upload error: ' + error.message, 'error');
        } finally {
            if (this.uploadBgBtn) {
                this.uploadBgBtn.textContent = '📁 Upload Image';
                this.uploadBgBtn.disabled = false;
            }
            if (this.backgroundFileInput) {
                this.backgroundFileInput.value = '';
            }
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

    showUploadStatus(targetElement, message, type) {
        const anchor = targetElement || this.logoPreview;
        if (!anchor || !anchor.parentNode) {
            return;
        }

        const parent = anchor.parentNode;
        const existingStatus = parent.querySelector('.upload-status');
        if (existingStatus) {
            existingStatus.remove();
        }

        const status = document.createElement('div');
        status.className = `upload-status ${type}`;
        status.textContent = message;
        status.style.display = 'block';

        if (anchor.nextSibling) {
            parent.insertBefore(status, anchor.nextSibling);
        } else {
            parent.appendChild(status);
        }

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
