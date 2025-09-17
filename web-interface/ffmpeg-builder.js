// FFmpeg Command Builder for ACTUA Broadcast Generator
const path = require('path');

class FFmpegBuilder {
    constructor() {
        this.ffmpegPath = path.join(process.env.HOME, 'ffmpeg-4.4.4', 'ffmpeg');
        this.picturesPath = path.join(process.env.HOME, 'Pictures');
        this.logoPath = path.join(this.picturesPath, 'PNG-actua', 'actua.png');
        this.barsPath = path.join(this.picturesPath, 'bars.png');
        this.fontPath = '/System/Library/Fonts/SFNSMono.ttf';
    }

    buildCommand(config) {
        const {
            background = 'blue',
            text = 'ACTUA PARIS',
            fontSize = 80,
            textColor = 'white',
            textPosition = 'center',
            showLogo = true,
            logoFile = null,
            logoPosition = 'top-right',
            audioFreq = 1000,
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

        // Get the framerate for the current video format
        const fps = this.getFrameRate(videoFormat);

        // Background input
        if (background === 'bars') {
            cmd.push('-loop', '1', '-i', this.barsPath);
            inputs.push('0:v');
        } else if (background === 'blue' || background === 'black' || background === 'white') {
            cmd.push('-f', 'lavfi', '-i', `color=c=${background}:size=1920x1080:rate=${fps}`);
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

        // Audio input
        cmd.push('-f', 'lavfi', '-i', `sine=frequency=${audioFreq}:sample_rate=48000`);

        // Build filter chain
        let currentOutput = '[0:v]';
        let filterIndex = 0;

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

                    const textFilter = `drawtext=text='${escapedLine}':fontfile='${this.fontPath}':fontsize=${fontSize}:fontcolor=${textColor}:x=${textPos.x}:y=${yPos}`;
                    filterComplex.push(`${currentOutput}${textFilter}[txt${filterIndex}]`);
                    currentOutput = `[txt${filterIndex}]`;
                    filterIndex++;
                }
            });
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
            const startEpochMs = Date.now();
            const baseMs = startEpochMs % 1000;
            const baseSeconds = Math.floor(startEpochMs / 1000);
            const totalSecondsExpr = `(${baseSeconds}+t)`; // runtime seconds since epoch
            const totalMillisExpr = `(${baseMs}+t*1000)`;   // runtime milliseconds within current second

            const hoursExpr = `%{eif\\:floor(${totalSecondsExpr}/3600)-24*floor(${totalSecondsExpr}/86400)\\:d\\:02}`;
            const minutesExpr = `%{eif\\:floor(${totalSecondsExpr}/60)-60*floor(${totalSecondsExpr}/3600)\\:d\\:02}`;
            const secondsExpr = `%{eif\\:floor(${totalSecondsExpr})-60*floor(${totalSecondsExpr}/60)\\:d\\:02}`;
            const millisecondsExpr = `%{eif\\:floor(${totalMillisExpr})-1000*floor(${totalMillisExpr}/1000)\\:d\\:03}`;

            // Overlay real-time GMT clock with millisecond precision
            const clockFilter = `drawtext=text='GMT ${hoursExpr}\\:${minutesExpr}\\:${secondsExpr}.${millisecondsExpr}':fontfile='${this.fontPath}':fontsize=48:fontcolor=white:box=1:boxcolor=black@0.5:boxborderw=5:x=${clockPos.x}:y=${clockPos.y}`;

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

        // Output settings based on video format
        const formatSettings = this.getVideoFormatSettings(videoFormat);
        cmd.push(...formatSettings);

