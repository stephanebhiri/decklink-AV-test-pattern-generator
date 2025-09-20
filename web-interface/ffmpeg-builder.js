// FFmpeg Command Builder for ACTUA Broadcast Generator
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

class FFmpegBuilder {
    constructor() {
        // Allow FFmpeg path to be configured via environment variable
        this.ffmpegPath = process.env.FFMPEG_PATH ||
                         path.join(process.env.HOME, 'ffmpeg-4.4.4', 'build', 'bin', 'ffmpeg') ||
                         'ffmpeg'; // Fallback to system PATH
        this.picturesPath = path.join(process.env.HOME, 'Pictures');
        this.logoPath = path.join(this.picturesPath, 'PNG-actua', 'actua.png');
        this.barsPath = path.join(this.picturesPath, 'bars.png');
        this.resolutionTestPath = path.join(this.picturesPath, 'resolution_test.png');
        this.fontPath = '/System/Library/Fonts/SFNSMono.ttf';
        this.cachedDecklinkSinks = null;
        this.defaultDecklinkName = 'UltraStudio Mini Monitor';
        this.clockLatencyMs = 200;
        this.ntpOffsetMs = 0;
        this.ntpDispersionMs = null;
        this.ntpSource = 'system clock';
        this.ntpLastSync = null;
        this.clockEpochMs = null;
        this.fontOptions = {
            sf_mono: {
                type: 'fontfile',
                candidates: [this.fontPath]
            },
            arial_bold: {
                type: 'fontfile',
                candidates: [
                    '/Library/Fonts/Arial Bold.ttf',
                    '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
                    '/System/Library/Fonts/Arial Bold.ttf'
                ],
                fallbackName: 'Arial-BoldMT'
            },
            arial_black: {
                type: 'fontfile',
                candidates: [
                    '/Library/Fonts/Arial Black.ttf',
                    '/System/Library/Fonts/Supplemental/Arial Black.ttf',
                    '/System/Library/Fonts/Arial Black.ttf'
                ],
                fallbackName: 'Arial-Black'
            },
            impact: {
                type: 'fontfile',
                candidates: [
                    '/Library/Fonts/Impact.ttf',
                    '/System/Library/Fonts/Supplemental/Impact.ttf',
                    '/System/Library/Fonts/Impact.ttf'
                ],
                fallbackName: 'Impact'
            }
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
            audioChannelFlash = [],
            audioChannelForce400 = [],
            animation = null,
            videoFormat = '1080i50',
            showClock = false,
            clockPosition = 'bottom-right',
            showConfigOverlay = false,
            configOverlayFontSize = null,
            configOverlayPosition = 'top-left',
            flashOverlayOffset = 0,
            decklinkDevice = null,
            clockLatencyMs = this.clockLatencyMs
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
        const squareBlockSize = Math.max(40, Math.round(Math.min(width, height) * 0.09));

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
        }
        // FFmpeg source backgrounds
        else if (background === 'allrgb') {
            cmd.push('-f', 'lavfi', '-i', `allrgb=size=${resolution}:rate=${fps}`);
            inputs.push('0:v');
        } else if (background === 'allyuv') {
            cmd.push('-f', 'lavfi', '-i', `allyuv=size=${resolution}:rate=${fps}`);
            inputs.push('0:v');
        } else if (background === 'color') {
            cmd.push('-f', 'lavfi', '-i', `color=c=blue:size=${resolution}:rate=${fps}`);
            inputs.push('0:v');
        } else if (background === 'haldclutsrc') {
            cmd.push('-f', 'lavfi', '-i', `haldclutsrc=level=6`);
            inputs.push('0:v');
        } else if (background === 'nullsrc') {
            cmd.push('-f', 'lavfi', '-i', `nullsrc=size=${resolution}:rate=${fps}`);
            inputs.push('0:v');
        }
        // Animated backgrounds
        else if (background === 'cellauto') {
            cmd.push('-f', 'lavfi', '-i', `cellauto=size=${resolution}:rate=${fps}`);
            inputs.push('0:v');
        } else if (background === 'gradients') {
            cmd.push('-f', 'lavfi', '-i', `gradients=size=${resolution}:rate=${fps}`);
            inputs.push('0:v');
        } else if (background === 'life') {
            cmd.push('-f', 'lavfi', '-i', `life=size=${resolution}:rate=${fps}`);
            inputs.push('0:v');
        } else if (background === 'mandelbrot') {
            cmd.push('-f', 'lavfi', '-i', `mandelbrot=size=${resolution}:rate=${fps}`);
            inputs.push('0:v');
        } else if (background === 'sierpinski') {
            cmd.push('-f', 'lavfi', '-i', `sierpinski=size=${resolution}:rate=${fps}`);
            inputs.push('0:v');
        }
        // Test pattern backgrounds
        else if (background === 'mptestsrc') {
            cmd.push('-f', 'lavfi', '-i', `mptestsrc=size=${resolution}:rate=${fps}`);
            inputs.push('0:v');
        } else if (background === 'pal75bars') {
            cmd.push('-f', 'lavfi', '-i', `pal75bars=size=${resolution}:rate=${fps}`);
            inputs.push('0:v');
        } else if (background === 'pal100bars') {
            cmd.push('-f', 'lavfi', '-i', `pal100bars=size=${resolution}:rate=${fps}`);
            inputs.push('0:v');
        } else if (background === 'rgbtestsrc') {
            cmd.push('-f', 'lavfi', '-i', `rgbtestsrc=size=${resolution}:rate=${fps}`);
            inputs.push('0:v');
        } else if (background === 'smptebars') {
            cmd.push('-f', 'lavfi', '-i', `smptebars=size=${resolution}:rate=${fps}`);
            inputs.push('0:v');
        } else if (background === 'smptehdbars') {
            cmd.push('-f', 'lavfi', '-i', `smptehdbars=size=${resolution}:rate=${fps}`);
            inputs.push('0:v');
        } else if (background === 'testsrc') {
            cmd.push('-f', 'lavfi', '-i', `testsrc=size=${resolution}:rate=${fps}`);
            inputs.push('0:v');
        } else if (background === 'testsrc2') {
            cmd.push('-f', 'lavfi', '-i', `testsrc2=size=${resolution}:rate=${fps}`);
            inputs.push('0:v');
        } else if (background === 'yuvtestsrc') {
            cmd.push('-f', 'lavfi', '-i', `yuvtestsrc=size=${resolution}:rate=${fps}`);
            inputs.push('0:v');
        }
        // Special sources (may require additional parameters)
        else if (background === 'coreimagesrc') {
            cmd.push('-f', 'lavfi', '-i', `coreimagesrc=size=${resolution}:rate=${fps}:list_generators=1`);
            inputs.push('0:v');
        } else if (background === 'frei0r_src') {
            cmd.push('-f', 'lavfi', '-i', `frei0r_src=size=${resolution}:rate=${fps}`);
            inputs.push('0:v');
        } else if (background === 'openclsrc') {
            cmd.push('-f', 'lavfi', '-i', `openclsrc=size=${resolution}:rate=${fps}`);
            inputs.push('0:v');
        }
        // Default fallback
        else {
            cmd.push('-f', 'lavfi', '-i', `color=c=blue:size=${resolution}:rate=${fps}`);
            inputs.push('0:v');
        }

        let nextInput = 1;

        // Animation input (if needed)
        let animationInputLabel = null;
        if (animation === 'square') {
            const squareColour = '0xff2020';
            cmd.push('-f', 'lavfi', '-i', `color=c=${squareColour}:size=${squareBlockSize}x${squareBlockSize}:rate=${fps}`);
            animationInputLabel = `[${nextInput}:v]`;
            nextInput++;
        } else if (animation === 'staircase_pulse') {
            cmd.push('-f', 'lavfi', '-i', `color=c=black@0:size=${resolution}:rate=${fps}`);
            animationInputLabel = `[${nextInput}:v]`;
            nextInput++;
        }

        // Logo input
        let logoInputLabel = null;
        if (showLogo) {
            const logoPath = logoFile ? path.join(process.env.HOME, 'PLAYTOBMD', 'web-interface', 'uploads', logoFile) : this.logoPath;
            cmd.push('-i', logoPath);
            logoInputLabel = `[${nextInput}:v]`;
            nextInput++;
        }

        // Audio input (support channel mapping)
        const normalizedAudioFreq = Number.isFinite(audioFreq) ? audioFreq : parseInt(audioFreq, 10);
        const toneFrequency = Number.isFinite(normalizedAudioFreq) ? normalizedAudioFreq : 1000;
        const clampedToneFrequency = Math.max(20, Math.min(20000, toneFrequency));
        const channelMap = this.resolveAudioChannelMap(audioChannelMap, audioChannels);
        const idCycleFlags = this.normalizeChannelOption(audioChannelIdCycle);
        const flashFlags = this.normalizeChannelOption(audioChannelFlash);
        const force400Flags = this.normalizeChannelOption(audioChannelForce400);
        const requiresExtendedLayout = channelMap.some((isActive, index) => isActive && index >= 2);
        const decklinkAudioChannels = requiresExtendedLayout ? 8 : 2;
        const audioLayout = this.getAudioChannelLayout(decklinkAudioChannels);
        const cycleExpr = this.getCycleEnvelope();
        const { flashLeadGate, flashTailGate } = this.getFlashGateExpressions(fps);
        const silentExpr = '(0.000001)';
        const channelExprList = [];
        for (let idx = 0; idx < decklinkAudioChannels; idx++) {
            const isActive = Boolean(channelMap[idx]);

            if (!isActive) {
                channelExprList.push(silentExpr);
                continue;
            }

            const channelFreq = force400Flags[idx] ? 400 : clampedToneFrequency;
            let expr = `sin(2*PI*${channelFreq}*t)`;

            const cycleEnabled = Boolean(idCycleFlags[idx]);
            const flashEnabled = Boolean(flashFlags[idx]);

            if (cycleEnabled) {
                expr = `(${expr}*${cycleExpr})`;
            }

            if (flashEnabled) {
                const flashTerms = [
                    `(sin(2*PI*1000*t)*${flashLeadGate})`,
                    `(sin(2*PI*400*t)*${flashTailGate})`
                ];
                const combinedFlash = flashTerms.join('+');
                expr = cycleEnabled
                    ? `(${expr})+${combinedFlash}`
                    : combinedFlash;
            }

            channelExprList.push(expr);
        }

        while (channelExprList.length < decklinkAudioChannels) {
            channelExprList.push(silentExpr);
        }

        const channelExprs = channelExprList.join('|');
        cmd.push('-f', 'lavfi', '-i', `aevalsrc=exprs=${channelExprs}:sample_rate=48000:channel_layout=${audioLayout}`);

        // Build filter chain
        let currentOutput = '[0:v]';
        let filterIndex = 0;

        // Normalize frame rate before heavy filters so the clock sees each frame/field consistently
        filterComplex.push(`${currentOutput}fps=${fps}[fps${filterIndex}]`);
        currentOutput = `[fps${filterIndex}]`;
        filterIndex++;

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
                    const escapedLine = this.escapeDrawtextText(line);

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
        const flashOverlayFilters = [];
        if (flashFlags.some(Boolean)) {
            // Flash vidéo 1-frame, alternés sans chevauchement
            // Cycle 2 s @ fps : frame n%framesPer2s == 0 (1 kHz) puis n%framesPer2s == fps (400 Hz)
            const framesPer2s = Math.max(1, Math.round(fps * 2));
            const flashLeadEnable = `eq(mod(n\,${framesPer2s})\,0)`;      // t = 0 s
            const flashTailEnable = `eq(mod(n\,${framesPer2s})\,${fps})`; // t = +1 s
            const flashBoxWidth = 'iw*0.15';
            const flashBoxHeight = 'ih*0.15';
            const flashTextSize = Math.max(32, Math.round(height * 0.08));
            const escapedFontPath = this.fontPath.replace(/'/g, "\'");
            const flashOverlayY = this.getFlashOverlayYExpression(flashOverlayOffset, flashBoxHeight);
            const overlays = [
                { enable: flashLeadEnable, boxColor: 'white@0.9', text: '1KHz', textColor: 'black' },
                { enable: flashTailEnable, boxColor: 'black@0.9', text: '400Hz', textColor: 'white' }
            ];

            overlays.forEach(({ enable, boxColor, text, textColor }) => {
                const boxFilter = `drawbox=x=(iw-${flashBoxWidth})/2:y='${flashOverlayY}':w=${flashBoxWidth}:h=${flashBoxHeight}:color=${boxColor}:t=fill:enable='${enable}'`;
                const textFilter = `drawtext=text='${text}':fontfile='${escapedFontPath}':fontsize=${flashTextSize}:fontcolor=${textColor}:x=(w-text_w)/2:y='${this.getFlashOverlayTextYExpression(flashOverlayY, flashBoxHeight)}':enable='${enable}'`;
                flashOverlayFilters.push(boxFilter, textFilter);
            });
        }

        if (animation === 'square' && animationInputLabel) {
            const maxX = Math.max(0, width - squareBlockSize);
            const maxY = Math.max(0, height - squareBlockSize);
            const frameRate = Math.max(1, fps);
            const horizontalSpeed = maxX > 0 ? (8 * frameRate).toFixed(2) : '0';
            const verticalSpeed = maxY > 0 ? (6 * frameRate).toFixed(2) : '0';
            const frameCounterExpr = `(n/${frameRate})`;
            const horizontalExpr = maxX > 0
                ? `abs(mod(${frameCounterExpr}*${horizontalSpeed},${(maxX * 2).toFixed(2)})-${maxX})`
                : '0';
            const verticalExpr = maxY > 0
                ? `abs(mod(${frameCounterExpr}*${verticalSpeed},${(maxY * 2).toFixed(2)})-${maxY})`
                : '0';
            const squareOverlayLabel = `[anim${filterIndex}]`;
            filterComplex.push(`${currentOutput}${animationInputLabel}overlay=x='${horizontalExpr}':y='${verticalExpr}'${squareOverlayLabel}`);
            currentOutput = squareOverlayLabel;
            filterIndex++;
        } else if (animation === 'staircase_pulse' && animationInputLabel) {
            const stepCount = 6;
            const stairBaseLabel = `[anim${filterIndex}]`;
            const stepExpr = `floor(mod(((Y/${height})*${stepCount})+(T*0.35),${stepCount}))`;
            const stepScale = Math.round(180 / Math.max(1, stepCount - 1));
            const luminanceExpr = `${60} + ${stepScale}*${stepExpr}`;
            const alphaExpr = `if(gt(${stepExpr},0),200,120)`;
            filterComplex.push(`${animationInputLabel}format=rgba,geq=r='${luminanceExpr}':g='${luminanceExpr}':b='${luminanceExpr}':a='${alphaExpr}'${stairBaseLabel}`);
            filterIndex++;

            const pulseLabel = `[anim${filterIndex}]`;
            const pulseSpeed = (0.45 * width).toFixed(2);
            const pulseWidth = Math.max(4, Math.round(width * 0.012));
            // Calage frame-accurate du pulse (remplace t par n/fps)
            const frameCounterExpr = `(n/${fps})`;
            filterComplex.push(`${stairBaseLabel}drawbox=x='mod(${frameCounterExpr}*${pulseSpeed},${width})':y=0:w=${pulseWidth}:h=${height}:color=white@0.75:t=fill${pulseLabel}`);
            filterIndex++;

            const overlayLabel = `[anim${filterIndex}]`;
            filterComplex.push(`${currentOutput}${pulseLabel}overlay=0:0:shortest=1${overlayLabel}`);
            currentOutput = overlayLabel;
            filterIndex++;
        }

        // Add logo
        if (showLogo && logoInputLabel) {
            const logoOverlayLabel = `[logo${filterIndex}]`;
            filterComplex.push(`${currentOutput}${logoInputLabel}overlay=${logoPos.x}:${logoPos.y}${logoOverlayLabel}`);
            currentOutput = logoOverlayLabel;
            filterIndex++;
        }

        // Add clock
        if (showClock) {
            const clockPos = this.getClockPosition(clockPosition);
            const clockFontSize = Math.max(28, Math.round(48 * (height / 1080)));
            const clockBoxBorder = Math.max(3, Math.round(clockFontSize * 0.1));

            const lineHeight = Math.max(clockFontSize + 4, Math.round(clockFontSize * 1.2));
            const clockTiming = this.computeClockTimingData({ fps, latencyMs: clockLatencyMs });
            const escapedLines = clockTiming.lines.map(line => this.escapeDrawtextText(line));
            const totalLines = escapedLines.length;

            escapedLines.forEach((lineText, lineIndex) => {
                const placementIndex = clockPosition.startsWith('bottom')
                    ? totalLines - 1 - lineIndex
                    : lineIndex;
                const yExpr = this.resolveClockLineY(clockPos.y, placementIndex, totalLines, lineHeight, clockPosition);
                const clockFilter = `drawtext=text='${lineText}':fontfile='${this.fontPath}':fontsize=${clockFontSize}:fontcolor=white:box=1:boxcolor=black@0.5:boxborderw=${clockBoxBorder}:x=${clockPos.x}:y=${yExpr}`;

                filterComplex.push(`${currentOutput}${clockFilter}[clock${filterIndex}]`);
                currentOutput = `[clock${filterIndex}]`;
                filterIndex++;
            });
        }

        if (showConfigOverlay) {
            const overlayFilters = this.buildConfigOverlayFilter({
                videoFormat,
                text,
                width,
                height,
                toneFrequency: clampedToneFrequency,
                audioLevelDb,
                channelMap,
                idCycleFlags,
                flashFlags,
                force400Flags,
                decklinkAudioChannels,
                overlayFontSize: configOverlayFontSize,
                overlayPosition: configOverlayPosition
            });

            if (Array.isArray(overlayFilters) && overlayFilters.length > 0) {
                overlayFilters.forEach(overlayFilter => {
                    filterComplex.push(`${currentOutput}${overlayFilter}[overlay${filterIndex}]`);
                    currentOutput = `[overlay${filterIndex}]`;
                    filterIndex++;
                });
            }
        }

        if (flashOverlayFilters.length > 0) {
            flashOverlayFilters.forEach(filterSnippet => {
                filterComplex.push(`${currentOutput}${filterSnippet}[flash${filterIndex}]`);
                currentOutput = `[flash${filterIndex}]`;
                filterIndex++;
            });
        }

        // Preroll vidéo (~300 ms) pour remplir les buffers avant DeckLink
        filterComplex.push(`${currentOutput}setpts=PTS+0.3/TB[preroll${filterIndex}]`);
        currentOutput = `[preroll${filterIndex}]`;
        filterIndex++;

        // For interlaced formats, add proper interlacing filters
        if (videoFormat.includes('i')) {
            // 50p/60p -> 25i/30i, TFF, entrelacement en fin de graphe
            filterComplex.push(`${currentOutput}fps=${fps},setsar=1/1,tinterlace=mode=interleave_top,setfield=tff[v]`);
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
        if (animation === 'square' || animation === 'staircase_pulse') audioInputIndex++; // Skip animation input
        if (showLogo) audioInputIndex++; // Skip logo input
        audioInputIndex++; // Audio is always last

        cmd.push('-map', `${audioInputIndex}:a`);

        // Audio : preroll + lissage + volume
        const audioVolume = this.resolveAudioVolume(audioLevelDb);
        if (audioVolume) {
            cmd.push('-af', `adelay=300:all=1,aresample=async=1,${`volume=${audioVolume}`}`);
        } else {
            cmd.push('-af', `adelay=300:all=1,aresample=async=1`);
        }

        // Common audio output settings
        cmd.push('-c:a', 'pcm_s16le', '-ar', '48000', '-ac', decklinkAudioChannels.toString(), '-channel_layout', audioLayout);

        // Output settings based on video format (append DeckLink options including preroll)
        const formatSettings = [...this.getVideoFormatSettings(videoFormat, decklinkDevice)];
        const targetDevice = formatSettings.pop();
        // Sortie vidéo : cadence fixe
        cmd.push('-vsync', '1');
        cmd.push(...formatSettings, '-audio_depth', '16', '-channels', decklinkAudioChannels.toString(), targetDevice);

        return cmd;
    }

    getAvailableBackgrounds() {
        return [
            { id: 'blue', name: 'Blue Background', type: 'color' },
            { id: 'black', name: 'Black Background', type: 'color' },
            { id: 'white', name: 'White Background', type: 'color' },
            { id: 'bars', name: 'Color Bars', type: 'image' },
            { id: 'resolution_test', name: 'Resolution Test Chart', type: 'image' },
            { id: 'custom', name: 'Custom Background', type: 'upload' },
            { id: 'allrgb', name: 'All RGB Colors', type: 'source' },
            { id: 'allyuv', name: 'All YUV Colors', type: 'source' },
            { id: 'cellauto', name: 'Cellular Automaton', type: 'animation' },
            { id: 'color', name: 'Solid Color', type: 'source' },
            { id: 'coreimagesrc', name: 'CoreImage Generators', type: 'source' },
            { id: 'frei0r_src', name: 'Frei0r Video Sources', type: 'source' },
            { id: 'gradients', name: 'Gradient Animation', type: 'animation' },
            { id: 'haldclutsrc', name: 'Hald CLUT Identity', type: 'source' },
            { id: 'life', name: 'Game of Life', type: 'animation' },
            { id: 'mandelbrot', name: 'Mandelbrot Fractal', type: 'animation' },
            { id: 'mptestsrc', name: 'Multi-Pattern Test', type: 'test' },
            { id: 'nullsrc', name: 'Empty/Black Source', type: 'source' },
            { id: 'openclsrc', name: 'OpenCL Generators', type: 'source' },
            { id: 'pal75bars', name: 'PAL 75% Bars', type: 'test' },
            { id: 'pal100bars', name: 'PAL 100% Bars', type: 'test' },
            { id: 'rgbtestsrc', name: 'RGB Test Pattern', type: 'test' },
            { id: 'sierpinski', name: 'Sierpinski Fractal', type: 'animation' },
            { id: 'smptebars', name: 'SMPTE SD Bars', type: 'test' },
            { id: 'smptehdbars', name: 'SMPTE HD Bars', type: 'test' },
            { id: 'testsrc', name: 'Classic Test Pattern', type: 'test' },
            { id: 'testsrc2', name: 'Modern Test Pattern', type: 'test' },
            { id: 'yuvtestsrc', name: 'YUV Test Pattern', type: 'test' }
        ];
    }

    getAvailableAnimations() {
        return [
            { id: null, name: 'None' },
            { id: 'square', name: 'Moving Square' },
            { id: 'staircase_pulse', name: 'Staircase + Pulse (R&S)' }
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

    getOverlayPositions() {
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

    getVideoFormatSettings(format, requestedDevice) {
        const deviceName = this.resolveDecklinkTarget(requestedDevice);
        const formats = {
            '1080i50': [
                '-pix_fmt', 'uyvy422', '-s', '1920x1080', '-r', '25', '-field_order', 'tt',
                '-f', 'decklink', '-format_code', 'Hi50', '-raw_format', 'uyvy422'
            ],
            '1080i60': [
                '-pix_fmt', 'uyvy422', '-s', '1920x1080', '-r', '30', '-field_order', 'tt',
                '-f', 'decklink', '-format_code', 'Hi60', '-raw_format', 'uyvy422'
            ],
            '1080p25': [
                '-pix_fmt', 'uyvy422', '-s', '1920x1080', '-r', '25',
                '-f', 'decklink', '-format_code', 'Hp25', '-raw_format', 'uyvy422'
            ],
            '1080p30': [
                '-pix_fmt', 'uyvy422', '-s', '1920x1080', '-r', '30',
                '-f', 'decklink', '-format_code', 'Hp30', '-raw_format', 'uyvy422'
            ],
            '720p50': [
                '-pix_fmt', 'uyvy422', '-s', '1280x720', '-r', '50',
                '-f', 'decklink', '-format_code', 'Hp50', '-raw_format', 'uyvy422'
            ],
            '720p60': [
                '-pix_fmt', 'uyvy422', '-s', '1280x720', '-r', '60',
                '-f', 'decklink', '-format_code', 'Hp60', '-raw_format', 'uyvy422'
            ],
            '576i50': [
                '-pix_fmt', 'uyvy422', '-s', '720x576', '-r', '25',
                '-field_order', 'tt', '-flags', '+ilme+ildct',
                '-f', 'decklink', '-format_code', 'pal', '-raw_format', 'uyvy422'
            ]
        };
        const base = formats[format] || formats['1080i50'];
        return [...base, deviceName];
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

    getDecklinkSinks() {
        if (Array.isArray(this.cachedDecklinkSinks) && this.cachedDecklinkSinks.length > 0) {
            return this.cachedDecklinkSinks;
        }

        const fallback = [`${this.defaultDecklinkName} (1)`];
        try {
            const result = spawnSync(this.ffmpegPath, ['-hide_banner', '-sinks', 'decklink'], {
                encoding: 'utf8',
                env: process.env
            });

            if (result.status === 0 && typeof result.stdout === 'string') {
                const matches = result.stdout
                    .split('\n')
                    .map(line => {
                        const match = line.match(/\[(.+?)\]\s*$/);
                        return match ? match[1].trim() : null;
                    })
                    .filter(Boolean);

                if (matches.length > 0) {
                    this.cachedDecklinkSinks = matches;
                    return matches;
                }
            }
        } catch (err) {
            // Swallow errors and fall back to default.
        }

        this.cachedDecklinkSinks = fallback;
        return fallback;
    }

    resolveDecklinkTarget(requestedDevice) {
        const sinks = this.getDecklinkSinks();
        const normalizedRequest = typeof requestedDevice === 'string' ? requestedDevice.trim() : '';

        if (normalizedRequest) {
            const exactMatch = sinks.find(name => name === normalizedRequest);
            if (exactMatch) {
                return exactMatch;
            }

            const prefixMatch = sinks.find(name => name.startsWith(normalizedRequest));
            if (prefixMatch) {
                return prefixMatch;
            }

            return normalizedRequest;
        }

        return sinks[0] || `${this.defaultDecklinkName} (1)`;
    }

    getDecklinkDevices() {
        const sinks = this.getDecklinkSinks();
        return sinks.map(name => ({ id: name, name }));
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

    getFlashGateExpressions(fps) {
        // Gates audio "1-frame" sample-accurate @48 kHz (pile 1 frame vidéo)
        // Cycle 2 s : ON 960 samples (à 50 fps) à 0 s (1 kHz) puis à +1 s (400 Hz)
        const sr = 48000;
        const spf = Math.max(1, Math.round(sr / Math.max(1, fps))); // samples per frame
        const period = sr * 2; // 2 seconds
        const leadStart = 0,          leadEnd = spf - 1;          // [0 .. spf-1]
        const tailStart = sr,         tailEnd = sr + spf - 1;     // [sr .. sr+spf-1]
        const flashGain = Math.pow(10, 12 / 20).toFixed(6); // +12 dB
        // nSamples = floor(t*sr); g1 ON sur début de cycle, g2 ON à +1 s
        const sampleModulo = `mod(floor(t*${sr})\\,${period})`;
        const flashLeadGate = `if(between(${sampleModulo}\\,${leadStart}\\,${leadEnd})\\,${flashGain}\\,0)`;
        const flashTailGate = `if(between(${sampleModulo}\\,${tailStart}\\,${tailEnd})\\,${flashGain}\\,0)`;
        return { flashLeadGate, flashTailGate };
    }

    buildConfigOverlayFilter({
        videoFormat,
        width,
        height,
        toneFrequency,
        audioLevelDb,
        channelMap,
        idCycleFlags,
        flashFlags,
        force400Flags,
        decklinkAudioChannels,
        overlayFontSize,
        overlayPosition
    }) {
        const lines = [];

        if (videoFormat) {
            lines.push(`Format: ${videoFormat}`);
        }

        const channelInfo = this.collectChannelInfo({
            channelMap,
            flashFlags,
            idCycleFlags,
            force400Flags,
            limit: decklinkAudioChannels
        });

        const audioSegments = [];
        if (Number.isFinite(toneFrequency)) {
            audioSegments.push(`${Math.round(toneFrequency)} Hz`);
        }

        const formattedDb = this.formatDbLabel(audioLevelDb);
        if (formattedDb) {
            audioSegments.push(formattedDb);
        }

        if (audioSegments.length > 0 || channelInfo.baseTone.length > 0) {
            let descriptor = audioSegments.join(' ').trim();
            if (channelInfo.baseTone.length > 0) {
                const suffix = channelInfo.baseTone.join(', ');
                descriptor = descriptor
                    ? `${descriptor}: ${suffix}`
                    : suffix;
            }

            if (descriptor) {
                lines.push(`▌ ${descriptor}`);
            }
        }

        const forceLine = channelInfo.force400.length > 0
            ? channelInfo.force400.join(', ')
            : '--';
        lines.push(`▌ 400Hz: ${forceLine}`);

        const cycleLine = channelInfo.cycle.length > 0
            ? channelInfo.cycle.join(', ')
            : '--';
        lines.push(`▌ Cycle ID: ${cycleLine}`);

        const flashLine = channelInfo.flash.length > 0
            ? channelInfo.flash.join(', ')
            : '--';
        lines.push(`▌ 1-frame Flash: ${flashLine}`);

        const cleanedLines = lines
            .map(line => typeof line === 'string' ? line.trim() : '')
            .filter(line => line.length > 0);

        if (cleanedLines.length === 0) {
            return [];
        }

        const resolvedFontSize = this.resolveOverlayFontSize(overlayFontSize, height);
        const overlayLineSpacing = Math.max(6, Math.round(resolvedFontSize * 0.3));
        const overlayBoxBorder = Math.max(4, Math.round(resolvedFontSize * 0.25));
        const lineStride = resolvedFontSize + overlayLineSpacing;
        const totalHeight = cleanedLines.length > 0
            ? resolvedFontSize * cleanedLines.length + overlayLineSpacing * Math.max(0, cleanedLines.length - 1)
            : 0;

        if (totalHeight <= 0) {
            return [];
        }

        const escapedFontPath = this.fontPath.replace(/'/g, "\\'");
        const xExpression = this.getOverlayXExpression(overlayPosition);
        const startY = this.getOverlayStartY(overlayPosition, height, totalHeight);

        const filters = [];

        cleanedLines.forEach((line, index) => {
            const escapedLine = this.escapeDrawtextText(line);
            const yPosition = startY + Math.round(index * lineStride);
            const drawtext = `drawtext=text='${escapedLine}':fontfile='${escapedFontPath}':fontsize=${resolvedFontSize}:fontcolor=white:box=1:boxcolor=black@0.55:boxborderw=${overlayBoxBorder}:x=${xExpression}:y=${yPosition}`;
            filters.push(drawtext);
        });

        return filters;
    }

    resolveOverlayFontSize(size, frameHeight) {
        const numeric = Number(size);
        if (Number.isFinite(numeric) && numeric >= 16 && numeric <= 160) {
            return Math.round(numeric);
        }

        const baseline = Math.max(24, Math.round(frameHeight * 0.035));
        return Math.min(160, Math.max(16, baseline));
    }

    getOverlayXExpression(position) {
        const alignRight = new Set(['top-right', 'center-right', 'bottom-right']);
        const alignCenter = new Set(['top-center', 'center', 'bottom-center']);

        if (alignRight.has(position)) {
            return 'w-text_w-50';
        }

        if (alignCenter.has(position)) {
            return '(w-text_w)/2';
        }

        return '50';
    }

    getOverlayStartY(position, frameHeight, totalHeight) {
        const margin = 50;
        const topPositions = new Set(['top-left', 'top-center', 'top-right']);
        const bottomPositions = new Set(['bottom-left', 'bottom-center', 'bottom-right']);

        if (topPositions.has(position)) {
            return margin;
        }

        if (bottomPositions.has(position)) {
            return Math.max(margin, frameHeight - totalHeight - margin);
        }

        const centered = Math.round((frameHeight - totalHeight) / 2);
        return Math.max(margin, centered);
    }

    getFlashOverlayYExpression(offsetPercent, boxHeightExpr) {
        const numeric = Number(offsetPercent);
        const clamped = Number.isFinite(numeric) ? Math.max(-100, Math.min(100, numeric)) : 0;
        const base = `(ih-(${boxHeightExpr}))/2`;
        if (clamped === 0) {
            return base;
        }

        const factor = (clamped / 100).toFixed(4);
        return `(${base})+(${factor}*(${base}))`;
    }

    getFlashOverlayTextYExpression(overlayYOffsetExpr, boxHeightExpr) {
        const convertToTextSpace = (expr) => expr
            .replace(/\bih\b/g, 'h')
            .replace(/\biw\b/g, 'w');

        const offsetExpr = convertToTextSpace(overlayYOffsetExpr);
        const boxHeightTextExpr = convertToTextSpace(boxHeightExpr);
        return `(${offsetExpr})+(((${boxHeightTextExpr})/2)-(text_h/2))`;
    }

    formatDbLabel(dbValue) {
        if (dbValue === undefined || dbValue === null) {
            return null;
        }

        const match = String(dbValue).match(/-?\d+(?:\.\d+)?/);
        if (!match) {
            return null;
        }

        const numeric = Number.parseFloat(match[0]);
        if (!Number.isFinite(numeric)) {
            return null;
        }

        const rounded = Math.round(numeric * 1000) / 1000;
        const isInteger = Number.isInteger(rounded);
        const formatted = isInteger
            ? rounded.toString()
            : rounded.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');

        const prefix = rounded > 0 ? '+' : '';
        return `${prefix}${formatted} dBFS`;
    }

    collectChannelInfo({
        channelMap,
        flashFlags,
        idCycleFlags,
        force400Flags,
        limit
    }) {
        const baseTone = [];
        const flash = [];
        const cycle = [];
        const force400 = [];

        if (!Array.isArray(channelMap)) {
            return { baseTone, flash, cycle, force400 };
        }

        const max = Math.min(
            Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : channelMap.length,
            channelMap.length
        );

        for (let i = 0; i < max; i++) {
            if (!channelMap[i]) {
                continue;
            }

            const label = `Ch${i + 1}`;
            const flashFlag = Array.isArray(flashFlags) && Boolean(flashFlags[i]);
            const cycleFlag = Array.isArray(idCycleFlags) && Boolean(idCycleFlags[i]);
            const forceFlag = Array.isArray(force400Flags) && Boolean(force400Flags[i]);

            if (flashFlag) {
                flash.push(label);
            }
            if (cycleFlag) {
                cycle.push(label);
            }

            if (forceFlag) {
                force400.push(label);
            }

            const includeInBase = !flashFlag && !forceFlag;
            if (includeInBase) {
                baseTone.push(label);
            }
        }

        return { baseTone, flash, cycle, force400 };
    }

    escapeDrawtextText(text) {
        const normalized = String(text).replace(/\\n/g, '\n');
        return normalized
            .replace(/\\/g, '\\\\')
            .replace(/\n/g, '\\\\n')
            .replace(/'/g, "\\'")
            .replace(/:/g, '\\:');
    }

    setClockTimingInfo({ latencyMs, ntpOffsetMs, ntpSource, ntpDispersionMs, ntpTimestamp } = {}, options = {}) {
        const { freezeEpoch = false, epochMs = null } = options || {};

        if (Number.isFinite(latencyMs) && latencyMs >= 0) {
            this.clockLatencyMs = latencyMs;
        }

        if (Number.isFinite(ntpOffsetMs)) {
            this.ntpOffsetMs = ntpOffsetMs;
        }

        if (Number.isFinite(ntpDispersionMs)) {
            this.ntpDispersionMs = ntpDispersionMs;
        } else if (ntpDispersionMs === null) {
            this.ntpDispersionMs = null;
        }

        if (typeof ntpSource === 'string' && ntpSource.trim().length > 0) {
            this.ntpSource = ntpSource.trim();
        }

        if (Number.isFinite(ntpTimestamp)) {
            this.ntpLastSync = ntpTimestamp;
        } else if (ntpTimestamp === null) {
            this.ntpLastSync = null;
        }

        if (Number.isFinite(epochMs)) {
            this.clockEpochMs = epochMs;
        } else if (!freezeEpoch || !Number.isFinite(this.clockEpochMs)) {
            this.clockEpochMs = Date.now();
        }
    }

    computeClockTimingData({ fps, latencyMs }) {
        const baseMs = Number.isFinite(this.clockEpochMs)
            ? this.clockEpochMs
            : Date.now();
        const latencyValue = Number.isFinite(latencyMs)
            ? latencyMs
            : Number.isFinite(this.clockLatencyMs)
                ? this.clockLatencyMs
                : 0;
        const ntpOffsetMs = Number.isFinite(this.ntpOffsetMs) ? this.ntpOffsetMs : 0;
        const totalOffsetMs = latencyValue + ntpOffsetMs;
        const baseSeconds = baseMs / 1000;
        const baseSecondsExpr = `${baseSeconds.toFixed(6)}+t`;
        const totalOffsetSeconds = totalOffsetMs / 1000;
        const utcSecondsExpr = `(${baseSecondsExpr}+${totalOffsetSeconds.toFixed(6)})`;

        const referenceUtcDate = new Date(baseMs + totalOffsetMs);
        const utcDate = referenceUtcDate.toISOString().split('T')[0];

        const localInfo = this.getLocalTimezoneInfo(referenceUtcDate);
        const localSecondsExpr = `(${utcSecondsExpr}+${localInfo.offsetSeconds.toFixed(6)})`;
        const localDate = this.formatLocalDateYMD(new Date(referenceUtcDate.getTime() + localInfo.offsetSeconds * 1000));

        const utcComponents = this.buildClockComponents(utcSecondsExpr);
        const localComponents = this.buildClockComponents(localSecondsExpr);
        const frameExpr = this.buildFrameCounterExpr(fps);

        const utcLine = `UTC ${utcDate} ${utcComponents.hms}:${frameExpr}.${utcComponents.millis}`;
        const localLine = `${localInfo.label} ${localInfo.offsetLabel} ${localDate} ${localComponents.hms}:${frameExpr}.${localComponents.millis}`;

        const ntpOffsetLabel = Number.isFinite(ntpOffsetMs)
            ? `${ntpOffsetMs >= 0 ? '+' : ''}${ntpOffsetMs.toFixed(1)}ms`
            : '0.0ms';
        const dispersionLabel = Number.isFinite(this.ntpDispersionMs)
            ? ` +/-${this.ntpDispersionMs.toFixed(1)}ms`
            : '';
        const syncSource = this.ntpSource || 'system clock';
        const infoLine = `SNTP ${syncSource} offset ${ntpOffsetLabel}${dispersionLabel}`;

        return {
            lines: [infoLine, utcLine, localLine],
            utcLine,
            localLine,
            syncLine: infoLine,
            latencyMs: latencyValue,
            ntpOffsetMs,
            totalOffsetMs,
            epochMs: baseMs
        };
    }

    buildClockComponents(totalSecondsExpr) {
        const hoursExpr = `%{eif:floor(${totalSecondsExpr}/3600)-24*floor(${totalSecondsExpr}/86400):d:02}`;
        const minutesExpr = `%{eif:floor(${totalSecondsExpr}/60)-60*floor(${totalSecondsExpr}/3600):d:02}`;
        const secondsExpr = `%{eif:floor(${totalSecondsExpr})-60*floor(${totalSecondsExpr}/60):d:02}`;
        const millisExpr = `%{eif:floor(1000*mod(${totalSecondsExpr},1)):d:03}`;

        return {
            hours: hoursExpr,
            minutes: minutesExpr,
            seconds: secondsExpr,
            millis: millisExpr,
            hms: `${hoursExpr}:${minutesExpr}:${secondsExpr}`
        };
    }

    buildFrameCounterExpr(fps) {
        const frameRate = Number.isFinite(fps) && fps > 0 ? fps : 25;
        return `%{eif:mod(n,${frameRate}):d:02}`;
    }

    resolveClockLineY(baseExpr, lineIndex, totalLines, lineHeight, clockPosition) {
        const baseWrapped = `(${baseExpr})`;

        if (clockPosition.startsWith('center')) {
            const centerOffset = (lineIndex - (totalLines - 1) / 2) * lineHeight;
            if (Math.abs(centerOffset) < 1) {
                return baseExpr;
            }
            const roundedOffset = Math.round(centerOffset);
            const sign = roundedOffset >= 0 ? '+' : '-';
            return `${baseWrapped}${sign}${Math.abs(roundedOffset)}`;
        }

        if (lineIndex === 0) {
            return baseExpr;
        }

        const offset = lineIndex * lineHeight;
        if (clockPosition.startsWith('top')) {
            return `${baseWrapped}+${offset}`;
        }
        if (clockPosition.startsWith('bottom')) {
            return `${baseWrapped}-${offset}`;
        }

        return baseExpr;
    }

    getLocalTimezoneInfo(referenceDate) {
        const date = referenceDate instanceof Date ? referenceDate : new Date();
        const offsetMinutesEast = -date.getTimezoneOffset();
        const offsetSeconds = offsetMinutesEast * 60;
        const resolvedZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local';
        let shortLabel = '';

        try {
            const parts = new Intl.DateTimeFormat(undefined, { timeZoneName: 'short' }).formatToParts(date);
            const tzPart = parts.find(part => part.type === 'timeZoneName');
            if (tzPart && tzPart.value) {
                shortLabel = tzPart.value;
            }
        } catch (err) {
            // Ignore failures and keep fallback label
        }

        const label = shortLabel && !resolvedZone.includes(shortLabel)
            ? `${resolvedZone} (${shortLabel})`
            : resolvedZone;

        return {
            label,
            zone: resolvedZone,
            shortLabel,
            offsetMinutes: offsetMinutesEast,
            offsetSeconds,
            offsetLabel: this.formatTimezoneOffset(offsetMinutesEast)
        };
    }

    formatTimezoneOffset(minutesEast) {
        if (!Number.isFinite(minutesEast)) {
            return '+00:00';
        }

        const sign = minutesEast >= 0 ? '+' : '-';
        const absMinutes = Math.abs(Math.round(minutesEast));
        const hours = String(Math.floor(absMinutes / 60)).padStart(2, '0');
        const minutes = String(absMinutes % 60).padStart(2, '0');
        return `${sign}${hours}:${minutes}`;
    }

    formatLocalDateYMD(date) {
        const d = date instanceof Date ? date : new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    getFontDirective(fontFamily) {
        const option = this.fontOptions[fontFamily] || this.fontOptions.sf_mono;

        if (option && option.type === 'fontfile') {
            const candidates = Array.isArray(option.candidates)
                ? option.candidates
                : option.value
                    ? [option.value]
                    : [];

            for (const candidate of candidates) {
                const fontPath = this.resolveFontPath(candidate);
                if (fontPath) {
                    const escaped = fontPath.replace(/'/g, "\\'");
                    return `fontfile='${escaped}'`;
                }
            }

            if (option.fallbackName) {
                return `font=${option.fallbackName}`;
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
            { id: '1080i60', name: '1080i60 (1920x1080 interlaced)' },
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
            '1080i60': { width: 1920, height: 1080 },
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
        // For interlaced formats, we generate at field rate (50/60) before tinterlace combines them
        const frameRates = {
            '1080i50': 50,  // Generate at 50fps, will be interlaced to 25fps
            '1080i60': 60,  // Generate at 60fps, will be interlaced to 30fps
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
