# Professional Test Pattern Generator for Blackmagic DeckLink

Professional-grade test pattern generator specifically designed for Blackmagic DeckLink devices with comprehensive web interface for broadcast testing and monitoring.

## Overview

This is a professional test pattern generator built specifically for Blackmagic DeckLink devices. It provides comprehensive SDI test signals with advanced timing, 8-channel audio testing, NTP clock synchronization, and frame-accurate timing for professional broadcast applications.

![Professional Test Pattern Output](https://github.com/stephanebhiri/decklink-AV-test-pattern-generator/raw/main/docs/test-pattern-output.png)
*Example output showing PAL 100% bars with custom branding, NTP-synchronized clock, and comprehensive overlay information*

![Web Interface - Main Controls](https://github.com/stephanebhiri/decklink-AV-test-pattern-generator/raw/main/docs/web-interface-main.png)
*Professional web interface with real-time controls for all parameters*

![Web Interface - Audio Testing](https://github.com/stephanebhiri/decklink-AV-test-pattern-generator/raw/main/docs/web-interface-audio.png)
*8-channel audio testing with individual channel control, ID cycling, and flash testing*

## Key Features

### 🎯 **Test Pattern Sources**
- **SMPTE Test Patterns**: SMPTE SD bars, SMPTE HD bars
- **Professional Test Sources**: RGB test patterns, YUV test patterns, Multi-pattern test
- **Broadcast Standards**: PAL 75% bars, PAL 100% bars *(shown in screenshot)*
- **Classic Patterns**: Color bars, resolution test charts
- **Advanced Generators**: All RGB colors, All YUV colors, Hald CLUT identity
- **Custom Backgrounds**: Upload PNG/JPG/SVG images
- **Solid Colors**: Blue, black, white backgrounds

### 🎬 **Video Output Formats**
- **1080i50** (1920x1080 interlaced 25fps)
- **1080i60** (1920x1080 interlaced 30fps)
- **1080p25** (1920x1080 progressive 25fps)
- **1080p30** (1920x1080 progressive 30fps)
- **720p50** (1280x720 progressive 50fps)
- **720p60** (1280x720 progressive 60fps)
- **576i50** (720x576 interlaced PAL)

### 🔊 **8-Channel Audio Testing**
- **Full 8-Channel Support**: Individual control for each channel *(as shown in interface)*
- **Audio Sync Testing**: Configurable test tones (1Hz-20kHz)
- **Level Control**: -60dB to +12dB per channel
- **Channel Mapping**: Enable/disable individual channels
- **Audio ID Cycling**: Per-channel identification with cycling tones *(Ch3, Ch7 in example)*
- **Frame-Accurate Audio Flash**: Synchronized 1kHz/400Hz audio bursts *(Ch2, Ch6 shown)*
- **Force 400Hz Override**: Override specific channels with 400Hz test tone *(Ch4, Ch8 shown)*

### 🕒 **NTP Clock & Synchronization**
- **NTP Synchronization**: Network Time Protocol with multiple NTP servers *(time.cloudflare.com shown)*
- **Precision Timing**: Millisecond-accurate clock display *(43.095ms precision shown)*
- **Frame Counter**: Frame-accurate counter (25/30/50/60 fps ranges)
- **Latency Compensation**: Configurable delay adjustment *(500ms SDI lead shown)*
- **Audio/Video Sync**: Preroll buffers for stable DeckLink output
- **Clock Positioning**: 9-position grid layout *(bottom-right position shown)*

### 📺 **Visual Elements**
- **Multi-Line Text**: Customizable on-screen text with positioning
- **Logo Support**: PNG logo upload with 9-position placement
- **Font Options**: SF Mono, Arial Bold, Arial Black, Impact
- **Text Styling**: Colors, backgrounds, positioning
- **Moving Animations**: Animated square overlay, staircase + pulse patterns

### ⚡ **Flash Testing**
- **Video Flash Overlays**: Frame-accurate white flash with positioning
- **Audio Flash Synchronization**: 1kHz lead, 400Hz tail audio bursts
- **2-Second Cycle Timing**: Precise timing control
- **Vertical Offset Control**: Configurable flash position

### 🌐 **Web Interface**
- **Real-Time Control**: Live parameter adjustment
- **FFmpeg Command Preview**: Real-time command generation
- **Preset Management**: Save/load/delete configurations
- **Process Control**: Start/stop with status monitoring
- **Web Monitor**: Live HLS stream preview
- **Modern UI**: Responsive broadcast-focused interface

### 🎨 **Advanced Generators**
- **Animated Sources**: Mandelbrot fractals, Game of Life, cellular automaton
- **Gradient Animations**: Moving gradient patterns
- **Mathematical Patterns**: Sierpinski fractals
- **CoreImage Generators**: macOS CoreImage sources
- **Frei0r Sources**: Open source video effects
- **OpenCL Sources**: GPU-accelerated generators

## Technical Specifications

### Hardware Requirements
- **Blackmagic DeckLink device** (any model)
- **FFmpeg with DeckLink support**
- **macOS/Linux/Windows** system
- **Node.js 14+** for web interface

### Video Processing
- **Frame-Accurate Timing**: Expression-based frame counting
- **Interlaced Support**: Proper field handling for interlaced formats
- **Format Conversion**: Progressive to interlaced conversion
- **Preroll Buffers**: 300ms preroll for stable output
- **Pixel Formats**: UYVY422 for professional broadcast

### Audio Processing
- **Sample Rate**: 48kHz professional broadcast standard
- **Bit Depth**: 16-bit audio output
- **Channel Layouts**: 1-8 channels with proper routing
- **Frame Synchronization**: Sample-accurate audio timing
- **Audio Delay**: 300ms preroll matching video

### Timing System
- **NTP Servers**: Cloudflare, Google, NIST time sources
- **Frame Accuracy**: Frame-based expressions (not time-based)
- **Cycle Management**: 2-second cycles for flash sequences
- **Latency Handling**: Configurable compensation (default 200ms)

## Installation & Setup

### Prerequisites
```bash
# Install Node.js dependencies
cd web-interface
npm install

# Ensure FFmpeg with DeckLink support is available
ffmpeg -f decklink -list_devices true -i dummy
```

### Blackmagic Setup
1. Install **Blackmagic Desktop Video** drivers
2. Connect DeckLink device
3. Configure device via **Blackmagic Desktop Video Setup**
4. Verify device detection in FFmpeg

### Start Application
```bash
cd web-interface
npm start
# Access web interface at http://localhost:3000
```

## Usage Examples

### Basic Test Pattern
1. **Select Format**: Choose 1080i50 for broadcast standard
2. **Pick Pattern**: Select "SMPTE HD bars" for standard test
3. **Configure Audio**: Enable 8 channels with 1kHz tone
4. **Start Output**: Begin SDI transmission to DeckLink

### Audio Sync Testing
1. **Enable Channels**: Map audio to channels 1-8
2. **Set ID Cycling**: Enable on channels 3 and 7 for identification
3. **Configure Flash**: Enable audio flash on channels 2 and 6
4. **Adjust Levels**: Set appropriate test levels (-20dB typical)

### NTP Clock Testing
1. **Enable NTP Clock**: Show synchronized time display
2. **Position Clock**: Place in bottom-right corner
3. **Set Latency**: Adjust for system delay compensation
4. **Monitor Sync**: Check NTP synchronization status

### Custom Branding
1. **Upload Logo**: Add PNG logo file
2. **Position Logo**: Place in top-right corner
3. **Add Text**: Custom overlay text
4. **Save Preset**: Store configuration for reuse

## API Reference

### REST Endpoints
- `GET /api/config` - Current configuration
- `POST /api/config` - Update parameters
- `GET /api/video-formats` - Available formats
- `GET /api/background-sources` - Test pattern sources
- `POST /api/upload/background` - Upload custom background
- `POST /api/upload/logo` - Upload logo file
- `GET /api/presets` - List saved presets
- `POST /api/presets` - Save preset
- `DELETE /api/presets/:name` - Delete preset

### Socket.IO Events
- `ffmpeg_output` - Real-time process output
- `ffmpeg_error` - Error notifications
- `process_exit` - Process termination
- `config_update` - Configuration changes

## Known Issues & TODO

### Current Limitations
- **Interlaced Flash Timing**: Flash should span 2 frames for interlaced formats (2 progressive frames from 50p fps become 1 interlaced frame at 25i fps with 2 fields) - currently only provides one field

### Planned Features
- Enhanced color space controls for broadcast standards
- Embedded SDI audio metadata support
- Remote API for automation systems
- Advanced pattern generators

## Troubleshooting

### Common Issues
- **No DeckLink Output**: Verify driver installation and device connection
- **Audio Sync Problems**: Check latency compensation settings
- **Timing Drift**: Enable NTP synchronization for accuracy
- **Performance Issues**: Reduce animation complexity

### Debug Tools
- **Command Preview**: Verify FFmpeg command generation
- **Web Monitor**: Check output signal quality via HLS
- **Browser Console**: Monitor real-time status
- **Server Logs**: Review backend processing

## Professional Use Cases

### Broadcast Testing
- **Signal Path Verification**: End-to-end testing
- **Audio Channel Mapping**: Verify routing and levels
- **Timing Verification**: NTP-synchronized clock testing
- **Format Compliance**: Standard test patterns

### Equipment Calibration
- **Monitor Calibration**: Color and geometry reference
- **Audio Level Setting**: Test tone generation
- **Sync Testing**: Audio/video synchronization
- **Resolution Verification**: Pixel-accurate patterns

### System Integration
- **Automation Testing**: API-driven pattern generation
- **Multi-Format Support**: Various broadcast standards
- **Preset Management**: Quick configuration switching
- **Remote Monitoring**: Web-based signal verification

## Technical Support

For technical support and feature requests, refer to project documentation and development resources.

---

**Professional test pattern generator for Blackmagic DeckLink devices - comprehensive SDI testing with NTP synchronization, 8-channel audio, and frame-accurate timing.**