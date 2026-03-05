# DeckLink AV Test Pattern Generator

A web interface to send video test patterns and audio tones directly to a Blackmagic DeckLink output via SDI.

Built for macOS with Blackmagic hardware. Uses a custom FFmpeg build with DeckLink support.

---

## What it does

- Outputs test patterns (color bars, SMPTE, gradients, etc.) to a DeckLink SDI card
- Configurable audio tone (frequency, level, channel mapping)
- On-screen text, logo overlay, clock with NTP sync
- Multiple video formats: 1080i50, 1080i60, 1080p25/30, 720p50/60, 576i50
- Web UI on `localhost:3000`, controllable from any browser on the local network
- Auto-start on boot via `AUTO_START_BROADCAST` env var

---

## Requirements

- **macOS** (tested on Catalina and later)
- **Blackmagic Desktop Video** drivers installed — [download here](https://www.blackmagicdesign.com/support/family/capture-and-playback)
- **A DeckLink card** connected (UltraStudio, Mini Monitor, etc.)
- **FFmpeg compiled with `--enable-decklink`** — see below
- **Node.js >= 18**

---

## FFmpeg

The standard Homebrew FFmpeg does not include DeckLink support. You need a custom build.

Compile with at minimum:

```bash
./configure \
  --enable-gpl \
  --enable-nonfree \
  --enable-decklink \
  --enable-libfreetype \
  --enable-libfontconfig \
  --extra-cflags="-I/path/to/decklink-sdk/include" \
  --extra-ldflags="-F/Library/Frameworks -framework DeckLinkAPI"
make -j$(sysctl -n hw.ncpu)
```

The Blackmagic DeckLink SDK is available free from the [Blackmagic support page](https://www.blackmagicdesign.com/support/family/capture-and-playback) (same page as Desktop Video drivers, scroll to SDK).

By default the app looks for the binary at `~/ffmpeg-4.4.4/build/bin/ffmpeg`. Override with `FFMPEG_PATH` in `.env`.

---

## Install

```bash
git clone https://github.com/stephanebhiri/decklink-AV-test-pattern-generator.git
cd decklink-AV-test-pattern-generator
bash install.sh
```

The script checks for Node.js, installs npm dependencies, verifies FFmpeg and drivers, and creates a `.env` template.

---

## Configuration

Edit `web-interface/.env` (created by install.sh):

```env
# Path to your FFmpeg binary (with DeckLink support)
FFMPEG_PATH=/path/to/ffmpeg

# Path to your logo PNG (optional, transparent background recommended)
LOGO_PATH=/path/to/logo.png

# Server port (default: 3000)
PORT=3000

# Auto-start broadcast when the server starts
AUTO_START_BROADCAST=false
AUTO_START_DELAY_MS=5000
```

---

## Run

```bash
cd web-interface
node server.js
```

Open [http://localhost:3000](http://localhost:3000).

---

## Logo

The interface supports a custom logo overlay. Supply a PNG with a transparent background. Set `LOGO_PATH` in `.env` or upload directly via the web UI.

---

## Notes

- NTP sync runs every 15 minutes to keep the on-screen clock accurate
- Uploaded files (logos, custom backgrounds) go into `web-interface/uploads/` and persist across restarts
- Tested with UltraStudio Mini Monitor and UltraStudio 4K
