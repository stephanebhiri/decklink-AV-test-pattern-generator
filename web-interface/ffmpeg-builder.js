// FFmpeg Command Builder for ACTUA Broadcast Generator
const path = require('path');
const fs = require('fs');

class FFmpegBuilder {
    constructor() {
        this.ffmpegPath = path.join(process.env.HOME, 'ffmpeg-4.4.4', 'ffmpeg');
        this.picturesPath = path.join(process.env.HOME, 'Pictures');
        this.logoPath = path.join(this.picturesPath, 'PNG-actua', 'actua.png');
        this.barsPath = path.join(this.picturesPath, 'bars.png');
        this.resolutionTestPath = path.join(this.picturesPath, 'resolution_test.png');
        this.fontPath = '/System/Library/Fonts/SFNSMono.ttf';
        this.fontOptions = {
            sf_mono: { type: 'fontfile', value: this.fontPath },
            arial_bold: { type: 'font', value: 'Arial-BoldMT' },
            arial_black: { type: 'font', value: 'Arial-Black' },
            impact: { type: 'font', value: 'Impact' }
        };
    }

    buildCommand(config) {
        const {
            background = 'blue',
            customBackground = null,
            text = 'ACTUA PARIS',
            fontSize = 80,
            fontFamily = 'sf_mono',
            textWeight = 'normal',
            textColor = 'white',
            textBackground = 'none',
            textPosition = 'center',
            showLogo = true,
            logoFile = null,
            logoPosition = 'top-right',
            audioFreq = 1000,
            audioLevelDb = 0,
            audioChannels = 2,
            audioChannelMap = null,
            audioChannelIdCycle = [],
            audioChannelIdPop = [],
            audioChannelForce400 = [],
            animation = null,
            videoFormat = '1080i50',
            showClock = false,
            clockPosition = 'bottom-right'
        } = config;

        // Calculate text position based on 9-grid system
        const textPos = this.getTextPosition(textPosition);
        // Calculate logo position
        const logoPos = this.getLogoPosition(logoPosition);

        let cmd = [this.ffmpegPath];
        let inputs = [];
        let filterComplex = [];

        // Lookup format-specific characteristics once
        const fps = this.getFrameRate(videoFormat);
        const { width, height } = this.getResolution(videoFormat);
        const resolution = `${width}x${height}`;

        // Background input
        if (background === 'bars') {
            cmd.push('-loop', '1', '-i', this.barsPath);
            inputs.push('0:v');
        } else if (background === 'resolution_test') {
            cmd.push('-loop', '1', '-i', this.resolutionTestPath);
            inputs.push('0:v');
        } else if (background === 'custom' && customBackground) {
            const customBgPath = path.join(__dirname, 'uploads', 'backgrounds', customBackground);
            cmd.push('-loop', '1', '-i', customBgPath);
            inputs.push('0:v');
        } else if (background === 'blue' || background === 'black' || background === 'white') {
            cmd.push('-f', 'lavfi', '-i', `color=c=${background}:size=${resolution}:rate=${fps}`);
            inputs.push('0:v');
        } else {
            cmd.push('-f', 'lavfi', '-i', `color=c=blue:size=${resolution}:rate=${fps}`);
            inputs.push('0:v');
        }

        let nextInput = 1;

        // Animation input (if needed)
        if (animation === 'square') {
            cmd.push('-f', 'lavfi', '-i', `color=c=white:size=100x100:rate=${fps}`);
            nextInput++;
        }

        // Logo input
        if (showLogo) {
            const logoPath = logoFile ? path.join(process.env.HOME, 'PLAYTOBMD', 'web-interface', 'uploads', logoFile) : this.logoPath;
            cmd.push('-i', logoPath);
            nextInput++;
        }

        // Audio input (support channel mapping)
        const normalizedAudioFreq = Number.isFinite(audioFreq) ? audioFreq : parseInt(audioFreq, 10);
        const toneFrequency = Number.isFinite(normalizedAudioFreq) ? normalizedAudioFreq : 1000;
        const clampedToneFrequency = Math.max(20, Math.min(20000, toneFrequency));
        const channelMap = this.resolveAudioChannelMap(audioChannelMap, audioChannels);
        const idCycleFlags = this.normalizeChannelOption(audioChannelIdCycle);
        const idPopFlags = this.normalizeChannelOption(audioChannelIdPop);
        const force400Flags = this.normalizeChannelOption(audioChannelForce400);
        const requiresExtendedLayout = channelMap.some((isActive, index) => isActive && index >= 2);
        const decklinkAudioChannels = requiresExtendedLayout ? 8 : 2;
        const audioLayout = this.getAudioChannelLayout(decklinkAudioChannels);
        const cycleExpr = this.getCycleEnvelope();
        const popExpr = this.getIdPopExpression(fps);
        const silentExpr = '(0.000001)';
        const channelExprs = channelMap
            .slice(0, decklinkAudioChannels)
            .map((isActive, idx) => {
                if (!isActive) {
                    return silentExpr;
                }

                const channelFreq = force400Flags[idx] ? 400 : clampedToneFrequency;
                let expr = `sin(2*PI*${channelFreq}*t)`;

                if (idCycleFlags[idx]) {
                    expr = `(${expr}*${cycleExpr})`;
                }

                if (idPopFlags[idx]) {
                    expr = `(${expr}*${popExpr})`;
                }

                return expr;
            })
            .join('|');
        cmd.push('-f', 'lavfi', '-i', `aevalsrc=exprs=${channelExprs}:sample_rate=48000:channel_layout=${audioLayout}`);

        // Build filter chain
        let currentOutput = '[0:v]';
        let filterIndex = 0;

        // Normalize frame rate before heavy filters so the clock sees each field for interlaced formats
        if (videoFormat.includes('i')) {
            filterComplex.push(`${currentOutput}fps=${fps}[fps${filterIndex}]`);
            currentOutput = `[fps${filterIndex}]`;
            filterIndex++;
        }

        // Only scale the base layer when the requested format needs it (e.g. 720p, SD, or image backgrounds)
        const needsBaseScale = background === 'bars' || width !== 1920 || height !== 1080;
        if (needsBaseScale) {
            filterComplex.push(`${currentOutput}scale=${width}:${height}[base${filterIndex}]`);
            currentOutput = `[base${filterIndex}]`;
            filterIndex++;
        }

        // Add text (support multi-line with separate drawtext filters)
        if (text) {
            const lines = text.split('\n');

            lines.forEach((line, lineIndex) => {
                if (line.trim()) { // Only process non-empty lines
                    // Escape special characters for each line
                    const escapedLine = line
                        .replace(/\\/g, '\\\\\\\\')  // Escape backslashes first
                        .replace(/'/g, "\\\\'")      // Escape single quotes
                        .replace(/:/g, '\\\\:');     // Escape colons

                    // Calculate Y position for each line
                    let yPos = textPos.y;
                    if (lines.length > 1) {
                        // For multi-line text, adjust Y position based on line index
                        if (textPos.y.includes('(h-text_h)/2')) {
                            // Center positioning - distribute lines around center
                            const lineSpacing = fontSize * 1.2; // 120% of font size
                            const totalHeight = (lines.length - 1) * lineSpacing;
                            const startY = `((h-text_h)/2-${totalHeight/2})`;
                            yPos = `${startY}+${lineIndex * lineSpacing}`;
                        } else {
                            // Other positioning - just add line spacing
                            const lineSpacing = fontSize * 1.2;
                            yPos = `(${textPos.y})+${lineIndex * lineSpacing}`;
                        }
                    }

                    const fontDirective = this.getFontDirective(fontFamily);
                    const borderDirective = this.getTextBorderDirective(textWeight, textColor);
                    const boxDirective = this.getTextBoxDirective(textBackground, fontSize);
                    const drawtextParts = [
                        `drawtext=text='${escapedLine}'`,
                        fontDirective,
                        `fontsize=${fontSize}`,
                        `fontcolor=${textColor}`
                    ];

                    if (borderDirective) {
                        drawtextParts.push(borderDirective);
                    }

                    if (boxDirective) {
                        drawtextParts.push(boxDirective);
                    }

                    drawtextParts.push(`x=${textPos.x}`);
                    drawtextParts.push(`y=${yPos}`);

                    const textFilter = drawtextParts.filter(Boolean).join(':');
                    filterComplex.push(`${currentOutput}${textFilter}[txt${filterIndex}]`);
                    currentOutput = `[txt${filterIndex}]`;
                    filterIndex++;
                }
            });
        }

        const needsIdFlash = idPopFlags.some(Boolean);
        if (needsIdFlash) {
            const frameDuration = fps > 0 ? (1 / fps) : 0.04;
            const frameExpr = frameDuration.toFixed(6);
            const flashEnable = `lt(mod(t\\,1)\\,${frameExpr})`;
            filterComplex.push(`${currentOutput}drawbox=x=(w-w*0.15)/2:y=(h-h*0.15)/2:w=w*0.15:h=h*0.15:color=white@0.9:t=fill:enable='${flashEnable}'[flash${filterIndex}]`);
            currentOutput = `[flash${filterIndex}]`;
            filterIndex++;
        }

        // Add animation
        if (animation === 'square') {
            filterComplex.push(`${currentOutput}[1:v]overlay=x='t*25':y=490[anim${filterIndex}]`);
            currentOutput = `[anim${filterIndex}]`;
            filterIndex++;
        }

        // Add logo
        if (showLogo) {
            const logoInput = animation === 'square' ? '[2:v]' : '[1:v]';
            filterComplex.push(`${currentOutput}${logoInput}overlay=${logoPos.x}:${logoPos.y}[logo${filterIndex}]`);
            currentOutput = `[logo${filterIndex}]`;
            filterIndex++;
        }

        // Add clock
        if (showClock) {
            const clockPos = this.getClockPosition(clockPosition);
            const clockFontSize = Math.max(28, Math.round(48 * (height / 1080)));
            const clockLineSpacing = Math.max(4, Math.round(clockFontSize * 0.125));
            const clockBoxBorder = Math.max(3, Math.round(clockFontSize * 0.1));

            const startEpochMs = Date.now();
            const baseSeconds = Math.floor(startEpochMs / 1000);
            const datePrefix = new Date(startEpochMs).toISOString().split('T')[0];

            const totalSecondsExpr = `(${baseSeconds}+t)`;
            const hoursExpr = `%{eif\\:floor(${totalSecondsExpr}/3600)-24*floor(${totalSecondsExpr}/86400)\\:d\\:02}`;
            const minutesExpr = `%{eif\\:floor(${totalSecondsExpr}/60)-60*floor(${totalSecondsExpr}/3600)\\:d\\:02}`;
            const secondsExpr = `%{eif\\:floor(${totalSecondsExpr})-60*floor(${totalSecondsExpr}/60)\\:d\\:02}`;

            const displayFps = fps;
            const frameExpr = `%{eif\\:mod(n\\,${displayFps})\\:d\\:02}`;
            const millisecondsExpr = `%{eif\\:floor(1000*mod(t\\,1))\\:d\\:03}`;
            const msIndent = ' '.repeat(Math.max(6, Math.round(clockFontSize * 0.25) + 4));
            const clockText = `${datePrefix} ${hoursExpr}\\:${minutesExpr}\\:${secondsExpr}\\:${frameExpr}\n${msIndent}Ms ${millisecondsExpr}`;

            // Overlay real-time GMT date/time with frame count and millisecond line
            const clockFilter = `drawtext=text='${clockText}':fontfile='${this.fontPath}':fontsize=${clockFontSize}:fontcolor=white:line_spacing=${clockLineSpacing}:box=1:boxcolor=black@0.5:boxborderw=${clockBoxBorder}:x=${clockPos.x}:y=${clockPos.y}`;

            filterComplex.push(`${currentOutput}${clockFilter}[clock${filterIndex}]`);
            currentOutput = `[clock${filterIndex}]`;
            filterIndex++;
        }

        // For interlaced formats, add proper interlacing filters
        if (videoFormat.includes('i')) {
            // Add fps=50,setsar=1/1,tinterlace=mode=interleave_top,setfield=tff for optimal interlacing
            filterComplex.push(`${currentOutput}fps=50,setsar=1/1,tinterlace=mode=interleave_top,setfield=tff[v]`);
        } else {
            // Rename final output to [v]
            if (currentOutput !== '[0:v]') {
                filterComplex[filterComplex.length - 1] = filterComplex[filterComplex.length - 1].replace(/\[[^\]]+\]$/, '[v]');
                currentOutput = '[v]';
            } else {
                filterComplex.push('[0:v]copy[v]');
                currentOutput = '[v]';
            }
        }

        // Add filter complex
        if (filterComplex.length > 0) {
            cmd.push('-filter_complex', filterComplex.join(';'));
        }

        // Map outputs
        cmd.push('-map', '[v]');

        // Audio input mapping based on which inputs are active
        let audioInputIndex = 0;
        if (animation === 'square') audioInputIndex++; // Skip color input for square
        if (showLogo) audioInputIndex++; // Skip logo input
        audioInputIndex++; // Audio is always last

        cmd.push('-map', `${audioInputIndex}:a`);

        const audioVolume = this.resolveAudioVolume(audioLevelDb);
        if (audioVolume) {
            cmd.push('-af', `volume=${audioVolume}`);
        }

        // Common audio output settings
        cmd.push('-c:a', 'pcm_s16le', '-ar', '48000', '-ac', decklinkAudioChannels.toString(), '-channel_layout', audioLayout);

        // Output settings based on video format (append DeckLink options including preroll)
        const formatSettings = [...this.getVideoFormatSettings(videoFormat)];
        const targetDevice = formatSettings.pop();
        cmd.push(...formatSettings, '-preroll', '0.5', '-audio_depth', '16', '-channels', decklinkAudioChannels.toString(), targetDevice);

        return cmd;
    }

