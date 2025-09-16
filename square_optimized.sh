#!/bin/bash

echo "=== Carré Animé Optimisé avec Overlay ==="

cd ~/ffmpeg-4.4.4

# Version optimisée: génère le carré une fois, puis le déplace avec overlay
./ffmpeg -f lavfi -i "color=c=black:size=1920x1080:rate=25" \
         -f lavfi -i "color=c=white:size=100x100:rate=25" \
         -f lavfi -i "sine=frequency=1000:sample_rate=48000" \
         -filter_complex "[0][1]overlay=x='t*25':y=490[v]" \
         -map "[v]" -map 2:a \
         -c:v v210 -pix_fmt yuv422p10le -r 25 \
         -field_order tt -flags +ilme+ildct \
         -c:a pcm_s16le -ar 48000 -ac 2 \
         -f decklink -s 1920x1080 \
         "UltraStudio Mini Monitor"