        return cmd;
    }

    getAvailableBackgrounds() {
        return [
            { id: 'blue', name: 'Fond Bleu', type: 'color' },
            { id: 'black', name: 'Fond Noir', type: 'color' },
            { id: 'white', name: 'Fond Blanc', type: 'color' },
            { id: 'bars', name: 'Mire Barres', type: 'image' }
        ];
    }

    getAvailableAnimations() {
        return [
            { id: null, name: 'Aucune' },
            { id: 'square', name: 'Carré Mobile' }
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
            { id: 'top-left', name: '↖ Haut Gauche' },
            { id: 'top-center', name: '↑ Haut Centre' },
            { id: 'top-right', name: '↗ Haut Droite' },
            { id: 'center-left', name: '← Centre Gauche' },
            { id: 'center', name: '⊙ Centre' },
            { id: 'center-right', name: '→ Centre Droite' },
            { id: 'bottom-left', name: '↙ Bas Gauche' },
            { id: 'bottom-center', name: '↓ Bas Centre' },
            { id: 'bottom-right', name: '↘ Bas Droite' }
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
            { id: 'top-left', name: '↖ Haut Gauche' },
            { id: 'top-center', name: '↑ Haut Centre' },
            { id: 'top-right', name: '↗ Haut Droite' },
            { id: 'center-left', name: '← Centre Gauche' },
            { id: 'center', name: '⊙ Centre' },
            { id: 'center-right', name: '→ Centre Droite' },
            { id: 'bottom-left', name: '↙ Bas Gauche' },
            { id: 'bottom-center', name: '↓ Bas Centre' },
            { id: 'bottom-right', name: '↘ Bas Droite' }
        ];
    }

    getVideoFormatSettings(format) {
        const formats = {
            '1080i50': [
                '-pix_fmt', 'uyvy422', '-s', '1920x1080', '-r', '25', '-field_order', 'tt',
                '-c:a', 'pcm_s16le', '-ar', '48000', '-ac', '2',
                '-f', 'decklink', '-format_code', 'Hi50', '-raw_format', 'uyvy422',
                '-audio_depth', '16', '-channels', '2',
                'UltraStudio Mini Monitor'
            ],
            '1080p25': [
                '-c:v', 'v210', '-pix_fmt', 'yuv422p10le', '-r', '25',
                '-c:a', 'pcm_s16le', '-ar', '48000', '-ac', '2',
                '-f', 'decklink', '-s', '1920x1080', 'UltraStudio Mini Monitor'
            ],
            '1080p30': [
                '-c:v', 'v210', '-pix_fmt', 'yuv422p10le', '-r', '30',
                '-c:a', 'pcm_s16le', '-ar', '48000', '-ac', '2',
                '-f', 'decklink', '-s', '1920x1080', 'UltraStudio Mini Monitor'
            ],
            '720p50': [
                '-c:v', 'v210', '-pix_fmt', 'yuv422p10le', '-r', '50',
                '-c:a', 'pcm_s16le', '-ar', '48000', '-ac', '2',
                '-f', 'decklink', '-s', '1280x720', 'UltraStudio Mini Monitor'
            ],
            '720p60': [
                '-c:v', 'v210', '-pix_fmt', 'yuv422p10le', '-r', '60',
                '-c:a', 'pcm_s16le', '-ar', '48000', '-ac', '2',
                '-f', 'decklink', '-s', '1280x720', 'UltraStudio Mini Monitor'
            ],
            '576i50': [
                '-c:v', 'v210', '-pix_fmt', 'yuv422p10le', '-r', '25',
                '-field_order', 'tt', '-flags', '+ilme+ildct',
                '-c:a', 'pcm_s16le', '-ar', '48000', '-ac', '2',
                '-f', 'decklink', '-s', '720x576', 'UltraStudio Mini Monitor'
            ]
        };
        return formats[format] || formats['1080i50'];
    }

    getVideoFormats() {
        return [
            { id: '1080i50', name: '1080i50 (1920x1080 entrelacé)' },
            { id: '1080p25', name: '1080p25 (1920x1080 progressif)' },
            { id: '1080p30', name: '1080p30 (1920x1080 progressif)' },
            { id: '720p50', name: '720p50 (1280x720 progressif)' },
            { id: '720p60', name: '720p60 (1280x720 progressif)' },
            { id: '576i50', name: '576i50 (720x576 entrelacé PAL)' }
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