    getAvailableBackgrounds() {
        return [
            { id: 'blue', name: 'Blue Background', type: 'color' },
            { id: 'black', name: 'Black Background', type: 'color' },
            { id: 'white', name: 'White Background', type: 'color' },
            { id: 'bars', name: 'Color Bars', type: 'image' },
            { id: 'resolution_test', name: 'Resolution Test Chart', type: 'image' },
            { id: 'custom', name: 'Custom Background', type: 'upload' }
        ];
    }

    getAvailableAnimations() {
        return [
            { id: null, name: 'None' },
            { id: 'square', name: 'Moving Square' }
        ];
    }

    getTextPosition(position) {
        const positions = {
            'top-left': { x: '50', y: '50' },
            'top-center': { x: '(w-text_w)/2', y: '50' },
            'top-right': { x: 'w-text_w-50', y: '50' },
            'center-left': { x: '50', y: '(h-text_h)/2' },
            'center': { x: '(w-text_w)/2', y: '(h-text_h)/2' },
            'center-right': { x: 'w-text_w-50', y: '(h-text_h)/2' },
            'bottom-left': { x: '50', y: 'h-text_h-50' },
            'bottom-center': { x: '(w-text_w)/2', y: 'h-text_h-50' },
            'bottom-right': { x: 'w-text_w-50', y: 'h-text_h-50' }
        };
        return positions[position] || positions['center'];
    }

