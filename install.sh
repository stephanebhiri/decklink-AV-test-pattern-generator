#!/bin/bash
set -e

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== DeckLink AV Test Pattern Generator — setup ==="
echo ""

# macOS only
if [[ "$(uname)" != "Darwin" ]]; then
    echo "Error: macOS only (DeckLink Desktop Video driver requirement)."
    exit 1
fi

# Node.js
if ! command -v node &>/dev/null; then
    echo "Error: Node.js not found."
    echo "Install it from https://nodejs.org (LTS) or via Homebrew: brew install node"
    exit 1
fi

NODE_MAJOR=$(node -e "process.stdout.write(process.versions.node.split('.')[0])")
if [ "$NODE_MAJOR" -lt 18 ]; then
    echo "Error: Node.js >= 18 required (found $(node -v))."
    exit 1
fi
echo "Node.js $(node -v) — OK"

# npm install
echo ""
echo "Installing Node dependencies..."
cd "$REPO_DIR/web-interface"
npm install
cd "$REPO_DIR"
echo "Done."

# FFmpeg with DeckLink support
echo ""
echo "Checking FFmpeg..."

FFMPEG_BIN="${FFMPEG_PATH:-$HOME/ffmpeg-4.4.4/build/bin/ffmpeg}"

if [ ! -x "$FFMPEG_BIN" ]; then
    echo ""
    echo "WARNING: FFmpeg not found at: $FFMPEG_BIN"
    echo ""
    echo "This tool requires FFmpeg compiled with --enable-decklink."
    echo "The standard Homebrew build does NOT include DeckLink support."
    echo ""
    echo "Options:"
    echo "  1. Compile FFmpeg yourself with --enable-decklink and the Blackmagic SDK."
    echo "     See: https://github.com/stephanebhiri/decklink-AV-test-pattern-generator/wiki"
    echo "  2. Set FFMPEG_PATH in .env to point to your existing build:"
    echo "     echo 'FFMPEG_PATH=/path/to/your/ffmpeg' >> .env"
    echo ""
else
    if "$FFMPEG_BIN" -hide_banner -sinks decklink 2>&1 | grep -q '\['; then
        echo "FFmpeg at $FFMPEG_BIN — DeckLink output detected — OK"
    else
        echo "FFmpeg found at $FFMPEG_BIN"
        echo "WARNING: No DeckLink sinks detected. Check that Desktop Video drivers are installed"
        echo "         and a DeckLink device is connected."
    fi
fi

# Blackmagic Desktop Video drivers
echo ""
echo "Checking Blackmagic Desktop Video drivers..."
if system_profiler SPExtensionsDataType 2>/dev/null | grep -qi "decklink\|blackmagic"; then
    echo "Blackmagic drivers found — OK"
elif [ -d "/Library/Application Support/Blackmagic Design" ]; then
    echo "Blackmagic Design folder found — OK"
else
    echo "WARNING: Blackmagic Desktop Video drivers not detected."
    echo "Download from: https://www.blackmagicdesign.com/support/family/capture-and-playback"
fi

# Assets
echo ""
echo "Checking assets..."
if [ ! -f "$REPO_DIR/assets/bars.png" ]; then
    echo "WARNING: assets/bars.png missing. Color Bars background will not work."
else
    echo "assets/bars.png — OK"
fi

# Logo (optional)
LOGO_PATH="${LOGO_PATH:-$HOME/Pictures/PNG-actua/actua.png}"
if [ ! -f "$LOGO_PATH" ]; then
    echo "Logo not found at $LOGO_PATH — logo overlay will be disabled."
    echo "Set LOGO_PATH in .env to use your own logo (PNG, transparent background recommended)."
else
    echo "Logo found — OK"
fi

# .env file
echo ""
if [ ! -f "$REPO_DIR/web-interface/.env" ]; then
    cat > "$REPO_DIR/web-interface/.env" <<EOF
# FFmpeg binary compiled with --enable-decklink
# FFMPEG_PATH=$HOME/ffmpeg-4.4.4/build/bin/ffmpeg

# Path to your logo PNG (transparent background recommended)
# LOGO_PATH=$HOME/Pictures/your-logo.png

# Server port (default: 3000)
# PORT=3000

# Auto-start broadcast on server launch
# AUTO_START_BROADCAST=false
# AUTO_START_DELAY_MS=5000
EOF
    echo ".env created in web-interface/ — edit it to set your paths."
else
    echo ".env already exists."
fi

# uploads dir
mkdir -p "$REPO_DIR/web-interface/uploads/backgrounds"

echo ""
echo "=== Setup complete ==="
echo ""
echo "Start the server:"
echo "  cd web-interface && node server.js"
echo ""
echo "Then open http://localhost:3000"
