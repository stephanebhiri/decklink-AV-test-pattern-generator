#!/bin/bash

# Blackmagic Colorbar Setup Script for macOS Catalina
# Run this script with administrator privileges

echo "=== Blackmagic Desktop Video & FFmpeg Setup for 1080i50 Colorbar Output ==="

# Check if running as admin
if [[ $EUID -eq 0 ]]; then
   echo "This script should NOT be run as root directly."
   echo "Run with: sudo bash setup_blackmagic_colorbar.sh"
   exit 1
fi

# Step 1: Check if Homebrew is installed
if ! command -v brew &> /dev/null; then
    echo "Installing Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

    # Add Homebrew to PATH
    echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
    eval "$(/opt/homebrew/bin/brew shellenv)" 2>/dev/null || eval "$(/usr/local/bin/brew shellenv)"
else
    echo "Homebrew already installed"
fi

# Step 2: Install FFmpeg with Blackmagic DeckLink support
echo "Installing FFmpeg with DeckLink support..."
brew install ffmpeg

# For older versions that supported --with-decklink flag, you might need:
# brew install ffmpeg --with-decklink
# But modern FFmpeg typically includes decklink support by default

# Step 3: Verify FFmpeg DeckLink support
echo "Checking FFmpeg DeckLink support..."
if ffmpeg -f decklink -list_devices 1 -i dummy 2>&1 | grep -q "DeckLink"; then
    echo "✅ FFmpeg has DeckLink support"
else
    echo "⚠️  FFmpeg DeckLink support may not be available"
    echo "You may need to compile FFmpeg with --enable-decklink"
fi

# Step 4: Create colorbar generation script
cat > /usr/local/bin/blackmagic_colorbar.sh << 'EOL'
#!/bin/bash

# Check if device is specified
if [ -z "$1" ]; then
    echo "Usage: $0 <device_name>"
    echo "List available devices with: ffmpeg -f decklink -list_devices 1 -i dummy"
    exit 1
fi

DEVICE="$1"

echo "Starting 1080i50 colorbar output on device: $DEVICE"

# Generate 1080i50 colorbar pattern and output to Blackmagic device
ffmpeg -f lavfi -i "testsrc=size=1920x1080:rate=25:duration=0" \
       -f lavfi -i "sine=frequency=1000:sample_rate=48000" \
       -c:v v210 \
       -pix_fmt yuv422p10le \
       -r 25 \
       -field_order tt \
       -flags +ilme+ildct \
       -c:a pcm_s16le \
       -ar 48000 \
       -ac 2 \
       -f decklink \
       -s 1920x1080 \
       "$DEVICE"
EOL

chmod +x /usr/local/bin/blackmagic_colorbar.sh

echo ""
echo "=== Setup Instructions ==="
echo "1. Download and install Blackmagic Desktop Video drivers:"
echo "   - Go to: https://www.blackmagicdesign.com/support/"
echo "   - Select 'Capture and Playback' product family"
echo "   - Download 'Desktop Video' for macOS (compatible with Catalina)"
echo "   - Install with administrator privileges"
echo ""
echo "2. After driver installation, restart your Mac"
echo ""
echo "3. Connect your Blackmagic device via Thunderbolt"
echo ""
echo "4. List available devices:"
echo "   ffmpeg -f decklink -list_devices 1 -i dummy"
echo ""
echo "5. Start colorbar output:"
echo "   blackmagic_colorbar.sh \"DeckLink Mini Monitor\""
echo "   (replace with your actual device name)"
echo ""
echo "=== Alternative Manual Command ==="
echo "If the script doesn't work, use this FFmpeg command directly:"
echo ""
echo 'ffmpeg -f lavfi -i "smptebars=size=1920x1080:rate=25" \'
echo '       -f lavfi -i "sine=frequency=1000:sample_rate=48000" \'
echo '       -c:v v210 \'
echo '       -pix_fmt yuv422p10le \'
echo '       -r 25 \'
echo '       -field_order tt \'
echo '       -flags +ilme+ildct \'
echo '       -c:a pcm_s16le \'
echo '       -ar 48000 \'
echo '       -ac 2 \'
echo '       -f decklink \'
echo '       -s 1920x1080 \'
echo '       "DeckLink Mini Monitor"'
echo ""
echo "Setup script created successfully!"