    getTextPositions() {
        return [
            { id: 'top-left', name: '↖ Top Left' },
            { id: 'top-center', name: '↑ Top Center' },
            { id: 'top-right', name: '↗ Top Right' },
            { id: 'center-left', name: '← Center Left' },
            { id: 'center', name: '⊙ Center' },
            { id: 'center-right', name: '→ Center Right' },
            { id: 'bottom-left', name: '↙ Bottom Left' },
            { id: 'bottom-center', name: '↓ Bottom Center' },
            { id: 'bottom-right', name: '↘ Bottom Right' }
        ];
    }

    getLogoPosition(position) {
        const positions = {
            'top-left': { x: '10', y: '10' },
            'top-center': { x: '(main_w-overlay_w)/2', y: '10' },
            'top-right': { x: 'main_w-overlay_w-10', y: '10' },
            'center-left': { x: '10', y: '(main_h-overlay_h)/2' },
            'center': { x: '(main_w-overlay_w)/2', y: '(main_h-overlay_h)/2' },
            'center-right': { x: 'main_w-overlay_w-10', y: '(main_h-overlay_h)/2' },
            'bottom-left': { x: '10', y: 'main_h-overlay_h-10' },
            'bottom-center': { x: '(main_w-overlay_w)/2', y: 'main_h-overlay_h-10' },
            'bottom-right': { x: 'main_w-overlay_w-10', y: 'main_h-overlay_h-10' }
        };
        return positions[position] || positions['top-right'];
    }

