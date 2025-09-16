#!/bin/bash

# Version simplifiée du carré animé
echo "=== Test Carré Animé Simple ==="

cd ~/ffmpeg-4.4.4

# Test simple avec un carré blanc qui bouge
./ffmpeg -f lavfi -i "color=c=black:size=1920x1080:rate=25" \
         -f lavfi -i "sine=frequency=1000:sample_rate=48000" \
         -filter_complex "[0:v]geq=r=if(gte(X-mod(t*25,1920),0)*gte(mod(t*25,1920)+100-X,0)*gte(Y-490,0)*gte(590-Y,0),255,0):g=if(gte(X-mod(t*25,1920),0)*gte(mod(t*25,1920)+100-X,0)*gte(Y-490,0)*gte(590-Y,0),255,0):b=if(gte(X-mod(t*25,1920),0)*gte(mod(t*25,1920)+100-X,0)*gte(Y-490,0)*gte(590-Y,0),255,0)[v]" \
         -map "[v]" -map 1:a \
         -c:v v210 -pix_fmt yuv422p10le -r 25 \
         -field_order tt -flags +ilme+ildct \
         -c:a pcm_s16le -ar 48000 -ac 2 \
         -f decklink -s 1920x1080 \
         "UltraStudio Mini Monitor"