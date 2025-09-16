#!/bin/bash

echo "=== Test Barre Mobile ==="

cd ~/ffmpeg-4.4.4

# Barre verticale qui se déplace de gauche à droite
./ffmpeg -f lavfi -i "color=c=black:size=1920x1080:rate=25" \
         -f lavfi -i "sine=frequency=1000:sample_rate=48000" \
         -filter_complex "[0:v]geq=r=if(and(gte(X,T*25),lt(X,T*25+50)),255,0):g=if(and(gte(X,T*25),lt(X,T*25+50)),255,0):b=if(and(gte(X,T*25),lt(X,T*25+50)),255,0)[v]" \
         -map "[v]" -map 1:a \
         -t 30 \
         -c:v v210 -pix_fmt yuv422p10le -r 25 \
         -field_order tt -flags +ilme+ildct \
         -c:a pcm_s16le -ar 48000 -ac 2 \
         -f decklink -s 1920x1080 \
         "UltraStudio Mini Monitor"