    getLogoPositions() {
        return [
            { id: 'top-left', name: '↖ Top Left' },
            { id: 'top-center', name: '↑ Top Center' },
            { id: 'top-right', name: '↗ Top Right' },
            { id: 'center-left', name: '← Center Left' },
            { id: 'center', name: '⊙ Center' },
            { id: 'center-right', name: '→ Center Right' },
            { id: 'bottom-left', name: '↙ Bottom Left' },
            { id: 'bottom-center', name: '↓ Bottom Center' },
            { id: 'bottom-right', name: '↘ Bottom Right' }
        ];
    }

    getVideoFormatSettings(format) {
        const formats = {
            '1080i50': [
                '-pix_fmt', 'uyvy422', '-s', '1920x1080', '-r', '25', '-field_order', 'tt',
                '-f', 'decklink', '-format_code', 'Hi50', '-raw_format', 'uyvy422',
                'UltraStudio Mini Monitor'
            ],
            '1080p25': [
                '-pix_fmt', 'uyvy422', '-s', '1920x1080', '-r', '25',
                '-f', 'decklink', '-format_code', 'Hp25', '-raw_format', 'uyvy422',
                'UltraStudio Mini Monitor'
            ],
            '1080p30': [
                '-pix_fmt', 'uyvy422', '-s', '1920x1080', '-r', '30',
                '-f', 'decklink', '-format_code', 'Hp30', '-raw_format', 'uyvy422',
                'UltraStudio Mini Monitor'
            ],
            '720p50': [
                '-pix_fmt', 'uyvy422', '-s', '1280x720', '-r', '50',
                '-f', 'decklink', '-format_code', 'Hp50', '-raw_format', 'uyvy422',
                'UltraStudio Mini Monitor'
            ],
            '720p60': [
                '-pix_fmt', 'uyvy422', '-s', '1280x720', '-r', '60',
                '-f', 'decklink', '-format_code', 'Hp60', '-raw_format', 'uyvy422',
                'UltraStudio Mini Monitor'
            ],
            '576i50': [
                '-pix_fmt', 'uyvy422', '-s', '720x576', '-r', '25',
                '-field_order', 'tt', '-flags', '+ilme+ildct',
                '-f', 'decklink', '-format_code', 'pal', '-raw_format', 'uyvy422',
                'UltraStudio Mini Monitor'
            ]
        };
        return formats[format] || formats['1080i50'];
    }

    getAudioChannelLayout(channels) {
        const layoutMap = {
            1: 'mono',
            2: 'stereo',
            3: '3.0',
            4: '4.0',
            5: '5.0',
            6: '5.1',
            7: '6.1',
            8: '7.1'
        };

        return layoutMap[channels] || `${channels}c`;
    }

    getAudioChannelMetadata() {
        return new Array(8).fill(0).map((_, idx) => ({
            id: idx,
            label: `Channel ${idx + 1}`
        }));
    }

    resolveAudioChannelMap(channelMap, fallbackCount) {
        const defaultCount = Math.min(8, Math.max(1, parseInt(fallbackCount, 10) || 2));
        const normalizedMap = Array.isArray(channelMap)
            ? channelMap.slice(0, 8).map(Boolean)
            : new Array(defaultCount).fill(true);

        while (normalizedMap.length < 8) {
            normalizedMap.push(false);
        }

        if (!normalizedMap.some(Boolean)) {
            normalizedMap[0] = true;
            if (normalizedMap.length > 1) {
                normalizedMap[1] = true;
            }
        }

        return normalizedMap;
    }

    normalizeChannelOption(optionArray) {
        const normalized = Array.isArray(optionArray)
            ? optionArray.slice(0, 8).map(Boolean)
            : [];

        while (normalized.length < 8) {
            normalized.push(false);
        }

        return normalized;
    }

    getCycleEnvelope() {
        return 'if(lt(mod(t\\,1)\\,0.5)\\,1\\,0.1)';
    }

    getIdPopExpression(fps) {
        const frameDuration = fps > 0 ? (1 / fps) : 0.04;
        const frameExpr = frameDuration.toFixed(6);
        const popGain = Math.pow(10, 12 / 20).toFixed(6);
        return `if(lt(mod(t\\,1)\\,${frameExpr})\\,${popGain}\\,1)`;
    }

    getFontDirective(fontFamily) {
        const option = this.fontOptions[fontFamily] || this.fontOptions.sf_mono;
        if (option && option.type === 'fontfile' && option.value) {
            const fontPath = this.resolveFontPath(option.value);
            if (fontPath) {
                const escaped = fontPath.replace(/'/g, "\\'");
                return `fontfile='${escaped}'`;
            }
        }

        if (option && option.type === 'font' && option.value) {
            return `font=${option.value}`;
        }

        const escapedDefault = this.fontPath.replace(/'/g, "\\'");
        return `fontfile='${escapedDefault}'`;
    }

    resolveFontPath(targetPath) {
        try {
            if (fs.existsSync(targetPath)) {
                return targetPath;
            }
        } catch (error) {
            console.warn('Font path check failed:', error);
        }
        return null;
    }

    getTextBorderDirective(weight, textColor) {
        switch (weight) {
            case 'semi':
                return `borderw=2:bordercolor=${textColor}`;
            case 'heavy':
                return `borderw=4:bordercolor=${textColor}`;
            default:
                return 'borderw=0';
        }
    }

    getTextBoxDirective(style, fontSize) {
        const border = Math.max(4, Math.round(fontSize * 0.15));
        switch (style) {
            case 'black_solid':
                return `box=1:boxcolor=black@1:boxborderw=${border}`;
            case 'black_soft':
                return `box=1:boxcolor=black@0.6:boxborderw=${border}`;
            case 'white_soft':
                return `box=1:boxcolor=white@0.6:boxborderw=${border}`;
            case 'yellow_soft':
                return `box=1:boxcolor=yellow@0.6:boxborderw=${border}`;
            case 'blue_soft':
                return `box=1:boxcolor=blue@0.5:boxborderw=${border}`;
            default:
                return null;
        }
    }

    resolveAudioVolume(levelDb) {
        const numericLevel = Number(levelDb);
        if (Number.isFinite(numericLevel)) {
            const maxBoost = 12;
            let clamped = Math.min(maxBoost, Math.max(-120, numericLevel));

            const rounded = Number(clamped.toFixed(3));
            if (rounded === 0) {
                return '0dB';
            }

            return `${rounded}dB`;
        }

        return '0dB';
    }

    getVideoFormats() {
        return [
            { id: '1080i50', name: '1080i50 (1920x1080 interlaced)' },
            { id: '1080p25', name: '1080p25 (1920x1080 progressive)' },
            { id: '1080p30', name: '1080p30 (1920x1080 progressive)' },
            { id: '720p50', name: '720p50 (1280x720 progressive)' },
            { id: '720p60', name: '720p60 (1280x720 progressive)' },
            { id: '576i50', name: '576i50 (720x576 interlaced PAL)' }
        ];
    }

    getClockPosition(position) {
        const positions = {
            'top-left': { x: '10', y: '10' },
            'top-center': { x: '(w-text_w)/2', y: '10' },
            'top-right': { x: 'w-text_w-10', y: '10' },
            'center-left': { x: '10', y: '(h-text_h)/2' },
            'center': { x: '(w-text_w)/2', y: '(h-text_h)/2' },
            'center-right': { x: 'w-text_w-10', y: '(h-text_h)/2' },
            'bottom-left': { x: '10', y: 'h-text_h-10' },
            'bottom-center': { x: '(w-text_w)/2', y: 'h-text_h-10' },
            'bottom-right': { x: 'w-text_w-10', y: 'h-text_h-10' }
        };
        return positions[position] || positions['bottom-right'];
    }

    getResolution(format) {
        const resolutions = {
            '1080i50': { width: 1920, height: 1080 },
            '1080p25': { width: 1920, height: 1080 },
            '1080p30': { width: 1920, height: 1080 },
            '720p50': { width: 1280, height: 720 },
            '720p60': { width: 1280, height: 720 },
            '576i50': { width: 720, height: 576 }
        };

        return resolutions[format] || { width: 1920, height: 1080 };
    }

    getFrameRate(format) {
        // Extract the frame rate from the format string
        // For interlaced formats, we use 50fps to generate all fields
        const frameRates = {
            '1080i50': 50,  // Generate at 50fps, will be interlaced to 25fps
            '1080p25': 25,
            '1080p30': 30,
            '720p50': 50,
            '720p60': 60,
            '576i50': 50    // Generate at 50fps, will be interlaced to 25fps
        };
        return frameRates[format] || 25;
    }
}

module.exports = FFmpegBuilder;
